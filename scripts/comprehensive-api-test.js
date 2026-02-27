/**
 * 🔬 COMPREHENSIVE API TESTING & ANALYSIS SCRIPT
 * Tests all API endpoints, analyzes responses, and generates improvement recommendations
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
    apiAnalysis: {},
    improvements: [],
    securityIssues: [],
    performanceIssues: []
};

// Test data
const testUsers = {
    superAdmin: {
        email: 'superadmin@smartcampus.com',
        password: 'SuperAdmin@2026'
    },
    principal: {
        name: 'Test Principal',
        email: 'principal@test.com',
        password: 'TestPass123!',
        role: 'principal',
        schoolName: 'Test School',
        schoolCode: 'TEST001'
    },
    teacher: {
        name: 'Test Teacher',
        email: 'teacher@test.com',
        password: 'TestPass123!',
        role: 'teacher',
        schoolCode: 'TEST001'
    },
    student: {
        name: 'Test Student',
        email: 'student@test.com',
        password: 'TestPass123!',
        role: 'student',
        schoolCode: 'TEST001'
    }
};

// Authentication tokens
let tokens = {
    superAdmin: null,
    principal: null,
    teacher: null,
    student: null
};

/**
 * Make API request with error handling
 */
async function makeRequest(method, endpoint, data = null, headers = {}, token = null) {
    try {
        const config = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                'x-device-id': 'test-device-123',
                ...headers
            }
        };

        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        if (data) {
            config.data = data;
        }

        const startTime = Date.now();
        const response = await axios(config);
        const endTime = Date.now();

        return {
            success: true,
            status: response.status,
            data: response.data,
            responseTime: endTime - startTime,
            headers: response.headers
        };
    } catch (error) {
        return {
            success: false,
            status: error.response?.status || 0,
            error: error.message,
            data: error.response?.data || null,
            responseTime: Date.now() - (error.config?.startTime || Date.now())
        };
    }
}

/**
 * Analyze API response
 */
function analyzeResponse(endpoint, result, expectedStatus = 200) {
    const analysis = {
        endpoint,
        method: result.config?.method || 'GET',
        status: result.status,
        expectedStatus,
        success: result.success && result.status === expectedStatus,
        responseTime: result.responseTime,
        dataSize: JSON.stringify(result.data || {}).length,
        issues: [],
        recommendations: []
    };

    // Status code analysis
    if (result.status !== expectedStatus) {
        analysis.issues.push(`Unexpected status code: ${result.status} (expected ${expectedStatus})`);
    }

    // Response time analysis
    if (result.responseTime > 2000) {
        analysis.issues.push(`Slow response time: ${result.responseTime}ms`);
        analysis.recommendations.push('Optimize database queries or add caching');
        TEST_RESULTS.performanceIssues.push({
            endpoint,
            issue: `Slow response: ${result.responseTime}ms`,
            recommendation: 'Add caching or optimize queries'
        });
    }

    // Response structure analysis
    if (result.success && result.data) {
        // Check for consistent response format
        if (!result.data.hasOwnProperty('success')) {
            analysis.issues.push('Missing success field in response');
            analysis.recommendations.push('Add success field to response');
        }

        if (!result.data.hasOwnProperty('data') && !result.data.hasOwnProperty('message')) {
            analysis.issues.push('Missing data or message field in response');
            analysis.recommendations.push('Add data or message field to response');
        }

        // Check for sensitive data exposure
        const responseStr = JSON.stringify(result.data);
        if (responseStr.includes('password') || responseStr.includes('token') || responseStr.includes('secret')) {
            analysis.issues.push('Potential sensitive data exposure in response');
            analysis.recommendations.push('Remove sensitive data from responses');
            TEST_RESULTS.securityIssues.push({
                endpoint,
                issue: 'Sensitive data exposure',
                recommendation: 'Remove sensitive data from API responses'
            });
        }
    }

    // Error response analysis
    if (!result.success) {
        if (!result.data || !result.data.message) {
            analysis.issues.push('Error response missing descriptive message');
            analysis.recommendations.push('Add descriptive error messages');
        }

        if (result.status >= 500) {
            analysis.issues.push('Server error occurred');
            analysis.recommendations.push('Improve error handling and logging');
        }
    }

    return analysis;
}

/**
 * Test authentication APIs
 */
async function testAuthAPIs() {
    console.log('🔐 Testing Authentication APIs...');
    
    const authTests = [
        // Super Admin Login
        {
            name: 'Super Admin Login',
            method: 'POST',
            endpoint: '/api/super-admin/login',
            data: testUsers.superAdmin,
            expectedStatus: 200
        },
        // Regular User Login (should fail without existing user)
        {
            name: 'Regular Login (Invalid)',
            method: 'POST',
            endpoint: '/api/auth/login',
            data: { email: 'nonexistent@test.com', password: 'test123' },
            expectedStatus: 401
        },
        // User Registration
        {
            name: 'User Registration',
            method: 'POST',
            endpoint: '/api/auth/register',
            data: testUsers.principal,
            expectedStatus: 201
        }
    ];

    for (const test of authTests) {
        console.log(`  Testing: ${test.name}`);
        const result = await makeRequest(test.method, test.endpoint, test.data);
        const analysis = analyzeResponse(test.endpoint, result, test.expectedStatus);
        
        TEST_RESULTS.totalTests++;
        if (analysis.success) {
            TEST_RESULTS.passedTests++;
            console.log(`    ✅ ${test.name} - ${result.responseTime}ms`);
            
            // Store token for authenticated endpoints
            if (test.name === 'Super Admin Login' && result.success) {
                tokens.superAdmin = result.data.data?.token;
            }
        } else {
            TEST_RESULTS.failedTests++;
            console.log(`    ❌ ${test.name} - ${result.status} - ${analysis.issues.join(', ')}`);
        }
        
        TEST_RESULTS.apiAnalysis[test.name] = analysis;
    }
}

/**
 * Test Super Admin APIs
 */
async function testSuperAdminAPIs() {
    console.log('👑 Testing Super Admin APIs...');
    
    if (!tokens.superAdmin) {
        console.log('  ⚠️ Skipping Super Admin tests - no authentication token');
        return;
    }

    const superAdminTests = [
        // Dashboard
        {
            name: 'Super Admin Dashboard',
            method: 'GET',
            endpoint: '/api/super-admin/dashboard',
            expectedStatus: 200
        },
        // System Settings
        {
            name: 'Get System Settings',
            method: 'GET',
            endpoint: '/api/super-admin/system-settings',
            expectedStatus: 200
        },
        // Users List
        {
            name: 'Get All Users',
            method: 'GET',
            endpoint: '/api/super-admin/users',
            expectedStatus: 200
        },
        // Create User
        {
            name: 'Create User',
            method: 'POST',
            endpoint: '/api/super-admin/users',
            data: testUsers.teacher,
            expectedStatus: 201
        },
        // Schools List
        {
            name: 'Get All Schools',
            method: 'GET',
            endpoint: '/api/super-admin/schools',
            expectedStatus: 200
        },
        // Analytics
        {
            name: 'Get System Analytics',
            method: 'GET',
            endpoint: '/api/super-admin/analytics',
            expectedStatus: 200
        },
        // Audit Logs
        {
            name: 'Get Audit Logs',
            method: 'GET',
            endpoint: '/api/super-admin/audit-logs',
            expectedStatus: 200
        }
    ];

    for (const test of superAdminTests) {
        console.log(`  Testing: ${test.name}`);
        const result = await makeRequest(test.method, test.endpoint, test.data, {}, tokens.superAdmin);
        const analysis = analyzeResponse(test.endpoint, result, test.expectedStatus);
        
        TEST_RESULTS.totalTests++;
        if (analysis.success) {
            TEST_RESULTS.passedTests++;
            console.log(`    ✅ ${test.name} - ${result.responseTime}ms`);
        } else {
            TEST_RESULTS.failedTests++;
            console.log(`    ❌ ${test.name} - ${result.status} - ${analysis.issues.join(', ')}`);
        }
        
        TEST_RESULTS.apiAnalysis[test.name] = analysis;
    }
}

/**
 * Test School Management APIs
 */
async function testSchoolAPIs() {
    console.log('🏫 Testing School Management APIs...');
    
    if (!tokens.superAdmin) {
        console.log('  ⚠️ Skipping School tests - no authentication token');
        return;
    }

    const schoolTests = [
        // Create School
        {
            name: 'Create School',
            method: 'POST',
            endpoint: '/api/super-admin/schools',
            data: {
                schoolName: 'API Test School',
                schoolCode: 'APITEST001',
                address: '123 Test Street',
                phone: '+1234567890',
                email: 'test@apischool.com',
                principalName: 'API Test Principal',
                principalEmail: 'principal@apischool.com',
                principalPhone: '+1234567891',
                principalPassword: 'TestPass123!'
            },
            expectedStatus: 201
        }
    ];

    for (const test of schoolTests) {
        console.log(`  Testing: ${test.name}`);
        const result = await makeRequest(test.method, test.endpoint, test.data, {}, tokens.superAdmin);
        const analysis = analyzeResponse(test.endpoint, result, test.expectedStatus);
        
        TEST_RESULTS.totalTests++;
        if (analysis.success) {
            TEST_RESULTS.passedTests++;
            console.log(`    ✅ ${test.name} - ${result.responseTime}ms`);
        } else {
            TEST_RESULTS.failedTests++;
            console.log(`    ❌ ${test.name} - ${result.status} - ${analysis.issues.join(', ')}`);
        }
        
        TEST_RESULTS.apiAnalysis[test.name] = analysis;
    }
}

/**
 * Test Public APIs
 */
async function testPublicAPIs() {
    console.log('🌍 Testing Public APIs...');
    
    const publicTests = [
        // Health Check
        {
            name: 'Health Check',
            method: 'GET',
            endpoint: '/health',
            expectedStatus: 200
        },
        // Public Info
        {
            name: 'Public Routes',
            method: 'GET',
            endpoint: '/api/public/info',
            expectedStatus: 200
        }
    ];

    for (const test of publicTests) {
        console.log(`  Testing: ${test.name}`);
        const result = await makeRequest(test.method, test.endpoint);
        const analysis = analyzeResponse(test.endpoint, result, test.expectedStatus);
        
        TEST_RESULTS.totalTests++;
        if (analysis.success) {
            TEST_RESULTS.passedTests++;
            console.log(`    ✅ ${test.name} - ${result.responseTime}ms`);
        } else {
            TEST_RESULTS.failedTests++;
            console.log(`    ❌ ${test.name} - ${result.status} - ${analysis.issues.join(', ')}`);
        }
        
        TEST_RESULTS.apiAnalysis[test.name] = analysis;
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
            successRate: ((TEST_RESULTS.passedTests / TEST_RESULTS.totalTests) * 100).toFixed(2) + '%'
        },
        apiAnalysis: TEST_RESULTS.apiAnalysis,
        securityIssues: TEST_RESULTS.securityIssues,
        performanceIssues: TEST_RESULTS.performanceIssues,
        recommendations: generateRecommendations(),
        testedAt: new Date().toISOString()
    };

    // Save report to file
    const reportPath = path.join(__dirname, '../api-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n📊 API Testing Report Generated!');
    console.log(`📁 Report saved to: ${reportPath}`);
    console.log(`✅ Success Rate: ${report.summary.successRate}`);
    console.log(`🔒 Security Issues: ${TEST_RESULTS.securityIssues.length}`);
    console.log(`⚡ Performance Issues: ${TEST_RESULTS.performanceIssues.length}`);
    
    return report;
}

/**
 * Generate improvement recommendations
 */
function generateRecommendations() {
    const recommendations = [];
    
    // Security recommendations
    if (TEST_RESULTS.securityIssues.length > 0) {
        recommendations.push({
            category: 'Security',
            priority: 'High',
            items: [
                'Implement input validation and sanitization',
                'Add rate limiting to all endpoints',
                'Remove sensitive data from API responses',
                'Implement proper CORS configuration',
                'Add API authentication to all protected endpoints'
            ]
        });
    }
    
    // Performance recommendations
    if (TEST_RESULTS.performanceIssues.length > 0) {
        recommendations.push({
            category: 'Performance',
            priority: 'Medium',
            items: [
                'Add database query optimization',
                'Implement response caching',
                'Add pagination to list endpoints',
                'Optimize large data transfers',
                'Add compression middleware'
            ]
        });
    }
    
    // General recommendations
    recommendations.push({
        category: 'General',
        priority: 'Medium',
        items: [
            'Standardize response format across all endpoints',
            'Add comprehensive error handling',
            'Implement API versioning',
            'Add request/response logging',
            'Create API documentation'
        ]
    });
    
    return recommendations;
}

/**
 * Run comprehensive API tests
 */
async function runComprehensiveTests() {
    console.log('🚀 Starting Comprehensive API Testing...\n');
    
    try {
        await testPublicAPIs();
        await testAuthAPIs();
        await testSuperAdminAPIs();
        await testSchoolAPIs();
        
        const report = generateReport();
        
        // Display summary
        console.log('\n' + '='.repeat(50));
        console.log('📈 TESTING SUMMARY');
        console.log('='.repeat(50));
        console.log(`Total Tests: ${report.summary.totalTests}`);
        console.log(`Passed: ${report.summary.passedTests}`);
        console.log(`Failed: ${report.summary.failedTests}`);
        console.log(`Success Rate: ${report.summary.successRate}`);
        
        if (TEST_RESULTS.securityIssues.length > 0) {
            console.log(`\n🔒 Security Issues Found: ${TEST_RESULTS.securityIssues.length}`);
            TEST_RESULTS.securityIssues.forEach(issue => {
                console.log(`  - ${issue.endpoint}: ${issue.issue}`);
            });
        }
        
        if (TEST_RESULTS.performanceIssues.length > 0) {
            console.log(`\n⚡ Performance Issues Found: ${TEST_RESULTS.performanceIssues.length}`);
            TEST_RESULTS.performanceIssues.forEach(issue => {
                console.log(`  - ${issue.endpoint}: ${issue.issue}`);
            });
        }
        
        console.log('\n🎯 Top Recommendations:');
        report.recommendations.forEach(rec => {
            console.log(`\n${rec.category} (${rec.priority}):`);
            rec.items.forEach(item => console.log(`  - ${item}`));
        });
        
    } catch (error) {
        console.error('❌ Test execution failed:', error.message);
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    runComprehensiveTests();
}

module.exports = {
    runComprehensiveTests,
    testAuthAPIs,
    testSuperAdminAPIs,
    testSchoolAPIs,
    testPublicAPIs,
    generateReport
};
