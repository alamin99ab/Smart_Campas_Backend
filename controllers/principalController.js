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
const AcademicSession = require('../models/AcademicSession');
const Section = require('../models/Section');
const Room = require('../models/Room');
const Exam = require('../models/Exam');

/**
 * @desc    Create Academic Session
 * @route   POST /api/principal/academic-sessions
 * @access  Principal only
 */
exports.createAcademicSession = async (req, res) => {
    try {
        const { sessionName, startDate, endDate, isActive } = req.body;
        const schoolCode = req.user.schoolCode;

        const session = new AcademicSession({
            sessionName,
            startDate,
            endDate,
            isActive: isActive !== undefined ? isActive : true,
            schoolCode,
            createdBy: req.user.id
        });

        await session.save();

        res.status(201).json({
            success: true,
            message: 'Academic session created successfully',
            data: session
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
 * @desc    Get all academic sessions
 * @route   GET /api/principal/academic-sessions
 * @access  Principal only
 */
exports.getAcademicSessions = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        
        const sessions = await AcademicSession.find({ schoolCode })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: sessions
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
 * @desc    Update Academic Session
 * @route   PUT /api/principal/academic-sessions/:id
 * @access  Principal only
 */
exports.updateAcademicSession = async (req, res) => {
    try {
        const { id } = req.params;
        const { sessionName, startDate, endDate, isActive } = req.body;
        const schoolCode = req.user.schoolCode;

        const session = await AcademicSession.findOneAndUpdate(
            { _id: id, schoolCode },
            { sessionName, startDate, endDate, isActive },
            { new: true, runValidators: true }
        );

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Academic session not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Academic session updated successfully',
            data: session
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
 * @desc    Create Section
 * @route   POST /api/principal/sections
 * @access  Principal only
 */
exports.createSection = async (req, res) => {
    try {
        const { sectionName, classId, capacity, roomNumber } = req.body;
        const schoolCode = req.user.schoolCode;

        const section = new Section({
            sectionName,
            classId,
            capacity,
            roomNumber,
            schoolCode,
            createdBy: req.user.id
        });

        await section.save();

        res.status(201).json({
            success: true,
            message: 'Section created successfully',
            data: section
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
 * @desc    Get Sections
 * @route   GET /api/principal/sections
 * @access  Principal only
 */
exports.getSections = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const sections = await Section.find({ schoolCode });

        res.status(200).json({
            success: true,
            count: sections.length,
            data: sections
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
 * @desc    Update Section
 * @route   PUT /api/principal/sections/:id
 * @access  Principal only
 */
exports.updateSection = async (req, res) => {
    try {
        const { id } = req.params;
        const { sectionName, capacity, roomNumber } = req.body;
        const schoolCode = req.user.schoolCode;

        const section = await Section.findOneAndUpdate(
            { _id: id, schoolCode },
            { sectionName, capacity, roomNumber },
            { new: true, runValidators: true }
        );

        if (!section) {
            return res.status(404).json({
                success: false,
                message: 'Section not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Section updated successfully',
            data: section
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
 * @desc    Update Class
 * @route   PUT /api/principal/classes/:id
 * @access  Principal only
 */
exports.updateClass = async (req, res) => {
    try {
        const { id } = req.params;
        const { className, section, classLevel, capacity, roomNumber, floor } = req.body;
        const schoolCode = req.user.schoolCode;

        const classData = await Class.findOneAndUpdate(
            { _id: id, schoolCode },
            { className, section, classLevel, capacity, roomNumber, floor },
            { new: true, runValidators: true }
        );

        if (!classData) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Class updated successfully',
            data: classData
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
 * @desc    Delete Class
 * @route   DELETE /api/principal/classes/:id
 * @access  Principal only
 */
exports.deleteClass = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolCode = req.user.schoolCode;

        const classData = await Class.findOneAndDelete({ _id: id, schoolCode });

        if (!classData) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Class deleted successfully'
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
 * @desc    Create Class
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
 * @desc    Update Subject
 * @route   PUT /api/principal/subjects/:id
 * @access  Principal only
 */
exports.updateSubject = async (req, res) => {
    try {
        const { id } = req.params;
        const { subjectName, subjectCode, category, classLevels, description, credits, periodsPerWeek, passingMarks, totalMarks } = req.body;
        const schoolCode = req.user.schoolCode;

        const subject = await Subject.findOneAndUpdate(
            { _id: id, schoolCode },
            { subjectName, subjectCode, category, classLevels, description, credits, periodsPerWeek, passingMarks, totalMarks },
            { new: true, runValidators: true }
        );

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Subject updated successfully',
            data: subject
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
 * @desc    Create Room
 * @route   POST /api/principal/rooms
 * @access  Principal only
 */
exports.createRoom = async (req, res) => {
    try {
        const { roomNumber, capacity, type, floor, building, equipment } = req.body;
        const schoolCode = req.user.schoolCode;

        const room = new Room({
            roomNumber,
            capacity,
            type,
            floor,
            building,
            equipment,
            schoolCode,
            createdBy: req.user.id
        });

        await room.save();

        res.status(201).json({
            success: true,
            message: 'Room created successfully',
            data: room
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
 * @desc    Get all rooms
 * @route   GET /api/principal/rooms
 * @access  Principal only
 */
exports.getRooms = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        
        const rooms = await Room.find({ schoolCode })
            .sort({ building: 1, floor: 1, roomNumber: 1 });

        res.status(200).json({
            success: true,
            data: rooms
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
 * @desc    Update Room
 * @route   PUT /api/principal/rooms/:id
 * @access  Principal only
 */
exports.updateRoom = async (req, res) => {
    try {
        const { id } = req.params;
        const { roomNumber, capacity, type, floor, building, equipment } = req.body;
        const schoolCode = req.user.schoolCode;

        const room = await Room.findOneAndUpdate(
            { _id: id, schoolCode },
            { roomNumber, capacity, type, floor, building, equipment },
            { new: true, runValidators: true }
        );

        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Room not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Room updated successfully',
            data: room
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

/**
 * @desc    Create Teacher
 * @route   POST /api/principal/teachers
 * @access  Principal only
 */
exports.createTeacher = async (req, res) => {
    try {
        const { name, email, password, subjects, classes, phone, address } = req.body;
        const schoolCode = req.user.schoolCode;

        const teacher = new User({
            name,
            email,
            password,
            role: 'teacher',
            subjects,
            classes,
            phone,
            address,
            schoolCode,
            createdBy: req.user.id
        });

        await teacher.save();

        res.status(201).json({
            success: true,
            message: 'Teacher created successfully',
            data: teacher
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
 * @desc    Get all teachers
 * @route   GET /api/principal/teachers
 * @access  Principal only
 */
exports.getTeachers = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        
        const teachers = await User.find({ schoolCode, role: 'teacher' })
            .select('-password')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: teachers
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
 * @desc    Update Teacher
 * @route   PUT /api/principal/teachers/:id
 * @access  Principal only
 */
exports.updateTeacher = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, subjects, classes, phone, address } = req.body;
        const schoolCode = req.user.schoolCode;

        const teacher = await User.findOneAndUpdate(
            { _id: id, schoolCode, role: 'teacher' },
            { name, email, subjects, classes, phone, address },
            { new: true, runValidators: true }
        ).select('-password');

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Teacher updated successfully',
            data: teacher
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
 * @desc    Delete Teacher
 * @route   DELETE /api/principal/teachers/:id
 * @access  Principal only
 */
exports.deleteTeacher = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolCode = req.user.schoolCode;

        const teacher = await User.findOneAndDelete({ _id: id, schoolCode, role: 'teacher' });

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Teacher deleted successfully'
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
 * @desc    Reset Teacher Password
 * @route   POST /api/principal/teachers/:id/reset-password
 * @access  Principal only
 */
exports.resetTeacherPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        const schoolCode = req.user.schoolCode;

        const teacher = await User.findOne({ _id: id, schoolCode, role: 'teacher' });

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        teacher.password = newPassword;
        await teacher.save();

        res.status(200).json({
            success: true,
            message: 'Teacher password reset successfully'
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
 * @desc    Create Student
 * @route   POST /api/principal/students
 * @access  Principal only
 */
exports.createStudent = async (req, res) => {
    try {
        const { name, email, password, classId, section, rollNumber, parentInfo } = req.body;
        const schoolCode = req.user.schoolCode;

        const student = new User({
            name,
            email,
            password,
            role: 'student',
            class: classId,
            section,
            rollNumber,
            parentInfo,
            schoolCode,
            createdBy: req.user.id
        });

        await student.save();

        res.status(201).json({
            success: true,
            message: 'Student created successfully',
            data: student
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
 * @desc    Get all students
 * @route   GET /api/principal/students
 * @access  Principal only
 */
exports.getStudents = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const { classId, section } = req.query;
        
        const query = { schoolCode, role: 'student' };
        if (classId) query.class = classId;
        if (section) query.section = section;
        
        const students = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: students
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
 * @desc    Update Student
 * @route   PUT /api/principal/students/:id
 * @access  Principal only
 */
exports.updateStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, classId, section, rollNumber, parentInfo } = req.body;
        const schoolCode = req.user.schoolCode;

        const student = await User.findOneAndUpdate(
            { _id: id, schoolCode, role: 'student' },
            { name, email, class: classId, section, rollNumber, parentInfo },
            { new: true, runValidators: true }
        ).select('-password');

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Student updated successfully',
            data: student
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
 * @desc    Delete Student
 * @route   DELETE /api/principal/students/:id
 * @access  Principal only
 */
exports.deleteStudent = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolCode = req.user.schoolCode;

        const student = await User.findOneAndDelete({ _id: id, schoolCode, role: 'student' });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Student deleted successfully'
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
 * @desc    Bulk Import Students
 * @route   POST /api/principal/students/bulk-import
 * @access  Principal only
 */
exports.bulkImportStudents = async (req, res) => {
    try {
        const { students } = req.body;
        const schoolCode = req.user.schoolCode;

        const createdStudents = await User.insertMany(
            students.map(student => ({
                ...student,
                role: 'student',
                schoolCode,
                createdBy: req.user.id
            }))
        );

        res.status(201).json({
            success: true,
            message: `${createdStudents.length} students imported successfully`,
            data: createdStudents
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
 * @desc    Reset Student Password
 * @route   POST /api/principal/students/:id/reset-password
 * @access  Principal only
 */
exports.resetStudentPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        const schoolCode = req.user.schoolCode;

        const student = await User.findOne({ _id: id, schoolCode, role: 'student' });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        student.password = newPassword;
        await student.save();

        res.status(200).json({
            success: true,
            message: 'Student password reset successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
