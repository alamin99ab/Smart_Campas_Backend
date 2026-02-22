/**
 * 🧪 SIMPLE PRODUCTION API TEST
 * Tests all APIs for production readiness
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

function recordTest(name, passed, details = '') {
    totalTests++;
    if (passed) {
        passedTests++;
        log(`✅ ${name} - PASSED ${details}`);
    } else {
        failedTests++;
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

async function testAPIs() {
    log('🧪 STARTING PRODUCTION API TESTS');
    log(`🌐 Testing API: ${API_BASE_URL}`);
    log('='.repeat(60));
    
    // Test 1: Health Check
    log('🏥 Testing Health Check...');
    const healthResult = await makeRequest('GET', '/api/health');
    recordTest('Health Check', healthResult.success && healthResult.status === 200, 
               `(Status: ${healthResult.status})`);
    
    if (!healthResult.success) {
        log('❌ Cannot connect to API server');
        return false;
    }
    
    // Test 2: Authentication
    log('🔐 Testing Authentication...');
    const testUsers = [
        { email: 'admin@smartcampus.com', password: 'admin123', role: 'Super Admin' },
        { email: 'principal@smartcampus.com', password: 'principal123', role: 'Principal' },
        { email: 'teacher@smartcampus.com', password: 'teacher123', role: 'Teacher' },
        { email: 'student@smartcampus.com', password: 'student123', role: 'Student' }
    ];
    
    let tokens = {};
    let authSuccess = true;
    
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
    
    if (!authSuccess) {
        log('❌ Authentication tests failed');
        return false;
    }
    
    // Test 3: User Management
    if (tokens.super_admin) {
        log('👥 Testing User Management...');
        const userTests = [
            { name: 'Get All Users', endpoint: '/api/users' },
            { name: 'Get Students', endpoint: '/api/users?role=student' },
            { name: 'Get Teachers', endpoint: '/api/users?role=teacher' }
        ];
        
        for (const test of userTests) {
            const result = await makeRequest('GET', test.endpoint, null, 
                { 'Authorization': `Bearer ${tokens.super_admin}` });
            recordTest(test.name, result.success && result.status === 200, 
                       `(Status: ${result.status})`);
        }
    }
    
    // Test 4: Student Management
    if (tokens.super_admin) {
        log('🎓 Testing Student Management...');
        const studentTests = [
            { name: 'Get All Students', endpoint: '/api/students' },
            { name: 'Search Students', endpoint: '/api/students?search=test' }
        ];
        
        for (const test of studentTests) {
            const result = await makeRequest('GET', test.endpoint, null, 
                { 'Authorization': `Bearer ${tokens.super_admin}` });
            recordTest(test.name, result.success && result.status === 200, 
                       `(Status: ${result.status})`);
        }
    }
    
    // Test 5: Teacher Management
    if (tokens.super_admin) {
        log('👨‍🏫 Testing Teacher Management...');
        const teacherTests = [
            { name: 'Get All Teachers', endpoint: '/api/teachers' },
            { name: 'Search Teachers', endpoint: '/api/teachers?search=test' }
        ];
        
        for (const test of teacherTests) {
            const result = await makeRequest('GET', test.endpoint, null, 
                { 'Authorization': `Bearer ${tokens.super_admin}` });
            recordTest(test.name, result.success && result.status === 200, 
                       `(Status: ${result.status})`);
        }
    }
    
    // Test 6: School Management
    if (tokens.super_admin) {
        log('🏫 Testing School Management...');
        const schoolTests = [
            { name: 'Get All Schools', endpoint: '/api/school' },
            { name: 'Get School Stats', endpoint: '/api/school/stats' }
        ];
        
        for (const test of schoolTests) {
            const result = await makeRequest('GET', test.endpoint, null, 
                { 'Authorization': `Bearer ${tokens.super_admin}` });
            recordTest(test.name, result.success && result.status === 200, 
                       `(Status: ${result.status})`);
        }
    }
    
    // Test 7: Attendance
    if (tokens.teacher) {
        log('📋 Testing Attendance...');
        const attendanceTests = [
            { name: 'Get Attendance by Date', endpoint: '/api/attendance?date=2026-02-22' },
            { name: 'Get Attendance by Class', endpoint: '/api/attendance?class=10&section=A' }
        ];
        
        for (const test of attendanceTests) {
            const result = await makeRequest('GET', test.endpoint, null, 
                { 'Authorization': `Bearer ${tokens.teacher}` });
            recordTest(test.name, result.success && result.status === 200, 
                       `(Status: ${result.status})`);
        }
    }
    
    // Test 8: Results
    if (tokens.teacher) {
        log('📊 Testing Results...');
        const resultTests = [
            { name: 'Get Results by Class', endpoint: '/api/results?class=10&section=A' },
            { name: 'Get Results by Exam', endpoint: '/api/results?exam=Final' }
        ];
        
        for (const test of resultTests) {
            const result = await makeRequest('GET', test.endpoint, null, 
                { 'Authorization': `Bearer ${tokens.teacher}` });
            recordTest(test.name, result.success && result.status === 200, 
                       `(Status: ${result.status})`);
        }
    }
    
    // Test 9: Notices
    if (tokens.principal) {
        log('📢 Testing Notices...');
        const noticeTests = [
            { name: 'Get All Notices', endpoint: '/api/notices' },
            { name: 'Get Active Notices', endpoint: '/api/notices?active=true' }
        ];
        
        for (const test of noticeTests) {
            const result = await makeRequest('GET', test.endpoint, null, 
                { 'Authorization': `Bearer ${tokens.principal}` });
            recordTest(test.name, result.success && result.status === 200, 
                       `(Status: ${result.status})`);
        }
    }
    
    // Test 10: Analytics
    if (tokens.super_admin) {
        log('📈 Testing Analytics...');
        const analyticsTests = [
            { name: 'Dashboard Analytics', endpoint: '/api/analytics/dashboard' },
            { name: 'Student Analytics', endpoint: '/api/analytics/students' },
            { name: 'Teacher Analytics', endpoint: '/api/analytics/teachers' }
        ];
        
        for (const test of analyticsTests) {
            const result = await makeRequest('GET', test.endpoint, null, 
                { 'Authorization': `Bearer ${tokens.super_admin}` });
            recordTest(test.name, result.success && result.status === 200, 
                       `(Status: ${result.status})`);
        }
    }
    
    // Test 11: Error Handling
    log('🚨 Testing Error Handling...');
    const errorTests = [
        { name: 'Invalid Endpoint', endpoint: '/api/invalid-endpoint', expectedStatus: 404 },
        { name: 'Invalid Login', endpoint: '/api/auth/login', 
          data: { email: 'invalid@test.com', password: 'wrong' }, expectedStatus: 401 },
        { name: 'Unauthorized Access', endpoint: '/api/users', expectedStatus: 401 }
    ];
    
    for (const test of errorTests) {
        const result = await makeRequest('POST', test.endpoint, test.data);
        const passed = result.status === test.expectedStatus;
        recordTest(test.name, passed, `(Expected: ${test.expectedStatus}, Got: ${result.status})`);
    }
    
    // Test 12: Performance
    log('⚡ Testing Performance...');
    const startTime = Date.now();
    const perfResult = await makeRequest('GET', '/api/health');
    const responseTime = Date.now() - startTime;
    const perfPassed = perfResult.success && responseTime < 3000;
    recordTest('API Performance', perfPassed, `(${responseTime}ms)`);
    
    return true;
}

// Generate final report
function generateReport() {
    const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(2) : 0;
    
    console.log('\n' + '='.repeat(60));
    console.log('🧪 PRODUCTION API TEST REPORT');
    console.log('='.repeat(60));
    console.log(`📊 Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${successRate}%`);
    console.log('='.repeat(60));
    
    const isProductionReady = parseFloat(successRate) >= 90 && failedTests === 0;
    
    console.log('\n🚀 PRODUCTION READINESS ASSESSMENT');
    console.log('='.repeat(60));
    
    if (isProductionReady) {
        console.log('✅ BACKEND IS PRODUCTION READY!');
        console.log('🎉 All critical APIs are working correctly');
        console.log('🔒 Authentication and authorization are working');
        console.log('⚡ API performance is acceptable');
        console.log('🛡️ Error handling is proper');
        console.log('📊 All endpoints are responding correctly');
        console.log('\n🌟 READY FOR DEPLOYMENT TO RENDER! 🌟');
    } else {
        console.log('❌ BACKEND IS NOT PRODUCTION READY');
        console.log('🔧 Issues found that need to be fixed:');
        console.log(`   - Success rate: ${successRate}% (need 90%+)`);
        console.log(`   - Failed tests: ${failedTests}`);
        console.log('\n🔧 Fix the failed tests before deployment');
    }
    
    console.log('='.repeat(60));
    
    return isProductionReady;
}

// Main execution
async function main() {
    try {
        await testAPIs();
        const isReady = generateReport();
        process.exit(isReady ? 0 : 1);
    } catch (error) {
        log(`💥 Test failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}
