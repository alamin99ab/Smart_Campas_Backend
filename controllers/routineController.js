const ClassRoutine = require('../models/ClassRoutine');
const AuditLog = require('../models/AuditLog');
const Teacher = require('../models/Teacher');
const User = require('../models/User');
const { createNotification } = require('../utils/createNotification');

async function checkRoutineConflicts(schoolCode, day, periods, academicYear, excludeRoutineId = null) {
    const errors = [];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const teacherPeriodCount = {};
    const periodTeacherMap = {};
    const periodRoomMap = {};

    for (const p of periods) {
        const pid = p.period || p.periodNumber;
        const tid = p.teacher?.toString?.() || p.teacher;
        const room = (p.room || p.roomNumber || '').toString().trim();

        if (tid) {
            periodTeacherMap[pid] = periodTeacherMap[pid] || [];
            if (!periodTeacherMap[pid].includes(tid)) periodTeacherMap[pid].push(tid);
        }
        if (room) {
            periodRoomMap[pid] = periodRoomMap[pid] || [];
            if (!periodRoomMap[pid].includes(room)) periodRoomMap[pid].push(room);
        }
    }

    const existingRoutines = await ClassRoutine.find({
        schoolCode,
        day,
        academicYear,
        isActive: true,
        ...(excludeRoutineId && { _id: { $ne: excludeRoutineId } })
    }).lean();

    for (const r of existingRoutines) {
        for (const p of r.periods || []) {
            const pid = p.period || p.periodNumber;
            const tid = p.teacher?.toString?.();
            const room = (p.room || '').toString().trim();
            if (tid) {
                periodTeacherMap[pid] = periodTeacherMap[pid] || [];
                if (!periodTeacherMap[pid].includes(tid)) periodTeacherMap[pid].push(tid);
            }
            if (room) {
                periodRoomMap[pid] = periodRoomMap[pid] || [];
                if (!periodRoomMap[pid].includes(room)) periodRoomMap[pid].push(room);
            }
        }
    }

    for (const p of periods) {
        const pid = p.period || p.periodNumber;
        const tid = p.teacher?.toString?.() || p.teacher;
        const room = (p.room || p.roomNumber || '').toString().trim();

        if (periodTeacherMap[pid]?.filter(t => t === tid).length > 1) {
            errors.push({ type: 'TEACHER_CONFLICT', period: pid, message: 'Same teacher assigned at same time slot' });
        }
        if (room && periodRoomMap[pid]?.filter(r => r === room).length > 1) {
            errors.push({ type: 'ROOM_CONFLICT', period: pid, room, message: 'Same room booked at same time slot' });
        }

        if (tid) {
            teacherPeriodCount[tid] = (teacherPeriodCount[tid] || 0) + 1;
        }
    }

    const allRoutines = await ClassRoutine.find({
        schoolCode,
        academicYear,
        isActive: true,
        ...(excludeRoutineId && { _id: { $ne: excludeRoutineId } })
    }).lean();

    const teacherWeeklyCount = {};
    for (const r of allRoutines) {
        for (const p of r.periods || []) {
            const tid = p.teacher?.toString?.();
            if (tid) teacherWeeklyCount[tid] = (teacherWeeklyCount[tid] || 0) + 1;
        }
    }
    for (const tid of Object.keys(teacherPeriodCount)) {
        teacherWeeklyCount[tid] = (teacherWeeklyCount[tid] || 0) + (teacherPeriodCount[tid] || 0);
    }

    for (const [tid, count] of Object.entries(teacherWeeklyCount)) {
        const teacher = await Teacher.findOne({ userId: tid, schoolCode }).lean();
        const maxLoad = teacher?.maxPeriodsPerWeek ?? 30;
        if (count > maxLoad) {
            errors.push({ type: 'TEACHER_LOAD_EXCEEDED', teacherId: tid, count, maxLoad, message: `Teacher load exceeded (${count} > ${maxLoad})` });
        }
    }

    return errors;
}

exports.checkConflicts = async (req, res) => {
    try {
        const { studentClass, section, day, periods, academicYear } = req.body;
        if (!day || !periods || !Array.isArray(periods) || !academicYear) {
            return res.status(400).json({ success: false, message: 'Day, periods, and academic year required' });
        }
        const errors = await checkRoutineConflicts(req.user.schoolCode, day, periods, academicYear);
        res.json({ success: true, data: { valid: errors.length === 0, conflicts: errors } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createRoutine = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { studentClass, section, day, periods, academicYear, semester } = req.body;

        if (!studentClass || !day || !periods || !Array.isArray(periods) || !academicYear) {
            return res.status(400).json({ success: false, message: 'Class, day, periods, and academic year are required' });
        }

        const conflicts = await checkRoutineConflicts(req.user.schoolCode, day, periods, academicYear);
        if (conflicts.length > 0) {
            return res.status(400).json({ success: false, message: 'Routine conflicts detected', conflicts });
        }

        const routine = await ClassRoutine.create({
            schoolCode: req.user.schoolCode,
            studentClass,
            section: section || null,
            day,
            periods,
            academicYear,
            semester,
            createdBy: req.user._id
        });

        await AuditLog.create({
            user: req.user._id,
            action: 'ROUTINE_CREATED',
            details: { routineId: routine._id, class: studentClass, day },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({ success: true, data: routine });
    } catch (err) {
        console.error('Create routine error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Routine already exists for this class/day/year' });
        }
        res.status(500).json({ success: false, message: 'Failed to create routine' });
    }
};

exports.getRoutines = async (req, res) => {
    try {
        const { studentClass, section, day, academicYear } = req.query;
        const query = { schoolCode: req.user.schoolCode, isActive: true };
        if (studentClass) query.studentClass = studentClass;
        if (section) query.section = section;
        if (day) query.day = day;
        if (academicYear) query.academicYear = academicYear;

        const routines = await ClassRoutine.find(query)
            .populate('periods.teacher', 'name email')
            .populate('createdBy', 'name')
            .sort({ studentClass: 1, day: 1 })
            .lean();

        res.json({ success: true, data: routines });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch routines' });
    }
};

exports.getDailyRoutine = async (req, res) => {
    try {
        const { studentClass, section, day } = req.query;

        if (!studentClass || !section) {
            return res.status(400).json({ success: false, message: 'studentClass and section are required' });
        }

        const today = day || new Date().toLocaleDateString('en-US', { weekday: 'long' });

        const routine = await ClassRoutine.findOne({
            schoolCode: req.user.schoolCode,
            studentClass,
            section,
            day: today,
            isActive: true
        })
            .populate('periods.teacher', 'name email')
            .populate('createdBy', 'name')
            .lean();

        if (!routine) {
            return res.status(404).json({ success: false, message: 'Routine not found for today' });
        }

        res.status(200).json({ success: true, data: routine, message: 'Daily routine fetched successfully' });
    } catch (err) {
        console.error('Get daily routine error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch daily routine' });
    }
};

exports.getRoutineById = async (req, res) => {
    try {
        const routine = await ClassRoutine.findOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        }).populate('periods.teacher', 'name email').lean();

        if (!routine) {
            return res.status(404).json({ success: false, message: 'Routine not found' });
        }

        res.json({ success: true, data: routine });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch routine' });
    }
};

exports.updateRoutine = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const routine = await ClassRoutine.findOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        });

        if (!routine) {
            return res.status(404).json({ success: false, message: 'Routine not found' });
        }

        const { periods, isActive } = req.body;
        if (periods) {
            const conflicts = await checkRoutineConflicts(req.user.schoolCode, routine.day, periods, routine.academicYear, routine._id);
            if (conflicts.length > 0) {
                return res.status(400).json({ success: false, message: 'Routine conflicts detected', conflicts });
            }
            routine.periods = periods;
        }
        if (isActive !== undefined) routine.isActive = isActive;
        routine.updatedBy = req.user._id;
        await routine.save();

        await AuditLog.create({
            user: req.user._id,
            action: 'ROUTINE_UPDATED',
            details: { routineId: routine._id },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true, data: routine });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update routine' });
    }
};

exports.deleteRoutine = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const result = await ClassRoutine.deleteOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Routine not found' });
        }

        res.json({ success: true, message: 'Routine deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete routine' });
    }
};

// @desc    Publish routine – notify students & teachers
// @route   PUT /api/routine/:id/publish
// @access  Private (Principal/Admin)
exports.publishRoutine = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        const routine = await ClassRoutine.findOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        });
        if (!routine) return res.status(404).json({ success: false, message: 'Routine not found' });

        routine.isPublished = true;
        routine.publishedAt = new Date();
        routine.publishedBy = req.user._id;
        await routine.save();

        const teacherIds = [...new Set((routine.periods || []).map(p => p.teacher?.toString()).filter(Boolean))];
        const recipientIds = await User.find({
            schoolCode: req.user.schoolCode,
            role: { $in: ['teacher', 'student'] },
            isActive: true
        }).select('_id').limit(500).lean().then(users => users.map(u => u._id));

        await createNotification({
            title: 'Routine Published',
            body: `Class routine for ${routine.studentClass}${routine.section ? ' - ' + routine.section : ''} (${routine.academicYear}) has been published.`,
            type: 'notice',
            link: `/routine/${routine._id}`,
            schoolCode: req.user.schoolCode,
            recipients: recipientIds.length ? recipientIds : [req.user._id]
        });

        await AuditLog.create({
            user: req.user._id,
            action: 'ROUTINE_PUBLISHED',
            details: { routineId: routine._id, class: routine.studentClass },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true, message: 'Routine published. Students and teachers notified.', data: routine });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Auto-generate routine based on teacher subject assignments
// @route   POST /api/routine/auto-generate
// @access  Principal only
exports.autoGenerateRoutine = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied. Principal only.' });
        }

        const { studentClass, section, academicYear, semester } = req.body;
        const schoolCode = req.user.schoolCode;

        if (!studentClass || !academicYear) {
            return res.status(400).json({ success: false, message: 'Class and academic year are required' });
        }

        // Get school configuration
        const School = require('../models/School');
        const school = await School.findOne({ schoolCode });
        
        const workingDays = school?.academicSettings?.workingDays || ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
        const periodsPerDay = 6; // Default periods per day

        // Get subjects for this class
        const Subject = require('../models/Subject');
        const subjects = await Subject.find({ 
            schoolCode, 
            className: studentClass,
            isActive: true 
        }).populate('teachers.teacherId', 'name email');

        if (subjects.length === 0) {
            return res.status(400).json({ success: false, message: 'No subjects found for this class' });
        }

        // Get teacher assignments for each subject
        const teacherAssignments = [];
        for (const subject of subjects) {
            for (const teacherAssignment of subject.teachers || []) {
                if (teacherAssignment.isActive) {
                    teacherAssignments.push({
                        subjectId: subject._id,
                        subjectName: subject.subjectName,
                        teacherId: teacherAssignment.teacherId?._id || teacherAssignment.teacherId,
                        teacherName: teacherAssignment.teacherId?.name || 'Unknown'
                    });
                }
            }
        }

        if (teacherAssignments.length === 0) {
            return res.status(400).json({ success: false, message: 'No teachers assigned to subjects for this class' });
        }

        // Generate routine for each day
        const generatedRoutines = [];
        const usedSlots = {}; // Track used time slots to avoid conflicts
        // Initialize used slots
        for (const day of workingDays) {
            usedSlots[day] = {};
            for (let p = 1; p <= periodsPerDay; p++) {
                usedSlots[day][p] = { teacher: null, room: null };
            }
        }

        // Check existing routines for conflicts
        const existingRoutines = await ClassRoutine.find({
            schoolCode,
            studentClass,
            section: section || null,
            academicYear,
            isActive: true
        }).lean();

        for (const routine of existingRoutines) {
            for (const period of routine.periods || []) {
                const periodNum = period.period || period.periodNumber;
                if (period.teacher) {
                    usedSlots[routine.day][periodNum] = { 
                        teacher: period.teacher.toString(), 
                        room: period.room 
                    };
                }
            }
        }

        // Create periods for each day
        for (const day of workingDays) {
            const periods = [];
            let subjectIndex = 0;

            for (let periodNum = 1; periodNum <= periodsPerDay; periodNum++) {
                // Skip break times (e.g., period 4 is break)
                if (periodNum === 4) {
                    periods.push({
                        period: periodNum,
                        subject: 'Break',
                        subjectName: 'Break',
                        teacher: null,
                        isBreak: true
                    });
                    continue;
                }

                // Find available teacher for this subject
                let assignedTeacher = null;
                let currentSubject = null;

                // Try to assign a teacher for this period
                for (let attempt = 0; attempt < teacherAssignments.length; attempt++) {
                    const assignment = teacherAssignments[(subjectIndex + attempt) % teacherAssignments.length];
                    const teacherId = assignment.teacherId?.toString() || assignment.teacherId;
                    
                    // Check if teacher is available at this slot
                    if (!usedSlots[day][periodNum] || usedSlots[day][periodNum].teacher !== teacherId) {
                        assignedTeacher = assignment.teacherId;
                        currentSubject = assignment;
                        break;
                    }
                }

                if (currentSubject) {
                    periods.push({
                        period: periodNum,
                        subject: currentSubject.subjectId,
                        subjectName: currentSubject.subjectName,
                        teacher: assignedTeacher,
                        teacherName: currentSubject.teacherName,
                        isBreak: false
                    });
                    
                    // Mark slot as used
                    usedSlots[day][periodNum] = { 
                        teacher: assignedTeacher?.toString() || assignedTeacher, 
                        room: null 
                    };
                    
                    subjectIndex = (subjectIndex + 1) % teacherAssignments.length;
                } else {
                    // No teacher available
                    periods.push({
                        period: periodNum,
                        subject: null,
                        subjectName: 'TBA',
                        teacher: null,
                        isBreak: false
                    });
                }
            }

            // Create routine for this day
            const routine = await ClassRoutine.create({
                schoolCode,
                studentClass,
                section: section || null,
                day,
                periods,
                academicYear,
                semester,
                createdBy: req.user._id,
                isAutoGenerated: true
            });

            generatedRoutines.push(routine);
        }

        await AuditLog.create({
            user: req.user._id,
            action: 'ROUTINE_AUTO_GENERATED',
            details: { 
                studentClass, 
                section, 
                academicYear,
                routinesCreated: generatedRoutines.length
            },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({ 
            success: true, 
            message: `Auto-generated ${generatedRoutines.length} routine slots for ${studentClass}${section ? ' - ' + section : ''}`,
            data: generatedRoutines
        });

    } catch (err) {
        console.error('Auto-generate routine error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
};
