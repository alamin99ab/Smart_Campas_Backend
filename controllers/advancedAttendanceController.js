/**
 * 📝 ADVANCED ATTENDANCE CONTROLLER
 * Industry-level attendance system with auto-calculation and alerts
 */

const AdvancedAttendance = require('../models/AdvancedAttendance');
const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const AcademicSession = require('../models/AcademicSession');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');

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

        const schoolId = req.tenant.schoolId;
        const teacherId = req.user.id;

        // Validate class and subject
        const classInfo = await Class.findOne({ _id: classId, schoolId });
        if (!classInfo) {
            return res.status(400).json({
                success: false,
                message: 'Invalid class'
            });
        }

        const subjectInfo = await Subject.findOne({ _id: subjectId, schoolId });
        if (!subjectInfo) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subject'
            });
        }

        // Get current academic session
        const academicSession = await AcademicSession.findOne({
            schoolId,
            isActive: true
        });

        if (!academicSession) {
            return res.status(400).json({
                success: false,
                message: 'No active academic session found'
            });
        }

        const markedAttendances = [];
        const alerts = [];

        // Process each student attendance
        for (const studentData of attendanceData) {
            const { studentId, status, notes, lateMinutes } = studentData;

            // Check if attendance already exists
            const existingAttendance = await AdvancedAttendance.findOne({
                schoolId,
                studentId,
                classId,
                sectionId,
                subjectId,
                date: new Date(date),
                periodNumber
            });

            if (existingAttendance) {
                // Update existing attendance
                existingAttendance.status = status;
                existingAttendance.notes = notes;
                existingAttendance.lateMinutes = lateMinutes;
                existingAttendance.isLate = status === 'present' && lateMinutes > 0;
                existingAttendance.updatedAt = new Date();
                await existingAttendance.save();
                markedAttendances.push(existingAttendance);
            } else {
                // Create new attendance record
                const attendance = new AdvancedAttendance({
                    schoolId,
                    academicSessionId: academicSession._id,
                    attendanceType: 'student',
                    studentId,
                    classId,
                    sectionId,
                    subjectId,
                    periodNumber,
                    date: new Date(date),
                    status,
                    notes,
                    lateMinutes,
                    isLate: status === 'present' && lateMinutes > 0,
                    markedBy: teacherId,
                    markedByRole: 'teacher',
                    markingMethod: 'manual'
                });

                await attendance.save();
                markedAttendances.push(attendance);

                // Check for attendance alerts
                await attendance.calculateMonthlyStats();
                const attendanceAlerts = await attendance.checkAttendanceAlerts();
                if (attendanceAlerts.length > 0) {
                    alerts.push({
                        studentId,
                        alerts: attendanceAlerts
                    });
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
                date,
                totalStudents: attendanceData.length,
                present: attendanceData.filter(a => a.status === 'present').length,
                absent: attendanceData.filter(a => a.status === 'absent').length
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

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
    } catch (error) {
        console.error('Mark student attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Teacher Check-In/Check-Out
 * @route   POST /api/attendance/teacher/check-in
 * @route   POST /api/attendance/teacher/check-out
 * @access  Teacher
 */
exports.teacherAttendance = async (req, res) => {
    try {
        const { type, time, location, notes } = req.body; // type: 'check-in' or 'check-out'
        const schoolId = req.tenant.schoolId;
        const teacherId = req.user.id;

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
        const { studentId } = req.params;
        const { academicSessionId, startDate, endDate } = req.query;
        const schoolId = req.tenant.schoolId;

        // Check authorization
        if (req.user.role === 'student' && req.user.id !== studentId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const report = await AdvancedAttendance.getStudentAttendanceReport(
            schoolId,
            studentId,
            academicSessionId,
            startDate,
            endDate
        );

        // Get student details
        const student = await User.findById(studentId).select('name email rollNumber');

        // Calculate overall statistics
        const totalStats = report.reduce((acc, month) => ({
            totalDays: acc.totalDays + month.totalDays,
            presentDays: acc.presentDays + month.presentDays,
            absentDays: acc.absentDays + month.absentDays,
            leaveDays: acc.leaveDays + month.leaveDays,
            lateDays: acc.lateDays + month.lateDays
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
        const schoolId = req.tenant.schoolId;

        const report = await AdvancedAttendance.getClassAttendanceReport(
            schoolId,
            classId,
            sectionId,
            date
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
        const { teacherId } = req.params;
        const { academicSessionId } = req.query;
        const schoolId = req.tenant.schoolId;

        // Check authorization
        if (req.user.role === 'teacher' && req.user.id !== teacherId) {
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
        const schoolId = req.tenant.schoolId;

        const analytics = await AdvancedAttendance.getAttendanceAnalytics(
            schoolId,
            startDate,
            endDate,
            groupBy
        );

        // Get additional statistics
        const [
            totalStudents,
            totalTeachers,
            averageStudentAttendance,
            averageTeacherAttendance
        ] = await Promise.all([
            User.countDocuments({ schoolId, role: 'student', isActive: true }),
            User.countDocuments({ schoolId, role: 'teacher', isActive: true }),
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
        const schoolId = req.tenant.schoolId;

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
        const schoolId = req.tenant.schoolId;

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

module.exports = {
    markStudentAttendance: exports.markStudentAttendance,
    teacherAttendance: exports.teacherAttendance,
    getStudentAttendanceReport: exports.getStudentAttendanceReport,
    getClassAttendanceReport: exports.getClassAttendanceReport,
    getTeacherAttendanceReport: exports.getTeacherAttendanceReport,
    getAttendanceAnalytics: exports.getAttendanceAnalytics,
    getAttendanceAlerts: exports.getAttendanceAlerts,
    acknowledgeAlert: exports.acknowledgeAlert
};
