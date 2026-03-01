/**
 * 📅 ADVANCED ROUTINE CONTROLLER
 * Industry-level routine management with drag-drop UI and conflict detection
 */

const AdvancedRoutine = require('../models/AdvancedRoutine');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const Room = require('../models/Room');
const AcademicSession = require('../models/AcademicSession');
const School = require('../models/School');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Create Weekly Routine
 * @route   POST /api/routine/weekly
 * @access  Principal
 */
exports.createWeeklyRoutine = async (req, res) => {
    try {
        const { 
            classId, 
            sectionId, 
            academicSessionId,
            routines 
        } = req.body;

        const schoolId = req.tenant.schoolId;

        // Validate academic session
        const academicSession = await AcademicSession.findOne({
            _id: academicSessionId,
            schoolId
        });

        if (!academicSession) {
            return res.status(400).json({
                success: false,
                message: 'Invalid academic session'
            });
        }

        // Validate class
        const classInfo = await Class.findOne({
            _id: classId,
            schoolId
        });

        if (!classInfo) {
            return res.status(400).json({
                success: false,
                message: 'Invalid class'
            });
        }

        const createdRoutines = [];
        const conflicts = [];

        // Process each routine
        for (const routineData of routines) {
            const {
                day,
                periodNumber,
                startTime,
                endTime,
                subjectId,
                teacherId,
                roomId,
                notes
            } = routineData;

            // Create routine
            const routine = new AdvancedRoutine({
                schoolId,
                academicSessionId,
                classId,
                sectionId,
                day,
                periodNumber,
                startTime,
                endTime,
                subjectId,
                teacherId,
                roomId,
                notes,
                createdBy: req.user.id,
                status: 'draft'
            });

            // Detect conflicts
            await routine.detectConflicts();

            if (routine.hasConflicts()) {
                conflicts.push({
                    routine: routineData,
                    conflicts: routine.getUnresolvedConflicts()
                });
            }

            await routine.save();
            createdRoutines.push(routine);
        }

        // Log activity
        await AuditLog.create({
            action: 'create_weekly_routine',
            resource: 'routine',
            userId: req.user.id,
            userRole: req.user.role,
            schoolId,
            details: {
                classId,
                sectionId,
                academicSessionId,
                totalRoutines: createdRoutines.length,
                conflictsFound: conflicts.length
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(201).json({
            success: true,
            message: 'Weekly routine created successfully',
            data: {
                routines: createdRoutines,
                conflicts,
                summary: {
                    totalCreated: createdRoutines.length,
                    conflictsFound: conflicts.length,
                    canPublish: conflicts.length === 0
                }
            }
        });
    } catch (error) {
        console.error('Create weekly routine error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Drag and Drop Update Routine
 * @route   PUT /api/routine/drag-drop
 * @access  Principal
 */
exports.dragDropUpdate = async (req, res) => {
    try {
        const {
            routineId,
            newDay,
            newPeriodNumber,
            newStartTime,
            newEndTime,
            newRoomId
        } = req.body;

        const schoolId = req.tenant.schoolId;

        // Find routine
        const routine = await AdvancedRoutine.findOne({
            _id: routineId,
            schoolId
        });

        if (!routine) {
            return res.status(404).json({
                success: false,
                message: 'Routine not found'
            });
        }

        // Store old values for audit
        const oldValues = {
            day: routine.day,
            periodNumber: routine.periodNumber,
            startTime: routine.startTime,
            endTime: routine.endTime,
            roomId: routine.roomId
        };

        // Update routine
        routine.day = newDay;
        routine.periodNumber = newPeriodNumber;
        routine.startTime = newStartTime;
        routine.endTime = newEndTime;
        routine.roomId = newRoomId;
        routine.updatedBy = req.user.id;

        // Detect conflicts after update
        await routine.detectConflicts();

        if (routine.hasConflicts()) {
            return res.status(409).json({
                success: false,
                message: 'Update would create conflicts',
                data: {
                    conflicts: routine.getUnresolvedConflicts(),
                    routine
                }
            });
        }

        await routine.save();

        // Log activity
        await AuditLog.create({
            action: 'drag_drop_update_routine',
            resource: 'routine',
            resourceId: routine._id,
            userId: req.user.id,
            userRole: req.user.role,
            schoolId,
            details: {
                oldValues,
                newValues: {
                    day: newDay,
                    periodNumber: newPeriodNumber,
                    startTime: newStartTime,
                    endTime: newEndTime,
                    roomId: newRoomId
                }
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Routine updated successfully',
            data: routine
        });
    } catch (error) {
        console.error('Drag drop update error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Get Weekly Routine
 * @route   GET /api/routine/weekly/:classId/:sectionId/:academicSessionId
 * @access  Principal, Teacher, Student
 */
exports.getWeeklyRoutine = async (req, res) => {
    try {
        const { classId, sectionId, academicSessionId } = req.params;
        const schoolId = req.tenant.schoolId;

        const routines = await AdvancedRoutine.getWeeklyRoutine(
            schoolId,
            classId,
            sectionId
        );

        // Group by day
        const weeklyRoutine = {};
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        days.forEach(day => {
            weeklyRoutine[day] = routines
                .filter(routine => routine.day === day)
                .sort((a, b) => a.periodNumber - b.periodNumber);
        });

        res.status(200).json({
            success: true,
            data: {
                weeklyRoutine,
                summary: {
                    totalPeriods: routines.length,
                    conflicts: routines.filter(r => r.hasConflicts()).length
                }
            }
        });
    } catch (error) {
        console.error('Get weekly routine error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Publish Routine
 * @route   POST /api/routine/publish
 * @access  Principal
 */
exports.publishRoutine = async (req, res) => {
    try {
        const { classId, sectionId, academicSessionId } = req.body;
        const schoolId = req.tenant.schoolId;

        // Check for conflicts before publishing
        const conflicts = await AdvancedRoutine.detectAllConflicts(schoolId, academicSessionId);

        if (conflicts.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Cannot publish routine with unresolved conflicts',
                data: { conflicts }
            });
        }

        // Update all routines to published status
        const result = await AdvancedRoutine.updateMany(
            {
                schoolId,
                classId,
                sectionId,
                academicSessionId,
                status: 'draft'
            },
            {
                status: 'published',
                publishedBy: req.user.id,
                publishedAt: new Date()
            }
        );

        // Log activity
        await AuditLog.create({
            action: 'publish_routine',
            resource: 'routine',
            userId: req.user.id,
            userRole: req.user.role,
            schoolId,
            details: {
                classId,
                sectionId,
                academicSessionId,
                routinesPublished: result.modifiedCount
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Routine published successfully',
            data: {
                routinesPublished: result.modifiedCount
            }
        });
    } catch (error) {
        console.error('Publish routine error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Get Teacher Schedule
 * @route   GET /api/routine/teacher/:teacherId
 * @access  Teacher, Principal
 */
exports.getTeacherSchedule = async (req, res) => {
    try {
        const { teacherId } = req.params;
        const { startDate, endDate, day } = req.query;
        const schoolId = req.tenant.schoolId;

        // Check authorization
        if (req.user.role !== 'principal' && req.user.id !== teacherId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const schedule = await AdvancedRoutine.getTeacherSchedule(
            schoolId,
            teacherId,
            startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            endDate ? new Date(endDate) : new Date()
        );

        res.status(200).json({
            success: true,
            data: {
                schedule,
                summary: {
                    totalPeriods: schedule.length,
                    conflicts: schedule.filter(r => r.hasConflicts()).length
                }
            }
        });
    } catch (error) {
        console.error('Get teacher schedule error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Detect All Conflicts
 * @route   GET /api/routine/conflicts/:academicSessionId
 * @access  Principal
 */
exports.detectAllConflicts = async (req, res) => {
    try {
        const { academicSessionId } = req.params;
        const schoolId = req.tenant.schoolId;

        const conflicts = await AdvancedRoutine.detectAllConflicts(schoolId, academicSessionId);

        res.status(200).json({
            success: true,
            data: {
                conflicts,
                summary: {
                    totalConflicts: conflicts.length,
                    criticalConflicts: conflicts.filter(c => 
                        c.conflicts.some(conf => conf.severity === 'critical')
                    ).length
                }
            }
        });
    } catch (error) {
        console.error('Detect conflicts error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Resolve Conflict
 * @route   PUT /api/routine/:routineId/resolve-conflict/:conflictIndex
 * @access  Principal
 */
exports.resolveConflict = async (req, res) => {
    try {
        const { routineId, conflictIndex } = req.params;
        const schoolId = req.tenant.schoolId;

        const routine = await AdvancedRoutine.findOne({
            _id: routineId,
            schoolId
        });

        if (!routine) {
            return res.status(404).json({
                success: false,
                message: 'Routine not found'
            });
        }

        routine.resolveConflict(parseInt(conflictIndex), req.user.id);
        await routine.save();

        // Log activity
        await AuditLog.create({
            action: 'resolve_conflict',
            resource: 'routine',
            resourceId: routine._id,
            userId: req.user.id,
            userRole: req.user.role,
            schoolId,
            details: {
                conflictIndex,
                routineId
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(200).json({
            success: true,
            message: 'Conflict resolved successfully',
            data: routine
        });
    } catch (error) {
        console.error('Resolve conflict error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Create Exam Routine
 * @route   POST /api/routine/exam
 * @access  Principal
 */
exports.createExamRoutine = async (req, res) => {
    try {
        const {
            examName,
            examType,
            classId,
            sectionId,
            academicSessionId,
            examSchedule
        } = req.body;

        const schoolId = req.tenant.schoolId;

        const createdRoutines = [];

        for (const schedule of examSchedule) {
            const {
                subjectId,
                examDate,
                startTime,
                endTime,
                roomId,
                maxStudents
            } = schedule;

            const routine = new AdvancedRoutine({
                schoolId,
                academicSessionId,
                classId,
                sectionId,
                day: examDate.getDay(), // Convert to day name
                periodNumber: 1, // Exam periods are typically single
                startTime,
                endTime,
                subjectId,
                roomId,
                routineType: 'exam',
                notes: `${examName} - ${examType}`,
                createdBy: req.user.id,
                status: 'draft'
            });

            await routine.detectConflicts();
            await routine.save();
            createdRoutines.push(routine);
        }

        // Log activity
        await AuditLog.create({
            action: 'create_exam_routine',
            resource: 'routine',
            userId: req.user.id,
            userRole: req.user.role,
            schoolId,
            details: {
                examName,
                examType,
                classId,
                sectionId,
                totalExams: createdRoutines.length
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(201).json({
            success: true,
            message: 'Exam routine created successfully',
            data: {
                examName,
                examType,
                routines: createdRoutines
            }
        });
    } catch (error) {
        console.error('Create exam routine error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

/**
 * @desc    Get Routine Analytics
 * @route   GET /api/routine/analytics
 * @access  Principal
 */
exports.getRoutineAnalytics = async (req, res) => {
    try {
        const { academicSessionId } = req.query;
        const schoolId = req.tenant.schoolId;

        // Get routine statistics
        const stats = await AdvancedRoutine.aggregate([
            { $match: { schoolId, academicSessionId: new mongoose.Types.ObjectId(academicSessionId) } },
            {
                $group: {
                    _id: null,
                    totalRoutines: { $sum: 1 },
                    publishedRoutines: {
                        $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] }
                    },
                    draftRoutines: {
                        $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
                    },
                    conflictsCount: {
                        $sum: { $cond: [{ $gt: [{ $size: '$conflicts' }, 0] }, 1, 0] }
                    }
                }
            }
        ]);

        // Get teacher load distribution
        const teacherLoad = await AdvancedRoutine.aggregate([
            { $match: { schoolId, academicSessionId: new mongoose.Types.ObjectId(academicSessionId) } },
            {
                $group: {
                    _id: '$teacherId',
                    load: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'teacher'
                }
            },
            { $unwind: '$teacher' },
            {
                $project: {
                    teacherName: '$teacher.name',
                    teacherEmail: '$teacher.email',
                    load: 1
                }
            },
            { $sort: { load: -1 } }
        ]);

        // Get room utilization
        const roomUtilization = await AdvancedRoutine.aggregate([
            { $match: { schoolId, academicSessionId: new mongoose.Types.ObjectId(academicSessionId) } },
            {
                $group: {
                    _id: '$roomId',
                    utilization: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'rooms',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'room'
                }
            },
            { $unwind: '$room' },
            {
                $project: {
                    roomNumber: '$room.roomNumber',
                    roomCapacity: '$room.capacity',
                    utilization: 1
                }
            },
            { $sort: { utilization: -1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                stats: stats[0] || {},
                teacherLoad,
                roomUtilization
            }
        });
    } catch (error) {
        console.error('Get routine analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    createWeeklyRoutine: exports.createWeeklyRoutine,
    dragDropUpdate: exports.dragDropUpdate,
    getWeeklyRoutine: exports.getWeeklyRoutine,
    publishRoutine: exports.publishRoutine,
    getTeacherSchedule: exports.getTeacherSchedule,
    detectAllConflicts: exports.detectAllConflicts,
    resolveConflict: exports.resolveConflict,
    createExamRoutine: exports.createExamRoutine,
    getRoutineAnalytics: exports.getRoutineAnalytics
};
