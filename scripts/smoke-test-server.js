/**
 * Start server with TEST_MODE and hit /api/health after 3s (smoke test).
 */
process.env.TEST_MODE = '1';
require('../index.js');

const http = require('http');
setTimeout(() => {
  http.get('http://localhost:5000/api/health', (res) => {
    let d = '';
    res.on('data', (c) => d += c);
    res.on('end', () => {
      console.log('HEALTH STATUS:', res.statusCode);
      console.log('BODY:', d);
      process.exit(0);
    });
  }).on('error', (e) => {
    console.error('REQUEST ERROR:', e.message);
    process.exit(1);
  });
}, 3000);
