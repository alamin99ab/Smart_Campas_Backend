/**
 * Backfill schoolId for tenant-owned collections that still have only schoolCode.
 *
 * Usage:
 *   node scripts/backfill-school-ids.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const School = require('../models/School');
const Admission = require('../models/Admission');
const Assignment = require('../models/Assignment');
const Attendance = require('../models/Attendance');
const ClassRoutine = require('../models/ClassRoutine');
const Exam = require('../models/Exam');
const Fee = require('../models/Fee');
const Notification = require('../models/Notification');
const PaymentHistory = require('../models/PaymentHistory');
const Result = require('../models/Result');
const Routine = require('../models/Routine');
const SchoolEvent = require('../models/SchoolEvent');
const Section = require('../models/Section');
const TeacherAssignment = require('../models/TeacherAssignment');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');

const TARGET_MODELS = [
    { name: 'Admission', model: Admission },
    { name: 'Assignment', model: Assignment },
    { name: 'Attendance', model: Attendance },
    { name: 'ClassRoutine', model: ClassRoutine },
    { name: 'Exam', model: Exam },
    { name: 'Fee', model: Fee },
    { name: 'Notification', model: Notification },
    { name: 'PaymentHistory', model: PaymentHistory },
    { name: 'Result', model: Result },
    { name: 'Routine', model: Routine },
    { name: 'SchoolEvent', model: SchoolEvent },
    { name: 'Section', model: Section },
    { name: 'TeacherAssignment', model: TeacherAssignment },
    { name: 'AuditLog', model: AuditLog },
    { name: 'User', model: User },
    { name: 'Student', model: Student },
    { name: 'Teacher', model: Teacher }
];

const hasMissingSchoolIdFilter = {
    $or: [
        { schoolId: { $exists: false } },
        { schoolId: null }
    ]
};

async function run() {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is required');
    }

    await mongoose.connect(process.env.MONGO_URI);

    const schools = await School.find({ schoolCode: { $exists: true, $ne: null } })
        .select('_id schoolCode')
        .lean();

    if (!schools.length) {
        console.log('No schools found. Nothing to backfill.');
        return;
    }

    const schoolMap = new Map(
        schools.map((school) => [String(school.schoolCode).trim().toUpperCase(), school._id])
    );

    const totals = [];

    for (const target of TARGET_MODELS) {
        let updated = 0;

        for (const [schoolCode, schoolId] of schoolMap.entries()) {
            const result = await target.model.updateMany(
                {
                    ...hasMissingSchoolIdFilter,
                    schoolCode
                },
                { $set: { schoolId } }
            );

            updated += Number(result.modifiedCount || 0);
        }

        totals.push({ model: target.name, updated });
    }

    const totalUpdated = totals.reduce((sum, row) => sum + row.updated, 0);
    console.log('SchoolId backfill completed.');
    totals.forEach((row) => {
        console.log(`- ${row.model}: ${row.updated}`);
    });
    console.log(`Total updated: ${totalUpdated}`);
}

run()
    .catch((error) => {
        console.error('Backfill failed:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.connection.close().catch(() => {});
    });
