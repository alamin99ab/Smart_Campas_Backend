const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:5000/api';
let authToken = '';
let testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    details: []
};

// Test helper functions
const logTest = (method, endpoint, status, message, data = null) => {
    const result = {
        method,
        endpoint,
        status: status ? '✅ PASS' : '❌ FAIL',
        message,
        data: data ? JSON.stringify(data, null, 2) : null
    };
    testResults.details.push(result);
    testResults.total++;
    if (status) testResults.passed++;
    else testResults.failed++;
    
    console.log(`${result.status} ${method} ${endpoint} - ${message}`);
    if (data) console.log('   Response:', JSON.stringify(data, null, 4));
};

const makeRequest = async (method, endpoint, data = null, headers = {}) => {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        if (data) config.data = data;
        if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
        
        const response = await axios(config);
        return { success: true, data: response.data, status: response.status };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.data || error.message,
            status: error.response?.status || 500
        };
    }
};

// Test functions
async function testAuthAPIs() {
    console.log('\n🔐 TESTING AUTHENTICATION APIs');
    console.log('═'.repeat(50));
    
    // Test Registration
    const registerData = {
        name: 'Test Super Admin',
        email: 'testadmin@smartcampus.com',
        password: 'test123',
        role: 'super_admin',
        schoolCode: 'GLOBAL'
    };
    
    const registerResult = await makeRequest('POST', '/auth/register', registerData);
    logTest('POST', '/auth/register', registerResult.success, 
        registerResult.success ? 'Registration successful' : 'Registration failed', 
        registerResult.success ? registerResult.data : registerResult.error);
    
    // Test Login
    const loginData = {
        email: 'testadmin@smartcampus.com',
        password: 'test123'
    };
    
    const loginResult = await makeRequest('POST', '/auth/login', loginData);
    if (loginResult.success && loginResult.data.token) {
        authToken = loginResult.data.token;
    }
    logTest('POST', '/auth/login', loginResult.success, 
        loginResult.success ? 'Login successful' : 'Login failed', 
        loginResult.success ? { token: '***RECEIVED***' } : loginResult.error);
    
    // Test Get Profile
    const profileResult = await makeRequest('GET', '/auth/profile');
    logTest('GET', '/auth/profile', profileResult.success, 
        profileResult.success ? 'Profile retrieved' : 'Profile failed', 
        profileResult.success ? profileResult.data : profileResult.error);
}

async function testAdminAPIs() {
    console.log('\n👑 TESTING ADMIN/SUPER ADMIN APIs');
    console.log('═'.repeat(50));
    
    // Test Get Global Stats
    const statsResult = await makeRequest('GET', '/admin/stats');
    logTest('GET', '/admin/stats', statsResult.success, 
        statsResult.success ? 'Stats retrieved' : 'Stats failed', 
        statsResult.success ? statsResult.data : statsResult.error);
    
    // Test Get All Schools
    const schoolsResult = await makeRequest('GET', '/admin/schools');
    logTest('GET', '/admin/schools', schoolsResult.success, 
        schoolsResult.success ? 'Schools retrieved' : 'Schools failed', 
        schoolsResult.success ? schoolsResult.data : schoolsResult.error);
    
    // Test Create School
    const schoolData = {
        schoolName: 'Test School API',
        schoolCode: 'TSAPI001',
        address: '123 Test Street',
        phone: '+1234567890',
        email: 'test@school.com'
    };
    
    const createSchoolResult = await makeRequest('POST', '/admin/school', schoolData);
    logTest('POST', '/admin/school', createSchoolResult.success, 
        createSchoolResult.success ? 'School created' : 'School creation failed', 
        createSchoolResult.success ? createSchoolResult.data : createSchoolResult.error);
}

async function testStudentAPIs() {
    console.log('\n👨‍🎓 TESTING STUDENT APIs');
    console.log('═'.repeat(50));
    
    // Test Get Students
    const studentsResult = await makeRequest('GET', '/students');
    logTest('GET', '/students', studentsResult.success, 
        studentsResult.success ? 'Students retrieved' : 'Students failed', 
        studentsResult.success ? studentsResult.data : studentsResult.error);
    
    // Test Create Student
    const studentData = {
        name: 'Test Student',
        email: 'teststudent@school.com',
        password: 'test123',
        role: 'student',
        schoolCode: 'TSAPI001',
        class: '10',
        section: 'A',
        rollNumber: '001'
    };
    
    const createStudentResult = await makeRequest('POST', '/students', studentData);
    logTest('POST', '/students', createStudentResult.success, 
        createStudentResult.success ? 'Student created' : 'Student creation failed', 
        createStudentResult.success ? createStudentResult.data : createStudentResult.error);
}

async function testTeacherAPIs() {
    console.log('\n👨‍🏫 TESTING TEACHER APIs');
    console.log('═'.repeat(50));
    
    // Test Get Teachers
    const teachersResult = await makeRequest('GET', '/teachers');
    logTest('GET', '/teachers', teachersResult.success, 
        teachersResult.success ? 'Teachers retrieved' : 'Teachers failed', 
        teachersResult.success ? teachersResult.data : teachersResult.error);
    
    // Test Create Teacher
    const teacherData = {
        name: 'Test Teacher',
        email: 'testteacher@school.com',
        password: 'test123',
        role: 'teacher',
        schoolCode: 'TSAPI001',
        subjects: ['Mathematics', 'Physics'],
        qualification: 'M.Sc Physics',
        experience: '5 years'
    };
    
    const createTeacherResult = await makeRequest('POST', '/teachers', teacherData);
    logTest('POST', '/teachers', createTeacherResult.success, 
        createTeacherResult.success ? 'Teacher created' : 'Teacher creation failed', 
        createTeacherResult.success ? createTeacherResult.data : createTeacherResult.error);
}

async function testNoticeAPIs() {
    console.log('\n📢 TESTING NOTICE APIs');
    console.log('═'.repeat(50));
    
    // Test Get Notices
    const noticesResult = await makeRequest('GET', '/notices');
    logTest('GET', '/notices', noticesResult.success, 
        noticesResult.success ? 'Notices retrieved' : 'Notices failed', 
        noticesResult.success ? noticesResult.data : noticesResult.error);
    
    // Test Create Notice
    const noticeData = {
        title: 'Test Notice',
        content: 'This is a test notice for API testing',
        category: 'general',
        priority: 'medium',
        targetAudience: ['student', 'teacher'],
        schoolCode: 'TSAPI001'
    };
    
    const createNoticeResult = await makeRequest('POST', '/notices', noticeData);
    logTest('POST', '/notices', createNoticeResult.success, 
        createNoticeResult.success ? 'Notice created' : 'Notice creation failed', 
        createNoticeResult.success ? createNoticeResult.data : createNoticeResult.error);
}

async function testAttendanceAPIs() {
    console.log('\n📋 TESTING ATTENDANCE APIs');
    console.log('═'.repeat(50));
    
    // Test Take Attendance
    const attendanceData = {
        date: new Date().toISOString().split('T')[0],
        class: '10',
        section: 'A',
        attendance: [
            { studentId: 'teststudent001', status: 'present' },
            { studentId: 'teststudent002', status: 'absent' }
        ],
        schoolCode: 'TSAPI001'
    };
    
    const attendanceResult = await makeRequest('POST', '/attendance/take', attendanceData);
    logTest('POST', '/attendance/take', attendanceResult.success, 
        attendanceResult.success ? 'Attendance recorded' : 'Attendance failed', 
        attendanceResult.success ? attendanceResult.data : attendanceResult.error);
    
    // Test Get Attendance Report
    const reportResult = await makeRequest('GET', '/attendance/report?class=10&section=A');
    logTest('GET', '/attendance/report', reportResult.success, 
        reportResult.success ? 'Attendance report retrieved' : 'Attendance report failed', 
        reportResult.success ? reportResult.data : reportResult.error);
}

async function testResultAPIs() {
    console.log('\n📊 TESTING RESULT APIs');
    console.log('═'.repeat(50));
    
    // Test Get Results
    const resultsResult = await makeRequest('GET', '/results');
    logTest('GET', '/results', resultsResult.success, 
        resultsResult.success ? 'Results retrieved' : 'Results failed', 
        resultsResult.success ? resultsResult.data : resultsResult.error);
    
    // Test Upload Result
    const resultData = {
        studentId: 'teststudent001',
        examType: 'midterm',
        class: '10',
        section: 'A',
        subjects: [
            { name: 'Mathematics', marks: 85, totalMarks: 100 },
            { name: 'Physics', marks: 78, totalMarks: 100 }
        ],
        schoolCode: 'TSAPI001'
    };
    
    const uploadResult = await makeRequest('POST', '/results', resultData);
    logTest('POST', '/results', uploadResult.success, 
        uploadResult.success ? 'Result uploaded' : 'Result upload failed', 
        uploadResult.success ? uploadResult.data : uploadResult.error);
}

async function testRoutineAPIs() {
    console.log('\n📅 TESTING ROUTINE APIs');
    console.log('═'.repeat(50));
    
    // Test Get Routines
    const routinesResult = await makeRequest('GET', '/routine');
    logTest('GET', '/routine', routinesResult.success, 
        routinesResult.success ? 'Routines retrieved' : 'Routines failed', 
        routinesResult.success ? routinesResult.data : routinesResult.error);
    
    // Test Create Routine
    const routineData = {
        class: '10',
        section: 'A',
        day: 'monday',
        periods: [
            { time: '9:00-10:00', subject: 'Mathematics', teacher: 'Test Teacher' },
            { time: '10:00-11:00', subject: 'Physics', teacher: 'Test Teacher' }
        ],
        schoolCode: 'TSAPI001'
    };
    
    const createRoutineResult = await makeRequest('POST', '/routine', routineData);
    logTest('POST', '/routine', createRoutineResult.success, 
        createRoutineResult.success ? 'Routine created' : 'Routine creation failed', 
        createRoutineResult.success ? createRoutineResult.data : createRoutineResult.error);
}

async function testFeeAPIs() {
    console.log('\n💰 TESTING FEE APIs');
    console.log('═'.repeat(50));
    
    // Test Get Fee Report
    const feeReportResult = await makeRequest('GET', '/fee/report');
    logTest('GET', '/fee/report', feeReportResult.success, 
        feeReportResult.success ? 'Fee report retrieved' : 'Fee report failed', 
        feeReportResult.success ? feeReportResult.data : feeReportResult.error);
    
    // Test Update Fee
    const feeData = {
        studentId: 'teststudent001',
        feeType: 'tuition',
        amount: 5000,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        schoolCode: 'TSAPI001'
    };
    
    const updateFeeResult = await makeRequest('POST', '/fee/update', feeData);
    logTest('POST', '/fee/update', updateFeeResult.success, 
        updateFeeResult.success ? 'Fee updated' : 'Fee update failed', 
        updateFeeResult.success ? updateFeeResult.data : updateFeeResult.error);
}

async function testEventAPIs() {
    console.log('\n🎉 TESTING EVENT APIs');
    console.log('═'.repeat(50));
    
    // Test Get Events
    const eventsResult = await makeRequest('GET', '/events');
    logTest('GET', '/events', eventsResult.success, 
        eventsResult.success ? 'Events retrieved' : 'Events failed', 
        eventsResult.success ? eventsResult.data : eventsResult.error);
    
    // Test Create Event
    const eventData = {
        title: 'Test Event',
        description: 'This is a test event',
        type: 'academic',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        location: 'School Auditorium',
        targetRoles: ['student', 'teacher'],
        schoolCode: 'TSAPI001'
    };
    
    const createEventResult = await makeRequest('POST', '/events', eventData);
    logTest('POST', '/events', createEventResult.success, 
        createEventResult.success ? 'Event created' : 'Event creation failed', 
        createEventResult.success ? createEventResult.data : createEventResult.error);
}

async function testDashboardAPIs() {
    console.log('\n📈 TESTING DASHBOARD APIs');
    console.log('═'.repeat(50));
    
    // Test Get Dashboard
    const dashboardResult = await makeRequest('GET', '/dashboard');
    logTest('GET', '/dashboard', dashboardResult.success, 
        dashboardResult.success ? 'Dashboard data retrieved' : 'Dashboard failed', 
        dashboardResult.success ? dashboardResult.data : dashboardResult.error);
}

// Main test runner
async function runAllTests() {
    console.log('🚀 STARTING COMPREHENSIVE API TESTING');
    console.log('='.repeat(60));
    console.log(`Base URL: ${BASE_URL}`);
    console.log('='.repeat(60));
    
    try {
        await testAuthAPIs();
        await testAdminAPIs();
        await testStudentAPIs();
        await testTeacherAPIs();
        await testNoticeAPIs();
        await testAttendanceAPIs();
        await testResultAPIs();
        await testRoutineAPIs();
        await testFeeAPIs();
        await testEventAPIs();
        await testDashboardAPIs();
        
        // Print final results
        console.log('\n📊 FINAL TEST RESULTS');
        console.log('═'.repeat(50));
        console.log(`Total Tests: ${testResults.total}`);
        console.log(`✅ Passed: ${testResults.passed}`);
        console.log(`❌ Failed: ${testResults.failed}`);
        console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
        
        if (testResults.failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            testResults.details.filter(test => test.status === '❌ FAIL').forEach(test => {
                console.log(`   ${test.method} ${test.endpoint} - ${test.message}`);
                if (test.data) console.log(`   Error: ${test.data}`);
            });
        }
        
        console.log('\n🎉 API TESTING COMPLETED!');
        
    } catch (error) {
        console.error('❌ Test runner error:', error.message);
    }
}

// Run tests
runAllTests();
