const mongoose = require('mongoose');

const normalizeSection = (value) => String(value || '').trim().toUpperCase();

const absenceSlotSchema = new mongoose.Schema({
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    className: {
        type: String,
        required: true,
        trim: true
    },
    section: {
        type: String,
        required: true,
        uppercase: true,
        trim: true
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },
    subjectName: {
        type: String,
        required: true,
        trim: true
    },
    periodNumber: {
        type: Number,
        required: true,
        min: 1,
        max: 20
    },
    status: {
        type: String,
        enum: ['open', 'accepted', 'assigned', 'completed', 'cancelled'],
        default: 'open'
    },
    substituteTeacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    acceptedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    acceptedByRole: {
        type: String,
        enum: ['teacher', 'principal', 'admin', 'super_admin']
    },
    acceptedAt: Date,
    acceptanceNote: {
        type: String,
        trim: true
    },
    attendanceMarkedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    attendanceMarkedAt: Date,
    attendanceRecordId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdvancedAttendance'
    }
}, { _id: true });

const teacherAbsenceRequestSchema = new mongoose.Schema({
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        required: true
    },
    schoolCode: {
        type: String,
        required: true,
        index: true
    },
    absentTeacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    absenceDate: {
        type: Date,
        required: true,
        index: true
    },
    reason: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['open', 'partially_filled', 'filled', 'cancelled'],
        default: 'open',
        index: true
    },
    slots: {
        type: [absenceSlotSchema],
        default: [],
        validate: {
            validator: (value) => Array.isArray(value) && value.length > 0,
            message: 'At least one affected class/period slot is required'
        }
    },
    requestedAt: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

teacherAbsenceRequestSchema.index({ schoolCode: 1, absenceDate: 1, absentTeacherId: 1 });
teacherAbsenceRequestSchema.index({ schoolCode: 1, 'slots.substituteTeacherId': 1, absenceDate: 1 });
teacherAbsenceRequestSchema.index({ schoolCode: 1, status: 1, absenceDate: -1 });

const calculateRequestStatus = (slots) => {
    const normalizedSlots = Array.isArray(slots) ? slots : [];
    const activeSlots = normalizedSlots.filter((slot) => slot.status !== 'cancelled');

    if (!activeSlots.length) {
        return 'cancelled';
    }

    const openCount = activeSlots.filter((slot) => slot.status === 'open').length;

    if (openCount === activeSlots.length) {
        return 'open';
    }

    if (openCount === 0) {
        return 'filled';
    }

    return 'partially_filled';
};

teacherAbsenceRequestSchema.statics.normalizeAbsenceDate = function normalizeAbsenceDate(value) {
    const date = value instanceof Date ? new Date(value) : new Date(String(value || ''));
    if (Number.isNaN(date.getTime())) return null;
    date.setUTCHours(0, 0, 0, 0);
    return date;
};

teacherAbsenceRequestSchema.methods.recalculateStatus = function recalculateStatus() {
    (this.slots || []).forEach((slot) => {
        slot.section = normalizeSection(slot.section);
    });
    this.status = calculateRequestStatus(this.slots || []);
    return this.status;
};

teacherAbsenceRequestSchema.pre('save', function preSave(next) {
    if (this.absenceDate) {
        this.absenceDate.setUTCHours(0, 0, 0, 0);
    }
    this.recalculateStatus();
    next();
});

teacherAbsenceRequestSchema.statics.calculateRequestStatus = calculateRequestStatus;

module.exports = mongoose.model('TeacherAbsenceRequest', teacherAbsenceRequestSchema);
