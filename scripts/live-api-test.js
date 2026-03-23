/**
 * Comprehensive Live API Testing Script
 * Tests all endpoints on the production Render deployment
 * Postman-style validation for all modules and workflows
 */

const axios = require('axios');

const BASE_URL = 'https://smart-campas-backend.onrender.com/api';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(title, 'cyan');
  log('='.repeat(60), 'blue');
}

function logTest(name, status, details = '') {
  const symbol = status === 'PASS' ? '✅' : '❌';
  const color = status === 'PASS' ? 'green' : 'red';
  log(`${symbol} ${name} - ${status} ${details}`, color);
}

// Store tokens for authenticated requests
let tokens = {
  superAdmin: null,
  principal: null,
  teacher: null,
  student: null,
  parent: null,
  accountant: null
};

let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  issues: []
};

async function testAPI(method, endpoint, data = null, token = null, description = '') {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 0,
      data: error.response?.data || { message: error.message }
    };
  }
}

function recordResult(testName, result, expectedStatus = null) {
  testResults.total++;
  const passed = result.success && (expectedStatus ? result.status === expectedStatus : result.status < 400);
  if (passed) {
    testResults.passed++;
    logTest(testName, 'PASS', `Status: ${result.status}`);
  } else {
    testResults.failed++;
    logTest(testName, 'FAIL', `Status: ${result.status} - ${result.data.message || 'Unknown error'}`);
    testResults.issues.push({
      test: testName,
      status: result.status,
      message: result.data.message,
      expected: expectedStatus
    });
  }
}

async function runTests() {
  log('\n🎯 COMPREHENSIVE SMART CAMPUS LIVE API TESTING', 'cyan');
  log(`📡 Base URL: ${BASE_URL}`, 'blue');
  log('🔍 Testing all production endpoints systematically', 'yellow');

  // ============================================
  // 1. PUBLIC APIs
  // ============================================
  logSection('1. PUBLIC APIs');

  // Health Check
  let result = await testAPI('GET', '/health');
  recordResult('GET /api/health', result, 200);

  // API Info
  result = await testAPI('GET', '');
  recordResult('GET /api (API Info)', result, 200);

  // ============================================
  // 2. AUTHENTICATION
  // ============================================
  logSection('2. AUTHENTICATION');

  // Super Admin Login
  result = await testAPI('POST', '/auth/login', {
    email: 'alamin-admin@pandait.com',
    password: 'pandaitalaminn'
  });
  recordResult('POST /auth/login (Super Admin)', result, 200);
  if (result.success && result.data.token) {
    tokens.superAdmin = result.data.token;
    log('   Token obtained ✓', 'green');
  }

  // Principal Login
  result = await testAPI('POST', '/auth/login', {
    email: 'sultana@vis.edu',
    password: 'Sultana@123'
  });
  recordResult('POST /auth/login (Principal)', result, 200);
  if (result.success && result.data.token) {
    tokens.principal = result.data.token;
    log('   Token obtained ✓', 'green');
  }

  // Teacher Login
  result = await testAPI('POST', '/auth/login', {
    email: 'khan@vis.edu',
    password: 'Teacher@123'
  });
  recordResult('POST /auth/login (Teacher)', result, 200);
  if (result.success && result.data.token) {
    tokens.teacher = result.data.token;
    log('   Token obtained ✓', 'green');
  }

  // Student Login
  result = await testAPI('POST', '/auth/login', {
    email: 'mahmud@student.vis.edu',
    password: 'Student@123'
  });
  recordResult('POST /auth/login (Student)', result, 200);
  if (result.success && result.data.token) {
    tokens.student = result.data.token;
    log('   Token obtained ✓', 'green');
  }

  // Parent Login
  result = await testAPI('POST', '/auth/login', {
    email: 'rahman@parent.vis.edu',
    password: 'Parent@123'
  });
  recordResult('POST /auth/login (Parent)', result, 200);
  if (result.success && result.data.token) {
    tokens.parent = result.data.token;
    log('   Token obtained ✓', 'green');
  }

  // Accountant Login
  result = await testAPI('POST', '/auth/login', {
    email: 'ahmed@accountant.vis.edu',
    password: 'Accountant@123'
  });
  recordResult('POST /auth/login (Accountant)', result, 200);
  if (result.success && result.data.token) {
    tokens.accountant = result.data.token;
    log('   Token obtained ✓', 'green');
  }

  // ============================================
  // 3. SUPER ADMIN APIs
  // ============================================
  logSection('3. SUPER ADMIN APIs');

  // Dashboard
  result = await testAPI('GET', '/dashboard/super-admin', null, tokens.superAdmin);
  recordResult('GET /dashboard/super-admin', result, 200);

  // Get Schools
  result = await testAPI('GET', '/super-admin/schools', null, tokens.superAdmin);
  recordResult('GET /super-admin/schools', result, 200);

  // Create School (if needed)
  result = await testAPI('POST', '/super-admin/schools', {
    schoolName: 'Test School',
    schoolCode: 'TEST001',
    address: 'Test Address',
    phone: '1234567890',
    email: 'test@school.com'
  }, tokens.superAdmin);
  recordResult('POST /super-admin/schools', result, 201);

  // ============================================
  // 4. PRINCIPAL APIs
  // ============================================
  logSection('4. PRINCIPAL APIs');

  // Dashboard
  result = await testAPI('GET', '/dashboard/principal', null, tokens.principal);
  recordResult('GET /dashboard/principal', result, 200);

  // Get Classes
  result = await testAPI('GET', '/principal/classes', null, tokens.principal);
  recordResult('GET /principal/classes', result, 200);

  // Get Subjects
  result = await testAPI('GET', '/principal/subjects', null, tokens.principal);
  recordResult('GET /principal/subjects', result, 200);

  // Get Teachers
  result = await testAPI('GET', '/principal/teachers', null, tokens.principal);
  recordResult('GET /principal/teachers', result, 200);

  // Get Students
  result = await testAPI('GET', '/principal/students', null, tokens.principal);
  recordResult('GET /principal/students', result, 200);

  // Create Class
  result = await testAPI('POST', '/principal/classes', {
    className: 'Class 10',
    sections: ['A', 'B']
  }, tokens.principal);
  recordResult('POST /principal/classes', result, 201);

  // Create Subject
  result = await testAPI('POST', '/principal/subjects', {
    subjectName: 'Mathematics',
    subjectCode: 'MATH101'
  }, tokens.principal);
  recordResult('POST /principal/subjects', result, 201);

  // ============================================
  // 5. TEACHER APIs
  // ============================================
  logSection('5. TEACHER APIs');

  // Dashboard
  result = await testAPI('GET', '/teacher/dashboard', null, tokens.teacher);
  recordResult('GET /teacher/dashboard', result, 200);

  // Get Assigned Classes
  result = await testAPI('GET', '/teacher/classes', null, tokens.teacher);
  recordResult('GET /teacher/classes', result, 200);

  // ============================================
  // 6. STUDENT APIs
  // ============================================
  logSection('6. STUDENT APIs');

  // Dashboard
  result = await testAPI('GET', '/dashboard/student', null, tokens.student);
  recordResult('GET /dashboard/student', result, 200);

  // Get Attendance
  result = await testAPI('GET', '/attendance', null, tokens.student);
  recordResult('GET /attendance (Student)', result, 200);

  // Get Routines
  result = await testAPI('GET', '/routines', null, tokens.student);
  recordResult('GET /routines (Student)', result, 200);

  // ============================================
  // 7. PARENT APIs
  // ============================================
  logSection('7. PARENT APIs');

  // Dashboard
  result = await testAPI('GET', '/dashboard/parent', null, tokens.parent);
  recordResult('GET /dashboard/parent', result, 200);

  // ============================================
  // 8. ACCOUNTANT APIs
  // ============================================
  logSection('8. ACCOUNTANT APIs');

  // Dashboard
  result = await testAPI('GET', '/dashboard/accountant', null, tokens.accountant);
  recordResult('GET /dashboard/accountant', result, 200);

  // Get Fee Structure
  result = await testAPI('GET', '/fees/structure', null, tokens.accountant);
  recordResult('GET /fees/structure', result, 200);

  // ============================================
  // 9. ATTENDANCE APIs
  // ============================================
  logSection('9. ATTENDANCE APIs');

  // Get Attendance (Principal)
  result = await testAPI('GET', '/attendance', null, tokens.principal);
  recordResult('GET /attendance (Principal)', result, 200);

  // Mark Attendance
  result = await testAPI('POST', '/attendance', {
    studentId: 'dummy-student-id',
    date: new Date().toISOString().split('T')[0],
    status: 'present'
  }, tokens.teacher);
  recordResult('POST /attendance', result, 201);

  // ============================================
  // 10. ROUTINE APIs
  // ============================================
  logSection('10. ROUTINE APIs');

  // Get Routines (Principal)
  result = await testAPI('GET', '/routines', null, tokens.principal);
  recordResult('GET /routines (Principal)', result, 200);

  // Create Routine
  result = await testAPI('POST', '/routines', {
    className: 'Class 10',
    section: 'A',
    day: 'Monday',
    periods: [{
      subject: 'Mathematics',
      teacher: 'Teacher Name',
      startTime: '09:00',
      endTime: '10:00'
    }]
  }, tokens.principal);
  recordResult('POST /routines', result, 201);

  // ============================================
  // 11. RESULTS APIs
  // ============================================
  logSection('11. RESULTS APIs');

  // Get Results (Principal)
  result = await testAPI('GET', '/results', null, tokens.principal);
  recordResult('GET /results (Principal)', result, 200);

  // Upload Result
  result = await testAPI('POST', '/results', {
    studentId: 'dummy-student-id',
    examName: 'Mid Term Exam',
    subjects: [
      { subjectName: 'Math', marks: 85 },
      { subjectName: 'English', marks: 78 }
    ]
  }, tokens.teacher);
  recordResult('POST /results', result, 201);

  // Publish Result
  result = await testAPI('PUT', '/results/dummy-result-id/publish', {}, tokens.principal);
  recordResult('PUT /results/:id/publish', result, 200);

  // ============================================
  // 12. FEES APIs
  // ============================================
  logSection('12. FEES APIs');

  // Get Fees (Principal)
  result = await testAPI('GET', '/fees', null, tokens.principal);
  recordResult('GET /fees (Principal)', result, 200);

  // Create Fee Structure
  result = await testAPI('POST', '/fees/structure', {
    className: 'Class 10',
    tuitionFee: 5000,
    examFee: 1000
  }, tokens.principal);
  recordResult('POST /fees/structure', result, 201);

  // ============================================
  // 13. NOTICES APIs
  // ============================================
  logSection('13. NOTICES APIs');

  // Get Notices
  result = await testAPI('GET', '/notices', null, tokens.principal);
  recordResult('GET /notices', result, 200);

  // Create Notice
  result = await testAPI('POST', '/notices', {
    title: 'Test Notice',
    content: 'This is a test notice',
    targetAudience: ['students', 'parents']
  }, tokens.principal);
  recordResult('POST /notices', result, 201);

  // ============================================
  // 14. SEARCH APIs
  // ============================================
  logSection('14. SEARCH APIs');

  // Search
  result = await testAPI('POST', '/search', {
    query: 'test',
    type: 'all'
  }, tokens.principal);
  recordResult('POST /search', result, 200);

  // ============================================
  // 15. ACADEMIC SESSIONS APIs
  // ============================================
  logSection('15. ACADEMIC SESSIONS APIs');

  // Get Sessions
  result = await testAPI('GET', '/academic-sessions', null, tokens.principal);
  recordResult('GET /academic-sessions', result, 200);

  // Create Session
  result = await testAPI('POST', '/academic-sessions', {
    sessionName: '2024-2025',
    startDate: '2024-01-01',
    endDate: '2025-12-31'
  }, tokens.principal);
  recordResult('POST /academic-sessions', result, 201);

  // ============================================
  // 16. ADMISSIONS APIs
  // ============================================
  logSection('16. ADMISSIONS APIs');

  // Get Admissions
  result = await testAPI('GET', '/admissions', null, tokens.principal);
  recordResult('GET /admissions', result, 200);

  // Create Admission
  result = await testAPI('POST', '/admissions', {
    studentName: 'Test Student',
    fatherName: 'Test Father',
    className: 'Class 1'
  }, tokens.principal);
  recordResult('POST /admissions', result, 201);

  // ============================================
  // 17. EXAM SCHEDULES APIs
  // ============================================
  logSection('17. EXAM SCHEDULES APIs');

  // Get Exam Schedules
  result = await testAPI('GET', '/exam-schedules', null, tokens.principal);
  recordResult('GET /exam-schedules', result, 200);

  // Create Exam Schedule
  result = await testAPI('POST', '/exam-schedules', {
    examName: 'Final Exam',
    className: 'Class 10',
    subjects: [{
      subjectName: 'Math',
      date: '2024-12-01',
      time: '10:00'
    }]
  }, tokens.principal);
  recordResult('POST /exam-schedules', result, 201);

  // ============================================
  // 18. LEAVE APIs
  // ============================================
  logSection('18. LEAVE APIs');

  // Get Leave Requests
  result = await testAPI('GET', '/leave', null, tokens.principal);
  recordResult('GET /leave', result, 200);

  // Apply for Leave
  result = await testAPI('POST', '/leave', {
    startDate: '2024-12-01',
    endDate: '2024-12-02',
    reason: 'Medical'
  }, tokens.teacher);
  recordResult('POST /leave', result, 201);

  // ============================================
  // 19. NOTIFICATIONS APIs
  // ============================================
  logSection('19. NOTIFICATIONS APIs');

  // Get Notifications
  result = await testAPI('GET', '/notifications', null, tokens.principal);
  recordResult('GET /notifications', result, 200);

  // ============================================
  // 20. SUBSTITUTES APIs
  // ============================================
  logSection('20. SUBSTITUTES APIs');

  // Get Substitutes
  result = await testAPI('GET', '/substitutes', null, tokens.principal);
  recordResult('GET /substitutes', result, 200);

  // ============================================
  // 21. TEACHER ASSIGNMENTS APIs
  // ============================================
  logSection('21. TEACHER ASSIGNMENTS APIs');

  // Get Teacher Assignments
  result = await testAPI('GET', '/teacher-assignments', null, tokens.principal);
  recordResult('GET /teacher-assignments', result, 200);

  // Assign Teacher
  result = await testAPI('POST', '/teacher-assignments', {
    teacherId: 'dummy-teacher-id',
    subjectId: 'dummy-subject-id',
    className: 'Class 10'
  }, tokens.principal);
  recordResult('POST /teacher-assignments', result, 201);

  // ============================================
  // 22. ACTIVITIES APIs
  // ============================================
  logSection('22. ACTIVITIES APIs');

  // Get Activities
  result = await testAPI('GET', '/activities', null, tokens.principal);
  recordResult('GET /activities', result, 200);

  // ============================================
  // 23. ANALYTICS APIs
  // ============================================
  logSection('23. ANALYTICS APIs');

  // Get Analytics
  result = await testAPI('GET', '/analytics', null, tokens.principal);
  recordResult('GET /analytics', result, 200);

  // ============================================
  // 24. ROOMS APIs
  // ============================================
  logSection('24. ROOMS APIs');

  // Get Rooms
  result = await testAPI('GET', '/rooms', null, tokens.principal);
  recordResult('GET /rooms', result, 200);

  // ============================================
  // 25. EVENTS APIs
  // ============================================
  logSection('25. EVENTS APIs');

  // Get Events
  result = await testAPI('GET', '/events', null, tokens.principal);
  recordResult('GET /events', result, 200);

  // ============================================
  // 26. PUBLIC APIs (additional)
  // ============================================
  logSection('26. PUBLIC APIs');

  // Public Search
  result = await testAPI('POST', '/public/search', {
    schoolCode: 'VIS',
    studentClass: '10',
    roll: '1',
    examName: 'Final Exam'
  });
  recordResult('POST /public/search', result, 200);

  // ============================================
  // 27. AI APIs
  // ============================================
  logSection('27. AI APIs');

  // AI Features
  result = await testAPI('GET', '/ai/features', null, tokens.principal);
  recordResult('GET /ai/features', result, 200);

  // ============================================
  // FINAL REPORT
  // ============================================
  logSection('FINAL TEST REPORT');

  log(`Total Tests: ${testResults.total}`, 'blue');
  log(`Passed: ${testResults.passed}`, 'green');
  log(`Failed: ${testResults.failed}`, 'red');

  if (testResults.issues.length > 0) {
    log('\n❌ ISSUES FOUND:', 'red');
    testResults.issues.forEach((issue, index) => {
      log(`${index + 1}. ${issue.test}`, 'yellow');
      log(`   Status: ${issue.status}, Message: ${issue.message}`, 'red');
    });
  } else {
    log('\n✅ ALL TESTS PASSED!', 'green');
  }

  log('\n📝 Next Steps:', 'cyan');
  if (testResults.failed > 0) {
    log('1. Fix the failed APIs in codebase', 'yellow');
    log('2. Push changes to GitHub', 'yellow');
    log('3. Redeploy on Render', 'yellow');
    log('4. Re-run this test script', 'yellow');
  } else {
    log('All APIs are working correctly!', 'green');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Test runner error:', error);
});
