// controllers/resultController.js
const mongoose = require('mongoose');
const Result = require('../models/Result');
const Student = require('../models/Student');
const School = require('../models/School');
const Class = require('../models/Class');
const Exam = require('../models/Exam');
const Subject = require('../models/Subject');
const TeacherAssignment = require('../models/TeacherAssignment');
const { resolveStudentObjectIdFromUser } = require('../utils/resolveStudentFromUser');
const AuditLog = require('../models/AuditLog');
const PDFDocument = require('pdfkit');
const Excel = require('exceljs');
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');

const normalizeObjectIdString = (value) => {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;
    return mongoose.Types.ObjectId.isValid(raw) ? raw : null;
};

const guardianEmailRegex = (email) => {
    const value = String(email || '').trim();
    if (!value) return null;
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped}$`, 'i');
};

const getParentLinkedStudentIdStrings = async (user) => {
    if (user?.role !== 'parent' || !user?.schoolCode) return [];
    const parentId = normalizeObjectIdString(user._id || user.id);
    const emailRegex = guardianEmailRegex(user.email);
    const conditions = [];
    if (parentId) conditions.push({ parentId });
    if (emailRegex) conditions.push({ 'guardian.email': emailRegex });
    if (!conditions.length) return [];

    const rows = await Student.find({
        schoolCode: user.schoolCode,
        isActive: true,
        $or: conditions
    }).select('_id').lean();

    return rows.map((row) => String(row._id));
};

const getTeacherResultScopes = async (user) => {
    const schoolCode = user?.schoolCode;
    const teacherId = normalizeObjectIdString(user?._id || user?.id);
    if (!schoolCode || !teacherId) return [];

    const assignments = await TeacherAssignment.find({
        schoolCode,
        teacher: teacherId,
        isActive: true
    }).select('classes').lean();

    const classIds = [...new Set(assignments.flatMap((assignment) => assignment.classes || []).map((id) => String(id)))];
    if (!classIds.length) return [];

    const classes = await Class.find({
        _id: { $in: classIds },
        schoolCode
    }).select('className section').lean();

    return classes
        .filter((row) => row.className)
        .map((row) => ({
            studentClass: row.className,
            ...(row.section ? { section: row.section } : {})
        }));
};

const isTeacherAllowedForClassSection = ({ studentClass, section }, scopes) => {
    const className = String(studentClass || '').trim();
    const normalizedSection = section ? String(section).trim().toUpperCase() : null;
    return scopes.some((scope) => {
        if (scope.studentClass !== className) return false;
        if (!scope.section) return true;
        return String(scope.section).trim().toUpperCase() === normalizedSection;
    });
};

const isValidObjectId = (value) => {
    return mongoose.Types.ObjectId.isValid(String(value || ''));
};

const toObjectId = (value) => {
    return isValidObjectId(value) ? new mongoose.Types.ObjectId(String(value)) : null;
};

const findTeacherAssignment = async (teacherId, schoolCode, classId, subjectId) => {
    if (!teacherId || !classId || !subjectId) return null;
    return await TeacherAssignment.findOne({
        teacher: teacherId,
        schoolCode,
        isActive: true,
        classes: classId,
        subject: subjectId
    }).lean();
};

const getTeacherAccessibleClassConditions = async (teacherId, schoolCode) => {
    const assignments = await TeacherAssignment.find({
        teacher: teacherId,
        schoolCode,
        isActive: true
    }).populate('classes', 'className section').lean();

    const conditions = [];
    assignments.forEach((assignment) => {
        (assignment.classes || []).forEach((cls) => {
            if (!cls?.className) return;
            conditions.push({
                studentClass: cls.className,
                ...(cls.section ? { section: cls.section } : {})
            });
        });
    });

    return conditions;
};

// Helper: Calculate Grade
const calculateGrade = (marks, gradingSystem = 'standard') => {
    if (gradingSystem === 'standard') {
        if (marks >= 80) return 'A+';
        if (marks >= 70) return 'A';
        if (marks >= 60) return 'A-';
        if (marks >= 50) return 'B';
        if (marks >= 40) return 'C';
        if (marks >= 33) return 'D';
        return 'F';
    }
    // Add other grading systems if needed
    return 'N/A';
};

// Helper: Calculate GPA
const calculateGPA = (subjects) => {
    const gradePoints = {
        'A+': 5.0, 'A': 4.0, 'A-': 3.5, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0
    };
    let totalPoints = 0;
    let count = 0;
    subjects.forEach(sub => {
        if (sub.grade && gradePoints[sub.grade] !== undefined) {
            totalPoints += gradePoints[sub.grade];
            count++;
        }
    });
    return count > 0 ? (totalPoints / count).toFixed(2) : 0;
};

// @desc    Upload/Publish Result (Teachers/Principal only)
// @route   POST /api/results
// @access  Private
exports.uploadResult = async (req, res) => {
    const { studentId, examName, subjects, examDate, gradingSystem, remarks } = req.body;

    try {
        // Validation
        if (!studentId || !examName || !subjects || !Array.isArray(subjects) || subjects.length === 0) {
            return res.status(400).json({ message: 'Student ID, exam name, and subjects array are required' });
        }

        const normalizedSchoolCode = (req.user.schoolCode || '').toUpperCase();

        // Check if student exists and belongs to this school
        const student = await Student.findOne({ 
            _id: studentId, 
            schoolCode: normalizedSchoolCode 
        });
        if (!student) {
            return res.status(404).json({ message: 'Student not found in your school' });
        }

        const school = await School.findOne({ schoolCode: normalizedSchoolCode }).select('academicSettings.currentSession');
        const derivedAcademicYear = req.body.academicYear || student.academicYear || school?.academicSettings?.currentSession;
        // New workflow: results are created as draft and require principal publish action.
        const isPublished = false;
        const publishedAt = null;

        // Validate each subject
        for (let sub of subjects) {
            if (!sub.subjectName || sub.marks === undefined) {
                return res.status(400).json({ message: 'Each subject must have subjectName and marks' });
            }
            if (sub.marks < 0 || sub.marks > 100) {
                return res.status(400).json({ message: 'Marks must be between 0 and 100' });
            }
        }

        // Check for existing result (same student & exam)
        const existing = await Result.findOne({
            studentId,
            examName: { $regex: new RegExp(`^${examName}$`, 'i') },
            schoolCode: normalizedSchoolCode
        });
        if (existing) {
            return res.status(400).json({ message: 'Result already exists for this student and exam. Use update instead.' });
        }

        // Process subjects with grade
        const updatedSubjects = subjects.map(sub => ({
            ...sub,
            grade: calculateGrade(sub.marks, gradingSystem)
        }));

        const totalMarks = updatedSubjects.reduce((acc, curr) => acc + curr.marks, 0);
        const gpa = calculateGPA(updatedSubjects);

        // Create result
        const result = await Result.create({
            studentId,
            schoolCode: normalizedSchoolCode,
            studentClass: student.studentClass,
            section: student.section,
            roll: student.roll,
            examName,
            examDate: examDate || Date.now(),
            academicYear: derivedAcademicYear,
            subjects: updatedSubjects,
            totalMarks,
            gpa,
            remarks,
            isPublished,
            publishedAt,
            isActive: true
        });

        // Optionally send notification to student/parent
        if (process.env.SEND_RESULT_NOTIFICATION === 'true') {
            sendResultNotification(student, result);
        }

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'RESULT_CREATED_DRAFT',
            details: { studentId, examName, totalMarks, gpa },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({ 
            success: true,
            message: 'Result saved as draft. Principal must publish it for public visibility.',
            result: await result.populate('studentId', 'name fatherName motherName')
        });

    } catch (error) {
        console.error('Upload result error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Duplicate entry: Result already exists' });
        }
        res.status(500).json({ message: 'Failed to publish result' });
    }
};

// @desc    Update existing result
// @route   PUT /api/results/:id
// @access  Private (Teacher/Principal)
exports.updateResult = async (req, res) => {
    try {
        const { id } = req.params;
        const { subjects, examName, examDate, remarks, gradingSystem } = req.body;

        const result = await Result.findById(id);
        if (!result) {
            return res.status(404).json({ message: 'Result not found' });
        }

        // Check school ownership
        if (result.schoolCode !== req.user.schoolCode && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Access denied' });
        }
        if (result.isLocked) {
            return res.status(403).json({ message: 'Result is locked. Principal must unlock to edit.' });
        }
        if (req.user.role === 'teacher' && result.isPublished) {
            return res.status(403).json({ success: false, message: 'Published results can only be edited by principal/admin' });
        }

        // Update fields
        if (subjects) {
            if (!Array.isArray(subjects) || subjects.length === 0) {
                return res.status(400).json({ message: 'Subjects must be a non-empty array' });
            }
            const updatedSubjects = subjects.map(sub => ({
                ...sub,
                grade: calculateGrade(sub.marks, gradingSystem || result.gradingSystem)
            }));
            result.subjects = updatedSubjects;
            result.totalMarks = updatedSubjects.reduce((acc, curr) => acc + curr.marks, 0);
            result.gpa = calculateGPA(updatedSubjects);
        }
        if (examName) result.examName = examName;
        if (examDate) result.examDate = examDate;
        if (remarks !== undefined) result.remarks = remarks;
        if (gradingSystem) result.gradingSystem = gradingSystem;
        if (req.body.academicYear) result.academicYear = req.body.academicYear;
        if (req.body.isPublished !== undefined) {
            if (!['principal', 'admin', 'super_admin'].includes(req.user.role)) {
                return res.status(403).json({ success: false, message: 'Only principal/admin can change publish status' });
            }
            result.isPublished = !!req.body.isPublished;
            result.publishedAt = result.isPublished ? (result.publishedAt || new Date()) : null;
            result.publishedBy = result.isPublished ? (result.publishedBy || req.user._id) : null;
        }

        result.updatedBy = req.user._id;
        result.updatedAt = Date.now();

        await result.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'RESULT_UPDATED',
            details: { resultId: id, examName: result.examName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ 
            message: 'Result updated successfully', 
            result: await result.populate('studentId', 'name')
        });

    } catch (error) {
        console.error('Update result error:', error);
        res.status(500).json({ message: 'Failed to update result' });
    }
};

// @desc    Search result (internal school-scoped lookup)
// @route   POST /api/results/search
// @access  Private
exports.searchResult = async (req, res) => {
    try {
        const { studentClass, roll, examName } = req.body;
        const schoolCode = String(req.user?.schoolCode || '').toUpperCase();

        if (!schoolCode || !studentClass || !roll || !examName) {
            return res.status(400).json({ message: 'Class, roll, and exam name are required' });
        }

        // Case-insensitive search
        const result = await Result.findOne({
            schoolCode,
            studentClass,
            roll: Number(roll),
            examName: { $regex: new RegExp(`^${examName}$`, 'i') },
            isPublished: true
        }).populate('studentId', 'name section fatherName motherName');

        if (!result) {
            return res.status(404).json({ message: 'No result found. Check your information.' });
        }

        // Log search (optional)
        await AuditLog.create({
            user: null,
            action: 'RESULT_SEARCHED',
            details: { schoolCode, studentClass, roll, examName, searchedBy: req.user?._id || req.user?.id },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        }).catch(err => console.error('Audit log error:', err));

        res.json(result);

    } catch (error) {
        console.error('Search result error:', error);
        res.status(500).json({ message: 'Failed to search result' });
    }
};

// @desc    Get all results for a school (with filters)
// @route   GET /api/results
// @access  Private
exports.getResults = async (req, res) => {
    try {
        const { 
            class: className, 
            section, 
            examName, 
            studentId, 
            fromDate, 
            toDate, 
            page = 1, 
            limit = 20 
        } = req.query;
        const role = req.user?.role;
        const schoolCode = req.user?.schoolCode;
        let query = { schoolCode };
        let teacherScopes = [];

        if (className) query.studentClass = className;
        if (section) query.section = section;
        if (examName) query.examName = { $regex: examName, $options: 'i' };
        if (fromDate || toDate) {
            query.examDate = {};
            if (fromDate) query.examDate.$gte = new Date(fromDate);
            if (toDate) query.examDate.$lte = new Date(toDate);
        }

        if (role === 'teacher') {
            teacherScopes = await getTeacherResultScopes(req.user);
            if (!teacherScopes.length) {
                const emptyPayload = { results: [], total: 0, totalPages: 1, currentPage: parseInt(page, 10) || 1 };
                return res.json({
                    success: true,
                    message: 'Results fetched successfully',
                    data: emptyPayload,
                    ...emptyPayload
                });
            }
            query.$or = teacherScopes;

            if (studentId) {
                const sid = normalizeObjectIdString(studentId);
                if (!sid) {
                    return res.status(400).json({ success: false, message: 'Invalid studentId filter' });
                }
                const student = await Student.findOne({ _id: sid, schoolCode }).select('studentClass section').lean();
                if (!student) {
                    return res.status(404).json({ success: false, message: 'Student not found' });
                }
                if (!isTeacherAllowedForClassSection(student, teacherScopes)) {
                    return res.status(403).json({ success: false, message: 'Access denied' });
                }
                query.studentId = sid;
            }
        } else if (role === 'student') {
            const studentOid = await resolveStudentObjectIdFromUser(req.user);
            if (!studentOid) {
                const emptyPayload = { results: [], total: 0, totalPages: 1, currentPage: parseInt(page, 10) || 1 };
                return res.json({
                    success: true,
                    message: 'Results fetched successfully',
                    data: emptyPayload,
                    ...emptyPayload
                });
            }

            if (studentId && String(studentId) !== String(studentOid)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
            query.studentId = studentOid;
            query.isPublished = true;
        } else if (role === 'parent') {
            const linkedStudentIds = await getParentLinkedStudentIdStrings(req.user);
            if (!linkedStudentIds.length) {
                const emptyPayload = { results: [], total: 0, totalPages: 1, currentPage: parseInt(page, 10) || 1 };
                return res.json({
                    success: true,
                    message: 'Results fetched successfully',
                    data: emptyPayload,
                    ...emptyPayload
                });
            }

            if (studentId) {
                const sid = normalizeObjectIdString(studentId);
                if (!sid || !linkedStudentIds.includes(String(sid))) {
                    return res.status(403).json({ success: false, message: 'Access denied' });
                }
                query.studentId = sid;
            } else {
                query.studentId = { $in: linkedStudentIds };
            }
            query.isPublished = true;
        } else if (studentId) {
            const sid = normalizeObjectIdString(studentId);
            if (!sid) {
                return res.status(400).json({ success: false, message: 'Invalid studentId filter' });
            }
            query.studentId = sid;
        }

        const skip = (page - 1) * limit;

        const results = await Result.find(query)
            .populate('studentId', 'name roll section')
            .populate('publishedBy', 'name')
            .sort({ examDate: -1, 'studentId.roll': 1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Result.countDocuments(query);

        const payload = {
            results,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        };

        res.json({
            success: true,
            message: 'Results fetched successfully',
            data: payload,
            ...payload // backward-compatible shape
        });

    } catch (error) {
        console.error('Get results error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch results' });
    }
};

// @desc    Get single result by ID
// @route   GET /api/results/:id
// @access  Private (or public if shared link)
exports.getResultById = async (req, res) => {
    try {
        const result = await Result.findById(req.params.id)
            .populate('studentId', 'name roll section fatherName motherName')
            .populate('publishedBy', 'name')
            .populate('updatedBy', 'name');

        if (!result) {
            return res.status(404).json({ message: 'Result not found' });
        }

        const role = req.user?.role;
        const userSchoolCode = req.user?.schoolCode;
        const resultStudentId = String(result.studentId?._id || result.studentId);

        if (role === 'super_admin') {
            return res.json(result);
        }

        if (role === 'principal' || role === 'admin') {
            if (result.schoolCode !== userSchoolCode) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
            return res.json(result);
        }

        if (role === 'teacher') {
            if (result.schoolCode !== userSchoolCode) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
            const scopes = await getTeacherResultScopes(req.user);
            if (!isTeacherAllowedForClassSection({ studentClass: result.studentClass, section: result.section }, scopes)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
            return res.json(result);
        }

        if (role === 'student') {
            const studentOid = await resolveStudentObjectIdFromUser(req.user);
            if (!studentOid || String(studentOid) !== resultStudentId || !result.isPublished) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
            return res.json(result);
        }

        if (role === 'parent') {
            const linkedStudentIds = await getParentLinkedStudentIdStrings(req.user);
            if (!linkedStudentIds.includes(resultStudentId) || !result.isPublished) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
            return res.json(result);
        }

        return res.status(403).json({ success: false, message: 'Access denied' });

    } catch (error) {
        console.error('Get result by ID error:', error);
        res.status(500).json({ message: 'Failed to fetch result' });
    }
};

// @desc    Delete result (soft delete)
// @route   DELETE /api/results/:id
// @access  Private (Principal/Admin)
exports.deleteResult = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Principal or admin only.' });
        }

        const result = await Result.findById(req.params.id);
        if (!result) {
            return res.status(404).json({ message: 'Result not found' });
        }

        if (result.schoolCode !== req.user.schoolCode && req.user.role !== 'super_admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Soft delete (set isPublished false) or hard delete
        result.isPublished = false;
        result.isActive = false;
        result.publishedAt = null;
        await result.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'RESULT_DELETED',
            details: { resultId: result._id, examName: result.examName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ message: 'Result deleted (hidden from public)' });

    } catch (error) {
        console.error('Delete result error:', error);
        res.status(500).json({ message: 'Failed to delete result' });
    }
};

// @desc    Publish single result
// @route   PUT /api/results/:id/publish
// @access  Private (Principal/Admin/Super_Admin)
exports.publishResult = async (req, res) => {
    try {
        const normalizedSchoolCode = String(req.user.schoolCode || '').toUpperCase();
        const result = await Result.findOne({ _id: req.params.id, schoolCode: normalizedSchoolCode });
        if (!result) {
            return res.status(404).json({ success: false, message: 'Result not found' });
        }
        if (result.isPublished) {
            return res.status(400).json({ success: false, message: 'Result is already published' });
        }

        result.isPublished = true;
        result.publishedAt = new Date();
        result.isActive = true;
        result.publishedBy = req.user._id;
        await result.save();

        await AuditLog.create({
            user: req.user._id,
            action: 'RESULT_PUBLISHED',
            details: { resultId: result._id, examName: result.examName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true, message: 'Result published successfully', data: result });
    } catch (error) {
        console.error('Publish result error:', error);
        res.status(500).json({ success: false, message: 'Failed to publish result' });
    }
};

// @desc    Unpublish single result
// @route   PUT /api/results/:id/unpublish
// @access  Private (Principal/Admin/Super_Admin)
exports.unpublishResult = async (req, res) => {
    try {
        const normalizedSchoolCode = String(req.user.schoolCode || '').toUpperCase();
        const result = await Result.findOne({ _id: req.params.id, schoolCode: normalizedSchoolCode });
        if (!result) {
            return res.status(404).json({ success: false, message: 'Result not found' });
        }
        if (!result.isPublished) {
            return res.status(400).json({ success: false, message: 'Result is already unpublished' });
        }

        result.isPublished = false;
        result.publishedAt = null;
        result.publishedBy = null;
        await result.save();

        await AuditLog.create({
            user: req.user._id,
            action: 'RESULT_UNPUBLISHED',
            details: { resultId: result._id, examName: result.examName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Result unpublished successfully',
            data: result
        });
    } catch (error) {
        console.error('Unpublish result error:', error);
        res.status(500).json({ success: false, message: 'Failed to unpublish result' });
    }
};

// @desc    Bulk publish results
// @route   PUT /api/results/publish
// @access  Private (Principal/Admin/Super_Admin)
exports.bulkPublishResults = async (req, res) => {
    try {
        const { resultIds } = req.body;
        if (!resultIds || !Array.isArray(resultIds) || resultIds.length === 0) {
            return res.status(400).json({ success: false, message: 'resultIds array is required' });
        }

        const normalizedSchoolCode = (req.user.schoolCode || '').toUpperCase();

        const update = await Result.updateMany(
            { _id: { $in: resultIds }, schoolCode: normalizedSchoolCode },
            { isPublished: true, publishedAt: new Date(), publishedBy: req.user._id, isActive: true }
        );

        await AuditLog.create({
            user: req.user._id,
            action: 'RESULTS_BULK_PUBLISHED',
            details: { resultIds, modifiedCount: update.modifiedCount },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Results published successfully',
            data: { matchedCount: update.matchedCount, modifiedCount: update.modifiedCount }
        });
    } catch (error) {
        console.error('Bulk publish results error:', error);
        res.status(500).json({ success: false, message: 'Failed to publish results' });
    }
};

// @desc    Lock result (Principal only ΓÇô no further edits)
// @route   PUT /api/results/:id/lock
// @access  Private (Principal)
exports.lockResult = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Principal only.' });
        }
        const result = await Result.findOne({ _id: req.params.id, schoolCode: req.user.schoolCode });
        if (!result) return res.status(404).json({ message: 'Result not found' });
        result.isLocked = true;
        result.lockedBy = req.user._id;
        result.lockedAt = new Date();
        await result.save();
        await AuditLog.create({
            user: req.user._id,
            action: 'RESULT_LOCKED',
            details: { resultId: result._id, examName: result.examName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.json({ success: true, message: 'Result locked. No further edits allowed.', data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * @desc    Get student results
 * @route   GET /api/results/student
 * @access  Student only
 */
exports.getStudentResults = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const studentOid = await resolveStudentObjectIdFromUser(req.user);

        if (!studentOid) {
            return res.status(200).json({
                success: true,
                data: [],
                message:
                    'No Student record matches your account (class/roll). Ask the school to link your profile if results are missing.'
            });
        }

        const list = await Result.find({
            schoolCode,
            studentId: studentOid,
            isPublished: true
        })
            .sort({ examDate: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: list
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
 * @desc    Get student exam result
 * @route   GET /api/results/student/exam/:examId
 * @access  Student only
 */
exports.getStudentExamResult = async (req, res) => {
    try {
        const { examId } = req.params;
        const schoolCode = req.user.schoolCode;
        const studentOid = await resolveStudentObjectIdFromUser(req.user);

        if (!studentOid) {
            return res.status(404).json({
                success: false,
                message: 'Student profile not linked'
            });
        }

        const result = await Result.findOne({
            _id: examId,
            schoolCode,
            studentId: studentOid,
            isPublished: true
        }).lean();

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Result not found'
            });
        }

        res.status(200).json({
            success: true,
            data: result
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
 * @desc    Download marksheet
 * @route   GET /api/results/marksheet
 * @access  Student only
 */
exports.downloadMarksheet = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        res.status(200).json({
            success: true,
            message: 'Marksheet download link',
            data: { downloadUrl: `https://example.com/marksheet/${studentId}` }
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
 * @desc    Get transcript
 * @route   GET /api/results/transcript
 * @access  Student only
 */
exports.getTranscript = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const transcript = {
            studentInfo: {},
            academicHistory: [],
            overallGPA: 0,
            credits: 0
        };

        res.status(200).json({
            success: true,
            data: transcript
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// @desc    Unlock result (Principal only)
// @route   PUT /api/results/:id/unlock
// @access  Private (Principal)
exports.unlockResult = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Principal only.' });
        }
        const result = await Result.findOne({ _id: req.params.id, schoolCode: req.user.schoolCode });
        if (!result) return res.status(404).json({ message: 'Result not found' });
        result.isLocked = false;
        result.lockedBy = undefined;
        result.lockedAt = undefined;
        await result.save();
        await AuditLog.create({
            user: req.user._id,
            action: 'RESULT_UNLOCKED',
            details: { resultId: result._id, examName: result.examName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.json({ success: true, message: 'Result unlocked.', data: result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to unlock result' });
    }
};

// @desc    Download result as PDF
// @route   GET /api/results/:id/pdf
// @access  Public (with token) or Private
exports.downloadResultPDF = async (req, res) => {
    try {
        const result = await Result.findById(req.params.id)
            .populate('studentId', 'name fatherName motherName section');
        if (!result) {
            return res.status(404).send('Result not found');
        }

        const role = req.user?.role;
        const userSchoolCode = req.user?.schoolCode;
        const resultStudentId = String(result.studentId?._id || result.studentId);

        if (role !== 'super_admin') {
            if (role === 'principal' || role === 'admin') {
                if (result.schoolCode !== userSchoolCode) {
                    return res.status(403).json({ success: false, message: 'Access denied' });
                }
            } else if (role === 'teacher') {
                if (result.schoolCode !== userSchoolCode) {
                    return res.status(403).json({ success: false, message: 'Access denied' });
                }
                const scopes = await getTeacherResultScopes(req.user);
                if (!isTeacherAllowedForClassSection({ studentClass: result.studentClass, section: result.section }, scopes)) {
                    return res.status(403).json({ success: false, message: 'Access denied' });
                }
            } else if (role === 'student') {
                const studentOid = await resolveStudentObjectIdFromUser(req.user);
                if (!studentOid || String(studentOid) !== resultStudentId || !result.isPublished) {
                    return res.status(403).json({ success: false, message: 'Access denied' });
                }
            } else if (role === 'parent') {
                const linkedStudentIds = await getParentLinkedStudentIdStrings(req.user);
                if (!linkedStudentIds.includes(resultStudentId) || !result.isPublished) {
                    return res.status(403).json({ success: false, message: 'Access denied' });
                }
            } else {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
        }

        // Get school info
        const school = await School.findOne({ schoolCode: result.schoolCode });
        const schoolInfo = {
            name: school?.schoolName || "SMART CAMPUS",
            address: school?.address || "Dhaka, Bangladesh",
            primaryColor: school?.primaryColor || "#1a5f7a",
            logo: school?.logo?.url || null
        };

        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-disposition', `attachment; filename="Result_${result.roll}_${result.examName}.pdf"`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        // Header
        if (schoolInfo.logo) {
            doc.image(schoolInfo.logo, 50, 30, { width: 70 });
        }
        doc.fillColor(schoolInfo.primaryColor)
           .fontSize(22)
           .font('Helvetica-Bold')
           .text(schoolInfo.name, schoolInfo.logo ? 130 : 50, schoolInfo.logo ? 40 : 50, { align: 'center', width: 450 });
        doc.fontSize(10)
           .fillColor('#666666')
           .text(schoolInfo.address, 0, 80, { align: 'center', width: 600 });

        // Title
        doc.moveDown(4)
           .fillColor('#000000')
           .fontSize(18)
           .font('Helvetica-Bold')
           .text('ACADEMIC MARKSHEET', { align: 'center' });

        // Student Info
        doc.moveDown()
           .fontSize(12)
           .font('Helvetica')
           .text(`Student Name: ${result.studentId.name}`, 50)
           .text(`Father's Name: ${result.studentId.fatherName || 'N/A'}`, 300, doc.y - 15)
           .moveDown(0.5)
           .text(`Roll: ${result.roll} | Class: ${result.studentClass}${result.section ? ' - ' + result.section : ''}`, 50)
           .text(`Exam: ${result.examName}`, 300, doc.y - 15)
           .moveDown(0.5)
           .text(`Date: ${new Date(result.examDate).toLocaleDateString()}`, 50);

        // Table Header
        doc.moveDown(1.5)
           .font('Helvetica-Bold')
           .text('Subject', 70, doc.y)
           .text('Marks', 250, doc.y, { continued: true })
           .text('Grade', 400, doc.y);

        doc.moveDown(0.5)
           .strokeColor('#000000')
           .lineWidth(1)
           .moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke();

        // Table Rows
        doc.font('Helvetica');
        result.subjects.forEach(sub => {
            doc.moveDown(0.8)
               .text(sub.subjectName, 70, doc.y)
               .text(sub.marks.toString(), 250, doc.y, { continued: true })
               .text(sub.grade, 400, doc.y);
        });

        // Total & GPA
        doc.moveDown(2)
           .font('Helvetica-Bold')
           .text(`Total Marks: ${result.totalMarks}`, 70, doc.y)
           .text(`GPA: ${result.gpa || 'N/A'}`, 300, doc.y);

        // Remarks
        if (result.remarks) {
            doc.moveDown()
               .font('Helvetica')
               .text(`Remarks: ${result.remarks}`, 70, doc.y);
        }

        // Signature
        doc.moveDown(4)
           .text('____________________', 400, doc.y + 20)
           .text('Controller of Examinations', 400, doc.y + 35);

        // Footer
        doc.fontSize(8)
           .fillColor('#999999')
           .text('This is a system generated marksheet.', 50, 750, { align: 'center', width: 500 });

        doc.end();

    } catch (error) {
        console.error('PDF generation error:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to generate PDF' });
        }
    }
};

// @desc    Export results to Excel
// @route   GET /api/results/export
// @access  Private (Principal/Admin)
exports.exportResultsToExcel = async (req, res) => {
    try {
        const { class: className, section, examName } = req.query;

        let query = { schoolCode: req.user.schoolCode, isPublished: true };
        if (className) query.studentClass = className;
        if (section) query.section = section;
        if (examName) query.examName = { $regex: examName, $options: 'i' };

        const results = await Result.find(query)
            .populate('studentId', 'name roll section fatherName motherName')
            .sort({ studentClass: 1, section: 1, roll: 1 })
            .lean();

        if (results.length === 0) {
            return res.status(404).json({ message: 'No results found for export' });
        }

        // Create workbook
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Results');

        // Headers
        const headers = ['Student Name', 'Class', 'Section', 'Roll', 'Exam Name', 'Total Marks', 'GPA', ...results[0].subjects.map(s => s.subjectName)];
        worksheet.addRow(headers);

        // Data rows
        results.forEach(result => {
            const row = [
                result.studentId.name,
                result.studentClass,
                result.section || '',
                result.roll,
                result.examName,
                result.totalMarks,
                result.gpa,
                ...result.subjects.map(s => s.marks)
            ];
            worksheet.addRow(row);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=results_${examName || 'all'}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export results error:', error);
        res.status(500).json({ message: 'Failed to export results' });
    }
};

// Helper: Send result notification
const sendResultNotification = async (student, result) => {
    try {
        // Send SMS to guardian
        if (student.guardian?.phone) {
            await sendSMS({
                to: student.guardian.phone,
                message: `Result published for ${student.name} (${result.examName}). Total: ${result.totalMarks}, GPA: ${result.gpa}. Check portal.`
            });
        }
        // Send Email
        if (student.guardian?.email) {
            await sendEmail({
                to: student.guardian.email,
                subject: `Result Published: ${result.examName}`,
                template: 'result-notification',
                data: {
                    studentName: student.name,
                    examName: result.examName,
                    totalMarks: result.totalMarks,
                    gpa: result.gpa
                }
            });
        }
    } catch (error) {
        console.error('Result notification error:', error);
    }
};

const buildMarkEntry = async ({ schoolCode, teacherId, exam, subjectId, studentId, marks }) => {
    if (!exam || !subjectId || !studentId) {
        throw new Error('Exam, subject, and student are required');
    }

    const student = await Student.findOne({ _id: studentId, schoolCode, isActive: true });
    if (!student) {
        const error = new Error('Student not found in this school');
        error.status = 404;
        throw error;
    }

    if (String(student.studentClass).trim() !== String(exam.classId.className).trim()) {
        const error = new Error('Student does not belong to the exam class');
        error.status = 400;
        throw error;
    }

    const studentSection = student.section ? String(student.section).toUpperCase() : '';
    const examSection = exam.classId.section ? String(exam.classId.section).toUpperCase() : '';
    if (examSection && studentSection !== examSection) {
        const error = new Error('Student does not belong to the exam section');
        error.status = 400;
        throw error;
    }

    const assignment = await findTeacherAssignment(teacherId, schoolCode, exam.classId._id, subjectId);
    if (!assignment) {
        const error = new Error('You are not authorized to enter marks for this class and subject');
        error.status = 403;
        throw error;
    }

    const markValue = Number(marks);
    if (!Number.isFinite(markValue) || markValue < 0) {
        const error = new Error('Marks must be a non-negative number');
        error.status = 400;
        throw error;
    }
    if (exam.totalMarks !== undefined && markValue > exam.totalMarks) {
        const error = new Error(`Marks cannot exceed the exam's total marks (${exam.totalMarks})`);
        error.status = 400;
        throw error;
    }

    const subjectName = exam.subjectId?.subjectName || 'Unknown Subject';
    const grade = calculateGrade(markValue);
    const subjectEntry = {
        subjectId,
        subjectName,
        marks: markValue,
        grade
    };

    let result = await Result.findOne({ schoolCode, studentId, examId: exam._id });
    if (!result) {
        result = await Result.findOne({ schoolCode, studentId, examName: exam.name });
    }

    if (result && result.isLocked) {
        const error = new Error('Result is locked and cannot be updated');
        error.status = 403;
        throw error;
    }
    if (result && result.isPublished) {
        const error = new Error('Published results cannot be modified by teachers');
        error.status = 400;
        throw error;
    }

    if (!result) {
        result = new Result({
            examId: exam._id,
            studentId,
            schoolCode,
            studentClass: exam.classId.className,
            section: exam.classId.section,
            roll: student.roll,
            examName: exam.name,
            examDate: exam.date,
            academicYear: exam.date ? String(exam.date.getFullYear()) : String(new Date().getFullYear()),
            subjects: [subjectEntry],
            totalMarks: markValue,
            gpa: calculateGPA([subjectEntry]),
            gradingSystem: 'standard',
            isPublished: false,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    } else {
        const subjects = result.subjects || [];
        const existingIndex = subjects.findIndex((s) => s.subjectId && String(s.subjectId) === String(subjectId));
        if (existingIndex >= 0) {
            subjects[existingIndex] = {
                ...subjects[existingIndex],
                ...subjectEntry
            };
        } else {
            subjects.push(subjectEntry);
        }
        result.subjects = subjects;
        result.totalMarks = subjects.reduce((sum, curr) => sum + Number(curr.marks || 0), 0);
        result.gpa = calculateGPA(subjects);
        result.updatedBy = teacherId;
        result.updatedAt = new Date();
        result.isPublished = false;
        result.examId = exam._id;
    }

    await result.save();
    return await result.populate('studentId', 'name roll').populate('examId', 'name date');
};

/**
 * @desc    Enter marks
 * @route   POST /api/results/marks/enter
 * @access  Teacher only
 */
exports.enterMarks = async (req, res) => {
    try {
        const { examId, studentId, subjectId, marks, marksData } = req.body;
        const teacherId = toObjectId(req.user._id || req.user.id);
        const schoolCode = req.user.schoolCode;

        if (!teacherId || !schoolCode) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const examOid = toObjectId(examId);
        const subjectOid = toObjectId(subjectId);
        if (!examOid || !subjectOid) {
            return res.status(400).json({ success: false, message: 'Valid examId and subjectId are required' });
        }

        const exam = await Exam.findOne({ _id: examOid, schoolCode, isActive: true })
            .populate('classId', 'className section')
            .populate('subjectId', 'subjectName')
            .lean();

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        const examSubjectId = exam.subjectId?._id || exam.subjectId;
        if (!examSubjectId || String(examSubjectId) !== String(subjectOid)) {
            return res.status(400).json({ success: false, message: 'Subject does not match the selected exam' });
        }

        const results = [];
        const errors = [];

        if (Array.isArray(marksData)) {
            if (marksData.length === 0) {
                return res.status(400).json({ success: false, message: 'marksData array must contain at least one entry' });
            }

            for (const item of marksData) {
                const rowStudentId = toObjectId(item.studentId);
                try {
                    const result = await buildMarkEntry({
                        schoolCode,
                        teacherId,
                        exam,
                        subjectId: subjectOid,
                        studentId: rowStudentId,
                        marks: item.marks
                    });
                    results.push({ studentId: rowStudentId, resultId: result._id, status: 'saved' });
                } catch (error) {
                    errors.push({ studentId: item.studentId, message: error.message || 'Failed to save marks' });
                }
            }

            return res.status(200).json({
                success: true,
                message: 'Marks processed',
                data: { results, errors }
            });
        }

        const studentOid = toObjectId(studentId);
        if (!studentOid || marks === undefined) {
            return res.status(400).json({ success: false, message: 'studentId and marks are required' });
        }

        const result = await buildMarkEntry({
            schoolCode,
            teacherId,
            exam,
            subjectId: subjectOid,
            studentId: studentOid,
            marks
        });

        res.status(201).json({
            success: true,
            message: 'Marks entered successfully',
            data: result
        });
    } catch (error) {
        console.error('Enter marks error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Update marks
 * @route   PUT /api/results/marks/update/:resultId
 * @access  Teacher only
 */
exports.updateMarks = async (req, res) => {
    try {
        const { resultId } = req.params;
        const { subjectId, marks } = req.body;
        const teacherId = toObjectId(req.user._id || req.user.id);
        const schoolCode = req.user.schoolCode;

        if (!teacherId || !schoolCode) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const result = await Result.findById(resultId);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Result not found' });
        }

        if (result.schoolCode !== schoolCode) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (result.isLocked) {
            return res.status(403).json({ success: false, message: 'Result is locked and cannot be updated' });
        }

        if (result.isPublished) {
            return res.status(400).json({ success: false, message: 'Published results cannot be modified by teachers' });
        }

        const subjectOid = toObjectId(subjectId);
        if (!subjectOid) {
            return res.status(400).json({ success: false, message: 'Valid subjectId is required' });
        }

        const subjectEntry = result.subjects.find((s) => s.subjectId && String(s.subjectId) === String(subjectOid))
            || (result.subjects.length === 1 ? result.subjects[0] : null);

        if (!subjectEntry) {
            return res.status(404).json({ success: false, message: 'Subject entry not found in result' });
        }

        const markValue = Number(marks);
        if (!Number.isFinite(markValue) || markValue < 0) {
            return res.status(400).json({ success: false, message: 'Marks must be a non-negative number' });
        }

        let exam = null;
        if (result.examId) {
            exam = await Exam.findOne({ _id: result.examId, schoolCode, isActive: true })
                .populate('classId', 'className section')
                .lean();
        }

        if (exam) {
            if (String(exam.subjectId?._id || exam.subjectId) !== String(subjectOid)) {
                return res.status(400).json({ success: false, message: 'Subject does not match the exam' });
            }
            const assignment = await findTeacherAssignment(teacherId, schoolCode, exam.classId._id, subjectOid);
            if (!assignment) {
                return res.status(403).json({ success: false, message: 'You are not authorized to update marks for this class and subject' });
            }
        }

        subjectEntry.marks = markValue;
        subjectEntry.grade = calculateGrade(markValue);

        const subjects = result.subjects;
        result.totalMarks = subjects.reduce((sum, curr) => sum + Number(curr.marks || 0), 0);
        result.gpa = calculateGPA(subjects);
        result.updatedBy = teacherId;
        result.updatedAt = new Date();
        result.isPublished = false;

        await result.save();

        res.status(200).json({
            success: true,
            message: 'Marks updated successfully',
            data: result
        });
    } catch (error) {
        console.error('Update marks error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Get exam marks
 * @route   GET /api/results/marks/exam/:examId
 * @access  Teacher only
 */
exports.getExamMarks = async (req, res) => {
    try {
        const { examId } = req.params;
        const teacherId = toObjectId(req.user._id || req.user.id);
        const schoolCode = req.user.schoolCode;

        const examOid = toObjectId(examId);
        if (!examOid) {
            return res.status(400).json({ success: false, message: 'Invalid examId' });
        }

        const exam = await Exam.findOne({ _id: examOid, schoolCode, isActive: true })
            .populate('classId', 'className section')
            .populate('subjectId', 'subjectName')
            .lean();

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        const assignment = await findTeacherAssignment(teacherId, schoolCode, exam.classId._id, exam.subjectId._id);
        if (!assignment) {
            return res.status(403).json({ success: false, message: 'You are not authorized to view marks for this exam' });
        }

        const studentsInClass = await Student.countDocuments({
            schoolCode,
            studentClass: exam.classId.className,
            section: exam.classId.section,
            isActive: true
        });

        const results = await Result.find({ schoolCode, examId: exam._id })
            .populate('studentId', 'name roll')
            .lean();

        const rows = results.map((result) => {
            const subjectEntry = result.subjects.find((s) => s.subjectId && String(s.subjectId) === String(exam.subjectId?._id || exam.subjectId));
            return {
                resultId: result._id,
                studentId: result.studentId?._id,
                name: result.studentId?.name,
                roll: result.studentId?.roll,
                marks: subjectEntry?.marks ?? null,
                grade: subjectEntry?.grade ?? null,
                totalMarks: result.totalMarks,
                gpa: result.gpa,
                published: result.isPublished
            };
        });

        const markValues = rows.map((row) => Number(row.marks)).filter((value) => Number.isFinite(value));
        const averageMarks = markValues.length ? markValues.reduce((sum, value) => sum + value, 0) / markValues.length : 0;
        const highestMarks = markValues.length ? Math.max(...markValues) : 0;
        const lowestMarks = markValues.length ? Math.min(...markValues) : 0;

        const marks = {
            exam: {
                _id: exam._id,
                name: exam.name,
                examType: exam.examType,
                className: exam.classId.className,
                section: exam.classId.section,
                subjectId: exam.subjectId?._id,
                subjectName: exam.subjectId?.subjectName,
                date: exam.date,
                totalMarks: exam.totalMarks
            },
            results: rows,
            statistics: {
                totalStudents: studentsInClass,
                enteredResults: rows.length,
                missingResults: Math.max(0, studentsInClass - rows.length),
                averageMarks,
                highestMarks,
                lowestMarks
            }
        };

        res.status(200).json({ success: true, data: marks });
    } catch (error) {
        console.error('Get exam marks error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

/**
 * @desc    Get subject marks
 * @route   GET /api/results/marks/subject/:subjectId
 * @access  Teacher only
 */
exports.getSubjectMarks = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const teacherId = toObjectId(req.user._id || req.user.id);
        const schoolCode = req.user.schoolCode;

        const subjectOid = toObjectId(subjectId);
        if (!subjectOid) {
            return res.status(400).json({ success: false, message: 'Invalid subjectId' });
        }

        const classConditions = await getTeacherAccessibleClassConditions(teacherId, schoolCode);
        if (!classConditions.length) {
            return res.status(403).json({ success: false, message: 'No assigned classes found' });
        }

        const results = await Result.find({
            schoolCode,
            'subjects.subjectId': subjectOid,
            $or: classConditions
        })
            .populate('studentId', 'name roll')
            .populate('examId', 'name')
            .lean();

        const rows = results.map((result) => {
            const subjectEntry = result.subjects.find((s) => s.subjectId && String(s.subjectId) === String(subjectOid));
            return {
                resultId: result._id,
                examId: result.examId?._id,
                examName: result.examId?.name || result.examName,
                studentId: result.studentId?._id,
                name: result.studentId?.name,
                roll: result.studentId?.roll,
                marks: subjectEntry?.marks ?? null,
                grade: subjectEntry?.grade ?? null,
                totalMarks: result.totalMarks,
                gpa: result.gpa,
                published: result.isPublished
            };
        });

        const markValues = rows.map((row) => Number(row.marks)).filter((value) => Number.isFinite(value));
        const averageMarks = markValues.length ? markValues.reduce((sum, value) => sum + value, 0) / markValues.length : 0;
        const gradeDistribution = markValues.reduce((acc, value) => {
            const grade = calculateGrade(value);
            acc[grade] = (acc[grade] || 0) + 1;
            return acc;
        }, {});

        const marks = {
            subjectId: subjectOid,
            results: rows,
            statistics: {
                totalEntries: rows.length,
                averageMarks,
                gradeDistribution
            }
        };

        res.status(200).json({ success: true, data: marks });
    } catch (error) {
        console.error('Get subject marks error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

/**
 * @desc    Get exams for teacher assignments
 * @route   GET /api/teacher/exams
 * @access  Teacher only
 */
exports.getTeacherExams = async (req, res) => {
    try {
        const teacherId = toObjectId(req.user._id || req.user.id);
        const schoolCode = req.user.schoolCode;
        const { classId, subjectId } = req.query;

        if (!teacherId || !schoolCode) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const assignments = await TeacherAssignment.find({
            teacher: teacherId,
            schoolCode,
            isActive: true
        }).lean();

        const assignedClassIds = [...new Set(assignments.flatMap((assignment) => assignment.classes || []).map((id) => String(id)))].map(toObjectId).filter(Boolean);
        const assignedSubjectIds = [...new Set(assignments.map((assignment) => String(assignment.subject)))].map(toObjectId).filter(Boolean);

        if (!assignedClassIds.length || !assignedSubjectIds.length) {
            return res.status(200).json({ success: true, data: { exams: [] } });
        }

        const query = {
            schoolCode,
            isActive: true,
            classId: { $in: assignedClassIds },
            subjectId: { $in: assignedSubjectIds }
        };

        if (classId) {
            const classOid = toObjectId(classId);
            if (!classOid || !assignedClassIds.some((id) => String(id) === String(classOid))) {
                return res.status(403).json({ success: false, message: 'Unauthorized class filter' });
            }
            query.classId = classOid;
        }

        if (subjectId) {
            const subjectOid = toObjectId(subjectId);
            if (!subjectOid || !assignedSubjectIds.some((id) => String(id) === String(subjectOid))) {
                return res.status(403).json({ success: false, message: 'Unauthorized subject filter' });
            }
            query.subjectId = subjectOid;
        }

        const exams = await Exam.find(query)
            .populate('classId', 'className section')
            .populate('subjectId', 'subjectName subjectCode')
            .sort({ date: -1, createdAt: -1 })
            .lean();

        const data = exams.map((exam) => ({
            _id: exam._id,
            name: exam.name,
            examType: exam.examType,
            classId: exam.classId?._id,
            className: exam.classId?.className,
            section: exam.classId?.section,
            subjectId: exam.subjectId?._id,
            subjectName: exam.subjectId?.subjectName,
            totalMarks: exam.totalMarks,
            date: exam.date,
            resultsPublished: exam.resultsPublished
        }));

        res.status(200).json({ success: true, data: { exams: data } });
    } catch (error) {
        console.error('Get teacher exams error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

/**
 * @desc    Get students for marks entry
 * @route   GET /api/teacher/marks/students
 * @access  Teacher only
 */
exports.getStudentsForMarks = async (req, res) => {
    try {
        const teacherId = toObjectId(req.user._id || req.user.id);
        const schoolCode = req.user.schoolCode;
        const { classId, sectionId } = req.query;

        if (!teacherId || !schoolCode) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const assignments = await TeacherAssignment.find({
            teacher: teacherId,
            schoolCode,
            isActive: true
        }).lean();

        const assignedClassIds = [...new Set(assignments.flatMap((assignment) => assignment.classes || []).map((id) => String(id)))];
        if (!assignedClassIds.length) {
            return res.status(200).json({ success: true, data: { students: [] } });
        }

        if (classId && !assignedClassIds.some((id) => String(id) === String(classId))) {
            return res.status(403).json({ success: false, message: 'You are not authorized to view students for this class' });
        }

        const queryClassIds = classId ? [classId] : assignedClassIds;
        const StudentModel = require('../models/Student');
        const studentFilter = {
            schoolCode,
            isActive: true,
            classId: { $in: queryClassIds }
        };
        if (sectionId) {
            studentFilter.section = sectionId;
        }

        const students = await StudentModel.find(studentFilter)
            .select('name roll section studentClass')
            .lean();

        const mapped = students.map((student) => ({
            _id: String(student._id),
            name: student.name,
            rollNumber: student.roll,
            className: student.studentClass,
            section: student.section
        }));

        res.status(200).json({ success: true, data: { students: mapped, totalStudents: mapped.length } });
    } catch (error) {
        console.error('Get students for marks error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};
