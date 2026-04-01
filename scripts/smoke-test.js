const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

const check = async (method, endpoint, expectedStatus) => {
  try {
    const options = { method, url: `${BASE_URL}${endpoint}`, timeout: 10000 };
    if (method === 'POST') options.data = { email: 'test@retry.com', password: 'badpass' };
    const response = await axios(options);
    console.log(`✅ ${method} ${endpoint} -> ${response.status}`);
    return response;
  } catch (err) {
    if (err.response) {
      console.log(`⚠ ${method} ${endpoint} -> ${err.response.status} (${err.response.data?.message || err.response.data || 'no message'})`);
      if (expectedStatus.includes(err.response.status)) return err.response;
      throw err;
    }
    console.error(`❌ ${method} ${endpoint} failed:`, err.message);
    throw err;
  }
};

(async () => {
  console.log('Starting quick smoke tests...');

  await check('POST', '/api/auth/login', [400, 401]);
  await check('POST', '/api/auth/register', [400, 403]);
  await check('GET', '/api/super-admin/statistics', [401, 403, 200]);
  await check('GET', '/api/super-admin/dashboard', [401, 403, 200]);

  console.log('✅ Smoke tests completed. If all checks returned expected statuses, routes are reachable.');
})().catch((err) => {
  console.error('Smoke test failure:', err.stack || err.message);
  process.exit(1);
});
