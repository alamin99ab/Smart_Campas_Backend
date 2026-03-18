/**
 * Smart Campus API Testing Script
 * Tests all API endpoints for the Smart School System
 */

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3001/api';

// Test results
let results = {
    passed: 0,
    failed: 0,
    tests: []
};

function log(message, type = 'info') {
    const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    console.log(`${prefix} ${message}`);
}

async function testEndpoint(method, endpoint, data = null, token = null, expectedStatus = 200) {
    const config = {
        method,
        url: `${BASE_URL}${endpoint}`,
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
        },
        validateStatus: () => true
    };

    if (data) {
        config.data = data;
    }

    try {
        const response = await axios(config);
        const success = response.status === expectedStatus;
        
        if (success) {
            results.passed++;
            results.tests.push({ endpoint, method, status: 'PASSED' });
            log(`${method.toUpperCase()} ${endpoint} - ${response.status}`, 'success');
        } else {
            results.failed++;
            results.tests.push({ endpoint, method, status: 'FAILED', error: response.data?.message });
            log(`${method.toUpperCase()} ${endpoint} - ${response.status} (${response.data?.message || 'Error'})`, 'error');
        }
        
        return { success, data: response.data, status: response.status };
    } catch (error) {
        results.failed++;
        results.tests.push({ endpoint, method, status: 'ERROR', error: error.message });
        log(`${method.toUpperCase()} ${endpoint} - ERROR: ${error.message}`, 'error');
        return { success: false, error: error.message };
    }
}

async function runTests() {
    console.log('\n🧪 Starting Smart Campus API Tests...\n');
    console.log(`Base URL: ${BASE_URL}\n`);

    let token = null;
    let schoolId = null;
    let principalUserId = null;

    // Test 1: Health Check
    await testEndpoint('GET', '/health');

    // Test 2: API Info
    await testEndpoint('GET', '/');

    // Test 3: Super Admin Login
    log('\n🔐 Testing Authentication...');
    const loginResponse = await testEndpoint('POST', '/auth/login', {
        email: 'alamin-admin@pandait.com',
        password: 'pandaitalaminn'
    });

    if (loginResponse.success && loginResponse.data?.data?.token) {
        token = loginResponse.data.data.token;
        log('✅ Got authentication token', 'success');
    } else {
        log('❌ Login failed - ' + (loginResponse.data?.message || 'Unknown error'), 'error');
    }

    // Test 4: Get Profile (requires auth)
    if (token) {
        await testEndpoint('GET', '/auth/profile', null, token);
    }

    // Test 5: Super Admin - Get All Schools
    log('\n🏫 Testing Super Admin - School Management...');
    if (token) {
        await testEndpoint('GET', '/super-admin/schools', null, token);
    }

    // Test 6: Create School (Super Admin)
    if (token) {
        const schoolData = {
            schoolName: 'Test School',
            schoolCode: 'TEST' + Date.now(),
            principalName: 'Test Principal',
            principalEmail: 'principal' + Date.now() + '@test.com',
            principalPassword: 'TestPass123!',
            phone: '+1234567890',
            address: 'Test Address',
            subscriptionPlan: 'trial'
        };
        
        const createSchoolResponse = await testEndpoint('POST', '/super-admin/schools', schoolData, token, 201);
        if (createSchoolResponse.success && createSchoolResponse.data?.data?._id) {
            schoolId = createSchoolResponse.data.data._id;
            principalUserId = createSchoolResponse.data.data.principal?._id;
            log(`✅ School created: ${schoolId}`, 'success');
        }
    }

    // Test 7: Principal Login (after school creation)
    if (principalUserId) {
        await testEndpoint('POST', '/principal/login', {
            email: 'principal@test.com',
            password: 'TestPass123!'
        });
    }

    // Test 8: Dashboard
    log('\n📊 Testing Dashboards...');
    if (token) {
        await testEndpoint('GET', '/dashboard', null, token);
        await testEndpoint('GET', '/dashboard/stats', null, token);
    }

    // Test 9: Academic Sessions
    log('\n📚 Testing Academic Sessions...');
    if (token) {
        await testEndpoint('GET', '/academic-sessions', null, token);
        await testEndpoint('POST', '/academic-sessions', {
            sessionName: '2026',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            isActive: true
        }, token, 201);
    }

    // Test 10: Classes
    log('\n🏫 Testing Classes...');
    if (token) {
        await testEndpoint('GET', '/principal/classes', null, token);
        await testEndpoint('POST', '/principal/classes', {
            className: 'Class 1',
            classLevel: 1,
            section: 'A',
            capacity: 30,
            academicYear: '2026'
        }, token, 201);
    }

    // Test 11: Subjects
    log('\n📖 Testing Subjects...');
    if (token) {
        await testEndpoint('GET', '/principal/subjects', null, token);
        await testEndpoint('POST', '/principal/subjects', {
            subjectName: 'Mathematics',
            subjectCode: 'MATH',
            category: 'Core',
            classLevels: [1, 2, 3],
            credits: 4,
            periodsPerWeek: 5,
            passingMarks: 33,
            totalMarks: 100
        }, token, 201);
    }

    // Test 12: Attendance
    log('\n✅ Testing Attendance...');
    if (token) {
        await testEndpoint('GET', '/attendance', null, token);
    }

    // Test 13: Exams
    log('\n📝 Testing Exams...');
    if (token) {
        await testEndpoint('GET', '/principal/exams', null, token);
        await testEndpoint('POST', '/principal/exams', {
            examName: 'Mid Term 2026',
            examType: 'written',
            startDate: '2026-06-01',
            endDate: '2026-06-15',
            academicYear: '2026'
        }, token, 201);
    }

    // Test 14: Fees
    log('\n💰 Testing Fees...');
    if (token) {
        await testEndpoint('GET', '/fees', null, token);
    }

    // Test 15: Notices
    log('\n📢 Testing Notices...');
    if (token) {
        await testEndpoint('GET', '/notices', null, token);
        await testEndpoint('POST', '/notices', {
            title: 'Test Notice',
            content: 'This is a test notice',
            priority: 'normal',
            targetAudience: ['all']
        }, token, 201);
    }

    // Test 16: Results
    log('\n🎓 Testing Results...');
    if (token) {
        await testEndpoint('GET', '/results', null, token);
    }

    // Test 17: Routine
    log('\n📅 Testing Routine...');
    if (token) {
        await testEndpoint('GET', '/routines', null, token);
    }

    // Test 18: Teacher Routes
    log('\n👨‍🏫 Testing Teacher Routes...');
    if (token) {
        await testEndpoint('GET', '/teacher/dashboard', null, token);
        await testEndpoint('GET', '/teacher/classes', null, token);
    }

    // Test 18: Student Routes
    log('\n🎓 Testing Student Routes...');
    if (token) {
        await testEndpoint('GET', '/student/dashboard', null, token);
    }

    // Test 19: Parent Routes
    log('\n👨‍👩‍👧 Testing Parent Routes...');
    if (token) {
        await testEndpoint('GET', '/parent/dashboard', null, token);
    }

    // Test 20: Accountant Routes
    log('\n💵 Testing Accountant Routes...');
    if (token) {
        await testEndpoint('GET', '/accountant/dashboard', null, token);
    }

    // Print Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📈 Total: ${results.passed + results.failed}`);
    console.log('='.repeat(50));

    if (results.failed > 0) {
        console.log('\n❌ Failed Tests:');
        results.tests
            .filter(t => t.status === 'FAILED' || t.status === 'ERROR')
            .forEach(t => {
                console.log(`  - ${t.method} ${t.endpoint}: ${t.error || 'Status mismatch'}`);
            });
    }

    console.log('\n🎯 Test Complete!\n');

    return results;
}

// Export for use as module
module.exports = { runTests, testEndpoint };

// Run if called directly
if (require.main === module) {
    runTests().then(() => process.exit(0)).catch(err => {
        console.error('Test execution failed:', err);
        process.exit(1);
    });
}
