/**
 * 🤖 AI ROUTES - SMART CAMPUS INTELLIGENCE
 * Industry-level AI features for educational management
 */

const express = require('express');
const router = express.Router();

// Import controllers
const {
    analyzeStudentPerformance,
    predictAttendancePatterns,
    generateExamQuestions,
    assistGrading,
    generateLearningPath,
    recommendContent,
    detectPlagiarism,
    predictStudentSuccess,
    processStudentQuery,
    generateReport
} = require('../controllers/aiController');

// Import middleware
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, checkFeatureAccess, addSchoolScope } = require('../middleware/multiTenant');

// Apply multi-tenant middleware to all routes
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

// All routes require authentication
router.use(protect);

/**
 * 📚 ACADEMIC ANALYSIS AI FEATURES
 */

// Analyze student performance (Teacher, Principal)
router.post('/analyze-performance',
    checkFeatureAccess('ai'),
    authorize(['teacher', 'principal']),
    analyzeStudentPerformance
);

// Predict attendance patterns (Teacher, Principal)
router.post('/predict-attendance',
    checkFeatureAccess('ai'),
    authorize(['teacher', 'principal']),
    predictAttendancePatterns
);

// Predict student success (Teacher, Principal)
router.post('/predict-success',
    checkFeatureAccess('ai'),
    authorize(['teacher', 'principal']),
    predictStudentSuccess
);

/**
 * 📝 CONTENT CREATION AI FEATURES
 */

// Generate exam questions (Teacher, Principal)
router.post('/generate-questions',
    checkFeatureAccess('ai'),
    authorize(['teacher', 'principal']),
    generateExamQuestions
);

// Assist with grading (Teacher only)
router.post('/assist-grading',
    checkFeatureAccess('ai'),
    authorize('teacher'),
    assistGrading
);

// Detect plagiarism (Teacher only)
router.post('/detect-plagiarism',
    checkFeatureAccess('ai'),
    authorize('teacher'),
    detectPlagiarism
);

/**
 * 🎓 PERSONALIZED LEARNING AI FEATURES
 */

// Generate learning path (Student, Teacher, Principal)
router.post('/generate-learning-path',
    checkFeatureAccess('ai'),
    authorize(['student', 'teacher', 'principal']),
    generateLearningPath
);

// Recommend content (Student, Teacher)
router.post('/recommend-content',
    checkFeatureAccess('ai'),
    authorize(['student', 'teacher']),
    recommendContent
);

/**
 * 🤖 AI CHATBOT & SUPPORT
 */

// Student support chatbot (Student only)
router.post('/student-support',
    checkFeatureAccess('ai'),
    authorize('student'),
    processStudentQuery
);

/**
 * 📊 ADMINISTRATIVE AI FEATURES
 */

// Generate reports (Principal, Super Admin)
router.post('/generate-report',
    checkFeatureAccess('ai'),
    authorize(['principal', 'super_admin']),
    generateReport
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

module.exports = router;
