/**
 * 🎓 PARENT CONTROLLER
 * Complete parent dashboard implementation
 */

const mongoose = require('mongoose');

// MongoDB Models
const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/AdvancedAttendance');
const Result = require('../models/Result');
const Fee = require('../models/Fee');
const Notice = require('../models/Notice');
const { resolveStudentObjectIdFromUser } = require('../utils/resolveStudentFromUser');

function guardianEmailRegex(email) {
    const e = String(email || '').trim();
    if (!e) return null;
    const safe = e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${safe}$`, 'i');
}

/**
 * Parent may pick a child that is either a Student doc or a User (student login).
 * Returns { studentObjectId } for Result/Fee queries (Student collection id), or null.
 */
async function assertParentCanAccessChild(req, childId) {
    const schoolCode = req.user.schoolCode;
    const parentId = req.user._id || req.user.id;
    const parentEmail = String(req.user.email || '').trim().toLowerCase();
    const gRe = guardianEmailRegex(req.user.email);

    const byStudent = await Student.findOne({
        _id: childId,
        schoolCode,
        isActive: true,
        $or: [{ parentId }, ...(gRe ? [{ 'guardian.email': gRe }] : [])]
    }).select('_id');

    if (byStudent) {
        return { studentObjectId: byStudent._id };
    }

    const childUser = await User.findOne({
        _id: childId,
        role: 'student',
        schoolCode
    }).select('parentInfo email classId section rollNumber schoolCode');

    if (!childUser) {
        return null;
    }

    const childParentEmail = String(childUser.parentInfo?.email || '').trim().toLowerCase();
    if (childParentEmail !== parentEmail) {
        return null;
    }

    const oid = await resolveStudentObjectIdFromUser(childUser);
    return { studentObjectId: oid, childUser };
}

/**
 * @desc    Get parent dashboard
 * @route   GET /api/parent/dashboard
 * @access  Parent only
 */
exports.getParentDashboard = async (req, res) => {
    try {
        const parentId = req.user._id || req.user.id;
        const schoolCode = req.user.schoolCode;
        const gRe = guardianEmailRegex(req.user.email);

        let children = [];
        let attendanceSummary = [];
        let resultsSummary = [];
        let feeSummary = [];

        // MongoDB with populate
        try {
            children = await Student.find({
                schoolCode,
                isActive: true,
                $or: [{ parentId }, ...(gRe ? [{ 'guardian.email': gRe }] : [])]
            });

            attendanceSummary = await Promise.all(
                children.map(async (child) => {
                    const attendance = await Attendance.find({
                        studentId: child._id,
                        schoolCode
                    }).sort({ date: -1 }).limit(30);
                    
                    const presentCount = attendance.filter(a => a.status === 'present').length;
                    const totalCount = attendance.length;
                    const percentage = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;

                    return {
                        studentId: child._id,
                        studentName: child.name,
                        attendancePercentage: Math.round(percentage),
                        lastAttendance: attendance[0] || null
                    };
                })
            );

            resultsSummary = await Promise.all(
                children.map(async (child) => {
                    const results = await Result.find({
                        studentId: child._id,
                        schoolCode
                    }).sort({ createdAt: -1 }).limit(5);

                    return {
                        studentId: child._id,
                        studentName: child.name,
                        recentResults: results
                    };
                })
            );

            feeSummary = await Promise.all(
                children.map(async (child) => {
                    const fees = await Fee.find({
                        studentId: child._id,
                        schoolCode
                    }).sort({ year: -1, month: -1 }).limit(6);

                    const totalDue = fees.reduce((sum, fee) => {
                        return sum + Math.max(0, (fee.amountDue || 0) - (fee.amountPaid || 0));
                    }, 0);
                    const upcomingFees = fees.filter((fee) =>
                        Math.max(0, (fee.amountDue || 0) - (fee.amountPaid || 0)) > 0
                    );
                    const nextDue = upcomingFees[0]
                        ? new Date(upcomingFees[0].year, Math.max(0, (upcomingFees[0].month || 1) - 1), 1)
                        : null;

                    return {
                        studentId: child._id,
                        studentName: child.name,
                        totalDue,
                        upcomingFees: upcomingFees.length,
                        nextDueDate: nextDue
                    };
                })
            );
        } catch (dbError) {
            console.error('Parent dashboard DB error:', dbError.message);
        }

        // Get notices relevant to parents
        let notices = [];
        try {
            const schoolId = req.tenant?.schoolId || req.user.schoolId;
            notices = await Notice.find({
                $and: [
                    { $or: [{ schoolId }, { isGlobal: true }] },
                    { isDeleted: false },
                    { status: 'active' },
                    { isPublished: true },
                    { publishDate: { $lte: new Date() } },
                    { $or: [{ expiryDate: { $gt: new Date() } }, { expiryDate: null }] },
                    {
                        $or: [
                            { targetType: 'all' },
                            { targetType: 'parent' },
                            { targetType: 'role', targetRoles: { $in: ['parent'] } },
                            { targetRoles: { $in: ['parent'] } },
                            { targetRoles: { $size: 0 } },
                            { targetRoles: { $exists: false } }
                        ]
                    }
                ]
            })
                .sort({ isPinned: -1, pinOrder: 1, publishDate: -1, createdAt: -1 })
                .limit(10);
        } catch (noticeError) {
            console.error('Notice fetch error:', noticeError.message);
        }

        const dashboard = {
            children: children.map(child => ({
                id: child._id,
                name: child.name,
                className: child.studentClass || 'N/A',
                sectionName: child.section || 'N/A',
                rollNumber: child.roll || null,
                profileImage: child.photo?.url || null
            })),
            attendanceSummary,
            resultsSummary,
            feeSummary,
            recentNotices: notices,
            summary: {
                totalChildren: children.length,
                childrenWithLowAttendance: attendanceSummary.filter(a => a.attendancePercentage < 75).length,
                totalFeesDue: feeSummary.reduce((sum, f) => sum + f.totalDue, 0),
                upcomingExams: 0 // Can be calculated from results
            }
        };

        res.status(200).json({
            success: true,
            data: dashboard
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
 * @desc    Get children details
 * @route   GET /api/parent/children
 * @access  Parent only
 */
exports.getChildren = async (req, res) => {
    try {
        const parentId = req.user._id || req.user.id;
        const schoolCode = req.user.schoolCode;
        const gRe = guardianEmailRegex(req.user.email);

        const fromStudents = await Student.find({
            schoolCode,
            isActive: true,
            $or: [{ parentId }, ...(gRe ? [{ 'guardian.email': gRe }] : [])]
        }).lean();

        const parentEmailNorm = String(req.user.email || '').trim().toLowerCase();
        const fromUsers = parentEmailNorm
            ? await User.find({
                  schoolCode,
                  role: 'student',
                  'parentInfo.email': new RegExp(
                      `^${parentEmailNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
                      'i'
                  )
              })
                  .select('name email rollNumber section classId')
                  .populate('classId', 'className section')
                  .lean()
            : [];

        const mappedStudents = fromStudents.map((student) => ({
            _id: String(student._id),
            source: 'student',
            studentObjectId: String(student._id),
            name: student.name,
            rollNumber: student.roll,
            studentClass: student.studentClass || null,
            section: student.section || null
        }));

        const mappedUsers = fromUsers.map((user) => ({
            _id: String(user._id),
            source: 'user',
            studentObjectId: null,
            name: user.name,
            rollNumber: user.rollNumber || null,
            studentClass: user.classId?.className || null,
            section: user.section || user.classId?.section || null
        }));

        const seen = new Set();
        const merged = [...mappedStudents];
        for (const row of mappedStudents) {
            seen.add(
                `${String(row.name || '').toLowerCase()}|${String(row.rollNumber || '')}|${String(
                    row.studentClass || ''
                )}|${String(row.section || '')}`
            );
        }
        for (const row of mappedUsers) {
            const key = `${String(row.name || '').toLowerCase()}|${String(row.rollNumber || '')}|${String(
                row.studentClass || ''
            )}|${String(row.section || '')}`;
            if (!seen.has(key)) {
                merged.push(row);
                seen.add(key);
            }
        }

        res.status(200).json({
            success: true,
            code: 'PARENT_CHILDREN_FETCHED',
            message: 'Children fetched successfully',
            data: merged
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
 * @desc    Get child attendance
 * @route   GET /api/parent/attendance/:studentId
 * @access  Parent only
 */
exports.getChildAttendance = async (req, res) => {
    try {
        const { studentId } = req.params;
        const schoolCode = req.user.schoolCode;

        const access = await assertParentCanAccessChild(req, studentId);
        if (!access) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const attendanceStudentId = access.studentObjectId || studentId;

        const attendance = await Attendance.find({
            studentId: attendanceStudentId,
            schoolCode
        }).sort({ date: -1 }).limit(100);

        // Calculate attendance statistics
        const presentCount = attendance.filter(a => a.status === 'present').length;
        const absentCount = attendance.filter(a => a.status === 'absent').length;
        const leaveCount = attendance.filter(a => a.status === 'leave').length;
        const totalCount = attendance.length;
        const percentage = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;

        res.status(200).json({
            success: true,
            data: {
                attendance,
                statistics: {
                    present: presentCount,
                    absent: absentCount,
                    leave: leaveCount,
                    total: totalCount,
                    percentage: Math.round(percentage)
                }
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
 * @desc    Get child results
 * @route   GET /api/parent/results/:studentId
 * @access  Parent only
 */
exports.getChildResults = async (req, res) => {
    try {
        const { studentId } = req.params;
        const schoolCode = req.user.schoolCode;

        const access = await assertParentCanAccessChild(req, studentId);
        if (!access) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (!access.studentObjectId) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'Child has no linked Student record yet; results will appear after enrollment is synced.'
            });
        }

        const results = await Result.find({
            studentId: access.studentObjectId,
            schoolCode,
            isPublished: true
        })
            .sort({ examDate: -1 })
            .lean();

        const rows = [];
        for (const doc of results) {
            if (doc.subjects && doc.subjects.length > 0) {
                for (const sub of doc.subjects) {
                    rows.push({
                        examName: doc.examName,
                        examDate: doc.examDate,
                        subjectName: sub.subjectName,
                        marks: sub.marks,
                        grade: sub.grade,
                        resultId: doc._id
                    });
                }
            } else {
                rows.push({
                    examName: doc.examName,
                    examDate: doc.examDate,
                    subjectName: 'Overall',
                    marks: doc.totalMarks,
                    grade: doc.gpa != null ? String(doc.gpa) : '—',
                    resultId: doc._id
                });
            }
        }

        res.status(200).json({
            success: true,
            data: rows
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
 * @desc    Get child fees
 * @route   GET /api/parent/fees/:studentId
 * @access  Parent only
 */
exports.getChildFees = async (req, res) => {
    try {
        const { studentId } = req.params;
        const schoolCode = req.user.schoolCode;

        const access = await assertParentCanAccessChild(req, studentId);
        if (!access) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (!access.studentObjectId) {
            return res.status(200).json({
                success: true,
                data: {
                    fees: [],
                    summary: {
                        totalFees: 0,
                        totalPaid: 0,
                        totalDue: 0,
                        unpaidCount: 0
                    }
                },
                message: 'No fee ledger for this child until a Student record is linked.'
            });
        }

        const fees = await Fee.find({
            studentId: access.studentObjectId,
            schoolCode
        }).sort({ createdAt: -1 });

        const totalDue = fees.reduce(
            (sum, fee) =>
                sum +
                Math.max(
                    0,
                    (fee.amountDue != null ? fee.amountDue : fee.amount || 0) -
                        (fee.amountPaid != null ? fee.amountPaid : 0)
                ),
            0
        );
        const paidAmount = fees.reduce((sum, fee) => sum + (fee.amountPaid != null ? fee.amountPaid : 0), 0);
        const totalAssessed = fees.reduce(
            (sum, fee) => sum + (fee.amountDue != null ? fee.amountDue : fee.amount || 0),
            0
        );

        res.status(200).json({
            success: true,
            data: {
                fees,
                summary: {
                    totalFees: totalAssessed,
                    totalPaid: paidAmount,
                    totalDue,
                    unpaidCount: fees.filter((f) => f.status === 'Unpaid' || f.status === 'unpaid').length
                }
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
 * @desc    Get parent profile
 * @route   GET /api/parent/profile
 * @access  Parent only
 */
exports.getParentProfile = async (req, res) => {
    try {
        const parentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const parent = await User.findById(parentId).select('-password');
        
        if (!parent) {
            return res.status(404).json({
                success: false,
                message: 'Parent not found'
            });
        }

        res.status(200).json({
            success: true,
            data: parent
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
 * @desc    Update parent profile
 * @route   PUT /api/parent/profile
 * @access  Parent only
 */
exports.updateParentProfile = async (req, res) => {
    try {
        const parentId = req.user.id;
        const { name, email, phone, address } = req.body;

        const parent = await User.findByIdAndUpdate(
            parentId,
            { name, email, phone, address },
            { new: true, runValidators: true }
        ).select('-password');

        if (!parent) {
            return res.status(404).json({
                success: false,
                message: 'Parent not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: parent
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
