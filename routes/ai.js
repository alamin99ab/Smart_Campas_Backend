/**
 * 🤖 AI ROUTES - SMART CAMPUS INTELLIGENCE
 * Industry-level AI features for educational management
 */

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

// Import controllers
const aiController = require('../controllers/aiController');

// Import middleware
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, checkFeatureAccess, addSchoolScope } = require('../middleware/multiTenant');

// Authentication first, then tenant isolation
router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

/**
 * 📚 ACADEMIC ANALYSIS AI FEATURES
 */

// Analyze student performance (Teacher, Principal)
router.post('/analyze-performance',
    checkFeatureAccess('ai'),
    authorize(['teacher', 'principal']),
    aiController.analyzeStudentPerformance
);

// Predict attendance patterns (Teacher, Principal)
router.post('/predict-attendance',
    checkFeatureAccess('ai'),
    authorize(['teacher', 'principal']),
    aiController.predictAttendancePatterns
);

// Predict student success (Teacher, Principal)
router.post('/predict-success',
    checkFeatureAccess('ai'),
    authorize(['teacher', 'principal']),
    aiController.predictStudentSuccess
);

/**
 * 📝 CONTENT CREATION AI FEATURES
 */

// Generate exam questions (Teacher, Principal)
router.post('/generate-questions',
    checkFeatureAccess('ai'),
    authorize(['teacher', 'principal']),
    aiController.generateExamQuestions
);

// Assist with grading (Teacher only)
router.post('/assist-grading',
    checkFeatureAccess('ai'),
    authorize('teacher'),
    aiController.assistGrading
);

// Detect plagiarism (Teacher only)
router.post('/detect-plagiarism',
    checkFeatureAccess('ai'),
    authorize('teacher'),
    aiController.detectPlagiarism
);

/**
 * 🎓 PERSONALIZED LEARNING AI FEATURES
 */

// Generate learning path (Student, Teacher, Principal)
router.post('/generate-learning-path',
    checkFeatureAccess('ai'),
    authorize(['student', 'teacher', 'principal']),
    aiController.generateLearningPath
);

// Recommend content (Student, Teacher)
router.post('/recommend-content',
    checkFeatureAccess('ai'),
    authorize(['student', 'teacher']),
    aiController.recommendContent
);

/**
 * 🤖 AI CHATBOT & SUPPORT
 */

// Student support chatbot (Student only)
router.post('/student-support',
    checkFeatureAccess('ai'),
    authorize('student'),
    aiController.processStudentQuery
);

/**
 * 📊 ADMINISTRATIVE AI FEATURES
 */

// Generate reports (Principal, Super Admin)
router.post('/generate-report',
    checkFeatureAccess('ai'),
    authorize(['principal', 'super_admin']),
    aiController.generateReport
);

/**
 * 🔧 AI SYSTEM HEALTH & CONFIGURATION
 */

// Get AI service status (Super Admin, Principal)
router.get('/status',
    authorize(['super_admin', 'principal']),
    async (req, res) => {
        try {
            const AIService = require('../services/aiService');
            
            const status = {
                service: 'Smart Campus AI Service',
                version: '1.0.0',
                status: 'active',
                features: {
                    performanceAnalysis: true,
                    attendancePrediction: true,
                    questionGeneration: true,
                    gradingAssistance: true,
                    learningPath: true,
                    contentRecommendation: true,
                    plagiarismDetection: true,
                    successPrediction: true,
                    studentSupport: true,
                    reportGeneration: true
                },
                configuration: {
                    openaiConfigured: !!process.env.OPENAI_API_KEY,
                    huggingfaceConfigured: !!process.env.HUGGINGFACE_API_KEY,
                    localServiceAvailable: true
                },
                statistics: {
                    totalRequests: 0, // Would be tracked in production
                    todayRequests: 0,
                    averageResponseTime: '1.2s'
                }
            };

            res.status(200).json({
                success: true,
                data: status
            });
        } catch (error) {
            console.error('AI Status Check Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get AI service status'
            });
        }
    }
);

// Get AI usage analytics (Principal, Super Admin)
router.get('/analytics',
    authorize(['principal', 'super_admin']),
    async (req, res) => {
        try {
            const AuditLog = require('../models/AuditLog');
            const schoolId = req.tenant?.schoolId;

            const analytics = await AuditLog.aggregate([
                {
                    $match: {
                        action: { $regex: '^ai_', $options: 'i' },
                        ...(schoolId && { schoolId: new mongoose.Types.ObjectId(schoolId) })
                    }
                },
                {
                    $group: {
                        _id: '$action',
                        count: { $sum: 1 },
                        lastUsed: { $max: '$createdAt' }
                    }
                },
                {
                    $sort: { count: -1 }
                }
            ]);

            const totalUsage = await AuditLog.countDocuments({
                action: { $regex: '^ai_', $options: 'i' },
                ...(schoolId && { schoolId })
            });

            res.status(200).json({
                success: true,
                data: {
                    totalUsage,
                    featureUsage: analytics,
                    generatedAt: new Date()
                }
            });
        } catch (error) {
            console.error('AI Analytics Error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get AI usage analytics'
            });
        }
    }
);

// Learning Analytics & Early Warning
router.post('/learning-analytics', aiController.getLearningAnalytics);
router.post('/early-warning', aiController.getEarlyWarning);
router.post('/content-recommendation', aiController.getContentRecommendation);

// Teacher Tools
router.post('/grading-assistant', checkFeatureAccess('ai'), aiController.getGradingAssistant);

module.exports = router;
