const axios = require('axios');

const baseUrl = process.env.DEPLOY_URL || 'https://smart-campas-backend.onrender.com';
const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'alamin-admin@pandait.com';
const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'pandaitalaminn';

async function main() {
    console.log('🔍 Starting smoke tests on', baseUrl);

    const checks = [
        { method: 'get', path: '/api/health' },
        { method: 'get', path: '/api' }
    ];

    for (const check of checks) {
        try {
            const res = await axios({ method: check.method, url: baseUrl + check.path, timeout: 15000 });
            console.log(`✅ ${check.method.toUpperCase()} ${check.path} [${res.status}]`);
        } catch (error) {
            console.error(`❌ ${check.method.toUpperCase()} ${check.path} failed`, error.response ? error.response.status : error.message);
            process.exit(1);
        }
    }

    // auth login
    let token;
    try {
        const loginResp = await axios.post(`${baseUrl}/api/auth/login`, { email: adminEmail, password: adminPassword }, { timeout: 15000 });
        if (!(loginResp.data && loginResp.data.success && loginResp.data.data && loginResp.data.data.token)) {
            throw new Error('login response missing token');
        }
        token = loginResp.data.data.token;
        console.log('✅ Super admin login successful');
    } catch (error) {
        console.error('❌ Super admin login failed', error.response ? error.response.status : error.message);
        process.exit(1);
    }

    const authHeaders = { Authorization: `Bearer ${token}` };
    const authChecks = [
        { method: 'get', path: '/api/super-admin/dashboard' },
        { method: 'get', path: '/api/super-admin/statistics' },
        { method: 'get', path: '/api/super-admin/schools' }
    ];

    for (const check of authChecks) {
        try {
            const res = await axios({ method: check.method, url: baseUrl + check.path, headers: authHeaders, timeout: 15000 });
            console.log(`✅ ${check.method.toUpperCase()} ${check.path} [${res.status}]`);
        } catch (error) {
            console.error(`❌ ${check.method.toUpperCase()} ${check.path} failed`, error.response ? error.response.status : error.message);
            process.exit(1);
        }
    }

    console.log('\n✅ Smoke tests passed. Production APIs are responsive.');
}

main().catch((error) => {
    console.error('❌ Smoke test script crashed:', error.stack || error.message);
    process.exit(1);
});
