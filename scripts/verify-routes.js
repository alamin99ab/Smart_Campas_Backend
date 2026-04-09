/**
 * Lightweight route verification script.
 * Ensures every route module can be required and exports an Express router.
 */
const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '..', 'routes');
const routeFiles = fs.readdirSync(routesDir).filter((file) => file.endsWith('.js'));

let failures = 0;

for (const file of routeFiles) {
    const fullPath = path.join(routesDir, file);

    try {
        const exported = require(fullPath);
        const router = exported && exported.stack ? exported : exported?.router;
        const isRouter = Boolean(router && Array.isArray(router.stack));

        if (!isRouter) {
            failures += 1;
            console.error(`[FAIL] ${file} does not export an Express router`);
            continue;
        }

        console.log(`[OK] ${file}`);
    } catch (error) {
        failures += 1;
        console.error(`[FAIL] ${file}: ${error.message}`);
    }
}

if (failures > 0) {
    console.error(`\nRoute verification failed (${failures} issue${failures === 1 ? '' : 's'})`);
    process.exit(1);
}

console.log(`\nRoute verification passed (${routeFiles.length} files checked)`);
