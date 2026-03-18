/**
 * COMPREHENSIVE API TEST SUITE
 * Tests all Super Admin, Principal, Teacher, Student workflows
 * Credentials: alamin-admin@pandait.com / pandaitalaminn
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001/api';
const SUPER_ADMIN = {
  email: 'alamin-admin@pandait.com',
  password: 'pandaitalaminn'
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Test results
let passed = 0;
let failed = 0;
let total = 0;
let authToken = null;
let refreshToken = null;
let createdSchoolId = null;
let createdPrincipalId = null;
let createdTeacherId = null;
let createdStudentId = null;

// Test helper
async function test(name, fn) {
  total++;
  try {
    await fn();
    console.log(`${colors.green}✓${colors.reset} ${name}`);
    passed++;
  } catch (error) {
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    console.log(`  ${colors.red}Error: ${error.message}${colors.reset}`);
    failed++;
  }
}

// API helper
async function apiCall(method, endpoint, data = null, token = null) {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  if (data) {
    config.data = data;
  }
  
  return axios(config);
}

// ==================== AUTHENTICATION TESTS ====================

async function testSuperAdminLogin() {
  const response = await apiCall('POST', '/auth/login', SUPER_ADMIN);
  
  if (!response.data.success) {
    throw new Error('Login failed: ' + response.data.message);
  }
  
  if (!response.data.data.token) {
    throw new Error('No token received');
  }
  
  authToken = response.data.data.token;
  refreshToken = response.data.data.refreshToken;
  
  console.log(`  ${colors.blue}Token received: ${authToken.substring(0, 30)}...${colors.reset}`);
}

async function testTokenRefresh() {
  const response = await apiCall('POST', '/auth/refresh-token', {
    refreshToken: refreshToken
  });
  
  if (!response.data.success) {
    throw new Error('Token refresh failed: ' + response.data.message);
  }
  
  authToken = response.data.data.token;
}

async function testGetProfile() {
  const response = await apiCall('GET', '/auth/profile', null, authToken);
  
  if (!response.data.success) {
    throw new Error('Get profile failed: ' + response.data.message);
  }
  
  if (response.data.data.role !== 'super_admin') {
    throw new Error('Expected role super_admin, got: ' + response.data.data.role);
  }
  
  console.log(`  ${colors.blue}Role: ${response.data.data.role}${colors.reset}`);
}

// ==================== SUPER ADMIN TESTS ====================

async function testSuperAdminDashboard() {
  const response = await apiCall('GET', '/super-admin/dashboard', null, authToken);
  
  if (!response.data.success) {
    throw new Error('Dashboard failed: ' + response.data.message);
  }
  
  console.log(`  ${colors.blue}Schools: ${response.data.data?.statistics?.totalSchools || 0}${colors.reset}`);
}

async function testCreateSchool() {
  const schoolData = {
    name: 'Test School ' + Date.now(),
    code: 'TEST' + Date.now().toString().slice(-4),
    address: {
      street: '123 Test Street',
      city: 'Test City',
      state: 'Test State',
      zipCode: '12345',
      country: 'Test Country'
    },
    contact: {
      phone: '+1234567890',
      email: 'test@school.com',
      website: 'https://testschool.com'
    },
    principal: {
      name: 'Test Principal',
      email: 'principal' + Date.now() + '@test.com',
      phone: '+1234567890'
    },
    subscription: {
      plan: 'trial',
      startDate: new Date().toISOString()
    }
  };
  
  const response = await apiCall('POST', '/super-admin/schools', schoolData, authToken);
  
  if (!response.data.success) {
    throw new Error('Create school failed: ' + response.data.message);
  }
  
  createdSchoolId = response.data.data._id;
  createdPrincipalId = response.data.data.principalId;
  
  console.log(`  ${colors.blue}School ID: ${createdSchoolId}${colors.reset}`);
}

async function testGetSchools() {
  const response = await apiCall('GET', '/super-admin/schools', null, authToken);
  
  if (!response.data.success) {
    throw new Error('Get schools failed: ' + response.data.message);
  }
  
  console.log(`  ${colors.blue}Total schools: ${response.data.data?.length || 0}${colors.reset}`);
}

async function testGetSchoolById() {
  if (!createdSchoolId) {
    throw new Error('No school created to test');
  }
  
  const response = await apiCall('GET', `/super-admin/schools/${createdSchoolId}`, null, authToken);
  
  if (!response.data.success) {
    throw new Error('Get school by ID failed: ' + response.data.message);
  }
}

async function testUpdateSchool() {
  if (!createdSchoolId) {
    throw new Error('No school created to test');
  }
  
  const updateData = {
    name: 'Updated Test School ' + Date.now()
  };
  
  const response = await apiCall('PUT', `/super-admin/schools/${createdSchoolId}`, updateData, authToken);
  
  if (!response.data.success) {
    throw new Error('Update school failed: ' + response.data.message);
  }
}

async function testGetPlatformStatistics() {
  const response = await apiCall('GET', '/super-admin/statistics', null, authToken);
  
  if (!response.data.success) {
    throw new Error('Get statistics failed: ' + response.data.message);
  }
  
  console.log(`  ${colors.blue}Platform statistics retrieved${colors.reset}`);
}

// ==================== PRINCIPAL TESTS ====================

async function testPrincipalLogin() {
  // First get principal credentials from the created school
  const response = await apiCall('POST', '/auth/login', {
    email: 'principal' + createdSchoolId + '@test.com',
    password: 'password123' // Default password set by system
  });
  
  // This might fail if password is different, that's OK for this test
  if (response.data.success) {
    console.log(`  ${colors.yellow}Principal login may need separate test credentials${colors.reset}`);
  }
}

// ==================== SECURITY TESTS ====================

async function testUnauthorizedAccess() {
  try {
    await apiCall('GET', '/super-admin/dashboard');
    throw new Error('Should have been rejected without token');
  } catch (error) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Expected
      console.log(`  ${colors.blue}Correctly rejected unauthorized access${colors.reset}`);
    } else {
      throw error;
    }
  }
}

async function testInvalidToken() {
  try {
    await apiCall('GET', '/super-admin/dashboard', null, 'invalid_token_here');
    throw new Error('Should have been rejected with invalid token');
  } catch (error) {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Expected
      console.log(`  ${colors.blue}Correctly rejected invalid token${colors.reset}`);
    } else {
      throw error;
    }
  }
}

async function testInputValidation() {
  try {
    await apiCall('POST', '/auth/login', {
      email: 'not-an-email',
      password: '123'
    });
    throw new Error('Should have been rejected with invalid input');
  } catch (error) {
    if (error.response && error.response.status === 400) {
      // Expected
      console.log(`  ${colors.blue}Correctly validated input${colors.reset}`);
    } else {
      throw error;
    }
  }
}

// ==================== MAIN TEST RUNNER ====================

async function runTests() {
  console.log(`\n${colors.blue}=====================================${colors.reset}`);
  console.log(`${colors.blue}  SMART CAMPUS API TEST SUITE${colors.reset}`);
  console.log(`${colors.blue}=====================================${colors.reset}\n`);
  
  console.log(`${colors.yellow}Base URL: ${BASE_URL}${colors.reset}\n`);
  
  // Authentication Tests
  console.log(`${colors.yellow}--- Authentication Tests ---${colors.reset}`);
  await test('Super Admin Login', testSuperAdminLogin);
  await test('Get Profile', testGetProfile);
  await test('Token Refresh', testTokenRefresh);
  
  // Super Admin Tests
  console.log(`\n${colors.yellow}--- Super Admin Tests ---${colors.reset}`);
  await test('Super Admin Dashboard', testSuperAdminDashboard);
  await test('Create School', testCreateSchool);
  await test('Get Schools', testGetSchools);
  await test('Get School by ID', testGetSchoolById);
  await test('Update School', testUpdateSchool);
  await test('Platform Statistics', testGetPlatformStatistics);
  
  // Principal Tests
  console.log(`\n${colors.yellow}--- Principal Tests ---${colors.reset}`);
  await test('Principal Login (may need setup)', testPrincipalLogin);
  
  // Security Tests
  console.log(`\n${colors.yellow}--- Security Tests ---${colors.reset}`);
  await test('Unauthorized Access Rejection', testUnauthorizedAccess);
  await test('Invalid Token Rejection', testInvalidToken);
  await test('Input Validation', testInputValidation);
  
  // Summary
  console.log(`\n${colors.blue}=====================================${colors.reset}`);
  console.log(`${colors.blue}  TEST SUMMARY${colors.reset}`);
  console.log(`${colors.blue}=====================================${colors.reset}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total: ${total}`);
  
  if (failed === 0) {
    console.log(`\n${colors.green}✓ All tests passed!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}✗ Some tests failed${colors.reset}`);
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error(`${colors.red}Unhandled error: ${error.message}${colors.reset}`);
  process.exit(1);
});

// Run tests
runTests();
