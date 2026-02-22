/**
 * 🧪 PRODUCTION API TESTING SUITE
 * Tests all APIs for production readiness
 */

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

// Test results
let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
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

function recordTest(name, passed, details = '') {
    testResults.total++;
    if (passed) {
        testResults.passed++;
        log(`✅ ${name} - PASSED ${details}`);
    } else {
        testResults.failed++;
        log(`❌ ${name} - FAILED ${details}`);
    }
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
    
    const result = await makeRequest('GET', '/api/health');
    const passed = result.success && result.status === 200;
    recordTest('Health Check', passed, `(Status: ${result.status})`);
    
    return result.success;
}

async function testAuthentication() {
    log('🔐 Testing Authentication...');
    
    // Test login with different roles
    const testUsers = [
        { email: 'admin@smartcampus.com', password: 'admin123', role: 'Super Admin' },
        { email: 'principal@smartcampus.com', password: 'principal123', role: 'Principal' },
        { email: 'teacher@smartcampus.com', password: 'teacher123', role: 'Teacher' },
        { email: 'student@smartcampus.com', password: 'student123', role: 'Student' }
    ];
    
    let authSuccess = true;
    let tokens = {};
    
    for (const user of testUsers) {
        const result = await makeRequest('POST', '/api/auth/login', user);
        const passed = result.success && result.status === 200;
        recordTest(`${user.role} Login`, passed, `(Status: ${result.status})`);
        
        if (passed && result.data.token) {
            tokens[user.role.toLowerCase().replace(' ', '_')] = result.data.token;
        } else {
            authSuccess = false;
        }
    }
    
    return { success: authSuccess, tokens };
}

async function testUserManagement(tokens) {
    log('👥 Testing User Management...');
    
    if (!tokens.super_admin) {
        recordTest('User Management', false, '(No admin token)');
        return false;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${tokens.super_admin}`
    };
    
    const tests = [
        { name: 'Get All Users', endpoint: '/api/users' },
        { name: 'Get Students', endpoint: '/api/users?role=student' },
        { name: 'Get Teachers', endpoint: '/api/users?role=teacher' }
    ];
    
    let success = true;
    
    for (const test of tests) {
        const result = await makeRequest('GET', test.endpoint, null, authHeaders);
        const passed = result.success && result.status === 200;
        recordTest(test.name, passed, `(Status: ${result.status})`);
        
        if (!passed) success = false;
    }
    
    return success;
}

async function testStudentManagement(tokens) {
    log('🎓 Testing Student Management...');
    
    if (!tokens.super_admin) {
        recordTest('Student Management', false, '(No admin token)');
        return false;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${tokens.super_admin}`
    };
    
    const tests = [
        { name: 'Get All Students', endpoint: '/api/students' },
        { name: 'Search Students', endpoint: '/api/students?search=test' },
        { name: 'Get Students by Class', endpoint: '/api/students?class=10' }
    ];
    
    let success = true;
    
    for (const test of tests) {
        const result = await makeRequest('GET', test.endpoint, null, authHeaders);
        const passed = result.success && result.status === 200;
        recordTest(test.name, passed, `(Status: ${result.status})`);
        
        if (!passed) success = false;
    }
    
    return success;
}

async function testTeacherManagement(tokens) {
    log('👨‍🏫 Testing Teacher Management...');
    
    if (!tokens.super_admin) {
        recordTest('Teacher Management', false, '(No admin token)');
        return false;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${tokens.super_admin}`
    };
    
    const tests = [
        { name: 'Get All Teachers', endpoint: '/api/teachers' },
        { name: 'Search Teachers', endpoint: '/api/teachers?search=test' },
        { name: 'Get Teachers by Subject', endpoint: '/api/teachers?subject=Mathematics' }
    ];
    
    let success = true;
    
    for (const test of tests) {
        const result = await makeRequest('GET', test.endpoint, null, authHeaders);
        const passed = result.success && result.status === 200;
        recordTest(test.name, passed, `(Status: ${result.status})`);
        
        if (!passed) success = false;
    }
    
    return success;
}

async function testSchoolManagement(tokens) {
    log('🏫 Testing School Management...');
    
    if (!tokens.super_admin) {
        recordTest('School Management', false, '(No admin token)');
        return false;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${tokens.super_admin}`
    };
    
    const tests = [
        { name: 'Get All Schools', endpoint: '/api/school' },
        { name: 'Get School Stats', endpoint: '/api/school/stats' }
    ];
    
    let success = true;
    
    for (const test of tests) {
        const result = await makeRequest('GET', test.endpoint, null, authHeaders);
        const passed = result.success && result.status === 200;
        recordTest(test.name, passed, `(Status: ${result.status})`);
        
        if (!passed) success = false;
    }
    
    return success;
}

async function testAttendance(tokens) {
    log('📋 Testing Attendance...');
    
    if (!tokens.teacher) {
        recordTest('Attendance', false, '(No teacher token)');
        return false;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${tokens.teacher}`
    };
    
    const tests = [
        { name: 'Get Attendance by Date', endpoint: '/api/attendance?date=2026-02-22' },
        { name: 'Get Attendance by Class', endpoint: '/api/attendance?class=10&section=A' },
        { name: 'Get Attendance Report', endpoint: '/api/attendance/report?class=10&section=A' }
    ];
    
    let success = true;
    
    for (const test of tests) {
        const result = await makeRequest('GET', test.endpoint, null, authHeaders);
        const passed = result.success && result.status === 200;
        recordTest(test.name, passed, `(Status: ${result.status})`);
        
        if (!passed) success = false;
    }
    
    return success;
}

async function testResults(tokens) {
    log('📊 Testing Results...');
    
    if (!tokens.teacher) {
        recordTest('Results', false, '(No teacher token)');
        return false;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${tokens.teacher}`
    };
    
    const tests = [
        { name: 'Get Results by Class', endpoint: '/api/results?class=10&section=A' },
        { name: 'Get Results by Exam', endpoint: '/api/results?exam=Final' },
        { name: 'Get Results by Subject', endpoint: '/api/results?subject=Mathematics' }
    ];
    
    let success = true;
    
    for (const test of tests) {
        const result = await makeRequest('GET', test.endpoint, null, authHeaders);
        const passed = result.success && result.status === 200;
        recordTest(test.name, passed, `(Status: ${result.status})`);
        
        if (!passed) success = false;
    }
    
    return success;
}

async function testNotices(tokens) {
    log('📢 Testing Notices...');
    
    if (!tokens.principal) {
        recordTest('Notices', false, '(No principal token)');
        return false;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${tokens.principal}`
    };
    
    const tests = [
        { name: 'Get All Notices', endpoint: '/api/notices' },
        { name: 'Get Active Notices', endpoint: '/api/notices?active=true' },
        { name: 'Get Notices by Type', endpoint: '/api/notices?type=general' }
    ];
    
    let success = true;
    
    for (const test of tests) {
        const result = await makeRequest('GET', test.endpoint, null, authHeaders);
        const passed = result.success && result.status === 200;
        recordTest(test.name, passed, `(Status: ${result.status})`);
        
        if (!passed) success = false;
    }
    
    return success;
}

async function testAnalytics(tokens) {
    log('📈 Testing Analytics...');
    
    if (!tokens.super_admin) {
        recordTest('Analytics', false, '(No admin token)');
        return false;
    }
    
    const authHeaders = {
        'Authorization': `Bearer ${tokens.super_admin}`
    };
    
    const tests = [
        { name: 'Dashboard Analytics', endpoint: '/api/analytics/dashboard' },
        { name: 'Student Analytics', endpoint: '/api/analytics/students' },
        { name: 'Teacher Analytics', endpoint: '/api/analytics/teachers' },
        { name: 'Attendance Analytics', endpoint: '/api/analytics/attendance' },
        { name: 'Financial Analytics', endpoint: '/api/analytics/financial' }
    ];
    
    let success = true;
    
    for (const test of tests) {
        const result = await makeRequest('GET', test.endpoint, null, authHeaders);
        const passed = result.success && result.status === 200;
        recordTest(test.name, passed, `(Status: ${result.status})`);
        
        if (!passed) success = false;
    }
    
    return success;
}

async function testErrorHandling() {
    log('🚨 Testing Error Handling...');
    
    const tests = [
        { name: 'Invalid Endpoint', endpoint: '/api/invalid-endpoint', expectedStatus: 404 },
        { name: 'Invalid Login', endpoint: '/api/auth/login', data: { email: 'invalid@test.com', password: 'wrong' }, expectedStatus: 401 },
        { name: 'Unauthorized Access', endpoint: '/api/users', expectedStatus: 401 }
    ];
    
    let success = true;
    
    for (const test of tests) {
        const result = await makeRequest('POST', test.endpoint, test.data);
        const passed = result.status === test.expectedStatus;
        recordTest(test.name, passed, `(Expected: ${test.expectedStatus}, Got: ${result.status})`);
        
        if (!passed) success = false;
    }
    
    return success;
}

async function testPerformance() {
    log('⚡ Testing Performance...');
    
    const tests = [
        { name: 'Health Check Performance', endpoint: '/api/health' },
        { name: 'Login Performance', endpoint: '/api/auth/login', data: { email: 'student@smartcampus.com', password: 'student123' } }
    ];
    
    let success = true;
    
    for (const test of tests) {
        const startTime = Date.now();
        const result = await makeRequest('POST', test.endpoint, test.data);
        const responseTime = Date.now() - startTime;
        
        const passed = result.success && responseTime < 3000; // Less than 3 seconds
        recordTest(test.name, passed, `(${responseTime}ms)`);
        
        if (!passed) success = false;
    }
    
    return success;
}

async function generateFinalReport() {
    const successRate = testResults.total > 0 ? (testResults.passed / testResults.total * 100).toFixed(2) : 0;
    
    console.log('\n' + '='.repeat(80));
    console.log('🧪 PRODUCTION API TEST REPORT');
    console.log('='.repeat(80));
    console.log(`📊 Total Tests: ${testResults.total}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Success Rate: ${successRate}%`);
    console.log('='.repeat(80));
    
    // Production readiness assessment
    const isProductionReady = parseFloat(successRate) >= 90 && testResults.failed === 0;
    
    console.log('\n🚀 PRODUCTION READINESS ASSESSMENT');
    console.log('='.repeat(80));
    
    if (isProductionReady) {
        console.log('✅ BACKEND IS PRODUCTION READY!');
        console.log('🎉 All critical APIs are working correctly');
        console.log('🔒 Authentication and authorization are working');
        console.log('⚡ API performance is acceptable');
        console.log('🛡️ Error handling is proper');
        console.log('📊 All endpoints are responding correctly');
    } else {
        console.log('❌ BACKEND IS NOT PRODUCTION READY');
        console.log('🔧 Issues found that need to be fixed:');
        console.log(`   - Success rate: ${successRate}% (need 90%+)`);
        console.log(`   - Failed tests: ${testResults.failed}`);
        console.log('   - Check the failed tests above for details');
    }
    
    console.log('='.repeat(80));
    
    return isProductionReady;
}

// Main test runner
async function runProductionTests() {
    console.log('🧪 STARTING PRODUCTION API TESTING');
    console.log(`🌐 Testing API: ${API_BASE_URL}`);
    console.log('='.repeat(80));
    
    try {
        // Test basic connectivity
        log('🔍 Testing basic connectivity...');
        const healthResult = await makeRequest('GET', '/api/health');
        if (!healthResult.success) {
            log('❌ Cannot connect to API server. Please ensure the server is running.');
            process.exit(1);
        }
        log('✅ API server is reachable');
        
        // Run all tests
        const healthOk = await testHealthCheck();
        const authResult = await testAuthentication();
        
        if (!authResult.success) {
            log('❌ Authentication tests failed. Cannot proceed with other tests.');
            return await generateFinalReport();
        }
        
        await testUserManagement(authResult.tokens);
        await testStudentManagement(authResult.tokens);
        await testTeacherManagement(authResult.tokens);
        await testSchoolManagement(authResult.tokens);
        await testAttendance(authResult.tokens);
        await testResults(authResult.tokens);
        await testNotices(authResult.tokens);
        await testAnalytics(authResult.tokens);
        await testErrorHandling();
        await testPerformance();
        
        // Generate final report
        const isProductionReady = await generateFinalReport();
        
        // Exit with appropriate code
        process.exit(isProductionReady ? 0 : 1);
        
    } catch (error) {
        log(`💥 Test suite failed: ${error.message}`, 'error');
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runProductionTests();
}

module.exports = { runProductionTests };
