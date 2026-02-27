/**
 * 🔍 COMPREHENSIVE API TESTING & ANALYSIS
 * Postman-like testing for all endpoints with response analysis
 */

const http = require('http');
const fs = require('fs');

class ComprehensiveAPITester {
    constructor() {
        this.baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
        this.results = {
            endpoints: [],
            categories: {},
            issues: [],
            performance: {},
            security: {},
            usability: {},
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                warnings: 0,
                avgResponseTime: 0,
                successRate: 0
            }
        };
        this.startTime = Date.now();
        this.authToken = null;
    }

    async runComprehensiveTest() {
        console.log('🔍 Starting Comprehensive API Testing & Analysis...\n');
        
        try {
            // First, get authentication token
            await this.authenticate();
            
            // Test all endpoints
            await this.testAllEndpoints();
            
            // Analyze results
            await this.analyzeResponses();
            
            // Identify issues
            await this.identifyIssues();
            
            // Generate report
            await this.generateReport();
            
        } catch (error) {
            console.error('❌ API testing failed:', error.message);
            this.results.error = error.message;
        }
        
        return this.results;
    }

    async authenticate() {
        console.log('🔐 Authenticating...');
        
        try {
            const response = await this.makeRequest('POST', '/api/auth/login', {
                email: 'admin@smartcampus.com',
                password: 'admin123'
            });
            
            if (response.success && response.data && response.data.token) {
                this.authToken = response.data.token;
                console.log('   ✅ Authentication successful');
            } else {
                console.log('   ❌ Authentication failed');
            }
        } catch (error) {
            console.log('   ❌ Authentication error:', error.message);
        }
    }

    async testAllEndpoints() {
        console.log('\n🌐 Testing All API Endpoints...');
        
        const testSuites = [
            {
                category: 'Health & System',
                endpoints: [
                    { method: 'GET', path: '/api/health', auth: false, description: 'System health check' },
                    { method: 'GET', path: '/api-docs', auth: false, description: 'API documentation' }
                ]
            },
            {
                category: 'Authentication',
                endpoints: [
                    { method: 'POST', path: '/api/auth/login', auth: false, data: { email: 'admin@smartcampus.com', password: 'admin123' }, description: 'User login' },
                    { method: 'POST', path: '/api/auth/register', auth: false, data: { name: 'Test User', email: 'test@example.com', password: 'TestPass123' }, description: 'User registration' },
                    { method: 'POST', path: '/api/auth/logout', auth: true, description: 'User logout' }
                ]
            },
            {
                category: 'Content Management',
                endpoints: [
                    { method: 'GET', path: '/api/content', auth: true, description: 'List content' },
                    { method: 'POST', path: '/api/content', auth: true, data: { title: 'Test Content', content: 'Test content body', type: 'page', status: 'draft' }, description: 'Create content' },
                    { method: 'GET', path: '/api/content?page=1&limit=10', auth: true, description: 'List content with pagination' },
                    { method: 'GET', path: '/api/content?search=test', auth: true, description: 'Search content' },
                    { method: 'GET', path: '/api/content?status=published', auth: true, description: 'Filter content by status' }
                ]
            },
            {
                category: 'Media Management',
                endpoints: [
                    { method: 'GET', path: '/api/media', auth: true, description: 'List media' },
                    { method: 'GET', path: '/api/media?page=1&limit=5', auth: true, description: 'List media with pagination' },
                    { method: 'GET', path: '/api/media?search=image', auth: true, description: 'Search media' }
                ]
            },
            {
                category: 'User Management',
                endpoints: [
                    { method: 'GET', path: '/api/super-admin/users', auth: true, description: 'List users' },
                    { method: 'GET', path: '/api/super-admin/users?page=1&limit=10', auth: true, description: 'List users with pagination' },
                    { method: 'GET', path: '/api/super-admin/users?search=admin', auth: true, description: 'Search users' },
                    { method: 'GET', path: '/api/super-admin/users?role=super_admin', auth: true, description: 'Filter users by role' },
                    { method: 'GET', path: '/api/super-admin/users?sort=name&order=asc', auth: true, description: 'Sort users' },
                    { method: 'POST', path: '/api/super-admin/users/bulk', auth: true, data: { operation: 'activate', users: [1] }, description: 'Bulk user operations' },
                    { method: 'GET', path: '/api/super-admin/users/export', auth: true, description: 'Export users' }
                ]
            },
            {
                category: 'CMS Features',
                endpoints: [
                    { method: 'GET', path: '/api/roles', auth: true, description: 'List roles' },
                    { method: 'GET', path: '/api/permissions', auth: true, description: 'List permissions' },
                    { method: 'GET', path: '/api/menus', auth: true, description: 'List menus' },
                    { method: 'GET', path: '/api/widgets', auth: true, description: 'List widgets' },
                    { method: 'GET', path: '/api/themes', auth: true, description: 'List themes' },
                    { method: 'GET', path: '/api/seo', auth: true, description: 'Get SEO settings' },
                    { method: 'POST', path: '/api/backup', auth: true, description: 'Create backup' },
                    { method: 'GET', path: '/api/cache/stats', auth: true, description: 'Get cache stats' },
                    { method: 'DELETE', path: '/api/cache', auth: true, description: 'Clear cache' }
                ]
            },
            {
                category: 'AI Features',
                endpoints: [
                    { method: 'GET', path: '/api/ai/student/123/performance', auth: false, description: 'Student performance analysis' },
                    { method: 'GET', path: '/api/ai/student/123/behavior', auth: false, description: 'Student behavior analysis' },
                    { method: 'GET', path: '/api/ai/campus-analytics', auth: false, description: 'Campus analytics' },
                    { method: 'POST', path: '/api/ai/sentiment-analysis', auth: false, data: { text: 'Great system!', context: 'general' }, description: 'Sentiment analysis' },
                    { method: 'POST', path: '/api/ai/schedule-optimization', auth: false, data: { constraints: {}, preferences: {} }, description: 'Schedule optimization' },
                    { method: 'GET', path: '/api/ai/alerts', auth: false, description: 'AI alerts' },
                    { method: 'GET', path: '/api/ai/insights', auth: false, description: 'AI insights' }
                ]
            },
            {
                category: 'Blockchain Features',
                endpoints: [
                    { method: 'POST', path: '/api/blockchain/certificate', auth: false, data: { type: 'degree', studentId: '123', studentName: 'John Doe' }, description: 'Create certificate' },
                    { method: 'GET', path: '/api/blockchain/certificate/SC12345/verify', auth: false, description: 'Verify certificate' },
                    { method: 'GET', path: '/api/blockchain/student/123/certificates', auth: false, description: 'Get student certificates' },
                    { method: 'GET', path: '/api/blockchain/stats', auth: false, description: 'Blockchain statistics' }
                ]
            },
            {
                category: 'IoT Features',
                endpoints: [
                    { method: 'GET', path: '/api/iot/devices', auth: false, description: 'List IoT devices' },
                    { method: 'GET', path: '/api/iot/room/101/analytics', auth: false, description: 'Room analytics' },
                    { method: 'GET', path: '/api/iot/campus-analytics', auth: false, description: 'Campus IoT analytics' },
                    { method: 'POST', path: '/api/iot/device/TEMP_001/control', auth: false, data: { command: 'set_temperature', parameters: { value: 22 } }, description: 'Control device' },
                    { method: 'GET', path: '/api/iot/alerts', auth: false, description: 'IoT alerts' }
                ]
            },
            {
                category: 'Real-time & Mobile',
                endpoints: [
                    { method: 'GET', path: '/api/realtime/status', auth: false, description: 'Real-time status' },
                    { method: 'GET', path: '/api/mobile/optimized', auth: false, description: 'Mobile optimization' },
                    { method: 'GET', path: '/api/security/overview', auth: false, description: 'Security overview' },
                    { method: 'GET', path: '/api/i18n/languages', auth: false, description: 'Multi-language support' }
                ]
            }
        ];

        let totalTests = 0;
        let passedTests = 0;

        for (const suite of testSuites) {
            console.log(`\n   📂 Testing ${suite.category}...`);
            
            this.results.categories[suite.category] = {
                total: suite.endpoints.length,
                passed: 0,
                failed: 0,
                warnings: 0,
                avgResponseTime: 0,
                endpoints: []
            };

            for (const endpoint of suite.endpoints) {
                totalTests++;
                
                try {
                    const result = await this.testEndpoint(endpoint);
                    this.results.endpoints.push(result);
                    this.results.categories[suite.category].endpoints.push(result);
                    
                    if (result.status === 'passed') {
                        passedTests++;
                        this.results.categories[suite.category].passed++;
                        console.log(`      ✅ ${endpoint.method} ${endpoint.path} - ${result.responseTime}ms`);
                    } else if (result.status === 'warning') {
                        this.results.categories[suite.category].warnings++;
                        console.log(`      ⚠️ ${endpoint.method} ${endpoint.path} - ${result.issue}`);
                    } else {
                        this.results.categories[suite.category].failed++;
                        console.log(`      ❌ ${endpoint.method} ${endpoint.path} - ${result.error}`);
                    }
                } catch (error) {
                    this.results.categories[suite.category].failed++;
                    console.log(`      💥 ${endpoint.method} ${endpoint.path} - ERROR: ${error.message}`);
                }
            }

            // Calculate category average response time
            const categoryTimes = this.results.categories[suite.category].endpoints
                .filter(e => e.responseTime)
                .map(e => e.responseTime);
            
            if (categoryTimes.length > 0) {
                this.results.categories[suite.category].avgResponseTime = 
                    Math.round(categoryTimes.reduce((a, b) => a + b, 0) / categoryTimes.length);
            }
        }

        this.results.summary.total = totalTests;
        this.results.summary.passed = passedTests;
        this.results.summary.failed = totalTests - passedTests;
        this.results.summary.successRate = ((passedTests / totalTests) * 100).toFixed(1);
        
        console.log(`\n   📊 Test Summary: ${passedTests}/${totalTests} passed (${this.results.summary.successRate}%)`);
    }

    async testEndpoint(endpoint) {
        const startTime = Date.now();
        
        try {
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'API-Tester/1.0'
            };

            if (endpoint.auth && this.authToken) {
                headers['Authorization'] = `Bearer ${this.authToken}`;
            }

            const response = await this.makeRequest(endpoint.method, endpoint.path, endpoint.data, headers);
            const responseTime = Date.now() - startTime;

            const result = {
                category: endpoint.category || 'Unknown',
                method: endpoint.method,
                path: endpoint.path,
                description: endpoint.description,
                statusCode: response.statusCode,
                responseTime,
                status: 'unknown',
                issues: [],
                response: response
            };

            // Analyze response
            this.analyzeResponse(result, response);
            
            return result;
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            return {
                category: endpoint.category || 'Unknown',
                method: endpoint.method,
                path: endpoint.path,
                description: endpoint.description,
                statusCode: 0,
                responseTime,
                status: 'error',
                error: error.message,
                issues: [`Request failed: ${error.message}`],
                response: null
            };
        }
    }

    analyzeResponse(result, response) {
        const issues = [];
        
        // Status code analysis
        if (response.statusCode >= 200 && response.statusCode < 300) {
            result.status = 'passed';
        } else if (response.statusCode >= 400 && response.statusCode < 500) {
            result.status = 'warning';
            issues.push(`Client error: ${response.statusCode}`);
        } else if (response.statusCode >= 500) {
            result.status = 'failed';
            issues.push(`Server error: ${response.statusCode}`);
        }

        // Response time analysis
        if (result.responseTime > 2000) {
            result.status = result.status === 'passed' ? 'warning' : result.status;
            issues.push(`Slow response: ${result.responseTime}ms`);
        }

        // Response structure analysis
        if (response.data) {
            // Check for success field
            if (response.data.success === undefined) {
                issues.push('Missing success field in response');
                result.status = result.status === 'passed' ? 'warning' : result.status;
            }

            // Check for message field
            if (response.data.message === undefined && response.data.success === false) {
                issues.push('Missing error message in failed response');
            }

            // Check for data field
            if (response.data.success === true && response.data.data === undefined) {
                issues.push('Missing data field in successful response');
                result.status = result.status === 'passed' ? 'warning' : result.status;
            }

            // Check for pagination in list responses
            if (result.path.includes('/list') || result.path.includes('/users') || result.path.includes('/content')) {
                if (result.method === 'GET' && response.data.pagination === undefined) {
                    issues.push('Missing pagination in list response');
                    result.status = result.status === 'passed' ? 'warning' : result.status;
                }
            }
        }

        // Security analysis
        if (response.headers) {
            // Check security headers
            const securityHeaders = [
                'x-content-type-options',
                'x-frame-options',
                'x-xss-protection',
                'strict-transport-security'
            ];

            securityHeaders.forEach(header => {
                if (!response.headers[header]) {
                    issues.push(`Missing security header: ${header}`);
                }
            });
        }

        // CORS analysis
        if (!response.headers['access-control-allow-origin']) {
            issues.push('Missing CORS header');
        }

        result.issues = issues;
    }

    async analyzeResponses() {
        console.log('\n📊 Analyzing API Responses...');
        
        // Performance analysis
        const responseTimes = this.results.endpoints
            .filter(e => e.responseTime)
            .map(e => e.responseTime);
        
        if (responseTimes.length > 0) {
            this.results.performance = {
                avgResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
                minResponseTime: Math.min(...responseTimes),
                maxResponseTime: Math.max(...responseTimes),
                slowEndpoints: this.results.endpoints.filter(e => e.responseTime > 1000),
                fastEndpoints: this.results.endpoints.filter(e => e.responseTime < 200)
            };
            
            this.results.summary.avgResponseTime = this.results.performance.avgResponseTime;
        }

        // Security analysis
        const securityIssues = this.results.endpoints
            .filter(e => e.issues.some(i => i.includes('security') || i.includes('CORS') || i.includes('header')))
            .length;
        
        this.results.security = {
            issues: securityIssues,
            endpointsWithSecurityIssues: this.results.endpoints.filter(e => 
                e.issues.some(i => i.includes('security') || i.includes('CORS') || i.includes('header'))
            )
        };

        // Usability analysis
        const usabilityIssues = this.results.endpoints
            .filter(e => e.issues.some(i => i.includes('Missing') || i.includes('pagination') || i.includes('message')))
            .length;
        
        this.results.usability = {
            issues: usabilityIssues,
            endpointsWithUsabilityIssues: this.results.endpoints.filter(e => 
                e.issues.some(i => i.includes('Missing') || i.includes('pagination') || i.includes('message'))
            )
        };
    }

    async identifyIssues() {
        console.log('\n🚨 Identifying Issues...');
        
        const issues = [];
        
        // Critical issues
        const criticalFailures = this.results.endpoints.filter(e => e.status === 'failed');
        if (criticalFailures.length > 0) {
            issues.push({
                severity: 'critical',
                category: 'API Failures',
                count: criticalFailures.length,
                description: `${criticalFailures.length} endpoints are failing`,
                endpoints: criticalFailures.map(e => `${e.method} ${e.path}`),
                recommendation: 'Fix failing endpoints immediately'
            });
        }

        // Performance issues
        const slowEndpoints = this.results.endpoints.filter(e => e.responseTime > 2000);
        if (slowEndpoints.length > 0) {
            issues.push({
                severity: 'high',
                category: 'Performance',
                count: slowEndpoints.length,
                description: `${slowEndpoints.length} endpoints have slow response times`,
                endpoints: slowEndpoints.map(e => `${e.method} ${e.path} (${e.responseTime}ms)`),
                recommendation: 'Optimize slow endpoints and add caching'
            });
        }

        // Security issues
        if (this.results.security.issues > 0) {
            issues.push({
                severity: 'high',
                category: 'Security',
                count: this.results.security.issues,
                description: `${this.results.security.issues} security issues found`,
                endpoints: this.results.security.endpointsWithSecurityIssues.map(e => `${e.method} ${e.path}`),
                recommendation: 'Implement missing security headers and CORS configuration'
            });
        }

        // Usability issues
        if (this.results.usability.issues > 0) {
            issues.push({
                severity: 'medium',
                category: 'Usability',
                count: this.results.usability.issues,
                description: `${this.results.usability.issues} usability issues found`,
                endpoints: this.results.usability.endpointsWithUsabilityIssues.map(e => `${e.method} ${e.path}`),
                recommendation: 'Standardize response format and add missing fields'
            });
        }

        // Warning issues
        const warningEndpoints = this.results.endpoints.filter(e => e.status === 'warning');
        if (warningEndpoints.length > 0) {
            issues.push({
                severity: 'low',
                category: 'Warnings',
                count: warningEndpoints.length,
                description: `${warningEndpoints.length} endpoints have warnings`,
                endpoints: warningEndpoints.map(e => `${e.method} ${e.path}`),
                recommendation: 'Review and improve endpoint implementations'
            });
        }

        this.results.issues = issues;
        
        console.log(`   🚨 Found ${issues.length} issue categories`);
        issues.forEach(issue => {
            console.log(`      ${issue.severity.toUpperCase()}: ${issue.description}`);
        });
    }

    async generateReport() {
        console.log('\n📋 Generating Comprehensive API Test Report...');
        
        const endTime = Date.now();
        const duration = endTime - this.startTime;

        const report = {
            metadata: {
                timestamp: new Date().toISOString(),
                duration: duration,
                tester: 'Comprehensive API Tester v1.0',
                environment: process.env.NODE_ENV || 'development',
                baseUrl: this.baseUrl
            },
            summary: this.results.summary,
            performance: this.results.performance,
            security: this.results.security,
            usability: this.results.usability,
            categories: this.results.categories,
            issues: this.results.issues,
            endpoints: this.results.endpoints,
            recommendations: this.generateRecommendations(),
            postmanCollection: this.generatePostmanCollection()
        };

        // Save detailed report
        fs.writeFileSync('comprehensive-api-test-report.json', JSON.stringify(report, null, 2));
        
        // Save Postman collection
        fs.writeFileSync('smart-campus-api-collection.json', JSON.stringify(report.postmanCollection, null, 2));
        
        // Save summary
        const summary = {
            timestamp: report.metadata.timestamp,
            totalEndpoints: report.summary.total,
            passedEndpoints: report.summary.passed,
            failedEndpoints: report.summary.failed,
            successRate: report.summary.successRate,
            avgResponseTime: report.summary.avgResponseTime,
            criticalIssues: report.issues.filter(i => i.severity === 'critical').length,
            highIssues: report.issues.filter(i => i.severity === 'high').length,
            mediumIssues: report.issues.filter(i => i.severity === 'medium').length,
            lowIssues: report.issues.filter(i => i.severity === 'low').length,
            overallStatus: this.getOverallStatus()
        };

        fs.writeFileSync('api-test-summary.json', JSON.stringify(summary, null, 2));
        
        this.displayReport(report);
    }

    generateRecommendations() {
        const recommendations = [];
        
        // Critical fixes
        const criticalIssues = this.results.issues.filter(i => i.severity === 'critical');
        if (criticalIssues.length > 0) {
            recommendations.push({
                priority: 'critical',
                category: 'API Stability',
                action: 'Fix failing endpoints',
                description: 'Resolve all endpoint failures immediately',
                endpoints: criticalIssues.flatMap(i => i.endpoints)
            });
        }

        // Performance improvements
        if (this.results.performance.slowEndpoints && this.results.performance.slowEndpoints.length > 0) {
            recommendations.push({
                priority: 'high',
                category: 'Performance',
                action: 'Optimize slow endpoints',
                description: 'Improve response times for slow endpoints',
                endpoints: this.results.performance.slowEndpoints.map(e => `${e.method} ${e.path}`)
            });
        }

        // Security improvements
        if (this.results.security.issues > 0) {
            recommendations.push({
                priority: 'high',
                category: 'Security',
                action: 'Implement security best practices',
                description: 'Add missing security headers and CORS configuration',
                details: 'Ensure all endpoints have proper security headers'
            });
        }

        // Usability improvements
        if (this.results.usability.issues > 0) {
            recommendations.push({
                priority: 'medium',
                category: 'Usability',
                action: 'Standardize API responses',
                description: 'Ensure consistent response format across all endpoints',
                details: 'Add success, message, and data fields to all responses'
            });
        }

        // General improvements
        recommendations.push({
            priority: 'medium',
            category: 'Documentation',
            action: 'Improve API documentation',
            description: 'Add detailed examples and error codes',
            details: 'Include request/response examples for all endpoints'
        });

        return recommendations;
    }

    generatePostmanCollection() {
        const collection = {
            info: {
                name: 'Smart Campus API',
                description: 'Complete API collection for Smart Campus CMS',
                schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
            },
            item: []
        };

        // Group endpoints by category
        const categories = {};
        this.results.endpoints.forEach(endpoint => {
            const category = endpoint.category || 'Other';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(endpoint);
        });

        // Create Postman items
        Object.keys(categories).forEach(category => {
            const categoryItem = {
                name: category,
                item: []
            };

            categories[category].forEach(endpoint => {
                const request = {
                    name: endpoint.description,
                    request: {
                        method: endpoint.method,
                        header: [
                            {
                                key: 'Content-Type',
                                value: 'application/json'
                            }
                        ],
                        url: {
                            raw: `${this.baseUrl}${endpoint.path}`,
                            host: [this.baseUrl.replace('http://', '').replace('https://', '')],
                            path: endpoint.path.split('/').filter(p => p)
                        }
                    },
                    response: []
                };

                // Add auth header if needed
                if (endpoint.auth) {
                    request.request.header.push({
                        key: 'Authorization',
                        value: 'Bearer {{auth_token}}'
                    });
                }

                // Add body if data exists
                if (endpoint.data) {
                    request.request.body = {
                        mode: 'raw',
                        raw: JSON.stringify(endpoint.data, null, 2)
                    };
                }

                categoryItem.item.push(request);
            });

            collection.item.push(categoryItem);
        });

        return collection;
    }

    getOverallStatus() {
        const successRate = parseFloat(this.results.summary.successRate);
        const criticalIssues = this.results.issues.filter(i => i.severity === 'critical').length;
        const highIssues = this.results.issues.filter(i => i.severity === 'high').length;
        
        if (criticalIssues > 0) {
            return 'CRITICAL - Immediate attention required';
        } else if (highIssues > 0 || successRate < 80) {
            return 'NEEDS IMPROVEMENT';
        } else if (successRate >= 95) {
            return 'EXCELLENT';
        } else {
            return 'GOOD';
        }
    }

    displayReport(report) {
        console.log('\n' + '='.repeat(80));
        console.log('🔍 COMPREHENSIVE API TEST REPORT');
        console.log('='.repeat(80));
        
        console.log('\n📊 EXECUTIVE SUMMARY:');
        console.log(`   Total Endpoints: ${report.summary.total}`);
        console.log(`   Passed: ${report.summary.passed}`);
        console.log(`   Failed: ${report.summary.failed}`);
        console.log(`   Success Rate: ${report.summary.successRate}%`);
        console.log(`   Avg Response Time: ${report.summary.avgResponseTime}ms`);
        console.log(`   Overall Status: ${this.getOverallStatus()}`);
        
        console.log('\n⚡ PERFORMANCE ANALYSIS:');
        if (report.performance.avgResponseTime) {
            console.log(`   Average Response Time: ${report.performance.avgResponseTime}ms`);
            console.log(`   Fastest: ${report.performance.minResponseTime}ms`);
            console.log(`   Slowest: ${report.performance.maxResponseTime}ms`);
            console.log(`   Slow Endpoints (>2s): ${report.performance.slowEndpoints ? report.performance.slowEndpoints.length : 0}`);
            console.log(`   Fast Endpoints (<200ms): ${report.performance.fastEndpoints ? report.performance.fastEndpoints.length : 0}`);
        }
        
        console.log('\n🛡️ SECURITY ANALYSIS:');
        console.log(`   Security Issues: ${report.security.issues}`);
        if (report.security.endpointsWithSecurityIssues && report.security.endpointsWithSecurityIssues.length > 0) {
            console.log('   Endpoints with Security Issues:');
            report.security.endpointsWithSecurityIssues.forEach((endpoint, index) => {
                console.log(`   ${index + 1}. ${endpoint.method} ${endpoint.path}`);
                endpoint.issues.forEach(issue => console.log(`      - ${issue}`));
            });
        }
        
        console.log('\n👥 USABILITY ANALYSIS:');
        console.log(`   Usability Issues: ${report.usability.issues}`);
        if (report.usability.endpointsWithUsabilityIssues && report.usability.endpointsWithUsabilityIssues.length > 0) {
            console.log('   Endpoints with Usability Issues:');
            report.usability.endpointsWithUsabilityIssues.forEach((endpoint, index) => {
                console.log(`   ${index + 1}. ${endpoint.method} ${endpoint.path}`);
                endpoint.issues.forEach(issue => console.log(`      - ${issue}`));
            });
        }
        
        console.log('\n📂 CATEGORY BREAKDOWN:');
        Object.entries(report.categories).forEach(([category, data]) => {
            const status = data.failed === 0 ? '✅' : data.failed < data.total / 2 ? '⚠️' : '❌';
            const successRate = ((data.passed / data.total) * 100).toFixed(1);
            console.log(`   ${status} ${category}: ${data.passed}/${data.total} (${successRate}%) - Avg: ${data.avgResponseTime || 0}ms`);
        });
        
        console.log('\n🚨 ISSUES IDENTIFIED:');
        if (report.issues.length > 0) {
            report.issues.forEach((issue, index) => {
                console.log(`   ${index + 1}. [${issue.severity.toUpperCase()}] ${issue.description}`);
                console.log(`      Count: ${issue.count}`);
                console.log(`      Recommendation: ${issue.recommendation}`);
            });
        } else {
            console.log('   ✅ No critical issues found');
        }
        
        console.log('\n💡 TOP RECOMMENDATIONS:');
        report.recommendations.slice(0, 5).forEach((rec, index) => {
            console.log(`   ${index + 1}. ${rec.action} (${rec.priority.toUpperCase()})`);
            console.log(`      ${rec.description}`);
        });
        
        console.log('\n📁 FILES GENERATED:');
        console.log('   comprehensive-api-test-report.json - Detailed test results');
        console.log('   api-test-summary.json - Executive summary');
        console.log('   smart-campus-api-collection.json - Postman collection');
        
        console.log('\n' + '='.repeat(80));
        console.log('🎉 COMPREHENSIVE API TESTING COMPLETE!');
        console.log('='.repeat(80));
    }

    async makeRequest(method, path, data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: new URL(this.baseUrl).hostname,
                port: new URL(this.baseUrl).port || 80,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'API-Tester/1.0',
                    ...headers
                },
                timeout: 10000
            };

            if (data) {
                options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(data));
            }

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const responseData = body ? JSON.parse(body) : {};
                        resolve({
                            statusCode: res.statusCode,
                            success: res.statusCode >= 200 && res.statusCode < 300,
                            data: responseData,
                            headers: res.headers
                        });
                    } catch (e) {
                        resolve({
                            statusCode: res.statusCode,
                            success: false,
                            error: 'Invalid JSON response',
                            headers: res.headers
                        });
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const tester = new ComprehensiveAPITester();
    tester.runComprehensiveTest().then(() => {
        console.log('\n🎉 API TESTING COMPLETE! Review generated reports for detailed analysis.');
        process.exit(0);
    }).catch(error => {
        console.error('❌ API testing failed:', error.message);
        process.exit(1);
    });
}

module.exports = ComprehensiveAPITester;
