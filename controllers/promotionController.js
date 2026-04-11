/**
 * 🎓 PROMOTION CONTROLLER
 * Academic promotion management - Result-based class change
 */

const mongoose = require('mongoose');
const Student = require('../models/Student');
const Result = require('../models/Result');
const Class = require('../models/Class');
const Exam = require('../models/Exam');
const Subject = require('../models/Subject');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/createNotification');

const DEFAULT_PASS_MARK = 33;

const normalizeString = (value) => String(value || '').trim();

const normalizeSection = (value) => normalizeString(value).toUpperCase();

const normalizeNameKey = (value) => normalizeString(value).toLowerCase();

const normalizeAcademicYear = (value) => normalizeString(value);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toFiniteNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const normalizePassingMarks = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) {
        return DEFAULT_PASS_MARK;
    }
    return number;
};

const numericRollValue = (roll) => {
    const text = normalizeString(roll);
    if (!text) return Number.MAX_SAFE_INTEGER;
    const parsed = Number.parseInt(text.replace(/[^0-9-]/g, ''), 10);
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

const gradePointFromMarks = (marks) => {
    const score = toFiniteNumber(marks, 0);
    if (score >= 80) return 5;
    if (score >= 70) return 4;
    if (score >= 60) return 3.5;
    if (score >= 50) return 3;
    if (score >= 40) return 2;
    if (score >= 33) return 1;
    return 0;
};

const buildMeritComparator = () => (a, b) => {
    const markDiff = toFiniteNumber(b.totalMarks) - toFiniteNumber(a.totalMarks);
    if (markDiff !== 0) return markDiff;

    const gpaDiff = toFiniteNumber(b.gpa) - toFiniteNumber(a.gpa);
    if (gpaDiff !== 0) return gpaDiff;

    const rollDiff = numericRollValue(a.currentRoll) - numericRollValue(b.currentRoll);
    if (rollDiff !== 0) return rollDiff;

    return normalizeString(a.name).localeCompare(normalizeString(b.name));
};

const deriveAcademicYearFromDate = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return String(date.getFullYear());
};

const isSameAcademicYear = (candidate, target) => {
    if (!target) return true;
    return normalizeAcademicYear(candidate) === normalizeAcademicYear(target);
};

const fetchFinalExamDocs = async ({ schoolCode, sourceClassId, examName, academicYear }) => {
    const query = {
        schoolCode,
        classId: sourceClassId,
        examType: 'Final',
        isActive: true
    };

    if (examName) {
        query.name = { $regex: new RegExp(`^${escapeRegex(examName)}$`, 'i') };
    }

    const rows = await Exam.find(query)
        .select('_id name subjectId date examType')
        .populate('subjectId', 'subjectName passingMarks')
        .sort({ date: -1, createdAt: -1 })
        .lean();

    if (!academicYear) return rows;

    return rows.filter((exam) => {
        const examAcademicYear = deriveAcademicYearFromDate(exam.date);
        return isSameAcademicYear(examAcademicYear, academicYear);
    });
};

const fetchSessionResults = async ({ schoolCode, sourceClass, examName, academicYear, finalExamIds }) => {
    const sourceSection = normalizeSection(sourceClass.section);
    const query = {
        schoolCode,
        studentClass: sourceClass.className,
        section: sourceSection,
        isActive: { $ne: false }
    };

    if (academicYear) {
        query.academicYear = normalizeAcademicYear(academicYear);
    }

    const examNameMatcher = {
        examName: { $regex: new RegExp(`^${escapeRegex(examName)}$`, 'i') }
    };

    if (finalExamIds.length) {
        query.$or = [
            { examId: { $in: finalExamIds } },
            examNameMatcher
        ];
    } else {
        Object.assign(query, examNameMatcher);
    }

    return await Result.find(query)
        .select('studentId subjects examName academicYear examId totalMarks gpa updatedAt createdAt')
        .lean();
};

const resolveRequiredSubjects = async ({ sourceClass, finalExamDocs, sessionResults, passMark }) => {
    const requiredMap = new Map();
    const addRequiredSubject = ({ subjectId, subjectName, passingMarks }) => {
        const subjectIdString = subjectId ? String(subjectId) : '';
        const name = normalizeString(subjectName);
        const nameKey = normalizeNameKey(name);
        const key = subjectIdString || nameKey;
        if (!key) return;

        if (!requiredMap.has(key)) {
            requiredMap.set(key, {
                key,
                subjectId: subjectIdString || null,
                subjectName: name || 'Unknown Subject',
                passingMarks: Number.isFinite(passMark) && Number(passMark) > 0
                    ? Number(passMark)
                    : normalizePassingMarks(passingMarks)
            });
            return;
        }

        const existing = requiredMap.get(key);
        if (!existing.subjectName && name) {
            existing.subjectName = name;
        }
        if (Number.isFinite(passMark) && Number(passMark) > 0) {
            existing.passingMarks = Number(passMark);
        }
    };

    const classSubjects = (sourceClass.subjects || []).filter((entry) => entry && entry.isActive !== false);
    const classSubjectIds = classSubjects
        .map((entry) => (entry.subjectId ? String(entry.subjectId) : null))
        .filter(Boolean);

    const subjectDocs = classSubjectIds.length
        ? await Subject.find({ _id: { $in: classSubjectIds } })
            .select('_id subjectName passingMarks')
            .lean()
        : [];

    const subjectDocMap = new Map(subjectDocs.map((doc) => [String(doc._id), doc]));

    classSubjects.forEach((entry) => {
        const subjectId = entry.subjectId ? String(entry.subjectId) : null;
        const subjectDoc = subjectId ? subjectDocMap.get(subjectId) : null;
        addRequiredSubject({
            subjectId,
            subjectName: entry.subjectName || subjectDoc?.subjectName,
            passingMarks: subjectDoc?.passingMarks
        });
    });

    if (!requiredMap.size) {
        finalExamDocs.forEach((exam) => {
            const subjectId = exam.subjectId?._id ? String(exam.subjectId._id) : exam.subjectId ? String(exam.subjectId) : null;
            addRequiredSubject({
                subjectId,
                subjectName: exam.subjectId?.subjectName,
                passingMarks: exam.subjectId?.passingMarks
            });
        });
    }

    if (!requiredMap.size) {
        sessionResults.forEach((result) => {
            (result.subjects || []).forEach((subject) => {
                addRequiredSubject({
                    subjectId: subject.subjectId ? String(subject.subjectId) : null,
                    subjectName: subject.subjectName,
                    passingMarks: DEFAULT_PASS_MARK
                });
            });
        });
    }

    return Array.from(requiredMap.values());
};

const aggregateResultSubjectsForStudent = (resultDocs) => {
    const bySubjectId = new Map();
    const bySubjectName = new Map();

    for (const result of resultDocs) {
        const updatedAt = result.updatedAt || result.createdAt || new Date(0);
        for (const subject of result.subjects || []) {
            const marks = toFiniteNumber(subject.marks, 0);
            const subjectId = subject.subjectId ? String(subject.subjectId) : null;
            const subjectName = normalizeString(subject.subjectName);
            const nameKey = normalizeNameKey(subjectName);
            const current = {
                marks,
                grade: subject.grade || null,
                subjectId,
                subjectName,
                updatedAt
            };

            if (subjectId) {
                const existing = bySubjectId.get(subjectId);
                if (!existing || new Date(existing.updatedAt) < new Date(updatedAt)) {
                    bySubjectId.set(subjectId, current);
                }
            }

            if (nameKey) {
                const existingByName = bySubjectName.get(nameKey);
                if (!existingByName || new Date(existingByName.updatedAt) < new Date(updatedAt)) {
                    bySubjectName.set(nameKey, current);
                }
            }
        }
    }

    return { bySubjectId, bySubjectName };
};

const buildPromotionPreview = async ({
    schoolCode,
    sourceClass,
    targetClass,
    examName,
    academicYear,
    passMark
}) => {
    const sourceSection = normalizeSection(sourceClass.section);
    const students = await Student.find({
        schoolCode,
        studentClass: sourceClass.className,
        section: sourceSection,
        isActive: true
    })
        .select('_id name email roll studentClass section')
        .sort({ roll: 1, name: 1 })
        .lean();

    const finalExamDocs = await fetchFinalExamDocs({
        schoolCode,
        sourceClassId: sourceClass._id,
        examName,
        academicYear
    });

    const finalExamIds = finalExamDocs
        .map((exam) => (exam?._id ? new mongoose.Types.ObjectId(String(exam._id)) : null))
        .filter(Boolean);

    const sessionResults = await fetchSessionResults({
        schoolCode,
        sourceClass,
        examName,
        academicYear,
        finalExamIds
    });

    const normalizedPassMark = Number.isFinite(Number(passMark))
        ? Number(passMark)
        : null;

    const requiredSubjects = await resolveRequiredSubjects({
        sourceClass,
        finalExamDocs,
        sessionResults,
        passMark: normalizedPassMark
    });

    const resultsByStudent = new Map();
    sessionResults.forEach((result) => {
        const studentId = String(result.studentId);
        const bucket = resultsByStudent.get(studentId) || [];
        bucket.push(result);
        resultsByStudent.set(studentId, bucket);
    });

    const eligible = [];
    const failed = [];
    const incomplete = [];

    students.forEach((student) => {
        const studentId = String(student._id);
        const resultDocs = resultsByStudent.get(studentId) || [];
        const aggregated = aggregateResultSubjectsForStudent(resultDocs);

        const subjectBreakdown = requiredSubjects.map((requiredSubject) => {
            const byId = requiredSubject.subjectId ? aggregated.bySubjectId.get(requiredSubject.subjectId) : null;
            const byName = aggregated.bySubjectName.get(normalizeNameKey(requiredSubject.subjectName));
            const resolved = byId || byName || null;

            const marks = resolved ? toFiniteNumber(resolved.marks, 0) : null;
            const isMissing = marks === null;
            const resolvedPassingMarks = normalizePassingMarks(requiredSubject.passingMarks);
            const passed = !isMissing && marks >= resolvedPassingMarks;

            return {
                subjectId: requiredSubject.subjectId,
                subjectName: requiredSubject.subjectName,
                passingMarks: resolvedPassingMarks,
                marks,
                status: isMissing ? 'missing' : passed ? 'pass' : 'fail'
            };
        });

        const missingSubjects = subjectBreakdown.filter((subject) => subject.status === 'missing');
        const failedSubjects = subjectBreakdown.filter((subject) => subject.status === 'fail');
        const passedSubjects = subjectBreakdown.filter((subject) => subject.status === 'pass');

        const totalMarks = subjectBreakdown.reduce((sum, subject) => {
            if (subject.marks === null) return sum;
            return sum + toFiniteNumber(subject.marks, 0);
        }, 0);

        const gpa = subjectBreakdown.length
            ? Number((subjectBreakdown.reduce((sum, subject) => {
                if (subject.marks === null) return sum;
                return sum + gradePointFromMarks(subject.marks);
            }, 0) / subjectBreakdown.length).toFixed(2))
            : 0;

        const status = missingSubjects.length
            ? 'incomplete'
            : failedSubjects.length
                ? 'failed'
                : 'eligible';

        const item = {
            _id: studentId,
            name: student.name,
            email: student.email || null,
            currentRoll: normalizeString(student.roll),
            currentClass: student.studentClass,
            currentSection: normalizeSection(student.section),
            status,
            totalMarks,
            gpa,
            requiredSubjectCount: requiredSubjects.length,
            passedSubjectCount: passedSubjects.length,
            failedSubjectCount: failedSubjects.length,
            missingSubjectCount: missingSubjects.length,
            subjects: subjectBreakdown,
            hasResult: resultDocs.length > 0,
            canOverride: status === 'failed' || status === 'incomplete'
        };

        if (status === 'eligible') {
            eligible.push(item);
        } else if (status === 'failed') {
            failed.push(item);
        } else {
            incomplete.push(item);
        }
    });

    const meritComparator = buildMeritComparator();
    const rankedEligible = [...eligible].sort(meritComparator).map((student, index) => ({
        ...student,
        meritRank: index + 1,
        proposedRoll: index + 1
    }));

    const rankedEligibleById = new Map(rankedEligible.map((row) => [row._id, row]));
    const eligibleWithRank = eligible.map((row) => rankedEligibleById.get(row._id) || row);

    const studentsWithAnyResult = students.filter((student) => resultsByStudent.has(String(student._id))).length;

    return {
        sourceClass: {
            _id: String(sourceClass._id),
            className: sourceClass.className,
            section: normalizeSection(sourceClass.section),
            classLevel: sourceClass.classLevel
        },
        targetClass: targetClass
            ? {
                _id: String(targetClass._id),
                className: targetClass.className,
                section: normalizeSection(targetClass.section),
                classLevel: targetClass.classLevel
            }
            : null,
        examSession: {
            examName,
            academicYear: academicYear || '',
            finalExamCount: finalExamDocs.length
        },
        requiredSubjects,
        eligible: eligibleWithRank,
        failed,
        incomplete,
        summary: {
            totalStudents: students.length,
            studentsWithAnyResult,
            missingResultCount: Math.max(students.length - studentsWithAnyResult, 0),
            eligibleCount: eligible.length,
            failedCount: failed.length,
            incompleteCount: incomplete.length,
            completionReady: incomplete.length === 0 && requiredSubjects.length > 0,
            previewGeneratedAt: new Date().toISOString()
        }
    };
};

// @desc    List final exam sessions for a class
// @route   GET /api/promotion/final-exams
// @access  Private (Principal)
exports.getFinalExamSessions = async (req, res) => {
    try {
        const { classId, academicYear } = req.query;
        const schoolCode = req.user.schoolCode;

        if (!isValidObjectId(classId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid classId is required'
            });
        }

        const sourceClass = await Class.findOne({
            _id: classId,
            schoolCode,
            isActive: true
        })
            .select('_id className section classLevel')
            .lean();

        if (!sourceClass) {
            return res.status(404).json({
                success: false,
                message: 'Class not found'
            });
        }

        const finalExams = await Exam.find({
            schoolCode,
            classId: sourceClass._id,
            examType: 'Final',
            isActive: true
        })
            .select('_id name date subjectId')
            .populate('subjectId', 'subjectName')
            .sort({ date: -1, createdAt: -1 })
            .lean();

        const grouped = new Map();

        finalExams.forEach((exam) => {
            const examSessionName = normalizeString(exam.name);
            if (!examSessionName) return;

            const examAcademicYear = deriveAcademicYearFromDate(exam.date);
            if (academicYear && !isSameAcademicYear(examAcademicYear, academicYear)) {
                return;
            }

            const key = `${examSessionName}::${examAcademicYear}`;
            const existing = grouped.get(key) || {
                key,
                examName: examSessionName,
                academicYear: examAcademicYear,
                examType: 'Final',
                subjectCount: 0,
                subjectNames: new Set(),
                dateFrom: exam.date,
                dateTo: exam.date,
                totalExams: 0
            };

            const subjectName = normalizeString(exam.subjectId?.subjectName);
            if (subjectName) {
                existing.subjectNames.add(subjectName);
            }

            existing.totalExams += 1;
            existing.subjectCount = existing.subjectNames.size;

            const dateValue = exam.date ? new Date(exam.date) : null;
            if (dateValue && !Number.isNaN(dateValue.getTime())) {
                if (!existing.dateFrom || new Date(existing.dateFrom) > dateValue) {
                    existing.dateFrom = dateValue;
                }
                if (!existing.dateTo || new Date(existing.dateTo) < dateValue) {
                    existing.dateTo = dateValue;
                }
            }

            grouped.set(key, existing);
        });

        // Fallback for legacy/seeded datasets where Exam documents may not carry class linkage.
        if (!grouped.size) {
            const resultRows = await Result.find({
                schoolCode,
                studentClass: sourceClass.className,
                section: normalizeSection(sourceClass.section),
                isActive: { $ne: false }
            })
                .select('examName academicYear examDate subjects')
                .lean();

            resultRows.forEach((row) => {
                const examSessionName = normalizeString(row.examName);
                if (!examSessionName) return;

                const looksFinal = /final/i.test(examSessionName);
                if (!looksFinal) return;

                const rowAcademicYear = normalizeAcademicYear(row.academicYear) || deriveAcademicYearFromDate(row.examDate);
                if (academicYear && !isSameAcademicYear(rowAcademicYear, academicYear)) {
                    return;
                }

                const key = `${examSessionName}::${rowAcademicYear}`;
                const existing = grouped.get(key) || {
                    key,
                    examName: examSessionName,
                    academicYear: rowAcademicYear,
                    examType: 'Final',
                    subjectCount: 0,
                    subjectNames: new Set(),
                    dateFrom: row.examDate || null,
                    dateTo: row.examDate || null,
                    totalExams: 0
                };

                (row.subjects || []).forEach((subject) => {
                    const subjectName = normalizeString(subject.subjectName);
                    if (subjectName) {
                        existing.subjectNames.add(subjectName);
                    }
                });

                existing.totalExams += 1;
                existing.subjectCount = existing.subjectNames.size;

                const dateValue = row.examDate ? new Date(row.examDate) : null;
                if (dateValue && !Number.isNaN(dateValue.getTime())) {
                    if (!existing.dateFrom || new Date(existing.dateFrom) > dateValue) {
                        existing.dateFrom = dateValue;
                    }
                    if (!existing.dateTo || new Date(existing.dateTo) < dateValue) {
                        existing.dateTo = dateValue;
                    }
                }

                grouped.set(key, existing);
            });
        }

        const sessions = Array.from(grouped.values())
            .map((item) => ({
                key: item.key,
                examName: item.examName,
                academicYear: item.academicYear,
                examType: item.examType,
                subjectCount: item.subjectCount,
                subjectNames: Array.from(item.subjectNames),
                dateFrom: item.dateFrom,
                dateTo: item.dateTo,
                totalExams: item.totalExams
            }))
            .sort((a, b) => {
                if (a.academicYear !== b.academicYear) {
                    return normalizeString(b.academicYear).localeCompare(normalizeString(a.academicYear));
                }
                return a.examName.localeCompare(b.examName);
            });

        res.json({
            success: true,
            data: {
                class: {
                    _id: String(sourceClass._id),
                    className: sourceClass.className,
                    section: normalizeSection(sourceClass.section)
                },
                sessions
            }
        });
    } catch (error) {
        console.error('Get final exam sessions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get final exam sessions',
            error: error.message
        });
    }
};

// @desc    Get promotion preview from final exam results
// @route   GET /api/promotion/eligible
// @access  Private (Principal)
exports.getEligibleStudents = async (req, res) => {
    try {
        const { classId, targetClassId, examName, academicYear, passMark } = req.query;
        const schoolCode = req.user.schoolCode;

        if (!isValidObjectId(classId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid classId is required'
            });
        }

        if (!normalizeString(examName)) {
            return res.status(400).json({
                success: false,
                message: 'Final exam name is required'
            });
        }

        const sourceClass = await Class.findOne({
            _id: classId,
            schoolCode,
            isActive: true
        })
            .select('_id className section classLevel subjects')
            .lean();

        if (!sourceClass) {
            return res.status(404).json({
                success: false,
                message: 'Source class not found'
            });
        }

        let targetClass = null;
        if (targetClassId) {
            if (!isValidObjectId(targetClassId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid targetClassId'
                });
            }

            targetClass = await Class.findOne({
                _id: targetClassId,
                schoolCode,
                isActive: true
            })
                .select('_id className section classLevel')
                .lean();

            if (!targetClass) {
                return res.status(404).json({
                    success: false,
                    message: 'Target class not found'
                });
            }
        }

        const preview = await buildPromotionPreview({
            schoolCode,
            sourceClass,
            targetClass,
            examName: normalizeString(examName),
            academicYear: normalizeAcademicYear(academicYear),
            passMark: Number.isFinite(Number(passMark)) ? Number(passMark) : null
        });

        if (!preview.requiredSubjects.length) {
            return res.status(400).json({
                success: false,
                message: 'No required subjects found for the selected class/final exam. Assign class subjects or ensure final exam marks exist.'
            });
        }

        res.json({
            success: true,
            data: preview
        });
    } catch (error) {
        console.error('Get promotion preview error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate promotion preview',
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
            sourceClassId,
            targetClassId,
            examName,
            academicYear,
            overrideStudentIds = [],
            overrideApprovals = [],
            allowIncompleteOverride = false,
            passMark
        } = req.body;

        const schoolCode = req.user.schoolCode;
        const actorId = req.user._id;

        if (!isValidObjectId(sourceClassId) || !isValidObjectId(targetClassId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid sourceClassId and targetClassId are required'
            });
        }

        if (String(sourceClassId) === String(targetClassId)) {
            return res.status(400).json({
                success: false,
                message: 'Source and target class must be different'
            });
        }

        if (!normalizeString(examName)) {
            return res.status(400).json({
                success: false,
                message: 'Final exam name is required'
            });
        }

        const [sourceClass, targetClass] = await Promise.all([
            Class.findOne({ _id: sourceClassId, schoolCode, isActive: true })
                .select('_id className section classLevel subjects')
                .lean(),
            Class.findOne({ _id: targetClassId, schoolCode, isActive: true })
                .select('_id className section classLevel')
                .lean()
        ]);

        if (!sourceClass) {
            return res.status(404).json({ success: false, message: 'Source class not found' });
        }

        if (!targetClass) {
            return res.status(404).json({ success: false, message: 'Target class not found' });
        }

        const preview = await buildPromotionPreview({
            schoolCode,
            sourceClass,
            targetClass,
            examName: normalizeString(examName),
            academicYear: normalizeAcademicYear(academicYear),
            passMark: Number.isFinite(Number(passMark)) ? Number(passMark) : null
        });

        if (!preview.requiredSubjects.length) {
            return res.status(400).json({
                success: false,
                message: 'No required subject definition found for this class/final exam session'
            });
        }

        if (preview.summary.incompleteCount > 0 && !allowIncompleteOverride) {
            return res.status(400).json({
                success: false,
                message: 'Result completion check failed. Some students still have missing required subject marks. Enable principal special permission for incomplete records to continue.',
                data: {
                    incompleteStudents: preview.incomplete.map((row) => ({
                        _id: row._id,
                        name: row.name,
                        missingSubjectCount: row.missingSubjectCount
                    }))
                }
            });
        }

        const eligibleIds = preview.eligible.map((student) => student._id);
        const failedById = new Map(preview.failed.map((student) => [student._id, student]));
        const incompleteById = new Map(preview.incomplete.map((student) => [student._id, student]));

        const normalizedLegacyOverrideIds = [...new Set((overrideStudentIds || [])
            .map((value) => String(value))
            .filter((value) => failedById.has(value) || (allowIncompleteOverride && incompleteById.has(value))))];

        const normalizedApprovals = Array.isArray(overrideApprovals)
            ? overrideApprovals
                .filter((row) => row && row.studentId)
                .map((row) => ({
                    studentId: String(row.studentId),
                    reason: normalizeString(row.reason)
                }))
            : [];

        const manualOverrideById = new Map();

        normalizedApprovals.forEach((approval) => {
            if (failedById.has(approval.studentId)) {
                manualOverrideById.set(approval.studentId, {
                    category: 'failed',
                    reason: approval.reason || null
                });
                return;
            }

            if (incompleteById.has(approval.studentId)) {
                if (!allowIncompleteOverride) {
                    return;
                }
                manualOverrideById.set(approval.studentId, {
                    category: 'incomplete',
                    reason: approval.reason || null
                });
            }
        });

        normalizedLegacyOverrideIds.forEach((studentId) => {
            if (manualOverrideById.has(studentId)) return;

            if (failedById.has(studentId)) {
                manualOverrideById.set(studentId, {
                    category: 'failed',
                    reason: null
                });
                return;
            }

            if (allowIncompleteOverride && incompleteById.has(studentId)) {
                manualOverrideById.set(studentId, {
                    category: 'incomplete',
                    reason: null
                });
            }
        });

        const invalidRequestedApprovals = normalizedApprovals.filter((approval) => {
            const inFailed = failedById.has(approval.studentId);
            const inIncomplete = incompleteById.has(approval.studentId);
            return !(inFailed || (allowIncompleteOverride && inIncomplete));
        });

        if (invalidRequestedApprovals.length) {
            return res.status(400).json({
                success: false,
                message: 'Some requested principal special approvals are invalid for this promotion preview',
                data: {
                    invalidStudentIds: invalidRequestedApprovals.map((row) => row.studentId)
                }
            });
        }

        const promotedIds = [...new Set([...eligibleIds, ...Array.from(manualOverrideById.keys())])];

        if (!promotedIds.length) {
            return res.status(400).json({
                success: false,
                message: 'No students selected for promotion'
            });
        }

        const studentPreviewMap = new Map([
            ...preview.eligible.map((student) => [student._id, student]),
            ...preview.failed.map((student) => [student._id, student]),
            ...preview.incomplete.map((student) => [student._id, student])
        ]);

        const meritCandidates = promotedIds
            .map((studentId) => {
                const row = studentPreviewMap.get(studentId);
                const manualMeta = manualOverrideById.get(studentId) || null;
                return {
                    _id: studentId,
                    name: row?.name || '',
                    currentRoll: row?.currentRoll || '',
                    totalMarks: toFiniteNumber(row?.totalMarks, 0),
                    gpa: toFiniteNumber(row?.gpa, 0),
                    overrideApplied: Boolean(manualMeta),
                    overrideCategory: manualMeta?.category || null,
                    overrideReason: manualMeta?.reason || null
                };
            })
            .sort(buildMeritComparator())
            .map((row, index) => ({
                ...row,
                meritRank: index + 1
            }));

        const meritById = new Map(meritCandidates.map((row) => [row._id, row]));
        const promotedSet = new Set(promotedIds);
        const promotionBatchId = new mongoose.Types.ObjectId().toString();
        const now = new Date();

        const promotedBulkOps = meritCandidates.map((candidate, index) => ({
            updateOne: {
                filter: {
                    _id: candidate._id,
                    schoolCode,
                    isActive: true,
                    studentClass: sourceClass.className,
                    section: normalizeSection(sourceClass.section)
                },
                update: {
                    $set: {
                        studentClass: targetClass.className,
                        section: normalizeSection(targetClass.section),
                        roll: `TMP-${promotionBatchId.slice(-6)}-${index + 1}`,
                        updatedBy: actorId,
                        updatedAt: now
                    },
                    $push: {
                        academicHistory: {
                            academicYear: normalizeAcademicYear(academicYear) || String(now.getFullYear()),
                            className: sourceClass.className,
                            section: normalizeSection(sourceClass.section),
                            promotionDate: now,
                            promotedTo: targetClass.className,
                            promotedToSection: normalizeSection(targetClass.section),
                            examName: normalizeString(examName),
                            promotionType: candidate.overrideApplied ? 'manual' : 'passing',
                            manualApproval: candidate.overrideApplied,
                            manualApprovalReason: candidate.overrideReason || undefined,
                            manualApprovalCategory: candidate.overrideCategory || undefined,
                            manualApprovalBy: candidate.overrideApplied ? actorId : undefined,
                            manualApprovalAt: candidate.overrideApplied ? now : undefined
                        }
                    }
                }
            }
        }));

        if (promotedBulkOps.length) {
            await Student.bulkWrite(promotedBulkOps, { ordered: true });
        }

        const targetClassStudents = await Student.find({
            schoolCode,
            studentClass: targetClass.className,
            isActive: true
        })
            .select('_id name roll section')
            .lean();

        const promotedInTarget = targetClassStudents.filter((student) => promotedSet.has(String(student._id)));
        const retainedInTarget = targetClassStudents.filter((student) => !promotedSet.has(String(student._id)));

        promotedInTarget.sort((a, b) => {
            const left = meritById.get(String(a._id));
            const right = meritById.get(String(b._id));
            if (!left && !right) return 0;
            if (!left) return 1;
            if (!right) return -1;
            return left.meritRank - right.meritRank;
        });

        retainedInTarget.sort((a, b) => {
            const sectionA = normalizeSection(a.section);
            const sectionB = normalizeSection(b.section);
            const targetSection = normalizeSection(targetClass.section);
            const sectionPriority = (sectionA === targetSection ? 0 : 1) - (sectionB === targetSection ? 0 : 1);
            if (sectionPriority !== 0) return sectionPriority;

            const rollDiff = numericRollValue(a.roll) - numericRollValue(b.roll);
            if (rollDiff !== 0) return rollDiff;

            return normalizeString(a.name).localeCompare(normalizeString(b.name));
        });

        const finalRollAssignments = new Map();
        let nextRoll = 1;
        for (const student of promotedInTarget) {
            finalRollAssignments.set(String(student._id), String(nextRoll));
            nextRoll += 1;
        }
        for (const student of retainedInTarget) {
            finalRollAssignments.set(String(student._id), String(nextRoll));
            nextRoll += 1;
        }

        const temporaryRollOps = targetClassStudents.map((student, index) => ({
            updateOne: {
                filter: { _id: student._id, schoolCode, isActive: true },
                update: {
                    $set: {
                        roll: `TMPROLL-${promotionBatchId.slice(-6)}-${index + 1}`,
                        updatedBy: actorId,
                        updatedAt: now
                    }
                }
            }
        }));
        if (temporaryRollOps.length) {
            await Student.bulkWrite(temporaryRollOps, { ordered: true });
        }

        const finalRollOps = Array.from(finalRollAssignments.entries()).map(([studentId, roll]) => ({
            updateOne: {
                filter: { _id: studentId, schoolCode, isActive: true },
                update: {
                    $set: {
                        roll,
                        updatedBy: actorId,
                        updatedAt: now
                    }
                }
            }
        }));
        if (finalRollOps.length) {
            await Student.bulkWrite(finalRollOps, { ordered: true });
        }

        const userOps = Array.from(finalRollAssignments.entries()).map(([studentId, roll]) => {
            const isPromoted = promotedSet.has(studentId);
            return {
                updateOne: {
                    filter: {
                        _id: studentId,
                        schoolCode,
                        role: 'student'
                    },
                    update: {
                        $set: {
                            rollNumber: roll,
                            ...(isPromoted
                                ? {
                                    classId: targetClass._id,
                                    section: normalizeSection(targetClass.section)
                                }
                                : {})
                        }
                    }
                }
            };
        });
        if (userOps.length) {
            await User.bulkWrite(userOps, { ordered: false });
        }

        const [sourceCount, targetCount] = await Promise.all([
            Student.countDocuments({
                schoolCode,
                studentClass: sourceClass.className,
                section: normalizeSection(sourceClass.section),
                isActive: true
            }),
            Student.countDocuments({
                schoolCode,
                studentClass: targetClass.className,
                section: normalizeSection(targetClass.section),
                isActive: true
            })
        ]);

        await Promise.all([
            Class.updateOne(
                { _id: sourceClass._id, schoolCode },
                { $set: { currentStudents: sourceCount } }
            ),
            Class.updateOne(
                { _id: targetClass._id, schoolCode },
                { $set: { currentStudents: targetCount } }
            )
        ]);

        for (const candidate of meritCandidates) {
            try {
                await createNotification(
                    actorId,
                    'STUDENT_PROMOTED',
                    {
                        title: 'Student Promoted',
                        message: `${candidate.name} has been promoted from Class ${sourceClass.className} to Class ${targetClass.className}`
                    },
                    schoolCode
                );
            } catch (notificationError) {
                console.error('Promotion notification warning:', notificationError.message);
            }
        }

        const promotedStudents = meritCandidates.map((candidate) => ({
            studentId: candidate._id,
            name: candidate.name,
            meritRank: candidate.meritRank,
            totalMarks: candidate.totalMarks,
            gpa: candidate.gpa,
            overrideApplied: candidate.overrideApplied,
            newRoll: finalRollAssignments.get(candidate._id) || null,
            fromClass: sourceClass.className,
            toClass: targetClass.className,
            toSection: normalizeSection(targetClass.section)
        }));

        const retainedStudents = preview.failed
            .filter((student) => !manualOverrideById.has(student._id))
            .map((student) => ({
                studentId: student._id,
                name: student.name,
                reason: 'failed_required_subjects'
            }));

        const retainedIncompleteStudents = preview.incomplete
            .filter((student) => !manualOverrideById.has(student._id))
            .map((student) => ({
                studentId: student._id,
                name: student.name,
                reason: 'incomplete_result'
            }));

        const manualApprovals = meritCandidates
            .filter((candidate) => candidate.overrideApplied)
            .map((candidate) => ({
                studentId: candidate._id,
                name: candidate.name,
                category: candidate.overrideCategory,
                reason: candidate.overrideReason || null
            }));

        if (manualApprovals.length) {
            try {
                await AuditLog.create({
                    user: actorId,
                    action: 'PROMOTION_MANUAL_APPROVAL',
                    details: {
                        schoolCode,
                        sourceClassId: String(sourceClass._id),
                        targetClassId: String(targetClass._id),
                        examName: normalizeString(examName),
                        academicYear: normalizeAcademicYear(academicYear) || String(now.getFullYear()),
                        manualApprovals
                    }
                });
            } catch (auditError) {
                console.error('Promotion manual-approval audit warning:', auditError.message);
            }
        }

        try {
            await AuditLog.create({
                user: actorId,
                action: 'PROMOTION_FINALIZED',
                details: {
                    schoolCode,
                    sourceClassId: String(sourceClass._id),
                    targetClassId: String(targetClass._id),
                    examName: normalizeString(examName),
                    academicYear: normalizeAcademicYear(academicYear) || String(now.getFullYear()),
                    promotedCount: meritCandidates.length,
                    retainedFailedCount: retainedStudents.length,
                    retainedIncompleteCount: retainedIncompleteStudents.length,
                    manualApprovalCount: manualApprovals.length,
                    allowIncompleteOverride: Boolean(allowIncompleteOverride)
                }
            });
        } catch (auditError) {
            console.error('Promotion finalize audit warning:', auditError.message);
        }

        res.json({
            success: true,
            message: `Promotion finalized. ${promotedStudents.length} students moved to ${targetClass.className} ${normalizeSection(targetClass.section)}.`,
            data: {
                promotionWorkflow: {
                    sourceClass: `${sourceClass.className} ${normalizeSection(sourceClass.section)}`,
                    targetClass: `${targetClass.className} ${normalizeSection(targetClass.section)}`,
                    examName: normalizeString(examName),
                    academicYear: normalizeAcademicYear(academicYear) || String(now.getFullYear())
                },
                promotedStudents,
                retainedStudents,
                retainedIncompleteStudents,
                manualApprovals,
                summary: {
                    totalStudents: preview.summary.totalStudents,
                    promotedCount: promotedStudents.length,
                    retainedCount: retainedStudents.length + retainedIncompleteStudents.length,
                    retainedFailedCount: retainedStudents.length,
                    retainedIncompleteCount: retainedIncompleteStudents.length,
                    overrideCount: manualApprovals.length,
                    incompleteCount: preview.summary.incompleteCount
                },
                policy: {
                    allowIncompleteOverride: Boolean(allowIncompleteOverride),
                    manualApprovalScope: allowIncompleteOverride
                        ? ['failed', 'incomplete']
                        : ['failed']
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
            .select('_id className section classLevel capacity currentStudents')
            .sort({ classLevel: 1, className: 1, section: 1 })
            .lean();

        const normalizedClasses = classes.map((cls) => ({
            _id: String(cls._id),
            className: cls.className,
            section: normalizeSection(cls.section),
            classLevel: cls.classLevel,
            capacity: cls.capacity,
            currentStudents: cls.currentStudents,
            label: `${cls.className} ${normalizeSection(cls.section)}`
        }));

        const suggestions = normalizedClasses
            .map((cls) => {
                const nextClass = normalizedClasses.find((candidate) =>
                    candidate.classLevel === cls.classLevel + 1
                    && candidate.section === cls.section
                ) || normalizedClasses.find((candidate) => candidate.classLevel === cls.classLevel + 1);

                return {
                    fromClassId: cls._id,
                    fromClass: cls.className,
                    fromSection: cls.section,
                    toClassId: nextClass?._id || null,
                    toClass: nextClass?.className || null,
                    toSection: nextClass?.section || null
                };
            })
            .filter((item) => item.toClassId);

        res.json({
            success: true,
            data: {
                classes: normalizedClasses,
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

        if (!normalizeString(studentClass)) {
            return res.status(400).json({
                success: false,
                message: 'Class is required'
            });
        }

        const studentFilter = {
            schoolCode,
            studentClass: normalizeString(studentClass),
            isActive: true
        };
        if (normalizeString(section)) {
            studentFilter.section = normalizeSection(section);
        }

        const students = await Student.find(studentFilter)
            .select('_id name roll')
            .lean();

        const sorted = [...students].sort((a, b) => {
            const rollDiff = numericRollValue(a.roll) - numericRollValue(b.roll);
            if (rollDiff !== 0) return rollDiff;
            return normalizeString(a.name).localeCompare(normalizeString(b.name));
        });

        const startRoll = Math.max(1, Number.parseInt(String(startFrom), 10) || 1);

        const operations = sorted.map((student, index) => ({
            updateOne: {
                filter: { _id: student._id, schoolCode, isActive: true },
                update: {
                    $set: {
                        roll: String(startRoll + index),
                        updatedBy: req.user._id,
                        updatedAt: new Date()
                    }
                }
            }
        }));

        if (operations.length) {
            await Student.bulkWrite(operations, { ordered: true });
        }

        res.json({
            success: true,
            message: `Successfully renumbered ${sorted.length} students`,
            data: {
                count: sorted.length,
                startFrom: startRoll
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
