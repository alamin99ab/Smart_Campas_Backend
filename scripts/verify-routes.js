const path = require('path');
const modulesToCheck = [
  './routes/auth',
  './routes/superAdmin',
  './controllers/authController',
  './controllers/superAdminController'
];

console.log('Starting route import verification...');
let failed = false;

modulesToCheck.forEach((modPath) => {
  try {
    const resolved = path.resolve(__dirname, '..', modPath);
    require(resolved);
    console.log(`✅ Loaded: ${modPath}`);
  } catch (err) {
    failed = true;
    console.error(`❌ Failed to load: ${modPath}`);
    console.error(err.stack || err);
  }
});

if (failed) {
  console.error('Route import verification failed. Fix syntax errors before deploy.');
  process.exit(1);
}

console.log('✅ Route import verification passed.');
