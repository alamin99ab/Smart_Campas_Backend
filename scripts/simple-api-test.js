/**
 * 🧪 SIMPLE API TESTING SCRIPT
 * Tests existing APIs without enhanced middleware dependencies
 */

const http = require('http');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_RESULTS = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
};

/**
 * Simple HTTP request function
 */
function makeRequest(method, endpoint, data = null, headers = {}) {
    return new Promise((resolve) => {
        const url = new URL(endpoint, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 80,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'x-device-id': 'test-device-123',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const data = body ? JSON.parse(body) : {};
                    resolve({
                        success: true,
                        status: res.statusCode,
                        data,
                        headers: res.headers
                    });
                } catch (e) {
                    resolve({
                        success: false,
                        status: res.statusCode,
                        error: 'Invalid JSON response',
                        data: body
                    });
                }
            });
        });

        req.on('error', (error) => {
            resolve({
                success: false,
                status: 0,
                error: error.message
            });
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

/**
 * Test and analyze response
 */
async function testAPI(name, method, endpoint, data = null, headers = {}, expectedStatus = 200) {
    console.log(`🧪 Testing: ${name}`);
    
    const startTime = Date.now();
    const result = await makeRequest(method, endpoint, data, headers);
    const responseTime = Date.now() - startTime;
    
    const testResult = {
        name,
        method,
        endpoint,
        status: result.status,
        expectedStatus,
        success: result.success && result.status === expectedStatus,
        responseTime,
        issues: [],
        recommendations: []
    };
    
    // Analyze results
    if (result.status !== expectedStatus) {
        testResult.issues.push(`Status ${result.status} (expected ${expectedStatus})`);
    }
    
    if (responseTime > 2000) {
        testResult.issues.push(`Slow response: ${responseTime}ms`);
        testResult.recommendations.push('Optimize performance');
    }
    
    if (result.success && result.data) {
        // Check response format
        if (!result.data.hasOwnProperty('success')) {
            testResult.issues.push('Missing success field');
            testResult.recommendations.push('Add success field');
        }
        
        // Check for sensitive data
        const responseStr = JSON.stringify(result.data);
        if (responseStr.includes('password') || responseStr.includes('token')) {
            testResult.issues.push('Potential sensitive data exposure');
            testResult.recommendations.push('Remove sensitive data');
        }
    }
    
    TEST_RESULTS.total++;
    if (testResult.success) {
        TEST_RESULTS.passed++;
        console.log(`   ✅ ${name} - ${responseTime}ms`);
    } else {
        TEST_RESULTS.failedTests++;
        console.log(`   ❌ ${name} - ${testResult.issues.join(', ')}`);
        if (result.error) {
            console.log(`      Error: ${result.error}`);
        }
    }
    
    TEST_RESULTS.details.push(testResult);
    return testResult;
}

/**
 * Run all API tests
 */
async function runAllTests() {
    console.log('🚀 Starting Simple API Testing...\n');
    
    try {
        // Public endpoints
        console.log('🌍 Public APIs:');
        await testAPI('Health Check', 'GET', '/api/health');
        
        // Authentication endpoints
        console.log('\n🔐 Authentication APIs:');
        await testAPI('Super Admin Login', 'POST', '/api/super-admin/login', {
            email: 'superadmin@smartcampus.com',
            password: 'SuperAdmin@2026'
        });
        
        await testAPI('Invalid Login', 'POST', '/api/super-admin/login', {
            email: 'invalid@test.com',
            password: 'wrong'
        }, {}, 401);
        
        // Test with the token from successful login
        const loginResult = TEST_RESULTS.details.find(r => r.name === 'Super Admin Login');
        let token = null;
        
        if (loginResult && loginResult.success && loginResult.status === 200) {
            token = loginResult.data?.data?.token || loginResult.data?.token;
            
            if (token) {
                console.log('\n👑 Super Admin Protected APIs:');
                
                // Test protected endpoints
                await testAPI('Dashboard', 'GET', '/api/super-admin/dashboard', null, {
                    'Authorization': `Bearer ${token}`
                });
                
                await testAPI('System Settings', 'GET', '/api/super-admin/system-settings', null, {
                    'Authorization': `Bearer ${token}`
                });
                
                await testAPI('Users List', 'GET', '/api/super-admin/users', null, {
                    'Authorization': `Bearer ${token}`
                });
                
                await testAPI('Schools List', 'GET', '/api/super-admin/schools', null, {
                    'Authorization': `Bearer ${token}`
                });
                
                await testAPI('Analytics', 'GET', '/api/super-admin/analytics', null, {
                    'Authorization': `Bearer ${token}`
                });
                
                await testAPI('Audit Logs', 'GET', '/api/super-admin/audit-logs', null, {
                    'Authorization': `Bearer ${token}`
                });
                
                // Test unauthorized access
                console.log('\n🛡️ Security Tests:');
                await testAPI('Unauthorized Access', 'GET', '/api/super-admin/dashboard', null, {}, 401);
                
                await testAPI('Invalid Token', 'GET', '/api/super-admin/dashboard', null, {
                    'Authorization': 'Bearer invalid-token'
                }, 401);
            }
        }
        
        // Generate summary
        console.log('\n' + '='.repeat(50));
        console.log('📊 API TESTING SUMMARY');
        console.log('='.repeat(50));
        
        const successRate = ((TEST_RESULTS.passed / TEST_RESULTS.total) * 100).toFixed(2);
        console.log(`Total Tests: ${TEST_RESULTS.total}`);
        console.log(`Passed: ${TEST_RESULTS.passed}`);
        console.log(`Failed: ${TEST_RESULTS.failed}`);
        console.log(`Success Rate: ${successRate}%`);
        
        // Analyze common issues
        const allIssues = TEST_RESULTS.details.flatMap(d => d.issues);
        const issueCounts = {};
        allIssues.forEach(issue => {
            issueCounts[issue] = (issueCounts[issue] || 0) + 1;
        });
        
        console.log('\n🔍 Common Issues:');
        Object.entries(issueCounts).forEach(([issue, count]) => {
            console.log(`   ${issue}: ${count} times`);
        });
        
        // Recommendations
        console.log('\n🎯 Recommendations:');
        const recommendations = [
            'Add consistent response format with success field',
            'Implement proper error handling with descriptive messages',
            'Add input validation to all endpoints',
            'Implement rate limiting for security',
            'Add comprehensive API documentation',
            'Remove sensitive data from responses',
            'Optimize slow endpoints (>2000ms)',
            'Add security headers (CORS, CSP, etc.)'
        ];
        
        recommendations.forEach(rec => console.log(`   ✅ ${rec}`));
        
        // Save detailed report
        const report = {
            summary: {
                total: TEST_RESULTS.total,
                passed: TEST_RESULTS.passed,
                failed: TEST_RESULTS.failed,
                successRate: successRate + '%'
            },
            details: TEST_RESULTS.details,
            commonIssues: issueCounts,
            recommendations,
            testedAt: new Date().toISOString()
        };
        
        require('fs').writeFileSync(
            'simple-api-test-report.json',
            JSON.stringify(report, null, 2)
        );
        
        console.log('\n📁 Detailed report saved to: simple-api-test-report.json');
        
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
    }
}

// Run tests
if (require.main === module) {
    runAllTests();
}

module.exports = { runAllTests, testAPI };
