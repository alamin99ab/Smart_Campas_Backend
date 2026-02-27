/**
 * 🔍 COMPREHENSIVE SYSTEM AUDIT
 * Complete API analysis and system health check
 */

const http = require('http');
const fs = require('fs');

class SystemAuditor {
    constructor() {
        this.baseUrl = process.env.API_BASE_URL || 'http://localhost:5001';
        this.results = {
            endpoints: [],
            categories: {},
            issues: [],
            recommendations: [],
            completeness: 0,
            healthScore: 0
        };
        this.startTime = Date.now();
    }

    async runComprehensiveAudit() {
        console.log('🔍 Starting Comprehensive System Audit...\n');
        
        try {
            await this.checkAllEndpoints();
            await this.analyzeCategories();
            await this.identifyIssues();
            await this.generateRecommendations();
            await this.calculateCompleteness();
            await this.generateReport();
            
        } catch (error) {
            console.error('❌ Audit failed:', error.message);
            this.results.error = error.message;
        }
        
        return this.results;
    }

    async checkAllEndpoints() {
        console.log('🌐 Checking All API Endpoints...');
        
        const endpointCategories = {
            health: [
                { method: 'GET', path: '/api/health', expected: 200, description: 'System health check' }
            ],
            ai: [
                { method: 'GET', path: '/api/ai/student/:id/performance', expected: 200, description: 'Student performance analysis' },
                { method: 'GET', path: '/api/ai/student/:id/behavior', expected: 200, description: 'Student behavior analysis' },
                { method: 'GET', path: '/api/ai/campus-analytics', expected: 200, description: 'Campus-wide AI analytics' },
                { method: 'POST', path: '/api/ai/sentiment-analysis', expected: 200, description: 'Sentiment analysis' },
                { method: 'POST', path: '/api/ai/schedule-optimization', expected: 200, description: 'Schedule optimization' },
                { method: 'GET', path: '/api/ai/alerts', expected: 200, description: 'AI-powered alerts' },
                { method: 'GET', path: '/api/ai/insights', expected: 200, description: 'AI insights dashboard' }
            ],
            blockchain: [
                { method: 'POST', path: '/api/blockchain/certificate', expected: 200, description: 'Create blockchain certificate' },
                { method: 'GET', path: '/api/blockchain/certificate/:id/verify', expected: 200, description: 'Verify certificate' },
                { method: 'GET', path: '/api/blockchain/student/:id/certificates', expected: 200, description: 'Get student certificates' },
                { method: 'GET', path: '/api/blockchain/stats', expected: 200, description: 'Blockchain statistics' }
            ],
            iot: [
                { method: 'GET', path: '/api/iot/devices', expected: 200, description: 'List IoT devices' },
                { method: 'GET', path: '/api/iot/room/:roomId/analytics', expected: 200, description: 'Room analytics' },
                { method: 'GET', path: '/api/iot/campus-analytics', expected: 200, description: 'Campus IoT analytics' },
                { method: 'POST', path: '/api/iot/device/:id/control', expected: 200, description: 'Control IoT device' },
                { method: 'GET', path: '/api/iot/alerts', expected: 200, description: 'IoT alerts' }
            ],
            realtime: [
                { method: 'GET', path: '/api/realtime/status', expected: 200, description: 'Real-time communication status' }
            ],
            mobile: [
                { method: 'GET', path: '/api/mobile/optimized', expected: 200, description: 'Mobile optimization status' }
            ],
            security: [
                { method: 'GET', path: '/api/security/overview', expected: 200, description: 'Security overview' }
            ],
            i18n: [
                { method: 'GET', path: '/api/i18n/languages', expected: 200, description: 'Multi-language support' }
            ],
            superAdmin: [
                { method: 'POST', path: '/api/super-admin/login', expected: 200, description: 'Super admin login' },
                { method: 'GET', path: '/api/super-admin/dashboard', expected: 200, description: 'Super admin dashboard' },
                { method: 'GET', path: '/api/super-admin/system-settings', expected: 200, description: 'System settings' },
                { method: 'GET', path: '/api/super-admin/users', expected: 200, description: 'User management' },
                { method: 'POST', path: '/api/super-admin/users', expected: 201, description: 'Create user' },
                { method: 'GET', path: '/api/super-admin/schools', expected: 200, description: 'School management' },
                { method: 'POST', path: '/api/super-admin/schools', expected: 201, description: 'Create school' },
                { method: 'GET', path: '/api/super-admin/analytics', expected: 200, description: 'System analytics' },
                { method: 'GET', path: '/api/super-admin/audit-logs', expected: 200, description: 'Audit logs' }
            ],
            authentication: [
                { method: 'POST', path: '/api/auth/login', expected: 200, description: 'User login' },
                { method: 'POST', path: '/api/auth/register', expected: 201, description: 'User registration' },
                { method: 'POST', path: '/api/auth/logout', expected: 200, description: 'User logout' },
                { method: 'POST', path: '/api/auth/refresh', expected: 200, description: 'Token refresh' }
            ],
            users: [
                { method: 'GET', path: '/api/students', expected: 200, description: 'Student management' },
                { method: 'GET', path: '/api/teachers', expected: 200, description: 'Teacher management' },
                { method: 'GET', path: '/api/dashboard', expected: 200, description: 'User dashboard' },
                { method: 'GET', path: '/api/analytics', expected: 200, description: 'User analytics' }
            ]
        };

        let totalEndpoints = 0;
        let workingEndpoints = 0;

        for (const [category, endpoints] of Object.entries(endpointCategories)) {
            this.results.categories[category] = {
                total: endpoints.length,
                working: 0,
                issues: []
            };

            for (const endpoint of endpoints) {
                totalEndpoints++;
                const result = await this.testEndpoint(endpoint);
                
                this.results.endpoints.push(result);
                
                if (result.working) {
                    workingEndpoints++;
                    this.results.categories[category].working++;
                } else {
                    this.results.categories[category].issues.push(result.error);
                    this.results.issues.push(result);
                }
            }
        }

        this.results.endpointSummary = {
            total: totalEndpoints,
            working: workingEndpoints,
            failed: totalEndpoints - workingEndpoints,
            successRate: ((workingEndpoints / totalEndpoints) * 100).toFixed(2) + '%'
        };

        console.log(`   Total Endpoints: ${totalEndpoints}`);
        console.log(`   Working: ${workingEndpoints}`);
        console.log(`   Failed: ${totalEndpoints - workingEndpoints}`);
        console.log(`   Success Rate: ${this.results.endpointSummary.successRate}`);
    }

    async testEndpoint(endpoint) {
        try {
            const startTime = Date.now();
            const response = await this.makeRequest(endpoint.method, endpoint.path);
            const responseTime = Date.now() - startTime;

            const working = response.statusCode === endpoint.expected;
            
            return {
                category: this.getCategoryFromPath(endpoint.path),
                method: endpoint.method,
                path: endpoint.path,
                expectedStatus: endpoint.expected,
                actualStatus: response.statusCode,
                working,
                responseTime,
                description: endpoint.description,
                error: working ? null : `Status ${response.statusCode} (expected ${endpoint.expected})`,
                data: response.success ? response.data : null
            };
        } catch (error) {
            return {
                category: this.getCategoryFromPath(endpoint.path),
                method: endpoint.method,
                path: endpoint.path,
                expectedStatus: endpoint.expected,
                actualStatus: 0,
                working: false,
                responseTime: 0,
                description: endpoint.description,
                error: error.message,
                data: null
            };
        }
    }

    getCategoryFromPath(path) {
        if (path.includes('/ai/')) return 'ai';
        if (path.includes('/blockchain/')) return 'blockchain';
        if (path.includes('/iot/')) return 'iot';
        if (path.includes('/realtime/')) return 'realtime';
        if (path.includes('/mobile/')) return 'mobile';
        if (path.includes('/security/')) return 'security';
        if (path.includes('/i18n/')) return 'i18n';
        if (path.includes('/super-admin/')) return 'superAdmin';
        if (path.includes('/auth/')) return 'authentication';
        if (path.includes('/students') || path.includes('/teachers') || path.includes('/dashboard') || path.includes('/analytics')) return 'users';
        if (path.includes('/health')) return 'health';
        return 'unknown';
    }

    async analyzeCategories() {
        console.log('\n📊 Analyzing API Categories...');
        
        for (const [category, data] of Object.entries(this.results.categories)) {
            const successRate = data.total > 0 ? ((data.working / data.total) * 100).toFixed(1) : '0';
            const health = data.working === data.total ? 'excellent' : 
                        data.working >= data.total * 0.8 ? 'good' : 
                        data.working >= data.total * 0.5 ? 'fair' : 'poor';
            
            console.log(`   ${category.toUpperCase()}: ${health} (${data.working}/${data.total} - ${successRate}%)`);
        }
    }

    async identifyIssues() {
        console.log('\n🚨 Identifying System Issues...');
        
        const criticalIssues = [];
        const warnings = [];
        const improvements = [];

        // Check for critical failures
        this.results.endpoints.forEach(endpoint => {
            if (!endpoint.working) {
                if (endpoint.category === 'health') {
                    criticalIssues.push({
                        severity: 'critical',
                        issue: 'Health check endpoint not working',
                        impact: 'System monitoring unavailable',
                        endpoint: endpoint.path
                    });
                }
                
                if (endpoint.category === 'authentication') {
                    criticalIssues.push({
                        severity: 'critical',
                        issue: 'Authentication system failure',
                        impact: 'Users cannot access system',
                        endpoint: endpoint.path
                    });
                }
                
                if (endpoint.category === 'superAdmin') {
                    criticalIssues.push({
                        severity: 'critical',
                        issue: 'Super admin functionality compromised',
                        impact: 'System administration unavailable',
                        endpoint: endpoint.path
                    });
                }
            }
            
            // Check for slow responses
            if (endpoint.responseTime > 2000) {
                warnings.push({
                    severity: 'warning',
                    issue: `Slow response time: ${endpoint.responseTime}ms`,
                    impact: 'Poor user experience',
                    endpoint: endpoint.path
                });
            }
        });

        // Check category health
        Object.entries(this.results.categories).forEach(([category, data]) => {
            if (data.working === 0 && data.total > 0) {
                criticalIssues.push({
                    severity: 'critical',
                    issue: `Entire ${category} category not working`,
                    impact: `${category} functionality completely unavailable`
                });
            } else if (data.working < data.total * 0.5) {
                warnings.push({
                    severity: 'warning',
                    issue: `${category} category partially working`,
                    impact: `Some ${category} features unavailable`
                });
            }
        });

        this.results.issues = [...criticalIssues, ...warnings];
        
        console.log(`   Critical Issues: ${criticalIssues.length}`);
        console.log(`   Warnings: ${warnings.length}`);
    }

    async generateRecommendations() {
        console.log('\n💡 Generating Recommendations...');
        
        const recommendations = [];

        // Critical issue recommendations
        const criticalIssues = this.results.issues.filter(i => i.severity === 'critical');
        if (criticalIssues.length > 0) {
            recommendations.push({
                priority: 'critical',
                category: 'System Stability',
                action: 'Fix critical endpoint failures immediately',
                details: criticalIssues.map(i => i.issue).join('; ')
            });
        }

        // Performance recommendations
        const slowEndpoints = this.results.endpoints.filter(e => e.responseTime > 2000);
        if (slowEndpoints.length > 0) {
            recommendations.push({
                priority: 'high',
                category: 'Performance',
                action: 'Optimize slow endpoints',
                details: `${slowEndpoints.length} endpoints responding slowly`
            });
        }

        // Feature completeness recommendations
        Object.entries(this.results.categories).forEach(([category, data]) => {
            if (data.working < data.total) {
                recommendations.push({
                    priority: 'medium',
                    category: 'Feature Completeness',
                    action: `Complete ${category} implementation`,
                    details: `${data.total - data.working} ${category} endpoints not working`
                });
            }
        });

        // Security recommendations
        const authIssues = this.results.issues.filter(i => i.category === 'authentication' || i.category === 'security');
        if (authIssues.length > 0) {
            recommendations.push({
                priority: 'high',
                category: 'Security',
                action: 'Strengthen authentication and security',
                details: `${authIssues.length} security-related issues found`
            });
        }

        this.results.recommendations = recommendations;
        
        console.log(`   Generated ${recommendations.length} recommendations`);
    }

    async calculateCompleteness() {
        console.log('\n📈 Calculating System Completeness...');
        
        let totalEndpoints = 0;
        let workingEndpoints = 0;
        let maxScore = 0;

        Object.values(this.results.categories).forEach(category => {
            totalEndpoints += category.total;
            workingEndpoints += category.working;
            maxScore += category.total;
        });

        // Calculate weighted score (some categories more important)
        const weights = {
            health: 2,        // Critical
            authentication: 2,  // Critical
            superAdmin: 2,      // Critical
            ai: 1.5,           // High priority
            blockchain: 1.5,     // High priority
            iot: 1.5,          // High priority
            realtime: 1.5,     // High priority
            mobile: 1.2,        // Medium priority
            security: 2,       // Critical
            i18n: 1,           // Low priority
            users: 1             // Medium priority
        };

        let weightedScore = 0;
        Object.entries(this.results.categories).forEach(([category, data]) => {
            const weight = weights[category] || 1;
            weightedScore += (data.working / data.total) * weight * data.total;
        });

        const maxWeightedScore = maxScore * 2; // Maximum possible score
        
        this.results.completeness = {
            percentage: Math.round((weightedScore / maxWeightedScore) * 100),
            grade: this.getGrade(Math.round((weightedScore / maxWeightedScore) * 100)),
            totalEndpoints,
            workingEndpoints,
            failedEndpoints: totalEndpoints - workingEndpoints,
            weightedScore: Math.round(weightedScore),
            maxWeightedScore
        };

        console.log(`   Completeness: ${this.results.completeness.percentage}% (${this.results.completeness.grade})`);
    }

    getGrade(score) {
        if (score >= 95) return 'A+';
        if (score >= 90) return 'A';
        if (score >= 85) return 'B+';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C+';
        if (score >= 60) return 'C';
        if (score >= 50) return 'D';
        return 'F';
    }

    async generateReport() {
        console.log('\n📋 Generating Comprehensive Report...');
        
        const endTime = Date.now();
        const duration = endTime - this.startTime;

        const report = {
            metadata: {
                timestamp: new Date().toISOString(),
                duration: duration,
                auditor: 'Smart Campus System Auditor v1.0',
                environment: process.env.NODE_ENV || 'development'
            },
            summary: {
                totalEndpoints: this.results.endpointSummary.total,
                workingEndpoints: this.results.endpointSummary.working,
                failedEndpoints: this.results.endpointSummary.failed,
                successRate: this.results.endpointSummary.successRate,
                completeness: this.results.completeness,
                healthScore: this.calculateHealthScore()
            },
            categories: this.results.categories,
            endpoints: this.results.endpoints,
            issues: this.results.issues,
            recommendations: this.results.recommendations,
            nextSteps: this.generateNextSteps()
        };

        // Save detailed report
        fs.writeFileSync('comprehensive-system-audit.json', JSON.stringify(report, null, 2));
        
        // Save summary report
        const summary = {
            timestamp: report.metadata.timestamp,
            completeness: report.summary.completeness.percentage + '%',
            grade: report.summary.completeness.grade,
            totalEndpoints: report.summary.totalEndpoints,
            workingEndpoints: report.summary.workingEndpoints,
            criticalIssues: report.issues.filter(i => i.severity === 'critical').length,
            healthScore: report.summary.healthScore,
            status: this.getOverallStatus()
        };

        fs.writeFileSync('system-audit-summary.json', JSON.stringify(summary, null, 2));
        
        this.displayReport(report);
    }

    calculateHealthScore() {
        let score = 0;
        let maxScore = 0;

        Object.entries(this.results.categories).forEach(([category, data]) => {
            const weights = {
                health: 20, authentication: 20, superAdmin: 20, security: 20,
                ai: 15, blockchain: 15, iot: 15, realtime: 15,
                mobile: 12, i18n: 8, users: 10
            };
            
            score += (data.working / data.total) * weights[category];
            maxScore += weights[category];
        });

        return Math.round((score / maxScore) * 100);
    }

    getOverallStatus() {
        const completeness = this.results.completeness.percentage;
        const criticalIssues = this.results.issues.filter(i => i.severity === 'critical').length;
        
        if (completeness >= 95 && criticalIssues === 0) return 'EXCELLENT';
        if (completeness >= 85 && criticalIssues <= 1) return 'VERY GOOD';
        if (completeness >= 75 && criticalIssues <= 2) return 'GOOD';
        if (completeness >= 60 && criticalIssues <= 3) return 'FAIR';
        if (completeness >= 40) return 'POOR';
        return 'CRITICAL';
    }

    generateNextSteps() {
        const steps = [];
        
        if (this.results.completeness.percentage < 80) {
            steps.push({
                priority: 'high',
                action: 'Fix critical endpoint failures',
                timeline: 'Immediate'
            });
        }

        if (this.results.issues.some(i => i.severity === 'critical')) {
            steps.push({
                priority: 'high',
                action: 'Address critical security issues',
                timeline: 'Immediate'
            });
        }

        const slowEndpoints = this.results.endpoints.filter(e => e.responseTime > 2000);
        if (slowEndpoints.length > 0) {
            steps.push({
                priority: 'medium',
                action: 'Optimize slow endpoints',
                timeline: '1 week'
            });
        }

        steps.push({
            priority: 'medium',
            action: 'Complete missing features',
            timeline: '2 weeks'
        });

        steps.push({
            priority: 'low',
            action: 'Add advanced monitoring',
            timeline: '1 month'
        });

        return steps;
    }

    displayReport(report) {
        console.log('\n' + '='.repeat(80));
        console.log('🔍 COMPREHENSIVE SYSTEM AUDIT REPORT');
        console.log('='.repeat(80));
        
        console.log('\n📊 EXECUTIVE SUMMARY:');
        console.log(`   Overall Status: ${report.summary.healthScore}/100 (${this.getOverallStatus()})`);
        console.log(`   Completeness: ${report.summary.completeness.percentage}% (${report.summary.completeness.grade})`);
        console.log(`   Endpoints: ${report.summary.workingEndpoints}/${report.summary.totalEndpoints} working`);
        console.log(`   Success Rate: ${report.summary.successRate}`);
        console.log(`   Critical Issues: ${report.issues.filter(i => i.severity === 'critical').length}`);
        
        console.log('\n📈 CATEGORY BREAKDOWN:');
        Object.entries(report.categories).forEach(([category, data]) => {
            const status = data.working === data.total ? '✅' : 
                       data.working >= data.total * 0.8 ? '🟡' : 
                       data.working >= data.total * 0.5 ? '🟠' : '❌';
            console.log(`   ${status} ${category.toUpperCase()}: ${data.working}/${data.total} (${((data.working/data.total)*100).toFixed(1)}%)`);
        });
        
        console.log('\n🚨 CRITICAL ISSUES:');
        const criticalIssues = report.issues.filter(i => i.severity === 'critical');
        if (criticalIssues.length > 0) {
            criticalIssues.forEach((issue, index) => {
                console.log(`   ${index + 1}. ${issue.issue} (${issue.severity.toUpperCase()})`);
                console.log(`      Impact: ${issue.impact}`);
                console.log(`      Endpoint: ${issue.endpoint}`);
            });
        } else {
            console.log('   ✅ No critical issues found');
        }
        
        console.log('\n💡 TOP RECOMMENDATIONS:');
        report.recommendations.slice(0, 5).forEach((rec, index) => {
            console.log(`   ${index + 1}. ${rec.action} (${rec.priority.toUpperCase()})`);
            console.log(`      ${rec.details}`);
        });
        
        console.log('\n🚀 NEXT STEPS:');
        report.nextSteps.forEach((step, index) => {
            console.log(`   ${index + 1}. ${step.action} (${step.timeline})`);
        });
        
        console.log('\n' + '='.repeat(80));
        console.log(`📁 Detailed reports saved:`);
        console.log(`   comprehensive-system-audit.json`);
        console.log(`   system-audit-summary.json`);
        console.log('='.repeat(80));
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
                    'User-Agent': 'Smart-Campus-Auditor/1.0'
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
                            data: responseData
                        });
                    } catch (e) {
                        resolve({
                            statusCode: res.statusCode,
                            success: false,
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
}

// Run audit if this script is executed directly
if (require.main === module) {
    const auditor = new SystemAuditor();
    auditor.runComprehensiveAudit().then(() => {
        console.log('\n🎉 AUDIT COMPLETE! Review the generated reports for detailed analysis.');
        process.exit(0);
    }).catch(error => {
        console.error('❌ Audit failed:', error.message);
        process.exit(1);
    });
}

module.exports = SystemAuditor;
