/**
 * 👨‍🎓 PRINCIPAL CONTROLLER
 * Industry-level Principal management for Smart Campus System
 */

const mongoose = require('mongoose');
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
const Result = require('../models/Result');
const Fee = require('../models/Fee');
const PaymentHistory = require('../models/PaymentHistory');
const Attendance = require('../models/Attendance');
const PDFDocument = require('pdfkit');
const { assignTeacherSubjectToClasses, AssignmentServiceError } = require('../services/teacherAssignmentService');
const {
    USER_SAFE_RESPONSE_PROJECTION,
    sanitizeUserForResponse
} = require('../utils/safeUserResponse');

const toFiniteNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const toSafeDateIso = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return null;
    return date.toISOString();
};

const normalizeSection = (value) => {
    if (value === undefined || value === null) return '';
    return String(value).trim().toUpperCase();
};

const round2 = (value) => Number(toFiniteNumber(value).toFixed(2));

const monthLabel = (month, year) => {
    const monthNumber = toFiniteNumber(month, 0);
    const normalizedYear = toFiniteNumber(year, 0);
    if (monthNumber < 1 || monthNumber > 12 || normalizedYear <= 0) return `${month}/${year}`;
    const date = new Date(normalizedYear, monthNumber - 1, 1);
    return `${date.toLocaleString('en-US', { month: 'short' })} ${normalizedYear}`;
};

const makeHttpError = (status, message) => {
    const error = new Error(message);
    error.status = status;
    return error;
};

const sanitizeFilenamePart = (value, fallback = 'student') => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return fallback;
    const cleaned = raw.replace(/[^a-z0-9-_]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    return cleaned || fallback;
};

const formatPdfDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-GB');
};

const formatPdfDateTime = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString('en-GB');
};

const formatPdfCurrency = (value) => toFiniteNumber(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

const ensurePdfSpace = (doc, requiredHeight = 30) => {
    if (doc.y + requiredHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
    }
};

const drawPdfHeader = ({ doc, schoolName, title, subtitle }) => {
    doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .text(schoolName || 'Smart Campus', { align: 'center' });
    doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .text(title, { align: 'center' });
    if (subtitle) {
        doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('#555555')
            .text(subtitle, { align: 'center' })
            .fillColor('#000000');
    }
    doc.moveDown(1);
};

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
            .select(USER_SAFE_RESPONSE_PROJECTION)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: users.map((user) => sanitizeUserForResponse(user)),
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
        const schoolId = req.tenant?.schoolId || req.user.schoolId;

        const section = new Section({
            sectionName,
            classId,
            capacity,
            roomNumber,
            ...(schoolId ? { schoolId } : {}),
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
        const schoolId = req.tenant?.schoolId || req.user.schoolId;
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
            ...(schoolId ? { schoolId } : {}),
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
        const schoolId = req.tenant?.schoolId || req.user.schoolId;

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
                code: 'VALIDATION_ERROR',
                message: 'classId, subjectId and teacherId are required',
                data: null
            });
        }
        const result = await assignTeacherSubjectToClasses({
            requester: req.user,
            schoolCode,
            teacherId,
            subjectId,
            classIds: [classId],
            periodsPerWeek
        });

        res.status(200).json({
            success: true,
            code: 'TEACHER_ASSIGNED_TO_CLASS_SUBJECT',
            message: 'Teacher assigned to class and subject successfully',
            data: result
        });
    } catch (error) {
        console.error('assignTeacherToSubject error:', error);

        if (error instanceof AssignmentServiceError) {
            return res.status(error.status).json({
                success: false,
                code: error.code,
                message: error.message,
                data: error.details || null
            });
        }

        res.status(500).json({
            success: false,
            code: 'TEACHER_ASSIGNMENT_FAILED',
            message: 'Failed to assign teacher to subject',
            data: {
                error: error.message
            }
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
            ...(schoolId ? { schoolId } : {}),
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
        const schoolId = req.tenant?.schoolId || req.user.schoolId;

        const room = new Room({
            roomNumber,
            capacity,
            type,
            floor,
            building,
            equipment,
            schoolId,
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

        const teacherData = sanitizeUserForResponse(teacher);

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
            .select(USER_SAFE_RESPONSE_PROJECTION)
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: teachers.map((teacher) => sanitizeUserForResponse(teacher))
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
        ).select(USER_SAFE_RESPONSE_PROJECTION);

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Teacher updated successfully',
            data: sanitizeUserForResponse(teacher)
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
        const targetUser = await User.findOne({
            _id: userId,
            schoolCode: principalSchoolCode
        });
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
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

        const studentData = sanitizeUserForResponse(student);

        // Mirror to Student collection for analytics/parent dashboards
        try {
            let className = 'Unassigned';
            if (classId) {
                const classDoc = await Class.findOne({ _id: classId, schoolCode }).select('className section');
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
                schoolId,
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
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;
        
        const query = { schoolCode, role: 'student' };
        if (classId) query.classId = classId;
        if (section) query.section = section;
        
        const [students, total] = await Promise.all([
            User.find(query)
                .populate('classId', 'className section classLevel')
                .select(USER_SAFE_RESPONSE_PROJECTION)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            User.countDocuments(query)
        ]);

        const normalizedStudents = students.map((student) => {
            const studentData = sanitizeUserForResponse(student);
            if (studentData.classId?.className && !studentData.studentClass) {
                studentData.studentClass = studentData.classId.section
                    ? `${studentData.classId.className} - ${studentData.classId.section}`
                    : studentData.classId.className;
            }
            return studentData;
        });

        res.status(200).json({
            success: true,
            data: normalizedStudents,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(1, Math.ceil(total / limit))
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
 * @desc    Get one student's full profile for principal dashboard
 * @route   GET /api/principal/students/:id/profile
 * @access  Principal only
 */
exports.getStudentFullProfile = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid student id'
            });
        }

        const studentUserQuery = User.findOne({
            _id: id,
            schoolCode,
            role: 'student'
        })
            .populate('classId', 'className section classLevel')
            .select(USER_SAFE_RESPONSE_PROJECTION)
            .lean();

        const studentLedgerQuery = Student.findOne({
            _id: id,
            schoolCode
        }).lean();

        let [studentUser, studentLedger] = await Promise.all([studentUserQuery, studentLedgerQuery]);

        if (studentUser && !studentLedger) {
            const rollFromUser = String(studentUser.rollNumber || '').trim();
            const classNameFromUser = studentUser.classId?.className ? String(studentUser.classId.className).trim() : '';
            const sectionFromUser = normalizeSection(studentUser.section || studentUser.classId?.section);

            if (rollFromUser) {
                const ledgerQuery = {
                    schoolCode,
                    roll: rollFromUser,
                    ...(classNameFromUser ? { studentClass: classNameFromUser } : {}),
                    ...(sectionFromUser ? { section: sectionFromUser } : {})
                };
                studentLedger = await Student.findOne(ledgerQuery).lean();

                if (!studentLedger && ledgerQuery.section) {
                    delete ledgerQuery.section;
                    studentLedger = await Student.findOne(ledgerQuery).lean();
                }
            }
        }

        if (!studentUser && studentLedger) {
            const userQuery = {
                schoolCode,
                role: 'student',
                rollNumber: String(studentLedger.roll || '').trim()
            };

            if (studentLedger.section) {
                userQuery.section = String(studentLedger.section);
            }

            studentUser = await User.findOne(userQuery)
                .populate('classId', 'className section classLevel')
                .select(USER_SAFE_RESPONSE_PROJECTION)
                .lean();
        }

        if (!studentUser && !studentLedger) {
            return res.status(404).json({
                success: false,
                message: 'Student not found in your school'
            });
        }

        const resolvedStudentId = studentLedger?._id ? String(studentLedger._id) : null;
        const className = String(studentUser?.classId?.className || studentLedger?.studentClass || '').trim();
        const section = normalizeSection(studentUser?.section || studentUser?.classId?.section || studentLedger?.section);
        const rollNumber = String(studentUser?.rollNumber || studentLedger?.roll || '').trim();

        let results = [];
        let fees = [];
        let payments = [];
        let attendanceSummary = {
            totalRecords: 0,
            present: 0,
            absent: 0,
            late: 0,
            holiday: 0,
            attendancePercentage: 0
        };
        let recentAttendance = [];

        if (resolvedStudentId) {
            const resultsPromise = Result.find({
                schoolCode,
                studentId: resolvedStudentId,
                isActive: { $ne: false }
            })
                .sort({ examDate: -1, createdAt: -1 })
                .select('examId examName academicYear examDate subjects totalMarks gpa remarks isPublished publishedAt createdAt updatedAt')
                .lean();

            const feesPromise = Fee.find({
                schoolCode,
                studentId: resolvedStudentId
            })
                .sort({ year: -1, month: -1, createdAt: -1 })
                .lean();

            const paymentsPromise = PaymentHistory.find({
                schoolCode,
                studentId: resolvedStudentId
            })
                .populate('receivedBy', 'name role')
                .sort({ createdAt: -1 })
                .limit(25)
                .lean();

            const attendanceMatch = {
                schoolCode,
                'records.studentId': new mongoose.Types.ObjectId(resolvedStudentId)
            };

            const attendanceSummaryPromise = Attendance.aggregate([
                { $match: attendanceMatch },
                { $unwind: '$records' },
                { $match: { 'records.studentId': new mongoose.Types.ObjectId(resolvedStudentId) } },
                {
                    $group: {
                        _id: null,
                        totalRecords: { $sum: 1 },
                        present: {
                            $sum: {
                                $cond: [{ $eq: ['$records.status', 'Present'] }, 1, 0]
                            }
                        },
                        absent: {
                            $sum: {
                                $cond: [{ $eq: ['$records.status', 'Absent'] }, 1, 0]
                            }
                        },
                        late: {
                            $sum: {
                                $cond: [{ $eq: ['$records.status', 'Late'] }, 1, 0]
                            }
                        },
                        holiday: {
                            $sum: {
                                $cond: [{ $eq: ['$records.status', 'Holiday'] }, 1, 0]
                            }
                        }
                    }
                }
            ]);

            const recentAttendancePromise = Attendance.find(attendanceMatch)
                .select('date subject records')
                .sort({ date: -1, createdAt: -1 })
                .limit(25)
                .lean();

            const [resultRows, feeRows, paymentRows, attendanceSummaryRows, attendanceRows] = await Promise.all([
                resultsPromise,
                feesPromise,
                paymentsPromise,
                attendanceSummaryPromise,
                recentAttendancePromise
            ]);

            results = resultRows;
            fees = feeRows;
            payments = paymentRows;

            const attendanceBase = attendanceSummaryRows?.[0];
            if (attendanceBase) {
                const totalRecords = toFiniteNumber(attendanceBase.totalRecords);
                const present = toFiniteNumber(attendanceBase.present);
                const late = toFiniteNumber(attendanceBase.late);
                attendanceSummary = {
                    totalRecords,
                    present,
                    absent: toFiniteNumber(attendanceBase.absent),
                    late,
                    holiday: toFiniteNumber(attendanceBase.holiday),
                    attendancePercentage: totalRecords > 0 ? round2(((present + late) / totalRecords) * 100) : 0
                };
            }

            recentAttendance = attendanceRows
                .map((row) => {
                    const studentRecord = (row.records || []).find((record) => String(record.studentId) === resolvedStudentId);
                    if (!studentRecord) return null;
                    return {
                        attendanceId: row._id,
                        date: row.date,
                        subject: row.subject || null,
                        status: studentRecord.status || 'Not Marked',
                        remarks: studentRecord.remarks || ''
                    };
                })
                .filter(Boolean);
        }

        const feeSummary = fees.reduce((acc, fee) => {
            const amountDue = toFiniteNumber(fee.amountDue);
            const amountPaid = toFiniteNumber(fee.amountPaid);
            const dueAmount = Math.max(0, amountDue - amountPaid);
            acc.totalInvoices += 1;
            acc.totalAmountDue += amountDue;
            acc.totalAmountPaid += amountPaid;
            acc.totalOutstanding += dueAmount;
            if (fee.status === 'Paid') acc.paidInvoices += 1;
            else if (fee.status === 'Partial') acc.partialInvoices += 1;
            else acc.unpaidInvoices += 1;
            return acc;
        }, {
            totalInvoices: 0,
            totalAmountDue: 0,
            totalAmountPaid: 0,
            totalOutstanding: 0,
            paidInvoices: 0,
            partialInvoices: 0,
            unpaidInvoices: 0
        });

        feeSummary.totalAmountDue = round2(feeSummary.totalAmountDue);
        feeSummary.totalAmountPaid = round2(feeSummary.totalAmountPaid);
        feeSummary.totalOutstanding = round2(feeSummary.totalOutstanding);

        const gpaValues = results
            .map((row) => Number(row.gpa))
            .filter((value) => Number.isFinite(value));

        const resultSummary = {
            totalResults: results.length,
            publishedResults: results.filter((row) => row.isPublished).length,
            draftResults: results.filter((row) => !row.isPublished).length,
            averageGpa: gpaValues.length ? round2(gpaValues.reduce((sum, value) => sum + value, 0) / gpaValues.length) : 0,
            lastExamDate: results.length ? toSafeDateIso(results[0].examDate) : null
        };

        res.status(200).json({
            success: true,
            data: {
                student: {
                    userId: studentUser?._id || null,
                    studentId: studentLedger?._id || null,
                    name: studentUser?.name || studentLedger?.name || null,
                    email: studentUser?.email || null,
                    phone: studentUser?.phone || studentLedger?.phone || '',
                    address: studentUser?.address || studentLedger?.address || '',
                    profileImage: studentUser?.profileImage || studentLedger?.photo?.url || null,
                    schoolId: studentUser?.schoolId || null,
                    schoolCode,
                    classId: studentUser?.classId?._id || null,
                    className: className || null,
                    classLevel: studentUser?.classId?.classLevel || null,
                    section: section || null,
                    rollNumber: rollNumber || null,
                    parentInfo: studentUser?.parentInfo || null,
                    guardian: studentLedger?.guardian || null,
                    fatherName: studentLedger?.fatherName || null,
                    motherName: studentLedger?.motherName || null,
                    isApproved: studentUser?.isApproved ?? null,
                    isActive: (studentUser?.isActive ?? studentLedger?.isActive ?? null),
                    createdAt: toSafeDateIso(studentUser?.createdAt || studentLedger?.createdAt),
                    updatedAt: toSafeDateIso(studentUser?.updatedAt || studentLedger?.updatedAt)
                },
                linkage: {
                    userRecordFound: Boolean(studentUser?._id),
                    studentLedgerFound: Boolean(studentLedger?._id),
                    dataStudentId: studentLedger?._id || null
                },
                attendance: {
                    summary: attendanceSummary,
                    recent: recentAttendance.map((row) => ({
                        ...row,
                        date: toSafeDateIso(row.date)
                    }))
                },
                fees: {
                    summary: {
                        ...feeSummary,
                        lastPaymentAt: toSafeDateIso(payments[0]?.createdAt)
                    },
                    details: fees.map((fee) => ({
                        feeId: fee._id,
                        month: fee.month,
                        year: fee.year,
                        monthLabel: monthLabel(fee.month, fee.year),
                        amountDue: toFiniteNumber(fee.amountDue),
                        amountPaid: toFiniteNumber(fee.amountPaid),
                        dueAmount: round2(Math.max(0, toFiniteNumber(fee.amountDue) - toFiniteNumber(fee.amountPaid))),
                        status: fee.status,
                        updatedAt: toSafeDateIso(fee.updatedAt || fee.createdAt)
                    })),
                    recentPayments: payments.map((payment) => ({
                        paymentId: payment._id,
                        feeId: payment.feeId || null,
                        month: payment.month,
                        year: payment.year,
                        monthLabel: monthLabel(payment.month, payment.year),
                        amount: toFiniteNumber(payment.amount),
                        paymentMethod: payment.paymentMethod || 'Cash',
                        transactionId: payment.transactionId || null,
                        remarks: payment.remarks || '',
                        receivedBy: payment.receivedBy ? {
                            id: payment.receivedBy._id,
                            name: payment.receivedBy.name,
                            role: payment.receivedBy.role || null
                        } : null,
                        createdAt: toSafeDateIso(payment.createdAt)
                    }))
                },
                results: {
                    summary: resultSummary,
                    history: results.map((row) => ({
                        resultId: row._id,
                        examId: row.examId || null,
                        examName: row.examName,
                        academicYear: row.academicYear || null,
                        examDate: toSafeDateIso(row.examDate),
                        totalMarks: toFiniteNumber(row.totalMarks),
                        gpa: toFiniteNumber(row.gpa),
                        isPublished: Boolean(row.isPublished),
                        publishedAt: toSafeDateIso(row.publishedAt),
                        remarks: row.remarks || '',
                        subjects: (row.subjects || []).map((subject) => ({
                            subjectId: subject.subjectId || null,
                            subjectName: subject.subjectName,
                            marks: toFiniteNumber(subject.marks),
                            grade: subject.grade || null
                        })),
                        createdAt: toSafeDateIso(row.createdAt),
                        updatedAt: toSafeDateIso(row.updatedAt)
                    }))
                }
            }
        });
    } catch (error) {
        console.error('Error getting principal student profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch student profile',
            error: error.message
        });
    }
};

const getStudentExportBundle = async (schoolCode, id) => {
    if (!mongoose.Types.ObjectId.isValid(String(id || ''))) {
        throw makeHttpError(400, 'Invalid student id');
    }

    const studentUserQuery = User.findOne({
        _id: id,
        schoolCode,
        role: 'student'
    })
        .populate('classId', 'className section classLevel')
        .select(USER_SAFE_RESPONSE_PROJECTION)
        .lean();

    const studentLedgerQuery = Student.findOne({
        _id: id,
        schoolCode
    }).lean();

    let [studentUser, studentLedger] = await Promise.all([studentUserQuery, studentLedgerQuery]);

    if (studentUser && !studentLedger) {
        const rollFromUser = String(studentUser.rollNumber || '').trim();
        const classNameFromUser = String(studentUser.classId?.className || '').trim();
        const sectionFromUser = normalizeSection(studentUser.section || studentUser.classId?.section);

        if (rollFromUser) {
            const ledgerQuery = {
                schoolCode,
                roll: rollFromUser,
                ...(classNameFromUser ? { studentClass: classNameFromUser } : {}),
                ...(sectionFromUser ? { section: sectionFromUser } : {})
            };
            studentLedger = await Student.findOne(ledgerQuery).lean();
            if (!studentLedger && ledgerQuery.section) {
                delete ledgerQuery.section;
                studentLedger = await Student.findOne(ledgerQuery).lean();
            }
        }
    }

    if (!studentUser && studentLedger) {
        const userQuery = {
            schoolCode,
            role: 'student',
            rollNumber: String(studentLedger.roll || '').trim()
        };
        if (studentLedger.section) {
            userQuery.section = String(studentLedger.section);
        }
        studentUser = await User.findOne(userQuery)
            .populate('classId', 'className section classLevel')
            .select(USER_SAFE_RESPONSE_PROJECTION)
            .lean();
    }

    if (!studentUser && !studentLedger) {
        throw makeHttpError(404, 'Student not found in your school');
    }

    const resolvedStudentId = studentLedger?._id ? String(studentLedger._id) : null;

    let results = [];
    let fees = [];
    let payments = [];
    let attendanceSummary = {
        totalRecords: 0,
        present: 0,
        absent: 0,
        late: 0,
        holiday: 0,
        attendancePercentage: 0
    };
    let recentAttendance = [];

    if (resolvedStudentId) {
        const attendanceMatch = {
            schoolCode,
            'records.studentId': new mongoose.Types.ObjectId(resolvedStudentId)
        };

        const [resultRows, feeRows, paymentRows, attendanceSummaryRows, attendanceRows] = await Promise.all([
            Result.find({
                schoolCode,
                studentId: resolvedStudentId,
                isActive: { $ne: false }
            })
                .sort({ examDate: -1, createdAt: -1 })
                .select('examName academicYear examDate subjects totalMarks gpa remarks isPublished publishedAt')
                .lean(),
            Fee.find({
                schoolCode,
                studentId: resolvedStudentId
            })
                .sort({ year: -1, month: -1, createdAt: -1 })
                .lean(),
            PaymentHistory.find({
                schoolCode,
                studentId: resolvedStudentId
            })
                .populate('receivedBy', 'name role')
                .sort({ createdAt: -1 })
                .limit(25)
                .lean(),
            Attendance.aggregate([
                { $match: attendanceMatch },
                { $unwind: '$records' },
                { $match: { 'records.studentId': new mongoose.Types.ObjectId(resolvedStudentId) } },
                {
                    $group: {
                        _id: null,
                        totalRecords: { $sum: 1 },
                        present: { $sum: { $cond: [{ $eq: ['$records.status', 'Present'] }, 1, 0] } },
                        absent: { $sum: { $cond: [{ $eq: ['$records.status', 'Absent'] }, 1, 0] } },
                        late: { $sum: { $cond: [{ $eq: ['$records.status', 'Late'] }, 1, 0] } },
                        holiday: { $sum: { $cond: [{ $eq: ['$records.status', 'Holiday'] }, 1, 0] } }
                    }
                }
            ]),
            Attendance.find(attendanceMatch)
                .select('date subject records')
                .sort({ date: -1, createdAt: -1 })
                .limit(30)
                .lean()
        ]);

        results = resultRows;
        fees = feeRows;
        payments = paymentRows;

        const summaryBase = attendanceSummaryRows?.[0];
        if (summaryBase) {
            const totalRecords = toFiniteNumber(summaryBase.totalRecords);
            const present = toFiniteNumber(summaryBase.present);
            const late = toFiniteNumber(summaryBase.late);
            attendanceSummary = {
                totalRecords,
                present,
                absent: toFiniteNumber(summaryBase.absent),
                late,
                holiday: toFiniteNumber(summaryBase.holiday),
                attendancePercentage: totalRecords > 0 ? round2(((present + late) / totalRecords) * 100) : 0
            };
        }

        recentAttendance = attendanceRows
            .map((row) => {
                const studentRecord = (row.records || []).find((record) => String(record.studentId) === resolvedStudentId);
                if (!studentRecord) return null;
                return {
                    date: toSafeDateIso(row.date),
                    subject: row.subject || null,
                    status: studentRecord.status || 'Not Marked',
                    remarks: studentRecord.remarks || ''
                };
            })
            .filter(Boolean);
    }

    const feeSummary = fees.reduce((acc, fee) => {
        const amountDue = toFiniteNumber(fee.amountDue);
        const amountPaid = toFiniteNumber(fee.amountPaid);
        const dueAmount = Math.max(0, amountDue - amountPaid);
        acc.totalInvoices += 1;
        acc.totalAmountDue += amountDue;
        acc.totalAmountPaid += amountPaid;
        acc.totalOutstanding += dueAmount;
        if (fee.status === 'Paid') acc.paidInvoices += 1;
        else if (fee.status === 'Partial') acc.partialInvoices += 1;
        else acc.unpaidInvoices += 1;
        return acc;
    }, {
        totalInvoices: 0,
        totalAmountDue: 0,
        totalAmountPaid: 0,
        totalOutstanding: 0,
        paidInvoices: 0,
        partialInvoices: 0,
        unpaidInvoices: 0
    });

    const gpaValues = results.map((row) => Number(row.gpa)).filter((value) => Number.isFinite(value));

    return {
        student: {
            name: studentUser?.name || studentLedger?.name || 'Student',
            email: studentUser?.email || 'N/A',
            phone: studentUser?.phone || studentLedger?.phone || 'N/A',
            address: studentUser?.address || studentLedger?.address || 'N/A',
            className: studentUser?.classId?.className || studentLedger?.studentClass || 'N/A',
            section: studentUser?.section || studentUser?.classId?.section || studentLedger?.section || 'N/A',
            rollNumber: studentUser?.rollNumber || studentLedger?.roll || 'N/A',
            parentName: studentUser?.parentInfo?.name || studentLedger?.guardian?.name || 'N/A',
            parentEmail: studentUser?.parentInfo?.email || studentLedger?.guardian?.email || 'N/A',
            parentPhone: studentUser?.parentInfo?.phone || studentLedger?.guardian?.phone || 'N/A',
            updatedAt: toSafeDateIso(studentUser?.updatedAt || studentLedger?.updatedAt)
        },
        results: {
            summary: {
                totalResults: results.length,
                publishedResults: results.filter((row) => row.isPublished).length,
                draftResults: results.filter((row) => !row.isPublished).length,
                averageGpa: gpaValues.length ? round2(gpaValues.reduce((sum, value) => sum + value, 0) / gpaValues.length) : 0
            },
            history: results.map((row) => ({
                examName: row.examName || 'Exam',
                academicYear: row.academicYear || 'N/A',
                examDate: toSafeDateIso(row.examDate),
                totalMarks: toFiniteNumber(row.totalMarks),
                gpa: toFiniteNumber(row.gpa),
                isPublished: Boolean(row.isPublished),
                remarks: row.remarks || '',
                subjects: (row.subjects || []).map((subject) => ({
                    subjectName: subject.subjectName,
                    marks: toFiniteNumber(subject.marks),
                    grade: subject.grade || 'N/A'
                }))
            }))
        },
        fees: {
            summary: {
                totalInvoices: feeSummary.totalInvoices,
                paidInvoices: feeSummary.paidInvoices,
                partialInvoices: feeSummary.partialInvoices,
                unpaidInvoices: feeSummary.unpaidInvoices,
                totalAmountDue: round2(feeSummary.totalAmountDue),
                totalAmountPaid: round2(feeSummary.totalAmountPaid),
                totalOutstanding: round2(feeSummary.totalOutstanding)
            },
            details: fees.map((fee) => ({
                monthLabel: monthLabel(fee.month, fee.year),
                amountDue: toFiniteNumber(fee.amountDue),
                amountPaid: toFiniteNumber(fee.amountPaid),
                dueAmount: round2(Math.max(0, toFiniteNumber(fee.amountDue) - toFiniteNumber(fee.amountPaid))),
                status: fee.status
            })),
            recentPayments: payments.map((payment) => ({
                monthLabel: monthLabel(payment.month, payment.year),
                amount: toFiniteNumber(payment.amount),
                paymentMethod: payment.paymentMethod || 'Cash',
                createdAt: toSafeDateIso(payment.createdAt)
            }))
        },
        attendance: {
            summary: attendanceSummary,
            recent: recentAttendance
        }
    };
};

const getStudentPdfContext = async (schoolCode, studentId) => {
    const [bundle, school] = await Promise.all([
        getStudentExportBundle(schoolCode, studentId),
        School.findOne({ schoolCode }).select('schoolName').lean()
    ]);

    return {
        bundle,
        schoolName: school?.schoolName || schoolCode,
        filenameToken: `${sanitizeFilenamePart(bundle.student.name, 'student')}_${sanitizeFilenamePart(bundle.student.rollNumber, 'roll')}`
    };
};

/**
 * @desc    Download student profile summary PDF
 * @route   GET /api/principal/students/:id/export/profile-pdf
 * @access  Principal only
 */
exports.downloadStudentProfilePDF = async (req, res) => {
    try {
        const { bundle, schoolName, filenameToken } = await getStudentPdfContext(req.user.schoolCode, req.params.id);
        const filename = `student_profile_${filenameToken}.pdf`;

        const doc = new PDFDocument({ margin: 48, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        drawPdfHeader({
            doc,
            schoolName,
            title: 'Student Profile Summary',
            subtitle: `Generated: ${formatPdfDateTime(new Date().toISOString())}`
        });

        const rows = [
            ['Student Name', bundle.student.name],
            ['Email', bundle.student.email],
            ['Phone', bundle.student.phone],
            ['Address', bundle.student.address],
            ['Class', bundle.student.className],
            ['Section', bundle.student.section],
            ['Roll Number', bundle.student.rollNumber],
            ['Parent Name', bundle.student.parentName],
            ['Parent Email', bundle.student.parentEmail],
            ['Parent Phone', bundle.student.parentPhone],
            ['Last Updated', formatPdfDateTime(bundle.student.updatedAt)]
        ];

        doc.font('Helvetica-Bold').fontSize(12).text('Profile Information');
        doc.moveDown(0.4);
        rows.forEach(([label, value]) => {
            ensurePdfSpace(doc, 18);
            doc.font('Helvetica-Bold').fontSize(10).text(`${label}:`, { continued: true });
            doc.font('Helvetica').fontSize(10).text(` ${value || 'N/A'}`);
        });

        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').fontSize(12).text('Academic & Financial Snapshot');
        doc.moveDown(0.4);
        const snapshot = [
            ['Total Results', String(bundle.results.summary.totalResults)],
            ['Published Results', String(bundle.results.summary.publishedResults)],
            ['Average GPA', String(bundle.results.summary.averageGpa)],
            ['Attendance Rate', `${toFiniteNumber(bundle.attendance.summary.attendancePercentage)}%`],
            ['Total Invoices', String(bundle.fees.summary.totalInvoices)],
            ['Outstanding Fees', formatPdfCurrency(bundle.fees.summary.totalOutstanding)]
        ];
        snapshot.forEach(([label, value]) => {
            ensurePdfSpace(doc, 18);
            doc.font('Helvetica-Bold').fontSize(10).text(`${label}:`, { continued: true });
            doc.font('Helvetica').fontSize(10).text(` ${value}`);
        });

        doc.end();
    } catch (error) {
        const status = error.status || 500;
        const message = status === 500 ? 'Failed to generate student profile PDF' : error.message;
        if (status === 500) {
            console.error('Profile PDF export error:', error);
        }
        if (!res.headersSent) {
            res.status(status).json({ success: false, message });
        }
    }
};

/**
 * @desc    Download student result report PDF
 * @route   GET /api/principal/students/:id/export/result-pdf
 * @access  Principal only
 */
exports.downloadStudentResultPDF = async (req, res) => {
    try {
        const { bundle, schoolName, filenameToken } = await getStudentPdfContext(req.user.schoolCode, req.params.id);
        const filename = `student_results_${filenameToken}.pdf`;

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        drawPdfHeader({
            doc,
            schoolName,
            title: 'Student Result Report',
            subtitle: `${bundle.student.name} | Roll: ${bundle.student.rollNumber}`
        });

        const summaryRows = [
            `Total Results: ${bundle.results.summary.totalResults}`,
            `Published: ${bundle.results.summary.publishedResults}`,
            `Draft: ${bundle.results.summary.draftResults}`,
            `Average GPA: ${bundle.results.summary.averageGpa}`
        ];
        doc.font('Helvetica-Bold').fontSize(11).text('Summary');
        summaryRows.forEach((line) => {
            ensurePdfSpace(doc, 16);
            doc.font('Helvetica').fontSize(10).text(line);
        });

        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').fontSize(11).text('Result History');
        doc.moveDown(0.3);

        if (!bundle.results.history.length) {
            doc.font('Helvetica').fontSize(10).text('No result history found for this student.');
        } else {
            bundle.results.history.forEach((row, index) => {
                ensurePdfSpace(doc, 60);
                doc.font('Helvetica-Bold').fontSize(10).text(
                    `${index + 1}. ${row.examName} (${row.academicYear})`
                );
                doc.font('Helvetica').fontSize(9).text(
                    `Date: ${formatPdfDate(row.examDate)} | Marks: ${row.totalMarks} | GPA: ${row.gpa} | Status: ${row.isPublished ? 'Published' : 'Draft'}`
                );
                if (row.subjects?.length) {
                    row.subjects.forEach((subject) => {
                        ensurePdfSpace(doc, 14);
                        doc.font('Helvetica').fontSize(9).text(
                            `   - ${subject.subjectName}: ${subject.marks} (${subject.grade || 'N/A'})`
                        );
                    });
                }
                if (row.remarks) {
                    ensurePdfSpace(doc, 14);
                    doc.font('Helvetica-Oblique').fontSize(9).text(`   Remarks: ${row.remarks}`);
                }
                doc.moveDown(0.3);
            });
        }

        doc.end();
    } catch (error) {
        const status = error.status || 500;
        const message = status === 500 ? 'Failed to generate student result PDF' : error.message;
        if (status === 500) {
            console.error('Result PDF export error:', error);
        }
        if (!res.headersSent) {
            res.status(status).json({ success: false, message });
        }
    }
};

/**
 * @desc    Download student fee report PDF
 * @route   GET /api/principal/students/:id/export/fee-pdf
 * @access  Principal only
 */
exports.downloadStudentFeePDF = async (req, res) => {
    try {
        const { bundle, schoolName, filenameToken } = await getStudentPdfContext(req.user.schoolCode, req.params.id);
        const filename = `student_fees_${filenameToken}.pdf`;

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        drawPdfHeader({
            doc,
            schoolName,
            title: 'Student Fee Report',
            subtitle: `${bundle.student.name} | Roll: ${bundle.student.rollNumber}`
        });

        const summaryRows = [
            `Total Invoices: ${bundle.fees.summary.totalInvoices}`,
            `Paid Invoices: ${bundle.fees.summary.paidInvoices}`,
            `Partial Invoices: ${bundle.fees.summary.partialInvoices}`,
            `Unpaid Invoices: ${bundle.fees.summary.unpaidInvoices}`,
            `Total Due: ${formatPdfCurrency(bundle.fees.summary.totalAmountDue)}`,
            `Total Paid: ${formatPdfCurrency(bundle.fees.summary.totalAmountPaid)}`,
            `Outstanding: ${formatPdfCurrency(bundle.fees.summary.totalOutstanding)}`
        ];
        doc.font('Helvetica-Bold').fontSize(11).text('Summary');
        summaryRows.forEach((line) => {
            ensurePdfSpace(doc, 16);
            doc.font('Helvetica').fontSize(10).text(line);
        });

        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').fontSize(11).text('Fee Details');
        doc.moveDown(0.3);

        if (!bundle.fees.details.length) {
            doc.font('Helvetica').fontSize(10).text('No fee records found for this student.');
        } else {
            bundle.fees.details.forEach((fee, index) => {
                ensurePdfSpace(doc, 16);
                doc.font('Helvetica').fontSize(9).text(
                    `${index + 1}. ${fee.monthLabel} | Due: ${formatPdfCurrency(fee.amountDue)} | Paid: ${formatPdfCurrency(fee.amountPaid)} | Outstanding: ${formatPdfCurrency(fee.dueAmount)} | Status: ${fee.status}`
                );
            });
        }

        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').fontSize(11).text('Recent Payments');
        doc.moveDown(0.3);

        if (!bundle.fees.recentPayments.length) {
            doc.font('Helvetica').fontSize(10).text('No payment history found.');
        } else {
            bundle.fees.recentPayments.slice(0, 20).forEach((payment, index) => {
                ensurePdfSpace(doc, 16);
                doc.font('Helvetica').fontSize(9).text(
                    `${index + 1}. ${payment.monthLabel} | Amount: ${formatPdfCurrency(payment.amount)} | Method: ${payment.paymentMethod} | Date: ${formatPdfDateTime(payment.createdAt)}`
                );
            });
        }

        doc.end();
    } catch (error) {
        const status = error.status || 500;
        const message = status === 500 ? 'Failed to generate student fee PDF' : error.message;
        if (status === 500) {
            console.error('Fee PDF export error:', error);
        }
        if (!res.headersSent) {
            res.status(status).json({ success: false, message });
        }
    }
};

/**
 * @desc    Download student attendance report PDF
 * @route   GET /api/principal/students/:id/export/attendance-pdf
 * @access  Principal only
 */
exports.downloadStudentAttendancePDF = async (req, res) => {
    try {
        const { bundle, schoolName, filenameToken } = await getStudentPdfContext(req.user.schoolCode, req.params.id);
        const filename = `student_attendance_${filenameToken}.pdf`;

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        drawPdfHeader({
            doc,
            schoolName,
            title: 'Student Attendance Report',
            subtitle: `${bundle.student.name} | Roll: ${bundle.student.rollNumber}`
        });

        const summaryRows = [
            `Total Records: ${bundle.attendance.summary.totalRecords}`,
            `Present: ${bundle.attendance.summary.present}`,
            `Late: ${bundle.attendance.summary.late}`,
            `Absent: ${bundle.attendance.summary.absent}`,
            `Holiday: ${bundle.attendance.summary.holiday}`,
            `Attendance Rate: ${bundle.attendance.summary.attendancePercentage}%`
        ];
        doc.font('Helvetica-Bold').fontSize(11).text('Summary');
        summaryRows.forEach((line) => {
            ensurePdfSpace(doc, 16);
            doc.font('Helvetica').fontSize(10).text(line);
        });

        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').fontSize(11).text('Recent Attendance');
        doc.moveDown(0.3);

        if (!bundle.attendance.recent.length) {
            doc.font('Helvetica').fontSize(10).text('No attendance records found for this student.');
        } else {
            bundle.attendance.recent.slice(0, 30).forEach((entry, index) => {
                ensurePdfSpace(doc, 16);
                doc.font('Helvetica').fontSize(9).text(
                    `${index + 1}. ${formatPdfDate(entry.date)} | Subject: ${entry.subject || 'N/A'} | Status: ${entry.status} | Remarks: ${entry.remarks || '-'}`
                );
            });
        }

        doc.end();
    } catch (error) {
        const status = error.status || 500;
        const message = status === 500 ? 'Failed to generate student attendance PDF' : error.message;
        if (status === 500) {
            console.error('Attendance PDF export error:', error);
        }
        if (!res.headersSent) {
            res.status(status).json({ success: false, message });
        }
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
        ).select(USER_SAFE_RESPONSE_PROJECTION);

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Student updated successfully',
            data: sanitizeUserForResponse(student)
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
            .select(USER_SAFE_RESPONSE_PROJECTION)
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: parents.map((parent) => sanitizeUserForResponse(parent))
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
