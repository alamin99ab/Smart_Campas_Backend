const mongoose = require('mongoose');
const Excel = require('exceljs');
const PDFDocument = require('pdfkit');

const School = require('../models/School');
const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Attendance = require('../models/Attendance');
const Result = require('../models/Result');
const Fee = require('../models/Fee');
const PaymentHistory = require('../models/PaymentHistory');
const Notice = require('../models/Notice');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');

const EXPORT_MAX_ROWS = Number(process.env.EXPORT_MAX_ROWS || 15000);
const EXPORT_MAX_ATTENDANCE_DOCS = Number(process.env.EXPORT_MAX_ATTENDANCE_DOCS || 2500);
const EXPORT_MAX_RANGE_DAYS = Number(process.env.EXPORT_MAX_RANGE_DAYS || 120);
const PDF_MAX_TABLE_ROWS = Number(process.env.PDF_MAX_TABLE_ROWS || 1200);
const FULL_SUMMARY_PREVIEW_LIMIT = Number(process.env.EXPORT_FULL_SUMMARY_PREVIEW_LIMIT || 250);
const EXPORT_TIMEOUT_MS = Number(process.env.EXPORT_TIMEOUT_MS || 300000); // 5 minutes
const EXPORT_MEMORY_THRESHOLD_MB = Number(process.env.EXPORT_MEMORY_THRESHOLD_MB || 500);

const SUPPORTED_FORMATS = new Set(['xlsx', 'pdf']);
const FEE_STATUSES = new Set(['Paid', 'Partial', 'Unpaid']);

class ExportServiceError extends Error {
    constructor(message, statusCode = 400, code = 'EXPORT_VALIDATION_ERROR') {
        super(message);
        this.name = 'ExportServiceError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

const checkMemoryUsage = () => {
    const memUsage = process.memoryUsage();
    const memUsedMB = memUsage.heapUsed / 1024 / 1024;
    
    if (memUsedMB > EXPORT_MEMORY_THRESHOLD_MB) {
        throw new ExportServiceError(
            `Export aborted due to high memory usage (${memUsedMB.toFixed(1)}MB > ${EXPORT_MEMORY_THRESHOLD_MB}MB). Try reducing date range or filters.`,
            503,
            'MEMORY_LIMIT_EXCEEDED'
        );
    }
    
    return memUsedMB;
};

const createExportTimeout = (timeoutMs = EXPORT_TIMEOUT_MS) => {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new ExportServiceError(
                `Export timed out after ${timeoutMs / 1000} seconds. Try reducing the data range.`,
                408,
                'EXPORT_TIMEOUT'
            ));
        }, timeoutMs);
    });
};

const toUpper = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');
const toTrimmed = (value) => (typeof value === 'string' ? value.trim() : '');
const toLower = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const formatDate = (value) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
};

const formatDateTime = (value) => {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${formatDate(date)} ${date.toTimeString().slice(0, 8)}`;
};

const monthLabel = (month, year) => {
    const monthNumber = Number(month);
    if (!Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
        return '';
    }
    const label = new Date(Number(year || 2000), monthNumber - 1, 1).toLocaleString('en-US', { month: 'long' });
    return year ? `${label} ${year}` : label;
};

const toObjectId = (value, fieldName) => {
    if (!value || !mongoose.Types.ObjectId.isValid(value)) {
        throw new ExportServiceError(`${fieldName} must be a valid ObjectId`, 400, 'INVALID_OBJECT_ID');
    }
    return value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value);
};

const parsePositiveInt = (value, fieldName, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        throw new ExportServiceError(
            `${fieldName} must be an integer between ${min} and ${max}`,
            400,
            'INVALID_NUMBER'
        );
    }
    return parsed;
};

const parseDateValue = (value, fieldName) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new ExportServiceError(`${fieldName} must be a valid date`, 400, 'INVALID_DATE');
    }
    return parsed;
};

const parseDateRange = (query = {}) => {
    const rawFrom = toTrimmed(query.from);
    const rawTo = toTrimmed(query.to);

    let from = null;
    let to = null;

    if (rawFrom || rawTo) {
        if (!rawFrom || !rawTo) {
            throw new ExportServiceError('Both from and to dates are required when filtering by date', 400, 'DATE_RANGE_REQUIRED');
        }
        from = parseDateValue(rawFrom, 'from');
        to = parseDateValue(rawTo, 'to');
        to.setHours(23, 59, 59, 999);
    } else {
        to = new Date();
        from = new Date();
        from.setDate(to.getDate() - 29);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
    }

    if (from > to) {
        throw new ExportServiceError('from date must be before or equal to to date', 400, 'INVALID_DATE_RANGE');
    }

    const rangeMs = to.getTime() - from.getTime();
    const rangeDays = Math.ceil(rangeMs / (1000 * 60 * 60 * 24));
    if (rangeDays > EXPORT_MAX_RANGE_DAYS) {
        throw new ExportServiceError(
            `Date range too large. Max allowed range is ${EXPORT_MAX_RANGE_DAYS} days`,
            413,
            'DATE_RANGE_TOO_LARGE'
        );
    }

    return { from, to };
};

const normalizeFormat = (formatValue) => {
    const normalized = toLower(formatValue || 'xlsx') || 'xlsx';
    if (!SUPPORTED_FORMATS.has(normalized)) {
        throw new ExportServiceError('Unsupported format. Allowed formats: xlsx, pdf', 400, 'INVALID_FORMAT');
    }
    return normalized;
};

const legacySchoolIdMissingFilter = {
    $or: [
        { schoolId: { $exists: false } },
        { schoolId: null },
        { schoolId: { $type: 'string' } }
    ]
};

const buildSchoolScopeFilter = (scope, { allowSchoolCodeFallback = true } = {}) => {
    const orFilters = [];

    if (scope.schoolId) {
        orFilters.push({ schoolId: scope.schoolId });
    }

    if (allowSchoolCodeFallback && scope.schoolCode) {
        orFilters.push({
            schoolCode: scope.schoolCode,
            ...legacySchoolIdMissingFilter
        });
    }

    if (!orFilters.length) {
        throw new ExportServiceError('School scope is missing for export', 403, 'SCHOOL_SCOPE_REQUIRED');
    }

    return orFilters.length === 1 ? orFilters[0] : { $or: orFilters };
};

const mergeFilters = (scopeFilter, extraFilter = {}) => {
    if (!extraFilter || !Object.keys(extraFilter).length) {
        return scopeFilter;
    }
    return { $and: [scopeFilter, extraFilter] };
};

const ensureNotTooManyRows = (rows, label) => {
    if (rows.length > EXPORT_MAX_ROWS) {
        throw new ExportServiceError(
            `${label} export exceeded safe row limit (${EXPORT_MAX_ROWS}). Apply tighter filters and retry.`,
            413,
            'EXPORT_TOO_LARGE'
        );
    }
};

const enrichSchoolContext = async (scope) => {
    if (scope.schoolName) return scope;

    const school = await School.findOne(
        scope.schoolId ? { _id: scope.schoolId } : { schoolCode: scope.schoolCode }
    ).select('_id schoolCode schoolName').lean();

    if (!school) {
        throw new ExportServiceError('School not found for export scope', 404, 'SCHOOL_NOT_FOUND');
    }

    return {
        ...scope,
        schoolId: school._id,
        schoolCode: school.schoolCode,
        schoolName: school.schoolName
    };
};

const resolveSchoolScope = async ({ user, tenant, query }) => {
    if (!user) {
        throw new ExportServiceError('Unauthorized export request', 401, 'UNAUTHORIZED');
    }

    if (user.role === 'super_admin') {
        const schoolIdInput = toTrimmed(query.schoolId || query.targetSchoolId);
        const schoolCodeInput = toUpper(query.schoolCode || query.targetSchoolCode);

        if (!schoolIdInput && !schoolCodeInput) {
            throw new ExportServiceError(
                'Super admin export requires schoolId or schoolCode parameter',
                400,
                'SCHOOL_SELECTION_REQUIRED'
            );
        }

        let school = null;
        if (schoolIdInput && mongoose.Types.ObjectId.isValid(schoolIdInput)) {
            school = await School.findById(schoolIdInput).select('_id schoolCode schoolName').lean();
        }

        if (!school && schoolCodeInput) {
            school = await School.findOne({ schoolCode: schoolCodeInput }).select('_id schoolCode schoolName').lean();
        }

        if (!school) {
            throw new ExportServiceError('Selected school not found', 404, 'SCHOOL_NOT_FOUND');
        }

        return {
            schoolId: school._id,
            schoolCode: school.schoolCode,
            schoolName: school.schoolName,
            selectedBySuperAdmin: true
        };
    }

    const schoolId = tenant?.schoolId || user.schoolId || null;
    const schoolCode = toUpper(tenant?.schoolCode || user.schoolCode);
    const schoolName = tenant?.schoolName || user.schoolName || '';

    if (!schoolId && !schoolCode) {
        throw new ExportServiceError('School context missing for export', 403, 'SCHOOL_SCOPE_REQUIRED');
    }

    return enrichSchoolContext({
        schoolId: schoolId ? toObjectId(schoolId, 'schoolId') : null,
        schoolCode,
        schoolName
    });
};

const buildStudentRows = async (scope, query) => {
    const scopeFilter = buildSchoolScopeFilter(scope);

    const extraFilter = {};
    const classId = toTrimmed(query.classId);
    const studentClass = toTrimmed(query.class || query.studentClass);
    const section = toUpper(query.section);
    const includeInactive = toLower(query.includeInactive) === 'true';

    if (classId) {
        extraFilter.classId = toObjectId(classId, 'classId');
    }
    if (studentClass) {
        extraFilter.studentClass = studentClass;
    }
    if (section) {
        extraFilter.section = section;
    }
    if (!includeInactive) {
        extraFilter.isActive = true;
    }

    const students = await Student.find(mergeFilters(scopeFilter, extraFilter))
        .select('name roll studentId studentClass section classId sectionId gender phone guardian fatherName motherName createdAt userId isActive')
        .populate('classId', 'className section')
        .populate('sectionId', 'sectionName')
        .sort({ createdAt: -1 })
        .limit(EXPORT_MAX_ROWS + 1)
        .lean();

    ensureNotTooManyRows(students, 'Students');

    // Batch user lookup to avoid N+1 queries
    const userIds = Array.from(
        new Set(
            students
                .map((student) => student.userId || student._id)
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
                .map((id) => id.toString())
        )
    ).map((id) => new mongoose.Types.ObjectId(id));

    const studentUserFilter = mergeFilters(
        buildSchoolScopeFilter(scope),
        { role: 'student', _id: { $in: userIds } }
    );
    const users = userIds.length
        ? await User.find(studentUserFilter).select('_id email phone').lean()
        : [];
    const userMap = new Map(users.map((user) => [String(user._id), user]));

    const rows = students.map((student, index) => {
        const linkedUser = userMap.get(String(student.userId || student._id)) || {};
        const className = student.classId?.className || student.studentClass || '';
        const classSection = student.classId?.section || student.section || '';
        const sectionName = student.sectionId?.sectionName || classSection || '';

        return {
            sl: index + 1,
            studentName: student.name || '',
            studentId: student.studentId || '',
            roll: student.roll || '',
            class: className,
            section: sectionName,
            gender: student.gender || '',
            guardianName: student.guardian?.name || student.fatherName || '',
            guardianPhone: student.guardian?.phone || student.phone || linkedUser.phone || '',
            guardianEmail: student.guardian?.email || '',
            email: linkedUser.email || '',
            admissionDate: formatDate(student.createdAt),
            status: student.isActive ? 'Active' : 'Inactive'
        };
    });

    const activeCount = rows.filter((row) => row.status === 'Active').length;
    const inactiveCount = rows.length - activeCount;

    return {
        title: 'Students Backup Export',
        fileBaseName: 'students_backup',
        filters: {
            classId: classId || undefined,
            class: studentClass || undefined,
            section: section || undefined,
            includeInactive
        },
        summaryLines: [
            `Total students: ${rows.length}`,
            `Active students: ${activeCount}`,
            `Inactive students: ${inactiveCount}`
        ],
        excelSheets: [
            {
                name: 'Students',
                columns: [
                    { header: 'SL', key: 'sl', width: 8 },
                    { header: 'Student Name', key: 'studentName', width: 30 },
                    { header: 'Student ID', key: 'studentId', width: 18 },
                    { header: 'Roll', key: 'roll', width: 12 },
                    { header: 'Class', key: 'class', width: 15 },
                    { header: 'Section', key: 'section', width: 12 },
                    { header: 'Gender', key: 'gender', width: 12 },
                    { header: 'Guardian Name', key: 'guardianName', width: 24 },
                    { header: 'Guardian Phone', key: 'guardianPhone', width: 18 },
                    { header: 'Guardian Email', key: 'guardianEmail', width: 28 },
                    { header: 'Student Email', key: 'email', width: 28 },
                    { header: 'Admission Date', key: 'admissionDate', width: 15 },
                    { header: 'Status', key: 'status', width: 12 }
                ],
                rows
            }
        ],
        pdf: {
            columns: [
                { header: 'Name', key: 'studentName', width: 140 },
                { header: 'Roll', key: 'roll', width: 45 },
                { header: 'Class', key: 'class', width: 70 },
                { header: 'Section', key: 'section', width: 55 },
                { header: 'Guardian', key: 'guardianName', width: 120 },
                { header: 'Phone', key: 'guardianPhone', width: 90 }
            ],
            rows
        }
    };
};

const buildTeacherRows = async (scope, query) => {
    const scopeFilter = buildSchoolScopeFilter(scope);
    const includeInactive = toLower(query.includeInactive) === 'true';

    const teachers = await User.find(mergeFilters(scopeFilter, {
        role: 'teacher',
        ...(includeInactive ? {} : { isActive: true })
    }))
        .select('_id name email phone subjects classes createdAt isActive')
        .sort({ createdAt: -1 })
        .limit(EXPORT_MAX_ROWS + 1)
        .lean();

    ensureNotTooManyRows(teachers, 'Teachers');

    const profileFilter = mergeFilters(
        buildSchoolScopeFilter(scope),
        { userId: { $in: teachers.map((teacher) => teacher._id) } }
    );
    const teacherProfiles = teachers.length
        ? await Teacher.find(profileFilter)
            .select('userId employeeId qualification joiningDate subjects subjectAssignments isActive')
            .lean()
        : [];
    const profileMap = new Map(teacherProfiles.map((profile) => [String(profile.userId), profile]));

    const rows = teachers.map((teacher, index) => {
        const profile = profileMap.get(String(teacher._id)) || {};
        const assignmentNames = (profile.subjectAssignments || [])
            .map((assignment) => assignment.subjectName)
            .filter(Boolean);
        const subjectList = assignmentNames.length
            ? assignmentNames
            : (profile.subjects?.length ? profile.subjects : (teacher.subjects || []));

        const status = (teacher.isActive === false || profile.isActive === false) ? 'Inactive' : 'Active';

        return {
            sl: index + 1,
            teacherName: teacher.name || '',
            employeeId: profile.employeeId || '',
            email: teacher.email || '',
            phone: teacher.phone || '',
            qualification: profile.qualification || '',
            joiningDate: formatDate(profile.joiningDate || teacher.createdAt),
            assignedSubjects: subjectList.join(', '),
            status
        };
    });

    return {
        title: 'Teachers Backup Export',
        fileBaseName: 'teachers_backup',
        filters: { includeInactive },
        summaryLines: [
            `Total teachers: ${rows.length}`,
            `Active teachers: ${rows.filter((row) => row.status === 'Active').length}`,
            `Inactive teachers: ${rows.filter((row) => row.status === 'Inactive').length}`
        ],
        excelSheets: [
            {
                name: 'Teachers',
                columns: [
                    { header: 'SL', key: 'sl', width: 8 },
                    { header: 'Teacher Name', key: 'teacherName', width: 28 },
                    { header: 'Employee ID', key: 'employeeId', width: 16 },
                    { header: 'Email', key: 'email', width: 30 },
                    { header: 'Phone', key: 'phone', width: 18 },
                    { header: 'Qualification', key: 'qualification', width: 20 },
                    { header: 'Joining Date', key: 'joiningDate', width: 15 },
                    { header: 'Assigned Subjects', key: 'assignedSubjects', width: 42 },
                    { header: 'Status', key: 'status', width: 12 }
                ],
                rows
            }
        ],
        pdf: {
            columns: [
                { header: 'Name', key: 'teacherName', width: 130 },
                { header: 'Employee ID', key: 'employeeId', width: 75 },
                { header: 'Phone', key: 'phone', width: 85 },
                { header: 'Qualification', key: 'qualification', width: 115 },
                { header: 'Status', key: 'status', width: 65 }
            ],
            rows
        }
    };
};

const buildAttendanceRows = async (scope, query) => {
    const scopeFilter = buildSchoolScopeFilter(scope);
    const section = toUpper(query.section);
    const studentClass = toTrimmed(query.class || query.studentClass);
    const { from, to } = parseDateRange(query);

    const attendanceFilter = {
        date: { $gte: from, $lte: to },
        ...(section ? { section } : {}),
        ...(studentClass ? { studentClass } : {})
    };

    // Memory-safe attendance document fetching with batching
    const attendanceDocs = await Attendance.find(mergeFilters(scopeFilter, attendanceFilter))
        .select('date studentClass section subject records')
        .sort({ date: 1, studentClass: 1, section: 1 })
        .limit(EXPORT_MAX_ATTENDANCE_DOCS + 1)
        .lean();

    if (attendanceDocs.length > EXPORT_MAX_ATTENDANCE_DOCS) {
        throw new ExportServiceError(
            `Attendance source data too large. Please reduce date range or class/section filters (max ${EXPORT_MAX_ATTENDANCE_DOCS} daily records per export).`,
            413,
            'EXPORT_TOO_LARGE'
        );
    }

    // Batch student lookup to reduce memory pressure
    const studentIds = Array.from(
        new Set(
            attendanceDocs.flatMap((doc) => (doc.records || [])
                .map((record) => record.studentId)
                .filter((id) => mongoose.Types.ObjectId.isValid(id))
                .map((id) => id.toString()))
        )
    ).map((id) => new mongoose.Types.ObjectId(id));

    const students = studentIds.length
        ? await Student.find(mergeFilters(scopeFilter, { _id: { $in: studentIds } }))
            .select('_id name roll studentClass section')
            .lean()
        : [];
    const studentMap = new Map(students.map((student) => [String(student._id), student]));

    // Process attendance records in batches to prevent memory issues
    const rows = [];
    const BATCH_SIZE = 500;
    
    for (let i = 0; i < attendanceDocs.length; i += BATCH_SIZE) {
        const batch = attendanceDocs.slice(i, i + BATCH_SIZE);
        
        batch.forEach((doc) => {
            (doc.records || []).forEach((record) => {
                const student = studentMap.get(String(record.studentId)) || {};
                rows.push({
                    date: formatDate(doc.date),
                    class: doc.studentClass || student.studentClass || '',
                    section: doc.section || student.section || '',
                    subject: doc.subject || '',
                    studentName: student.name || '',
                    roll: student.roll || '',
                    status: record.status || '',
                    remarks: record.remarks || ''
                });
            });
        });
        
        // Check memory usage during processing
        if (i % (BATCH_SIZE * 2) === 0) {
            checkMemoryUsage();
        }
    }

    ensureNotTooManyRows(rows, 'Attendance');

    const statusCounts = rows.reduce((acc, row) => {
        const key = row.status || 'Unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    return {
        title: 'Attendance Backup Export',
        fileBaseName: 'attendance_backup',
        filters: {
            from: formatDate(from),
            to: formatDate(to),
            class: studentClass || undefined,
            section: section || undefined
        },
        summaryLines: [
            `Attendance entries: ${rows.length}`,
            ...Object.entries(statusCounts).map(([status, count]) => `${status}: ${count}`)
        ],
        excelSheets: [
            {
                name: 'Attendance',
                columns: [
                    { header: 'Date', key: 'date', width: 14 },
                    { header: 'Class', key: 'class', width: 14 },
                    { header: 'Section', key: 'section', width: 12 },
                    { header: 'Subject', key: 'subject', width: 20 },
                    { header: 'Student Name', key: 'studentName', width: 28 },
                    { header: 'Roll', key: 'roll', width: 12 },
                    { header: 'Status', key: 'status', width: 12 },
                    { header: 'Remarks', key: 'remarks', width: 30 }
                ],
                rows
            }
        ],
        pdf: {
            columns: [
                { header: 'Date', key: 'date', width: 70 },
                { header: 'Class', key: 'class', width: 55 },
                { header: 'Sec', key: 'section', width: 40 },
                { header: 'Student', key: 'studentName', width: 120 },
                { header: 'Roll', key: 'roll', width: 45 },
                { header: 'Status', key: 'status', width: 60 },
                { header: 'Subject', key: 'subject', width: 100 }
            ],
            rows
        }
    };
};

const buildResultRows = async (scope, query) => {
    const scopeFilter = buildSchoolScopeFilter(scope);
    const examId = toTrimmed(query.examId);
    const examName = toTrimmed(query.examName);
    const section = toUpper(query.section);
    const studentClass = toTrimmed(query.class || query.studentClass);

    const resultFilter = {
        isActive: true,
        ...(examName ? { examName } : {}),
        ...(section ? { section } : {}),
        ...(studentClass ? { studentClass } : {})
    };

    if (examId) {
        resultFilter.examId = toObjectId(examId, 'examId');
    }

    const rawFrom = toTrimmed(query.from);
    const rawTo = toTrimmed(query.to);
    if (rawFrom || rawTo) {
        const { from, to } = parseDateRange(query);
        resultFilter.examDate = { $gte: from, $lte: to };
    }

    const results = await Result.find(mergeFilters(scopeFilter, resultFilter))
        .select('studentId studentClass section roll examName examDate subjects totalMarks gpa remarks isPublished academicYear')
        .sort({ examDate: -1, createdAt: -1 })
        .limit(EXPORT_MAX_ROWS + 1)
        .lean();

    ensureNotTooManyRows(results, 'Results');

    const studentIds = Array.from(
        new Set(results
            .map((result) => result.studentId)
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
            .map((id) => id.toString()))
    ).map((id) => new mongoose.Types.ObjectId(id));

    const students = studentIds.length
        ? await Student.find(mergeFilters(scopeFilter, { _id: { $in: studentIds } }))
            .select('_id name roll studentClass section')
            .lean()
        : [];
    const studentMap = new Map(students.map((student) => [String(student._id), student]));

    const rows = results.map((result, index) => {
        const student = studentMap.get(String(result.studentId)) || {};
        const subjectSummary = (result.subjects || [])
            .map((subject) => `${subject.subjectName}: ${subject.marks}${subject.grade ? ` (${subject.grade})` : ''}`)
            .join('; ');

        return {
            sl: index + 1,
            exam: result.examName || '',
            examDate: formatDate(result.examDate),
            class: result.studentClass || student.studentClass || '',
            section: result.section || student.section || '',
            studentName: student.name || '',
            roll: String(result.roll ?? student.roll ?? ''),
            subjectSummary,
            totalMarks: Number(result.totalMarks || 0),
            gpa: Number(result.gpa || 0).toFixed(2),
            published: result.isPublished ? 'Published' : 'Draft',
            remarks: result.remarks || ''
        };
    });

    const gpaValues = rows.map((row) => Number(row.gpa)).filter((value) => Number.isFinite(value));
    const avgGpa = gpaValues.length
        ? (gpaValues.reduce((sum, value) => sum + value, 0) / gpaValues.length).toFixed(2)
        : '0.00';

    return {
        title: 'Results Backup Export',
        fileBaseName: 'results_backup',
        filters: {
            examId: examId || undefined,
            examName: examName || undefined,
            class: studentClass || undefined,
            section: section || undefined,
            from: rawFrom || undefined,
            to: rawTo || undefined
        },
        summaryLines: [
            `Total results: ${rows.length}`,
            `Published results: ${rows.filter((row) => row.published === 'Published').length}`,
            `Average GPA: ${avgGpa}`
        ],
        excelSheets: [
            {
                name: 'Results',
                columns: [
                    { header: 'SL', key: 'sl', width: 8 },
                    { header: 'Exam', key: 'exam', width: 20 },
                    { header: 'Exam Date', key: 'examDate', width: 14 },
                    { header: 'Class', key: 'class', width: 14 },
                    { header: 'Section', key: 'section', width: 12 },
                    { header: 'Student Name', key: 'studentName', width: 26 },
                    { header: 'Roll', key: 'roll', width: 12 },
                    { header: 'Subjects', key: 'subjectSummary', width: 50 },
                    { header: 'Total Marks', key: 'totalMarks', width: 14 },
                    { header: 'GPA', key: 'gpa', width: 10 },
                    { header: 'Published', key: 'published', width: 12 },
                    { header: 'Remarks', key: 'remarks', width: 30 }
                ],
                rows
            }
        ],
        pdf: {
            columns: [
                { header: 'Exam', key: 'exam', width: 100 },
                { header: 'Date', key: 'examDate', width: 60 },
                { header: 'Class', key: 'class', width: 52 },
                { header: 'Sec', key: 'section', width: 36 },
                { header: 'Student', key: 'studentName', width: 112 },
                { header: 'Total', key: 'totalMarks', width: 45 },
                { header: 'GPA', key: 'gpa', width: 40 },
                { header: 'State', key: 'published', width: 60 }
            ],
            rows
        }
    };
};

const buildFeeRows = async (scope, query) => {
    const scopeFilter = buildSchoolScopeFilter(scope);
    const section = toUpper(query.section);
    const studentClass = toTrimmed(query.class || query.studentClass);
    const status = toTrimmed(query.status);
    const monthRaw = toTrimmed(query.month);
    const yearRaw = toTrimmed(query.year);

    const feeFilter = {};
    if (status) {
        if (!FEE_STATUSES.has(status)) {
            throw new ExportServiceError('status must be Paid, Partial, or Unpaid', 400, 'INVALID_FEE_STATUS');
        }
        feeFilter.status = status;
    }

    if (monthRaw || yearRaw) {
        if (!monthRaw || !yearRaw) {
            throw new ExportServiceError('Both month and year are required for period-based fee export', 400, 'MONTH_YEAR_REQUIRED');
        }
        feeFilter.month = parsePositiveInt(monthRaw, 'month', { min: 1, max: 12 });
        feeFilter.year = parsePositiveInt(yearRaw, 'year', { min: 2000, max: 2100 });
    }

    let scopedStudentIds = null;
    if (studentClass || section) {
        const studentFilter = {
            ...(studentClass ? { studentClass } : {}),
            ...(section ? { section } : {})
        };
        const scopedStudents = await Student.find(mergeFilters(scopeFilter, studentFilter)).select('_id').lean();
        scopedStudentIds = scopedStudents.map((student) => student._id);
        feeFilter.studentId = { $in: scopedStudentIds };
    }

    const fees = await Fee.find(mergeFilters(scopeFilter, feeFilter))
        .select('studentId month year amountDue amountPaid status updatedAt')
        .sort({ year: -1, month: -1, updatedAt: -1 })
        .limit(EXPORT_MAX_ROWS + 1)
        .lean();

    ensureNotTooManyRows(fees, 'Fees');

    const studentIds = Array.from(
        new Set(fees
            .map((fee) => fee.studentId)
            .filter((id) => mongoose.Types.ObjectId.isValid(id))
            .map((id) => id.toString()))
    ).map((id) => new mongoose.Types.ObjectId(id));

    const students = studentIds.length
        ? await Student.find(mergeFilters(scopeFilter, { _id: { $in: studentIds } }))
            .select('_id name roll studentClass section guardian phone')
            .lean()
        : [];
    const studentMap = new Map(students.map((student) => [String(student._id), student]));

    const rows = fees.map((fee, index) => {
        const student = studentMap.get(String(fee.studentId)) || {};
        const amountDue = Number(fee.amountDue || 0);
        const amountPaid = Number(fee.amountPaid || 0);
        const dueAmount = Math.max(0, amountDue - amountPaid);

        return {
            sl: index + 1,
            month: monthLabel(fee.month, fee.year),
            studentName: student.name || '',
            roll: student.roll || '',
            class: student.studentClass || '',
            section: student.section || '',
            phone: student.guardian?.phone || student.phone || '',
            amountDue,
            amountPaid,
            dueAmount,
            status: fee.status || '',
            lastUpdated: formatDateTime(fee.updatedAt)
        };
    });

    const paymentAggregation = await PaymentHistory.aggregate([
        { $match: mergeFilters(scopeFilter, monthRaw && yearRaw ? { month: Number(monthRaw), year: Number(yearRaw) } : {}) },
        {
            $group: {
                _id: null,
                totalCollected: { $sum: '$amount' },
                totalPayments: { $sum: 1 }
            }
        }
    ]);

    const totals = rows.reduce((acc, row) => {
        acc.totalDue += row.amountDue;
        acc.totalPaid += row.amountPaid;
        acc.totalOutstanding += row.dueAmount;
        return acc;
    }, { totalDue: 0, totalPaid: 0, totalOutstanding: 0 });

    const paymentSummary = paymentAggregation[0] || { totalCollected: 0, totalPayments: 0 };

    return {
        title: 'Fees Backup Export',
        fileBaseName: 'fees_backup',
        filters: {
            class: studentClass || undefined,
            section: section || undefined,
            status: status || undefined,
            month: monthRaw || undefined,
            year: yearRaw || undefined,
            ...(scopedStudentIds ? { filteredStudents: scopedStudentIds.length } : {})
        },
        summaryLines: [
            `Fee rows: ${rows.length}`,
            `Total due amount: ${totals.totalDue.toFixed(2)}`,
            `Total paid amount: ${totals.totalPaid.toFixed(2)}`,
            `Total outstanding: ${totals.totalOutstanding.toFixed(2)}`,
            `Payment history collected amount: ${Number(paymentSummary.totalCollected || 0).toFixed(2)}`,
            `Payment transactions: ${Number(paymentSummary.totalPayments || 0)}`
        ],
        excelSheets: [
            {
                name: 'Fees',
                columns: [
                    { header: 'SL', key: 'sl', width: 8 },
                    { header: 'Month', key: 'month', width: 18 },
                    { header: 'Student Name', key: 'studentName', width: 28 },
                    { header: 'Roll', key: 'roll', width: 10 },
                    { header: 'Class', key: 'class', width: 14 },
                    { header: 'Section', key: 'section', width: 10 },
                    { header: 'Phone', key: 'phone', width: 18 },
                    { header: 'Amount Due', key: 'amountDue', width: 14 },
                    { header: 'Amount Paid', key: 'amountPaid', width: 14 },
                    { header: 'Due Amount', key: 'dueAmount', width: 14 },
                    { header: 'Status', key: 'status', width: 12 },
                    { header: 'Last Updated', key: 'lastUpdated', width: 22 }
                ],
                rows
            }
        ],
        pdf: {
            columns: [
                { header: 'Month', key: 'month', width: 90 },
                { header: 'Student', key: 'studentName', width: 125 },
                { header: 'Class', key: 'class', width: 50 },
                { header: 'Sec', key: 'section', width: 35 },
                { header: 'Due', key: 'amountDue', width: 55 },
                { header: 'Paid', key: 'amountPaid', width: 55 },
                { header: 'Outstanding', key: 'dueAmount', width: 70 },
                { header: 'Status', key: 'status', width: 60 }
            ],
            rows
        }
    };
};

const buildNoticeRows = async (scope, query) => {
    const scopeFilter = buildSchoolScopeFilter(scope);
    const includeDeleted = toLower(query.includeDeleted) === 'true';

    const noticeFilter = {
        isGlobal: { $ne: true },
        ...(includeDeleted ? {} : { isDeleted: false })
    };

    const notices = await Notice.find(mergeFilters(scopeFilter, noticeFilter))
        .select('title noticeType priority status publishDate expiryDate isPublished isPublic createdAt')
        .sort({ publishDate: -1, createdAt: -1 })
        .limit(EXPORT_MAX_ROWS + 1)
        .lean();

    ensureNotTooManyRows(notices, 'Notices');

    const rows = notices.map((notice, index) => ({
        sl: index + 1,
        title: notice.title || '',
        type: notice.noticeType || '',
        priority: notice.priority || '',
        status: notice.status || '',
        published: notice.isPublished ? 'Yes' : 'No',
        public: notice.isPublic ? 'Yes' : 'No',
        publishDate: formatDate(notice.publishDate),
        expiryDate: formatDate(notice.expiryDate)
    }));

    return {
        title: 'Notices Backup Export',
        fileBaseName: 'notices_backup',
        filters: { includeDeleted },
        summaryLines: [
            `Total notices: ${rows.length}`,
            `Published notices: ${rows.filter((row) => row.published === 'Yes').length}`
        ],
        excelSheets: [
            {
                name: 'Notices',
                columns: [
                    { header: 'SL', key: 'sl', width: 8 },
                    { header: 'Title', key: 'title', width: 50 },
                    { header: 'Type', key: 'type', width: 16 },
                    { header: 'Priority', key: 'priority', width: 12 },
                    { header: 'Status', key: 'status', width: 14 },
                    { header: 'Published', key: 'published', width: 12 },
                    { header: 'Public', key: 'public', width: 10 },
                    { header: 'Publish Date', key: 'publishDate', width: 14 },
                    { header: 'Expiry Date', key: 'expiryDate', width: 14 }
                ],
                rows
            }
        ],
        pdf: {
            columns: [
                { header: 'Title', key: 'title', width: 230 },
                { header: 'Type', key: 'type', width: 70 },
                { header: 'Priority', key: 'priority', width: 60 },
                { header: 'Status', key: 'status', width: 70 },
                { header: 'Publish', key: 'publishDate', width: 90 }
            ],
            rows
        }
    };
};

const buildFullSummaryRows = async (scope) => {
    const studentScopeFilter = buildSchoolScopeFilter(scope);
    const userScopeFilter = buildSchoolScopeFilter(scope);
    const classScopeFilter = buildSchoolScopeFilter(scope);
    const sectionScopeFilter = buildSchoolScopeFilter(scope);
    const subjectScopeFilter = buildSchoolScopeFilter(scope);
    const noticeScopeFilter = buildSchoolScopeFilter(scope);
    const attendanceScopeFilter = buildSchoolScopeFilter(scope);
    const resultScopeFilter = buildSchoolScopeFilter(scope);
    const feeScopeFilter = buildSchoolScopeFilter(scope);
    const paymentScopeFilter = buildSchoolScopeFilter(scope);

    const now = new Date();
    const last30 = new Date(now);
    last30.setDate(now.getDate() - 29);
    last30.setHours(0, 0, 0, 0);

    const last90 = new Date(now);
    last90.setDate(now.getDate() - 89);
    last90.setHours(0, 0, 0, 0);

    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const [studentCount, teacherCount, classCount, sectionCount, subjectCount, noticeCount] = await Promise.all([
        Student.countDocuments(studentScopeFilter),
        User.countDocuments(mergeFilters(userScopeFilter, { role: 'teacher' })),
        ClassModel.countDocuments(classScopeFilter),
        Section.countDocuments(sectionScopeFilter),
        Subject.countDocuments(subjectScopeFilter),
        Notice.countDocuments(mergeFilters(noticeScopeFilter, { isDeleted: false, isGlobal: { $ne: true } }))
    ]);

    const [attendanceAgg, resultAgg, feeAgg, paymentAgg, recentStudents, recentTeachers, recentResults] = await Promise.all([
        Attendance.aggregate([
            { $match: mergeFilters(attendanceScopeFilter, { date: { $gte: last30, $lte: now } }) },
            { $unwind: '$records' },
            { $group: { _id: '$records.status', count: { $sum: 1 } } }
        ]),
        Result.aggregate([
            { $match: mergeFilters(resultScopeFilter, { examDate: { $gte: last90, $lte: now }, isActive: true }) },
            {
                $group: {
                    _id: null,
                    totalResults: { $sum: 1 },
                    publishedResults: {
                        $sum: { $cond: [{ $eq: ['$isPublished', true] }, 1, 0] }
                    },
                    avgGpa: { $avg: '$gpa' }
                }
            }
        ]),
        Fee.aggregate([
            { $match: mergeFilters(feeScopeFilter, { month, year }) },
            {
                $group: {
                    _id: null,
                    totalRows: { $sum: 1 },
                    totalDue: { $sum: '$amountDue' },
                    totalPaid: { $sum: '$amountPaid' },
                    totalOutstanding: { $sum: { $max: [0, { $subtract: ['$amountDue', '$amountPaid'] }] } }
                }
            }
        ]),
        PaymentHistory.aggregate([
            { $match: mergeFilters(paymentScopeFilter, { month, year }) },
            {
                $group: {
                    _id: null,
                    paymentTransactions: { $sum: 1 },
                    paymentCollected: { $sum: '$amount' }
                }
            }
        ]),
        Student.find(studentScopeFilter)
            .select('name roll studentClass section createdAt')
            .sort({ createdAt: -1 })
            .limit(FULL_SUMMARY_PREVIEW_LIMIT)
            .lean(),
        User.find(mergeFilters(userScopeFilter, { role: 'teacher' }))
            .select('name email phone isActive createdAt')
            .sort({ createdAt: -1 })
            .limit(FULL_SUMMARY_PREVIEW_LIMIT)
            .lean(),
        Result.find(mergeFilters(resultScopeFilter, { isActive: true }))
            .select('examName examDate studentClass section totalMarks gpa isPublished')
            .sort({ examDate: -1, createdAt: -1 })
            .limit(FULL_SUMMARY_PREVIEW_LIMIT)
            .lean()
    ]);

    const attendanceStatusMap = attendanceAgg.reduce((acc, row) => {
        acc[row._id || 'Unknown'] = row.count;
        return acc;
    }, {});
    const resultSummary = resultAgg[0] || { totalResults: 0, publishedResults: 0, avgGpa: 0 };
    const feeSummary = feeAgg[0] || { totalRows: 0, totalDue: 0, totalPaid: 0, totalOutstanding: 0 };
    const paymentSummary = paymentAgg[0] || { paymentTransactions: 0, paymentCollected: 0 };

    const overviewRows = [
        { metric: 'Total Students', value: String(studentCount) },
        { metric: 'Total Teachers', value: String(teacherCount) },
        { metric: 'Total Classes', value: String(classCount) },
        { metric: 'Total Sections', value: String(sectionCount) },
        { metric: 'Total Subjects', value: String(subjectCount) },
        { metric: 'Active Notices', value: String(noticeCount) },
        { metric: 'Attendance Records (30 Days)', value: String(Object.values(attendanceStatusMap).reduce((sum, count) => sum + count, 0)) },
        { metric: 'Results (90 Days)', value: String(resultSummary.totalResults || 0) },
        { metric: 'Published Results (90 Days)', value: String(resultSummary.publishedResults || 0) },
        { metric: 'Average GPA (90 Days)', value: Number(resultSummary.avgGpa || 0).toFixed(2) },
        { metric: `Fee Rows (${monthLabel(month, year)})`, value: String(feeSummary.totalRows || 0) },
        { metric: `Fee Due (${monthLabel(month, year)})`, value: Number(feeSummary.totalDue || 0).toFixed(2) },
        { metric: `Fee Paid (${monthLabel(month, year)})`, value: Number(feeSummary.totalPaid || 0).toFixed(2) },
        { metric: `Fee Outstanding (${monthLabel(month, year)})`, value: Number(feeSummary.totalOutstanding || 0).toFixed(2) },
        { metric: `Payment Transactions (${monthLabel(month, year)})`, value: String(paymentSummary.paymentTransactions || 0) },
        { metric: `Payments Collected (${monthLabel(month, year)})`, value: Number(paymentSummary.paymentCollected || 0).toFixed(2) }
    ];

    const attendanceRows = Object.entries(attendanceStatusMap).map(([status, count]) => ({ status, count }));
    const recentStudentRows = recentStudents.map((student, index) => ({
        sl: index + 1,
        name: student.name || '',
        roll: student.roll || '',
        class: student.studentClass || '',
        section: student.section || '',
        createdAt: formatDate(student.createdAt)
    }));
    const recentTeacherRows = recentTeachers.map((teacher, index) => ({
        sl: index + 1,
        name: teacher.name || '',
        email: teacher.email || '',
        phone: teacher.phone || '',
        status: teacher.isActive ? 'Active' : 'Inactive',
        createdAt: formatDate(teacher.createdAt)
    }));
    const recentResultRows = recentResults.map((result, index) => ({
        sl: index + 1,
        exam: result.examName || '',
        examDate: formatDate(result.examDate),
        class: result.studentClass || '',
        section: result.section || '',
        totalMarks: Number(result.totalMarks || 0),
        gpa: Number(result.gpa || 0).toFixed(2),
        state: result.isPublished ? 'Published' : 'Draft'
    }));

    return {
        title: 'Full School Backup Summary',
        fileBaseName: 'full_school_backup_summary',
        filters: {
            attendanceRange: `${formatDate(last30)} to ${formatDate(now)}`,
            resultRange: `${formatDate(last90)} to ${formatDate(now)}`,
            feePeriod: monthLabel(month, year)
        },
        summaryLines: [
            `Students: ${studentCount}`,
            `Teachers: ${teacherCount}`,
            `Classes: ${classCount}`,
            `Sections: ${sectionCount}`,
            `Subjects: ${subjectCount}`,
            `Active notices: ${noticeCount}`,
            `Average GPA (last 90 days): ${Number(resultSummary.avgGpa || 0).toFixed(2)}`
        ],
        excelSheets: [
            {
                name: 'Overview',
                columns: [
                    { header: 'Metric', key: 'metric', width: 40 },
                    { header: 'Value', key: 'value', width: 28 }
                ],
                rows: overviewRows
            },
            {
                name: 'Attendance Summary',
                columns: [
                    { header: 'Status', key: 'status', width: 20 },
                    { header: 'Count (30 Days)', key: 'count', width: 20 }
                ],
                rows: attendanceRows
            },
            {
                name: 'Recent Students',
                columns: [
                    { header: 'SL', key: 'sl', width: 8 },
                    { header: 'Name', key: 'name', width: 26 },
                    { header: 'Roll', key: 'roll', width: 10 },
                    { header: 'Class', key: 'class', width: 14 },
                    { header: 'Section', key: 'section', width: 10 },
                    { header: 'Created At', key: 'createdAt', width: 14 }
                ],
                rows: recentStudentRows
            },
            {
                name: 'Recent Teachers',
                columns: [
                    { header: 'SL', key: 'sl', width: 8 },
                    { header: 'Name', key: 'name', width: 24 },
                    { header: 'Email', key: 'email', width: 30 },
                    { header: 'Phone', key: 'phone', width: 18 },
                    { header: 'Status', key: 'status', width: 12 },
                    { header: 'Created At', key: 'createdAt', width: 14 }
                ],
                rows: recentTeacherRows
            },
            {
                name: 'Recent Results',
                columns: [
                    { header: 'SL', key: 'sl', width: 8 },
                    { header: 'Exam', key: 'exam', width: 22 },
                    { header: 'Exam Date', key: 'examDate', width: 14 },
                    { header: 'Class', key: 'class', width: 14 },
                    { header: 'Section', key: 'section', width: 12 },
                    { header: 'Total Marks', key: 'totalMarks', width: 12 },
                    { header: 'GPA', key: 'gpa', width: 8 },
                    { header: 'Status', key: 'state', width: 12 }
                ],
                rows: recentResultRows
            }
        ]
    });
}

const [
    attendanceAgg,
    resultAgg,
    feeAgg,
    paymentAgg,
    recentStudents,
    recentTeachers,
    recentResults
] = await Promise.all([
    Attendance.aggregate([
        { $match: mergeFilters(attendanceScopeFilter, { date: { $gte: startOfTrend } }) },
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Result.aggregate([
        { $match: mergeFilters(resultScopeFilter, { createdAt: { $gte: startOfTrend } }) },
        {
            $group: {
                _id: null,
                totalResults: { $sum: 1 },
                publishedResults: { $sum: { $cond: ['$isPublished', 1, 0] } },
                avgGpa: { $avg: '$gpa' }
            }
        }
    ]),
    Fee.aggregate([
        { $match: mergeFilters(feeScopeFilter, { month, year }) },
        {
            $group: {
                _id: null,
                totalRows: { $sum: 1 },
                totalDue: { $sum: '$amountDue' },
                totalPaid: { $sum: '$amountPaid' },
                totalOutstanding: { $sum: { $max: [0, { $subtract: ['$amountDue', '$amountPaid'] }] } }
            }
        }
    ]),
    PaymentHistory.aggregate([
        { $match: mergeFilters(paymentScopeFilter, { month, year }) },
        {
            $group: {
                _id: null,
                paymentTransactions: { $sum: 1 },
                paymentCollected: { $sum: '$amount' }
            }
        }
    ]),
    Student.find(studentScopeFilter)
        .select('name roll studentClass section createdAt')
        .sort({ createdAt: -1 })
        .limit(FULL_SUMMARY_PREVIEW_LIMIT)
        .lean(),
    User.find(mergeFilters(userScopeFilter, { role: 'teacher' }))
        .select('name email phone isActive createdAt')
        .sort({ createdAt: -1 })
        .limit(FULL_SUMMARY_PREVIEW_LIMIT)
        .lean(),
    Result.find(mergeFilters(resultScopeFilter, { isActive: true }))
        .select('examName examDate studentClass section totalMarks gpa isPublished')
        .sort({ examDate: -1, createdAt: -1 })
        .limit(FULL_SUMMARY_PREVIEW_LIMIT)
        .lean()
]);

const attendanceStatusMap = attendanceAgg.reduce((acc, row) => {
    acc[row._id || 'Unknown'] = row.count;
    return acc;
}, {});
const resultSummary = resultAgg[0] || { totalResults: 0, publishedResults: 0, avgGpa: 0 };
const feeSummary = feeAgg[0] || { totalRows: 0, totalDue: 0, totalPaid: 0, totalOutstanding: 0 };
const paymentSummary = paymentAgg[0] || { paymentTransactions: 0, paymentCollected: 0 };

const overviewRows = [
    { metric: 'Total Students', value: String(studentCount) },
    { metric: 'Total Teachers', value: String(teacherCount) },
    { metric: 'Total Classes', value: String(classCount) },
    { metric: 'Total Sections', value: String(sectionCount) },
    { metric: 'Total Subjects', value: String(subjectCount) },
    { metric: 'Active Notices', value: String(noticeCount) },
    { metric: 'Attendance Records (30 Days)', value: String(Object.values(attendanceStatusMap).reduce((sum, count) => sum + count, 0)) },
    { metric: 'Results (90 Days)', value: String(resultSummary.totalResults || 0) },
    { metric: 'Published Results (90 Days)', value: String(resultSummary.publishedResults || 0) },
    { metric: 'Average GPA (90 Days)', value: Number(resultSummary.avgGpa || 0).toFixed(2) },
    { metric: `Fee Rows (${monthLabel(month, year)})`, value: String(feeSummary.totalRows || 0) },
    { metric: `Fee Due (${monthLabel(month, year)})`, value: Number(feeSummary.totalDue || 0).toFixed(2) },
    { metric: `Fee Paid (${monthLabel(month, year)})`, value: Number(feeSummary.totalPaid || 0).toFixed(2) },
    { metric: `Fee Outstanding (${monthLabel(month, year)})`, value: Number(feeSummary.totalOutstanding || 0).toFixed(2) },
    { metric: `Payment Transactions (${monthLabel(month, year)})`, value: String(paymentSummary.paymentTransactions || 0) },
    { metric: `Payments Collected (${monthLabel(month, year)})`, value: Number(paymentSummary.paymentCollected || 0).toFixed(2) }
];

const attendanceRows = Object.entries(attendanceStatusMap).map(([status, count]) => ({ status, count }));
const recentStudentRows = recentStudents.map((student, index) => ({
    sl: index + 1,
    name: student.name || '',
    roll: student.roll || '',
    class: student.studentClass || '',
    section: student.section || '',
    createdAt: formatDate(student.createdAt)
}));
const recentTeacherRows = recentTeachers.map((teacher, index) => ({
    sl: index + 1,
    name: teacher.name || '',
    email: teacher.email || '',
    phone: teacher.phone || '',
    status: teacher.isActive ? 'Active' : 'Inactive',
    createdAt: formatDate(teacher.createdAt)
}));
const recentResultRows = recentResults.map((result, index) => ({
    sl: index + 1,
    exam: result.examName || '',
    examDate: formatDate(result.examDate),
    class: result.studentClass || '',
    section: result.section || '',
    totalMarks: Number(result.totalMarks || 0),
    gpa: Number(result.gpa || 0).toFixed(2),
    state: result.isPublished ? 'Published' : 'Draft'
}));

const createExportPayload = async ({ exportType, format, user, tenant, query }) => {
    // Add timeout protection and memory monitoring
    const timeoutPromise = createExportTimeout();
    
    try {
        checkMemoryUsage(); // Check memory before starting
        
        const normalizedFormat = normalizeFormat(format);
        const scope = await resolveSchoolScope({ user, tenant, query });

        const payload = {
            exportType,
            format: normalizedFormat,
            school: scope,
            generatedAt: new Date().toISOString(),
            filters: {}
        };

        // Race between actual export and timeout
        const exportPromise = (async () => {
            switch (exportType) {
                case 'students':
                    return { ...payload, ...(await buildStudentRows(scope, query)) };
                case 'teachers':
                    return { ...payload, ...(await buildTeacherRows(scope, query)) };
                case 'attendance':
                    return { ...payload, ...(await buildAttendanceRows(scope, query)) };
                case 'results':
                    return { ...payload, ...(await buildResultRows(scope, query)) };
                case 'fees':
                    return { ...payload, ...(await buildFeeRows(scope, query)) };
                case 'notices':
                    return { ...payload, ...(await buildNoticeRows(scope, query)) };
                case 'full-school-summary':
                    return { ...payload, ...(await buildFullSchoolSummaryRows(scope, query)) };
                default:
                    throw new ExportServiceError('Unsupported export type', 400, 'UNSUPPORTED_EXPORT_TYPE');
            }
        })();

        const result = await Promise.race([exportPromise, timeoutPromise]);
        checkMemoryUsage(); // Check memory after completion
        return result;
        
    } catch (error) {
        if (error.code === 'EXPORT_TIMEOUT' || error.code === 'MEMORY_LIMIT_EXCEEDED') {
            throw error; // Re-throw timeout/memory errors
        }
        throw new ExportServiceError(`Export failed: ${error.message}`, 500, 'EXPORT_FAILED');
    }
};

const DATA_BUILDERS = {
    students: buildStudentRows,
    teachers: buildTeacherRows,
    attendance: buildAttendanceRows,
    results: buildResultRows,
    fees: buildFeeRows,
    notices: buildNoticeRows,
    'full-school-summary': buildFullSchoolSummaryRows
};

const sanitizeFileToken = (value) => {
    const token = `${value || ''}`.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    return token || 'export';
};

const buildFilename = (payload) => {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
    const schoolToken = sanitizeFileToken(payload.school.schoolCode);
    const baseToken = sanitizeFileToken(payload.fileBaseName || payload.exportType);
    return `${schoolToken}_${baseToken}_${stamp}.${payload.format}`;
};

const writeExcel = async (res, payload) => {
    const workbook = new Excel.Workbook();
    workbook.creator = 'Smart Campus';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.subject = payload.title;
    workbook.title = payload.title;

    // Process sheets with memory efficiency
    for (const sheet of payload.excelSheets || []) {
        const worksheet = workbook.addWorksheet((sheet.name || 'Sheet').slice(0, 31));
        worksheet.columns = (sheet.columns || []).map((column) => ({
            header: column.header,
            key: column.key,
            width: column.width || 20
        }));

        worksheet.views = [{ state: 'frozen', ySplit: 1 }];
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.alignment = { vertical: 'middle', horizontal: 'left' };

        // Add rows in batches to reduce memory pressure
        const rows = sheet.rows || [];
        const BATCH_SIZE = 1000;
        
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            batch.forEach(row => worksheet.addRow(row));
            
            // Allow event loop to process other tasks
            if (i % (BATCH_SIZE * 5) === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }
    }

    const filename = buildFilename(payload);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream the workbook to response
    await workbook.xlsx.write(res);
    res.end();
};

const ensurePdfSpace = (doc, requiredHeight = 16) => {
    const bottomLimit = doc.page.height - doc.page.margins.bottom;
    if (doc.y + requiredHeight > bottomLimit) {
        doc.addPage();
    }
};

const formatPdfCell = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
    return String(value);
};

const drawPdfTable = (doc, columns, rows) => {
    const safeColumns = (columns || []).length ? columns : [{ header: 'Data', key: 'value', width: 520 }];
    const maxRows = Math.min(rows.length, PDF_MAX_TABLE_ROWS);
    const rowHeight = 14;

    const drawHeader = () => {
        ensurePdfSpace(doc, rowHeight + 8);
        const y = doc.y;
        let x = doc.page.margins.left;
        doc.font('Helvetica-Bold').fontSize(9);
        safeColumns.forEach((column) => {
            doc.text(column.header, x, y, { width: column.width || 80, align: 'left' });
            x += column.width || 80;
        });
        doc.moveDown(1.1);
    };

    drawHeader();
    doc.font('Helvetica').fontSize(8.5);

    // Process rows in batches to prevent memory issues
    const BATCH_SIZE = 100;
    for (let i = 0; i < maxRows; i += BATCH_SIZE) {
        const batchEnd = Math.min(i + BATCH_SIZE, maxRows);
        
        for (let j = i; j < batchEnd; j++) {
            const row = rows[j];
            ensurePdfSpace(doc, rowHeight + 3);
            const y = doc.y;
            let x = doc.page.margins.left;
            
            safeColumns.forEach((column) => {
                const text = formatPdfCell(row[column.key]);
                doc.text(text, x, y, {
                    width: column.width || 80,
                    align: 'left',
                    ellipsis: true
                });
                x += column.width || 80;
            });
            doc.moveDown(0.9);

            if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
                drawHeader();
                doc.font('Helvetica').fontSize(8.5);
            }
        }
        
        // Allow event loop to process other tasks every few batches
        if (i % (BATCH_SIZE * 3) === 0) {
            // In PDF generation, we can't easily yield, but we can check memory pressure
            if (global.gc && i > 0 && i % (BATCH_SIZE * 10) === 0) {
                global.gc(); // Suggest garbage collection if available
            }
        }
    }

    if (rows.length > maxRows) {
        doc.moveDown(0.6);
        doc.font('Helvetica-Oblique').fontSize(9).text(
            `PDF table truncated to ${maxRows} rows for readability and safety. Use Excel format for complete data.`,
            { align: 'left' }
        );
    }
};

const writePdf = async (res, payload) => {
    const filename = buildFilename(payload);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        let settled = false;

        const resolveOnce = () => {
            if (!settled) {
                settled = true;
                resolve();
            }
        };
        const rejectOnce = (error) => {
            if (!settled) {
                settled = true;
                reject(error);
            }
        };

        doc.on('error', rejectOnce);
        res.on('error', rejectOnce);
        res.on('finish', resolveOnce);
        res.on('close', resolveOnce);

        doc.pipe(res);

        doc.font('Helvetica-Bold').fontSize(17).text(payload.school.schoolName || payload.school.schoolCode, { align: 'center' });
        doc.moveDown(0.2);
        doc.font('Helvetica-Bold').fontSize(13).text(payload.title, { align: 'center' });
        doc.moveDown(0.4);
        doc.font('Helvetica').fontSize(10).text(`Generated: ${formatDateTime(payload.generatedAt)}`, { align: 'center' });
        doc.text(`School Code: ${payload.school.schoolCode}`, { align: 'center' });
        doc.moveDown(0.8);

        const filterEntries = Object.entries(payload.filters || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
        if (filterEntries.length) {
            doc.font('Helvetica-Bold').fontSize(10).text('Applied Filters');
            doc.font('Helvetica').fontSize(9);
            filterEntries.forEach(([key, value]) => {
                ensurePdfSpace(doc, 14);
                doc.text(`- ${key}: ${value}`);
            });
            doc.moveDown(0.7);
        }

        if ((payload.summaryLines || []).length) {
            doc.font('Helvetica-Bold').fontSize(10).text('Summary');
            doc.font('Helvetica').fontSize(9.5);
            payload.summaryLines.forEach((line) => {
                ensurePdfSpace(doc, 14);
                doc.text(`- ${line}`);
            });
            doc.moveDown(0.8);
        }

        const pdfRows = payload.pdf?.rows || [];
        if (!pdfRows.length) {
            doc.font('Helvetica-Oblique').fontSize(10).text('No records found for selected filters.');
        } else {
            drawPdfTable(doc, payload.pdf?.columns || [], pdfRows);
        }

        doc.end();
    });
};

module.exports = {
    createExportPayload,
    writeExcel,
    writePdf,
    ExportServiceError
};
