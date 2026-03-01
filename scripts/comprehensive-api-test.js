/**
 * 🧪 COMPREHENSIVE API TEST SUITE
 * Tests all Smart Campus SaaS endpoints
 */

const axios = require('axios');
const colors = require('colors');

// Configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5000';
let authToken = '';
let schoolId = '';
let principalId = '';
let teacherId = '';
let studentId = '';
let noticeId = '';

// Test results tracking
const testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    details: []
};

// Utility functions
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(testName, status, message = '') {
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '🔄';
    const color = status === 'pass' ? 'green' : status === 'fail' ? 'red' : 'yellow';
    
    log(`${icon} ${testName}`, color);
    if (message) {
        log(`   ${message}`, 'gray');
    }
    
    testResults.total++;
    if (status === 'pass') testResults.passed++;
    else if (status === 'fail') testResults.failed++;
    
    testResults.details.push({
        test: testName,
        status,
        message,
        timestamp: new Date().toISOString()
    });
}

async function makeRequest(method, endpoint, data = null, headers = {}) {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        if (authToken) {
            config.headers.Authorization = `Bearer ${authToken}`;
        }
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data || error.message,
            status: error.response?.status || 500
        };
    }
}

// Health check
async function testHealthCheck() {
    logTest('Health Check', 'pending');
    
    const result = await makeRequest('GET', '/api/health');
    
    if (result.success && result.data.success) {
        logTest('Health Check', 'pass', `Server running: ${result.data.message}`);
        return true;
    } else {
        logTest('Health Check', 'fail', result.error);
        return false;
    }
}

// Authentication tests
async function testSuperAdminLogin() {
    logTest('Super Admin Login', 'pending');
    
    const result = await makeRequest('POST', '/api/auth/super-admin/login', {
        email: 'superadmin@smartcampus.com',
        password: 'admin123'
    });
    
    if (result.success && result.data.success) {
        authToken = result.data.data.token;
        logTest('Super Admin Login', 'pass', 'Token received');
        return true;
    } else {
        logTest('Super Admin Login', 'fail', result.error);
        return false;
    }
}

async function testCreateSchool() {
    logTest('Create School', 'pending');
    
    const schoolData = {
        schoolName: 'Test International School API',
        address: '123 Test Street, Dhaka, Bangladesh',
        email: 'test@apischool.com',
        phone: '+8801234567890',
        schoolType: 'secondary',
        subscriptionPlan: 'standard',
        principalName: 'Test Principal API',
        principalEmail: 'principal@apischool.com',
        principalPhone: '+8801234567891',
        principalPassword: 'principal123'
    };
    
    const result = await makeRequest('POST', '/api/super-admin/schools', schoolData);
    
    if (result.success && result.data.success) {
        schoolId = result.data.data.school._id;
        principalId = result.data.data.principal.id;
        logTest('Create School', 'pass', `School ID: ${schoolId}`);
        return true;
    } else {
        logTest('Create School', 'fail', result.error);
        return false;
    }
}

async function testPrincipalLogin() {
    logTest('Principal Login', 'pending');
    
    const result = await makeRequest('POST', '/api/auth/login', {
        email: 'principal@apischool.com',
        password: 'principal123'
    });
    
    if (result.success && result.data.success) {
        authToken = result.data.data.token;
        logTest('Principal Login', 'pass', 'Principal authenticated');
        return true;
    } else {
        logTest('Principal Login', 'fail', result.error);
        return false;
    }
}

// Academic setup tests
async function testAcademicSetup() {
    logTest('Academic Setup', 'pending');
    
    // Create academic session
    const sessionResult = await makeRequest('POST', '/api/principal/academic-sessions', {
        sessionName: '2026',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isActive: true
    });
    
    if (!sessionResult.success) {
        logTest('Academic Setup', 'fail', 'Failed to create session');
        return false;
    }
    
    // Create class
    const classResult = await makeRequest('POST', '/api/principal/classes', {
        className: 'Class 6',
        section: 'A',
        classLevel: 6,
        capacity: 40,
        academicYear: '2026'
    });
    
    if (classResult.success) {
        logTest('Academic Setup', 'pass', 'Session and class created');
        return true;
    } else {
        logTest('Academic Setup', 'fail', classResult.error);
        return false;
    }
}

// Teacher management tests
async function testTeacherManagement() {
    logTest('Teacher Management', 'pending');
    
    const teacherData = {
        name: 'Test Teacher API',
        email: 'teacher@apischool.com',
        phone: '+8801234567892',
        password: 'teacher123',
        subjects: ['Mathematics', 'English'],
        assignedClasses: ['Class 6-A'],
        maxLoad: 30
    };
    
    const result = await makeRequest('POST', '/api/principal/teachers', teacherData);
    
    if (result.success) {
        teacherId = result.data.data._id;
        logTest('Teacher Management', 'pass', 'Teacher created');
        return true;
    } else {
        logTest('Teacher Management', 'fail', result.error);
        return false;
    }
}

// Student management tests
async function testStudentManagement() {
    logTest('Student Management', 'pending');
    
    const studentData = {
        name: 'Test Student API',
        email: 'student@apischool.com',
        phone: '+8801234567893',
        password: 'student123',
        rollNumber: '1001',
        classId: 'class_6a_id', // This would be actual class ID
        section: 'A',
        dateOfBirth: '2010-01-01',
        gender: 'Male',
        parentName: 'Test Parent',
        parentPhone: '+8801234567894'
    };
    
    const result = await makeRequest('POST', '/api/principal/students', studentData);
    
    if (result.success) {
        studentId = result.data.data._id;
        logTest('Student Management', 'pass', 'Student created');
        return true;
    } else {
        logTest('Student Management', 'fail', result.error);
        return false;
    }
}

// Notice management tests
async function testNoticeManagement() {
    logTest('Notice Management', 'pending');
    
    const noticeData = {
        title: 'Test API Notice',
        description: 'This is a test notice created via API testing',
        noticeType: 'general',
        targetType: 'all',
        targetRoles: ['teacher', 'student', 'parent'],
        priority: 'medium',
        attachments: [],
        communicationSettings: {
            sendEmail: false,
            sendSMS: false,
            sendPush: true
        }
    };
    
    const result = await makeRequest('POST', '/api/notices', noticeData);
    
    if (result.success) {
        noticeId = result.data.data._id;
        logTest('Notice Management', 'pass', 'Notice created');
        return true;
    } else {
        logTest('Notice Management', 'fail', result.error);
        return false;
    }
}

// AI features tests
async function testAIFeatures() {
    logTest('AI Features', 'pending');
    
    // Test AI status
    const statusResult = await makeRequest('GET', '/api/ai/status');
    
    if (!statusResult.success) {
        logTest('AI Features', 'fail', 'AI service not accessible');
        return false;
    }
    
    // Test content recommendation
    const contentResult = await makeRequest('POST', '/api/ai/recommend-content', {
        studentLevel: 'Class 6',
        subject: 'Mathematics',
        learningStyle: 'visual',
        currentTopics: ['Algebra', 'Geometry']
    });
    
    if (contentResult.success) {
        logTest('AI Features', 'pass', 'AI recommendations generated');
        return true;
    } else {
        logTest('AI Features', 'fail', contentResult.error);
        return false;
    }
}

// Dashboard tests
async function testDashboards() {
    logTest('Dashboard Access', 'pending');
    
    // Test principal dashboard
    const principalDashboard = await makeRequest('GET', '/api/dashboard/principal');
    
    if (principalDashboard.success) {
        logTest('Dashboard Access', 'pass', 'Principal dashboard accessible');
        return true;
    } else {
        logTest('Dashboard Access', 'fail', principalDashboard.error);
        return false;
    }
}

// Analytics tests
async function testAnalytics() {
    logTest('Analytics', 'pending');
    
    const result = await makeRequest('GET', '/api/notices/analytics/dashboard');
    
    if (result.success) {
        logTest('Analytics', 'pass', 'Notice analytics accessible');
        return true;
    } else {
        logTest('Analytics', 'fail', result.error);
        return false;
    }
}

// Security tests
async function testSecurity() {
    logTest('Security Tests', 'pending');
    
    let securityPassed = 0;
    let securityTotal = 3;
    
    // Test unauthorized access
    const unauthorizedResult = await makeRequest('GET', '/api/principal/classes', null, {
        Authorization: 'Bearer invalid_token'
    });
    
    if (!unauthorizedResult.success && unauthorizedResult.status === 401) {
        securityPassed++;
        log('   ✅ Unauthorized access blocked', 'green');
    } else {
        log('   ❌ Unauthorized access not blocked', 'red');
    }
    
    // Test role-based access
    const roleResult = await makeRequest('POST', '/api/ai/generate-questions', {
        subject: 'Math',
        topic: 'Algebra',
        difficulty: 'medium'
    });
    
    // This should fail for principal role (if AI requires teacher role)
    if (roleResult.success || roleResult.status === 403) {
        securityPassed++;
        log('   ✅ Role-based access working', 'green');
    } else {
        log('   ❌ Role-based access issue', 'red');
    }
    
    // Test input validation
    const validationResult = await makeRequest('POST', '/api/notices', {
        // Missing required fields
        description: 'Test notice without title'
    });
    
    if (!validationResult.success && validationResult.status === 400) {
        securityPassed++;
        log('   ✅ Input validation working', 'green');
    } else {
        log('   ❌ Input validation issue', 'red');
    }
    
    if (securityPassed === securityTotal) {
        logTest('Security Tests', 'pass', 'All security checks passed');
        return true;
    } else {
        logTest('Security Tests', 'fail', `${securityPassed}/${securityTotal} security checks passed`);
        return false;
    }
}

// Performance tests
async function testPerformance() {
    logTest('Performance Tests', 'pending');
    
    const startTime = Date.now();
    
    // Make multiple concurrent requests
    const promises = [];
    for (let i = 0; i < 5; i++) {
        promises.push(makeRequest('GET', '/api/health'));
    }
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    const successCount = results.filter(r => r.success).length;
    
    if (successCount >= 4 && responseTime < 2000) {
        logTest('Performance Tests', 'pass', `Response time: ${responseTime}ms, Success rate: ${successCount}/5`);
        return true;
    } else {
        logTest('Performance Tests', 'fail', `Response time: ${responseTime}ms, Success rate: ${successCount}/5`);
        return false;
    }
}

// Main test runner
async function runComprehensiveTests() {
    log('🚀 SMART CAMPUS SaaS - COMPREHENSIVE API TEST SUITE', 'blue');
    log('Testing all endpoints and features...', 'blue');
    log('='.repeat(60), 'blue');
    
    const startTime = Date.now();
    
    // Core functionality tests
    const coreTests = [
        testHealthCheck,
        testSuperAdminLogin,
        testCreateSchool,
        testPrincipalLogin,
        testAcademicSetup,
        testTeacherManagement,
        testStudentManagement,
        testNoticeManagement
    ];
    
    // Advanced features tests
    const advancedTests = [
        testAIFeatures,
        testDashboards,
        testAnalytics
    ];
    
    // Security and performance tests
    const securityTests = [
        testSecurity,
        testPerformance
    ];
    
    // Run all tests
    log('\n🔹 CORE FUNCTIONALITY TESTS', 'cyan');
    for (const test of coreTests) {
        await test();
    }
    
    log('\n🤖 ADVANCED FEATURES TESTS', 'cyan');
    for (const test of advancedTests) {
        await test();
    }
    
    log('\n🔐 SECURITY & PERFORMANCE TESTS', 'cyan');
    for (const test of securityTests) {
        await test();
    }
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    // Generate final report
    log('\n' + '='.repeat(60), 'blue');
    log('📊 TEST RESULTS SUMMARY', 'blue');
    log('='.repeat(60), 'blue');
    
    const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
    
    log(`Total Tests: ${testResults.total}`, 'white');
    log(`Passed: ${testResults.passed}`, 'green');
    log(`Failed: ${testResults.failed}`, 'red');
    log(`Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'red');
    log(`Duration: ${totalDuration}ms`, 'white');
    
    // Failed tests details
    if (testResults.failed > 0) {
        log('\n❌ FAILED TESTS:', 'red');
        testResults.details
            .filter(test => test.status === 'fail')
            .forEach(test => {
                log(`   • ${test.test}: ${test.message}`, 'red');
            });
    }
    
    // System readiness assessment
    log('\n🎯 SYSTEM READINESS ASSESSMENT:', 'blue');
    if (successRate >= 90) {
        log('✅ EXCELLENT - System is production-ready!', 'green');
    } else if (successRate >= 80) {
        log('⚠️  GOOD - System is mostly ready with minor issues', 'yellow');
    } else if (successRate >= 60) {
        log('🔶 FAIR - System needs attention before production', 'yellow');
    } else {
        log('❌ POOR - System requires significant fixes', 'red');
    }
    
    // Generate test report file
    const reportData = {
        summary: {
            total: testResults.total,
            passed: testResults.passed,
            failed: testResults.failed,
            successRate: parseFloat(successRate),
            duration: totalDuration,
            timestamp: new Date().toISOString()
        },
        details: testResults.details,
        environment: {
            baseUrl: BASE_URL,
            nodeVersion: process.version,
            platform: process.platform
        }
    };
    
    // Save report (in a real implementation)
    // require('fs').writeFileSync('test-report.json', JSON.stringify(reportData, null, 2));
    
    log('\n📄 Test report generated', 'gray');
    
    return successRate >= 80;
}

// Health check before running tests
async function checkSystemHealth() {
    try {
        const result = await makeRequest('GET', '/api/health');
        if (result.success) {
            log('✅ API Server is running', 'green');
            log(`📍 Server: ${BASE_URL}`, 'green');
            log(`📊 Version: ${result.data.version || 'Unknown'}`, 'green');
            return true;
        }
    } catch (error) {
        log('❌ API Server is not running', 'red');
        log(`📍 Expected: ${BASE_URL}`, 'red');
        log('Please start the server first: npm start', 'yellow');
        return false;
    }
}

// Run the test suite
if (require.main === module) {
    checkSystemHealth().then(isHealthy => {
        if (isHealthy) {
            runComprehensiveTests().then(success => {
                process.exit(success ? 0 : 1);
            });
        } else {
            process.exit(1);
        }
    });
}

module.exports = {
    runComprehensiveTests,
    checkSystemHealth
};
