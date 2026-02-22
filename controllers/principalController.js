/**
 * 👨‍🎓 PRINCIPAL CONTROLLER
 * Industry-level Principal management for Smart Campus System
 */

const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Routine = require('../models/Routine');
const School = require('../models/School');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Create new class
 * @route   POST /api/principal/classes
 * @access  Principal only
 */
exports.createClass = async (req, res) => {
    try {
        const {
            className,
            section,
            classLevel,
            capacity,
            roomNumber,
            floor,
            academicYear
        } = req.body;

        const schoolCode = req.user.schoolCode;

        // Check if class already exists
        const existingClass = await Class.findOne({
            schoolCode,
            className,
            section,
            academicYear
        });

        if (existingClass) {
            return res.status(400).json({
                success: false,
                message: 'Class already exists for this academic year'
            });
        }

        const newClass = new Class({
            schoolCode,
            className,
            section,
            classLevel,
            capacity,
            roomNumber,
            floor,
            academicYear,
            createdBy: req.user.id
        });

        await newClass.save();

        // Log audit
        await AuditLog.create({
            userId: req.user.id,
            action: 'CREATE_CLASS',
            details: `Created class: ${className}-${section}`,
            schoolCode
        });

        res.status(201).json({
            success: true,
            message: 'Class created successfully',
            data: newClass
        });

    } catch (error) {
        console.error('Error creating class:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating class',
            error: error.message
        });
    }
};

/**
 * @desc    Get all classes
 * @route   GET /api/principal/classes
 * @access  Principal only
 */
exports.getAllClasses = async (req, res) => {
    try {
        const { academicYear, classLevel } = req.query;
        const schoolCode = req.user.schoolCode;

        const query = { schoolCode };
        if (academicYear) query.academicYear = academicYear;
        if (classLevel) query.classLevel = parseInt(classLevel);

        const classes = await Class.find(query)
            .populate('classTeacher', 'name email')
            .populate('subjects.subjectId', 'subjectName subjectCode')
            .populate('subjects.teacherId', 'name email')
            .sort({ classLevel: 1, className: 1, section: 1 });

        res.status(200).json({
            success: true,
            data: classes
        });

    } catch (error) {
        console.error('Error getting classes:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving classes',
            error: error.message
        });
    }
};

/**
 * @desc    Create new subject
 * @route   POST /api/principal/subjects
 * @access  Principal only
 */
exports.createSubject = async (req, res) => {
    try {
        const {
            subjectName,
            subjectCode,
            category,
            classLevels,
            description,
            credits,
            periodsPerWeek,
            passingMarks,
            totalMarks
        } = req.body;

        const schoolCode = req.user.schoolCode;

        // Check if subject already exists
        const existingSubject = await Subject.findOne({
            schoolCode,
            subjectCode
        });

        if (existingSubject) {
            return res.status(400).json({
                success: false,
                message: 'Subject code already exists'
            });
        }

        const newSubject = new Subject({
            schoolCode,
            subjectName,
            subjectCode,
            category,
            classLevels,
            description,
            credits,
            periodsPerWeek,
            passingMarks,
            totalMarks,
            createdBy: req.user.id
        });

        await newSubject.save();

        // Log audit
        await AuditLog.create({
            userId: req.user.id,
            action: 'CREATE_SUBJECT',
            details: `Created subject: ${subjectName} (${subjectCode})`,
            schoolCode
        });

        res.status(201).json({
            success: true,
            message: 'Subject created successfully',
            data: newSubject
        });

    } catch (error) {
        console.error('Error creating subject:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating subject',
            error: error.message
        });
    }
};

/**
 * @desc    Get all subjects
 * @route   GET /api/principal/subjects
 * @access  Principal only
 */
exports.getAllSubjects = async (req, res) => {
    try {
        const { category, classLevel } = req.query;
        const schoolCode = req.user.schoolCode;

        const query = { schoolCode };
        if (category) query.category = category;
        if (classLevel) query.classLevels = parseInt(classLevel);

        const subjects = await Subject.find(query)
            .populate('teachers.teacherId', 'name email')
            .sort({ subjectName: 1 });

        res.status(200).json({
            success: true,
            data: subjects
        });

    } catch (error) {
        console.error('Error getting subjects:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving subjects',
            error: error.message
        });
    }
};

/**
 * @desc    Create/Update class routine
 * @route   POST /api/principal/routine
 * @access  Principal only
 */
exports.createRoutine = async (req, res) => {
    try {
        const {
            classId,
            academicYear,
            semester,
            effectiveFrom,
            effectiveTo,
            schedule
        } = req.body;

        const schoolCode = req.user.schoolCode;

        // Check if routine already exists
        const existingRoutine = await Routine.findOne({
            schoolCode,
            classId,
            academicYear,
            semester
        });

        if (existingRoutine) {
            // Update existing routine
            existingRoutine.schedule = schedule;
            existingRoutine.effectiveFrom = effectiveFrom;
            existingRoutine.effectiveTo = effectiveTo;
            existingRoutine.lastModifiedBy = req.user.id;
            await existingRoutine.save();

            // Log audit
            await AuditLog.create({
                userId: req.user.id,
                action: 'UPDATE_ROUTINE',
                details: `Updated routine for class: ${classId}`,
                schoolCode
            });

            return res.status(200).json({
                success: true,
                message: 'Routine updated successfully',
                data: existingRoutine
            });
        }

        // Create new routine
        const newRoutine = new Routine({
            schoolCode,
            classId,
            academicYear,
            semester,
            effectiveFrom,
            effectiveTo,
            schedule,
            createdBy: req.user.id
        });

        await newRoutine.save();

        // Log audit
        await AuditLog.create({
            userId: req.user.id,
            action: 'CREATE_ROUTINE',
            details: `Created routine for class: ${classId}`,
            schoolCode
        });

        res.status(201).json({
            success: true,
            message: 'Routine created successfully',
            data: newRoutine
        });

    } catch (error) {
        console.error('Error creating routine:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating routine',
            error: error.message
        });
    }
};

/**
 * @desc    Get class routine
 * @route   GET /api/principal/routine/:classId
 * @access  Principal only
 */
exports.getClassRoutine = async (req, res) => {
    try {
        const { classId } = req.params;
        const { academicYear, semester } = req.query;
        const schoolCode = req.user.schoolCode;

        const query = { schoolCode, classId };
        if (academicYear) query.academicYear = academicYear;
        if (semester) query.semester = semester;

        const routine = await Routine.findOne(query)
            .populate('classId', 'className section')
            .populate('schedule.periods.subjectId', 'subjectName subjectCode')
            .populate('schedule.periods.teacherId', 'name email');

        if (!routine) {
            return res.status(404).json({
                success: false,
                message: 'Routine not found'
            });
        }

        res.status(200).json({
            success: true,
            data: routine
        });

    } catch (error) {
        console.error('Error getting routine:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving routine',
            error: error.message
        });
    }
};

/**
 * @desc    Assign teacher to subject
 * @route   POST /api/principal/assign-teacher
 * @access  Principal only
 */
exports.assignTeacher = async (req, res) => {
    try {
        const { teacherId, subjectId, classId } = req.body;
        const schoolCode = req.user.schoolCode;

        // Verify teacher exists and belongs to school
        const teacher = await User.findOne({
            _id: teacherId,
            schoolCode,
            role: 'teacher',
            isActive: true
        });

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        // Verify subject exists
        const subject = await Subject.findOne({
            _id: subjectId,
            schoolCode
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        // Add teacher to subject
        await subject.addTeacher(teacherId);

        // Update class with subject-teacher assignment
        if (classId) {
            const classDoc = await Class.findOne({
                _id: classId,
                schoolCode
            });

            if (classDoc) {
                const existingSubjectIndex = classDoc.subjects.findIndex(
                    s => s.subjectId.toString() === subjectId
                );

                if (existingSubjectIndex >= 0) {
                    classDoc.subjects[existingSubjectIndex].teacherId = teacherId;
                } else {
                    classDoc.subjects.push({
                        subjectId,
                        teacherId,
                        periodsPerWeek: subject.periodsPerWeek
                    });
                }

                await classDoc.save();
            }
        }

        // Log audit
        await AuditLog.create({
            userId: req.user.id,
            action: 'ASSIGN_TEACHER',
            details: `Assigned teacher ${teacher.name} to subject ${subject.subjectName}`,
            schoolCode
        });

        res.status(200).json({
            success: true,
            message: 'Teacher assigned successfully'
        });

    } catch (error) {
        console.error('Error assigning teacher:', error);
        res.status(500).json({
            success: false,
            message: 'Error assigning teacher',
            error: error.message
        });
    }
};

/**
 * @desc    Get school analytics
 * @route   GET /api/principal/analytics
 * @access  Principal only
 */
exports.getSchoolAnalytics = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;

        const totalStudents = await User.countDocuments({
            schoolCode,
            role: 'student',
            isActive: true
        });

        const totalTeachers = await User.countDocuments({
            schoolCode,
            role: 'teacher',
            isActive: true
        });

        const totalClasses = await Class.countDocuments({
            schoolCode,
            isActive: true
        });

        const totalSubjects = await Subject.countDocuments({
            schoolCode,
            isActive: true
        });

        // Get class-wise student distribution
        const classDistribution = await Class.aggregate([
            { $match: { schoolCode } },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: 'classId',
                    as: 'students'
                }
            },
            {
                $project: {
                    className: 1,
                    section: 1,
                    studentCount: { $size: '$students' },
                    capacity: 1
                }
            }
        ]);

        // Get teacher-subject assignments
        const teacherAssignments = await Subject.aggregate([
            { $match: { schoolCode } },
            { $unwind: '$teachers' },
            {
                $lookup: {
                    from: 'users',
                    localField: 'teachers.teacherId',
                    foreignField: '_id',
                    as: 'teacher'
                }
            },
            { $unwind: '$teacher' },
            {
                $group: {
                    _id: '$teacher._id',
                    teacherName: { $first: '$teacher.name' },
                    subjects: { $push: '$subjectName' },
                    subjectCount: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalStudents,
                    totalTeachers,
                    totalClasses,
                    totalSubjects
                },
                classDistribution,
                teacherAssignments
            }
        });

    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving analytics',
            error: error.message
        });
    }
};
