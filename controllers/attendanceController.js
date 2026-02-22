// controllers/attendanceController.js
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const School = require('../models/School');
const AuditLog = require('../models/AuditLog');
const Excel = require('exceljs');
const PDFDocument = require('pdfkit');
const { sendSMS } = require('../utils/smsService');

// @desc    Take Attendance
// @route   POST /api/attendance/take
// @access  Private (Teacher/Principal)
exports.takeAttendance = async (req, res) => {
    const { studentClass, section, date, records, subject } = req.body;
    
    try {
        // Validation
        if (!studentClass || !section || !date || !records) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ message: 'Records must be a non-empty array' });
        }

        const validRecords = records.every(r => 
            r.studentId && ['Present', 'Absent', 'Late', 'Holiday'].includes(r.status)
        );
        
        if (!validRecords) {
            return res.status(400).json({ message: 'Invalid records format' });
        }

        // Verify students belong to this school/class/section
        const studentIds = records.map(r => r.studentId);
        const students = await Student.find({ 
            _id: { $in: studentIds },
            schoolCode: req.user.schoolCode,
            studentClass,
            section
        });

        if (students.length !== records.length) {
            return res.status(400).json({ message: 'One or more students not found' });
        }

        // Check if attendance already exists
        const existingAttendance = await Attendance.findOne({
            schoolCode: req.user.schoolCode,
            studentClass,
            section,
            date,
            subject: subject || null
        });

        if (existingAttendance) {
            // Update existing
            existingAttendance.records = records;
            existingAttendance.takenBy = req.user._id;
            existingAttendance.updatedAt = Date.now();
            await existingAttendance.save();

            // Audit log
            await AuditLog.create({
                user: req.user._id,
                action: 'ATTENDANCE_UPDATED',
                details: { class: studentClass, section, date, totalStudents: records.length },
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            return res.status(200).json({ 
                message: 'Attendance updated successfully',
                attendance: existingAttendance
            });
        }

        // Create new attendance
        const attendance = await Attendance.create({
            schoolCode: req.user.schoolCode,
            studentClass,
            section,
            date,
            subject: subject || null,
            records,
            takenBy: req.user._id
        });

        // Send SMS to absent students (if enabled)
        if (process.env.SEND_ABSENT_SMS === 'true') {
            const absentStudents = records
                .filter(r => r.status === 'Absent')
                .map(r => r.studentId);

            if (absentStudents.length > 0) {
                const absentStudentDetails = await Student.find({ 
                    _id: { $in: absentStudents },
                    'guardian.phone': { $exists: true }
                }).select('name guardian');

                // Queue SMS sending (background job)
                absentStudentDetails.forEach(student => {
                    if (student.guardian?.phone) {
                        sendSMS({
                            to: student.guardian.phone,
                            message: `Your child ${student.name} was absent on ${new Date(date).toLocaleDateString()}.`
                        }).catch(err => console.error('SMS error:', err));
                    }
                });
            }
        }

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'ATTENDANCE_TAKEN',
            details: { class: studentClass, section, date, totalStudents: records.length },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({ 
            message: 'Attendance recorded successfully',
            attendance 
        });

    } catch (error) {
        console.error('Take attendance error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Attendance already taken for this day/subject' });
        }
        
        res.status(500).json({ message: 'Failed to record attendance' });
    }
};

// @desc    Get Attendance Report
// @route   GET /api/attendance/report
// @access  Private
exports.getAttendanceReport = async (req, res) => {
    const { studentClass, section, date, startDate, endDate, studentId, subject, page = 1, limit = 30 } = req.query;
    
    try {
        if (!studentClass || !section) {
            return res.status(400).json({ message: 'Class and section are required' });
        }

        let query = {
            schoolCode: req.user.schoolCode,
            studentClass,
            section
        };

        if (subject) query.subject = subject;
        if (date) query.date = date;
        if (startDate && endDate) {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        // Pagination
        const skip = (page - 1) * limit;

        const attendance = await Attendance.find(query)
            .populate('records.studentId', 'name roll fatherName motherName guardian')
            .populate('takenBy', 'name email')
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit * 1);

        const total = await Attendance.countDocuments(query);

        if (!attendance || attendance.length === 0) {
            return res.status(404).json({ message: 'No attendance records found' });
        }

        // Student-specific report
        if (studentId) {
            const studentAttendance = attendance.map(record => {
                const studentRecord = record.records.find(r => 
                    r.studentId && r.studentId._id.toString() === studentId
                );
                return {
                    date: record.date,
                    subject: record.subject,
                    status: studentRecord ? studentRecord.status : 'Not Marked',
                    takenBy: record.takenBy
                };
            }).filter(r => r.status !== 'Not Marked');

            // Calculate summary
            const summary = {
                total: studentAttendance.length,
                present: studentAttendance.filter(r => r.status === 'Present').length,
                absent: studentAttendance.filter(r => r.status === 'Absent').length,
                late: studentAttendance.filter(r => r.status === 'Late').length,
                attendancePercentage: studentAttendance.length > 0 
                    ? ((studentAttendance.filter(r => r.status === 'Present' || r.status === 'Late').length / studentAttendance.length) * 100).toFixed(2)
                    : 0
            };

            return res.json({
                studentId,
                attendance: studentAttendance,
                summary,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            });
        }

        // Class summary
        const summary = attendance.reduce((acc, curr) => {
            curr.records.forEach(record => {
                if (record.status === 'Present') acc.present++;
                else if (record.status === 'Absent') acc.absent++;
                else if (record.status === 'Late') acc.late++;
                acc.total++;
            });
            return acc;
        }, { total: 0, present: 0, absent: 0, late: 0 });

        // Calculate percentage
        summary.attendancePercentage = summary.total > 0 
            ? (((summary.present + summary.late) / summary.total) * 100).toFixed(2)
            : 0;

        res.json({
            attendance,
            summary,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (error) {
        console.error('Get attendance report error:', error);
        res.status(500).json({ message: 'Failed to fetch attendance report' });
    }
};

// @desc    Get Today's Attendance
// @route   GET /api/attendance/today
// @access  Private
exports.getTodayAttendance = async (req, res) => {
    const { studentClass, section, subject } = req.query;
    
    try {
        const today = new Date().toISOString().split('T')[0];
        
        const query = {
            schoolCode: req.user.schoolCode,
            date: today
        };

        if (studentClass) query.studentClass = studentClass;
        if (section) query.section = section;
        if (subject) query.subject = subject;

        const attendance = await Attendance.find(query)
            .populate('records.studentId', 'name roll')
            .populate('takenBy', 'name')
            .sort({ createdAt: -1 });

        // Check if attendance taken for each class/section
        const classes = await Student.aggregate([
            { 
                $match: { 
                    schoolCode: req.user.schoolCode,
                    ...(studentClass && { studentClass }),
                    ...(section && { section })
                } 
            },
            {
                $group: {
                    _id: { class: '$studentClass', section: '$section' },
                    totalStudents: { $sum: 1 }
                }
            },
            { $sort: { '_id.class': 1, '_id.section': 1 } }
        ]);

        const result = classes.map(c => {
            const taken = attendance.find(a => 
                a.studentClass === c._id.class && a.section === c._id.section
            );
            return {
                class: c._id.class,
                section: c._id.section,
                totalStudents: c.totalStudents,
                taken: !!taken,
                attendanceId: taken?._id,
                takenBy: taken?.takenBy,
                time: taken?.createdAt
            };
        });

        res.json({
            date: today,
            status: result
        });

    } catch (error) {
        console.error('Get today attendance error:', error);
        res.status(500).json({ message: 'Failed to fetch today\'s attendance' });
    }
};

// @desc    Get Monthly Report
// @route   GET /api/attendance/monthly
// @access  Private
exports.getMonthlyReport = async (req, res) => {
    const { studentClass, section, month, year, studentId } = req.query;
    
    try {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);

        const query = {
            schoolCode: req.user.schoolCode,
            date: { $gte: startDate, $lte: endDate }
        };

        if (studentClass) query.studentClass = studentClass;
        if (section) query.section = section;

        const attendance = await Attendance.find(query)
            .populate('records.studentId', 'name roll')
            .sort({ date: 1 });

        // If specific student requested
        if (studentId) {
            const studentAttendance = attendance.map(day => {
                const record = day.records.find(r => r.studentId._id.toString() === studentId);
                return {
                    date: day.date,
                    status: record ? record.status : 'No Record'
                };
            });

            const summary = {
                present: studentAttendance.filter(d => d.status === 'Present').length,
                absent: studentAttendance.filter(d => d.status === 'Absent').length,
                late: studentAttendance.filter(d => d.status === 'Late').length,
                total: studentAttendance.length
            };

            return res.json({
                studentId,
                month,
                year,
                attendance: studentAttendance,
                summary
            });
        }

        // Class-wise report
        const studentStats = {};

        attendance.forEach(day => {
            day.records.forEach(record => {
                const studentId = record.studentId._id.toString();
                if (!studentStats[studentId]) {
                    studentStats[studentId] = {
                        name: record.studentId.name,
                        roll: record.studentId.roll,
                        present: 0,
                        absent: 0,
                        late: 0,
                        total: 0
                    };
                }
                
                if (record.status === 'Present') studentStats[studentId].present++;
                else if (record.status === 'Absent') studentStats[studentId].absent++;
                else if (record.status === 'Late') studentStats[studentId].late++;
                studentStats[studentId].total++;
            });
        });

        // Calculate percentages
        Object.values(studentStats).forEach(stat => {
            stat.attendancePercentage = stat.total > 0 
                ? (((stat.present + stat.late) / stat.total) * 100).toFixed(2)
                : 0;
        });

        res.json({
            month,
            year,
            totalDays: attendance.length,
            stats: Object.values(studentStats).sort((a, b) => a.roll - b.roll)
        });

    } catch (error) {
        console.error('Get monthly report error:', error);
        res.status(500).json({ message: 'Failed to fetch monthly report' });
    }
};

// @desc    Export Attendance to Excel
// @route   GET /api/attendance/export
// @access  Private
exports.exportAttendance = async (req, res) => {
    const { studentClass, section, startDate, endDate } = req.query;
    
    try {
        const query = {
            schoolCode: req.user.schoolCode,
            studentClass,
            section,
            date: { $gte: new Date(startDate), $lte: new Date(endDate) }
        };

        const attendance = await Attendance.find(query)
            .populate('records.studentId', 'name roll')
            .sort({ date: 1 });

        if (!attendance.length) {
            return res.status(404).json({ message: 'No data found' });
        }

        // Create Excel
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Attendance');

        // Get all students
        const students = await Student.find({ 
            schoolCode: req.user.schoolCode,
            studentClass,
            section 
        }).select('name roll').sort('roll');

        // Headers
        const headers = ['Student Name', 'Roll'];
        attendance.forEach(day => {
            headers.push(new Date(day.date).toLocaleDateString());
        });
        worksheet.addRow(headers);

        // Data rows
        students.forEach(student => {
            const row = [student.name, student.roll];
            
            attendance.forEach(day => {
                const record = day.records.find(r => 
                    r.studentId._id.toString() === student._id.toString()
                );
                row.push(record ? record.status : '-');
            });
            
            worksheet.addRow(row);
        });

        // Summary row
        const summaryRow = ['Summary', ''];
        attendance.forEach(day => {
            const present = day.records.filter(r => r.status === 'Present').length;
            const absent = day.records.filter(r => r.status === 'Absent').length;
            summaryRow.push(`P:${present}/A:${absent}`);
        });
        worksheet.addRow(summaryRow);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=attendance_${studentClass}_${section}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export attendance error:', error);
        res.status(500).json({ message: 'Failed to export attendance' });
    }
};

// @desc    Delete Attendance
// @route   DELETE /api/attendance/:id
// @access  Private (Principal only)
exports.deleteAttendance = async (req, res) => {
    try {
        if (req.user.role !== 'principal') {
            return res.status(403).json({ message: 'Access denied. Principal only.' });
        }

        const attendance = await Attendance.findById(req.params.id);
        
        if (!attendance || attendance.schoolCode !== req.user.schoolCode) {
            return res.status(404).json({ message: 'Attendance not found' });
        }

        await attendance.deleteOne();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'ATTENDANCE_DELETED',
            details: { 
                class: attendance.studentClass, 
                section: attendance.section, 
                date: attendance.date 
            },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ message: 'Attendance deleted successfully' });

    } catch (error) {
        console.error('Delete attendance error:', error);
        res.status(500).json({ message: 'Failed to delete attendance' });
    }
};