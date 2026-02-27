/**
 * 🧪 IMPROVED API TESTING SCRIPT
 * Tests all APIs with enhanced error handling and detailed analysis
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const TEST_RESULTS = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    categories: {
        authentication: { passed: 0, failed: 0, tests: [] },
        superAdmin: { passed: 0, failed: 0, tests: [] },
        public: { passed: 0, failed: 0, tests: [] },
        security: { passed: 0, failed: 0, tests: [] }
    },
    performance: [],
    security: [],
    improvements: []
};

// Test data
const testCredentials = {
    superAdmin: {
        email: 'superadmin@smartcampus.com',
        password: 'SuperAdmin@2026'
    }
};

let authTokens = {
    superAdmin: null
};

/**
 * Enhanced HTTP client with better error handling
 */
class APITester {
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.client = axios.create({
            timeout: 10000,
            validateStatus: () => true // Don't throw on HTTP errors
        });
    }

    async request(method, endpoint, data = null, headers = {}, token = null) {
        const startTime = Date.now();
        
        try {
            const config = {
                method,
                url: `${this.baseURL}${endpoint}`,
                headers: {
                    'Content-Type': 'application/json',
                    'x-device-id': 'test-device-123',
                    'User-Agent': 'SmartCampus-API-Tester/1.0',
                    ...headers
                }
            };

            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }

            if (data) {
                config.data = data;
            }

            const response = await this.client.request(config);
            const responseTime = Date.now() - startTime;

            return {
                success: true,
                status: response.status,
                data: response.data,
                responseTime,
                headers: response.headers,
                config
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            return {
                success: false,
                status: error.response?.status || 0,
                error: error.message,
                data: error.response?.data || null,
                responseTime,
                config: error.config
            };
        }
    }

    analyzeResponse(testName, result, category, expectedStatus = 200) {
        const analysis = {
            testName,
            category,
            endpoint: result.config?.url || 'unknown',
            method: result.config?.method || 'GET',
            status: result.status,
            expectedStatus,
            success: result.success && result.status === expectedStatus,
            responseTime: result.responseTime,
            dataSize: JSON.stringify(result.data || {}).length,
            issues: [],
            recommendations: [],
            security: [],
            performance: []
        };

        // Status code analysis
        if (result.status !== expectedStatus) {
            analysis.issues.push(`Status ${result.status} (expected ${expectedStatus})`);
        }

        // Response time analysis
        if (result.responseTime > 2000) {
            analysis.issues.push(`Slow: ${result.responseTime}ms`);
            analysis.recommendations.push('Optimize queries or add caching');
            analysis.performance.push(`Response time ${result.responseTime}ms exceeds 2000ms threshold`);
        }

        // Response format analysis
        if (result.success && result.data) {
            // Check for standard response format
            if (!result.data.hasOwnProperty('success')) {
                analysis.issues.push('Missing success field');
                analysis.recommendations.push('Add success field to all responses');
            }

            // Check for data consistency
            if (result.data.success === true && !result.data.hasOwnProperty('data') && !result.data.hasOwnProperty('message')) {
                analysis.issues.push('Success response missing data or message');
                analysis.recommendations.push('Include data or message in success responses');
            }

            // Security check - sensitive data exposure
            const responseStr = JSON.stringify(result.data);
            const sensitivePatterns = [
                /password/i,
                /token/i,
                /secret/i,
                /key/i,
                /credential/i
            ];

            sensitivePatterns.forEach(pattern => {
                if (pattern.test(responseStr)) {
                    analysis.security.push(`Potential sensitive data exposure: ${pattern.source}`);
                    analysis.recommendations.push('Remove sensitive data from API responses');
                }
            });
        }

        // Error response analysis
        if (!result.success) {
            if (!result.data || !result.data.message) {
                analysis.issues.push('Error response missing descriptive message');
                analysis.recommendations.push('Add descriptive error messages');
            }

            // Check for information disclosure in errors
            if (result.status >= 500) {
                analysis.security.push('Server error may expose internal information');
                analysis.recommendations.push('Sanitize error messages in production');
            }
        }

        // HTTP security headers check (if available)
        if (result.headers) {
            const securityHeaders = [
                'x-content-type-options',
                'x-frame-options',
                'x-xss-protection',
                'strict-transport-security'
            ];

            securityHeaders.forEach(header => {
                if (!result.headers[header]) {
                    analysis.security.push(`Missing security header: ${header}`);
                    analysis.recommendations.push(`Add ${header} security header`);
                }
            });
        }

        return analysis;
    }
}

const tester = new APITester(BASE_URL);

/**
 * Test public endpoints
 */
async function testPublicAPIs() {
    console.log('🌍 Testing Public APIs...');
    
    const publicTests = [
        {
            name: 'Health Check',
            method: 'GET',
            endpoint: '/api/health',
            expectedStatus: 200
        },
        {
            name: 'API Documentation',
            method: 'GET',
            endpoint: '/api-docs/',
            expectedStatus: 200
        }
    ];

    for (const test of publicTests) {
        console.log(`  🧪 ${test.name}`);
        const result = await tester.request(test.method, test.endpoint);
        const analysis = tester.analyzeResponse(test.name, result, 'public', test.expectedStatus);
        
        TEST_RESULTS.categories.public.tests.push(analysis);
        TEST_RESULTS.totalTests++;
        
        if (analysis.success) {
            TEST_RESULTS.categories.public.passed++;
            TEST_RESULTS.passedTests++;
            console.log(`    ✅ ${test.name} - ${result.responseTime}ms`);
        } else {
            TEST_RESULTS.categories.public.failed++;
            TEST_RESULTS.failedTests++;
            console.log(`    ❌ ${test.name} - ${analysis.issues.join(', ')}`);
        }

        // Collect security and performance issues
        TEST_RESULTS.security.push(...analysis.security);
        TEST_RESULTS.performance.push(...analysis.performance);
    }
}

/**
 * Test authentication endpoints
 */
async function testAuthAPIs() {
    console.log('🔐 Testing Authentication APIs...');
    
    const authTests = [
        {
            name: 'Super Admin Login',
            method: 'POST',
            endpoint: '/api/super-admin/login',
            data: testCredentials.superAdmin,
            expectedStatus: 200
        },
        {
            name: 'Invalid Login',
            method: 'POST',
            endpoint: '/api/super-admin/login',
            data: { email: 'invalid@test.com', password: 'wrong' },
            expectedStatus: 401
        },
        {
            name: 'Missing Credentials',
            method: 'POST',
            endpoint: '/api/super-admin/login',
            data: {},
            expectedStatus: 400
        }
    ];

    for (const test of authTests) {
        console.log(`  🧪 ${test.name}`);
        const result = await tester.request(test.method, test.endpoint, test.data);
        const analysis = tester.analyzeResponse(test.name, result, 'authentication', test.expectedStatus);
        
        TEST_RESULTS.categories.authentication.tests.push(analysis);
        TEST_RESULTS.totalTests++;
        
        if (analysis.success) {
            TEST_RESULTS.categories.authentication.passed++;
            TEST_RESULTS.passedTests++;
            console.log(`    ✅ ${test.name} - ${result.responseTime}ms`);
            
            // Store token for authenticated tests
            if (test.name === 'Super Admin Login' && result.success && result.data.data?.token) {
                authTokens.superAdmin = result.data.data.token;
                console.log('    🔑 Super Admin token obtained');
            }
        } else {
            TEST_RESULTS.categories.authentication.failed++;
            TEST_RESULTS.failedTests++;
            console.log(`    ❌ ${test.name} - ${analysis.issues.join(', ')}`);
        }

        TEST_RESULTS.security.push(...analysis.security);
        TEST_RESULTS.performance.push(...analysis.performance);
    }
}

/**
 * Test super admin protected endpoints
 */
async function testSuperAdminAPIs() {
    console.log('👑 Testing Super Admin APIs...');
    
    if (!authTokens.superAdmin) {
        console.log('  ⚠️ Skipping Super Admin tests - no authentication token');
        return;
    }

    const superAdminTests = [
        {
            name: 'Dashboard',
            method: 'GET',
            endpoint: '/api/super-admin/dashboard',
            expectedStatus: 200
        },
        {
            name: 'System Settings',
            method: 'GET',
            endpoint: '/api/super-admin/system-settings',
            expectedStatus: 200
        },
        {
            name: 'Users List',
            method: 'GET',
            endpoint: '/api/super-admin/users',
            expectedStatus: 200
        },
        {
            name: 'Schools List',
            method: 'GET',
            endpoint: '/api/super-admin/schools',
            expectedStatus: 200
        },
        {
            name: 'Analytics',
            method: 'GET',
            endpoint: '/api/super-admin/analytics',
            expectedStatus: 200
        },
        {
            name: 'Audit Logs',
            method: 'GET',
            endpoint: '/api/super-admin/audit-logs',
            expectedStatus: 200
        }
    ];

    for (const test of superAdminTests) {
        console.log(`  🧪 ${test.name}`);
        const result = await tester.request(test.method, test.endpoint, null, {}, authTokens.superAdmin);
        const analysis = tester.analyzeResponse(test.name, result, 'superAdmin', test.expectedStatus);
        
        TEST_RESULTS.categories.superAdmin.tests.push(analysis);
        TEST_RESULTS.totalTests++;
        
        if (analysis.success) {
            TEST_RESULTS.categories.superAdmin.passed++;
            TEST_RESULTS.passedTests++;
            console.log(`    ✅ ${test.name} - ${result.responseTime}ms`);
        } else {
            TEST_RESULTS.categories.superAdmin.failed++;
            TEST_RESULTS.failedTests++;
            console.log(`    ❌ ${test.name} - ${analysis.issues.join(', ')}`);
        }

        TEST_RESULTS.security.push(...analysis.security);
        TEST_RESULTS.performance.push(...analysis.performance);
    }
}

/**
 * Test security endpoints
 */
async function testSecurityAPIs() {
    console.log('🛡️ Testing Security Features...');
    
    const securityTests = [
        {
            name: 'Rate Limiting Test',
            method: 'GET',
            endpoint: '/api/health',
            expectedStatus: 200,
            rapidFire: true // Special flag for rate limiting test
        },
        {
            name: 'Unauthorized Access',
            method: 'GET',
            endpoint: '/api/super-admin/dashboard',
            expectedStatus: 401
        },
        {
            name: 'Invalid Token',
            method: 'GET',
            endpoint: '/api/super-admin/dashboard',
            expectedStatus: 401,
            headers: { 'Authorization': 'Bearer invalid-token' }
        }
    ];

    for (const test of securityTests) {
        console.log(`  🧪 ${test.name}`);
        
        if (test.rapidFire) {
            // Test rate limiting with multiple rapid requests
            const rapidResults = [];
            for (let i = 0; i < 10; i++) {
                const result = await tester.request(test.method, test.endpoint);
                rapidResults.push(result);
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const rateLimited = rapidResults.some(r => r.status === 429);
            const analysis = {
                testName: test.name,
                category: 'security',
                endpoint: test.endpoint,
                method: test.method,
                status: rateLimited ? 429 : 200,
                expectedStatus: 429,
                success: rateLimited,
                responseTime: Math.max(...rapidResults.map(r => r.responseTime)),
                issues: rateLimited ? [] : ['Rate limiting not working'],
                recommendations: rateLimited ? [] : ['Implement rate limiting'],
                security: rateLimited ? [] : ['Missing rate limiting protection'],
                performance: []
            };
            
            TEST_RESULTS.categories.security.tests.push(analysis);
            TEST_RESULTS.totalTests++;
            
            if (analysis.success) {
                TEST_RESULTS.categories.security.passed++;
                TEST_RESULTS.passedTests++;
                console.log(`    ✅ ${test.name} - Rate limiting working`);
            } else {
                TEST_RESULTS.categories.security.failed++;
                TEST_RESULTS.failedTests++;
                console.log(`    ❌ ${test.name} - ${analysis.issues.join(', ')}`);
            }
        } else {
            const result = await tester.request(test.method, test.endpoint, null, test.headers);
            const analysis = tester.analyzeResponse(test.name, result, 'security', test.expectedStatus);
            
            TEST_RESULTS.categories.security.tests.push(analysis);
            TEST_RESULTS.totalTests++;
            
            if (analysis.success) {
                TEST_RESULTS.categories.security.passed++;
                TEST_RESULTS.passedTests++;
                console.log(`    ✅ ${test.name} - ${result.responseTime}ms`);
            } else {
                TEST_RESULTS.categories.security.failed++;
                TEST_RESULTS.failedTests++;
                console.log(`    ❌ ${test.name} - ${analysis.issues.join(', ')}`);
            }
        }
    }
}

/**
 * Generate comprehensive report
 */
function generateReport() {
    const report = {
        summary: {
            totalTests: TEST_RESULTS.totalTests,
            passedTests: TEST_RESULTS.passedTests,
            failedTests: TEST_RESULTS.failedTests,
            successRate: ((TEST_RESULTS.passedTests / TEST_RESULTS.totalTests) * 100).toFixed(2) + '%',
            categories: {
                authentication: {
                    total: TEST_RESULTS.categories.authentication.passed + TEST_RESULTS.categories.authentication.failed,
                    passed: TEST_RESULTS.categories.authentication.passed,
                    failed: TEST_RESULTS.categories.authentication.failed,
                    rate: ((TEST_RESULTS.categories.authentication.passed / (TEST_RESULTS.categories.authentication.passed + TEST_RESULTS.categories.authentication.failed)) * 100).toFixed(2) + '%'
                },
                superAdmin: {
                    total: TEST_RESULTS.categories.superAdmin.passed + TEST_RESULTS.categories.superAdmin.failed,
                    passed: TEST_RESULTS.categories.superAdmin.passed,
                    failed: TEST_RESULTS.categories.superAdmin.failed,
                    rate: ((TEST_RESULTS.categories.superAdmin.passed / (TEST_RESULTS.categories.superAdmin.passed + TEST_RESULTS.categories.superAdmin.failed)) * 100).toFixed(2) + '%'
                },
                public: {
                    total: TEST_RESULTS.categories.public.passed + TEST_RESULTS.categories.public.failed,
                    passed: TEST_RESULTS.categories.public.passed,
                    failed: TEST_RESULTS.categories.public.failed,
                    rate: ((TEST_RESULTS.categories.public.passed / (TEST_RESULTS.categories.public.passed + TEST_RESULTS.categories.public.failed)) * 100).toFixed(2) + '%'
                },
                security: {
                    total: TEST_RESULTS.categories.security.passed + TEST_RESULTS.categories.security.failed,
                    passed: TEST_RESULTS.categories.security.passed,
                    failed: TEST_RESULTS.categories.security.failed,
                    rate: ((TEST_RESULTS.categories.security.passed / (TEST_RESULTS.categories.security.passed + TEST_RESULTS.categories.security.failed)) * 100).toFixed(2) + '%'
                }
            }
        },
        securityIssues: [...new Set(TEST_RESULTS.security)], // Remove duplicates
        performanceIssues: [...new Set(TEST_RESULTS.performance)], // Remove duplicates
        recommendations: generateRecommendations(),
        testedAt: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        apiURL: BASE_URL
    };

    // Save detailed report
    const reportPath = path.join(__dirname, '../api-test-report-detailed.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return report;
}

/**
 * Generate improvement recommendations
 */
function generateRecommendations() {
    const recommendations = [];
    
    // Security recommendations
    if (TEST_RESULTS.security.length > 0) {
        recommendations.push({
            category: 'Security',
            priority: 'High',
            issues: [...new Set(TEST_RESULTS.security)],
            actions: [
                'Implement comprehensive input validation',
                'Add rate limiting to all endpoints',
                'Sanitize error messages in production',
                'Add security headers (CSP, HSTS, XSS Protection)',
                'Implement proper CORS configuration',
                'Add API authentication to all protected endpoints'
            ]
        });
    }
    
    // Performance recommendations
    if (TEST_RESULTS.performance.length > 0) {
        recommendations.push({
            category: 'Performance',
            priority: 'Medium',
            issues: [...new Set(TEST_RESULTS.performance)],
            actions: [
                'Add database query optimization',
                'Implement response caching',
                'Add pagination to list endpoints',
                'Compress API responses',
                'Add CDN for static assets'
            ]
        });
    }
    
    // General recommendations
    recommendations.push({
        category: 'API Quality',
        priority: 'High',
        issues: ['Inconsistent response formats', 'Missing error handling'],
        actions: [
            'Standardize response format across all endpoints',
            'Add comprehensive error handling middleware',
            'Implement API versioning',
            'Add request/response logging',
            'Create comprehensive API documentation',
            'Add input validation to all endpoints',
            'Implement proper HTTP status codes'
        ]
    });
    
    return recommendations;
}

/**
 * Run comprehensive API tests
 */
async function runComprehensiveTests() {
    console.log('🚀 Starting Comprehensive API Testing...\n');
    console.log(`🌐 Testing API at: ${BASE_URL}\n`);
    
    try {
        await testPublicAPIs();
        await testAuthAPIs();
        await testSuperAdminAPIs();
        await testSecurityAPIs();
        
        const report = generateReport();
        
        // Display summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 COMPREHENSIVE API TESTING REPORT');
        console.log('='.repeat(60));
        
        console.log(`\n📈 OVERALL SUMMARY:`);
        console.log(`   Total Tests: ${report.summary.totalTests}`);
        console.log(`   Passed: ${report.summary.passedTests}`);
        console.log(`   Failed: ${report.summary.failedTests}`);
        console.log(`   Success Rate: ${report.summary.successRate}`);
        
        console.log(`\n📋 CATEGORY BREAKDOWN:`);
        Object.entries(report.summary.categories).forEach(([category, stats]) => {
            const icon = category === 'authentication' ? '🔐' : 
                        category === 'superAdmin' ? '👑' : 
                        category === 'public' ? '🌍' : '🛡️';
            console.log(`   ${icon} ${category.toUpperCase()}: ${stats.passed}/${stats.total} (${stats.rate})`);
        });
        
        if (report.securityIssues.length > 0) {
            console.log(`\n🔒 SECURITY ISSUES (${report.securityIssues.length}):`);
            report.securityIssues.slice(0, 5).forEach(issue => {
                console.log(`   ⚠️ ${issue}`);
            });
            if (report.securityIssues.length > 5) {
                console.log(`   ... and ${report.securityIssues.length - 5} more issues`);
            }
        }
        
        if (report.performanceIssues.length > 0) {
            console.log(`\n⚡ PERFORMANCE ISSUES (${report.performanceIssues.length}):`);
            report.performanceIssues.slice(0, 3).forEach(issue => {
                console.log(`   🐌 ${issue}`);
            });
            if (report.performanceIssues.length > 3) {
                console.log(`   ... and ${report.performanceIssues.length - 3} more issues`);
            }
        }
        
        console.log(`\n🎯 TOP RECOMMENDATIONS:`);
        report.recommendations.forEach(rec => {
            console.log(`\n${rec.category} (${rec.priority}):`);
            rec.actions.forEach(action => console.log(`   ✅ ${action}`));
        });
        
        console.log(`\n📁 Detailed report saved to: api-test-report-detailed.json`);
        console.log(`🌐 API Documentation: ${BASE_URL}/api-docs`);
        
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
        console.error(error.stack);
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    runComprehensiveTests();
}

module.exports = {
    runComprehensiveTests,
    APITester
};
