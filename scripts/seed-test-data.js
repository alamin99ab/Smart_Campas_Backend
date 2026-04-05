const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const School = require('../models/School');
const Subscription = require('../models/Subscription');
const AcademicSession = require('../models/AcademicSession');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Class = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const Room = require('../models/Room');
const TeacherAssignment = require('../models/TeacherAssignment');
const Routine = require('../models/Routine');
const ClassRoutine = require('../models/ClassRoutine');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const AdvancedAttendance = require('../models/AdvancedAttendance');
const FeeStructure = require('../models/FeeStructure');
const Fee = require('../models/Fee');
const PaymentHistory = require('../models/PaymentHistory');
const Result = require('../models/Result');
const Notice = require('../models/Notice');
const Notification = require('../models/Notification');
const SchoolEvent = require('../models/SchoolEvent');
const Exam = require('../models/Exam');
const ExamSchedule = require('../models/ExamSchedule');
const { ensureMongoIndexes } = require('../utils/ensureMongoIndexes');

const SEED_TAG = 'smart-campus-test-seed-v1';
const SECTIONS = ['A', 'B'];
const CLASS_LEVELS = [6, 7, 8, 9, 10];
const LEGACY_ROUTINE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CLASS_ROUTINE_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
const PERIOD_TIMES = [
    ['08:00', '08:45'],
    ['08:50', '09:35'],
    ['09:40', '10:25'],
    ['10:40', '11:25'],
    ['11:30', '12:15'],
    ['12:20', '13:05']
];

const SCHOOL_BLUEPRINTS = [
    {
        schoolCode: 'SEEDSC01',
        schoolName: 'Dhaka Model Academy',
        division: 'Dhaka',
        district: 'Dhaka',
        upazila: 'Mirpur',
        address: 'Mirpur DOHS, Dhaka',
        plan: 'trial'
    },
    {
        schoolCode: 'SEEDSC02',
        schoolName: 'Chattogram Scholars School',
        division: 'Chattogram',
        district: 'Chattogram',
        upazila: 'Panchlaish',
        address: 'Panchlaish, Chattogram',
        plan: 'basic'
    },
    {
        schoolCode: 'SEEDSC03',
        schoolName: 'Rajshahi Future Institute',
        division: 'Rajshahi',
        district: 'Rajshahi',
        upazila: 'Boalia',
        address: 'Boalia, Rajshahi',
        plan: 'standard'
    },
    {
        schoolCode: 'SEEDSC04',
        schoolName: 'Khulna City Collegiate',
        division: 'Khulna',
        district: 'Khulna',
        upazila: 'Sonadanga',
        address: 'Sonadanga, Khulna',
        plan: 'premium'
    },
    {
        schoolCode: 'SEEDSC05',
        schoolName: 'Sylhet Horizon School',
        division: 'Sylhet',
        district: 'Sylhet',
        upazila: 'Kotwali',
        address: 'Ambarkhana, Sylhet',
        plan: 'enterprise'
    }
];

const SUBJECT_DEFINITIONS = [
    { code: 'BAN', name: 'Bangla', category: 'Core', credits: 1, periodsPerWeek: 5 },
    { code: 'ENG', name: 'English', category: 'Core', credits: 1, periodsPerWeek: 5 },
    { code: 'MAT', name: 'Mathematics', category: 'Core', credits: 1, periodsPerWeek: 6 },
    { code: 'SCI', name: 'Science', category: 'Core', credits: 1, periodsPerWeek: 5 },
    { code: 'SOC', name: 'Social Science', category: 'Core', credits: 1, periodsPerWeek: 4 },
    { code: 'REL', name: 'Religion', category: 'Core', credits: 1, periodsPerWeek: 3 },
    { code: 'ICT', name: 'ICT', category: 'Core', credits: 1, periodsPerWeek: 2 },
    { code: 'PE', name: 'Physical Education', category: 'Extra-curricular', credits: 1, periodsPerWeek: 2 }
];

const PLAN_PRESETS = {
    trial: {
        billingCycle: 'trial',
        durationDays: 14,
        amount: 0,
        limits: { maxUsers: 100, maxStudents: 100, maxTeachers: 20, maxClasses: 20, maxStorage: 500, maxApiCalls: 1000 },
        features: { routine: true, attendance: true, exam: true, fee: true, notice: true, library: false, assignment: false, sms: false, bulkImport: false, mobileApp: false, apiAccess: false, advancedAnalytics: false, customBranding: false, prioritySupport: false, backup: false, integration: false }
    },
    basic: {
        billingCycle: 'monthly',
        durationDays: 30,
        amount: 29.99,
        limits: { maxUsers: 300, maxStudents: 1000, maxTeachers: 60, maxClasses: 40, maxStorage: 5000, maxApiCalls: 10000 },
        features: { routine: true, attendance: true, exam: true, fee: true, notice: true, library: false, assignment: false, sms: false, bulkImport: true, mobileApp: false, apiAccess: false, advancedAnalytics: false, customBranding: false, prioritySupport: false, backup: false, integration: false }
    },
    standard: {
        billingCycle: 'yearly',
        durationDays: 365,
        amount: 199.99,
        limits: { maxUsers: 1000, maxStudents: 5000, maxTeachers: 200, maxClasses: 100, maxStorage: 25000, maxApiCalls: 50000 },
        features: { routine: true, attendance: true, exam: true, fee: true, notice: true, library: true, assignment: true, sms: true, bulkImport: true, mobileApp: true, apiAccess: true, advancedAnalytics: true, customBranding: false, prioritySupport: false, backup: true, integration: true }
    },
    premium: {
        billingCycle: 'yearly',
        durationDays: 365,
        amount: 399.99,
        limits: { maxUsers: 5000, maxStudents: 20000, maxTeachers: 1000, maxClasses: 500, maxStorage: 100000, maxApiCalls: 250000 },
        features: { routine: true, attendance: true, exam: true, fee: true, notice: true, library: true, assignment: true, sms: true, bulkImport: true, mobileApp: true, apiAccess: true, advancedAnalytics: true, customBranding: true, prioritySupport: true, backup: true, integration: true }
    },
    enterprise: {
        billingCycle: 'yearly',
        durationDays: 365,
        amount: 999.99,
        limits: { maxUsers: 999999999, maxStudents: 999999999, maxTeachers: 999999999, maxClasses: 999999999, maxStorage: 999999999, maxApiCalls: 999999999 },
        features: { routine: true, attendance: true, exam: true, fee: true, notice: true, library: true, assignment: true, sms: true, bulkImport: true, mobileApp: true, apiAccess: true, advancedAnalytics: true, customBranding: true, prioritySupport: true, backup: true, integration: true }
    }
};

const ALL_MODELS = [
    School,
    Subscription,
    AcademicSession,
    User,
    Teacher,
    Class,
    Section,
    Subject,
    Room,
    TeacherAssignment,
    Routine,
    ClassRoutine,
    Student,
    Attendance,
    AdvancedAttendance,
    FeeStructure,
    Fee,
    PaymentHistory,
    Result,
    Notice,
    Notification,
    SchoolEvent,
    Exam,
    ExamSchedule
];

function resolveEnvPath() {
    const candidates = [
        process.env.SEED_ENV_FILE,
        path.join(__dirname, '..', '.env'),
        path.join(__dirname, '..', '.env.test')
    ].filter(Boolean);

    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

const envPath = resolveEnvPath();
if (envPath) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}

const DEFAULT_PASSWORD = process.env.SEED_TEST_PASSWORD || 'TestPass123!';

function objectId() {
    return new mongoose.Types.ObjectId();
}

function addDays(baseDate, days) {
    const next = new Date(baseDate);
    next.setDate(next.getDate() + days);
    return next;
}

function dateAtHour(baseDate, hour = 12) {
    const next = new Date(baseDate);
    next.setHours(hour, 0, 0, 0);
    return next;
}

function monthWindow(offset) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + offset, 10, 12, 0, 0, 0);
}

function calculateGrade(marks) {
    if (marks >= 80) return 'A+';
    if (marks >= 70) return 'A';
    if (marks >= 60) return 'A-';
    if (marks >= 50) return 'B';
    if (marks >= 40) return 'C';
    if (marks >= 33) return 'D';
    return 'F';
}

function calculateGpa(subjects) {
    const gradePoint = {
        'A+': 5.0,
        A: 4.0,
        'A-': 3.5,
        B: 3.0,
        C: 2.0,
        D: 1.0,
        F: 0.0
    };

    if (!subjects.length) {
        return 0;
    }

    const total = subjects.reduce((sum, subject) => sum + (gradePoint[subject.grade] || 0), 0);
    return Number((total / subjects.length).toFixed(2));
}

function buildSubjectMarks(studentGlobalIndex, classLevel, examOffset) {
    return SUBJECT_DEFINITIONS.map((subject, subjectIndex) => {
        const marks = 45 + ((studentGlobalIndex * 7 + classLevel * 5 + subjectIndex * 9 + examOffset * 4) % 51);
        return {
            subjectName: subject.name,
            marks,
            grade: calculateGrade(marks)
        };
    });
}

function getRecentSchoolDates(count) {
    const dates = [];
    let cursor = new Date();

    while (dates.length < count) {
        const weekday = cursor.toLocaleDateString('en-US', { weekday: 'long' });
        if (CLASS_ROUTINE_DAYS.includes(weekday)) {
            dates.push(dateAtHour(cursor));
        }
        cursor = addDays(cursor, -1);
    }

    return dates.reverse();
}

function getAttendanceStatus(studentSequence, dateIndex) {
    if ((studentSequence + dateIndex) % 11 === 0) return 'absent';
    if ((studentSequence + dateIndex) % 7 === 0) return 'late';
    if ((studentSequence + dateIndex) % 19 === 0) return 'leave';
    return 'present';
}

function buildRoutinePeriods(subjectDocsForLevel, roomNumber, dayIndex) {
    return PERIOD_TIMES.map(([startTime, endTime], periodIndex) => {
        const subjectDoc = subjectDocsForLevel[(periodIndex + dayIndex) % subjectDocsForLevel.length];
        const teacherId = subjectDoc.teachers[0].teacherId;
        return {
            periodNumber: periodIndex + 1,
            period: periodIndex + 1,
            startTime,
            endTime,
            duration: 45,
            subjectId: subjectDoc._id,
            subject: subjectDoc.subjectName,
            subjectName: subjectDoc.subjectName,
            teacherId,
            teacher: teacherId,
            roomNumber,
            room: roomNumber,
            isBreak: false
        };
    });
}

async function deleteExistingSeedData() {
    await Promise.all(
        ALL_MODELS.map((model) => model.collection.deleteMany({ seedTag: SEED_TAG }))
    );
}

async function hasExistingSeedData() {
    const existingSeededSchool = await School.exists({ seedTag: SEED_TAG });
    return Boolean(existingSeededSchool);
}

async function insertMany(model, docs) {
    if (!docs.length) {
        return;
    }

    await model.collection.insertMany(docs, { ordered: true });
}

async function seedTestData() {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is required. Create a .env file or use .env.test, then rerun the seed command.');
    }

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    const now = new Date();
    const academicYear = `${now.getFullYear()}-${now.getFullYear() + 1}`;
    const recentAttendanceDates = getRecentSchoolDates(5);

    const payload = {
        schools: [],
        subscriptions: [],
        academicSessions: [],
        users: [],
        teachers: [],
        classes: [],
        sections: [],
        rooms: [],
        subjects: [],
        teacherAssignments: [],
        routines: [],
        classRoutines: [],
        students: [],
        attendance: [],
        advancedAttendance: [],
        feeStructures: [],
        fees: [],
        paymentHistory: [],
        results: [],
        notices: [],
        notifications: [],
        schoolEvents: [],
        exams: [],
        examSchedules: []
    };

    const loginSummary = [];

    for (let schoolIndex = 0; schoolIndex < SCHOOL_BLUEPRINTS.length; schoolIndex += 1) {
        const blueprint = SCHOOL_BLUEPRINTS[schoolIndex];
        const preset = PLAN_PRESETS[blueprint.plan] || PLAN_PRESETS.trial;
        const schoolId = objectId();
        const principalId = objectId();
        const accountantId = objectId();
        const academicSessionId = objectId();
        const subscriptionId = objectId();
        const schoolCode = blueprint.schoolCode;
        const schoolName = blueprint.schoolName;
        const createdAt = addDays(now, -(schoolIndex + 1));
        const subscriptionStartDate = addDays(now, -30);
        const subscriptionEndDate = addDays(subscriptionStartDate, preset.durationDays);

        payload.schools.push({
            _id: schoolId,
            schoolName,
            schoolCode,
            address: blueprint.address,
            phone: `+88017000000${schoolIndex + 1}`,
            email: `info.${schoolCode.toLowerCase()}@seed.smartcampus.local`,
            schoolType: 'secondary',
            description: `${schoolName} seeded for automated QA and manual workflow testing.`,
            establishedYear: 2000 + schoolIndex,
            location: {
                country: 'Bangladesh',
                division: blueprint.division,
                district: blueprint.district,
                upazila: blueprint.upazila,
                address: blueprint.address
            },
            principal: principalId,
            academicSettings: {
                currentSession: academicYear,
                sessionStartMonth: 1,
                gradingSystem: 'gpa_5',
                workingDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
                classDuration: 45,
                breakTime: 15,
                lunchBreak: 30
            },
            subscription: {
                plan: blueprint.plan,
                billingCycle: preset.billingCycle,
                status: 'active',
                startDate: subscriptionStartDate,
                endDate: subscriptionEndDate
            },
            amountPaid: preset.amount,
            features: preset.features,
            settings: {
                timezone: 'Asia/Dhaka',
                currency: 'BDT',
                language: 'en',
                dateFormat: 'DD/MM/YYYY',
                smsProvider: 'none',
                emailProvider: 'none'
            },
            stats: {
                totalStudents: 100,
                totalTeachers: SUBJECT_DEFINITIONS.length,
                totalClasses: CLASS_LEVELS.length * SECTIONS.length,
                totalSubjects: CLASS_LEVELS.length * SUBJECT_DEFINITIONS.length,
                storageUsed: 0,
                lastActivity: now
            },
            isActive: true,
            isVerified: true,
            verificationDate: createdAt,
            tags: ['seed', 'test', 'automation'],
            notes: 'Generated by seed-test-data.js',
            createdBy: principalId,
            createdAt,
            updatedAt: now,
            seedTag: SEED_TAG
        });

        payload.subscriptions.push({
            _id: subscriptionId,
            schoolId,
            plan: blueprint.plan,
            status: 'active',
            billingCycle: preset.billingCycle,
            startDate: subscriptionStartDate,
            endDate: subscriptionEndDate,
            trialEndDate: blueprint.plan === 'trial' ? subscriptionEndDate : null,
            amount: {
                currency: 'USD',
                amount: preset.amount,
                discount: 0,
                tax: 0,
                total: preset.amount
            },
            paymentMethod: 'card',
            autoRenew: blueprint.plan !== 'trial',
            usage: {
                users: 160,
                students: 100,
                teachers: SUBJECT_DEFINITIONS.length,
                classes: CLASS_LEVELS.length * SECTIONS.length,
                storage: 0,
                apiCalls: 0
            },
            limits: preset.limits,
            features: preset.features,
            billingHistory: [
                {
                    date: subscriptionStartDate,
                    type: 'charge',
                    amount: preset.amount,
                    description: `${blueprint.plan} subscription seed invoice`,
                    transactionId: `${schoolCode}-SUB-001`,
                    status: 'completed'
                }
            ],
            invoices: [
                {
                    invoiceNumber: `${schoolCode}-INV-001`,
                    date: subscriptionStartDate,
                    dueDate: addDays(subscriptionStartDate, 7),
                    amount: preset.amount,
                    status: 'paid'
                }
            ],
            createdAt,
            updatedAt: now,
            seedTag: SEED_TAG
        });

        payload.academicSessions.push({
            _id: academicSessionId,
            schoolId,
            schoolCode,
            name: `${academicYear} Session`,
            startDate: new Date(now.getFullYear(), 0, 1),
            endDate: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
            academicYear,
            isCurrent: true,
            isActive: true,
            createdBy: principalId,
            createdAt,
            updatedAt: now,
            seedTag: SEED_TAG
        });

        payload.users.push(
            {
                _id: principalId,
                name: `Principal ${schoolIndex + 1}`,
                email: `principal.${schoolCode.toLowerCase()}@seed.smartcampus.local`,
                password: hashedPassword,
                role: 'principal',
                schoolId,
                schoolCode,
                schoolName,
                phone: `+88018000000${schoolIndex + 1}`,
                address: blueprint.address,
                isApproved: true,
                emailVerified: true,
                isActive: true,
                permissions: ['manage_school', 'manage_teachers', 'manage_students'],
                createdAt,
                updatedAt: now,
                seedTag: SEED_TAG
            },
            {
                _id: accountantId,
                name: `Accountant ${schoolIndex + 1}`,
                email: `accountant.${schoolCode.toLowerCase()}@seed.smartcampus.local`,
                password: hashedPassword,
                role: 'accountant',
                schoolId,
                schoolCode,
                schoolName,
                phone: `+88019000000${schoolIndex + 1}`,
                address: blueprint.address,
                isApproved: true,
                emailVerified: true,
                isActive: true,
                permissions: ['manage_fees'],
                createdAt,
                updatedAt: now,
                seedTag: SEED_TAG
            }
        );

        const teacherBySubjectKey = new Map();
        const teacherProfileByUserId = new Map();

        SUBJECT_DEFINITIONS.forEach((subject, teacherIndex) => {
            const teacherUserId = objectId();
            const teacherProfileId = objectId();
            const teacherUser = {
                _id: teacherUserId,
                name: `${subject.name} Teacher ${schoolIndex + 1}`,
                email: `${subject.code.toLowerCase()}.teacher.${schoolCode.toLowerCase()}@seed.smartcampus.local`,
                password: hashedPassword,
                role: 'teacher',
                schoolId,
                schoolCode,
                schoolName,
                phone: `+880191${schoolIndex}${teacherIndex}000`,
                address: `${subject.name} Department, ${schoolName}`,
                subjects: [subject.name],
                classes: CLASS_LEVELS.map((level) => `Class ${level}`),
                isApproved: true,
                emailVerified: true,
                isActive: true,
                createdAt,
                updatedAt: now,
                seedTag: SEED_TAG
            };

            const teacherProfile = {
                _id: teacherProfileId,
                userId: teacherUserId,
                schoolCode,
                employeeId: `${schoolCode}-TCH-${String(teacherIndex + 1).padStart(3, '0')}`,
                qualification: `Master's in ${subject.name}`,
                experience: `${4 + teacherIndex} years`,
                subjects: [subject.name],
                subjectAssignments: [],
                availability: {
                    maxPeriodsPerDay: 8,
                    maxPeriodsPerWeek: 60,
                    preferredDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
                    preferredPeriods: [1, 2, 3, 4, 5, 6]
                },
                address: teacherUser.address,
                dateOfBirth: new Date(1985 + teacherIndex, teacherIndex % 12, 10 + teacherIndex),
                gender: teacherIndex % 2 === 0 ? 'male' : 'female',
                emergencyContact: {
                    name: `Emergency Contact ${teacherIndex + 1}`,
                    phone: `+8801711${schoolIndex}${teacherIndex}00`,
                    relationship: 'Sibling'
                },
                joiningDate: addDays(now, -(365 * (teacherIndex + 1))),
                salary: {
                    amount: 35000 + teacherIndex * 2500,
                    currency: 'BDT'
                },
                maxPeriodsPerWeek: 60,
                isClassTeacher: false,
                isActive: true,
                createdAt,
                updatedAt: now,
                seedTag: SEED_TAG
            };

            payload.users.push(teacherUser);
            payload.teachers.push(teacherProfile);
            teacherBySubjectKey.set(subject.code, { user: teacherUser, profile: teacherProfile });
            teacherProfileByUserId.set(String(teacherUserId), teacherProfile);
        });

        const classDocs = [];
        const sectionDocs = [];
        const classLookup = new Map();
        const sectionLookup = new Map();
        const subjectsByLevel = new Map();

        CLASS_LEVELS.forEach((level, levelIndex) => {
            const levelSubjects = [];

            SUBJECT_DEFINITIONS.forEach((subject) => {
                const subjectId = objectId();
                const assignedTeacher = teacherBySubjectKey.get(subject.code).user;
                const subjectDoc = {
                    _id: subjectId,
                    schoolCode,
                    subjectName: subject.name,
                    name: subject.name,
                    subjectCode: `${subject.code}${level}`,
                    code: `${subject.code}${level}`,
                    category: subject.category,
                    classLevels: [level],
                    description: `${subject.name} curriculum for Class ${level}`,
                    credits: subject.credits,
                    periodsPerWeek: subject.periodsPerWeek,
                    passingMarks: 33,
                    totalMarks: 100,
                    teachers: [
                        {
                            teacherId: assignedTeacher._id,
                            assignedDate: createdAt,
                            isActive: true
                        }
                    ],
                    isActive: true,
                    createdAt,
                    updatedAt: now,
                    seedTag: SEED_TAG
                };

                payload.subjects.push(subjectDoc);
                levelSubjects.push(subjectDoc);
            });

            subjectsByLevel.set(level, levelSubjects);

            SECTIONS.forEach((sectionName, sectionIndex) => {
                const classId = objectId();
                const sectionId = objectId();
                const homeroomTeacher = teacherBySubjectKey.get(SUBJECT_DEFINITIONS[(levelIndex + sectionIndex) % SUBJECT_DEFINITIONS.length].code).user;
                const roomNumber = `${level}${sectionName}-10${sectionIndex + 1}`;
                const floor = level >= 9 ? '3rd Floor' : level >= 7 ? '2nd Floor' : '1st Floor';

                const roomDoc = {
                    _id: objectId(),
                    schoolId,
                    schoolCode,
                    roomNumber,
                    building: 'Academic Building',
                    floor,
                    capacity: 40,
                    roomType: 'Classroom',
                    type: 'Classroom',
                    isActive: true,
                    createdBy: principalId,
                    updatedAt: now,
                    createdAt,
                    seedTag: SEED_TAG
                };

                payload.rooms.push(roomDoc);

                const classDoc = {
                    _id: classId,
                    schoolCode,
                    className: `Class ${level}`,
                    name: `Class ${level}`,
                    section: sectionName,
                    classLevel: level,
                    capacity: 40,
                    currentStudents: 0,
                    classTeacher: homeroomTeacher._id,
                    roomNumber,
                    floor,
                    subjects: [],
                    academicYear,
                    isActive: true,
                    createdAt,
                    updatedAt: now,
                    seedTag: SEED_TAG
                };

                const sectionDoc = {
                    _id: sectionId,
                    sectionName: sectionName,
                    name: sectionName,
                    classId,
                    capacity: 40,
                    roomNumber,
                    schoolCode,
                    createdBy: principalId,
                    createdAt,
                    updatedAt: now,
                    seedTag: SEED_TAG
                };

                classDocs.push(classDoc);
                sectionDocs.push(sectionDoc);
                classLookup.set(`${level}-${sectionName}`, classDoc);
                sectionLookup.set(`${level}-${sectionName}`, sectionDoc);

                const homeroomProfile = teacherProfileByUserId.get(String(homeroomTeacher._id));
                if (homeroomProfile && !homeroomProfile.classTeacherOf) {
                    homeroomProfile.classTeacherOf = {
                        class: `Class ${level}`,
                        section: sectionName,
                        assignedDate: createdAt
                    };
                    homeroomProfile.isClassTeacher = true;
                }
            });
        });

        payload.classes.push(...classDocs);
        payload.sections.push(...sectionDocs);

        CLASS_LEVELS.forEach((level) => {
            const classDocsForLevel = classDocs.filter((classDoc) => classDoc.classLevel === level);
            const levelSubjects = subjectsByLevel.get(level);

            levelSubjects.forEach((subjectDoc, subjectIndex) => {
                const teacherInfo = teacherBySubjectKey.get(SUBJECT_DEFINITIONS[subjectIndex].code);
                const assignmentDoc = {
                    _id: objectId(),
                    schoolCode,
                    teacher: teacherInfo.user._id,
                    subject: String(subjectDoc._id),
                    subjectName: subjectDoc.subjectName,
                    classes: classDocsForLevel.map((classDoc) => String(classDoc._id)),
                    sections: classDocsForLevel.map((classDoc) => classDoc.section),
                    periodsPerWeek: subjectDoc.periodsPerWeek,
                    academicYear,
                    semester: 'First',
                    isActive: true,
                    assignedBy: principalId,
                    assignedAt: createdAt,
                    updatedAt: now,
                    seedTag: SEED_TAG
                };

                payload.teacherAssignments.push(assignmentDoc);

                classDocsForLevel.forEach((classDoc, classIndex) => {
                    classDoc.subjects.push({
                        subjectId: subjectDoc._id,
                        subjectName: subjectDoc.subjectName,
                        subjectCode: subjectDoc.subjectCode,
                        teacherId: teacherInfo.user._id,
                        teacherName: teacherInfo.user.name,
                        periodsPerWeek: subjectDoc.periodsPerWeek,
                        isActive: true
                    });

                    teacherInfo.profile.subjectAssignments.push({
                        subjectId: subjectDoc._id,
                        subjectName: subjectDoc.subjectName,
                        className: classDoc.className,
                        section: classDoc.section,
                        isPrimary: classIndex === 0,
                        assignedDate: createdAt,
                        isActive: true
                    });
                });
            });
        });

        const examSeeds = [
            {
                _id: objectId(),
                schoolCode,
                name: 'Midterm Examination',
                examName: 'Midterm Examination',
                examType: 'Midterm',
                year: now.getFullYear(),
                startDate: addDays(now, 10),
                endDate: addDays(now, 14),
                subjects: SUBJECT_DEFINITIONS.map((subject) => subject.name),
                classes: CLASS_LEVELS.map((level) => `Class ${level}`),
                totalMarks: 100,
                description: 'Midterm exam schedule for seeded demo data.',
                isActive: true,
                createdBy: principalId,
                createdAt,
                updatedAt: now,
                seedTag: SEED_TAG
            },
            {
                _id: objectId(),
                schoolCode,
                name: 'Final Examination',
                examName: 'Final Examination',
                examType: 'Final',
                year: now.getFullYear(),
                startDate: addDays(now, 45),
                endDate: addDays(now, 52),
                subjects: SUBJECT_DEFINITIONS.map((subject) => subject.name),
                classes: CLASS_LEVELS.map((level) => `Class ${level}`),
                totalMarks: 100,
                description: 'Final exam schedule for seeded demo data.',
                isActive: true,
                createdBy: principalId,
                createdAt,
                updatedAt: now,
                seedTag: SEED_TAG
            }
        ];

        payload.exams.push(...examSeeds);

        examSeeds.forEach((examSeed, examSeedIndex) => {
            const displayLevel = CLASS_LEVELS[CLASS_LEVELS.length - 1 - examSeedIndex];
            const displaySubject = subjectsByLevel.get(displayLevel)[examSeedIndex];
            const slots = SUBJECT_DEFINITIONS.slice(0, 5).map((subjectDef, slotIndex) => {
                const subjectDoc = subjectsByLevel.get(displayLevel)[slotIndex];
                return {
                    date: addDays(examSeed.startDate, slotIndex),
                    startTime: '10:00',
                    endTime: '12:00',
                    subjectId: subjectDoc._id,
                    subjectName: subjectDoc.subjectName,
                    classLevel: String(displayLevel),
                    section: slotIndex % 2 === 0 ? 'A' : 'B',
                    roomNumber: `${displayLevel}${slotIndex % 2 === 0 ? 'A' : 'B'}-10${(slotIndex % 2) + 1}`,
                    fullMarks: 100,
                    passMarks: 33
                };
            });

            payload.examSchedules.push({
                _id: objectId(),
                schoolId,
                schoolCode,
                examId: examSeed._id,
                examName: examSeed.name,
                name: examSeed.name,
                description: examSeed.description,
                examType: examSeed.examType,
                academicSessionId,
                academicYear,
                slots,
                class: {
                    name: `Class ${displayLevel}`,
                    section: 'A'
                },
                subject: {
                    name: displaySubject.subjectName
                },
                date: slots[0].date,
                duration: 120,
                totalMarks: 100,
                isActive: true,
                isPublished: true,
                publishedAt: createdAt,
                publishedBy: principalId,
                createdBy: principalId,
                updatedAt: now,
                createdAt,
                seedTag: SEED_TAG
            });
        });

        const parentDocs = [];
        const studentDocs = [];
        const studentUserDocs = [];
        const feeDocs = [];
        const paymentHistoryDocs = [];
        const resultDocs = [];
        const advancedAttendanceDocs = [];
        const attendanceDocs = [];
        const attendanceSummaryByStudent = new Map();
        const firstTeacher = teacherBySubjectKey.get(SUBJECT_DEFINITIONS[0].code).user;

        const feeStructureByLevel = new Map();
        CLASS_LEVELS.forEach((level) => {
            const monthlyStructureId = objectId();
            const examStructureId = objectId();
            const monthlyAmount = 1200 + (level - 6) * 100;

            const monthlyStructure = {
                _id: monthlyStructureId,
                schoolId,
                schoolCode,
                academicSessionId,
                academicYear,
                classLevel: `Class ${level}`,
                className: `Class ${level}`,
                feeType: 'Monthly',
                name: `Monthly Tuition - Class ${level}`,
                description: `Monthly tuition fee structure for Class ${level}`,
                amount: monthlyAmount,
                dueDayOfMonth: 10,
                dueDate: new Date(now.getFullYear(), now.getMonth(), 10),
                lateFinePerDay: 10,
                isActive: true,
                createdBy: accountantId,
                createdAt,
                updatedAt: now,
                seedTag: SEED_TAG
            };

            const examStructure = {
                _id: examStructureId,
                schoolId,
                schoolCode,
                academicSessionId,
                academicYear,
                classLevel: `Class ${level}`,
                className: `Class ${level}`,
                feeType: 'Yearly',
                name: `Exam Fee - Class ${level}`,
                description: `Exam-related yearly fee structure for Class ${level}`,
                amount: 800 + (level - 6) * 50,
                dueDayOfMonth: 20,
                dueDate: new Date(now.getFullYear(), now.getMonth(), 20),
                lateFinePerDay: 20,
                isActive: true,
                createdBy: accountantId,
                createdAt,
                updatedAt: now,
                seedTag: SEED_TAG
            };

            payload.feeStructures.push(monthlyStructure, examStructure);
            feeStructureByLevel.set(level, { monthly: monthlyStructure, exam: examStructure });
        });

        const orderedClasses = classDocs
            .slice()
            .sort((left, right) => left.classLevel - right.classLevel || left.section.localeCompare(right.section));

        let globalStudentIndex = 0;
        const parentChildrenMap = new Map();

        orderedClasses.forEach((classDoc, classOrderIndex) => {
            const sectionDoc = sectionLookup.get(`${classDoc.classLevel}-${classDoc.section}`);
            const subjectsForClass = subjectsByLevel.get(classDoc.classLevel);

            for (let studentIndex = 1; studentIndex <= 10; studentIndex += 1) {
                globalStudentIndex += 1;
                const studentId = objectId();
                const parentGroup = Math.ceil(globalStudentIndex / 2);
                const parentKey = `${schoolCode}-P-${String(parentGroup).padStart(3, '0')}`;
                let parentRecord = parentChildrenMap.get(parentKey);

                if (!parentRecord) {
                    const parentId = objectId();
                    const parentDoc = {
                        _id: parentId,
                        name: `Parent ${schoolIndex + 1}-${String(parentGroup).padStart(3, '0')}`,
                        email: `${parentKey.toLowerCase()}@seed.smartcampus.local`,
                        password: hashedPassword,
                        role: 'parent',
                        schoolId,
                        schoolCode,
                        schoolName,
                        phone: `+880181${schoolIndex}${String(parentGroup).padStart(4, '0')}`,
                        address: blueprint.address,
                        linkedStudents: 0,
                        isApproved: true,
                        emailVerified: true,
                        isActive: true,
                        createdAt,
                        updatedAt: now,
                        seedTag: SEED_TAG
                    };

                    parentDocs.push(parentDoc);
                    parentRecord = { parentDoc, children: [] };
                    parentChildrenMap.set(parentKey, parentRecord);
                }

                const parentDoc = parentRecord.parentDoc;
                const rollNumber = String(studentIndex + (classOrderIndex % 2) * 10).padStart(2, '0');
                const userStudent = {
                    _id: studentId,
                    name: `Student ${schoolIndex + 1}-${classDoc.classLevel}${classDoc.section}-${rollNumber}`,
                    email: `student.${schoolCode.toLowerCase()}.${classDoc.classLevel}${classDoc.section}.${rollNumber}@seed.smartcampus.local`,
                    password: hashedPassword,
                    role: 'student',
                    schoolId,
                    schoolCode,
                    schoolName,
                    classId: classDoc._id,
                    section: classDoc.section,
                    rollNumber: String(Number(rollNumber)),
                    studentClass: classDoc.className,
                    phone: `+880151${schoolIndex}${classDoc.classLevel}${studentIndex.toString().padStart(2, '0')}`,
                    address: blueprint.address,
                    parentInfo: {
                        name: parentDoc.name,
                        email: parentDoc.email,
                        phone: parentDoc.phone
                    },
                    isApproved: true,
                    emailVerified: true,
                    isActive: true,
                    createdAt,
                    updatedAt: now,
                    seedTag: SEED_TAG
                };

                const birthday = globalStudentIndex % 20 === 0
                    ? new Date(now.getFullYear() - 13, now.getMonth(), now.getDate())
                    : new Date(now.getFullYear() - 13, (globalStudentIndex + schoolIndex) % 12, ((globalStudentIndex * 2) % 27) + 1);

                const legacyStudent = {
                    _id: studentId,
                    name: userStudent.name,
                    roll: String(Number(rollNumber)),
                    rollNumber: String(Number(rollNumber)),
                    studentClass: classDoc.className,
                    section: classDoc.section,
                    classId: classDoc._id,
                    sectionId: sectionDoc._id,
                    fatherName: `${parentDoc.name} Sr.`,
                    motherName: `${parentDoc.name} Mme.`,
                    dateOfBirth: birthday,
                    gender: globalStudentIndex % 2 === 0 ? 'Male' : 'Female',
                    address: blueprint.address,
                    phone: userStudent.phone,
                    guardian: {
                        name: parentDoc.name,
                        phone: parentDoc.phone,
                        email: parentDoc.email
                    },
                    emergencyContact: parentDoc.phone,
                    studentId: `${schoolCode}-STD-${String(globalStudentIndex).padStart(4, '0')}`,
                    totalDue: 0,
                    schoolCode,
                    parentId: parentDoc._id,
                    addedBy: principalId,
                    updatedBy: principalId,
                    isActive: true,
                    academicHistory: [
                        {
                            academicYear,
                            className: classDoc.className,
                            section: classDoc.section,
                            promotionDate: createdAt
                        }
                    ],
                    createdAt,
                    updatedAt: now,
                    seedTag: SEED_TAG
                };

                studentUserDocs.push(userStudent);
                studentDocs.push(legacyStudent);
                parentRecord.children.push(studentId);
                classDoc.currentStudents += 1;

                const feeStructure = feeStructureByLevel.get(classDoc.classLevel).monthly;
                let studentTotalDue = 0;

                [-2, -1, 0].forEach((monthOffset) => {
                    const billingDate = monthWindow(monthOffset);
                    const feeId = objectId();
                    const amountDue = feeStructure.amount;
                    const paymentPattern = (globalStudentIndex + Math.abs(monthOffset)) % 3;
                    const amountPaid = paymentPattern === 0 ? amountDue : paymentPattern === 1 ? Math.round(amountDue * 0.6) : 0;
                    const status = amountPaid >= amountDue ? 'Paid' : amountPaid > 0 ? 'Partial' : 'Unpaid';
                    const dueDate = new Date(billingDate.getFullYear(), billingDate.getMonth(), 15, 12, 0, 0, 0);
                    const dueLeft = Math.max(0, amountDue - amountPaid);
                    studentTotalDue += dueLeft;

                    feeDocs.push({
                        _id: feeId,
                        studentId,
                        month: billingDate.getMonth() + 1,
                        year: billingDate.getFullYear(),
                        amountDue,
                        amountPaid,
                        amount: amountDue,
                        paidAmount: amountPaid,
                        feeType: 'Monthly Tuition',
                        description: `${classDoc.className} monthly tuition`,
                        dueDate,
                        classId: classDoc._id,
                        sectionId: sectionDoc._id,
                        feeStructureId: feeStructure._id,
                        status,
                        schoolCode,
                        createdBy: accountantId,
                        updatedBy: accountantId,
                        createdAt,
                        updatedAt: now,
                        lastPaymentDate: amountPaid > 0 ? addDays(dueDate, -3) : null,
                        seedTag: SEED_TAG
                    });

                    if (amountPaid > 0) {
                        paymentHistoryDocs.push({
                            _id: objectId(),
                            feeId,
                            studentId,
                            month: billingDate.getMonth() + 1,
                            year: billingDate.getFullYear(),
                            amount: amountPaid,
                            previousDue: amountDue,
                            newDue: Math.max(0, amountDue - amountPaid),
                            paymentMethod: amountPaid === amountDue ? 'Cash' : 'Mobile Banking',
                            transactionId: `${schoolCode}-PAY-${globalStudentIndex}-${Math.abs(monthOffset)}`,
                            remarks: 'Seed payment transaction',
                            receivedBy: accountantId,
                            recordedBy: accountantId,
                            schoolCode,
                            paymentDate: addDays(dueDate, -2),
                            createdAt: addDays(dueDate, -2),
                            seedTag: SEED_TAG
                        });
                    }
                });

                legacyStudent.totalDue = studentTotalDue;

                ['Midterm Examination', 'Final Examination'].forEach((examName, examOffset) => {
                    const subjectMarks = buildSubjectMarks(globalStudentIndex, classDoc.classLevel, examOffset);
                    resultDocs.push({
                        _id: objectId(),
                        studentId,
                        schoolCode,
                        studentClass: classDoc.className,
                        section: classDoc.section,
                        roll: Number(rollNumber),
                        examName,
                        academicYear,
                        examDate: examOffset === 0 ? addDays(now, -25) : addDays(now, -5),
                        subjects: subjectMarks,
                        totalMarks: subjectMarks.reduce((sum, subject) => sum + subject.marks, 0),
                        gpa: calculateGpa(subjectMarks),
                        gradingSystem: 'standard',
                        remarks: examOffset === 0 ? 'Consistent performance.' : 'Showing good progress.',
                        publishedAt: addDays(now, examOffset === 0 ? -20 : -2),
                        isPublished: true,
                        isActive: true,
                        publishedBy: principalId,
                        updatedBy: principalId,
                        createdAt,
                        updatedAt: now,
                        seedTag: SEED_TAG
                    });
                });

                recentAttendanceDates.forEach((attendanceDate, dateIndex) => {
                    const status = getAttendanceStatus(globalStudentIndex, dateIndex);
                    const key = String(studentId);
                    const summary = attendanceSummaryByStudent.get(key) || {
                        totalDays: 0,
                        presentDays: 0,
                        absentDays: 0,
                        lateDays: 0
                    };

                    summary.totalDays += 1;
                    if (status === 'present') summary.presentDays += 1;
                    if (status === 'absent') summary.absentDays += 1;
                    if (status === 'late') {
                        summary.presentDays += 1;
                        summary.lateDays += 1;
                    }

                    attendanceSummaryByStudent.set(key, summary);

                    advancedAttendanceDocs.push({
                        _id: objectId(),
                        schoolId,
                        academicSessionId,
                        attendanceType: 'student',
                        studentId,
                        classId: classDoc._id,
                        sectionId: sectionDoc._id,
                        subjectId: subjectsForClass[dateIndex % subjectsForClass.length]._id,
                        periodNumber: 1,
                        date: attendanceDate,
                        checkInTime: status === 'absent' ? null : status === 'late' ? '08:12' : '07:55',
                        checkOutTime: status === 'absent' ? null : '13:05',
                        status,
                        lateMinutes: status === 'late' ? 12 : 0,
                        isLate: status === 'late',
                        markedBy: firstTeacher._id,
                        markedByRole: 'teacher',
                        markingMethod: 'manual',
                        notes: status === 'absent' ? 'Parent informed by office.' : 'Seeded attendance entry.',
                        verified: true,
                        verifiedBy: principalId,
                        verifiedAt: addDays(attendanceDate, 0),
                        createdAt,
                        updatedAt: now,
                        seedTag: SEED_TAG
                    });
                });
            }
        });

        payload.users.push(...parentDocs, ...studentUserDocs);
        payload.students.push(...studentDocs);
        payload.fees.push(...feeDocs);
        payload.paymentHistory.push(...paymentHistoryDocs);
        payload.results.push(...resultDocs);

        parentChildrenMap.forEach(({ parentDoc, children }) => {
            parentDoc.linkedStudents = children.length;
            parentDoc.students = children;
        });

        advancedAttendanceDocs.forEach((attendanceDoc) => {
            const summary = attendanceSummaryByStudent.get(String(attendanceDoc.studentId));
            const percentage = summary.totalDays > 0
                ? Math.round((summary.presentDays / summary.totalDays) * 100)
                : 0;

            attendanceDoc.monthlyStats = {
                totalDays: summary.totalDays,
                presentDays: summary.presentDays,
                absentDays: summary.absentDays,
                lateDays: summary.lateDays,
                percentage
            };

            if (percentage < 75) {
                attendanceDoc.alerts = [
                    {
                        type: 'low_attendance',
                        severity: percentage < 60 ? 'critical' : 'high',
                        message: `Attendance percentage is ${percentage}%`,
                        triggeredAt: attendanceDoc.date,
                        acknowledged: false
                    }
                ];
            }
        });

        payload.advancedAttendance.push(...advancedAttendanceDocs);

        orderedClasses.forEach((classDoc) => {
            const studentsInClass = studentDocs.filter(
                (studentDoc) => String(studentDoc.classId) === String(classDoc._id)
            );

            recentAttendanceDates.forEach((attendanceDate) => {
                const subjectDoc = subjectsByLevel.get(classDoc.classLevel)[0];
                const attendanceEntries = studentsInClass.map((studentDoc) => {
                    const advanced = advancedAttendanceDocs.find(
                        (entry) =>
                            String(entry.studentId) === String(studentDoc._id) &&
                            entry.date.getTime() === attendanceDate.getTime()
                    );

                    const mappedStatus =
                        advanced.status === 'present'
                            ? 'Present'
                            : advanced.status === 'late'
                              ? 'Late'
                              : advanced.status === 'leave'
                                ? 'Holiday'
                                : 'Absent';

                    return {
                        studentId: studentDoc._id,
                        status: mappedStatus,
                        remarks: 'Seeded record'
                    };
                });

                attendanceDocs.push({
                    _id: objectId(),
                    schoolCode,
                    studentClass: classDoc.className,
                    section: classDoc.section,
                    classId: classDoc._id,
                    subjectId: subjectDoc._id,
                    teacherId: classDoc.classTeacher,
                    date: attendanceDate,
                    subject: subjectDoc.subjectName,
                    records: attendanceEntries,
                    attendance: attendanceEntries,
                    takenBy: classDoc.classTeacher,
                    createdAt,
                    updatedAt: now,
                    seedTag: SEED_TAG
                });
            });

            const classSubjects = subjectsByLevel.get(classDoc.classLevel);
            const routineSchedule = LEGACY_ROUTINE_DAYS.map((day, dayIndex) => ({
                day,
                periods: buildRoutinePeriods(classSubjects, classDoc.roomNumber, dayIndex)
            }));

            payload.routines.push({
                _id: objectId(),
                schoolCode,
                classId: classDoc._id,
                academicYear,
                semester: 'First',
                effectiveFrom: new Date(now.getFullYear(), 0, 1),
                effectiveTo: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999),
                schedule: routineSchedule,
                breaks: [
                    {
                        name: 'Morning Break',
                        startTime: '10:25',
                        endTime: '10:40',
                        days: LEGACY_ROUTINE_DAYS
                    }
                ],
                isActive: true,
                createdBy: principalId,
                lastModifiedBy: principalId,
                createdAt,
                updatedAt: now,
                seedTag: SEED_TAG
            });

            CLASS_ROUTINE_DAYS.forEach((day, dayIndex) => {
                const dailyPeriods = buildRoutinePeriods(classSubjects, classDoc.roomNumber, dayIndex).map((periodDoc) => ({
                    period: periodDoc.period,
                    startTime: periodDoc.startTime,
                    endTime: periodDoc.endTime,
                    subject: periodDoc.subject,
                    teacher: periodDoc.teacher,
                    room: periodDoc.room
                }));

                payload.classRoutines.push({
                    _id: objectId(),
                    schoolCode,
                    studentClass: classDoc.className,
                    section: classDoc.section,
                    day,
                    periods: dailyPeriods,
                    academicYear,
                    semester: 'First',
                    isActive: true,
                    isPublished: true,
                    publishedAt: createdAt,
                    publishedBy: principalId,
                    createdBy: principalId,
                    updatedBy: principalId,
                    createdAt,
                    updatedAt: now,
                    seedTag: SEED_TAG
                });
            });
        });

        payload.attendance.push(...attendanceDocs);

        payload.notices.push(
            {
                _id: objectId(),
                schoolId,
                schoolCode,
                title: `${schoolName} Welcome Notice`,
                description: 'Seeded welcome notice for teachers, students, and parents.',
                content: 'Seeded welcome notice for teachers, students, and parents.',
                noticeType: 'general',
                category: 'general',
                targetType: 'all',
                targetRoles: ['teacher', 'student', 'parent', 'accountant'],
                priority: 'medium',
                publishDate: addDays(now, -3),
                publishedAt: addDays(now, -3),
                isPublished: true,
                status: 'active',
                isActive: true,
                createdBy: principalId,
                updatedBy: principalId,
                isDeleted: false,
                createdAt,
                updatedAt: now,
                seedTag: SEED_TAG
            },
            {
                _id: objectId(),
                schoolId,
                schoolCode,
                title: 'Monthly Fee Reminder',
                description: 'Parents are requested to review the seeded fee ledger before the 15th of this month.',
                content: 'Parents are requested to review the seeded fee ledger before the 15th of this month.',
                noticeType: 'fees',
                category: 'fees',
                targetType: 'role',
                targetRoles: ['parent', 'accountant'],
                priority: 'high',
                publishDate: addDays(now, -1),
                publishedAt: addDays(now, -1),
                isPublished: true,
                status: 'active',
                isPinned: true,
                pinOrder: 1,
                isActive: true,
                createdBy: principalId,
                updatedBy: principalId,
                isDeleted: false,
                createdAt,
                updatedAt: now,
                seedTag: SEED_TAG
            },
            {
                _id: objectId(),
                schoolId,
                schoolCode,
                title: 'Midterm Exam Routine Published',
                description: 'The seeded midterm exam schedule is now available in the exam routine page.',
                content: 'The seeded midterm exam schedule is now available in the exam routine page.',
                noticeType: 'exam',
                category: 'exam',
                targetType: 'role',
                targetRoles: ['student', 'parent', 'teacher'],
                priority: 'urgent',
                publishDate: now,
                publishedAt: now,
                isPublished: true,
                status: 'active',
                isActive: true,
                createdBy: principalId,
                updatedBy: principalId,
                isDeleted: false,
                createdAt,
                updatedAt: now,
                seedTag: SEED_TAG
            }
        );

        payload.schoolEvents.push(
            {
                _id: objectId(),
                schoolCode,
                title: 'Parent-Teacher Meeting',
                description: 'Quarterly review meeting for seeded test data.',
                type: 'meeting',
                startDate: addDays(now, 7),
                endDate: addDays(now, 7),
                allDay: true,
                location: 'Conference Hall',
                targetRoles: ['principal', 'teacher', 'parent'],
                createdBy: principalId,
                updatedBy: principalId,
                isActive: true,
                createdAt,
                updatedAt: now,
                seedTag: SEED_TAG
            },
            {
                _id: objectId(),
                schoolCode,
                title: 'Science Fair',
                description: 'Upcoming science fair for demo users.',
                type: 'event',
                startDate: addDays(now, 14),
                endDate: addDays(now, 14),
                allDay: true,
                location: 'Main Hall',
                targetRoles: ['teacher', 'student', 'parent'],
                createdBy: principalId,
                updatedBy: principalId,
                isActive: true,
                createdAt,
                updatedAt: now,
                seedTag: SEED_TAG
            }
        );

        const schoolRecipients = [
            principalId,
            accountantId,
            firstTeacher._id,
            parentDocs[0]._id,
            studentUserDocs[0]._id
        ];

        schoolRecipients.forEach((recipient, notificationIndex) => {
            const notificationTypes = ['notice', 'fee', 'result', 'event', 'system'];
            payload.notifications.push({
                _id: objectId(),
                recipient,
                title: `Seed Notification ${notificationIndex + 1}`,
                body: `This is a seeded ${notificationTypes[notificationIndex]} notification for ${schoolName}.`,
                type: notificationTypes[notificationIndex],
                link: '/dashboard',
                data: { schoolCode, schoolName, seed: true },
                schoolCode,
                read: notificationIndex % 2 === 0,
                readAt: notificationIndex % 2 === 0 ? addDays(now, -1) : null,
                createdAt,
                seedTag: SEED_TAG
            });
        });

        loginSummary.push({
            schoolCode,
            schoolName,
            principalEmail: `principal.${schoolCode.toLowerCase()}@seed.smartcampus.local`,
            accountantEmail: `accountant.${schoolCode.toLowerCase()}@seed.smartcampus.local`,
            teacherEmail: `${SUBJECT_DEFINITIONS[0].code.toLowerCase()}.teacher.${schoolCode.toLowerCase()}@seed.smartcampus.local`,
            parentEmail: parentDocs[0].email,
            studentEmail: studentUserDocs[0].email
        });
    }

    await insertMany(School, payload.schools);
    await insertMany(Subscription, payload.subscriptions);
    await insertMany(AcademicSession, payload.academicSessions);
    await insertMany(User, payload.users);
    await insertMany(Teacher, payload.teachers);
    await insertMany(Room, payload.rooms);
    await insertMany(Class, payload.classes);
    await insertMany(Section, payload.sections);
    await insertMany(Subject, payload.subjects);
    await insertMany(TeacherAssignment, payload.teacherAssignments);
    await insertMany(Exam, payload.exams);
    await insertMany(ExamSchedule, payload.examSchedules);
    await insertMany(Routine, payload.routines);
    await insertMany(ClassRoutine, payload.classRoutines);
    await insertMany(Student, payload.students);
    await insertMany(Attendance, payload.attendance);
    await insertMany(AdvancedAttendance, payload.advancedAttendance);
    await insertMany(FeeStructure, payload.feeStructures);
    await insertMany(Fee, payload.fees);
    await insertMany(PaymentHistory, payload.paymentHistory);
    await insertMany(Result, payload.results);
    await insertMany(Notice, payload.notices);
    await insertMany(Notification, payload.notifications);
    await insertMany(SchoolEvent, payload.schoolEvents);

    return {
        counts: {
            schools: payload.schools.length,
            users: payload.users.length,
            teachers: payload.teachers.length,
            classes: payload.classes.length,
            subjects: payload.subjects.length,
            students: payload.students.length,
            parents: payload.users.filter((user) => user.role === 'parent').length,
            routines: payload.classRoutines.length + payload.routines.length,
            attendance: payload.advancedAttendance.length,
            fees: payload.fees.length,
            results: payload.results.length,
            notices: payload.notices.length
        },
        loginSummary
    };
}

async function ensureSeedData({ resetExisting = false } = {}) {
    await ensureMongoIndexes();

    const existingSeedData = await hasExistingSeedData();
    if (existingSeedData && !resetExisting) {
        return {
            skipped: true,
            reason: `Seed data with tag ${SEED_TAG} already exists. Set AUTO_SEED_RESET_DATA=true or rerun the manual seed command to rebuild it.`
        };
    }

    if (existingSeedData && resetExisting) {
        console.log(`Cleaning previous ${SEED_TAG} data...`);
        await deleteExistingSeedData();
    }

    console.log(existingSeedData ? 'Recreating fresh seed data...' : 'Creating fresh seed data...');
    const result = await seedTestData();

    return {
        skipped: false,
        ...result
    };
}

function logSeedSummary(result) {
    if (result.skipped) {
        console.log('\nSeed skipped');
        console.log('------------');
        console.log(result.reason);
        return;
    }

    console.log('\nSeed complete');
    console.log('-------------');
    Object.entries(result.counts).forEach(([key, value]) => {
        console.log(`${key}: ${value}`);
    });

    console.log('\nShared login password');
    console.log('---------------------');
    console.log(DEFAULT_PASSWORD);

    console.log('\nSeeded school logins');
    console.log('--------------------');
    result.loginSummary.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.schoolName} (${entry.schoolCode})`);
        console.log(`   principal:  ${entry.principalEmail}`);
        console.log(`   accountant: ${entry.accountantEmail}`);
        console.log(`   teacher:    ${entry.teacherEmail}`);
        console.log(`   parent:     ${entry.parentEmail}`);
        console.log(`   student:    ${entry.studentEmail}`);
    });
}

async function main() {
    console.log(`Loading environment from ${envPath || 'default dotenv resolution'}`);
    console.log(`Connecting to MongoDB: ${process.env.MONGO_URI}`);

    await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 30000,
        connectTimeoutMS: 10000,
        maxPoolSize: 5,
        minPoolSize: 1,
        retryWrites: false
    });

    try {
        const result = await ensureSeedData({ resetExisting: true });
        logSeedSummary(result);
        console.log('\nNote: Super Admin login is still environment-based and is not created by this seed script.');
    } finally {
        await mongoose.disconnect();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('\nSeed failed');
        console.error(error);
        mongoose.disconnect().finally(() => {
            process.exit(1);
        });
    });
}

module.exports = {
    DEFAULT_PASSWORD,
    SEED_TAG,
    ensureSeedData,
    hasExistingSeedData,
    seedTestData,
    deleteExistingSeedData
};
