/**
 * 🔍 API RESPONSE TESTER
 * Test all 49 endpoints to verify they are giving responses
 */

const http = require('http');

class APIResponseTester {
    constructor() {
        this.baseUrl = 'http://localhost:5000';
        this.results = {
            total: 0,
            responding: 0,
            notResponding: 0,
            responses: []
        };
    }

    async testAllEndpoints() {
        console.log('🔍 Testing All API Endpoints for Responses...\n');
        
        const endpoints = [
            // Health & System
            { method: 'GET', path: '/api/health', description: 'Health Check' },
            { method: 'GET', path: '/api-docs', description: 'API Documentation' },
            
            // Authentication
            { method: 'POST', path: '/api/auth/login', data: { email: 'admin@smartcampus.com', password: 'admin123' }, description: 'Login' },
            { method: 'POST', path: '/api/auth/register', data: { name: 'Test User', email: 'test@example.com', password: 'TestPass123' }, description: 'Register' },
            { method: 'POST', path: '/api/auth/logout', description: 'Logout' },
            
            // Content Management
            { method: 'GET', path: '/api/content', description: 'List Content' },
            { method: 'POST', path: '/api/content', data: { title: 'Test Content', content: 'Test content body' }, description: 'Create Content' },
            { method: 'PUT', path: '/api/content/1', data: { title: 'Updated Content' }, description: 'Update Content' },
            { method: 'DELETE', path: '/api/content/1', description: 'Delete Content' },
            { method: 'GET', path: '/api/content/1', description: 'Get Single Content' },
            
            // Media Management
            { method: 'GET', path: '/api/media', description: 'List Media' },
            { method: 'DELETE', path: '/api/media/1', description: 'Delete Media' },
            { method: 'GET', path: '/api/media/1', description: 'Get Media Details' },
            { method: 'POST', path: '/api/media/upload', description: 'Upload Media' },
            
            // User Management
            { method: 'GET', path: '/api/super-admin/users', description: 'List Users' },
            { method: 'POST', path: '/api/super-admin/users', data: { name: 'New User', email: 'newuser@example.com', password: 'Password123' }, description: 'Create User' },
            { method: 'PUT', path: '/api/super-admin/users/1', data: { name: 'Updated User' }, description: 'Update User' },
            { method: 'DELETE', path: '/api/super-admin/users/1', description: 'Delete User' },
            { method: 'GET', path: '/api/super-admin/users/1', description: 'Get User Details' },
            { method: 'POST', path: '/api/super-admin/users/bulk', data: { operation: 'activate', users: [1] }, description: 'Bulk Operations' },
            { method: 'GET', path: '/api/super-admin/users/export', description: 'Export Users' },
            
            // CMS Features
            { method: 'GET', path: '/api/roles', description: 'List Roles' },
            { method: 'GET', path: '/api/permissions', description: 'List Permissions' },
            { method: 'GET', path: '/api/menus', description: 'List Menus' },
            { method: 'GET', path: '/api/widgets', description: 'List Widgets' },
            { method: 'GET', path: '/api/themes', description: 'List Themes' },
            { method: 'GET', path: '/api/seo', description: 'Get SEO Settings' },
            { method: 'POST', path: '/api/backup', description: 'Create Backup' },
            { method: 'GET', path: '/api/cache/stats', description: 'Get Cache Stats' },
            { method: 'DELETE', path: '/api/cache', description: 'Clear Cache' },
            
            // AI Features
            { method: 'GET', path: '/api/ai/student/123/performance', description: 'Student Performance' },
            { method: 'GET', path: '/api/ai/student/123/behavior', description: 'Student Behavior' },
            { method: 'GET', path: '/api/ai/campus-analytics', description: 'Campus Analytics' },
            { method: 'POST', path: '/api/ai/sentiment-analysis', data: { text: 'Great system!', context: 'general' }, description: 'Sentiment Analysis' },
            { method: 'POST', path: '/api/ai/schedule-optimization', data: { constraints: {}, preferences: {} }, description: 'Schedule Optimization' },
            { method: 'GET', path: '/api/ai/alerts', description: 'AI Alerts' },
            { method: 'GET', path: '/api/ai/insights', description: 'AI Insights' },
            
            // Blockchain Features
            { method: 'POST', path: '/api/blockchain/certificate', data: { type: 'degree', studentId: '123', studentName: 'John Doe' }, description: 'Create Certificate' },
            { method: 'GET', path: '/api/blockchain/certificate/SC12345/verify', description: 'Verify Certificate' },
            { method: 'GET', path: '/api/blockchain/student/123/certificates', description: 'Student Certificates' },
            { method: 'GET', path: '/api/blockchain/stats', description: 'Blockchain Stats' },
            
            // IoT Features
            { method: 'GET', path: '/api/iot/devices', description: 'List IoT Devices' },
            { method: 'GET', path: '/api/iot/room/101/analytics', description: 'Room Analytics' },
            { method: 'GET', path: '/api/iot/campus-analytics', description: 'Campus IoT Analytics' },
            { method: 'POST', path: '/api/iot/device/TEMP_001/control', data: { command: 'set_temperature', parameters: { value: 22 } }, description: 'Device Control' },
            { method: 'GET', path: '/api/iot/alerts', description: 'IoT Alerts' },
            
            // Real-time & Mobile
            { method: 'GET', path: '/api/realtime/status', description: 'Real-time Status' },
            { method: 'GET', path: '/api/mobile/optimized', description: 'Mobile Optimization' },
            { method: 'GET', path: '/api/security/overview', description: 'Security Overview' },
            { method: 'GET', path: '/api/i18n/languages', description: 'Multi-language Support' }
        ];

        this.results.total = endpoints.length;

        for (const endpoint of endpoints) {
            const result = await this.testEndpoint(endpoint);
            this.results.responses.push(result);
            
            if (result.responding) {
                this.results.responding++;
                console.log(`   ✅ ${endpoint.method} ${endpoint.path} - ${result.statusCode} - ${result.responseTime}ms`);
            } else {
                this.results.notResponding++;
                console.log(`   ❌ ${endpoint.method} ${endpoint.path} - ${result.error}`);
            }
        }

        this.generateReport();
        return this.results;
    }

    async testEndpoint(endpoint) {
        const startTime = Date.now();
        
        try {
            const response = await this.makeRequest(endpoint.method, endpoint.path, endpoint.data);
            const responseTime = Date.now() - startTime;
            
            return {
                method: endpoint.method,
                path: endpoint.path,
                description: endpoint.description,
                responding: true,
                statusCode: response.statusCode,
                responseTime,
                hasData: response.data !== undefined,
                success: response.statusCode >= 200 && response.statusCode < 300
            };
            
        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            return {
                method: endpoint.method,
                path: endpoint.path,
                description: endpoint.description,
                responding: false,
                error: error.message,
                responseTime,
                statusCode: 0
            };
        }
    }

    async makeRequest(method, path, data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'localhost',
                port: 5000,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'API-Response-Tester/1.0'
                },
                timeout: 5000
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

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (data) {
                req.write(JSON.stringify(data));
            }
            
            req.end();
        });
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 API RESPONSE TEST REPORT');
        console.log('='.repeat(80));
        
        console.log('\n📈 SUMMARY:');
        console.log(`   Total Endpoints: ${this.results.total}`);
        console.log(`   Responding: ${this.results.responding}`);
        console.log(`   Not Responding: ${this.results.notResponding}`);
        console.log(`   Response Rate: ${((this.results.responding / this.results.total) * 100).toFixed(1)}%`);
        
        console.log('\n📊 CATEGORY BREAKDOWN:');
        
        const categories = {
            'Health & System': this.results.responses.filter(r => 
                r.path === '/api/health' || r.path === '/api-docs'
            ),
            'Authentication': this.results.responses.filter(r => 
                r.path.startsWith('/api/auth')
            ),
            'Content Management': this.results.responses.filter(r => 
                r.path.startsWith('/api/content')
            ),
            'Media Management': this.results.responses.filter(r => 
                r.path.startsWith('/api/media')
            ),
            'User Management': this.results.responses.filter(r => 
                r.path.startsWith('/api/super-admin/users')
            ),
            'CMS Features': this.results.responses.filter(r => 
                r.path.startsWith('/api/roles') || 
                r.path.startsWith('/api/permissions') || 
                r.path.startsWith('/api/menus') || 
                r.path.startsWith('/api/widgets') || 
                r.path.startsWith('/api/themes') || 
                r.path.startsWith('/api/seo') || 
                r.path.startsWith('/api/backup') || 
                r.path.startsWith('/api/cache')
            ),
            'AI Features': this.results.responses.filter(r => 
                r.path.startsWith('/api/ai')
            ),
            'Blockchain Features': this.results.responses.filter(r => 
                r.path.startsWith('/api/blockchain')
            ),
            'IoT Features': this.results.responses.filter(r => 
                r.path.startsWith('/api/iot')
            ),
            'Real-time & Mobile': this.results.responses.filter(r => 
                r.path.startsWith('/api/realtime') || 
                r.path.startsWith('/api/mobile') || 
                r.path.startsWith('/api/security') || 
                r.path.startsWith('/api/i18n')
            )
        };

        Object.entries(categories).forEach(([category, endpoints]) => {
            const responding = endpoints.filter(e => e.responding).length;
            const total = endpoints.length;
            const rate = total > 0 ? ((responding / total) * 100).toFixed(1) : '0.0';
            const status = responding === total ? '✅' : responding > 0 ? '⚠️' : '❌';
            console.log(`   ${status} ${category}: ${responding}/${total} (${rate}%)`);
        });

        console.log('\n🚨 NOT RESPONDING ENDPOINTS:');
        const notResponding = this.results.responses.filter(r => !r.responding);
        if (notResponding.length > 0) {
            notResponding.forEach((endpoint, index) => {
                console.log(`   ${index + 1}. ${endpoint.method} ${endpoint.path} - ${endpoint.error}`);
            });
        } else {
            console.log('   ✅ All endpoints are responding!');
        }

        console.log('\n⚡ PERFORMANCE ANALYSIS:');
        const respondingEndpoints = this.results.responses.filter(r => r.responding);
        if (respondingEndpoints.length > 0) {
            const avgTime = respondingEndpoints.reduce((sum, e) => sum + e.responseTime, 0) / respondingEndpoints.length;
            const maxTime = Math.max(...respondingEndpoints.map(e => e.responseTime));
            const minTime = Math.min(...respondingEndpoints.map(e => e.responseTime));
            
            console.log(`   Average Response Time: ${avgTime.toFixed(2)}ms`);
            console.log(`   Fastest Response: ${minTime}ms`);
            console.log(`   Slowest Response: ${maxTime}ms`);
        }

        console.log('\n📊 SUCCESS RATE ANALYSIS:');
        const successful = this.results.responses.filter(r => r.responding && r.success).length;
        const successRate = ((successful / this.results.total) * 100).toFixed(1);
        console.log(`   Successful Responses: ${successful}/${this.results.total} (${successRate}%)`);

        console.log('\n' + '='.repeat(80));
        console.log('🎉 API RESPONSE TESTING COMPLETE!');
        console.log('='.repeat(80));
    }
}

// Run the test
if (require.main === module) {
    const tester = new APIResponseTester();
    tester.testAllEndpoints().then(() => {
        console.log('\n🎉 RESPONSE TESTING COMPLETE!');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Testing failed:', error.message);
        process.exit(1);
    });
}

module.exports = APIResponseTester;
