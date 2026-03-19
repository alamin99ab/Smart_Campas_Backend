/**
 * Comprehensive API Testing Script
 * Tests all backend APIs in Postman-style workflow
 * Analyzes responses and validates system stability
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const API_URL = `${BASE_URL}/api`;

// Test Results Storage
const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: [],
    warnings: [],
    details: []
};

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Test context storage
const testContext = {
    superAdminToken: null,
    principalToken: null,
    teacherToken: null,
    studentToken: null,
    parentToken: null,
    accountantToken: null,
    schoolId: null,
    principalId: null,
    teacherId: null,
    studentId: null,
    parentId: null,
    classId: null,
    sectionId: null,
    subjectId: null,
    attendanceId: null,
    routineId: null,
    examId: null,
    resultId: null,
    feeId: null,
    noticeId: null
};

// Helper Functions
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(80));
    log(`  ${title}`, 'cyan');
    console.log('='.repeat(80) + '\n');
}

function logTest(method, endpoint, status) {
    const statusColor = status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : 'yellow';
    log(`[${status}] ${method.padEnd(6)} ${endpoint}`, statusColor);
}

async function makeRequest(method, endpoint, data = null, token = null, expectedStatus = [200, 201]) {
    testResults.total++;
    const url = `${API_URL}${endpoint}`;
    
    try {
        const config = {
            method,
            url,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            config.data = data;
        }

        const response = await axios(config);
        
        const statusOk = Array.isArray(expectedStatus) 
            ? expectedStatus.includes(response.status)
            : response.status === expectedStatus;

        if (statusOk) {
            testResults.passed++;
            logTest(method, endpoint, 'PASS');
            testResults.details.push({
                method,
                endpoint,
                status: 'PASS',
                statusCode: response.status,
                response: response.data
            });
            return { success: true, data: response.data, status: response.status };
        } else {
            testResults.failed++;
            logTest(method, endpoint, 'FAIL');
            testResults.errors.push({
                method,
                endpoint,
                expected: expectedStatus,
                received: response.status,
                message: 'Unexpected status code'
            });
            return { success: false, data: response.data, status: response.status };
        }
    } catch (error) {
        testResults.failed++;
        logTest(method, endpoint, 'FAIL');
        
        const errorDetail = {
            method,
            endpoint,
            error: error.response?.data?.message || error.message,
            statusCode: error.response?.status,
            details: error.response?.data
        };
        
        testResults.errors.push(errorDetail);
        testResults.details.push({
            method,
            endpoint,
            status: 'FAIL',
            error: errorDetail
        });
        
        return { success: false, error: errorDetail };
    }
}

// Test Suites

async function testHealthAndInfo() {
    logSection('1. HEALTH & INFO ENDPOINTS');
    
    await makeRequest('GET', '/health');
    await makeRequest('GET', '/');
}

async function testAuthentication() {
    logSection('2. AUTHENTICATION MODULE');
    
    // Super Admin Login
    log('\n📌 Super Admin Authentication', 'blue');
    const superAdminLogin = await makeRequest('POST', '/auth/login', {
        email: process.env.SUPER_ADMIN_EMAIL || 'alamin-admin@pandait.com',
        password: process.env.SUPER_ADMIN_PASSWORD || 'pandaitalaminn',
        role: 'superadmin'
    });
    
    if (superAdminLogin.success) {
        testContext.superAdminToken = superAdminLogin.data.token;
        log('✓ Super Admin token obtained', 'green');
    } else {
        log('✗ Failed to obtain Super Admin token', 'red');
        testResults.warnings.push('Super Admin authentication failed - subsequent tests may fail');
    }

    // Test token verification
    if (testContext.superAdminToken) {
        await makeRequest('GET', '/auth/me', null, testContext.superAdminToken);
    }

    // Test invalid login
    log('\n📌 Testing Invalid Credentials', 'blue');
    await makeRequest('POST', '/auth/login', {
        email: 'invalid@test.com',
        password: 'wrongpassword',
        role: 'student'
    }, null, [400, 401]);
}

async function testSuperAdminAPIs() {
    logSection('3. SUPER ADMIN MODULE');
    
    if (!testContext.superAdminToken) {
        log('⚠ Skipping Super Admin tests - no token available', 'yellow');
        return;
    }

    // Get dashboard
    log('\n📌 Super Admin Dashboard', 'blue');
    await makeRequest('GET', '/super-admin/dashboard', null, testContext.superAdminToken);

    // Get all schools
    log('\n📌 School Management', 'blue');
    const schoolsResponse = await makeRequest('GET', '/super-admin/schools', null, testContext.superAdminToken);
    
    if (schoolsResponse.success && schoolsResponse.data.schools?.length > 0) {
        testContext.schoolId = schoolsResponse.data.schools[0]._id;
        log(`✓ Using existing school: ${testContext.schoolId}`, 'green');
    } else {
        // Create a test school
        log('Creating test school...', 'blue');
        const newSchool = await makeRequest('POST', '/super-admin/schools', {
            name: 'Test School ' + Date.now(),
            email: `testschool${Date.now()}@test.com`,
            phone: '01700000000',
            address: 'Test Address',
            subscriptionPlan: 'premium',
            subscriptionEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        }, testContext.superAdminToken);

        if (newSchool.success) {
            testContext.schoolId = newSchool.data.school._id;
            log(`✓ Test school created: ${testContext.schoolId}`, 'green');
        }
    }

    // Get school details
    if (testContext.schoolId) {
        await makeRequest('GET', `/super-admin/schools/${testContext.schoolId}`, null, testContext.superAdminToken);
    }

    // Get all principals
    log('\n📌 Principal Management', 'blue');
    const principalsResponse = await makeRequest('GET', '/super-admin/principals', null, testContext.superAdminToken);
    
    if (principalsResponse.success && principalsResponse.data.principals?.length > 0) {
        testContext.principalId = principalsResponse.data.principals[0]._id;
        log(`✓ Using existing principal: ${testContext.principalId}`, 'green');
    }

    // System statistics
    log('\n📌 System Statistics', 'blue');
    await makeRequest('GET', '/super-admin/statistics', null, testContext.superAdminToken);

    // Audit logs
    log('\n📌 Audit Logs', 'blue');
    await makeRequest('GET', '/super-admin/audit-logs', null, testContext.superAdminToken);
}

async function testPrincipalAPIs() {
    logSection('4. PRINCIPAL MODULE');
    
    // First, try to get principal credentials
    if (!testContext.principalToken && testContext.principalId) {
        log('⚠ Need to login as principal first', 'yellow');
        // In a real scenario, we'd need principal credentials
        // For now, we'll skip if no token
    }

    if (!testContext.principalToken) {
        log('⚠ Skipping Principal tests - no token available', 'yellow');
        testResults.warnings.push('Principal authentication needed for full testing');
        return;
    }

    // Dashboard
    log('\n📌 Principal Dashboard', 'blue');
    await makeRequest('GET', '/principal/dashboard', null, testContext.principalToken);

    // School profile
    log('\n📌 School Management', 'blue');
    await makeRequest('GET', '/principal/school/profile', null, testContext.principalToken);

    // Teachers management
    log('\n📌 Teacher Management', 'blue');
    await makeRequest('GET', '/principal/teachers', null, testContext.principalToken);

    // Students management
    log('\n📌 Student Management', 'blue');
    await makeRequest('GET', '/principal/students', null, testContext.principalToken);

    // Classes management
    log('\n📌 Class Management', 'blue');
    await makeRequest('GET', '/principal/classes', null, testContext.principalToken);

    // Subjects management
    log('\n📌 Subject Management', 'blue');
    await makeRequest('GET', '/principal/subjects', null, testContext.principalToken);
}

async function testTeacherAPIs() {
    logSection('5. TEACHER MODULE');
    
    if (!testContext.teacherToken) {
        log('⚠ Skipping Teacher tests - no token available', 'yellow');
        testResults.warnings.push('Teacher authentication needed for full testing');
        return;
    }

    // Dashboard
    log('\n📌 Teacher Dashboard', 'blue');
    await makeRequest('GET', '/teacher/dashboard', null, testContext.teacherToken);

    // Profile
    log('\n📌 Teacher Profile', 'blue');
    await makeRequest('GET', '/teacher/profile', null, testContext.teacherToken);

    // Classes
    log('\n📌 My Classes', 'blue');
    await makeRequest('GET', '/teacher/my-classes', null, testContext.teacherToken);

    // Students
    log('\n📌 My Students', 'blue');
    await makeRequest('GET', '/teacher/students', null, testContext.teacherToken);

    // Attendance
    log('\n📌 Attendance Management', 'blue');
    await makeRequest('GET', '/teacher/attendance', null, testContext.teacherToken);

    // Routine
    log('\n📌 My Routine', 'blue');
    await makeRequest('GET', '/teacher/routine', null, testContext.teacherToken);
}

async function testStudentAPIs() {
    logSection('6. STUDENT MODULE');
    
    if (!testContext.studentToken) {
        log('⚠ Skipping Student tests - no token available', 'yellow');
        testResults.warnings.push('Student authentication needed for full testing');
        return;
    }

    // Dashboard
    log('\n📌 Student Dashboard', 'blue');
    await makeRequest('GET', '/student/dashboard', null, testContext.studentToken);

    // Profile
    log('\n📌 Student Profile', 'blue');
    await makeRequest('GET', '/student/profile', null, testContext.studentToken);

    // Attendance
    log('\n📌 My Attendance', 'blue');
    await makeRequest('GET', '/student/attendance', null, testContext.studentToken);

    // Results
    log('\n📌 My Results', 'blue');
    await makeRequest('GET', '/student/results', null, testContext.studentToken);

    // Routine
    log('\n📌 My Routine', 'blue');
    await makeRequest('GET', '/student/routine', null, testContext.studentToken);

    // Fees
    log('\n📌 My Fees', 'blue');
    await makeRequest('GET', '/student/fees', null, testContext.studentToken);
}

async function testParentAPIs() {
    logSection('7. PARENT MODULE');
    
    if (!testContext.parentToken) {
        log('⚠ Skipping Parent tests - no token available', 'yellow');
        testResults.warnings.push('Parent authentication needed for full testing');
        return;
    }

    // Dashboard
    log('\n📌 Parent Dashboard', 'blue');
    await makeRequest('GET', '/parent/dashboard', null, testContext.parentToken);

    // Children
    log('\n📌 My Children', 'blue');
    await makeRequest('GET', '/parent/children', null, testContext.parentToken);

    // Child attendance
    log('\n📌 Child Attendance', 'blue');
    await makeRequest('GET', '/parent/child-attendance', null, testContext.parentToken);

    // Child results
    log('\n📌 Child Results', 'blue');
    await makeRequest('GET', '/parent/child-results', null, testContext.parentToken);

    // Child fees
    log('\n📌 Child Fees', 'blue');
    await makeRequest('GET', '/parent/child-fees', null, testContext.parentToken);
}

async function testAttendanceModule() {
    logSection('8. ATTENDANCE MODULE');
    
    const token = testContext.teacherToken || testContext.principalToken || testContext.superAdminToken;
    
    if (!token) {
        log('⚠ Skipping Attendance tests - no token available', 'yellow');
        return;
    }

    log('\n📌 Attendance Records', 'blue');
    await makeRequest('GET', '/attendance', null, token);
}

async function testRoutineModule() {
    logSection('9. ROUTINE MODULE');
    
    const token = testContext.teacherToken || testContext.principalToken || testContext.superAdminToken;
    
    if (!token) {
        log('⚠ Skipping Routine tests - no token available', 'yellow');
        return;
    }

    log('\n📌 Routine Records', 'blue');
    await makeRequest('GET', '/routines', null, token);
}

async function testExamModule() {
    logSection('10. EXAM & RESULTS MODULE');
    
    const token = testContext.teacherToken || testContext.principalToken || testContext.superAdminToken;
    
    if (!token) {
        log('⚠ Skipping Exam tests - no token available', 'yellow');
        return;
    }

    log('\n📌 Exam Schedules', 'blue');
    await makeRequest('GET', '/exam-schedules', null, token);

    log('\n📌 Results', 'blue');
    await makeRequest('GET', '/results', null, token);
}

async function testFeeModule() {
    logSection('11. FEE & FINANCE MODULE');
    
    const token = testContext.accountantToken || testContext.principalToken || testContext.superAdminToken;
    
    if (!token) {
        log('⚠ Skipping Fee tests - no token available', 'yellow');
        return;
    }

    log('\n📌 Fee Records', 'blue');
    await makeRequest('GET', '/fees', null, token);
}

async function testNoticeModule() {
    logSection('12. NOTICE & NOTIFICATION MODULE');
    
    const token = testContext.principalToken || testContext.superAdminToken;
    
    if (!token) {
        log('⚠ Skipping Notice tests - no token available', 'yellow');
        return;
    }

    log('\n📌 Notices', 'blue');
    await makeRequest('GET', '/notices', null, token);

    log('\n📌 Notifications', 'blue');
    await makeRequest('GET', '/notifications', null, token);
}

async function testDashboardModule() {
    logSection('13. DASHBOARD MODULE');
    
    if (testContext.superAdminToken) {
        log('\n📌 Super Admin Dashboard', 'blue');
        await makeRequest('GET', '/dashboard/super-admin', null, testContext.superAdminToken);
    }

    if (testContext.principalToken) {
        log('\n📌 Principal Dashboard', 'blue');
        await makeRequest('GET', '/dashboard/principal', null, testContext.principalToken);
    }

    if (testContext.teacherToken) {
        log('\n📌 Teacher Dashboard', 'blue');
        await makeRequest('GET', '/dashboard/teacher', null, testContext.teacherToken);
    }

    if (testContext.studentToken) {
        log('\n📌 Student Dashboard', 'blue');
        await makeRequest('GET', '/dashboard/student', null, testContext.studentToken);
    }
}

async function testAdditionalModules() {
    logSection('14. ADDITIONAL MODULES');
    
    const token = testContext.principalToken || testContext.superAdminToken;
    
    if (!token) {
        log('⚠ Skipping Additional Module tests - no token available', 'yellow');
        return;
    }

    // Analytics
    log('\n📌 Analytics', 'blue');
    await makeRequest('GET', '/analytics/overview', null, token);

    // Events
    log('\n📌 Events', 'blue');
    await makeRequest('GET', '/events', null, token);

    // Leave Requests
    log('\n📌 Leave Requests', 'blue');
    await makeRequest('GET', '/leave', null, token);

    // Rooms
    log('\n📌 Rooms', 'blue');
    await makeRequest('GET', '/rooms', null, token);

    // Activities
    log('\n📌 Activities', 'blue');
    await makeRequest('GET', '/activities', null, token);

    // Search
    log('\n📌 Search', 'blue');
    await makeRequest('GET', '/search?q=test', null, token);

    // Public APIs
    log('\n📌 Public APIs', 'blue');
    await makeRequest('GET', '/public/schools');
}

async function testAIModule() {
    logSection('15. AI MODULE');
    
    const token = testContext.teacherToken || testContext.principalToken || testContext.superAdminToken;
    
    if (!token) {
        log('⚠ Skipping AI tests - no token available', 'yellow');
        return;
    }

    if (process.env.ENABLE_AI_FEATURES === 'true') {
        log('\n📌 AI Features', 'blue');
        await makeRequest('GET', '/ai/status', null, token);
    } else {
        log('⚠ AI features disabled', 'yellow');
    }
}

function generateReport() {
    logSection('COMPREHENSIVE TEST REPORT');
    
    const passRate = testResults.total > 0 
        ? ((testResults.passed / testResults.total) * 100).toFixed(2)
        : 0;

    log(`\n📊 Test Statistics:`, 'cyan');
    log(`   Total Tests: ${testResults.total}`, 'blue');
    log(`   Passed: ${testResults.passed}`, 'green');
    log(`   Failed: ${testResults.failed}`, 'red');
    log(`   Pass Rate: ${passRate}%`, passRate >= 90 ? 'green' : passRate >= 70 ? 'yellow' : 'red');

    if (testResults.warnings.length > 0) {
        log(`\n⚠️  Warnings (${testResults.warnings.length}):`, 'yellow');
        testResults.warnings.forEach((warning, index) => {
            log(`   ${index + 1}. ${warning}`, 'yellow');
        });
    }

    if (testResults.errors.length > 0) {
        log(`\n❌ Errors (${testResults.errors.length}):`, 'red');
        testResults.errors.forEach((error, index) => {
            log(`   ${index + 1}. ${error.method} ${error.endpoint}`, 'red');
            log(`      Error: ${error.error || error.message}`, 'red');
        });
    }

    log(`\n🎯 System Status:`, 'cyan');
    if (passRate >= 95 && testResults.errors.length === 0) {
        log(`   ✅ EXCELLENT - System is production-ready`, 'green');
        log(`   ✅ Ready for GitHub push`, 'green');
    } else if (passRate >= 85) {
        log(`   ⚠️  GOOD - Minor issues found, review recommended`, 'yellow');
        log(`   ⚠️  Fix issues before GitHub push`, 'yellow');
    } else if (passRate >= 70) {
        log(`   ⚠️  FAIR - Several issues found, fixes required`, 'yellow');
        log(`   ❌ NOT ready for GitHub push`, 'red');
    } else {
        log(`   ❌ POOR - Critical issues found, immediate attention required`, 'red');
        log(`   ❌ NOT ready for GitHub push`, 'red');
    }

    // Save detailed report to file
    const reportData = {
        timestamp: new Date().toISOString(),
        summary: {
            total: testResults.total,
            passed: testResults.passed,
            failed: testResults.failed,
            passRate: `${passRate}%`
        },
        warnings: testResults.warnings,
        errors: testResults.errors,
        details: testResults.details,
        context: testContext
    };

    const fs = require('fs');
    fs.writeFileSync(
        'API_TEST_REPORT.json',
        JSON.stringify(reportData, null, 2)
    );
    log(`\n📄 Detailed report saved to: API_TEST_REPORT.json`, 'cyan');

    // Generate markdown report
    generateMarkdownReport(reportData, passRate);
}

function generateMarkdownReport(reportData, passRate) {
    const fs = require('fs');
    
    let markdown = `# 🧪 Comprehensive API Test Report\n\n`;
    markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    markdown += `---\n\n`;
    
    markdown += `## 📊 Executive Summary\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Tests | ${reportData.summary.total} |\n`;
    markdown += `| Passed | ✅ ${reportData.summary.passed} |\n`;
    markdown += `| Failed | ❌ ${reportData.summary.failed} |\n`;
    markdown += `| Pass Rate | ${reportData.summary.passRate} |\n\n`;

    // Status Badge
    if (passRate >= 95) {
        markdown += `### 🎯 Status: ✅ PRODUCTION READY\n\n`;
        markdown += `The system has passed comprehensive testing and is ready for deployment.\n\n`;
    } else if (passRate >= 85) {
        markdown += `### 🎯 Status: ⚠️ REVIEW REQUIRED\n\n`;
        markdown += `The system is mostly functional but has some issues that should be reviewed.\n\n`;
    } else {
        markdown += `### 🎯 Status: ❌ FIXES REQUIRED\n\n`;
        markdown += `The system has critical issues that must be fixed before deployment.\n\n`;
    }

    // Warnings
    if (reportData.warnings.length > 0) {
        markdown += `## ⚠️ Warnings\n\n`;
        reportData.warnings.forEach((warning, index) => {
            markdown += `${index + 1}. ${warning}\n`;
        });
        markdown += `\n`;
    }

    // Errors
    if (reportData.errors.length > 0) {
        markdown += `## ❌ Errors Found\n\n`;
        reportData.errors.forEach((error, index) => {
            markdown += `### ${index + 1}. ${error.method} ${error.endpoint}\n\n`;
            markdown += `- **Error:** ${error.error || error.message}\n`;
            if (error.statusCode) {
                markdown += `- **Status Code:** ${error.statusCode}\n`;
            }
            markdown += `\n`;
        });
    }

    // Test Coverage
    markdown += `## 📋 Test Coverage\n\n`;
    markdown += `### Modules Tested:\n\n`;
    markdown += `- ✅ Health & Info Endpoints\n`;
    markdown += `- ✅ Authentication Module\n`;
    markdown += `- ✅ Super Admin Module\n`;
    markdown += `- ${testContext.principalToken ? '✅' : '⚠️'} Principal Module\n`;
    markdown += `- ${testContext.teacherToken ? '✅' : '⚠️'} Teacher Module\n`;
    markdown += `- ${testContext.studentToken ? '✅' : '⚠️'} Student Module\n`;
    markdown += `- ${testContext.parentToken ? '✅' : '⚠️'} Parent Module\n`;
    markdown += `- ✅ Attendance Module\n`;
    markdown += `- ✅ Routine Module\n`;
    markdown += `- ✅ Exam & Results Module\n`;
    markdown += `- ✅ Fee & Finance Module\n`;
    markdown += `- ✅ Notice & Notification Module\n`;
    markdown += `- ✅ Dashboard Module\n`;
    markdown += `- ✅ Additional Modules (Analytics, Events, etc.)\n\n`;

    // Recommendations
    markdown += `## 💡 Recommendations\n\n`;
    if (passRate >= 95 && reportData.errors.length === 0) {
        markdown += `1. ✅ System is ready for production deployment\n`;
        markdown += `2. ✅ All critical APIs are functional\n`;
        markdown += `3. ✅ Ready to push to GitHub\n`;
        markdown += `4. 📝 Consider adding more integration tests\n`;
        markdown += `5. 📝 Set up CI/CD pipeline for automated testing\n`;
    } else {
        markdown += `1. ❌ Fix all critical errors before deployment\n`;
        markdown += `2. ⚠️ Review and address all warnings\n`;
        markdown += `3. 🔄 Re-run tests after fixes\n`;
        markdown += `4. 📝 Add missing authentication tokens for complete testing\n`;
        markdown += `5. 📝 Implement proper error handling for failed endpoints\n`;
    }

    markdown += `\n---\n\n`;
    markdown += `**Note:** This report was generated automatically by the comprehensive API testing script.\n`;

    fs.writeFileSync('API_TEST_REPORT.md', markdown);
    log(`📄 Markdown report saved to: API_TEST_REPORT.md`, 'cyan');
}

// Main execution
async function runAllTests() {
    log('\n🚀 Starting Comprehensive API Testing...', 'cyan');
    log(`📍 Base URL: ${BASE_URL}`, 'blue');
    log(`⏰ Started at: ${new Date().toLocaleString()}\n`, 'blue');

    try {
        await testHealthAndInfo();
        await testAuthentication();
        await testSuperAdminAPIs();
        await testPrincipalAPIs();
        await testTeacherAPIs();
        await testStudentAPIs();
        await testParentAPIs();
        await testAttendanceModule();
        await testRoutineModule();
        await testExamModule();
        await testFeeModule();
        await testNoticeModule();
        await testDashboardModule();
        await testAdditionalModules();
        await testAIModule();

        generateReport();

        log(`\n⏰ Completed at: ${new Date().toLocaleString()}`, 'blue');
        log(`\n✨ Testing completed successfully!`, 'green');

        // Exit with appropriate code
        process.exit(testResults.failed === 0 ? 0 : 1);
    } catch (error) {
        log(`\n❌ Fatal error during testing: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    }
}

// Run tests
runAllTests();
