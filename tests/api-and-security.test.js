/**
 * Smart Campus API & Security Test Suite
 * Run: node tests/api-and-security.test.js (server must be running)
 */
const BASE = process.env.API_BASE || 'http://localhost:5000';

const log = (label, ok, detail = '') => {
  const status = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`  ${status} ${label}${detail ? ' - ' + detail : ''}`);
};

const DEVICE_ID = 'test-device-' + Date.now();

async function request(method, path, body = null, token = null, headers = {}) {
  const url = BASE + path;
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': DEVICE_ID,
      ...headers
    }
  };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = text;
  }
  return { status: res.status, data, headers: res.headers };
}

async function runSecurityTests() {
  console.log('\n--- Security Tests ---\n');

  const invalidToken = await request('GET', '/api/auth/profile', null, 'invalid.jwt.token');
  log('Invalid JWT rejected', invalidToken.status === 401);

  const expiredToken = await request('GET', '/api/auth/profile', null, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQiLCJleHAiOjB9.x');
  log('Expired/malformed JWT rejected', expiredToken.status === 401);

  const noAuth = await request('GET', '/api/dashboard');
  log('Protected route without token returns 401', noAuth.status === 401);

  const noAuthStudents = await request('GET', '/api/students');
  log('Students list without token returns 401', noAuthStudents.status === 401);

  const mongoInjection = await request('POST', '/api/auth/login', {
    email: { $gt: '' },
    password: 'x'
  });
  log('NoSQL injection in body rejected or sanitized', mongoInjection.status === 400 || mongoInjection.status === 401);

  const xssAttempt = await request('POST', '/api/auth/login', {
    email: '<script>alert(1)</script>@test.com',
    password: 'x'
  });
  log('XSS in input does not break API', xssAttempt.status === 400 || xssAttempt.status === 401);

  const protoPollution = await request('POST', '/api/auth/register', {
    name: 'Test',
    email: 'proto@test.com',
    password: 'password123',
    role: 'student',
    schoolCode: 'SC1',
    __proto__: { admin: true }
  });
  log('Prototype pollution rejected', protoPollution.status === 400 || protoPollution.status === 401);

  const healthNoLeak = await request('GET', '/api/health');
  const hasStack = healthNoLeak.data && (healthNoLeak.data.stack || healthNoLeak.data.message?.includes('stack'));
  log('Health endpoint does not leak stack', !hasStack);
}

async function runApiTests() {
  console.log('\n--- API Tests (Auth + Dashboard + New Features) ---\n');

  let token = null;
  let refreshToken = null;

  const registerBody = {
    name: 'SaaS Test User',
    email: 'saastest' + Date.now() + '@test.com',
    password: 'SecurePass123!',
    role: 'principal',
    schoolName: 'SaaS Test School',
    schoolCode: 'SAAS' + Date.now(),
    phone: '+1234567890'
  };

  const reg = await request('POST', '/api/auth/register', registerBody);
  const registerOk = reg.status === 201 && reg.data?.token != null;
  log('POST /api/auth/register', registerOk);
  if (registerOk) {
    token = reg.data.token;
    refreshToken = reg.data.refreshToken;
  }

  if (registerOk && registerBody.email) {
    const loginRes = await request('POST', '/api/auth/login', {
      email: registerBody.email,
      password: registerBody.password
    });
    log('POST /api/auth/login', loginRes.status === 200 && loginRes.data?.token != null);
    if (loginRes.status === 200) token = loginRes.data.token;
  }

  if (token) {
    const root = await request('GET', '/');
    log('GET / (root)', root.status === 200 && root.data?.success === true);

    const health = await request('GET', '/api/health');
    log('GET /api/health', health.status === 200 && health.data?.database != null);

    const profile = await request('GET', '/api/auth/profile', null, token);
    log('GET /api/auth/profile', profile.status === 200);

    const dashboard = await request('GET', '/api/dashboard', null, token);
    log('GET /api/dashboard', dashboard.status === 200 && dashboard.data?.data?.stats != null);

    const notifications = await request('GET', '/api/notifications', null, token);
    log('GET /api/notifications', notifications.status === 200);

    const unreadCount = await request('GET', '/api/notifications/unread-count', null, token);
    log('GET /api/notifications/unread-count', unreadCount.status === 200);

    const events = await request('GET', '/api/events', null, token);
    log('GET /api/events', events.status === 200);

    const createEvent = await request('POST', '/api/events', {
      title: 'Test Exam',
      type: 'exam',
      startDate: new Date(Date.now() + 86400000).toISOString(),
      allDay: true
    }, token);
    log('POST /api/events', createEvent.status === 201);

    const activity = await request('GET', '/api/activity', null, token);
    log('GET /api/activity (principal)', activity.status === 200);

    const analytics = await request('GET', '/api/analytics/overview', null, token);
    log('GET /api/analytics/overview', analytics.status === 200);

    const search = await request('GET', '/api/search?q=test&limit=5', null, token);
    log('GET /api/search', search.status === 200 && search.data?.data != null);

    const publicSchool = await request('GET', '/api/public/school/' + (registerBody.schoolCode || 'SAAS1'));
    log('GET /api/public/school/:code', publicSchool.status === 200 || publicSchool.status === 404);

    const refresh = await request('POST', '/api/auth/refresh-token', { refreshToken }, token);
    log('POST /api/auth/refresh-token', refresh.status === 200);

    const logout = await request('POST', '/api/auth/logout', { refreshToken }, token);
    log('POST /api/auth/logout', logout.status === 200);
  }

  const notFound = await request('GET', '/api/not-found');
  log('404 returns success: false', notFound.status === 404 && notFound.data?.success === false);
}

async function checkServer() {
  try {
    const r = await request('GET', '/api/health');
    return r.status === 200 || r.status === 503;
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log('\n========================================');
  console.log('  Smart Campus - API & Security Tests');
  console.log('========================================');
  try {
    const ok = await checkServer();
    if (!ok) {
      console.log('\n  Server not reachable at', BASE);
      console.log('  Start it with: npm start\n');
      process.exit(1);
    }
    await runSecurityTests();
    await runApiTests();
    console.log('\n========================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\nTest run failed:', err.message);
    process.exit(1);
  }
}

main();
