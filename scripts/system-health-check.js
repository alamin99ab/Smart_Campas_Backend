/**
 * 🔍 COMPREHENSIVE SYSTEM HEALTH CHECK
 * Validates all next-level Smart Campus features
 */

const http = require('http');
const { performance } = require('perf_hooks');

class SystemHealthCheck {
    constructor() {
        this.baseUrl = process.env.API_BASE_URL || 'http://localhost:5001';
        this.results = {
            server: { status: 'unknown', responseTime: 0 },
            ai: { status: 'unknown', endpoints: 0 },
            blockchain: { status: 'unknown', endpoints: 0 },
            iot: { status: 'unknown', endpoints: 0 },
            realtime: { status: 'unknown', endpoints: 0 },
            mobile: { status: 'unknown', endpoints: 0 },
            security: { status: 'unknown', endpoints: 0 },
            overall: { score: 0, status: 'unknown' }
        };
        this.startTime = performance.now();
    }

    async runFullCheck() {
        console.log('🔍 Starting Comprehensive System Health Check...\n');
        
        try {
            await this.checkServerHealth();
            await this.checkAIFeatures();
            await this.checkBlockchainFeatures();
            await this.checkIoTFeatures();
            await this.checkRealtimeFeatures();
            await this.checkMobileFeatures();
            await this.checkSecurityFeatures();
            
            this.calculateOverallScore();
            this.generateReport();
            
        } catch (error) {
            console.error('❌ Health check failed:', error.message);
            this.results.overall.status = 'error';
            this.results.overall.error = error.message;
        }
        
        return this.results;
    }

    async checkServerHealth() {
        console.log('🖥️ Checking Server Health...');
        
        try {
            const start = Date.now();
            const response = await this.makeRequest('GET', '/api/health');
            const responseTime = Date.now() - start;
            
            this.results.server = {
                status: response.success ? 'healthy' : 'unhealthy',
                responseTime,
                uptime: response.data?.uptime || 'unknown',
                version: response.data?.version || 'unknown',
                features: response.data?.features || {}
            };
            
            console.log(`   Status: ${this.results.server.status}`);
            console.log(`   Response Time: ${responseTime}ms`);
            console.log(`   Version: ${this.results.server.version}`);
            
        } catch (error) {
            this.results.server = {
                status: 'error',
                responseTime: 0,
                error: error.message
            };
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    async checkAIFeatures() {
        console.log('🤖 Checking AI Features...');
        
        const aiEndpoints = [
            '/api/ai/student/123/performance',
            '/api/ai/student/123/behavior',
            '/api/ai/campus-analytics'
        ];
        
        let workingEndpoints = 0;
        
        for (const endpoint of aiEndpoints) {
            try {
                const response = await this.makeRequest('GET', endpoint);
                if (response.success) {
                    workingEndpoints++;
                    console.log(`   ✅ ${endpoint}`);
                } else {
                    console.log(`   ❌ ${endpoint} - ${response.error || 'Failed'}`);
                }
            } catch (error) {
                console.log(`   ❌ ${endpoint} - ${error.message}`);
            }
        }
        
        this.results.ai = {
            status: workingEndpoints === aiEndpoints.length ? 'healthy' : 'partial',
            endpoints: workingEndpoints,
            total: aiEndpoints.length,
            features: ['performance', 'behavior', 'analytics', 'predictions']
        };
        
        console.log(`   Status: ${this.results.ai.status} (${workingEndpoints}/${aiEndpoints.length})`);
    }

    async checkBlockchainFeatures() {
        console.log('🔗 Checking Blockchain Features...');
        
        const blockchainEndpoints = [
            { method: 'POST', path: '/api/blockchain/certificate', data: { type: 'degree', studentId: '123' } },
            { method: 'GET', path: '/api/blockchain/certificate/SC12345/verify' },
            { method: 'GET', path: '/api/blockchain/student/123/certificates' }
        ];
        
        let workingEndpoints = 0;
        
        for (const endpoint of blockchainEndpoints) {
            try {
                const response = await this.makeRequest(endpoint.method, endpoint.path, endpoint.data);
                if (response.success) {
                    workingEndpoints++;
                    console.log(`   ✅ ${endpoint.method} ${endpoint.path}`);
                } else {
                    console.log(`   ❌ ${endpoint.method} ${endpoint.path} - ${response.error || 'Failed'}`);
                }
            } catch (error) {
                console.log(`   ❌ ${endpoint.method} ${endpoint.path} - ${error.message}`);
            }
        }
        
        this.results.blockchain = {
            status: workingEndpoints === blockchainEndpoints.length ? 'healthy' : 'partial',
            endpoints: workingEndpoints,
            total: blockchainEndpoints.length,
            features: ['certificates', 'verification', 'digital-signatures', 'qr-codes']
        };
        
        console.log(`   Status: ${this.results.blockchain.status} (${workingEndpoints}/${blockchainEndpoints.length})`);
    }

    async checkIoTFeatures() {
        console.log('🌐 Checking IoT Features...');
        
        const iotEndpoints = [
            '/api/iot/devices',
            '/api/iot/room/101/analytics',
            '/api/iot/campus-analytics',
            { method: 'POST', path: '/api/iot/device/TEMP_001/control', data: { command: 'set_temperature', parameters: { value: 22 } } }
        ];
        
        let workingEndpoints = 0;
        
        for (const endpoint of iotEndpoints) {
            try {
                const response = await this.makeRequest(endpoint.method || 'GET', endpoint.path, endpoint.data);
                if (response.success) {
                    workingEndpoints++;
                    console.log(`   ✅ ${endpoint.method || 'GET'} ${endpoint.path}`);
                } else {
                    console.log(`   ❌ ${endpoint.method || 'GET'} ${endpoint.path} - ${response.error || 'Failed'}`);
                }
            } catch (error) {
                console.log(`   ❌ ${endpoint.method || 'GET'} ${endpoint.path} - ${error.message}`);
            }
        }
        
        this.results.iot = {
            status: workingEndpoints === iotEndpoints.length ? 'healthy' : 'partial',
            endpoints: workingEndpoints,
            total: iotEndpoints.length,
            features: ['device-management', 'analytics', 'control', 'automation']
        };
        
        console.log(`   Status: ${this.results.iot.status} (${workingEndpoints}/${iotEndpoints.length})`);
    }

    async checkRealtimeFeatures() {
        console.log('🔄 Checking Real-time Features...');
        
        try {
            const response = await this.makeRequest('GET', '/api/realtime/status');
            
            this.results.realtime = {
                status: response.success ? 'healthy' : 'unhealthy',
                endpoints: response.success ? 1 : 0,
                total: 1,
                features: response.data?.features || {},
                connectedUsers: response.data?.connectedUsers || 0,
                activeRooms: response.data?.activeRooms || 0
            };
            
            console.log(`   Status: ${this.results.realtime.status}`);
            console.log(`   Connected Users: ${this.results.realtime.connectedUsers}`);
            
        } catch (error) {
            this.results.realtime = {
                status: 'error',
                endpoints: 0,
                total: 1,
                error: error.message
            };
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    async checkMobileFeatures() {
        console.log('📱 Checking Mobile Features...');
        
        try {
            const response = await this.makeRequest('GET', '/api/mobile/optimized');
            
            this.results.mobile = {
                status: response.success ? 'healthy' : 'unhealthy',
                endpoints: response.success ? 1 : 0,
                total: 1,
                features: response.data?.features || {},
                platform: response.data?.platform || 'unknown',
                loadTime: response.data?.performance?.loadTime || 'unknown'
            };
            
            console.log(`   Status: ${this.results.mobile.status}`);
            console.log(`   Platform: ${this.results.mobile.platform}`);
            
        } catch (error) {
            this.results.mobile = {
                status: 'error',
                endpoints: 0,
                total: 1,
                error: error.message
            };
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    async checkSecurityFeatures() {
        console.log('🛡️ Checking Security Features...');
        
        try {
            const response = await this.makeRequest('GET', '/api/security/overview');
            
            this.results.security = {
                status: response.success ? 'healthy' : 'unhealthy',
                endpoints: response.success ? 1 : 0,
                total: 1,
                threatLevel: response.data?.threatLevel || 'unknown',
                protections: response.data?.protections || {},
                compliance: response.data?.compliance || {}
            };
            
            console.log(`   Status: ${this.results.security.status}`);
            console.log(`   Threat Level: ${this.results.security.threatLevel}`);
            
        } catch (error) {
            this.results.security = {
                status: 'error',
                endpoints: 0,
                total: 1,
                error: error.message
            };
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    async makeRequest(method, path, data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                hostname: new URL(this.baseUrl).hostname,
                port: new URL(this.baseUrl).port || 80,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Smart-Campus-Health-Check/1.0'
                }
            };

            if (data) {
                const postData = JSON.stringify(data);
                options.headers['Content-Length'] = Buffer.byteLength(postData);
            }

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const data = body ? JSON.parse(body) : {};
                        resolve({
                            success: res.statusCode >= 200 && res.statusCode < 300,
                            statusCode: res.statusCode,
                            data
                        });
                    } catch (e) {
                        resolve({
                            success: false,
                            statusCode: res.statusCode,
                            error: 'Invalid JSON response'
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

    calculateOverallScore() {
        const categories = [
            this.results.server,
            this.results.ai,
            this.results.blockchain,
            this.results.iot,
            this.results.realtime,
            this.results.mobile,
            this.results.security
        ];

        let totalScore = 0;
        let healthyCategories = 0;

        categories.forEach(category => {
            let categoryScore = 0;
            
            if (category.status === 'healthy') {
                categoryScore = 100;
                healthyCategories++;
            } else if (category.status === 'partial') {
                categoryScore = 70;
            } else if (category.status === 'unhealthy') {
                categoryScore = 30;
            } else if (category.status === 'error') {
                categoryScore = 0;
            }
            
            // Weight scores by importance
            const weights = {
                server: 1.5,
                ai: 1.3,
                blockchain: 1.2,
                iot: 1.1,
                realtime: 1.0,
                mobile: 0.8,
                security: 1.4
            };
            
            totalScore += categoryScore * (weights[category === this.results.server ? 'server' : 'ai'] || 1);
        });

        this.results.overall = {
            score: Math.round(totalScore / Object.keys(categories).length),
            status: totalScore >= 80 ? 'excellent' : totalScore >= 60 ? 'good' : totalScore >= 40 ? 'fair' : 'poor',
            healthyCategories,
            totalCategories: categories.length,
            healthPercentage: Math.round((healthyCategories / categories.length) * 100)
        };
    }

    generateReport() {
        const endTime = performance.now();
        const totalTime = Math.round(endTime - this.startTime);
        
        console.log('\n' + '='.repeat(60));
        console.log('🏥 SMART CAMPUS SYSTEM HEALTH REPORT');
        console.log('='.repeat(60));
        
        console.log(`\n📊 OVERALL SCORE: ${this.results.overall.score}/100 (${this.results.overall.status.toUpperCase()})`);
        console.log(`🏥 HEALTH: ${this.results.overall.healthPercentage}% (${this.results.overall.healthyCategories}/${this.results.overall.totalCategories} systems healthy)`);
        console.log(`⏱️ CHECK COMPLETED IN: ${totalTime}ms`);
        
        console.log('\n📋 SYSTEM BREAKDOWN:');
        console.log('┌─────────────────────────────────────────────────┐');
        console.log('│ SYSTEM           │ STATUS    │ ENDPOINTS │ FEATURES                          │');
        console.log('├─────────────────────────────────────────────────┤');
        console.log(`│ Server          │ ${this.results.server.status.padEnd(9)} │ ${this.results.server.responseTime}ms     │ Health Check, v${this.results.server.version}     │`);
        console.log(`│ AI Analytics     │ ${this.results.ai.status.padEnd(9)} │ ${this.results.ai.endpoints}/${this.results.ai.total}     │ Performance, Behavior, Predictions         │`);
        console.log(`│ Blockchain       │ ${this.results.blockchain.status.padEnd(9)} │ ${this.results.blockchain.endpoints}/${this.results.blockchain.total}     │ Certificates, Verification, Signatures   │`);
        console.log(`│ IoT Smart Campus │ ${this.results.iot.status.padEnd(9)} │ ${this.results.iot.endpoints}/${this.results.iot.total}     │ Devices, Analytics, Automation          │`);
        console.log(`│ Real-time       │ ${this.results.realtime.status.padEnd(9)} │ ${this.results.realtime.endpoints}/${this.results.realtime.total}     │ Chat, Video, Screen Sharing          │`);
        console.log(`│ Mobile          │ ${this.results.mobile.status.padEnd(9)} │ ${this.results.mobile.endpoints}/${this.results.mobile.total}     │ PWA, Offline, Push Notifications       │`);
        console.log(`│ Security         │ ${this.results.security.status.padEnd(9)} │ ${this.results.security.endpoints}/${this.results.security.total}     │ Auth, Encryption, Monitoring          │`);
        console.log('└─────────────────────────────────────────────────┘');
        
        console.log('\n🎯 RECOMMENDATIONS:');
        if (this.results.overall.score < 80) {
            console.log('⚠️ SYSTEM OPTIMIZATION NEEDED:');
            console.log('   • Check failing endpoints');
            console.log('   • Review error logs');
            console.log('   • Optimize performance');
        }
        
        if (this.results.overall.score >= 80) {
            console.log('✅ SYSTEM EXCELLENT:');
            console.log('   • All systems operational');
            console.log('   • Ready for production deployment');
            console.log('   • Performance optimized');
        }
        
        console.log('\n🚀 DEPLOYMENT READINESS:');
        const deploymentReady = this.results.overall.score >= 70;
        console.log(`Status: ${deploymentReady ? '✅ READY' : '⚠️ NEEDS ATTENTION'}`);
        console.log(`Score Required: ${deploymentReady ? '70+ (Current: ' + this.results.overall.score + ')' : '70+ (Current: ' + this.results.overall.score + ')'}`);
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 SMART CAMPUS NEXT-LEVEL SYSTEM CHECK COMPLETE! 🎉');
        console.log('='.repeat(60));
        
        // Save detailed report
        this.saveDetailedReport(totalTime);
    }

    saveDetailedReport(totalTime) {
        const report = {
            timestamp: new Date().toISOString(),
            checkDuration: totalTime,
            results: this.results,
            summary: {
                overallScore: this.results.overall.score,
                overallStatus: this.results.overall.status,
                healthPercentage: this.results.overall.healthPercentage,
                deploymentReady: this.results.overall.score >= 70
            },
            recommendations: this.generateRecommendations()
        };
        
        require('fs').writeFileSync(
            'system-health-report.json',
            JSON.stringify(report, null, 2)
        );
        
        console.log('\n📁 Detailed report saved to: system-health-report.json');
    }

    generateRecommendations() {
        const recommendations = [];
        
        if (this.results.server.status !== 'healthy') {
            recommendations.push({
                category: 'Server',
                priority: 'high',
                action: 'Fix server connectivity and response time issues'
            });
        }
        
        if (this.results.ai.status !== 'healthy') {
            recommendations.push({
                category: 'AI Analytics',
                priority: 'high',
                action: 'Check AI service dependencies and model loading'
            });
        }
        
        if (this.results.blockchain.status !== 'healthy') {
            recommendations.push({
                category: 'Blockchain',
                priority: 'medium',
                action: 'Verify blockchain service initialization and dependencies'
            });
        }
        
        if (this.results.iot.status !== 'healthy') {
            recommendations.push({
                category: 'IoT',
                priority: 'medium',
                action: 'Check MQTT broker connection and device registration'
            });
        }
        
        if (this.results.realtime.status !== 'healthy') {
            recommendations.push({
                category: 'Real-time',
                priority: 'medium',
                action: 'Verify WebSocket server and Socket.IO configuration'
            });
        }
        
        if (this.results.mobile.status !== 'healthy') {
            recommendations.push({
                category: 'Mobile',
                priority: 'low',
                action: 'Optimize mobile API responses and PWA configuration'
            });
        }
        
        if (this.results.security.status !== 'healthy') {
            recommendations.push({
                category: 'Security',
                priority: 'high',
                action: 'Review security middleware and authentication systems'
            });
        }
        
        return recommendations;
    }
}

// Run health check if this script is executed directly
if (require.main === module) {
    const healthCheck = new SystemHealthCheck();
    healthCheck.runFullCheck().then(() => {
        console.log('\n🏁 Health check completed. Review the report above.');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Health check failed:', error);
        process.exit(1);
    });
}

module.exports = SystemHealthCheck;
