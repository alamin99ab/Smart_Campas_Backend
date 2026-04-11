/**
 * 📝 ADVANCED ATTENDANCE CONTROLLER
 * Industry-level attendance system with auto-calculation and alerts
 */

const mongoose = require('mongoose');
const AdvancedAttendance = require('../models/AdvancedAttendance');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const AcademicSession = require('../models/AcademicSession');
const TeacherAssignment = require('../models/TeacherAssignment');
const School = require('../models/School');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { resolveStudentObjectIdFromUser } = require('../utils/resolveStudentFromUser');
const {
    findTemporarySubstitutePermission,
    markSubstituteSlotCompleted
} = require('./teacherAbsenceController');

/**
 * Ensure there is an active academic session for the current school.
 * If none exists, create a sensible default for the current calendar year.
 */
const ensureActiveAcademicSession = async (schoolId, schoolCode, creatorId) => {
    let session = await AcademicSession.findOne({ schoolId, isActive: true });
    if (session) return session;

    const now = new Date();
    const year = now.getFullYear();
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    session = await AcademicSession.create({
        schoolId,
        schoolCode,
        name: `${year}-${year + 1} Session`,
        academicYear: `${year}-${year + 1}`,
        startDate,
        endDate,
        isCurrent: true,
        isActive: true,
        createdBy: creatorId
    });

    return session;
};

const getTenantContext = (req, res) => {
    const schoolId = req.tenant?.schoolId;
    const schoolCode = req.tenant?.schoolCode || req.user?.schoolCode;

    if (!schoolId || !schoolCode) {
        res.status(400).json({
            success: false,
            message: 'School tenant context is required'
        });
        return null;
    }

    return { schoolId, schoolCode };
};

const toObjectId = (value, fieldName) => {
    if (!value || !mongoose.Types.ObjectId.isValid(value)) {
        return { error: `${fieldName} is invalid` };
    }

    return { value: new mongoose.Types.ObjectId(value) };
};

/**
 * @desc    Mark Student Attendance (Teacher)
 * @route   POST /api/attendance/student/mark
 * @access  Teacher
 */
exports.markStudentAttendance = async (req, res) => {
    try {
        const {
            classId,
            sectionId,
            subjectId,
            periodNumber,
            date,
            attendanceData // Array of { studentId, status, notes }
        } = req.body;
        const normalizedPeriod = Number.isFinite(Number(periodNumber)) ? Number(periodNumber) : 1;

        const sectionValue = sectionId ? String(sectionId).trim() : undefined;
        const sectionName = sectionValue ? sectionValue.toUpperCase() : undefined;
        const sectionObjectId = sectionValue && mongoose.Types.ObjectId.isValid(sectionValue)
            ? new mongoose.Types.ObjectId(sectionValue)
            : undefined;

        // Core validation
        if (!classId || !subjectId || !date || !attendanceData || !Array.isArray(attendanceData) || attendanceData.length === 0) {
            return res.status(400).json({ success: false, message: 'classId, subjectId, date and attendanceData are required' });
        }

        const hasInvalidStudent = attendanceData.some(item => !item.studentId || !item.status);
        if (hasInvalidStudent) {
            return res.status(400).json({ success: false, message: 'Invalid attendanceData: studentId and status required for each record' });
        }

        const tenant = getTenantContext(req, res);
        if (!tenant) return;

        const { schoolId, schoolCode } = tenant;
        const teacherId = req.user.id;
        const isPrivilegedAttendanceActor = ['principal', 'admin', 'super_admin'].includes(req.user.role);
        const parsedDate = new Date(date);
        if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid attendance date'
            });
        }

        // Validate class and subject within tenant
        const classInfo = await Class.findOne({ _id: classId, schoolCode });
        if (!classInfo) {
            return res.status(400).json({ success: false, message: 'Invalid class for this school' });
        }

        const subjectInfo = await Subject.findOne({ _id: subjectId, schoolCode });
        if (!subjectInfo) {
            return res.status(400).json({ success: false, message: 'Invalid subject for this school' });
        }

        // Verify teacher assignment to this class+subject
        if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(subjectId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid classId or subjectId format'
            });
        }

        // Convert to ObjectIds for consistent querying
        const classObjectId = new mongoose.Types.ObjectId(classId);
        const subjectObjectId = new mongoose.Types.ObjectId(subjectId);
        const classIdString = String(classObjectId);
        const subjectIdString = String(subjectObjectId);

        const matchingAssignments = await TeacherAssignment.aggregate([
            {
                $match: {
                    schoolCode,
                    isActive: true
                }
            },
            {
                $addFields: {
                    teacherAsString: { $toString: '$teacher' },
                    subjectAsString: { $toString: '$subject' },
                    classesAsString: {
                        $map: {
                            input: '$classes',
                            as: 'classRef',
                            in: { $toString: '$$classRef' }
                        }
                    }
                }
            },
            {
                $match: {
                    teacherAsString: String(teacherId),
                    subjectAsString: subjectIdString,
                    classesAsString: classIdString
                }
            },
            { $limit: 1 },
            { $project: { _id: 1 } }
        ]);

        const hasAssignment = matchingAssignments.length > 0;
        let substitutePermission = null;

        if (!hasAssignment && req.user.role === 'teacher') {
            substitutePermission = await findTemporarySubstitutePermission({
                schoolCode,
                teacherId,
                classId,
                subjectId,
                section: sectionName || classInfo.section,
                periodNumber: normalizedPeriod,
                date: parsedDate
            });
        }

        if (!hasAssignment && !substitutePermission && !isPrivilegedAttendanceActor) {
            // Debug logging for troubleshooting
            if (process.env.NODE_ENV !== 'production') {
                console.log('Teacher assignment check failed:', {
                    teacherId,
                    subjectId: subjectObjectId,
                    classId: classObjectId,
                    schoolCode,
                    foundAssignments: await TeacherAssignment.find({
                        teacher: teacherId,
                        schoolCode,
                        isActive: true
                    }).select('subject classes subjectName').lean(),
                    substitutePermissionFound: Boolean(substitutePermission)
                });
            }
            return res.status(403).json({
                success: false,
                message: 'You are not assigned to teach this class/subject combination and no active substitute permission exists'
            });
        }

        const markerRole = substitutePermission
            ? 'substitute_teacher'
            : isPrivilegedAttendanceActor
                ? req.user.role
                : 'teacher';

        // Get or create current academic session to satisfy schema requirement
        const academicSession = await ensureActiveAcademicSession(schoolId, schoolCode, teacherId);

        const markedAttendances = [];
        const alerts = [];

        // Process each student attendance
        for (const studentData of attendanceData) {
            const { studentId, status, notes, lateMinutes } = studentData;

            // Validate and convert studentId to ObjectId
            if (!mongoose.Types.ObjectId.isValid(studentId)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid studentId format: ${studentId}`
                });
            }

            // Check if attendance already exists
            const attendanceQuery = {
                schoolId,
                studentId: new mongoose.Types.ObjectId(studentId),
                classId: classObjectId,
                subjectId: subjectObjectId,
                date: parsedDate,
                periodNumber: normalizedPeriod
            };
            if (sectionObjectId) {
                attendanceQuery.sectionId = sectionObjectId;
            } else if (sectionName) {
                attendanceQuery.section = sectionName;
            }

            const existingAttendance = await AdvancedAttendance.findOne(attendanceQuery);

            if (existingAttendance) {
                // Update existing attendance
                existingAttendance.status = status;
                existingAttendance.notes = notes;
                existingAttendance.lateMinutes = lateMinutes;
                existingAttendance.isLate = status === 'present' && lateMinutes > 0;
                existingAttendance.markedBy = teacherId;
                existingAttendance.markedByRole = markerRole;
                if (sectionName && !sectionObjectId) {
                    existingAttendance.section = sectionName;
                }
                existingAttendance.updatedAt = new Date();
                await existingAttendance.save();
                markedAttendances.push(existingAttendance);
            } else {
                // Create new attendance record
                const attendance = new AdvancedAttendance({
                    schoolId,
                    academicSessionId: academicSession._id,
                    attendanceType: 'student',
                    studentId: new mongoose.Types.ObjectId(studentId),
                    classId: classObjectId,
                    sectionId: sectionObjectId,
                    section: sectionObjectId ? undefined : sectionName,
                    subjectId: subjectObjectId,
                    periodNumber: normalizedPeriod,
                    date: parsedDate,
                    status,
                    notes,
                    lateMinutes,
                    isLate: status === 'present' && lateMinutes > 0,
                    markedBy: teacherId,
                    markedByRole: markerRole,
                    markingMethod: 'manual'
                });

                await attendance.save();
                markedAttendances.push(attendance);

                // Check for attendance alerts (non-blocking)
                try {
                    if (typeof attendance.calculateMonthlyStats === 'function') {
                        await attendance.calculateMonthlyStats();
                    }
                    if (typeof attendance.checkAttendanceAlerts === 'function') {
                        const attendanceAlerts = await attendance.checkAttendanceAlerts();
                        if (attendanceAlerts && attendanceAlerts.length > 0) {
                            alerts.push({
                                studentId,
                                alerts: attendanceAlerts
                            });
                        }
                    }
                } catch (alertError) {
                    // Log alert error but don't fail attendance save
                    console.warn('Attendance alert check failed:', alertError.message);
                }
            }
        }

        // Log activity
        await AuditLog.create({
            action: 'mark_student_attendance',
            resource: 'attendance',
            userId: teacherId,
            userRole: req.user.role,
            schoolId,
            details: {
                classId,
                sectionId,
                subjectId,
                periodNumber: normalizedPeriod,
                date,
                authorizationMode: substitutePermission
                    ? 'temporary_substitute_permission'
                    : hasAssignment
                        ? 'regular_teacher_assignment'
                        : 'privileged_role_override',
                substitutePermission: substitutePermission
                    ? {
                        requestId: substitutePermission.requestId,
                        slotId: substitutePermission.slotId
                    }
                    : null,
                totalStudents: attendanceData.length,
                present: attendanceData.filter(a => a.status === 'present').length,
                absent: attendanceData.filter(a => a.status === 'absent').length
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        if (substitutePermission) {
            try {
                await markSubstituteSlotCompleted({
                    requestId: substitutePermission.requestId,
                    slotId: substitutePermission.slotId,
                    markerId: teacherId,
                    attendanceRecordId: markedAttendances[0]?._id
                });
            } catch (substituteUpdateError) {
                console.warn('Substitute slot completion update failed:', substituteUpdateError.message);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Student attendance marked successfully',
            data: {
                attendances: markedAttendances,
                alerts,
                summary: {
                    totalMarked: markedAttendances.length,
                    present: markedAttendances.filter(a => a.status === 'present').length,
                    absent: markedAttendances.filter(a => a.status === 'absent').length,
                    late: markedAttendances.filter(a => a.isLate).length
                }
            }
        });

        // Best-effort legacy sync so principal/student views (Attendance model) show the same data
        try {
            const sectionForLegacy = sectionName || classInfo.section || 'A';
            const subjectName = subjectInfo.subjectName || subjectInfo.subjectCode || 'Unknown';
            const records = attendanceData.map((item) => ({
                studentId: item.studentId,
                status: mapLegacyStatus(item.status),
                remarks: item.notes || ''
            }));

            const legacyFilter = {
                schoolCode,
                studentClass: classInfo.className || 'Class',
                section: sectionForLegacy,
                date: new Date(date),
                subject: subjectName
            };

            await Attendance.findOneAndUpdate(
                legacyFilter,
                {
                    $set: {
                        records,
                        takenBy: teacherId,
                        updatedAt: new Date()
                    }
                },
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true
                }
            );
        } catch (legacyError) {
            console.warn('Legacy Attendance sync failed:', legacyError.message);
        }
    } catch (error) {
        console.error('Mark student attendance error:', error);
        
        // More detailed error responses for debugging
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error: ' + Object.values(error.errors).map(e => e.message).join(', ')
            });
        }
        
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid ID format: ' + error.value
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Internal server error while marking attendance',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

function mapLegacyStatus(status) {
    switch ((status || '').toLowerCase()) {
        case 'present': return 'Present';
        case 'absent': return 'Absent';
        case 'late': return 'Late';
        case 'holiday': return 'Holiday';
        default: return 'Present';
    }
}

/**
 * @desc    Teacher Check-In/Check-Out
 * @route   POST /api/attendance/teacher/check-in
 * @route   POST /api/attendance/teacher/check-out
 * @access  Teacher
 */
exports.teacherAttendance = async (req, res) => {
    try {
        const { type, time, location, notes, classId, studentId, attendanceDate, status } = req.body;
        const tenant = getTenantContext(req, res);
        if (!tenant) return;

        const { schoolId } = tenant;
        const teacherId = req.user.id;

        if (!type || !['check-in', 'check-out'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid attendance type' });
        }

        if (!time) {
            return res.status(400).json({ success: false, message: 'Time is required' });
        }

        if (classId || studentId || attendanceDate || status) {
            // Optional tutoring/registering behavior (not main path)
            if (!classId || !studentId || !attendanceDate || !status) {
                return res.status(400).json({ success: false, message: 'classId, studentId, date, status are required when provided' });
            }
        }

        // Academic session is required by the schema; auto-create if missing
        const academicSession = await ensureActiveAcademicSession(schoolId, req.user.schoolCode, teacherId);

        const today = new Date().toISOString().split('T')[0];

        // Find existing attendance for today
        let attendance = await AdvancedAttendance.findOne({
            schoolId,
            teacherId,
            attendanceType: 'teacher',
            date: new Date(today)
        });

        if (!attendance) {
            // Create new attendance record
            attendance = new AdvancedAttendance({
                schoolId,
                academicSessionId: academicSession._id,
                attendanceType: 'teacher',
                teacherId,
                date: new Date(today),
                status: type === 'check-in' ? 'present' : 'absent',
                markedBy: teacherId,
                markedByRole: 'self',
                markingMethod: 'manual',
                location,
                notes
            });
        } else if (!attendance.academicSessionId) {
            // Backfill academic session for existing record created before fix
            attendance.academicSessionId = academicSession._id;
        }

        if (type === 'check-in') {
            attendance.checkInTime = time;
            attendance.status = 'present';
            
            // Check if late
            const school = await School.findById(schoolId);
            const schoolStartTime = school?.academicSettings?.schoolStartTime || '08:00';
            
            if (time > schoolStartTime) {
                attendance.isLate = true;
                const [checkInHours, checkInMinutes] = time.split(':').map(Number);
                const [startHours, startMinutes] = schoolStartTime.split(':').map(Number);
                attendance.lateMinutes = (checkInHours - startHours) * 60 + (checkInMinutes - startMinutes);
            }
        } else if (type === 'check-out') {
            attendance.checkOutTime = time;
            
            // Calculate duration
            if (attendance.checkInTime) {
                const checkIn = new Date(`2000-01-01T${attendance.checkInTime}`);
                const checkOut = new Date(`2000-01-01T${time}`);
                const duration = (checkOut - checkIn) / (1000 * 60); // minutes
                
                // Check for early leave
                const school = await School.findById(schoolId);
                const schoolEndTime = school?.academicSettings?.schoolEndTime || '16:00';
                
                if (time < schoolEndTime) {
                    attendance.isEarlyLeave = true;
                    const [endHours, endMinutes] = schoolEndTime.split(':').map(Number);
                    const [checkOutHours, checkOutMinutes] = time.split(':').map(Number);
                    attendance.earlyLeaveMinutes = (endHours - checkOutHours) * 60 + (endMinutes - checkOutMinutes);
                }
            }
        }

        await attendance.save();

        // Log activity
        await AuditLog.create({
            action: `teacher_${type.replace('-', '_')}`,
            resource: 'attendance',
            resourceId: attendance._id,
            userId: teacherId,
            userRole: req.user.role,
            schoolId,
            details: {
                time,
                location,
                isLate: attendance.isLate,
                isEarlyLeave: attendance.isEarlyLeave
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: `Teacher ${type} successful`,
            data: attendance
        });
    } catch (error) {
        console.error('Teacher attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Get Student Attendance Report
 * @route   GET /api/attendance/student/:studentId/report
 * @access  Teacher, Principal, Parent, Student
 */
exports.getStudentAttendanceReport = async (req, res) => {
    try {
        const incomingStudentId = req.params.studentId || req.user.id;
        const { academicSessionId, startDate, endDate } = req.query;
        const tenant = getTenantContext(req, res);
        if (!tenant) return;

        const { schoolId } = tenant;

        let targetStudentId = incomingStudentId;

        if (req.user.role === 'student') {
            const resolvedStudentId = await resolveStudentObjectIdFromUser(req.user) || req.user.studentId || null;
            if (!resolvedStudentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Unable to resolve student identity'
                });
            }
            targetStudentId = resolvedStudentId;
        }

        if (!mongoose.Types.ObjectId.isValid(targetStudentId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid studentId'
            });
        }

        if (req.user.role === 'student' && String(incomingStudentId) !== String(req.user.id) && String(incomingStudentId) !== String(targetStudentId)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const report = await AdvancedAttendance.getStudentAttendanceReport(
            schoolId,
            targetStudentId,
            academicSessionId,
            startDate,
            endDate
        );

        const student = await Student.findById(targetStudentId).select('name roll studentClass section');

        const totalStats = (report || []).reduce((acc, month) => ({
            totalDays: acc.totalDays + (month.totalDays || 0),
            presentDays: acc.presentDays + (month.presentDays || 0),
            absentDays: acc.absentDays + (month.absentDays || 0),
            leaveDays: acc.leaveDays + (month.leaveDays || 0),
            lateDays: acc.lateDays + (month.lateDays || 0)
        }), { totalDays: 0, presentDays: 0, absentDays: 0, leaveDays: 0, lateDays: 0 });

        totalStats.percentage = totalStats.totalDays > 0
            ? Math.round((totalStats.presentDays / totalStats.totalDays) * 100)
            : 0;

        res.status(200).json({
            success: true,
            data: {
                student,
                monthlyReport: report,
                overallStats: totalStats
            }
        });
    } catch (error) {
        console.error('Get student attendance report error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Get Class Attendance Report
 * @route   GET /api/attendance/class/:classId/:sectionId/:date
 * @access  Teacher, Principal
 */
exports.getClassAttendanceReport = async (req, res) => {
    try {
        const { classId, sectionId, date } = req.params;
        const tenant = getTenantContext(req, res);
        if (!tenant) return;

        const { schoolId } = tenant;
        if (!mongoose.Types.ObjectId.isValid(classId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid classId'
            });
        }

        const parsedDate = new Date(date);
        if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date'
            });
        }

        const report = await AdvancedAttendance.getClassAttendanceReport(
            schoolId,
            classId,
            sectionId,
            parsedDate.toISOString()
        );

        res.status(200).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error('Get class attendance report error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Get Teacher Attendance Report
 * @route   GET /api/attendance/teacher/:teacherId/report
 * @access  Principal, Teacher
 */
exports.getTeacherAttendanceReport = async (req, res) => {
    try {
        const teacherId = req.params.teacherId || req.user.id;
        const { academicSessionId } = req.query;
        const tenant = getTenantContext(req, res);
        if (!tenant) return;

        const { schoolId } = tenant;

        if (!mongoose.Types.ObjectId.isValid(teacherId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid teacherId'
            });
        }

        // Check authorization
        if (req.user.role === 'teacher' && String(req.user.id) !== String(teacherId)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const report = await AdvancedAttendance.getTeacherAttendanceReport(
            schoolId,
            teacherId,
            academicSessionId
        );

        // Get teacher details
        const teacher = await User.findById(teacherId).select('name email');

        res.status(200).json({
            success: true,
            data: {
                teacher,
                report
            }
        });
    } catch (error) {
        console.error('Get teacher attendance report error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Get Attendance Analytics
 * @route   GET /api/attendance/analytics
 * @access  Principal
 */
exports.getAttendanceAnalytics = async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day', type = 'all' } = req.query;
        const tenant = getTenantContext(req, res);
        if (!tenant) return;

        const { schoolId, schoolCode } = tenant;
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getTime() - (30 * 24 * 60 * 60 * 1000));
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid startDate or endDate'
            });
        }

        const analytics = await AdvancedAttendance.getAttendanceAnalytics(
            schoolId,
            start.toISOString(),
            end.toISOString(),
            groupBy
        );

        // Get additional statistics
        const [
            totalStudents,
            totalTeachers,
            averageStudentAttendance,
            averageTeacherAttendance
        ] = await Promise.all([
            User.countDocuments({ schoolCode, role: 'student', isActive: true }),
            User.countDocuments({ schoolCode, role: 'teacher', isActive: true }),
            AdvancedAttendance.aggregate([
                { $match: { schoolId: new mongoose.Types.ObjectId(schoolId), attendanceType: 'student' } },
                { $group: { _id: null, avgRate: { $avg: '$monthlyStats.percentage' } } }
            ]),
            AdvancedAttendance.aggregate([
                { $match: { schoolId: new mongoose.Types.ObjectId(schoolId), attendanceType: 'teacher' } },
                { $group: { _id: null, avgRate: { $avg: '$monthlyStats.percentage' } } }
            ])
        ]);

        res.status(200).json({
            success: true,
            data: {
                analytics,
                overview: {
                    totalStudents,
                    totalTeachers,
                    averageStudentAttendance: averageStudentAttendance[0]?.avgRate || 0,
                    averageTeacherAttendance: averageTeacherAttendance[0]?.avgRate || 0
                }
            }
        });
    } catch (error) {
        console.error('Get attendance analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Get Attendance Alerts
 * @route   GET /api/attendance/alerts
 * @access  Principal
 */
exports.getAttendanceAlerts = async (req, res) => {
    try {
        const { severity, acknowledged } = req.query;
        const tenant = getTenantContext(req, res);
        if (!tenant) return;

        const { schoolId } = tenant;

        // Build filter
        const filter = {
            schoolId,
            'alerts.0': { $exists: true } // Has at least one alert
        };

        if (severity) {
            filter['alerts.severity'] = severity;
        }

        if (acknowledged !== undefined) {
            filter['alerts.acknowledged'] = acknowledged === 'true';
        }

        const attendances = await AdvancedAttendance.find(filter)
            .populate('studentId', 'name rollNumber')
            .populate('teacherId', 'name email')
            .sort({ 'alerts.triggeredAt': -1 });

        // Extract alerts
        const alerts = [];
        for (const attendance of attendances) {
            for (const alert of attendance.alerts) {
                if (!severity || alert.severity === severity) {
                    if (acknowledged === undefined || alert.acknowledged === (acknowledged === 'true')) {
                        alerts.push({
                            ...alert.toObject(),
                            attendanceId: attendance._id,
                            student: attendance.studentId,
                            teacher: attendance.teacherId,
                            date: attendance.date
                        });
                    }
                }
            }
        }

        res.status(200).json({
            success: true,
            data: {
                alerts,
                summary: {
                    total: alerts.length,
                    critical: alerts.filter(a => a.severity === 'critical').length,
                    high: alerts.filter(a => a.severity === 'high').length,
                    medium: alerts.filter(a => a.severity === 'medium').length,
                    low: alerts.filter(a => a.severity === 'low').length,
                    acknowledged: alerts.filter(a => a.acknowledged).length,
                    pending: alerts.filter(a => !a.acknowledged).length
                }
            }
        });
    } catch (error) {
        console.error('Get attendance alerts error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Acknowledge Attendance Alert
 * @route   PATCH /api/attendance/alerts/:attendanceId/:alertId/acknowledge
 * @access  Principal
 */
exports.acknowledgeAlert = async (req, res) => {
    try {
        const { attendanceId, alertId } = req.params;
        const tenant = getTenantContext(req, res);
        if (!tenant) return;

        const { schoolId } = tenant;

        const attendance = await AdvancedAttendance.findOne({
            _id: attendanceId,
            schoolId
        });

        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: 'Attendance record not found'
            });
        }

        const alert = attendance.alerts.id(alertId);
        if (!alert) {
            return res.status(404).json({
                success: false,
                message: 'Alert not found'
            });
        }

        alert.acknowledged = true;
        alert.acknowledgedBy = req.user.id;
        alert.acknowledgedAt = new Date();

        await attendance.save();

        // Log activity
        await AuditLog.create({
            action: 'acknowledge_attendance_alert',
            resource: 'attendance',
            resourceId: attendance._id,
            userId: req.user.id,
            userRole: req.user.role,
            schoolId,
            details: {
                alertId,
                alertType: alert.type,
                alertSeverity: alert.severity
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Alert acknowledged successfully',
            data: alert
        });
    } catch (error) {
        console.error('Acknowledge alert error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Get today's attendance overview
 * @route   GET /api/attendance/today
 * @access  Principal/Admin
 */
exports.getTodayAttendance = async (req, res) => {
    try {
        const tenant = getTenantContext(req, res);
        if (!tenant) return;

        const { schoolId, schoolCode } = tenant;

        // Get today's date range
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get all classes for this school
        const Class = require('../models/Class');
        const classes = await Class.find({ schoolCode }).lean();

        if (!classes || classes.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    date: today.toISOString().split('T')[0],
                    status: []
                }
            });
        }

        // For each class, check if attendance was taken today
        const status = [];
        for (const classDoc of classes) {
            // Get attendance records for this class today
            const attendanceRecords = await AdvancedAttendance.findOne({
                schoolId,
                classId: classDoc._id,
                date: { $gte: today, $lt: tomorrow },
                attendanceType: 'student'
            }).lean();

            status.push({
                class: classDoc.className || 'Class',
                section: classDoc.section || 'N/A',
                totalStudents: classDoc.currentStudents || classDoc.totalStudents || 0,
                taken: !!attendanceRecords,
                attendanceId: attendanceRecords?._id,
                takenBy: attendanceRecords ? {
                    name: attendanceRecords.markedByRole === 'teacher' ? 'Teacher' : 'Admin'
                } : null,
                time: attendanceRecords?.createdAt
            });
        }

        res.status(200).json({
            success: true,
            data: {
                date: today.toISOString().split('T')[0],
                status
            }
        });
    } catch (error) {
        console.error('Get today attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    markStudentAttendance: exports.markStudentAttendance,
    teacherAttendance: exports.teacherAttendance,
    getStudentAttendanceReport: exports.getStudentAttendanceReport,
    getClassAttendanceReport: exports.getClassAttendanceReport,
    getTeacherAttendanceReport: exports.getTeacherAttendanceReport,
    getAttendanceAnalytics: exports.getAttendanceAnalytics,
    getAttendanceAlerts: exports.getAttendanceAlerts,
    acknowledgeAlert: exports.acknowledgeAlert,
    getTodayAttendance: exports.getTodayAttendance
};
