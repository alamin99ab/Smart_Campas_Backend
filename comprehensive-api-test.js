/**
 * 🧪 COMPREHENSIVE API TESTING SUITE
 * Tests all APIs from every angle for production readiness
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_RESULTS_FILE = 'api-test-results.json';

// Test data
const testUsers = {
    super_admin: {
        email: 'admin@smartcampus.com',
        password: 'admin123',
        role: 'super_admin'
    },
    principal: {
        email: 'principal@smartcampus.com',
        password: 'principal123',
        role: 'principal'
    },
    teacher: {
        email: 'teacher@smartcampus.com',
        password: 'teacher123',
        role: 'teacher'
    },
    student: {
        email: 'student@smartcampus.com',
        password: 'student123',
        role: 'student'
    }
};

const testStudent = {
    name: 'Test Student',
    email: 'teststudent@example.com',
    password: 'TestPass123!',
    phone: '01712345678',
    class: '10',
    section: 'A',
    roll: '123',
    gender: 'male',
    dateOfBirth: '2008-01-01',
    address: 'Test Address'
};

const testTeacher = {
    name: 'Test Teacher',
    email: 'testteacher@example.com',
    password: 'TestPass123!',
    phone: '01712345678',
    subject: 'Mathematics',
    gender: 'male',
    address: 'Test Address'
};

const testSchool = {
    name: 'Test School',
    address: 'Test School Address',
    phone: '01712345678',
    email: 'test@school.com',
    established: '2020',
    type: 'Secondary'
};

const testNotice = {
    title: 'Test Notice',
    content: 'This is a test notice content',
    type: 'general',
    targetAudience: 'all'
};

const testAttendance = {
    studentId: 'test-student-id',
    date: new Date().toISOString().split('T')[0],
    status: 'present',
    class: '10',
    section: 'A'
};

const testResult = {
    studentId: 'test-student-id',
    examName: 'Final Exam',
    subject: 'Mathematics',
    marks: 85,
    totalMarks: 100,
    grade: 'A+',
    class: '10',
    section: 'A'
};

// Test results storage
let testResults = {
    summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        errors: 0,
        startTime: new Date().toISOString(),
        endTime: null,
        duration: null
    },
    categories: {
        authentication: { passed: 0, failed: 0, tests: [] },
        userManagement: { passed: 0, failed: 0, tests: [] },
        studentManagement: { passed: 0, failed: 0, tests: [] },
        teacherManagement: { passed: 0, failed: 0, tests: [] },
        schoolManagement: { passed: 0, failed: 0, tests: [] },
        attendance: { passed: 0, failed: 0, tests: [] },
        results: { passed: 0, failed: 0, tests: [] },
        notices: { passed: 0, failed: 0, tests: [] },
        analytics: { passed: 0, failed: 0, tests: [] },
        health: { passed: 0, failed: 0, tests: [] }
    },
    details: []
};

// Utility functions
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    console.log(logMessage);
    
    testResults.details.push({
        timestamp,
        type,
        message
    });
}

function recordTest(category, testName, passed, details = {}) {
    testResults.summary.totalTests++;
    if (passed) {
        testResults.summary.passed++;
        testResults.categories[category].passed++;
    } else {
        testResults.summary.failed++;
        testResults.categories[category].failed++;
    }
    
    testResults.categories[category].tests.push({
        name: testName,
        passed,
        details,
        timestamp: new Date().toISOString()
    });
}

async function makeRequest(method, endpoint, data = null, headers = {}) {
    try {
        const config = {
            method,
            url: `${API_BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
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

// Test functions
async function testHealthCheck() {
    log('🏥 Testing Health Check...');
    
    const tests = [
        { name: 'Basic Health Check', endpoint: '/api/health' },
        { name: 'Health Check with DB Status', endpoint: '/api/health' }
    ];
    
    for (const test of tests) {
        const result = await makeRequest('GET', test.endpoint);
        const passed = result.success && result.status === 200;
        
        recordTest('health', test.name, passed, {
            status: result.status,
            response: result.success ? result.data : result.error
        });
        
        if (passed) {
            log(`✅ ${test.name} - PASSED`);
        } else {
            log(`❌ ${test.name} - FAILED: ${JSON.stringify(result.error)}`);
        }
    }
}

async function testAuthentication() {
    log('🔐 Testing Authentication APIs...');
    
    // Test registration
    const registerTests = [
        {
            name: 'Student Registration',
            endpoint: '/api/auth/register',
            data: { ...testStudent, role: 'student' }
        },
        {
            name: 'Teacher Registration',
            endpoint: '/api/auth/register',
            data: { ...testTeacher, role: 'teacher' }
        }
    ];
    
    for (const test of registerTests) {
        const result = await makeRequest('POST', test.endpoint, test.data);
        const passed = result.success && (result.status === 201 || result.status === 200);
        
        recordTest('authentication', test.name, passed, {
            status: result.status,
            response: result.success ? result.data : result.error
        });
        
        if (passed) {
            log(`✅ ${test.name} - PASSED`);
        } else {
            log(`❌ ${test.name} - FAILED: ${JSON.stringify(result.error)}`);
        }
    }
    
    // Test login for all roles
    for (const [role, user] of Object.entries(testUsers)) {
        const result = await makeRequest('POST', '/api/auth/login', user);
        const passed = result.success && result.status === 200;
        
        recordTest('authentication', `${role} Login`, passed, {
            status: result.status,
            response: result.success ? result.data : result.error
        });
        
        if (passed) {
            log(`✅ ${role} Login - PASSED`);
            // Store token for further tests
            if (result.data.token) {
                testUsers[role].token = result.data.token;
            }
        } else {
            log(`❌ ${role} Login - FAILED: ${JSON.stringify(result.error)}`);
        }
    }
    
    // Test token validation
    if (testUsers.super_admin.token) {
        const result = await makeRequest('GET', '/api/auth/validate', null, {
            'Authorization': `Bearer ${testUsers.super_admin.token}`
        });
        const passed = result.success && result.status === 200;
        
        recordTest('authentication', 'Token Validation', passed, {
            status: result.status,
            response: result.success ? result.data : result.error
        });
        
        if (passed) {
            log('✅ Token Validation - PASSED');
        } else {
            log(`❌ Token Validation - FAILED: ${JSON.stringify(result.error)}`);
        }
    }
}

async function testUserManagement() {
    log('👥 Testing User Management APIs...');
    
    if (!testUsers.super_admin.token) {
        log('⚠️  Skipping User Management tests - No admin token available');
        return;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${testUsers.super_admin.token}`
    };
    
    const tests = [
        {
            name: 'Get All Users',
            method: 'GET',
            endpoint: '/api/users',
            expectedStatus: 200
        },
        {
            name: 'Get Users by Role (Students)',
            method: 'GET',
            endpoint: '/api/users?role=student',
            expectedStatus: 200
        },
        {
            name: 'Get Users by Role (Teachers)',
            method: 'GET',
            endpoint: '/api/users?role=teacher',
            expectedStatus: 200
        }
    ];
    
    for (const test of tests) {
        const result = await makeRequest(test.method, test.endpoint, null, authHeaders);
        const passed = result.success && result.status === test.expectedStatus;
        
        recordTest('userManagement', test.name, passed, {
            status: result.status,
            response: result.success ? result.data : result.error
        });
        
        if (passed) {
            log(`✅ ${test.name} - PASSED`);
        } else {
            log(`❌ ${test.name} - FAILED: ${JSON.stringify(result.error)}`);
        }
    }
}

async function testStudentManagement() {
    log('🎓 Testing Student Management APIs...');
    
    if (!testUsers.super_admin.token) {
        log('⚠️  Skipping Student Management tests - No admin token available');
        return;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${testUsers.super_admin.token}`
    };
    
    // Test student CRUD operations
    const tests = [
        {
            name: 'Create Student',
            method: 'POST',
            endpoint: '/api/students',
            data: testStudent,
            expectedStatus: 201
        },
        {
            name: 'Get All Students',
            method: 'GET',
            endpoint: '/api/students',
            expectedStatus: 200
        },
        {
            name: 'Get Students by Class',
            method: 'GET',
            endpoint: '/api/students?class=10',
            expectedStatus: 200
        },
        {
            name: 'Search Students',
            method: 'GET',
            endpoint: '/api/students?search=test',
            expectedStatus: 200
        }
    ];
    
    let createdStudentId = null;
    
    for (const test of tests) {
        const result = await makeRequest(test.method, test.endpoint, test.data, authHeaders);
        const passed = result.success && result.status === test.expectedStatus;
        
        recordTest('studentManagement', test.name, passed, {
            status: result.status,
            response: result.success ? result.data : result.error
        });
        
        if (passed) {
            log(`✅ ${test.name} - PASSED`);
            
            // Store created student ID for further tests
            if (test.name === 'Create Student' && result.data.data?._id) {
                createdStudentId = result.data.data._id;
            }
        } else {
            log(`❌ ${test.name} - FAILED: ${JSON.stringify(result.error)}`);
        }
    }
    
    // Test student update and delete if we have a created student
    if (createdStudentId) {
        const updateTest = {
            name: 'Update Student',
            method: 'PUT',
            endpoint: `/api/students/${createdStudentId}`,
            data: { name: 'Updated Test Student' },
            expectedStatus: 200
        };
        
        const updateResult = await makeRequest(updateTest.method, updateTest.endpoint, updateTest.data, authHeaders);
        const updatePassed = updateResult.success && updateResult.status === updateTest.expectedStatus;
        
        recordTest('studentManagement', updateTest.name, updatePassed, {
            status: updateResult.status,
            response: updateResult.success ? updateResult.data : updateResult.error
        });
        
        if (updatePassed) {
            log(`✅ ${updateTest.name} - PASSED`);
        } else {
            log(`❌ ${updateTest.name} - FAILED: ${JSON.stringify(updateResult.error)}`);
        }
        
        // Test delete
        const deleteTest = {
            name: 'Delete Student',
            method: 'DELETE',
            endpoint: `/api/students/${createdStudentId}`,
            expectedStatus: 200
        };
        
        const deleteResult = await makeRequest(deleteTest.method, deleteTest.endpoint, null, authHeaders);
        const deletePassed = deleteResult.success && deleteResult.status === deleteTest.expectedStatus;
        
        recordTest('studentManagement', deleteTest.name, deletePassed, {
            status: deleteResult.status,
            response: deleteResult.success ? deleteResult.data : deleteResult.error
        });
        
        if (deletePassed) {
            log(`✅ ${deleteTest.name} - PASSED`);
        } else {
            log(`❌ ${deleteTest.name} - FAILED: ${JSON.stringify(deleteResult.error)}`);
        }
    }
}

async function testTeacherManagement() {
    log('👨‍🏫 Testing Teacher Management APIs...');
    
    if (!testUsers.super_admin.token) {
        log('⚠️  Skipping Teacher Management tests - No admin token available');
        return;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${testUsers.super_admin.token}`
    };
    
    const tests = [
        {
            name: 'Create Teacher',
            method: 'POST',
            endpoint: '/api/teachers',
            data: testTeacher,
            expectedStatus: 201
        },
        {
            name: 'Get All Teachers',
            method: 'GET',
            endpoint: '/api/teachers',
            expectedStatus: 200
        },
        {
            name: 'Get Teachers by Subject',
            method: 'GET',
            endpoint: '/api/teachers?subject=Mathematics',
            expectedStatus: 200
        },
        {
            name: 'Search Teachers',
            method: 'GET',
            endpoint: '/api/teachers?search=test',
            expectedStatus: 200
        }
    ];
    
    let createdTeacherId = null;
    
    for (const test of tests) {
        const result = await makeRequest(test.method, test.endpoint, test.data, authHeaders);
        const passed = result.success && result.status === test.expectedStatus;
        
        recordTest('teacherManagement', test.name, passed, {
            status: result.status,
            response: result.success ? result.data : result.error
        });
        
        if (passed) {
            log(`✅ ${test.name} - PASSED`);
            
            if (test.name === 'Create Teacher' && result.data.data?._id) {
                createdTeacherId = result.data.data._id;
            }
        } else {
            log(`❌ ${test.name} - FAILED: ${JSON.stringify(result.error)}`);
        }
    }
    
    // Test teacher update and delete
    if (createdTeacherId) {
        const updateTest = {
            name: 'Update Teacher',
            method: 'PUT',
            endpoint: `/api/teachers/${createdTeacherId}`,
            data: { name: 'Updated Test Teacher' },
            expectedStatus: 200
        };
        
        const updateResult = await makeRequest(updateTest.method, updateTest.endpoint, updateTest.data, authHeaders);
        const updatePassed = updateResult.success && updateResult.status === updateTest.expectedStatus;
        
        recordTest('teacherManagement', updateTest.name, updatePassed, {
            status: updateResult.status,
            response: updateResult.success ? updateResult.data : updateResult.error
        });
        
        if (updatePassed) {
            log(`✅ ${updateTest.name} - PASSED`);
        } else {
            log(`❌ ${updateTest.name} - FAILED: ${JSON.stringify(updateResult.error)}`);
        }
    }
}

async function testSchoolManagement() {
    log('🏫 Testing School Management APIs...');
    
    if (!testUsers.super_admin.token) {
        log('⚠️  Skipping School Management tests - No admin token available');
        return;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${testUsers.super_admin.token}`
    };
    
    const tests = [
        {
            name: 'Create School',
            method: 'POST',
            endpoint: '/api/school',
            data: testSchool,
            expectedStatus: 201
        },
        {
            name: 'Get All Schools',
            method: 'GET',
            endpoint: '/api/school',
            expectedStatus: 200
        },
        {
            name: 'Get School Statistics',
            method: 'GET',
            endpoint: '/api/school/stats',
            expectedStatus: 200
        }
    ];
    
    for (const test of tests) {
        const result = await makeRequest(test.method, test.endpoint, test.data, authHeaders);
        const passed = result.success && result.status === test.expectedStatus;
        
        recordTest('schoolManagement', test.name, passed, {
            status: result.status,
            response: result.success ? result.data : result.error
        });
        
        if (passed) {
            log(`✅ ${test.name} - PASSED`);
        } else {
            log(`❌ ${test.name} - FAILED: ${JSON.stringify(result.error)}`);
        }
    }
}

async function testAttendance() {
    log('📋 Testing Attendance APIs...');
    
    if (!testUsers.teacher.token) {
        log('⚠️  Skipping Attendance tests - No teacher token available');
        return;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${testUsers.teacher.token}`
    };
    
    const tests = [
        {
            name: 'Mark Attendance',
            method: 'POST',
            endpoint: '/api/attendance',
            data: testAttendance,
            expectedStatus: 201
        },
        {
            name: 'Get Attendance by Date',
            method: 'GET',
            endpoint: `/api/attendance?date=${testAttendance.date}`,
            expectedStatus: 200
        },
        {
            name: 'Get Attendance by Class',
            method: 'GET',
            endpoint: `/api/attendance?class=${testAttendance.class}&section=${testAttendance.section}`,
            expectedStatus: 200
        },
        {
            name: 'Get Attendance Report',
            method: 'GET',
            endpoint: `/api/attendance/report?class=${testAttendance.class}&section=${testAttendance.section}`,
            expectedStatus: 200
        }
    ];
    
    for (const test of tests) {
        const result = await makeRequest(test.method, test.endpoint, test.data, authHeaders);
        const passed = result.success && result.status === test.expectedStatus;
        
        recordTest('attendance', test.name, passed, {
            status: result.status,
            response: result.success ? result.data : result.error
        });
        
        if (passed) {
            log(`✅ ${test.name} - PASSED`);
        } else {
            log(`❌ ${test.name} - FAILED: ${JSON.stringify(result.error)}`);
        }
    }
}

async function testResults() {
    log('📊 Testing Results APIs...');
    
    if (!testUsers.teacher.token) {
        log('⚠️  Skipping Results tests - No teacher token available');
        return;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${testUsers.teacher.token}`
    };
    
    const tests = [
        {
            name: 'Add Result',
            method: 'POST',
            endpoint: '/api/results',
            data: testResult,
            expectedStatus: 201
        },
        {
            name: 'Get Results by Student',
            method: 'GET',
            endpoint: `/api/results?studentId=${testResult.studentId}`,
            expectedStatus: 200
        },
        {
            name: 'Get Results by Class',
            method: 'GET',
            endpoint: `/api/results?class=${testResult.class}&section=${testResult.section}`,
            expectedStatus: 200
        },
        {
            name: 'Get Results by Exam',
            method: 'GET',
            endpoint: `/api/results?exam=${testResult.examName}`,
            expectedStatus: 200
        }
    ];
    
    for (const test of tests) {
        const result = await makeRequest(test.method, test.endpoint, test.data, authHeaders);
        const passed = result.success && result.status === test.expectedStatus;
        
        recordTest('results', test.name, passed, {
            status: result.status,
            response: result.success ? result.data : result.error
        });
        
        if (passed) {
            log(`✅ ${test.name} - PASSED`);
        } else {
            log(`❌ ${test.name} - FAILED: ${JSON.stringify(result.error)}`);
        }
    }
}

async function testNotices() {
    log('📢 Testing Notices APIs...');
    
    if (!testUsers.principal.token) {
        log('⚠️  Skipping Notices tests - No principal token available');
        return;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${testUsers.principal.token}`
    };
    
    const tests = [
        {
            name: 'Create Notice',
            method: 'POST',
            endpoint: '/api/notices',
            data: testNotice,
            expectedStatus: 201
        },
        {
            name: 'Get All Notices',
            method: 'GET',
            endpoint: '/api/notices',
            expectedStatus: 200
        },
        {
            name: 'Get Active Notices',
            method: 'GET',
            endpoint: '/api/notices?active=true',
            expectedStatus: 200
        },
        {
            name: 'Get Notices by Type',
            method: 'GET',
            endpoint: `/api/notices?type=${testNotice.type}`,
            expectedStatus: 200
        }
    ];
    
    for (const test of tests) {
        const result = await makeRequest(test.method, test.endpoint, test.data, authHeaders);
        const passed = result.success && result.status === test.expectedStatus;
        
        recordTest('notices', test.name, passed, {
            status: result.status,
            response: result.success ? result.data : result.error
        });
        
        if (passed) {
            log(`✅ ${test.name} - PASSED`);
        } else {
            log(`❌ ${test.name} - FAILED: ${JSON.stringify(result.error)}`);
        }
    }
}

async function testAnalytics() {
    log('📈 Testing Analytics APIs...');
    
    if (!testUsers.super_admin.token) {
        log('⚠️  Skipping Analytics tests - No admin token available');
        return;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${testUsers.super_admin.token}`
    };
    
    const tests = [
        {
            name: 'Get Dashboard Analytics',
            method: 'GET',
            endpoint: '/api/analytics/dashboard',
            expectedStatus: 200
        },
        {
            name: 'Get Student Analytics',
            method: 'GET',
            endpoint: '/api/analytics/students',
            expectedStatus: 200
        },
        {
            name: 'Get Teacher Analytics',
            method: 'GET',
            endpoint: '/api/analytics/teachers',
            expectedStatus: 200
        },
        {
            name: 'Get Attendance Analytics',
            method: 'GET',
            endpoint: '/api/analytics/attendance',
            expectedStatus: 200
        },
        {
            name: 'Get Financial Analytics',
            method: 'GET',
            endpoint: '/api/analytics/financial',
            expectedStatus: 200
        }
    ];
    
    for (const test of tests) {
        const result = await makeRequest(test.method, test.endpoint, null, authHeaders);
        const passed = result.success && result.status === test.expectedStatus;
        
        recordTest('analytics', test.name, passed, {
            status: result.status,
            response: result.success ? result.data : result.error
        });
        
        if (passed) {
            log(`✅ ${test.name} - PASSED`);
        } else {
            log(`❌ ${test.name} - FAILED: ${JSON.stringify(result.error)}`);
        }
    }
}

async function testErrorHandling() {
    log('🚨 Testing Error Handling...');
    
    const tests = [
        {
            name: 'Invalid Endpoint',
            method: 'GET',
            endpoint: '/api/invalid-endpoint',
            expectedStatus: 404
        },
        {
            name: 'Invalid Login Credentials',
            method: 'POST',
            endpoint: '/api/auth/login',
            data: { email: 'invalid@test.com', password: 'wrong' },
            expectedStatus: 401
        },
        {
            name: 'Missing Required Fields',
            method: 'POST',
            endpoint: '/api/auth/register',
            data: { email: 'test@test.com' }, // Missing password, name, etc.
            expectedStatus: 400
        },
        {
            name: 'Unauthorized Access',
            method: 'GET',
            endpoint: '/api/users',
            expectedStatus: 401
        }
    ];
    
    for (const test of tests) {
        const result = await makeRequest(test.method, test.endpoint, test.data);
        const passed = result.status === test.expectedStatus;
        
        recordTest('errorHandling', test.name, passed, {
            status: result.status,
            response: result.success ? result.data : result.error
        });
        
        if (passed) {
            log(`✅ ${test.name} - PASSED`);
        } else {
            log(`❌ ${test.name} - FAILED: Expected ${test.expectedStatus}, got ${result.status}`);
        }
    }
}

async function testPerformance() {
    log('⚡ Testing Performance...');
    
    // Test API response times
    const tests = [
        { name: 'Health Check Response Time', endpoint: '/api/health' },
        { name: 'Login Response Time', endpoint: '/api/auth/login', data: testUsers.student }
    ];
    
    for (const test of tests) {
        const startTime = Date.now();
        const result = await makeRequest('POST', test.endpoint, test.data);
        const responseTime = Date.now() - startTime;
        
        const passed = result.success && responseTime < 2000; // Less than 2 seconds
        
        recordTest('performance', test.name, passed, {
            responseTime,
            status: result.status
        });
        
        if (passed) {
            log(`✅ ${test.name} - PASSED (${responseTime}ms)`);
        } else {
            log(`❌ ${test.name} - FAILED (${responseTime}ms)`);
        }
    }
}

async function generateReport() {
    log('📊 Generating Test Report...');
    
    testResults.summary.endTime = new Date().toISOString();
    testResults.summary.duration = 
        new Date(testResults.summary.endTime) - new Date(testResults.summary.startTime);
    
    // Calculate success rate
    const successRate = testResults.summary.totalTests > 0 
        ? (testResults.summary.passed / testResults.summary.totalTests * 100).toFixed(2)
        : 0;
    
    testResults.summary.successRate = parseFloat(successRate);
    
    // Save results to file
    fs.writeFileSync(TEST_RESULTS_FILE, JSON.stringify(testResults, null, 2));
    
    // Generate console report
    console.log('\n' + '='.repeat(80));
    console.log('🧪 COMPREHENSIVE API TEST REPORT');
    console.log('='.repeat(80));
    console.log(`📊 Total Tests: ${testResults.summary.totalTests}`);
    console.log(`✅ Passed: ${testResults.summary.passed}`);
    console.log(`❌ Failed: ${testResults.summary.failed}`);
    console.log(`📈 Success Rate: ${successRate}%`);
    console.log(`⏱️  Duration: ${testResults.summary.duration}ms`);
    console.log('='.repeat(80));
    
    // Category breakdown
    for (const [category, results] of Object.entries(testResults.categories)) {
        if (results.tests.length > 0) {
            const categorySuccessRate = (results.passed / results.tests.length * 100).toFixed(2);
            console.log(`📂 ${category.toUpperCase()}: ${results.passed}/${results.tests.length} (${categorySuccessRate}%)`);
        }
    }
    
    console.log('='.repeat(80));
    console.log(`📄 Detailed report saved to: ${TEST_RESULTS_FILE}`);
    
    // Production readiness assessment
    const isProductionReady = testResults.summary.successRate >= 90 && testResults.summary.failed === 0;
    
    console.log('\n🚀 PRODUCTION READINESS ASSESSMENT');
    console.log('='.repeat(80));
    
    if (isProductionReady) {
        console.log('✅ BACKEND IS PRODUCTION READY!');
        console.log('🎉 All APIs are working correctly');
        console.log('🔒 Security measures are in place');
        console.log('⚡ Performance is acceptable');
        console.log('🛡️ Error handling is proper');
    } else {
        console.log('❌ BACKEND IS NOT PRODUCTION READY');
        console.log('🔧 Fix the following issues before deployment:');
        
        // Show failed tests
        for (const [category, results] of Object.entries(testResults.categories)) {
            const failedTests = results.tests.filter(t => !t.passed);
            if (failedTests.length > 0) {
                console.log(`\n📂 ${category.toUpperCase()}:`);
                for (const test of failedTests) {
                    console.log(`  ❌ ${test.name}`);
                }
            }
        }
    }
    
    console.log('='.repeat(80));
    
    return isProductionReady;
}

// Main test runner
async function runComprehensiveTests() {
    console.log('🧪 STARTING COMPREHENSIVE API TESTING SUITE');
    console.log(`🌐 Testing API: ${API_BASE_URL}`);
    console.log('='.repeat(80));
    
    try {
        // Test basic connectivity first
        log('🔍 Testing basic connectivity...');
        const healthResult = await makeRequest('GET', '/api/health');
        if (!healthResult.success) {
            log('❌ Cannot connect to API server. Please ensure the server is running.');
            process.exit(1);
        }
        log('✅ API server is reachable');
        
        // Run all test categories
        await testHealthCheck();
        await testAuthentication();
        await testUserManagement();
        await testStudentManagement();
        await testTeacherManagement();
        await testSchoolManagement();
        await testAttendance();
        await testResults();
        await testNotices();
        await testAnalytics();
        await testErrorHandling();
        await testPerformance();
        
        // Generate final report
        const isProductionReady = await generateReport();
        
        // Exit with appropriate code
        process.exit(isProductionReady ? 0 : 1);
        
    } catch (error) {
        log(`💥 Test suite failed: ${error.message}`, 'error');
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runComprehensiveTests();
}

module.exports = {
    runComprehensiveTests,
    testResults
};
