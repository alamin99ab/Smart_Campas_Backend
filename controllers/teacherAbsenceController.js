const mongoose = require('mongoose');
const TeacherAbsenceRequest = require('../models/TeacherAbsenceRequest');
const TeacherAssignment = require('../models/TeacherAssignment');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const User = require('../models/User');
const School = require('../models/School');
const AuditLog = require('../models/AuditLog');

const normalizeSection = (value) => String(value || '').trim().toUpperCase();
const normalizeString = (value) => String(value || '').trim();
const getActorId = (req) => req.user?._id || req.user?.id;

const toObjectIdOrNull = (value) => {
    if (!mongoose.Types.ObjectId.isValid(String(value || ''))) return null;
    return new mongoose.Types.ObjectId(String(value));
};

const parseAbsenceDate = (value) => TeacherAbsenceRequest.normalizeAbsenceDate(value);

const buildSlotKey = ({ classId, section, subjectId, periodNumber }) => (
    `${String(classId)}|${normalizeSection(section)}|${String(subjectId)}|${Number(periodNumber)}`
);

const checkTeacherAssignmentForSlot = async ({
    schoolCode,
    teacherId,
    classId,
    subjectId,
    section
}) => {
    const classIdString = String(classId);
    const subjectIdString = String(subjectId);
    const teacherIdString = String(teacherId);

    const assignmentRows = await TeacherAssignment.aggregate([
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
                teacherAsString: teacherIdString,
                subjectAsString: subjectIdString,
                classesAsString: classIdString
            }
        },
        {
            $project: {
                sections: 1
            }
        },
        { $limit: 1 }
    ]);

    const assignment = assignmentRows[0] || null;

    if (!assignment) return false;

    const assignmentSections = (assignment.sections || []).map(normalizeSection).filter(Boolean);
    if (!assignmentSections.length) return true;
    return assignmentSections.includes(normalizeSection(section));
};

const updateRequestStatusAndSave = async (request, updatedBy) => {
    request.updatedBy = updatedBy;
    request.recalculateStatus();
    await request.save();
    return request;
};

const createAudit = async (req, action, details) => {
    const actorId = getActorId(req);
    if (!actorId) return;

    await AuditLog.create({
        user: actorId,
        action,
        details,
        ip: req.ip,
        userAgent: req.headers['user-agent']
    });
};

const slotToPayload = (slot) => ({
    _id: String(slot._id),
    classId: slot.classId ? String(slot.classId) : null,
    className: slot.className,
    section: normalizeSection(slot.section),
    subjectId: slot.subjectId ? String(slot.subjectId) : null,
    subjectName: slot.subjectName,
    periodNumber: slot.periodNumber,
    status: slot.status,
    substituteTeacher: slot.substituteTeacherId && typeof slot.substituteTeacherId === 'object'
        ? {
            _id: String(slot.substituteTeacherId._id || slot.substituteTeacherId),
            name: slot.substituteTeacherId.name || null,
            email: slot.substituteTeacherId.email || null
        }
        : slot.substituteTeacherId
            ? { _id: String(slot.substituteTeacherId), name: null, email: null }
            : null,
    acceptedBy: slot.acceptedBy ? String(slot.acceptedBy) : null,
    acceptedByRole: slot.acceptedByRole || null,
    acceptedAt: slot.acceptedAt || null,
    acceptanceNote: slot.acceptanceNote || '',
    attendanceMarkedBy: slot.attendanceMarkedBy ? String(slot.attendanceMarkedBy) : null,
    attendanceMarkedAt: slot.attendanceMarkedAt || null
});

const requestToPayload = (request, { onlyOpenSlots = false } = {}) => {
    const slots = (request.slots || [])
        .filter((slot) => (onlyOpenSlots ? slot.status === 'open' : true))
        .map(slotToPayload);

    return {
        _id: String(request._id),
        schoolCode: request.schoolCode,
        absenceDate: request.absenceDate,
        reason: request.reason || '',
        status: request.status,
        absentTeacher: request.absentTeacherId && typeof request.absentTeacherId === 'object'
            ? {
                _id: String(request.absentTeacherId._id || request.absentTeacherId),
                name: request.absentTeacherId.name || null,
                email: request.absentTeacherId.email || null
            }
            : {
                _id: String(request.absentTeacherId),
                name: null,
                email: null
            },
        slots,
        counts: {
            totalSlots: request.slots?.length || 0,
            openSlots: (request.slots || []).filter((slot) => slot.status === 'open').length,
            acceptedSlots: (request.slots || []).filter((slot) => ['accepted', 'assigned', 'completed'].includes(slot.status)).length
        },
        createdAt: request.createdAt,
        updatedAt: request.updatedAt
    };
};

exports.submitAbsenceRequest = async (req, res) => {
    try {
        const actorId = getActorId(req);
        const schoolCode = req.user.schoolCode;
        const { absenceDate: rawAbsenceDate, reason, slots } = req.body;

        if (!actorId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const absenceDate = parseAbsenceDate(rawAbsenceDate);
        if (!absenceDate) {
            return res.status(400).json({ success: false, message: 'Valid absenceDate is required' });
        }

        if (!Array.isArray(slots) || !slots.length) {
            return res.status(400).json({ success: false, message: 'At least one affected class/period slot is required' });
        }

        const school = await School.findOne({ schoolCode }).select('_id').lean();
        if (!school) {
            return res.status(404).json({ success: false, message: 'School not found' });
        }

        const normalizedSlots = [];
        const seenSlotKeys = new Set();

        for (const slot of slots) {
            const classId = toObjectIdOrNull(slot?.classId);
            const subjectId = toObjectIdOrNull(slot?.subjectId);
            const periodNumber = Number(slot?.periodNumber);
            const section = normalizeSection(slot?.section);

            if (!classId || !subjectId || !Number.isFinite(periodNumber) || periodNumber < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Each slot requires valid classId, subjectId, and periodNumber'
                });
            }

            const classDoc = await Class.findOne({ _id: classId, schoolCode, isActive: true })
                .select('_id className section')
                .lean();
            if (!classDoc) {
                return res.status(400).json({ success: false, message: 'Invalid classId for this school' });
            }

            const subjectDoc = await Subject.findOne({ _id: subjectId, schoolCode, isActive: true })
                .select('_id subjectName')
                .lean();
            if (!subjectDoc) {
                return res.status(400).json({ success: false, message: 'Invalid subjectId for this school' });
            }

            const resolvedSection = section || normalizeSection(classDoc.section);
            const slotKey = buildSlotKey({
                classId,
                section: resolvedSection,
                subjectId,
                periodNumber
            });

            if (seenSlotKeys.has(slotKey)) {
                return res.status(400).json({
                    success: false,
                    message: 'Duplicate class/section/subject/period slot in request payload'
                });
            }
            seenSlotKeys.add(slotKey);

            const isAssignedToTeacher = await checkTeacherAssignmentForSlot({
                schoolCode,
                teacherId: actorId,
                classId,
                subjectId,
                section: resolvedSection
            });

            if (!isAssignedToTeacher) {
                return res.status(403).json({
                    success: false,
                    message: `You are not assigned to ${classDoc.className} ${resolvedSection} / ${subjectDoc.subjectName}`
                });
            }

            normalizedSlots.push({
                classId,
                className: classDoc.className,
                section: resolvedSection,
                subjectId,
                subjectName: subjectDoc.subjectName,
                periodNumber,
                status: 'open'
            });
        }

        const existingOnDate = await TeacherAbsenceRequest.find({
            schoolCode,
            absentTeacherId: actorId,
            absenceDate,
            status: { $ne: 'cancelled' }
        })
            .select('slots')
            .lean();

        const alreadyRequested = new Set();
        existingOnDate.forEach((request) => {
            (request.slots || []).forEach((slot) => {
                if (slot.status === 'cancelled') return;
                alreadyRequested.add(buildSlotKey(slot));
            });
        });

        const duplicates = normalizedSlots.filter((slot) => alreadyRequested.has(buildSlotKey(slot)));
        if (duplicates.length) {
            return res.status(409).json({
                success: false,
                message: 'One or more requested slots already exist for this teacher/date'
            });
        }

        const absenceRequest = await TeacherAbsenceRequest.create({
            schoolId: school._id,
            schoolCode,
            absentTeacherId: actorId,
            absenceDate,
            reason: normalizeString(reason),
            slots: normalizedSlots,
            createdBy: actorId,
            updatedBy: actorId
        });

        await createAudit(req, 'TEACHER_ABSENCE_REQUESTED', {
            absenceRequestId: String(absenceRequest._id),
            schoolCode,
            absenceDate,
            slotCount: normalizedSlots.length
        });

        const fresh = await TeacherAbsenceRequest.findById(absenceRequest._id)
            .populate('absentTeacherId', 'name email')
            .populate('slots.substituteTeacherId', 'name email')
            .lean();

        res.status(201).json({
            success: true,
            message: 'Absence request submitted successfully',
            data: requestToPayload(fresh)
        });
    } catch (error) {
        console.error('Submit teacher absence request error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit absence request',
            error: error.message
        });
    }
};

exports.getMyAbsenceRequests = async (req, res) => {
    try {
        const actorId = getActorId(req);
        const schoolCode = req.user.schoolCode;
        const { fromDate, toDate } = req.query;

        const query = {
            schoolCode,
            absentTeacherId: actorId
        };

        if (fromDate || toDate) {
            query.absenceDate = {};
            if (fromDate) query.absenceDate.$gte = parseAbsenceDate(fromDate);
            if (toDate) query.absenceDate.$lte = parseAbsenceDate(toDate);
        }

        const requests = await TeacherAbsenceRequest.find(query)
            .populate('absentTeacherId', 'name email')
            .populate('slots.substituteTeacherId', 'name email')
            .sort({ absenceDate: -1, createdAt: -1 })
            .lean();

        res.json({
            success: true,
            data: requests.map((request) => requestToPayload(request))
        });
    } catch (error) {
        console.error('Get my absence requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch absence requests',
            error: error.message
        });
    }
};

exports.getOpenAbsenceRequests = async (req, res) => {
    try {
        const actorId = getActorId(req);
        const schoolCode = req.user.schoolCode;
        const role = req.user.role;
        const { date } = req.query;

        const minDate = date ? parseAbsenceDate(date) : parseAbsenceDate(new Date());

        const query = {
            schoolCode,
            status: { $in: ['open', 'partially_filled'] },
            'slots.status': 'open'
        };

        if (minDate) {
            query.absenceDate = { $gte: minDate };
        }

        if (role === 'teacher') {
            query.absentTeacherId = { $ne: actorId };
        }

        const requests = await TeacherAbsenceRequest.find(query)
            .populate('absentTeacherId', 'name email')
            .populate('slots.substituteTeacherId', 'name email')
            .sort({ absenceDate: 1, createdAt: 1 })
            .lean();

        const payload = requests
            .map((request) => {
                const openEligibleSlots = (request.slots || [])
                    .filter((slot) => slot.status === 'open');

                if (!openEligibleSlots.length) return null;

                return requestToPayload({
                    ...request,
                    slots: openEligibleSlots
                });
            })
            .filter(Boolean);

        res.json({
            success: true,
            data: payload
        });
    } catch (error) {
        console.error('Get open absence requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch open absence requests',
            error: error.message
        });
    }
};

exports.acceptAbsenceSlot = async (req, res) => {
    try {
        const actorId = getActorId(req);
        const schoolCode = req.user.schoolCode;
        const { requestId, slotId } = req.params;
        const { note } = req.body;

        if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(slotId)) {
            return res.status(400).json({ success: false, message: 'Invalid requestId or slotId' });
        }

        const request = await TeacherAbsenceRequest.findOne({
            _id: requestId,
            schoolCode,
            status: { $ne: 'cancelled' }
        });

        if (!request) {
            return res.status(404).json({ success: false, message: 'Absence request not found' });
        }

        if (String(request.absentTeacherId) === String(actorId)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot accept your own absence slot'
            });
        }

        const slot = request.slots.id(slotId);
        if (!slot) {
            return res.status(404).json({ success: false, message: 'Requested slot not found' });
        }

        if (slot.status !== 'open') {
            return res.status(400).json({ success: false, message: 'This slot is no longer open' });
        }

        slot.status = 'accepted';
        slot.substituteTeacherId = actorId;
        slot.acceptedBy = actorId;
        slot.acceptedByRole = req.user.role;
        slot.acceptedAt = new Date();
        slot.acceptanceNote = normalizeString(note);

        await updateRequestStatusAndSave(request, actorId);

        await createAudit(req, 'SUBSTITUTE_SLOT_ACCEPTED', {
            absenceRequestId: String(request._id),
            slotId: String(slot._id),
            schoolCode
        });

        const fresh = await TeacherAbsenceRequest.findById(request._id)
            .populate('absentTeacherId', 'name email')
            .populate('slots.substituteTeacherId', 'name email')
            .lean();

        res.json({
            success: true,
            message: 'Substitute duty accepted for the selected slot',
            data: requestToPayload(fresh)
        });
    } catch (error) {
        console.error('Accept absence slot error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to accept absence slot',
            error: error.message
        });
    }
};

exports.assignSubstituteSlot = async (req, res) => {
    try {
        const actorId = getActorId(req);
        const schoolCode = req.user.schoolCode;
        const { requestId, slotId } = req.params;
        const { substituteTeacherId, note } = req.body;

        const substituteId = toObjectIdOrNull(substituteTeacherId);
        if (!substituteId || !mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(slotId)) {
            return res.status(400).json({ success: false, message: 'Invalid requestId, slotId, or substituteTeacherId' });
        }

        const request = await TeacherAbsenceRequest.findOne({
            _id: requestId,
            schoolCode,
            status: { $ne: 'cancelled' }
        });

        if (!request) {
            return res.status(404).json({ success: false, message: 'Absence request not found' });
        }

        const slot = request.slots.id(slotId);
        if (!slot) {
            return res.status(404).json({ success: false, message: 'Requested slot not found' });
        }

        if (['completed', 'cancelled'].includes(slot.status)) {
            return res.status(400).json({ success: false, message: 'This slot can no longer be assigned' });
        }

        const substituteTeacher = await User.findOne({
            _id: substituteId,
            schoolCode,
            role: 'teacher',
            isActive: true
        })
            .select('_id name email')
            .lean();

        if (!substituteTeacher) {
            return res.status(404).json({ success: false, message: 'Substitute teacher not found in this school' });
        }

        slot.status = 'assigned';
        slot.substituteTeacherId = substituteId;
        slot.acceptedBy = actorId;
        slot.acceptedByRole = req.user.role;
        slot.acceptedAt = new Date();
        slot.acceptanceNote = normalizeString(note);

        await updateRequestStatusAndSave(request, actorId);

        await createAudit(req, 'SUBSTITUTE_SLOT_ASSIGNED_BY_PRINCIPAL', {
            absenceRequestId: String(request._id),
            slotId: String(slot._id),
            substituteTeacherId: String(substituteId),
            schoolCode
        });

        const fresh = await TeacherAbsenceRequest.findById(request._id)
            .populate('absentTeacherId', 'name email')
            .populate('slots.substituteTeacherId', 'name email')
            .lean();

        res.json({
            success: true,
            message: 'Substitute teacher assigned successfully',
            data: requestToPayload(fresh)
        });
    } catch (error) {
        console.error('Assign substitute slot error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to assign substitute teacher',
            error: error.message
        });
    }
};

exports.getMySubstituteAssignments = async (req, res) => {
    try {
        const actorId = getActorId(req);
        const schoolCode = req.user.schoolCode;
        const { fromDate } = req.query;

        const minDate = fromDate ? parseAbsenceDate(fromDate) : parseAbsenceDate(new Date(Date.now() - (24 * 60 * 60 * 1000)));

        const query = {
            schoolCode,
            'slots.substituteTeacherId': actorId
        };
        if (minDate) {
            query.absenceDate = { $gte: minDate };
        }

        const requests = await TeacherAbsenceRequest.find(query)
            .populate('absentTeacherId', 'name email')
            .sort({ absenceDate: 1, createdAt: 1 })
            .lean();

        const assignments = [];
        requests.forEach((request) => {
            (request.slots || []).forEach((slot) => {
                if (String(slot.substituteTeacherId || '') !== String(actorId)) return;
                if (!['accepted', 'assigned', 'completed'].includes(slot.status)) return;

                const today = parseAbsenceDate(new Date());
                const requestDate = parseAbsenceDate(request.absenceDate);
                const isSameDate = today && requestDate && Number(today) === Number(requestDate);
                const activePermission = Boolean(isSameDate && ['accepted', 'assigned', 'completed'].includes(slot.status));

                assignments.push({
                    requestId: String(request._id),
                    slotId: String(slot._id),
                    absenceDate: request.absenceDate,
                    classId: slot.classId ? String(slot.classId) : null,
                    className: slot.className,
                    section: normalizeSection(slot.section),
                    subjectId: slot.subjectId ? String(slot.subjectId) : null,
                    subjectName: slot.subjectName,
                    periodNumber: slot.periodNumber,
                    status: slot.status,
                    acceptanceNote: slot.acceptanceNote || '',
                    acceptedAt: slot.acceptedAt || null,
                    absentTeacher: request.absentTeacherId && typeof request.absentTeacherId === 'object'
                        ? {
                            _id: String(request.absentTeacherId._id),
                            name: request.absentTeacherId.name || null,
                            email: request.absentTeacherId.email || null
                        }
                        : null,
                    temporaryAttendancePermissionActive: activePermission
                });
            });
        });

        res.json({
            success: true,
            data: assignments
        });
    } catch (error) {
        console.error('Get substitute assignments error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch substitute assignments',
            error: error.message
        });
    }
};

exports.getSchoolAbsenceRequests = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const { status, fromDate, toDate } = req.query;

        const query = { schoolCode };

        if (status) query.status = status;
        if (fromDate || toDate) {
            query.absenceDate = {};
            if (fromDate) query.absenceDate.$gte = parseAbsenceDate(fromDate);
            if (toDate) query.absenceDate.$lte = parseAbsenceDate(toDate);
        }

        const requests = await TeacherAbsenceRequest.find(query)
            .populate('absentTeacherId', 'name email')
            .populate('slots.substituteTeacherId', 'name email')
            .sort({ absenceDate: -1, createdAt: -1 })
            .lean();

        res.json({
            success: true,
            data: requests.map((request) => requestToPayload(request))
        });
    } catch (error) {
        console.error('Get school absence requests error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch school absence requests',
            error: error.message
        });
    }
};

exports.findTemporarySubstitutePermission = async ({
    schoolCode,
    teacherId,
    classId,
    subjectId,
    section,
    periodNumber,
    date
}) => {
    const teacherObjectId = toObjectIdOrNull(teacherId);
    const classObjectId = toObjectIdOrNull(classId);
    const subjectObjectId = toObjectIdOrNull(subjectId);
    const absenceDate = parseAbsenceDate(date);

    if (!teacherObjectId || !classObjectId || !subjectObjectId || !absenceDate) {
        return null;
    }

    const normalizedPeriod = Number.isFinite(Number(periodNumber)) ? Number(periodNumber) : 1;
    const normalizedSection = normalizeSection(section);

    const elemMatch = {
        classId: classObjectId,
        subjectId: subjectObjectId,
        periodNumber: normalizedPeriod,
        substituteTeacherId: teacherObjectId,
        status: { $in: ['accepted', 'assigned', 'completed'] }
    };

    if (normalizedSection) {
        elemMatch.section = normalizedSection;
    }

    let request = await TeacherAbsenceRequest.findOne({
        schoolCode,
        absenceDate,
        status: { $ne: 'cancelled' },
        slots: { $elemMatch: elemMatch }
    })
        .select('_id absentTeacherId absenceDate slots')
        .lean();

    if (!request && normalizedSection) {
        delete elemMatch.section;
        request = await TeacherAbsenceRequest.findOne({
            schoolCode,
            absenceDate,
            status: { $ne: 'cancelled' },
            slots: { $elemMatch: elemMatch }
        })
            .select('_id absentTeacherId absenceDate slots')
            .lean();
    }

    if (!request) return null;

    const matchedSlot = (request.slots || []).find((slot) => (
        String(slot.classId) === String(classObjectId)
        && String(slot.subjectId) === String(subjectObjectId)
        && Number(slot.periodNumber) === normalizedPeriod
        && String(slot.substituteTeacherId || '') === String(teacherObjectId)
        && ['accepted', 'assigned', 'completed'].includes(slot.status)
        && (!normalizedSection || normalizeSection(slot.section) === normalizedSection)
    ));

    if (!matchedSlot) return null;

    return {
        requestId: String(request._id),
        slotId: String(matchedSlot._id),
        absentTeacherId: String(request.absentTeacherId),
        slotStatus: matchedSlot.status
    };
};

exports.markSubstituteSlotCompleted = async ({
    requestId,
    slotId,
    markerId,
    attendanceRecordId
}) => {
    if (!mongoose.Types.ObjectId.isValid(String(requestId || '')) || !mongoose.Types.ObjectId.isValid(String(slotId || ''))) {
        return null;
    }

    const request = await TeacherAbsenceRequest.findById(requestId);
    if (!request) return null;

    const slot = request.slots.id(slotId);
    if (!slot) return null;

    slot.status = 'completed';
    slot.attendanceMarkedBy = markerId;
    slot.attendanceMarkedAt = new Date();
    if (attendanceRecordId && mongoose.Types.ObjectId.isValid(String(attendanceRecordId))) {
        slot.attendanceRecordId = attendanceRecordId;
    }

    await updateRequestStatusAndSave(request, markerId);
    return slot;
};
