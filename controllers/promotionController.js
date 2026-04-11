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
        const { academicYear, examName, classId, class: studentClass, section } = req.query;
        const schoolCode = req.user.schoolCode;

        if (!classId && !studentClass) {
            return res.status(400).json({
                success: false,
                message: 'Class selection is required to check eligibility'
            });
        }

        let sourceClassInfo;
        if (classId) {
            sourceClassInfo = await Class.findOne({ _id: classId, schoolCode, isActive: true });
        }

        if (!sourceClassInfo && studentClass) {
            sourceClassInfo = await Class.findOne({
                schoolCode,
                className: studentClass,
                section: section || undefined,
                isActive: true
            });
        }

        if (!sourceClassInfo) {
            return res.status(404).json({
                success: false,
                message: 'Selected class not found'
            });
        }

        const studentQuery = {
            schoolCode,
            isActive: true,
            studentClass: sourceClassInfo.className
        };

        if (section) {
            studentQuery.section = section;
        } else if (sourceClassInfo.section) {
            studentQuery.section = sourceClassInfo.section;
        }

        const students = await Student.find(studentQuery).sort({ roll: 1 });

        const resultFilter = {
            schoolCode,
            studentClass: sourceClassInfo.className,
            section: studentQuery.section,
            academicYear: academicYear || sourceClassInfo.academicYear || new Date().getFullYear().toString(),
            isPublished: true
        };
        if (examName) {
            resultFilter.examName = examName;
        }

        const results = await Result.find(resultFilter).sort({ publishedAt: -1 });

        const resultMap = new Map();
        for (const result of results) {
            const studentId = result.studentId.toString();
            const existing = resultMap.get(studentId);
            if (!existing || (result.publishedAt && existing.publishedAt < result.publishedAt)) {
                resultMap.set(studentId, result);
            }
        }

        const eligible = [];
        const failed = [];
        const needsReview = [];

        for (const student of students) {
            const result = resultMap.get(student._id.toString());
            const studentPayload = {
                _id: student._id.toString(),
                name: student.name,
                email: student.email,
                rollNumber: student.roll,
                class: {
                    _id: sourceClassInfo._id.toString(),
                    name: sourceClassInfo.className,
                    section: sourceClassInfo.section
                },
                section: {
                    name: student.section || sourceClassInfo.section
                },
                results: result ? [{
                    examName: result.examName,
                    status: result.isPublished ? 'published' : 'pending',
                    gpa: result.gpa,
                    totalMarks: result.totalMarks
                }] : []
            };

            if (!result) {
                needsReview.push(studentPayload);
                continue;
            }

            const isPassing = result.gpa >= 1.0 || result.totalMarks >= 33;
            if (isPassing) {
                eligible.push(studentPayload);
            } else {
                failed.push(studentPayload);
            }
        }

        res.json({
            success: true,
            data: {
                eligible,
                needsReview,
                failed,
                summary: {
                    total: students.length,
                    eligible: eligible.length,
                    needsReview: needsReview.length,
                    failed: failed.length,
                    classId: sourceClassInfo._id,
                    className: sourceClassInfo.className,
                    section: sourceClassInfo.section
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
            sourceClassId,
            targetClassId,
            studentIds,
            promotionType = 'pass', // 'all', 'pass', 'passing', 'manual'
            keepInSameClass = []
        } = req.body;

        const schoolCode = req.user.schoolCode;

        if (!sourceClassId || !targetClassId) {
            return res.status(400).json({
                success: false,
                message: 'Source class and target class are required'
            });
        }

        const sourceClassInfo = await Class.findOne({ _id: sourceClassId, schoolCode, isActive: true });
        if (!sourceClassInfo) {
            return res.status(404).json({
                success: false,
                message: 'Source class not found'
            });
        }

        const targetClassInfo = await Class.findOne({ _id: targetClassId, schoolCode, isActive: true });
        if (!targetClassInfo) {
            return res.status(404).json({
                success: false,
                message: 'Target class not found. Please create the target class first.'
            });
        }

        if (sourceClassId === targetClassId) {
            return res.status(400).json({
                success: false,
                message: 'Source and target class must be different'
            });
        }

        const normalizedPromotionType = promotionType === 'pass' ? 'passing' : promotionType;
        if (!['all', 'passing', 'manual'].includes(normalizedPromotionType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid promotion type'
            });
        }

        const effectiveAcademicYear = academicYear || sourceClassInfo.academicYear || new Date().getFullYear().toString();

        const resultsPublished = await Result.findOne({
            schoolCode,
            academicYear: effectiveAcademicYear,
            isPublished: true,
            ...(examName ? { examName } : {})
        });

        if (!resultsPublished) {
            return res.status(400).json({
                success: false,
                message: 'Results must be published before running promotion'
            });
        }

        let studentsToPromote = [];

        if (studentIds?.length > 0) {
            studentsToPromote = await Student.find({
                _id: { $in: studentIds },
                schoolCode,
                isActive: true
            });
        } else if (normalizedPromotionType === 'all') {
            studentsToPromote = await Student.find({
                schoolCode,
                studentClass: sourceClassInfo.className,
                section: sourceClassInfo.section,
                isActive: true
            });
        } else if (normalizedPromotionType === 'passing') {
            const passingStudentIds = await Result.distinct('studentId', {
                schoolCode,
                studentClass: sourceClassInfo.className,
                section: sourceClassInfo.section,
                academicYear: effectiveAcademicYear,
                isPublished: true,
                $or: [
                    { gpa: { $gte: 1.0 } },
                    { totalMarks: { $gte: 33 } }
                ]
            });

            studentsToPromote = await Student.find({
                _id: { $in: passingStudentIds },
                schoolCode,
                studentClass: sourceClassInfo.className,
                section: sourceClassInfo.section,
                isActive: true
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Student IDs are required for manual promotion'
            });
        }

        if (studentsToPromote.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No students found to promote'
            });
        }

        const promotedStudents = [];
        const errors = [];

        for (const student of studentsToPromote) {
            try {
                const oldClass = student.studentClass;
                const oldSection = student.section;

                const oldRecord = {
                    academicYear: effectiveAcademicYear,
                    className: oldClass,
                    section: oldSection,
                    promotionDate: new Date(),
                    promotedTo: targetClassInfo.className,
                    promotedToSection: targetClassInfo.section,
                    examName: examName || 'final',
                    promotionType: normalizedPromotionType
                };

                student.studentClass = targetClassInfo.className;
                student.section = targetClassInfo.section;
                if (!student.academicHistory) {
                    student.academicHistory = [];
                }
                student.academicHistory.push(oldRecord);
                await student.save();

                if (student.guardian?.phone) {
                    await createNotification(
                        student.addedBy,
                        'STUDENT_PROMOTED',
                        {
                            title: 'Student Promoted',
                            message: `${student.name} has been promoted from Class ${oldClass} to Class ${targetClassInfo.className}`
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
                    toClass: targetClassInfo.className,
                    toSection: targetClassInfo.section
                });
            } catch (err) {
                errors.push({
                    studentId: student._id,
                    error: err.message
                });
            }
        }

        sourceClassInfo.currentStudents -= promotedStudents.length;
        if (sourceClassInfo.currentStudents < 0) sourceClassInfo.currentStudents = 0;
        await sourceClassInfo.save();

        targetClassInfo.currentStudents += promotedStudents.length;
        await targetClassInfo.save();

        const school = await School.findOne({ schoolCode });
        if (school && school.stats) {
            // Optionally update aggregate counts here if needed.
        }

        res.json({
            success: true,
            message: `Successfully promoted ${promotedStudents.length} students`,
            data: {
                promoted: promotedStudents,
                errors,
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

        const query = {
            schoolCode,
            academicHistory: { $exists: true, $ne: [] }
        };

        const students = await Student.find(query)
            .select('name roll studentClass section academicHistory')
            .lean();

        const historyMap = new Map();
        for (const student of students) {
            if (!student.academicHistory) continue;
            for (const record of student.academicHistory) {
                if (academicYear && record.academicYear !== academicYear) continue;
                const timestamp = record.promotionDate ? new Date(record.promotionDate).toISOString() : 'unknown';
                const key = `${timestamp}|${record.className}|${record.promotedTo}|${record.promotionType}|${record.examName || ''}`;
                const existing = historyMap.get(key);
                if (!existing) {
                    historyMap.set(key, {
                        _id: key,
                        fromClass: record.className,
                        toClass: record.promotedTo,
                        promotedAt: record.promotionDate,
                        status: 'completed',
                        promotedCount: 1,
                        failedCount: 0,
                        promotionType: record.promotionType,
                        examName: record.examName || null,
                        academicYear: record.academicYear
                    });
                } else {
                    existing.promotedCount += 1;
                }
            }
        }

        const history = Array.from(historyMap.values()).sort((a, b) => new Date(b.promotedAt) - new Date(a.promotedAt));
        const total = history.length;
        const pagedHistory = history.slice((page - 1) * limit, (page - 1) * limit + parseInt(limit, 10));

        res.json({
            success: true,
            data: pagedHistory,
            pagination: {
                page: parseInt(page, 10),
                limit: parseInt(limit, 10),
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
            .select('className section classLevel capacity currentStudents')
            .sort({ classLevel: 1, section: 1 })
            .lean();

        const availableClasses = classes.map((cls) => ({
            _id: cls._id.toString(),
            name: cls.className,
            className: cls.className,
            section: cls.section,
            classLevel: cls.classLevel,
            capacity: cls.capacity,
            currentStudents: cls.currentStudents,
            label: `${cls.className} ${cls.section}`
        }));

        const suggestions = availableClasses
            .map((cls) => {
                const nextLevel = cls.classLevel + 1;
                const nextClass = availableClasses.find((c) => c.classLevel === nextLevel);
                return {
                    from: cls.className,
                    to: nextClass ? nextClass.className : null
                };
            })
            .filter((s) => s.to);

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
