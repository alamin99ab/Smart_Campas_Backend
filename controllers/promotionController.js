/**
 * 🎓 PROMOTION CONTROLLER
 * Academic promotion management - Result-based class change
 */

const Student = require('../models/Student');
const Result = require('../models/Result');
const Class = require('../models/Class');
const School = require('../models/School');
const { createNotification } = require('../utils/createNotification');

// @desc    Get students eligible for promotion
// @route   GET /api/promotion/eligible
// @access  Private (Principal)
exports.getEligibleStudents = async (req, res) => {
    try {
        const { academicYear, examName, class: studentClass, section } = req.query;
        const schoolCode = req.user.schoolCode;

        if (!examName) {
            return res.status(400).json({
                success: false,
                message: 'Exam name is required to check eligibility'
            });
        }

        // Get all students in the class
        const studentQuery = { schoolCode, isActive: true };
        if (studentClass) studentQuery.studentClass = studentClass;
        if (section) studentQuery.section = section;

        const students = await Student.find(studentQuery).sort({ roll: 1 });

        // Get results for each student
        const results = await Result.find({
            schoolCode,
            examName,
            academicYear: academicYear || new Date().getFullYear().toString()
        });

        const resultMap = new Map(results.map(r => [r.studentId.toString(), r]));

        // Categorize students
        const eligible = [];
        const needsReview = [];
        const failed = [];

        for (const student of students) {
            const result = resultMap.get(student._id.toString());
            
            if (!result) {
                needsReview.push({ student, reason: 'No result available' });
                continue;
            }

            // Check pass status (assuming 33% or GPA >= 1.0 is passing)
            const isPassing = result.gpa >= 1.0 || result.totalMarks >= 33;
            
            if (isPassing) {
                eligible.push({ 
                    student, 
                    currentResult: result,
                    gpa: result.gpa,
                    totalMarks: result.totalMarks
                });
            } else {
                failed.push({ 
                    student, 
                    currentResult: result,
                    gpa: result.gpa,
                    totalMarks: result.totalMarks
                });
            }
        }

        res.json({
            success: true,
            data: {
                eligible: eligible,
                needsReview: needsReview,
                failed: failed,
                summary: {
                    total: students.length,
                    eligible: eligible.length,
                    needsReview: needsReview.length,
                    failed: failed.length
                }
            }
        });
    } catch (error) {
        console.error('Get eligible students error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get eligible students',
            error: error.message
        });
    }
};

// @desc    Run promotion process
// @route   POST /api/promotion/run
// @access  Private (Principal)
exports.runPromotion = async (req, res) => {
    try {
        const { 
            academicYear,
            examName,
            sourceClass,
            sourceSection,
            targetClass,
            targetSection,
            studentIds,
            promotionType = 'passing', // 'all', 'passing', 'manual'
            keepInSameClass = [] // students who failed but should stay
        } = req.body;

        const schoolCode = req.user.schoolCode;

        if (!sourceClass || !targetClass || !examName) {
            return res.status(400).json({
                success: false,
                message: 'Source class, target class, and exam name are required'
            });
        }

        // Get source class info
        const sourceClassInfo = await Class.findOne({
            schoolCode,
            className: sourceClass,
            section: sourceSection || 'A'
        });

        if (!sourceClassInfo) {
            return res.status(404).json({
                success: false,
                message: 'Source class not found'
            });
        }

        // Check if target class exists
        const targetClassInfo = await Class.findOne({
            schoolCode,
            className: targetClass,
            section: targetSection || 'A'
        });

        if (!targetClassInfo) {
            return res.status(404).json({
                success: false,
                message: 'Target class not found. Please create the target class first.'
            });
        }

        // Verify results are published
        const resultsPublished = await Result.findOne({
            schoolCode,
            examName,
            academicYear: academicYear || new Date().getFullYear().toString(),
            isPublished: true
        });

        if (!resultsPublished) {
            return res.status(400).json({
                success: false,
                message: 'Results must be published before running promotion'
            });
        }

        // Get students to promote
        let studentsToPromote = [];
        
        if (studentIds && studentIds.length > 0) {
            // Manual selection
            studentsToPromote = await Student.find({
                _id: { $in: studentIds },
                schoolCode,
                isActive: true
            });
        } else if (promotionType === 'all') {
            studentsToPromote = await Student.find({
                schoolCode,
                studentClass: sourceClass,
                section: sourceSection,
                isActive: true
            });
        } else {
            // Get passing students only
            const passingStudentIds = await Result.distinct('studentId', {
                schoolCode,
                examName,
                academicYear: academicYear || new Date().getFullYear().toString(),
                $or: [
                    { gpa: { $gte: 1.0 } },
                    { totalMarks: { $gte: 33 } }
                ]
            });

            studentsToPromote = await Student.find({
                _id: { $in: passingStudentIds },
                schoolCode,
                studentClass: sourceClass,
                section: sourceSection,
                isActive: true
            });
        }

        if (studentsToPromote.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No students found to promote'
            });
        }

        // Update students with new class
        const promotedStudents = [];
        const errors = [];

        for (const student of studentsToPromote) {
            try {
                const oldClass = student.studentClass;
                const oldSection = student.section;

                // Archive old academic record
                const oldRecord = {
                    academicYear: academicYear || new Date().getFullYear().toString(),
                    className: oldClass,
                    section: oldSection,
                    promotionDate: new Date(),
                    promotedTo: targetClass,
                    promotedToSection: targetSection,
                    examName,
                    promotionType
                };

                // Update student
                student.studentClass = targetClass;
                student.section = targetSection || student.section;
                
                // Initialize academic history if not exists
                if (!student.academicHistory) {
                    student.academicHistory = [];
                }
                student.academicHistory.push(oldRecord);

                await student.save();

                // Notify parent/guardian
                if (student.guardian?.phone) {
                    await createNotification(
                        student.addedBy,
                        'STUDENT_PROMOTED',
                        {
                            title: 'Student Promoted',
                            message: `${student.name} has been promoted from Class ${oldClass} to Class ${targetClass}`
                        },
                        schoolCode
                    );
                }

                promotedStudents.push({
                    studentId: student._id,
                    name: student.name,
                    roll: student.roll,
                    fromClass: oldClass,
                    fromSection: oldSection,
                    toClass: targetClass,
                    toSection: targetSection || student.section
                });
            } catch (err) {
                errors.push({
                    studentId: student._id,
                    error: err.message
                });
            }
        }

        // Update class student counts
        if (sourceClassInfo) {
            sourceClassInfo.currentStudents -= promotedStudents.length;
            await sourceClassInfo.save();
        }
        if (targetClassInfo) {
            targetClassInfo.currentStudents += promotedStudents.length;
            await targetClassInfo.save();
        }

        // Update school stats
        const school = await School.findOne({ schoolCode });
        if (school && school.stats) {
            // Students moving to different class level
        }

        res.json({
            success: true,
            message: `Successfully promoted ${promotedStudents.length} students`,
            data: {
                promoted: promotedStudents,
                errors: errors,
                summary: {
                    totalProcessed: studentsToPromote.length,
                    successfullyPromoted: promotedStudents.length,
                    errors: errors.length
                }
            }
        });
    } catch (error) {
        console.error('Run promotion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to run promotion',
            error: error.message
        });
    }
};

// @desc    Get promotion history
// @route   GET /api/promotion/history
// @access  Private (Principal)
exports.getPromotionHistory = async (req, res) => {
    try {
        const { academicYear, page = 1, limit = 50 } = req.query;
        const schoolCode = req.user.schoolCode;

        // Get students with academic history
        const query = { 
            schoolCode,
            academicHistory: { $exists: true, $ne: [] }
        };

        const students = await Student.find(query)
            .select('name roll studentClass section academicHistory')
            .sort({ 'academicHistory.promotionDate': -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Student.countDocuments(query);

        // Flatten history
        const history = [];
        for (const student of students) {
            if (student.academicHistory) {
                for (const record of student.academicHistory) {
                    if (!academicYear || record.academicYear === academicYear) {
                        history.push({
                            studentName: student.name,
                            studentRoll: student.roll,
                            currentClass: student.studentClass,
                            currentSection: student.section,
                            ...record
                        });
                    }
                }
            }
        }

        res.json({
            success: true,
            data: history,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get promotion history error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get promotion history',
            error: error.message
        });
    }
};

// @desc    Get available classes for promotion
// @route   GET /api/promotion/classes
// @access  Private (Principal)
exports.getPromotionClasses = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;

        const classes = await Class.find({ schoolCode, isActive: true })
            .select('className section capacity currentStudents')
            .sort({ classLevel: 1, section: 1 });

        // Group by class level
        const classMap = new Map();
        for (const cls of classes) {
            if (!classMap.has(cls.className)) {
                classMap.set(cls.className, {
                    className: cls.className,
                    classLevel: cls.classLevel,
                    sections: []
                });
            }
            classMap.get(cls.className).sections.push({
                section: cls.section,
                capacity: cls.capacity,
                currentStudents: cls.currentStudents
            });
        }

        const availableClasses = Array.from(classMap.values());

        // Suggest next class (e.g., Class 6 -> Class 7)
        const suggestions = availableClasses.map(cls => {
            const nextLevel = cls.classLevel + 1;
            const nextClass = availableClasses.find(c => c.classLevel === nextLevel);
            return {
                from: cls.className,
                to: nextClass ? nextClass.className : null
            };
        }).filter(s => s.to);

        res.json({
            success: true,
            data: {
                classes: availableClasses,
                suggestions
            }
        });
    } catch (error) {
        console.error('Get promotion classes error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get classes',
            error: error.message
        });
    }
};

// @desc    Roll number management for new class
// @route   POST /api/promotion/renumber
// @access  Private (Principal)
exports.renumberStudents = async (req, res) => {
    try {
        const { class: studentClass, section, startFrom = 1 } = req.body;
        const schoolCode = req.user.schoolCode;

        if (!studentClass) {
            return res.status(400).json({
                success: false,
                message: 'Class is required'
            });
        }

        const students = await Student.find({
            schoolCode,
            studentClass,
            section: section || 'A',
            isActive: true
        }).sort({ name: 1 });

        // Renumber students
        let rollNumber = startFrom;
        for (const student of students) {
            student.roll = rollNumber;
            await student.save();
            rollNumber++;
        }

        res.json({
            success: true,
            message: `Successfully renumbered ${students.length} students`,
            data: {
                count: students.length,
                startFrom
            }
        });
    } catch (error) {
        console.error('Renumber students error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to renumber students',
            error: error.message
        });
    }
};
