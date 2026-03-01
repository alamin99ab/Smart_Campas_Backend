/**
 * 🤖 AI CONTROLLER - SMART CAMPUS INTELLIGENCE
 * Industry-level AI features for educational management
 */

const AIService = require('../services/aiService');
const Student = require('../models/Student');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Result = require('../models/Result');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Analyze student performance using AI
 * @route   POST /api/ai/analyze-performance
 * @access  Private (Teacher, Principal)
 */
exports.analyzeStudentPerformance = async (req, res) => {
    try {
        const { studentId, academicSessionId } = req.body;

        // Validate permissions
        if (!['teacher', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Get student data
        const student = await Student.findById(studentId).populate('userId');
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Get academic history
        const results = await Result.find({
            studentId,
            academicSessionId
        }).populate('examId subjectId');

        const attendance = await Attendance.find({
            studentId,
            academicSessionId
        });

        // Prepare data for AI
        const studentData = {
            name: student.name,
            class: student.classId,
            rollNumber: student.rollNumber,
            demographicInfo: {
                age: student.dateOfBirth ? new Date().getFullYear() - new Date(student.dateOfBirth).getFullYear() : null,
                gender: student.gender
            }
        };

        const academicHistory = results.map(result => ({
            subject: result.subjectId.name,
            marks: result.marks,
            totalMarks: result.totalMarks,
            percentage: (result.marks / result.totalMarks) * 100,
            grade: result.grade,
            examType: result.examId.type
        }));

        const attendanceData = attendance.map(att => ({
            date: att.date,
            status: att.status,
            percentage: att.percentage
        }));

        // Get AI analysis
        const analysis = await AIService.analyzeStudentPerformance(studentData, {
            academicHistory,
            attendanceData
        });

        // Log AI usage
        await AuditLog.create({
            action: 'ai_performance_analysis',
            resource: 'student',
            resourceId: studentId,
            userId: req.user.id,
            userRole: req.user.role,
            schoolId: req.tenant?.schoolId,
            details: {
                studentName: student.name,
                analysisType: 'performance'
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Performance analysis completed',
            data: {
                student: student.name,
                analysis,
                generatedAt: new Date()
            }
        });
    } catch (error) {
        console.error('AI Performance Analysis Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze student performance'
        });
    }
};

/**
 * @desc    Predict attendance patterns using AI
 * @route   POST /api/ai/predict-attendance
 * @access  Private (Teacher, Principal)
 */
exports.predictAttendancePatterns = async (req, res) => {
    try {
        const { studentId, academicSessionId } = req.body;

        // Validate permissions
        if (!['teacher', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Get student data
        const student = await Student.findById(studentId).populate('userId');
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Get attendance history
        const attendance = await Attendance.find({
            studentId,
            academicSessionId
        }).sort({ date: 1 });

        // Prepare data for AI
        const attendanceData = attendance.map(att => ({
            date: att.date,
            status: att.status,
            dayOfWeek: new Date(att.date).getDay(),
            month: new Date(att.date).getMonth()
        }));

        const studentInfo = {
            name: student.name,
            class: student.classId,
            rollNumber: student.rollNumber
        };

        // Get AI prediction
        const prediction = await AIService.predictAttendancePatterns(attendanceData, studentInfo);

        // Log AI usage
        await AuditLog.create({
            action: 'ai_attendance_prediction',
            resource: 'student',
            resourceId: studentId,
            userId: req.user.id,
            userRole: req.user.role,
            schoolId: req.tenant?.schoolId,
            details: {
                studentName: student.name,
                analysisType: 'attendance'
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Attendance prediction completed',
            data: {
                student: student.name,
                prediction,
                generatedAt: new Date()
            }
        });
    } catch (error) {
        console.error('AI Attendance Prediction Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to predict attendance patterns'
        });
    }
};

/**
 * @desc    Generate exam questions using AI
 * @route   POST /api/ai/generate-questions
 * @access  Private (Teacher, Principal)
 */
exports.generateExamQuestions = async (req, res) => {
    try {
        const { subject, topic, difficulty, count = 10 } = req.body;

        // Validate permissions
        if (!['teacher', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Validate input
        if (!subject || !topic || !difficulty) {
            return res.status(400).json({
                success: false,
                message: 'Subject, topic, and difficulty are required'
            });
        }

        // Get AI-generated questions
        const questions = await AIService.generateExamQuestions(subject, topic, difficulty, count);

        // Log AI usage
        await AuditLog.create({
            action: 'ai_question_generation',
            resource: 'exam',
            userId: req.user.id,
            userRole: req.user.role,
            schoolId: req.tenant?.schoolId,
            details: {
                subject,
                topic,
                difficulty,
                questionCount: questions.length
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Questions generated successfully',
            data: {
                subject,
                topic,
                difficulty,
                questions,
                generatedAt: new Date(),
                generatedBy: req.user.name
            }
        });
    } catch (error) {
        console.error('AI Question Generation Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate exam questions'
        });
    }
};

/**
 * @desc    Assist grading using AI
 * @route   POST /api/ai/assist-grading
 * @access  Private (Teacher)
 */
exports.assistGrading = async (req, res) => {
    try {
        const { submission, rubric, subject } = req.body;

        // Validate permissions (teacher only)
        if (req.user.role !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Validate input
        if (!submission || !rubric || !subject) {
            return res.status(400).json({
                success: false,
                message: 'Submission, rubric, and subject are required'
            });
        }

        // Get AI grading assistance
        const grading = await AIService.assistGrading(submission, rubric, subject);

        // Log AI usage
        await AuditLog.create({
            action: 'ai_grading_assistance',
            resource: 'submission',
            userId: req.user.id,
            userRole: req.user.role,
            schoolId: req.tenant?.schoolId,
            details: {
                subject,
                rubricCriteria: Object.keys(rubric).length,
                suggestedGrade: grading.suggestedGrade
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Grading assistance completed',
            data: {
                subject,
                grading,
                generatedAt: new Date(),
                disclaimer: 'AI grading assistance should be reviewed by teacher before final submission'
            }
        });
    } catch (error) {
        console.error('AI Grading Assistance Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assist with grading'
        });
    }
};

/**
 * @desc    Generate personalized learning path
 * @route   POST /api/ai/generate-learning-path
 * @access  Private (Student, Teacher, Principal)
 */
exports.generateLearningPath = async (req, res) => {
    try {
        const { studentId, learningGoals } = req.body;

        // Get student data
        const student = await Student.findById(studentId).populate('userId classId');
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Validate permissions (student can access own data, teachers/principals can access any)
        if (req.user.role === 'student' && student.userId._id.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Get current progress
        const results = await Result.find({
            studentId
        }).populate('subjectId examId');

        // Prepare data for AI
        const studentProfile = {
            name: student.name,
            class: student.classId.name,
            currentLevel: student.classId.classLevel,
            learningStyle: req.body.learningStyle || 'visual',
            strengths: req.body.strengths || [],
            interests: req.body.interests || []
        };

        const currentProgress = results.map(result => ({
            subject: result.subjectId.name,
            marks: result.marks,
            totalMarks: result.totalMarks,
            percentage: (result.marks / result.totalMarks) * 100,
            grade: result.grade
        }));

        // Get AI learning path
        const learningPath = await AIService.generateLearningPath(
            studentProfile,
            learningGoals || [],
            currentProgress
        );

        // Log AI usage
        await AuditLog.create({
            action: 'ai_learning_path_generation',
            resource: 'student',
            resourceId: studentId,
            userId: req.user.id,
            userRole: req.user.role,
            schoolId: req.tenant?.schoolId,
            details: {
                studentName: student.name,
                goalsCount: learningGoals?.length || 0
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Learning path generated successfully',
            data: {
                student: student.name,
                learningPath,
                generatedAt: new Date()
            }
        });
    } catch (error) {
        console.error('AI Learning Path Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate learning path'
        });
    }
};

/**
 * @desc    Recommend content using AI
 * @route   POST /api/ai/recommend-content
 * @access  Private (Student, Teacher)
 */
exports.recommendContent = async (req, res) => {
    try {
        const { studentLevel, subject, learningStyle, currentTopics } = req.body;

        // Validate input
        if (!studentLevel || !subject) {
            return res.status(400).json({
                success: false,
                message: 'Student level and subject are required'
            });
        }

        // Get AI recommendations
        const recommendations = await AIService.recommendContent(
            studentLevel,
            subject,
            learningStyle || 'visual',
            currentTopics || []
        );

        // Log AI usage
        await AuditLog.create({
            action: 'ai_content_recommendation',
            resource: 'content',
            userId: req.user.id,
            userRole: req.user.role,
            schoolId: req.tenant?.schoolId,
            details: {
                subject,
                studentLevel,
                learningStyle: learningStyle || 'visual'
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Content recommendations generated',
            data: {
                subject,
                studentLevel,
                learningStyle: learningStyle || 'visual',
                recommendations,
                generatedAt: new Date()
            }
        });
    } catch (error) {
        console.error('AI Content Recommendation Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to recommend content'
        });
    }
};

/**
 * @desc    Detect plagiarism using AI
 * @route   POST /api/ai/detect-plagiarism
 * @access  Private (Teacher)
 */
exports.detectPlagiarism = async (req, res) => {
    try {
        const { submissionText, studentId, assignmentId } = req.body;

        // Validate permissions (teacher only)
        if (req.user.role !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Validate input
        if (!submissionText) {
            return res.status(400).json({
                success: false,
                message: 'Submission text is required'
            });
        }

        // Get AI plagiarism detection
        const analysis = await AIService.detectPlagiarism(submissionText, studentId);

        // Log AI usage
        await AuditLog.create({
            action: 'ai_plagiarism_detection',
            resource: 'submission',
            resourceId: assignmentId,
            userId: req.user.id,
            userRole: req.user.role,
            schoolId: req.tenant?.schoolId,
            details: {
                studentId,
                plagiarismScore: analysis.score
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Plagiarism analysis completed',
            data: {
                analysis,
                generatedAt: new Date(),
                disclaimer: 'AI plagiarism detection should be used as a screening tool. Human review is recommended for final determination.'
            }
        });
    } catch (error) {
        console.error('AI Plagiarism Detection Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to detect plagiarism'
        });
    }
};

/**
 * @desc    Predict student success using AI
 * @route   POST /api/ai/predict-success
 * @access  Private (Teacher, Principal)
 */
exports.predictStudentSuccess = async (req, res) => {
    try {
        const { studentId, academicSessionId } = req.body;

        // Validate permissions
        if (!['teacher', 'principal'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Get student data
        const student = await Student.findById(studentId).populate('userId classId');
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Get academic data
        const results = await Result.find({
            studentId,
            academicSessionId
        }).populate('subjectId');

        const attendance = await Attendance.find({
            studentId,
            academicSessionId
        });

        // Prepare data for AI
        const studentData = {
            personalInfo: {
                name: student.name,
                age: student.dateOfBirth ? new Date().getFullYear() - new Date(student.dateOfBirth).getFullYear() : null,
                gender: student.gender
            },
            academicInfo: {
                class: student.classId.name,
                rollNumber: student.rollNumber,
                currentLevel: student.classId.classLevel
            }
        };

        const historicalData = {
            academicPerformance: results.map(r => ({
                subject: r.subjectId.name,
                marks: r.marks,
                totalMarks: r.totalMarks,
                percentage: (r.marks / r.totalMarks) * 100,
                grade: r.grade
            })),
            attendanceRecord: attendance.map(a => ({
                date: a.date,
                status: a.status
            }))
        };

        // Get AI prediction
        const prediction = await AIService.predictStudentSuccess(studentData, historicalData);

        // Log AI usage
        await AuditLog.create({
            action: 'ai_success_prediction',
            resource: 'student',
            resourceId: studentId,
            userId: req.user.id,
            userRole: req.user.role,
            schoolId: req.tenant?.schoolId,
            details: {
                studentName: student.name,
                successProbability: prediction.probability
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Success prediction completed',
            data: {
                student: student.name,
                prediction,
                generatedAt: new Date(),
                disclaimer: 'AI predictions should be used as guidance tools. Human judgment and comprehensive assessment are essential.'
            }
        });
    } catch (error) {
        console.error('AI Success Prediction Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to predict student success'
        });
    }
};

/**
 * @desc    Process student query using AI chatbot
 * @route   POST /api/ai/student-support
 * @access  Private (Student)
 */
exports.processStudentQuery = async (req, res) => {
    try {
        const { query } = req.body;

        // Validate permissions (student only)
        if (req.user.role !== 'student') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Validate input
        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Query is required'
            });
        }

        // Get student context
        const student = await Student.findOne({ userId: req.user.id }).populate('classId');
        const studentContext = {
            name: student.name,
            class: student.classId.name,
            rollNumber: student.rollNumber
        };

        const schoolContext = {
            schoolId: req.tenant?.schoolId,
            currentAcademicSession: req.tenant?.academicSessionId
        };

        // Get AI response
        const response = await AIService.processStudentQuery(query, studentContext, schoolContext);

        // Log AI usage
        await AuditLog.create({
            action: 'ai_student_support',
            resource: 'chatbot',
            userId: req.user.id,
            userRole: req.user.role,
            schoolId: req.tenant?.schoolId,
            details: {
                query: query.substring(0, 100) + '...',
                responseLength: response.response?.length || 0
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Query processed successfully',
            data: {
                query,
                response,
                generatedAt: new Date()
            }
        });
    } catch (error) {
        console.error('AI Student Support Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process student query'
        });
    }
};

/**
 * @desc    Generate reports using AI
 * @route   POST /api/ai/generate-report
 * @access  Private (Principal, Super Admin)
 */
exports.generateReport = async (req, res) => {
    try {
        const { reportType, data, timeRange } = req.body;

        // Validate permissions
        if (!['principal', 'super_admin'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Validate input
        if (!reportType || !data) {
            return res.status(400).json({
                success: false,
                message: 'Report type and data are required'
            });
        }

        const schoolInfo = {
            schoolId: req.tenant?.schoolId,
            reportGeneratedBy: req.user.name,
            reportGeneratedAt: new Date(),
            timeRange: timeRange || 'current_academic_session'
        };

        // Get AI-generated report
        const report = await AIService.generateReport(reportType, data, schoolInfo);

        // Log AI usage
        await AuditLog.create({
            action: 'ai_report_generation',
            resource: 'report',
            userId: req.user.id,
            userRole: req.user.role,
            schoolId: req.tenant?.schoolId,
            details: {
                reportType,
                dataPoints: Array.isArray(data) ? data.length : Object.keys(data).length
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Report generated successfully',
            data: {
                reportType,
                report,
                generatedAt: new Date(),
                generatedBy: req.user.name
            }
        });
    } catch (error) {
        console.error('AI Report Generation Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate report'
        });
    }
};

/**
 * @desc    Advanced Learning Analytics
 * @route   POST /api/ai/learning-analytics
 * @access  Private
 */
exports.getLearningAnalytics = async (req, res) => {
    try {
        const { studentId, timeframe } = req.body;
        const schoolCode = req.user.schoolCode;

        // Simulate AI-powered learning analytics
        const analytics = {
            studentId,
            timeframe: timeframe || 'semester',
            learningPatterns: {
                strengthAreas: ['Mathematics', 'Science'],
                improvementAreas: ['Language Arts', 'Social Studies'],
                recommendedFocus: ['Critical Thinking', 'Problem Solving'],
                learningStyle: 'Visual-Auditory',
                engagementScore: 85,
                completionRate: 92
            },
            predictiveInsights: {
                atRiskSubjects: [],
                potentialGrade: 'A-',
                studyTimeRecommendation: '2-3 hours daily',
                tutoringNeeds: false
            },
            personalizedPath: {
                nextMilestones: ['Advanced Algebra', 'Chemistry Basics'],
                resources: ['Interactive exercises', 'Video tutorials', 'Practice tests'],
                difficultyAdjustment: 'Moderate increase'
            }
        };

        res.status(200).json({
            success: true,
            data: analytics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Early Warning System
 * @route   POST /api/ai/early-warning
 * @access  Private
 */
exports.getEarlyWarning = async (req, res) => {
    try {
        const { studentId, indicators } = req.body;
        const schoolCode = req.user.schoolCode;

        // Simulate AI-powered early warning analysis
        const warnings = {
            studentId,
            riskLevel: 'Low',
            indicators: {
                attendanceTrend: 'Stable (95%)',
                gradeTrend: 'Improving (+5%)',
                engagementLevel: 'High',
                socialIndicators: 'Positive',
                behavioralNotes: 'No concerns'
            },
            alerts: [],
            recommendations: [
                'Continue current study habits',
                'Maintain regular attendance',
                'Consider advanced coursework'
            ],
            nextAssessmentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        };

        res.status(200).json({
            success: true,
            data: warnings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Intelligent Content Recommendation
 * @route   POST /api/ai/content-recommendation
 * @access  Private
 */
exports.getContentRecommendation = async (req, res) => {
    try {
        const { studentId, subject, currentLevel } = req.body;
        const schoolCode = req.user.schoolCode;

        // Simulate AI-powered content recommendations
        const recommendations = {
            studentId,
            subject,
            currentLevel,
            recommendedContent: [
                {
                    type: 'video',
                    title: 'Introduction to Advanced Concepts',
                    duration: '15 minutes',
                    difficulty: 'Intermediate',
                    prerequisites: ['Basic concepts understanding'],
                    estimatedLearningTime: '45 minutes'
                },
                {
                    type: 'exercise',
                    title: 'Practice Problems Set A',
                    questionCount: 20,
                    difficulty: 'Progressive',
                    adaptiveMode: true,
                    estimatedTime: '30 minutes'
                },
                {
                    type: 'reading',
                    title: 'Supplementary Material Chapter 5',
                    pages: 12,
                    complexity: 'Medium',
                    interactiveElements: ['Diagrams', 'Examples']
                }
            ],
            learningPath: {
                currentStep: 3,
                totalSteps: 10,
                nextTopic: 'Advanced Applications',
                estimatedCompletion: '2 weeks'
            }
        };

        res.status(200).json({
            success: true,
            data: recommendations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Automated Grading Assistant
 * @route   POST /api/ai/grading-assistant
 * @access  Teacher only
 */
exports.getGradingAssistant = async (req, res) => {
    try {
        const { studentSubmissions, rubric, subject } = req.body;
        const schoolCode = req.user.schoolCode;

        // Simulate AI-powered grading assistance
        const gradingResults = {
            subject,
            totalSubmissions: studentSubmissions.length,
            gradedSubmissions: studentSubmissions.length,
            averageScore: 0,
            distribution: {
                A: 0, B: 0, C: 0, D: 0, F: 0
            },
            feedback: {
                commonStrengths: ['Clear understanding of concepts', 'Good problem-solving approach'],
                commonWeaknesses: ['Needs more detailed explanations', 'Calculation errors'],
                suggestions: ['Provide more examples', 'Emphasize step-by-step solutions']
            },
            timeSaved: '15 minutes'
        };

        res.status(200).json({
            success: true,
            data: gradingResults
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
    analyzeStudentPerformance: exports.analyzeStudentPerformance,
    predictAttendancePatterns: exports.predictAttendancePatterns,
    generateExamQuestions: exports.generateExamQuestions,
    assistGrading: exports.assistGrading,
    generateLearningPath: exports.generateLearningPath,
    recommendContent: exports.recommendContent,
    detectPlagiarism: exports.detectPlagiarism,
    predictStudentSuccess: exports.predictStudentSuccess,
    processStudentQuery: exports.processStudentQuery,
    generateReport: exports.generateReport,
    getLearningAnalytics: exports.getLearningAnalytics,
    getEarlyWarning: exports.getEarlyWarning,
    getContentRecommendation: exports.getContentRecommendation,
    getGradingAssistant: exports.getGradingAssistant
};
