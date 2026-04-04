/**
 * 👨‍🎓 PRINCIPAL CONTROLLER
 * Industry-level Principal management for Smart Campus System
 */

const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Routine = require('../models/Routine');
const School = require('../models/School');
const Student = require('../models/Student');
const AuditLog = require('../models/AuditLog');
const AcademicSession = require('../models/AcademicSession');
const Section = require('../models/Section');
const Room = require('../models/Room');
const Exam = require('../models/Exam');

/**
 * @desc    Get all users in principal's school
 * @route   GET /api/principal/users
 * @access  Principal only
 */
exports.getUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, role, search } = req.query;
        const skip = (page - 1) * limit;
        const schoolCode = req.user.schoolCode;

        // Build query - only users in principal's school
        const query = { schoolCode };
        if (role) query.role = role;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        // Principal can only see teacher, student, parent, accountant
        const manageableRoles = ['teacher', 'student', 'parent', 'accountant'];
        if (role && !manageableRoles.includes(role)) {
            return res.status(403).json({
                success: false,
                message: `You cannot view ${role} users`
            });
        }

        if (!role) {
            query.role = { $in: manageableRoles };
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving users',
            error: error.message
        });
    }
};

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

        if (!className || !section || classLevel === undefined || capacity === undefined) {
            return res.status(400).json({
                success: false,
                message: 'className, section, classLevel and capacity are required'
            });
        }

        const schoolCode = req.user.schoolCode;
        const normalizedSection = section?.trim()?.toUpperCase();

        let effectiveAcademicYear = academicYear;
        if (!effectiveAcademicYear) {
            const school = await School.findOne({ schoolCode }).select('academicSettings.currentSession');
            effectiveAcademicYear = school?.academicSettings?.currentSession || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
        }

        // Check if class already exists
        const existingClass = await Class.findOne({
            schoolCode,
            className,
            section: normalizedSection,
            academicYear: effectiveAcademicYear
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
            section: normalizedSection,
            classLevel,
            capacity,
            roomNumber,
            floor,
            academicYear: effectiveAcademicYear,
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
        if (error.name === 'ValidationError' || error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed for class',
                errors: error.errors
                    ? Object.values(error.errors).map(e => e.message)
                    : ['Duplicate class for this school/section/year']
            });
        }
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
 * @desc    Assign teacher to subject within a class (class ⇄ subject ⇄ teacher mapping)
 * @route   POST /api/principal/classes/:classId/subjects/assign
 * @access  Principal only
 */
exports.assignTeacherToSubject = async (req, res) => {
    try {
        const { classId } = req.params;
        const { subjectId, teacherId, periodsPerWeek = 5 } = req.body;
        const schoolCode = req.user.schoolCode;

        if (!classId || !subjectId || !teacherId) {
            return res.status(400).json({
                success: false,
                message: 'classId, subjectId and teacherId are required'
            });
        }

        const [classDoc, subjectDoc, teacherDoc] = await Promise.all([
            Class.findOne({ _id: classId, schoolCode }),
            Subject.findOne({ _id: subjectId, schoolCode }),
            User.findOne({ _id: teacherId, schoolCode, role: 'teacher' })
        ]);

        if (!classDoc) return res.status(404).json({ success: false, message: 'Class not found' });
        if (!subjectDoc) return res.status(404).json({ success: false, message: 'Subject not found' });
        if (!teacherDoc) return res.status(404).json({ success: false, message: 'Teacher not found in this school' });

        // Upsert assignment inside class.subjects
        const idx = classDoc.subjects.findIndex(
            s => String(s.subjectId) === String(subjectId)
        );
        const payload = {
            subjectId,
            subjectName: subjectDoc.subjectName,
            subjectCode: subjectDoc.subjectCode,
            teacherId,
            teacherName: teacherDoc.name,
            periodsPerWeek,
            isActive: true
        };

        if (idx >= 0) {
            classDoc.subjects[idx] = { ...classDoc.subjects[idx].toObject?.() ?? {}, ...payload };
        } else {
            classDoc.subjects.push(payload);
        }

        await classDoc.save();

        // Mirror to TeacherAssignment collection for teacher-facing flows
        try {
            const TeacherAssignment = require('../models/TeacherAssignment');
            await TeacherAssignment.findOneAndUpdate(
                {
                    teacher: teacherId,
                    subject: String(subjectDoc._id),
                    schoolCode,
                    classes: classId,
                    academicYear: classDoc.academicYear
                },
                {
                    schoolCode,
                    teacher: teacherId,
                    subject: String(subjectDoc._id),
                    subjectName: subjectDoc.subjectName,
                    classes: [String(classId)],
                    sections: [classDoc.section],
                    periodsPerWeek,
                    academicYear: classDoc.academicYear,
                    assignedBy: req.user._id,
                    isActive: true
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } catch (assignErr) {
            console.warn('TeacherAssignment mirror warning:', assignErr.message);
        }

        res.status(200).json({
            success: true,
            message: 'Teacher assigned to subject for class',
            data: classDoc
        });
    } catch (error) {
        console.error('assignTeacherToSubject error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign teacher to subject',
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

        if (!subjectName || !subjectCode) {
            return res.status(400).json({
                success: false,
                message: 'subjectName and subjectCode are required'
            });
        }

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
        if (error.name === 'ValidationError' || error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed for subject',
                errors: error.errors ? Object.values(error.errors).map(e => e.message) : ['Duplicate subject code']
            });
        }
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
        const schoolId = req.user.schoolId;
        const schoolName = req.user.schoolName;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const passwordPolicy = /^(?=.{8,128}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;
        if (!passwordPolicy.test(password)) {
            return res.status(400).json({ success: false, message: 'Password must be 8-128 chars and include uppercase, lowercase, number, and symbol.' });
        }

        const existingTeacher = await User.findOne({ email: normalizedEmail, schoolId, role: 'teacher' });
        if (existingTeacher) {
            return res.status(409).json({ success: false, message: 'Teacher with this email already exists in your school.' });
        }

        const teacher = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password,
            role: 'teacher',
            subjects: subjects || [],
            classes: classes || [],
            phone,
            address,
            schoolId,
            schoolCode,
            schoolName,
            isApproved: true,
            createdBy: req.user.id
        });

        const teacherData = teacher.toObject();
        delete teacherData.password;

        res.status(201).json({
            success: true,
            message: 'Teacher created successfully',
            data: teacherData
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
 * @desc    Reset User Password (Principal)
 * @route   POST /api/principal/users/:userId/reset-password
 * @access  Principal only
 * 
 * Principal can reset password for:
 * - Teachers in their school
 * - Students in their school
 * - Parents in their school
 * - Accountants in their school
 * 
 * Cannot reset:
 * - Other principals
 * - Super admin
 * - Users in other schools
 */
exports.resetUserPassword = async (req, res) => {
    try {
        const { userId } = req.params;
        const { newPassword, forceChangeOnNextLogin } = req.body;
        const principalSchoolCode = req.user.schoolCode;

        // ===== VALIDATION =====
        if (!newPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password is required'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        if (newPassword.length > 128) {
            return res.status(400).json({
                success: false,
                message: 'Password must be less than 128 characters'
            });
        }

        // ===== FETCH TARGET USER =====
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // ===== AUTHORIZATION CHECKS =====
        // Check if target user is in same school
        if (targetUser.schoolCode !== principalSchoolCode) {
            return res.status(403).json({
                success: false,
                message: 'You can only manage users in your own school'
            });
        }

        // Check if target role is manageable by principal
        const manageableRoles = ['teacher', 'student', 'parent', 'accountant'];
        if (!manageableRoles.includes(targetUser.role)) {
            return res.status(403).json({
                success: false,
                message: `You cannot reset ${targetUser.role} password`
            });
        }

        // ===== USE PASSWORD SERVICE =====
        const passwordService = require('../services/passwordResetService');
        const result = await passwordService.resetUserPassword({
            targetUserId: userId,
            newPassword,
            requesterId: req.user.id,
            requesterRole: 'principal',
            requesterSchoolCode: principalSchoolCode,
            forceChangeOnNextLogin,
            req
        });

        res.status(200).json(result);

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to reset password'
        });
    }
};

/**
 * @desc    Reset Teacher Password (Principal) - Deprecated
 * @route   POST /api/principal/teachers/:id/reset-password
 * @access  Principal only
 * @deprecated Use POST /api/principal/users/:id/reset-password instead
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

        // Hash password explicitly (not relying on pre-save hook)
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        teacher.password = hashedPassword;
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
        const schoolId = req.user.schoolId;
        const schoolName = req.user.schoolName;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const passwordPolicy = /^(?=.{8,128}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;
        if (!passwordPolicy.test(password)) {
            return res.status(400).json({ success: false, message: 'Password must be 8-128 chars and include uppercase, lowercase, number, and symbol.' });
        }

        const existingStudent = await User.findOne({ email: normalizedEmail, schoolId, role: 'student' });
        if (existingStudent) {
            return res.status(409).json({ success: false, message: 'Student with this email already exists in your school.' });
        }

        const student = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password,
            role: 'student',
            classId,
            section,
            rollNumber,
            parentInfo,
            schoolId,
            schoolCode,
            schoolName,
            isApproved: true, // auto-approve students created by principal
            createdBy: req.user.id
        });

        const studentData = student.toObject();
        delete studentData.password;

        // Mirror to Student collection for analytics/parent dashboards
        try {
            let className = 'Unassigned';
            if (classId) {
                const classDoc = await Class.findById(classId).select('className section');
                if (classDoc) {
                    className = classDoc.className;
                }
            }

            await Student.create({
                _id: student._id,
                name: name.trim(),
                roll: rollNumber || student._id.toString().slice(-6),
                studentClass: className,
                section,
                guardian: parentInfo
                    ? {
                          name: parentInfo.name,
                          phone: parentInfo.phone,
                          email: parentInfo.email
                      }
                    : undefined,
                schoolCode,
                parentId: undefined,
                addedBy: req.user.id,
                updatedBy: req.user.id,
                isActive: true
            });
        } catch (mirrorErr) {
            console.error('Student mirror creation warning:', mirrorErr.message);
            studentData.mirrorWarning = 'Student created but legacy Student document could not be stored';
        }

        res.status(201).json({
            success: true,
            message: 'Student created successfully',
            data: studentData
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
        if (classId) query.classId = classId;
        if (section) query.section = section;
        
        const students = await User.find(query)
            .populate('classId', 'className section classLevel')
            .select('-password')
            .sort({ createdAt: -1 });

        const normalizedStudents = students.map((student) => {
            const studentData = student.toObject();
            if (studentData.classId?.className && !studentData.studentClass) {
                studentData.studentClass = studentData.classId.section
                    ? `${studentData.classId.className} - ${studentData.classId.section}`
                    : studentData.classId.className;
            }
            return studentData;
        });

        res.status(200).json({
            success: true,
            data: normalizedStudents
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
            { name, email, classId, section, rollNumber, parentInfo },
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
 * @desc    Reset Student Password (Principal) - Deprecated
 * @route   POST /api/principal/students/:id/reset-password
 * @access  Principal only
 * @deprecated Use POST /api/principal/users/:id/reset-password instead
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

        // Hash password explicitly (not relying on pre-save hook)
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        student.password = hashedPassword;
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

/**
 * @desc    Create Parent and optionally link to students
 * @route   POST /api/principal/parents
 * @access  Principal only
 */
exports.createParent = async (req, res) => {
    try {
        const { name, email, password, phone, address, studentIds = [] } = req.body;
        const schoolCode = req.user.schoolCode;
        const schoolId = req.user.schoolId;
        const schoolName = req.user.schoolName;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
        }

        const normalizedEmail = email.trim().toLowerCase();
        // Require 8-128 chars, at least 1 lower, 1 upper, 1 digit, 1 symbol
        const passwordPolicy = /^(?=.{8,128}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;
        if (!passwordPolicy.test(password)) {
            return res.status(400).json({ success: false, message: 'Password must be 8-128 chars and include uppercase, lowercase, number, and symbol.' });
        }

        const existingParent = await User.findOne({ email: normalizedEmail, schoolId, role: 'parent' });
        if (existingParent) {
            return res.status(409).json({ success: false, message: 'Parent with this email already exists in your school.' });
        }

        const parent = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password,
            role: 'parent',
            phone,
            address,
            schoolId,
            schoolCode,
            schoolName,
            isApproved: true,
            createdBy: req.user.id
        });

        // Link parent info to provided students (User + legacy Student)
        let linked = 0;
        for (const sid of studentIds) {
            const studentUser = await User.findOne({ _id: sid, schoolCode, role: 'student' });
            if (studentUser) {
                studentUser.parentInfo = {
                    name: parent.name,
                    email: parent.email,
                    phone: parent.phone
                };
                await studentUser.save();
                linked += 1;
            }
            await Student.findOneAndUpdate(
                { _id: sid, schoolCode },
                {
                    parentId: parent._id,
                    'guardian.name': parent.name,
                    'guardian.email': parent.email,
                    'guardian.phone': parent.phone
                }
            );
        }

        res.status(201).json({
            success: true,
            message: 'Parent created successfully',
            data: {
                parentId: parent._id,
                linkedStudents: linked
            }
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
 * @desc    List parents in the principal's school
 * @route   GET /api/principal/parents
 * @access  Principal only
 */
exports.getParents = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const parents = await User.find({ schoolCode, role: 'parent' })
            .select('-password')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: parents
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
