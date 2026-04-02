const path = require('path');

const routePaths = [
    'routes/auth',
    'routes/superAdmin',
    'routes/principal',
    'controllers/authController',
    'controllers/superAdminController',
    'controllers/principalController',
    'middleware/authMiddleware',
    'middleware/multiTenant'
];

let failCount = 0;
console.log('🔍 Verifying route/controller module imports...');

routePaths.forEach((p) => {
    try {
        require(path.resolve(__dirname, '..', p));
        console.log(`✅ ${p} loaded successfully`);
    } catch (error) {
        failCount += 1;
        console.error(`❌ Failed to load ${p}:`, error.stack || error.message || error);
    }
});

if (failCount > 0) {
    console.error(`\n✖ ${failCount} module imports failed.`);
    process.exit(1);
}

console.log('\n✅ verify-routes passed. No syntax/import errors.');
