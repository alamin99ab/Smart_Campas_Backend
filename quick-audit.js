/**
 * QUICK PRODUCTION ENDPOINT AUDIT
 * Tests all critical endpoints for stability and correctness
 */

const axios = require('axios');
const BASE_URL = 'https://smart-campas-backend.onrender.com/api';

const results = { passed: 0, failed: 0, errors: [] };

async function test(name, method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: BASE_URL + endpoint,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    };
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    if (data) config.data = data;
    
    const res = await axios(config);
    console.log(`✅ ${name} - ${res.status}`);
    results.passed++;
    return res.data;
  } catch (error) {
    const status = error.response?.status || 'NO_RESPONSE';
    const msg = error.response?.data?.message || error.message;
    console.log(`❌ ${name} - ${status} - ${msg}`);
    results.failed++;
    results.errors.push({ name, status, msg });
    return null;
  }
}

async function runAudit() {
  console.log('🔍 QUICK PRODUCTION ENDPOINT AUDIT\n');

  // Get tokens
  console.log('=== AUTHENTICATION ===');
  const loginRes = await test('Auth: SA Login', 'POST', '/auth/login', {
    email: 'alamin-admin@pandait.com',
    password: 'pandaitalaminn'
  });
  const saToken = loginRes?.data?.data?.token || loginRes?.data?.token;

  const principalRes = await test('Auth: Principal Login', 'POST', '/auth/login', {
    email: 'sultana@vis.edu',
    password: 'Sultana@123'
  });
  const principalToken = principalRes?.data?.data?.token || principalRes?.data?.token;

  const teacherRes = await test('Auth: Teacher Login', 'POST', '/auth/login', {
    email: 'khan@vis.edu',
    password: 'Teacher@123'
  });
  const teacherToken = teacherRes?.data?.data?.token || teacherRes?.data?.token;

  const studentRes = await test('Auth: Student Login', 'POST', '/auth/login', {
    email: 'mahmud@student.vis.edu',
    password: 'Student@123'
  });
  const studentToken = studentRes?.data?.data?.token || studentRes?.data?.token;

  // Health & Public
  console.log('\n=== HEALTH & PUBLIC ===');
  await test('Health', 'GET', '/health');
  await test('API Info', 'GET', '');

  // Super Admin
  console.log('\n=== SUPER ADMIN ===');
if (saToken) {
    await test('SA: Dashboard', 'GET', '/super-admin/dashboard', null, saToken);
    await test('SA: Schools', 'GET', '/super-admin/schools', null, saToken);
    await test('SA: Users', 'GET', '/super-admin/users', null, saToken);
    await test('SA: Statistics', 'GET', '/super-admin/statistics', null, saToken);
    await test('SA: Settings', 'GET', '/super-admin/settings', null, saToken);
  } else {
    console.log('⚠️  Skipping Super Admin tests - no token');
  }

  // Principal Dashboard
  console.log('\n=== PRINCIPAL ROUTES ===');
  if (principalToken) {
    await test('Principal: Dashboard', 'GET', '/dashboard/principal', null, principalToken);
    await test('Principal: Classes', 'GET', '/principal/classes', null, principalToken);
    await test('Principal: Subjects', 'GET', '/principal/subjects', null, principalToken);
    await test('Principal: Teachers', 'GET', '/principal/teachers', null, principalToken);
    await test('Principal: Students', 'GET', '/principal/students', null, principalToken);
  } else {
    console.log('⚠️  Skipping Principal tests - no token');
  }

  // Teacher Routes
  console.log('\n=== TEACHER ROUTES ===');
  if (teacherToken) {
    await test('Teacher: Dashboard', 'GET', '/teacher/dashboard', null, teacherToken);
    await test('Teacher: Classes', 'GET', '/teacher/classes', null, teacherToken);
  } else {
    console.log('⚠️  Skipping Teacher tests - no token');
  }

  // Student Routes
  console.log('\n=== STUDENT ROUTES ===');
  if (studentToken) {
    await test('Student: Dashboard', 'GET', '/dashboard/student', null, studentToken);
    await test('Student: Attendance', 'GET', '/attendance', null, studentToken);
    await test('Student: Routines', 'GET', '/routines', null, studentToken);
  } else {
    console.log('⚠️  Skipping Student tests - no token');
  }

  // Common APIs
  console.log('\n=== COMMON APIS ===');
  if (principalToken) {
    await test('Attendance', 'GET', '/attendance', null, principalToken);
    await test('Routines', 'GET', '/routines', null, principalToken);
    await test('Results', 'GET', '/results', null, principalToken);
    await test('Exam Schedules', 'GET', '/exam-schedules', null, principalToken);
    await test('Fees', 'GET', '/fees', null, principalToken);
    await test('Notices', 'GET', '/notices', null, principalToken);
    await test('Academic Sessions', 'GET', '/academic-sessions', null, principalToken);
    await test('Admissions', 'GET', '/admissions', null, principalToken);
    await test('Leave', 'GET', '/leave', null, principalToken);
    await test('Notifications', 'GET', '/notifications', null, principalToken);
    await test('Activities', 'GET', '/activities', null, principalToken);
    await test('Analytics', 'GET', '/analytics', null, principalToken);
  } else {
    console.log('⚠️  Skipping common APIs - no principal token');
  }

  // Report
  console.log('\n' + '='.repeat(40));
  console.log(`\n📊 RESULTS: ${results.passed} PASSED, ${results.failed} FAILED\n`);
  
  if (results.errors.length > 0) {
    console.log('❌ FAILED ENDPOINTS:');
    results.errors.forEach(e => {
      console.log(`  - ${e.name}: ${e.status}`);
    });
  } else {
    console.log('✅ ALL ENDPOINTS PASSED!');
  }
}

runAudit().catch(err => console.error('Test error:', err.message));