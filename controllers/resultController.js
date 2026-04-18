// controllers/resultController.js
const mongoose = require('mongoose');
const Result = require('../models/Result');
const Student = require('../models/Student');
const School = require('../models/School');
const Class = require('../models/Class');
const Section = require('../models/Section');
const Exam = require('../models/Exam');
const ExamSchedule = require('../models/ExamSchedule');
const Subject = require('../models/Subject');
const TeacherAssignment = require('../models/TeacherAssignment');
const { resolveStudentObjectIdFromUser } = require('../utils/resolveStudentFromUser');
const AuditLog = require('../models/AuditLog');
const PDFDocument = require('pdfkit');
const Excel = require('exceljs');
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');

const RESULT_STATUS = Object.freeze({
    DRAFT: 'draft',
    VERIFIED: 'verified',
    PUBLISHED: 'published'
});

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
    if (user?.role !== 'parent' || !user?.schoolId) return [];
    const parentId = normalizeObjectIdString(user._id || user.id);
    const emailRegex = guardianEmailRegex(user.email);
    const conditions = [];
    if (parentId) conditions.push({ parentId });
    if (emailRegex) conditions.push({ 'guardian.email': emailRegex });
    if (!conditions.length) return [];

    const rows = await Student.find({
        schoolId: user.schoolId,
        isActive: true,
        $or: conditions
    }).select('_id').lean();

    return rows.map((row) => String(row._id));
};

const getTeacherResultScopes = async (user) => {
    const schoolId = user?.schoolId;
    const teacherId = normalizeObjectIdString(user?._id || user?.id);
    if (!schoolId || !teacherId) return [];

    const assignments = await TeacherAssignment.find({
        schoolId,
        teacher: teacherId,
        isActive: true
    }).select('classes').lean();

    const classIds = [...new Set(assignments.flatMap((assignment) => assignment.classes || []).map((id) => String(id)))];
    if (!classIds.length) return [];

    const classes = await Class.find({
        _id: { $in: classIds },
        schoolId
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

const toIdMatchCandidates = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return [];

    const candidates = [raw];
    if (mongoose.Types.ObjectId.isValid(raw)) {
        candidates.push(new mongoose.Types.ObjectId(raw));
    }

    return candidates;
};

const findTeacherAssignment = async (teacherId, schoolId, classId, subjectId) => {
    if (!teacherId || !classId || !subjectId) return null;
    const classCandidates = toIdMatchCandidates(classId);
    const subjectCandidates = toIdMatchCandidates(subjectId);
    return await TeacherAssignment.findOne({
        teacher: teacherId,
        schoolId,
        isActive: true,
        classes: { $in: classCandidates },
        subject: { $in: subjectCandidates }
    }).lean();
};

const getTeacherAccessibleClassConditions = async (teacherId, schoolId) => {
    const assignments = await TeacherAssignment.find({
        teacher: teacherId,
        schoolId,
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

const normalizeSectionValue = (value) => {
    const raw = String(value || '').trim();
    return raw ? raw.toUpperCase() : '';
};

const andFilters = (...filters) => {
    const valid = filters.filter((filter) => filter && Object.keys(filter).length > 0);
    if (!valid.length) return {};
    if (valid.length === 1) return valid[0];
    return { $and: valid };
};

const getSchoolScopeFilter = (req) => {
    const schoolCode = String(req.tenant?.schoolCode || req.user?.schoolCode || '').trim().toUpperCase();
    const schoolIdRaw = req.tenant?.schoolId || req.user?.schoolId;
    const schoolId = toObjectId(schoolIdRaw);

    const clauses = [];
    if (schoolId) clauses.push({ schoolId });
    if (schoolCode) clauses.push({ schoolCode });

    if (!clauses.length) {
        return null;
    }

    return clauses.length === 1 ? clauses[0] : { $or: clauses };
};

const publishedVisibilityFilter = () => ({
    $or: [
        { status: RESULT_STATUS.PUBLISHED },
        { $and: [{ status: { $exists: false } }, { isPublished: true }] }
    ]
});

const nonPublishedVisibilityFilter = () => ({
    $or: [
        { status: RESULT_STATUS.DRAFT },
        { status: RESULT_STATUS.VERIFIED },
        { status: null },
        { $and: [{ status: { $exists: false } }, { isPublished: { $ne: true } }] }
    ]
});

const isResultPublished = (result) => {
    if (!result) return false;
    if (result.status) return result.status === RESULT_STATUS.PUBLISHED;
    return Boolean(result.isPublished);
};

const applyDraftState = (result) => {
    result.status = RESULT_STATUS.DRAFT;
    result.isPublished = false;
    result.publishedAt = null;
    result.publishedBy = null;
    return result;
};

const getExamAnchorDate = (exam) => {
    return exam?.startDate || exam?.date || exam?.createdAt || new Date();
};

const extractExamClassIds = (exam) => {
    const ids = new Set();
    if (!exam) return ids;
    if (exam.classId) ids.add(String(exam.classId?._id || exam.classId));
    (exam.targetClasses || []).forEach((entry) => ids.add(String(entry?._id || entry)));
    return ids;
};

const isClassWithinExamScope = (exam, classId) => {
    const classIds = extractExamClassIds(exam);
    if (!classIds.size) return true;
    return classIds.has(String(classId));
};

const resolveExamClassContextForMarks = async ({
    exam,
    schoolCode,
    classId,
    student
}) => {
    if (!exam) {
        return { error: { status: 404, message: 'Exam not found' } };
    }

    let classDoc = null;

    if (classId) {
        if (!isValidObjectId(classId)) {
            return { error: { status: 400, message: 'Valid classId is required for this exam' } };
        }
        classDoc = await Class.findOne({
            _id: toObjectId(classId),
            schoolCode,
            isActive: true
        }).select('_id className section').lean();
        if (!classDoc) {
            return { error: { status: 404, message: 'Class not found in this school' } };
        }
    } else if (exam.classId?.className) {
        classDoc = {
            _id: exam.classId._id || exam.classId,
            className: exam.classId.className,
            section: exam.classId.section || ''
        };
    } else if (Array.isArray(exam.targetClasses) && exam.targetClasses.length === 1) {
        const target = exam.targetClasses[0];
        classDoc = {
            _id: target._id || target,
            className: target.className || '',
            section: target.section || ''
        };
    } else if (student?.studentClass) {
        classDoc = await Class.findOne({
            schoolCode,
            className: String(student.studentClass).trim(),
            ...(student.section ? { section: String(student.section).trim().toUpperCase() } : {}),
            isActive: true
        }).select('_id className section').lean();
    }

    if (classDoc?._id && !classDoc.className) {
        const resolved = await Class.findOne({
            _id: toObjectId(classDoc._id),
            schoolCode,
            isActive: true
        }).select('_id className section').lean();
        classDoc = resolved || classDoc;
    }

    if (!classDoc) {
        return { error: { status: 400, message: 'classId is required for multi-class exam marks entry' } };
    }

    if (!isClassWithinExamScope(exam, classDoc._id)) {
        return { error: { status: 400, message: 'Selected class is outside exam scope' } };
    }

    return { classDoc };
};

const getExamScheduleDoc = async ({ examId, schoolCode, cache }) => {
    const cacheKey = `${schoolCode}::${String(examId)}`;
    if (cache?.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const schedule = await ExamSchedule.findOne({
        schoolCode,
        examId: toObjectId(examId)
    }).lean();

    if (cache) cache.set(cacheKey, schedule || null);
    return schedule || null;
};

const findScheduleSlot = ({ schedule, classDoc, section, subjectId }) => {
    if (!schedule || !Array.isArray(schedule.slots)) return null;
    const classId = String(classDoc?._id || '');
    const sectionToken = normalizeSectionValue(section || classDoc?.section || '');

    return schedule.slots.find((slot) => {
        const slotClassId = slot.classId ? String(slot.classId) : '';
        const slotSection = normalizeSectionValue(slot.section || '');
        const slotSubjectId = slot.subjectId ? String(slot.subjectId) : '';

        if (slotClassId && classId && slotClassId !== classId) return false;
        if (sectionToken && slotSection && slotSection !== sectionToken) return false;
        if (subjectId && slotSubjectId && String(subjectId) !== slotSubjectId) return false;
        return true;
    }) || null;
};

const resolveExamSubjectContextForMarks = async ({
    exam,
    schoolCode,
    subjectId,
    classDoc,
    section,
    schedule
}) => {
    let resolvedSubjectId = subjectId ? String(subjectId) : null;

    if (!resolvedSubjectId && exam.subjectId) {
        resolvedSubjectId = String(exam.subjectId?._id || exam.subjectId);
    }

    if (!resolvedSubjectId || !isValidObjectId(resolvedSubjectId)) {
        return { error: { status: 400, message: 'Valid subjectId is required for marks entry' } };
    }

    const subjectDoc = await Subject.findOne({
        _id: toObjectId(resolvedSubjectId),
        schoolCode,
        isActive: true
    }).select('_id subjectName').lean();

    if (!subjectDoc) {
        return { error: { status: 404, message: 'Subject not found in this school' } };
    }

    if (exam.subjectId && String(exam.subjectId?._id || exam.subjectId) !== resolvedSubjectId) {
        return { error: { status: 400, message: 'Subject does not match the selected exam' } };
    }

    const slot = findScheduleSlot({
        schedule,
        classDoc,
        section,
        subjectId: resolvedSubjectId
    });

    // For event-style exams, schedule defines valid subject-class mappings.
    if (!exam.subjectId && schedule && !slot) {
        return { error: { status: 400, message: 'Subject is not scheduled for this exam/class scope' } };
    }

    const totalMarks = Number(slot?.totalMarks || slot?.fullMarks || exam.totalMarks || 100);

    return {
        subjectId: toObjectId(resolvedSubjectId),
        subjectName: subjectDoc.subjectName || 'Unknown Subject',
        totalMarks
    };
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
        const schoolId = req.tenant?.schoolId || req.user?.schoolId;

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
            ...(schoolId ? { schoolId } : {}),
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
            status: RESULT_STATUS.DRAFT,
            isPublished: false,
            publishedAt: null,
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
        res.status(500).json({ message: 'Failed to save result draft' });
    }
};

// @desc    Update existing result
// @route   PUT /api/results/:id
// @access  Private (Teacher/Principal)
exports.updateResult = async (req, res) => {
    try {
        const { id } = req.params;
        const { subjects, examName, examDate, remarks, gradingSystem } = req.body;
        const schoolCode = String(req.user.schoolCode || '').toUpperCase();

        const result = await Result.findOne({ _id: id, schoolCode });
        if (!result) {
            return res.status(404).json({ message: 'Result not found' });
        }

        if (result.isLocked) {
            return res.status(403).json({ message: 'Result is locked. Principal must unlock to edit.' });
        }
        if (req.user.role === 'teacher' && isResultPublished(result)) {
            return res.status(403).json({ success: false, message: 'Published results can only be edited by principal/admin' });
        }
        if (
            req.body.isPublished !== undefined ||
            req.body.status !== undefined ||
            req.body.publishedAt !== undefined ||
            req.body.publishedBy !== undefined
        ) {
            return res.status(400).json({
                success: false,
                message: 'Publish state cannot be changed from update endpoint. Use exam-wise publish APIs.'
            });
        }

        // Update fields
        let hasMaterialUpdate = false;
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
            hasMaterialUpdate = true;
        }
        if (examName) {
            result.examName = examName;
            hasMaterialUpdate = true;
        }
        if (examDate) {
            result.examDate = examDate;
            hasMaterialUpdate = true;
        }
        if (remarks !== undefined) {
            result.remarks = remarks;
            hasMaterialUpdate = true;
        }
        if (gradingSystem) {
            result.gradingSystem = gradingSystem;
            hasMaterialUpdate = true;
        }
        if (req.body.academicYear) {
            result.academicYear = req.body.academicYear;
            hasMaterialUpdate = true;
        }

        if (hasMaterialUpdate) {
            applyDraftState(result);
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
            message: hasMaterialUpdate
                ? 'Result updated and moved to draft. Publish exam-wise to make it visible.'
                : 'Result updated successfully',
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
            ...publishedVisibilityFilter()
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
            status,
            page = 1, 
            limit = 20 
        } = req.query;

        // Pagination validation and limits
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.min(Math.max(1, parseInt(limit, 10)), 100); // Max 100 records
        const skip = (pageNum - 1) * limitNum;
        const role = req.user?.role;
        const schoolCode = req.user?.schoolCode;
        let query = { schoolCode, isActive: true };
        let teacherScopes = [];

        if (className) query.studentClass = className;
        if (section) query.section = section;
        if (examName) query.examName = { $regex: examName, $options: 'i' };
        if (fromDate || toDate) {
            query.examDate = {};
            if (fromDate) query.examDate.$gte = new Date(fromDate);
            if (toDate) query.examDate.$lte = new Date(toDate);
        }
        if (status) {
            const normalizedStatus = String(status).trim().toLowerCase();
            if (!Object.values(RESULT_STATUS).includes(normalizedStatus)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status filter. Allowed values: draft, verified, published'
                });
            }
            query.status = normalizedStatus;
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
            query = andFilters(query, publishedVisibilityFilter());
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
            query = andFilters(query, publishedVisibilityFilter());
        } else if (studentId) {
            const sid = normalizeObjectIdString(studentId);
            if (!sid) {
                return res.status(400).json({ success: false, message: 'Invalid studentId filter' });
            }
            query.studentId = sid;
        }

        const results = await Result.find(query)
            .populate('studentId', 'name roll section')
            .populate('publishedBy', 'name')
            .sort({ examDate: -1, 'studentId.roll': 1 })
            .skip(skip)
            .limit(limitNum)
            .lean();

        const total = await Result.countDocuments(query).lean();

        const payload = {
            results,
            total,
            totalPages: Math.ceil(total / limitNum),
            currentPage: pageNum
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
        const role = req.user?.role;
        const schoolScopedQuery = role === 'super_admin'
            ? { _id: req.params.id }
            : { _id: req.params.id, schoolCode: req.user?.schoolCode };

        const result = await Result.findOne(schoolScopedQuery)
            .populate('studentId', 'name roll section fatherName motherName')
            .populate('publishedBy', 'name')
            .populate('updatedBy', 'name');

        if (!result) {
            return res.status(404).json({ message: 'Result not found' });
        }

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
            if (!studentOid || String(studentOid) !== resultStudentId || !isResultPublished(result)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
            return res.json(result);
        }

        if (role === 'parent') {
            const linkedStudentIds = await getParentLinkedStudentIdStrings(req.user);
            if (!linkedStudentIds.includes(resultStudentId) || !isResultPublished(result)) {
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

        const result = await Result.findOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        });
        if (!result) {
            return res.status(404).json({ message: 'Result not found' });
        }

        // Soft delete (set draft + inactive)
        applyDraftState(result);
        result.isActive = false;
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

const resolveExamPublishContext = async (req) => {
    const { examId, classId, sectionId, section } = req.body || {};
    const schoolScope = getSchoolScopeFilter(req);

    if (!schoolScope) {
        return { error: { status: 403, message: 'School scope not found' } };
    }
    if (!isValidObjectId(examId)) {
        return { error: { status: 400, message: 'Valid examId is required' } };
    }
    if (!isValidObjectId(classId)) {
        return { error: { status: 400, message: 'Valid classId is required' } };
    }

    const examOid = toObjectId(examId);
    const classOid = toObjectId(classId);

    const [exam, classDoc] = await Promise.all([
        Exam.findOne(andFilters({ _id: examOid, isActive: true }, schoolScope))
            .populate('classId', 'className section')
            .populate('targetClasses', 'className section')
            .lean(),
        Class.findOne(andFilters({ _id: classOid, isActive: true }, schoolScope))
            .select('className section')
            .lean()
    ]);

    if (!exam) {
        return { error: { status: 404, message: 'Exam not found in this school' } };
    }
    if (!classDoc) {
        return { error: { status: 404, message: 'Class not found in this school' } };
    }

    const allowedClassIds = extractExamClassIds(exam);
    if (allowedClassIds.size && !allowedClassIds.has(String(classOid))) {
        return { error: { status: 400, message: 'examId does not belong to the provided classId' } };
    }

    let resolvedSection = normalizeSectionValue(section);
    if (sectionId) {
        if (!isValidObjectId(sectionId)) {
            return { error: { status: 400, message: 'sectionId must be a valid ObjectId' } };
        }
        const sectionDoc = await Section.findOne(andFilters(
            { _id: toObjectId(sectionId), classId: classOid },
            schoolScope
        )).select('sectionName name').lean();

        if (!sectionDoc) {
            return { error: { status: 404, message: 'Section not found in this class/school' } };
        }
        resolvedSection = normalizeSectionValue(sectionDoc.sectionName || sectionDoc.name);
    } else if (!resolvedSection && classDoc.section) {
        resolvedSection = normalizeSectionValue(classDoc.section);
    }

    const anchorDate = getExamAnchorDate(exam);
    const examDayStart = new Date(anchorDate);
    examDayStart.setHours(0, 0, 0, 0);
    const examDayEnd = new Date(anchorDate);
    examDayEnd.setHours(23, 59, 59, 999);
    const examAcademicYear = anchorDate ? String(new Date(anchorDate).getFullYear()) : null;

    const identityFilter = {
        $or: [
            { examId: exam._id },
            andFilters(
                { examName: exam.name },
                examAcademicYear ? { academicYear: examAcademicYear } : {}
            ),
            { examName: exam.name, examDate: { $gte: examDayStart, $lte: examDayEnd } }
        ]
    };

    const baseFilter = andFilters(
        schoolScope,
        {
            isActive: true,
            studentClass: classDoc.className,
            ...(resolvedSection ? { section: resolvedSection } : {})
        },
        identityFilter,
        { 'subjects.0': { $exists: true } }
    );

    return {
        schoolScope,
        classDoc,
        classOid,
        exam,
        resolvedSection,
        baseFilter
    };
};

const getExamPublishSummary = async (baseFilter) => {
    const [totalResults, publishedResults, draftResults, verifiedResults] = await Promise.all([
        Result.countDocuments(baseFilter),
        Result.countDocuments(andFilters(baseFilter, publishedVisibilityFilter())),
        Result.countDocuments(andFilters(baseFilter, { status: RESULT_STATUS.DRAFT })),
        Result.countDocuments(andFilters(baseFilter, { status: RESULT_STATUS.VERIFIED }))
    ]);

    return {
        totalResults,
        publishedResults,
        draftResults,
        verifiedResults,
        unpublishedResults: Math.max(0, totalResults - publishedResults)
    };
};

const executeExamWisePublishAction = async ({ req, action }) => {
    const { withTransaction } = require('../utils/transactionHelper');
    
    return withTransaction(async (session) => {
        const context = await resolveExamPublishContext(req);
        if (context.error) {
            return context;
        }

        const now = new Date();
        const summaryBefore = await getExamPublishSummary(context.baseFilter);
        if (summaryBefore.totalResults === 0) {
            return { error: { status: 404, message: 'No result drafts found for the selected exam/class/section scope' } };
        }

        const updateFilter = action === 'publish'
            ? andFilters(context.baseFilter, nonPublishedVisibilityFilter())
            : andFilters(context.baseFilter, publishedVisibilityFilter());

        const updatePayload = action === 'publish'
            ? {
                status: RESULT_STATUS.PUBLISHED,
                isPublished: true,
                publishedAt: now,
                publishedBy: req.user._id,
                isActive: true,
                updatedBy: req.user._id,
                updatedAt: now
            }
            : {
                status: RESULT_STATUS.DRAFT,
                isPublished: false,
                publishedAt: null,
                publishedBy: null,
                updatedBy: req.user._id,
                updatedAt: now
            };

        // Update results within transaction
        const updateResult = await Result.updateMany(updateFilter, { $set: updatePayload }, { session });

        // Update exam status within transaction
        await Exam.updateMany(
            andFilters(context.schoolScope, { _id: context.exam._id }),
            {
                $set: {
                    resultsPublished: action === 'publish',
                    publishedDate: action === 'publish' ? now : null
                }
            },
            { session }
        );

        const summaryAfter = await getExamPublishSummary(context.baseFilter);

        // Create audit log within transaction
        await AuditLog.create([{
            user: req.user._id,
            action: action === 'publish' ? 'RESULTS_EXAM_WISE_PUBLISHED' : 'RESULTS_EXAM_WISE_UNPUBLISHED',
            details: {
                examId: context.exam._id,
                examName: context.exam.name,
                classId: context.classOid,
                className: context.classDoc.className,
                section: context.resolvedSection || null,
                summaryBefore,
                summaryAfter,
                modifiedCount: updateResult.modifiedCount
            },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        }], { session });

        return {
            success: true,
            data: {
                examId: context.exam._id,
                examName: context.exam.name,
                classId: context.classOid,
                className: context.classDoc.className,
                section: context.resolvedSection || null,
                updatedCount: updateResult.modifiedCount || 0,
                summaryBefore,
                summaryAfter
            }
        };
    });
};

// @desc    Publish results exam-wise (bulk)
// @route   POST|PUT /api/results/publish
// @access  Private (Principal/Admin)
exports.publishResultsByExam = async (req, res) => {
    try {
        const actionResult = await executeExamWisePublishAction({ req, action: 'publish' });
        if (!actionResult.success) {
            return res.status(actionResult.error.status).json({ success: false, message: actionResult.error.message });
        }

        return res.status(200).json({
            success: true,
            message: 'Results published exam-wise successfully',
            data: actionResult.data
        });
    } catch (error) {
        console.error('Exam-wise publish error:', error);
        return res.status(500).json({ success: false, message: 'Failed to publish results exam-wise' });
    }
};

// @desc    Unpublish results exam-wise (bulk)
// @route   POST /api/results/unpublish
// @access  Private (Principal/Admin)
exports.unpublishResultsByExam = async (req, res) => {
    try {
        const actionResult = await executeExamWisePublishAction({ req, action: 'unpublish' });
        if (!actionResult.success) {
            return res.status(actionResult.error.status).json({ success: false, message: actionResult.error.message });
        }

        return res.status(200).json({
            success: true,
            message: 'Results unpublished exam-wise successfully',
            data: actionResult.data
        });
    } catch (error) {
        console.error('Exam-wise unpublish error:', error);
        return res.status(500).json({ success: false, message: 'Failed to unpublish results exam-wise' });
    }
};

// @desc    Get publish status summary for exam/class
// @route   GET /api/results/publish-status
// @access  Private (Principal/Admin)
exports.getExamPublishStatus = async (req, res) => {
    try {
        const context = await resolveExamPublishContext({ ...req, body: req.query });
        if (context.error) {
            return res.status(context.error.status).json({ success: false, message: context.error.message });
        }

        const summary = await getExamPublishSummary(context.baseFilter);
        return res.status(200).json({
            success: true,
            data: {
                examId: context.exam._id,
                examName: context.exam.name,
                classId: context.classOid,
                className: context.classDoc.className,
                section: context.resolvedSection || null,
                summary,
                isFullyPublished: summary.totalResults > 0 && summary.publishedResults === summary.totalResults
            }
        });
    } catch (error) {
        console.error('Get exam publish status error:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch publish status' });
    }
};

// Backward-compatible alias for older route/controller references
exports.bulkPublishResults = exports.publishResultsByExam;


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
            ...publishedVisibilityFilter()
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
        const examOid = toObjectId(examId);
        if (!examOid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid examId'
            });
        }

        const result = await Result.findOne({
            schoolCode,
            studentId: studentOid,
            $or: [{ examId: examOid }, { _id: examOid }],
            ...publishedVisibilityFilter()
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
        const role = req.user?.role;
        const schoolScopedQuery = role === 'super_admin'
            ? { _id: req.params.id }
            : { _id: req.params.id, schoolCode: req.user?.schoolCode };

        const result = await Result.findOne(schoolScopedQuery)
            .populate('studentId', 'name fatherName motherName section');
        if (!result) {
            return res.status(404).send('Result not found');
        }

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
                if (!studentOid || String(studentOid) !== resultStudentId || !isResultPublished(result)) {
                    return res.status(403).json({ success: false, message: 'Access denied' });
                }
            } else if (role === 'parent') {
                const linkedStudentIds = await getParentLinkedStudentIdStrings(req.user);
                if (!linkedStudentIds.includes(resultStudentId) || !isResultPublished(result)) {
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

        let query = andFilters({ schoolCode: req.user.schoolCode, isActive: true }, publishedVisibilityFilter());
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

const buildMarkEntry = async ({
    schoolCode,
    teacherId,
    exam,
    classDoc,
    section,
    subjectContext,
    studentId,
    marks,
    student
}) => {
    if (!exam || !subjectContext?.subjectId || !studentId || !classDoc?._id) {
        throw new Error('Exam, class, subject, and student are required');
    }

    const studentDoc = student || await Student.findOne({ _id: studentId, schoolCode, isActive: true });
    if (!studentDoc) {
        const error = new Error('Student not found in this school');
        error.status = 404;
        throw error;
    }

    if (String(studentDoc.studentClass).trim() !== String(classDoc.className).trim()) {
        const error = new Error('Student does not belong to the exam class');
        error.status = 400;
        throw error;
    }

    const scopedSection = normalizeSectionValue(section || classDoc.section || '');
    const studentSection = normalizeSectionValue(studentDoc.section);
    if (scopedSection && studentSection && scopedSection !== studentSection) {
        const error = new Error('Student does not belong to the exam section');
        error.status = 400;
        throw error;
    }

    const assignment = await findTeacherAssignment(teacherId, schoolCode, classDoc._id, subjectContext.subjectId);
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
    if (subjectContext.totalMarks !== undefined && markValue > Number(subjectContext.totalMarks)) {
        const error = new Error(`Marks cannot exceed total marks (${subjectContext.totalMarks})`);
        error.status = 400;
        throw error;
    }

    const subjectEntry = {
        subjectId: subjectContext.subjectId,
        subjectName: subjectContext.subjectName || 'Unknown Subject',
        marks: markValue,
        grade: calculateGrade(markValue)
    };

    let result = await Result.findOne({ schoolCode, studentId: studentDoc._id, examId: exam._id });
    if (!result) {
        result = await Result.findOne({
            schoolCode,
            studentId: studentDoc._id,
            examName: exam.name,
            studentClass: classDoc.className,
            ...(scopedSection ? { section: scopedSection } : {})
        });
    }

    if (result && result.isLocked) {
        const error = new Error('Result is locked and cannot be updated');
        error.status = 403;
        throw error;
    }
    if (result && isResultPublished(result)) {
        const error = new Error('Published results cannot be modified by teachers');
        error.status = 400;
        throw error;
    }

    const anchorDate = getExamAnchorDate(exam);
    const resolvedSection = studentSection || scopedSection || normalizeSectionValue(classDoc.section);

    if (!result) {
        result = new Result({
            examId: exam._id,
            studentId: studentDoc._id,
            ...(exam.schoolId ? { schoolId: exam.schoolId } : {}),
            schoolCode,
            studentClass: classDoc.className,
            section: resolvedSection || undefined,
            roll: studentDoc.roll,
            examName: exam.name,
            examDate: anchorDate,
            academicYear: String(new Date(anchorDate).getFullYear()),
            subjects: [subjectEntry],
            totalMarks: markValue,
            gpa: calculateGPA([subjectEntry]),
            gradingSystem: 'standard',
            status: RESULT_STATUS.DRAFT,
            isPublished: false,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    } else {
        const subjects = result.subjects || [];
        const existingIndex = subjects.findIndex((entry) =>
            entry.subjectId && String(entry.subjectId) === String(subjectContext.subjectId)
        );
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
        result.examId = exam._id;
        result.studentClass = classDoc.className;
        result.section = resolvedSection || result.section;
        applyDraftState(result);
    }

    await result.save();
    await result.populate('studentId', 'name roll');
    await result.populate('examId', 'name date startDate');
    return result;
};

/**
 * @desc    Enter marks
 * @route   POST /api/results/marks/enter
 * @access  Teacher only
 */
exports.enterMarks = async (req, res) => {
    try {
        const { examId, classId, section, studentId, subjectId, marks, marksData } = req.body;
        const teacherId = toObjectId(req.user._id || req.user.id);
        const schoolCode = req.user.schoolCode;

        if (!teacherId || !schoolCode) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        const examOid = toObjectId(examId);
        if (!examOid) {
            return res.status(400).json({ success: false, message: 'Valid examId is required' });
        }
        if (subjectId && !isValidObjectId(subjectId)) {
            return res.status(400).json({ success: false, message: 'subjectId must be a valid ObjectId' });
        }
        if (classId && !isValidObjectId(classId)) {
            return res.status(400).json({ success: false, message: 'classId must be a valid ObjectId' });
        }

        const exam = await Exam.findOne({ _id: examOid, schoolCode, isActive: true })
            .populate('classId', 'className section')
            .populate('targetClasses', 'className section')
            .populate('subjectId', 'subjectName')
            .lean();

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        const scheduleCache = new Map();
        const schedule = await getExamScheduleDoc({
            examId: exam._id,
            schoolCode,
            cache: scheduleCache
        });

        const results = [];
        const errors = [];

        if (Array.isArray(marksData)) {
            if (marksData.length === 0) {
                return res.status(400).json({ success: false, message: 'marksData array must contain at least one entry' });
            }

            for (const item of marksData) {
                const rowStudentId = toObjectId(item.studentId);
                try {
                    if (!rowStudentId) {
                        throw new Error('studentId must be a valid ObjectId');
                    }

                    const rowStudent = await Student.findOne({
                        _id: rowStudentId,
                        schoolCode,
                        isActive: true
                    }).select('_id roll studentClass section').lean();
                    if (!rowStudent) {
                        throw new Error('Student not found in this school');
                    }

                    const classContext = await resolveExamClassContextForMarks({
                        exam,
                        schoolCode,
                        classId: item.classId || classId,
                        student: rowStudent
                    });
                    if (classContext.error) {
                        const scopedError = new Error(classContext.error.message);
                        scopedError.status = classContext.error.status;
                        throw scopedError;
                    }

                    const scopedSection = normalizeSectionValue(
                        item.section || section || rowStudent.section || classContext.classDoc.section
                    );

                    const resolvedSubjectInput = item.subjectId || subjectId;
                    const subjectContext = await resolveExamSubjectContextForMarks({
                        exam,
                        schoolCode,
                        subjectId: resolvedSubjectInput,
                        classDoc: classContext.classDoc,
                        section: scopedSection,
                        schedule
                    });
                    if (subjectContext.error) {
                        const scopedError = new Error(subjectContext.error.message);
                        scopedError.status = subjectContext.error.status;
                        throw scopedError;
                    }

                    const result = await buildMarkEntry({
                        schoolCode,
                        teacherId,
                        exam,
                        classDoc: classContext.classDoc,
                        section: scopedSection,
                        subjectContext,
                        studentId: rowStudentId,
                        marks: item.marks,
                        student: rowStudent
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

        const studentDoc = await Student.findOne({
            _id: studentOid,
            schoolCode,
            isActive: true
        }).select('_id roll studentClass section').lean();

        if (!studentDoc) {
            return res.status(404).json({ success: false, message: 'Student not found in this school' });
        }

        const classContext = await resolveExamClassContextForMarks({
            exam,
            schoolCode,
            classId,
            student: studentDoc
        });
        if (classContext.error) {
            return res.status(classContext.error.status).json({ success: false, message: classContext.error.message });
        }

        const scopedSection = normalizeSectionValue(section || studentDoc.section || classContext.classDoc.section);
        const subjectContext = await resolveExamSubjectContextForMarks({
            exam,
            schoolCode,
            subjectId,
            classDoc: classContext.classDoc,
            section: scopedSection,
            schedule
        });
        if (subjectContext.error) {
            return res.status(subjectContext.error.status).json({ success: false, message: subjectContext.error.message });
        }

        const result = await buildMarkEntry({
            schoolCode,
            teacherId,
            exam,
            classDoc: classContext.classDoc,
            section: scopedSection,
            subjectContext,
            studentId: studentOid,
            marks,
            student: studentDoc
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

        const result = await Result.findOne({ _id: resultId, schoolCode });
        if (!result) {
            return res.status(404).json({ success: false, message: 'Result not found' });
        }

        if (result.isLocked) {
            return res.status(403).json({ success: false, message: 'Result is locked and cannot be updated' });
        }

        if (isResultPublished(result)) {
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
                .populate('targetClasses', 'className section')
                .populate('subjectId', 'subjectName')
                .lean();
        }

        const classDoc = await Class.findOne({
            schoolCode,
            className: String(result.studentClass || '').trim(),
            ...(result.section ? { section: normalizeSectionValue(result.section) } : {}),
            isActive: true
        }).select('_id className section').lean();

        if (!classDoc) {
            return res.status(400).json({ success: false, message: 'Result class scope is invalid' });
        }

        if (exam && !isClassWithinExamScope(exam, classDoc._id)) {
            return res.status(400).json({ success: false, message: 'Result class is outside exam scope' });
        }

        let marksLimit = exam?.totalMarks || null;
        if (exam) {
            if (exam.subjectId && String(exam.subjectId?._id || exam.subjectId) !== String(subjectOid)) {
                return res.status(400).json({ success: false, message: 'Subject does not match the exam' });
            }

            const schedule = await getExamScheduleDoc({
                examId: exam._id,
                schoolCode,
                cache: null
            });
            const slot = findScheduleSlot({
                schedule,
                classDoc,
                section: result.section,
                subjectId: subjectOid
            });

            if (!exam.subjectId && schedule && !slot) {
                return res.status(400).json({ success: false, message: 'Subject is not scheduled for this exam/class scope' });
            }
            if (slot?.totalMarks || slot?.fullMarks) {
                marksLimit = Number(slot.totalMarks || slot.fullMarks);
            }
        }

        const assignment = await findTeacherAssignment(teacherId, schoolCode, classDoc._id, subjectOid);
        if (!assignment) {
            return res.status(403).json({ success: false, message: 'You are not authorized to update marks for this class and subject' });
        }

        if (marksLimit !== null && Number.isFinite(Number(marksLimit)) && markValue > Number(marksLimit)) {
            return res.status(400).json({
                success: false,
                message: `Marks cannot exceed total marks (${Number(marksLimit)})`
            });
        }

        subjectEntry.marks = markValue;
        subjectEntry.grade = calculateGrade(markValue);

        const subjects = result.subjects;
        result.totalMarks = subjects.reduce((sum, curr) => sum + Number(curr.marks || 0), 0);
        result.gpa = calculateGPA(subjects);
        result.updatedBy = teacherId;
        result.updatedAt = new Date();
        applyDraftState(result);

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
        const { classId, subjectId, section, sectionId } = req.query;
        const teacherId = toObjectId(req.user._id || req.user.id);
        const schoolCode = req.user.schoolCode;

        const examOid = toObjectId(examId);
        if (!examOid) {
            return res.status(400).json({ success: false, message: 'Invalid examId' });
        }
        if (classId && !isValidObjectId(classId)) {
            return res.status(400).json({ success: false, message: 'Invalid classId' });
        }
        if (subjectId && !isValidObjectId(subjectId)) {
            return res.status(400).json({ success: false, message: 'Invalid subjectId' });
        }
        if (sectionId && !isValidObjectId(sectionId)) {
            return res.status(400).json({ success: false, message: 'Invalid sectionId' });
        }

        const exam = await Exam.findOne({ _id: examOid, schoolCode, isActive: true })
            .populate('classId', 'className section')
            .populate('targetClasses', 'className section')
            .populate('subjectId', 'subjectName')
            .lean();

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        const classContext = await resolveExamClassContextForMarks({
            exam,
            schoolCode,
            classId
        });
        if (classContext.error) {
            return res.status(classContext.error.status).json({ success: false, message: classContext.error.message });
        }

        let scopedSection = normalizeSectionValue(section || classContext.classDoc.section);
        if (sectionId) {
            const sectionDoc = await Section.findOne({
                _id: toObjectId(sectionId),
                schoolCode,
                classId: classContext.classDoc._id
            }).select('sectionName name').lean();
            if (!sectionDoc) {
                return res.status(404).json({ success: false, message: 'Section not found for this class' });
            }
            scopedSection = normalizeSectionValue(sectionDoc.sectionName || sectionDoc.name);
        }

        const schedule = await getExamScheduleDoc({
            examId: exam._id,
            schoolCode,
            cache: null
        });
        const subjectContext = await resolveExamSubjectContextForMarks({
            exam,
            schoolCode,
            subjectId,
            classDoc: classContext.classDoc,
            section: scopedSection,
            schedule
        });
        if (subjectContext.error) {
            return res.status(subjectContext.error.status).json({ success: false, message: subjectContext.error.message });
        }

        const assignment = await findTeacherAssignment(
            teacherId,
            schoolCode,
            classContext.classDoc._id,
            subjectContext.subjectId
        );
        if (!assignment) {
            return res.status(403).json({ success: false, message: 'You are not authorized to view marks for this exam' });
        }

        const studentsInClass = await Student.countDocuments({
            schoolCode,
            studentClass: classContext.classDoc.className,
            ...(scopedSection ? { section: scopedSection } : {}),
            isActive: true
        });

        const results = await Result.find({
            schoolCode,
            examId: exam._id,
            studentClass: classContext.classDoc.className,
            ...(scopedSection ? { section: scopedSection } : {})
        })
            .populate('studentId', 'name roll')
            .lean();

        const rows = results.map((result) => {
            const subjectEntry = result.subjects.find((entry) =>
                entry.subjectId && String(entry.subjectId) === String(subjectContext.subjectId)
            );
            return {
                resultId: result._id,
                studentId: result.studentId?._id,
                name: result.studentId?.name,
                roll: result.studentId?.roll,
                marks: subjectEntry?.marks ?? null,
                grade: subjectEntry?.grade ?? null,
                totalMarks: result.totalMarks,
                gpa: result.gpa,
                published: isResultPublished(result)
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
                category: exam.category || 'school_exam',
                classId: classContext.classDoc._id,
                className: classContext.classDoc.className,
                section: scopedSection || null,
                subjectId: subjectContext.subjectId,
                subjectName: subjectContext.subjectName,
                date: getExamAnchorDate(exam),
                totalMarks: subjectContext.totalMarks || exam.totalMarks
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
                published: isResultPublished(result)
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

        const assignedClassIds = [...new Set(
            assignments.flatMap((assignment) => assignment.classes || []).map((id) => String(id)).filter(Boolean)
        )];
        const assignedSubjectIds = [...new Set(
            assignments.map((assignment) => String(assignment.subject)).filter(Boolean)
        )];

        if (!assignedClassIds.length || !assignedSubjectIds.length) {
            return res.status(200).json({ success: true, data: { exams: [] } });
        }

        if (classId && (!isValidObjectId(classId) || !assignedClassIds.includes(String(classId)))) {
            return res.status(403).json({ success: false, message: 'Unauthorized class filter' });
        }
        if (subjectId && (!isValidObjectId(subjectId) || !assignedSubjectIds.includes(String(subjectId)))) {
            return res.status(403).json({ success: false, message: 'Unauthorized subject filter' });
        }

        const assignedClassOids = assignedClassIds.map((id) => new mongoose.Types.ObjectId(id));

        const query = {
            schoolCode,
            isActive: true,
            $or: [
                { classId: { $in: assignedClassOids } },
                { targetClasses: { $in: assignedClassOids } }
            ]
        };

        const exams = await Exam.find(query)
            .populate('classId', 'className section')
            .populate('targetClasses', 'className section')
            .populate('subjectId', 'subjectName subjectCode')
            .sort({ startDate: -1, date: -1, createdAt: -1 })
            .lean();

        if (!exams.length) {
            return res.status(200).json({ success: true, data: { exams: [] } });
        }

        const examIds = exams.map((exam) => exam._id);
        const schedules = await ExamSchedule.find({
            schoolCode,
            examId: { $in: examIds }
        }).select('examId slots').lean();

        const scheduleMap = new Map(schedules.map((row) => [String(row.examId), row]));
        const classRows = await Class.find({
            _id: { $in: assignedClassOids },
            schoolCode,
            isActive: true
        }).select('_id className section').lean();
        const classMap = new Map(classRows.map((row) => [String(row._id), row]));

        const data = [];
        for (const exam of exams) {
            const scopedRows = [];
            const seenScopeKeys = new Set();

            const pushScope = ({ classId: scopedClassId, section: scopedSection, subjectId: scopedSubjectId, subjectName, totalMarks }) => {
                if (!scopedClassId || !scopedSubjectId) return;
                const classIdStr = String(scopedClassId);
                const subjectIdStr = String(scopedSubjectId);
                const sectionToken = normalizeSectionValue(scopedSection);
                const scopeKey = `${classIdStr}::${subjectIdStr}::${sectionToken}`;
                if (seenScopeKeys.has(scopeKey)) return;
                if (!assignedClassIds.includes(classIdStr) || !assignedSubjectIds.includes(subjectIdStr)) return;
                if (classId && classIdStr !== String(classId)) return;
                if (subjectId && subjectIdStr !== String(subjectId)) return;

                const classMeta = classMap.get(classIdStr)
                    || (exam.classId && String(exam.classId._id || exam.classId) === classIdStr ? exam.classId : null)
                    || (exam.targetClasses || []).find((row) => String(row._id || row) === classIdStr)
                    || null;

                scopedRows.push({
                    classId: classIdStr,
                    className: classMeta?.className || null,
                    section: sectionToken || classMeta?.section || null,
                    subjectId: subjectIdStr,
                    subjectName: subjectName || null,
                    totalMarks: totalMarks || exam.totalMarks || null
                });
                seenScopeKeys.add(scopeKey);
            };

            const legacyClassId = exam.classId ? String(exam.classId._id || exam.classId) : null;
            const legacySubjectId = exam.subjectId ? String(exam.subjectId._id || exam.subjectId) : null;
            if (legacyClassId && legacySubjectId) {
                pushScope({
                    classId: legacyClassId,
                    section: exam.classId?.section,
                    subjectId: legacySubjectId,
                    subjectName: exam.subjectId?.subjectName,
                    totalMarks: exam.totalMarks
                });
            }

            const schedule = scheduleMap.get(String(exam._id));
            if (schedule?.slots?.length) {
                schedule.slots.forEach((slot) => {
                    pushScope({
                        classId: slot.classId,
                        section: slot.section,
                        subjectId: slot.subjectId,
                        subjectName: slot.subjectName,
                        totalMarks: slot.totalMarks || slot.fullMarks
                    });
                });
            }

            if (!scopedRows.length) {
                continue;
            }

            const primaryScope = scopedRows[0];
            data.push({
                _id: exam._id,
                name: exam.name,
                examType: exam.examType,
                category: exam.category || 'school_exam',
                classId: primaryScope.classId,
                className: primaryScope.className,
                section: primaryScope.section,
                subjectId: primaryScope.subjectId,
                subjectName: primaryScope.subjectName,
                totalMarks: primaryScope.totalMarks,
                date: exam.startDate || exam.date,
                resultsPublished: exam.resultsPublished,
                availableScopes: scopedRows
            });
        }

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

        const queryClassIds = classId ? [String(classId)] : assignedClassIds;
        const classDocs = await Class.find({
            schoolCode,
            _id: { $in: queryClassIds }
        })
            .select('className section')
            .lean();

        if (!classDocs.length) {
            return res.status(200).json({ success: true, data: { students: [], totalStudents: 0 } });
        }

        const scopes = classDocs
            .filter((cls) => cls.className)
            .map((cls) => ({
                className: String(cls.className).trim(),
                section: cls.section ? String(cls.section).trim().toUpperCase() : null
            }));

        if (!scopes.length) {
            return res.status(200).json({ success: true, data: { students: [], totalStudents: 0 } });
        }

        const studentFilter = {
            schoolCode,
            isActive: true,
            $or: scopes.map((scope) => ({
                studentClass: scope.className,
                ...(scope.section ? { section: scope.section } : {})
            }))
        };

        let students = await Student.find(studentFilter)
            .select('name roll section studentClass')
            .lean();

        if (sectionId) {
            const sectionRaw = String(sectionId).trim();
            if (sectionRaw) {
                const sectionMatches = new Set([sectionRaw.toUpperCase()]);
                if (isValidObjectId(sectionRaw)) {
                    const Section = require('../models/Section');
                    const sectionDoc = await Section.findOne({ _id: sectionRaw, schoolCode }).select('name sectionName').lean();
                    if (sectionDoc) {
                        if (sectionDoc.name) sectionMatches.add(String(sectionDoc.name).trim().toUpperCase());
                        if (sectionDoc.sectionName) sectionMatches.add(String(sectionDoc.sectionName).trim().toUpperCase());
                    }
                }

                students = students.filter((student) =>
                    sectionMatches.has(String(student.section || '').trim().toUpperCase())
                );
            }
        }

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
