/**
 * Start server with TEST_MODE=1 (no MongoDB) for API testing.
 * Usage: node scripts/run-server-for-test.js
 */
process.env.TEST_MODE = '1';
require('../index.js');
