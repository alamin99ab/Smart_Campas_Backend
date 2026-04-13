/**
 * First-request database bootstrap for empty production DBs (e.g. Render).
 * Waits for MongoDB, then runs scripts/bootstrap-seed seedDatabase() once.
 */

const mongoose = require('mongoose');

let bootstrapRunning = false;
let bootstrapDone = false;
let bootstrapPromise = null;

function bootLog(message) {
    if (process.env.NODE_ENV === 'production') {
        console.warn(`BOOTSTRAP: ${message}`);
    } else {
        console.log(`BOOTSTRAP: ${message}`);
    }
}

function bootError(message, err) {
    console.error(`BOOTSTRAP ERROR: ${message}`, err || '');
}

async function waitForMongoReady(timeoutMs = 60000) {
    if (mongoose.connection.readyState === 1) {
        return true;
    }

    const started = Date.now();

    return new Promise((resolve) => {
        const tick = () => {
            if (mongoose.connection.readyState === 1) {
                resolve(true);
                return;
            }
            if (Date.now() - started >= timeoutMs) {
                resolve(false);
                return;
            }
            setTimeout(tick, 50);
        };
        tick();
    });
}

async function runBootstrapJob() {
    bootLog('started');

    const mongoReady = await waitForMongoReady();
    if (!mongoReady) {
        bootError('MongoDB not ready after wait; will retry on a later request');
        return;
    }

    const School = require('../models/School');

    let schoolCount;
    try {
        schoolCount = await School.countDocuments();
    } catch (err) {
        bootError('failed to count schools', err);
        return;
    }

    if (schoolCount > 0) {
        bootLog(`DB not empty (${schoolCount} schools) — skipping seed`);
        bootLog('skipped (already has data)');
        bootstrapDone = true;
        return;
    }

    bootLog('DB empty — seeding...');

    const { seedDatabase } = require('../scripts/bootstrap-seed');

    bootLog('seed started');
    try {
        await seedDatabase();
        bootLog('seed completed');
        bootLog('DONE');
        bootstrapDone = true;
    } catch (err) {
        bootError('seed failed', err);
    }
}

function databaseBootstrapMiddleware(req, res, next) {
    if (req.method === 'OPTIONS') {
        return next();
    }

    if (bootstrapDone) {
        return next();
    }

    if (bootstrapPromise) {
        return bootstrapPromise.then(() => next()).catch(() => next());
    }

    if (bootstrapRunning) {
        return next();
    }

    bootstrapRunning = true;
    bootstrapPromise = runBootstrapJob().finally(() => {
        bootstrapRunning = false;
        bootstrapPromise = null;
    });

    return bootstrapPromise.then(() => next()).catch(() => next());
}

module.exports = {
    databaseBootstrapMiddleware
};
