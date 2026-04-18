const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', index: true },
    schoolCode: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    examType: { type: String, required: true, trim: true, default: 'Final' },
    category: {
        type: String,
        enum: ['school_exam', 'class_test', 'special_exam'],
        default: 'school_exam',
        index: true
    },
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'active', 'completed', 'archived'],
        default: 'draft',
        index: true
    },
    targetClasses: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    }],
    targetSections: [{
        type: String,
        trim: true,
        uppercase: true
    }],
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    },
    sectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Section'
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject'
    },
    startDate: { type: Date },
    endDate: { type: Date },
    date: { type: Date },
    duration: { type: Number, min: 1 },
    totalMarks: { type: Number, min: 1 },
    isActive: { type: Boolean, default: true },
    resultsPublished: { type: Boolean, default: false },
    publishedDate: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

examSchema.index({ schoolCode: 1, classId: 1, subjectId: 1, date: 1 });
examSchema.index({ schoolId: 1, classId: 1, subjectId: 1, date: 1 });
examSchema.index({ schoolId: 1, isActive: 1, date: -1 });
examSchema.index({ schoolCode: 1, category: 1, status: 1, startDate: -1 });
examSchema.index({ schoolId: 1, category: 1, status: 1, startDate: -1 });
examSchema.index({ schoolCode: 1, targetClasses: 1, status: 1, startDate: -1 });
examSchema.index({ schoolId: 1, targetClasses: 1, status: 1, startDate: -1 });

examSchema.pre('validate', function(next) {
    if (typeof this.schoolCode === 'string') {
        this.schoolCode = this.schoolCode.trim().toUpperCase();
    }

    if (typeof this.name === 'string') {
        this.name = this.name.trim();
    }

    if (typeof this.examType === 'string') {
        this.examType = this.examType.trim();
    }

    if (Array.isArray(this.targetSections)) {
        this.targetSections = [...new Set(
            this.targetSections
                .map((value) => String(value || '').trim().toUpperCase())
                .filter(Boolean)
        )];
    }

    if (this.classId && !Array.isArray(this.targetClasses)) {
        this.targetClasses = [this.classId];
    }
    if (this.classId && Array.isArray(this.targetClasses) && !this.targetClasses.some((id) => String(id) === String(this.classId))) {
        this.targetClasses.unshift(this.classId);
    }

    if (!this.startDate && this.date) {
        this.startDate = this.date;
    }
    if (!this.endDate && this.date) {
        this.endDate = this.date;
    }
    if (!this.date && this.startDate) {
        this.date = this.startDate;
    }

    next();
});

module.exports = mongoose.model('Exam', examSchema);
