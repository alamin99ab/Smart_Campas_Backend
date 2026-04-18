/**
 * Backfill exam workflow fields for legacy exam records.
 *
 * Usage:
 *   node scripts/backfill-exam-workflow.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Exam = require('../models/Exam');

const normalizeExamTypeKey = (value) => {
    const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (!raw) return 'final';
    if (raw === 'midterm' || raw === 'mid-term') return 'mid_term';
    if (raw === 'half-yearly' || raw === 'halfyearly') return 'half_yearly';
    if (raw === 'testexam' || raw === 'test-exam') return 'test_exam';
    if (raw === 'class-test' || raw === 'classtest') return 'class_test';
    return raw;
};

const examTypeLabel = (key) => {
    const map = {
        mid_term: 'Midterm',
        final: 'Final',
        half_yearly: 'Half Yearly',
        annual: 'Annual',
        test_exam: 'Test Exam',
        class_test: 'Class Test',
        quiz: 'Quiz',
        assessment: 'Assessment',
        practical: 'Practical',
        assignment: 'Assignment',
        other: 'Other'
    };
    return map[key] || 'Other';
};

const inferCategory = (exam) => {
    const key = normalizeExamTypeKey(exam.examType);
    if (['class_test', 'quiz', 'assessment'].includes(key) && exam.classId && exam.subjectId) {
        return 'class_test';
    }
    if (key === 'test_exam') {
        return 'special_exam';
    }
    return 'school_exam';
};

const inferStatus = (exam) => {
    if (exam.status && ['draft', 'scheduled', 'active', 'completed', 'archived'].includes(exam.status)) {
        return exam.status;
    }
    if (exam.resultsPublished) return 'completed';
    if (exam.isActive === false) return 'archived';
    if (exam.date || exam.startDate) return 'scheduled';
    return 'draft';
};

async function run() {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is required');
    }

    await mongoose.connect(process.env.MONGO_URI);

    const cursor = Exam.find({}).cursor();
    let scanned = 0;
    let updated = 0;

    for await (const exam of cursor) {
        scanned += 1;
        const next = {};

        const typeKey = normalizeExamTypeKey(exam.examType);
        const normalizedType = examTypeLabel(typeKey);
        if (!exam.examType || String(exam.examType).trim() !== normalizedType) {
            next.examType = normalizedType;
        }

        const category = inferCategory(exam);
        if (!exam.category || exam.category !== category) {
            next.category = category;
        }

        const status = inferStatus(exam);
        if (!exam.status || exam.status !== status) {
            next.status = status;
        }

        const startDate = exam.startDate || exam.date || exam.createdAt || new Date();
        if (!exam.startDate) {
            next.startDate = startDate;
        }
        if (!exam.date) {
            next.date = startDate;
        }
        if (!exam.endDate) {
            next.endDate = exam.endDate || exam.date || startDate;
        }

        if (exam.classId) {
            const hasClassInTargets = Array.isArray(exam.targetClasses)
                && exam.targetClasses.some((id) => String(id) === String(exam.classId));
            if (!hasClassInTargets) {
                next.targetClasses = [...new Set([...(exam.targetClasses || []).map(String), String(exam.classId)])];
            }
        }

        if (Object.keys(next).length) {
            await Exam.updateOne({ _id: exam._id }, { $set: next });
            updated += 1;
        }
    }

    console.log(`Exam workflow backfill completed. scanned=${scanned}, updated=${updated}`);
}

run()
    .catch((error) => {
        console.error('Backfill failed:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.connection.close().catch(() => {});
    });

