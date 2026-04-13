const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const BootstrapMarker = require('../models/BootstrapMarker');
const ClassModel = require('../models/Class');
const Exam = require('../models/Exam');
const Fee = require('../models/Fee');
const Notice = require('../models/Notice');
const Result = require('../models/Result');
const School = require('../models/School');
const Section = require('../models/Section');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Teacher = require('../models/Teacher');
const TeacherAssignment = require('../models/TeacherAssignment');
const User = require('../models/User');

const CLASS_LEVELS = [6, 7, 8, 9, 10];
const SUBJECTS = [
    { code: 'BAN', name: 'Bangla' },
    { code: 'ENG', name: 'English' },
    { code: 'MAT', name: 'Mathematics' },
    { code: 'SCI', name: 'Science' },
    { code: 'ICT', name: 'ICT' }
];
const SCHOOL_COUNT = 5;
const STUDENTS_PER_CLASS = 10;
/** @returns {number} teacher count between 5 and 10 (inclusive), varies by school */
function teachersCountForSchool(schoolIndex) {
    return 5 + (schoolIndex % 6);
}
const BOOTSTRAP_VERSION = '2.0.0';
const DEFAULT_PASSWORD = process.env.BOOTSTRAP_PASSWORD || '123456';
const BOOTSTRAP_MARKER_ID = 'bootstrap-marker';

function objectId() {
    return new mongoose.Types.ObjectId();
}

function timestampSeed() {
    return Date.now().toString();
}

function toRoll(value) {
    return Number.parseInt(String(value), 10);
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
    if (!subjects.length) return 0;
    const average = subjects.reduce((sum, subject) => sum + subject.marks, 0) / subjects.length;

    if (average >= 80) return 5;
    if (average >= 70) return 4;
    if (average >= 60) return 3.5;
    if (average >= 50) return 3;
    if (average >= 40) return 2;
    if (average >= 33) return 1;
    return 0;
}

async function hashPassword(password) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
}

async function isDatabaseEmpty() {
    const schoolCount = await School.countDocuments();
    const userCount = await User.countDocuments();
    return schoolCount === 0 && userCount === 0;
}

async function getBootstrapMarker() {
    return BootstrapMarker.findById(BOOTSTRAP_MARKER_ID);
}

async function ensureBootstrapCanRun() {
    if (mongoose.connection.readyState !== 1) {
        throw new Error(`MongoDB is not ready (readyState=${mongoose.connection.readyState})`);
    }

    const marker = await getBootstrapMarker();
    if (marker?.completed) {
        return { shouldRun: false, reason: 'Bootstrap marker already completed' };
    }

    const empty = await isDatabaseEmpty();
    if (!empty) {
        return { shouldRun: false, reason: 'Database already has data' };
    }

    return { shouldRun: true };
}

function buildBaseIds() {
    return {
        principalUserId: objectId(),
        publicNoticeCreatorId: objectId()
    };
}

async function createSchoolBundle({ schoolIndex, hash, now, runId, superAdminUser, sessionLabel }) {
    const serial = String(schoolIndex + 1).padStart(2, '0');
    const suffix = `${runId}-${serial}`;
    const schoolId = objectId();
    const principalUserId = objectId();
    const teachersThisSchool = teachersCountForSchool(schoolIndex);
    const schoolCode = `SC${serial}${runId.slice(-4)}`.toUpperCase();
    const schoolName = `Smart School ${schoolIndex + 1}`;

    const school = await School.create({
        _id: schoolId,
        schoolName,
        schoolCode,
        address: `${schoolName} Campus, Dhaka`,
        phone: `+8801700${serial}${runId.slice(-4)}`,
        email: `school.${suffix}@demo.smartcampus.test`,
        schoolType: 'secondary',
        location: {
            country: 'Bangladesh',
            division: 'Dhaka',
            district: 'Dhaka',
            upazila: 'Mirpur'
        },
        academicSettings: {
            currentSession: sessionLabel,
            sessionStartMonth: 1,
            gradingSystem: 'gpa_5',
            workingDays: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
            classDuration: 45
        },
        subscription: {
            plan: 'trial',
            status: 'active',
            startDate: now,
            endDate: new Date(now.getFullYear(), now.getMonth() + 1, 1)
        },
        features: {
            routine: true,
            attendance: true,
            exam: true,
            fee: true,
            notice: true
        },
        settings: {
            timezone: 'Asia/Dhaka',
            currency: 'BDT',
            language: 'en'
        },
        stats: {
            totalStudents: CLASS_LEVELS.length * STUDENTS_PER_CLASS,
            totalTeachers: teachersThisSchool,
            totalClasses: CLASS_LEVELS.length,
            totalSubjects: CLASS_LEVELS.length * SUBJECTS.length
        },
        isActive: true,
        isVerified: true,
        tags: ['bootstrap', 'demo'],
        notes: `Bootstrap demo school ${suffix}`,
        createdBy: superAdminUser._id
    });

    const principalUser = await User.create({
        _id: principalUserId,
        name: `Principal ${serial}`,
        email: `principal.${suffix}@demo.smartcampus.test`,
        password: hash,
        role: 'principal',
        schoolId: school._id,
        schoolCode: school.schoolCode,
        schoolName: school.schoolName,
        phone: `+8801800${serial}${runId.slice(-4)}`,
        isApproved: true,
        emailVerified: true,
        isActive: true,
        permissions: ['manage_school', 'manage_teachers', 'manage_students']
    });

    school.principal = principalUser._id;
    await school.save();

    const teacherUsers = [];
    const teacherProfiles = [];
    for (let i = 0; i < teachersThisSchool; i++) {
        const teacherUserId = objectId();
        const subject = SUBJECTS[i % SUBJECTS.length];
        const teacherUser = await User.create({
            _id: teacherUserId,
            name: `${subject.name} Teacher ${serial}-${i + 1}`,
            email: `teacher.${subject.code.toLowerCase()}.${suffix}.${i + 1}@demo.smartcampus.test`,
            password: hash,
            role: 'teacher',
            schoolId: school._id,
            schoolCode: school.schoolCode,
            schoolName: school.schoolName,
            phone: `+880181${serial}${String(i + 1).padStart(2, '0')}${runId.slice(-2)}`,
            subjects: [subject.name],
            classes: CLASS_LEVELS.map((level) => `Class ${level}`),
            isApproved: true,
            emailVerified: true,
            isActive: true
        });

        const teacherProfile = await Teacher.create({
            _id: objectId(),
            userId: teacherUser._id,
            schoolCode: school.schoolCode,
            employeeId: `EMP-${schoolCode}-${String(i + 1).padStart(3, '0')}`,
            qualification: `Master's in ${subject.name}`,
            experience: `${3 + i} years`,
            subjects: [subject.name],
            availability: {
                maxPeriodsPerDay: 6,
                maxPeriodsPerWeek: 30,
                preferredDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
            },
            dateOfBirth: new Date(1988, i, 10),
            gender: i % 2 === 0 ? 'male' : 'female',
            joiningDate: new Date(now.getFullYear() - (i + 1), i, 5),
            salary: {
                amount: 30000 + i * 2500,
                currency: 'BDT'
            },
            isClassTeacher: false,
            isActive: true
        });

        teacherUsers.push(teacherUser);
        teacherProfiles.push(teacherProfile);
    }

    const classDocs = [];
    const sectionDocs = [];
    const subjectDocs = [];
    const classSubjectMap = new Map();

    for (let classIndex = 0; classIndex < CLASS_LEVELS.length; classIndex++) {
        const level = CLASS_LEVELS[classIndex];
        const assignedTeacherProfile = teacherProfiles[classIndex % teacherProfiles.length];
        const assignedTeacherUser = teacherUsers[classIndex % teacherUsers.length];

        assignedTeacherProfile.isClassTeacher = true;
        assignedTeacherProfile.classTeacherOf = {
            class: `Class ${level}`,
            section: 'A',
            assignedDate: now
        };
        await assignedTeacherProfile.save();

        const classDoc = await ClassModel.create({
            _id: objectId(),
            schoolCode: school.schoolCode,
            className: `Class ${level}`,
            section: 'A',
            classLevel: level,
            capacity: 60,
            currentStudents: 0,
            classTeacher: assignedTeacherUser._id,
            roomNumber: `${level}01`,
            floor: `${Math.max(1, classIndex + 1)}`,
            academicYear: sessionLabel,
            isActive: true,
            subjects: []
        });

        const sectionDoc = await Section.create({
            _id: objectId(),
            sectionName: 'A',
            name: 'A',
            classId: classDoc._id,
            capacity: 60,
            roomNumber: `${level}01`,
            schoolCode: school.schoolCode,
            createdBy: principalUser._id
        });

        classDocs.push(classDoc);
        sectionDocs.push(sectionDoc);

        const subjectsForClass = [];
        for (let subjectIndex = 0; subjectIndex < SUBJECTS.length; subjectIndex++) {
            const subjectSeed = SUBJECTS[subjectIndex];
            const teacherUser = teacherUsers[subjectIndex % teacherUsers.length];

            const subjectDoc = await Subject.create({
                _id: objectId(),
                schoolCode: school.schoolCode,
                subjectName: subjectSeed.name,
                subjectCode: `${subjectSeed.code}-${level}-${serial}-${runId.slice(-3)}`.toUpperCase(),
                category: 'Core',
                classLevels: [level],
                description: `${subjectSeed.name} for Class ${level}`,
                credits: 1,
                periodsPerWeek: 5,
                passingMarks: 33,
                totalMarks: 100,
                teachers: [
                    {
                        teacherId: teacherUser._id,
                        assignedDate: now,
                        isActive: true
                    }
                ],
                isActive: true
            });

            await TeacherAssignment.create({
                _id: objectId(),
                schoolCode: school.schoolCode,
                teacherId: teacherUser._id,
                subjectId: subjectDoc._id,
                subjectName: subjectDoc.subjectName,
                classId: classDoc._id,
                className: classDoc.className,
                section: classDoc.section,
                assignedBy: principalUser._id,
                isActive: true,
                assignedAt: now
            });

            subjectsForClass.push({
                subjectId: subjectDoc._id,
                subjectName: subjectDoc.subjectName,
                subjectCode: subjectDoc.subjectCode,
                teacherId: teacherUser._id,
                teacherName: teacherUser.name,
                periodsPerWeek: 5,
                isActive: true
            });

            subjectDocs.push(subjectDoc);
        }

        classDoc.subjects = subjectsForClass;
        await classDoc.save();
        classSubjectMap.set(String(classDoc._id), subjectsForClass);
    }

    const studentDocs = [];
    const studentUsers = [];
    const parentUsers = [];

    for (let classIndex = 0; classIndex < classDocs.length; classIndex++) {
        const classDoc = classDocs[classIndex];
        const sectionDoc = sectionDocs[classIndex];
        const level = CLASS_LEVELS[classIndex];

        for (let studentIndex = 0; studentIndex < STUDENTS_PER_CLASS; studentIndex++) {
            const roll = studentIndex + 1;
            const studentNumber = `${serial}${String(level)}${String(roll).padStart(2, '0')}`;

            const parentUser = await User.create({
                _id: objectId(),
                name: `Parent ${schoolIndex + 1}-${level}-${roll}`,
                email: `parent.${suffix}.${level}.${roll}@demo.smartcampus.test`,
                password: hash,
                role: 'parent',
                schoolId: school._id,
                schoolCode: school.schoolCode,
                schoolName: school.schoolName,
                phone: `+880182${serial}${String(roll).padStart(2, '0')}${runId.slice(-2)}`,
                isApproved: true,
                emailVerified: true,
                isActive: true,
                linkedStudents: 1
            });

            const studentUser = await User.create({
                _id: objectId(),
                name: `Student ${schoolIndex + 1}-${level}-${roll}`,
                email: `student.${suffix}.${level}.${roll}@demo.smartcampus.test`,
                password: hash,
                role: 'student',
                schoolId: school._id,
                schoolCode: school.schoolCode,
                schoolName: school.schoolName,
                classId: classDoc._id,
                section: classDoc.section,
                rollNumber: String(roll),
                studentClass: classDoc.className,
                phone: `+880183${serial}${String(roll).padStart(2, '0')}${runId.slice(-2)}`,
                parentInfo: {
                    name: parentUser.name,
                    email: parentUser.email,
                    phone: parentUser.phone
                },
                isApproved: true,
                emailVerified: true,
                isActive: true
            });

            const student = await Student.create({
                _id: objectId(),
                name: studentUser.name,
                roll: String(roll),
                studentClass: classDoc.className,
                section: classDoc.section,
                classId: classDoc._id,
                sectionId: sectionDoc._id,
                fatherName: `${parentUser.name} Sr.`,
                motherName: `${parentUser.name} Mme.`,
                dateOfBirth: new Date(now.getFullYear() - 13, classIndex, Math.min(roll, 28)),
                gender: roll % 2 === 0 ? 'Male' : 'Female',
                address: school.address,
                phone: studentUser.phone,
                guardian: {
                    name: parentUser.name,
                    phone: parentUser.phone,
                    email: parentUser.email
                },
                emergencyContact: parentUser.phone,
                studentId: `${school.schoolCode}-STD-${studentNumber}`,
                totalDue: 0,
                schoolCode: school.schoolCode,
                parentId: parentUser._id,
                addedBy: principalUser._id,
                updatedBy: principalUser._id,
                isActive: true,
                academicHistory: [
                    {
                        academicYear: sessionLabel,
                        className: classDoc.className,
                        section: classDoc.section,
                        promotionDate: now
                    }
                ]
            });

            studentDocs.push(student);
            studentUsers.push(studentUser);
            parentUsers.push(parentUser);
            classDoc.currentStudents += 1;
        }

        await classDoc.save();
    }

    const examDocs = [];
    const resultDocs = [];
    for (let classIndex = 0; classIndex < classDocs.length; classIndex++) {
        const classDoc = classDocs[classIndex];
        const subjectsForClass = classSubjectMap.get(String(classDoc._id)) || [];
        const classStudents = studentDocs.filter((student) => String(student.classId) === String(classDoc._id));

        if (!subjectsForClass.length) {
            continue;
        }

        const leadSubject = subjectsForClass[0];
        const examDate = new Date(now.getFullYear(), Math.min(now.getMonth() + 1, 11), classIndex + 1);

        const exam = await Exam.create({
            _id: objectId(),
            schoolCode: school.schoolCode,
            name: `Midterm Class ${CLASS_LEVELS[classIndex]}`,
            description: `Bootstrap demo exam for Class ${CLASS_LEVELS[classIndex]}`,
            examType: 'Midterm',
            classId: classDoc._id,
            subjectId: leadSubject.subjectId,
            date: examDate,
            duration: 90,
            totalMarks: 100,
            isActive: true,
            resultsPublished: true,
            publishedDate: now,
            createdBy: principalUser._id
        });

        examDocs.push(exam);

        for (let studentIndex = 0; studentIndex < classStudents.length; studentIndex++) {
            const student = classStudents[studentIndex];
            const subjectMarks = subjectsForClass.map((subject, subjectIndex) => {
                const marks = 55 + ((studentIndex + subjectIndex + classIndex) % 40);
                return {
                    subjectId: subject.subjectId,
                    subjectName: subject.subjectName,
                    marks,
                    grade: calculateGrade(marks)
                };
            });

            const totalMarks = subjectMarks.reduce((sum, subject) => sum + subject.marks, 0);
            const gpa = calculateGpa(subjectMarks);

            const result = await Result.create({
                _id: objectId(),
                examId: exam._id,
                studentId: student._id,
                schoolCode: school.schoolCode,
                studentClass: student.studentClass,
                section: student.section,
                roll: toRoll(student.roll),
                examName: exam.name,
                academicYear: sessionLabel,
                examDate: exam.date,
                subjects: subjectMarks,
                totalMarks,
                gpa,
                gradingSystem: 'standard',
                remarks: gpa >= 4 ? 'Excellent performance' : 'Keep improving',
                publishedAt: now,
                isPublished: true,
                isActive: true,
                publishedBy: principalUser._id,
                updatedBy: principalUser._id
            });

            resultDocs.push(result);
        }
    }

    const feeDocs = [];
    const feeMonth = now.getMonth() + 1;
    const feeYear = now.getFullYear();
    for (let studentIndex = 0; studentIndex < studentDocs.length; studentIndex++) {
        const student = studentDocs[studentIndex];
        const amountPaid = studentIndex % 3 === 0 ? 1500 : studentIndex % 3 === 1 ? 750 : 0;
        const amountDue = 1500;
        const status = amountPaid === amountDue ? 'Paid' : amountPaid > 0 ? 'Partial' : 'Unpaid';

        const fee = await Fee.create({
            _id: objectId(),
            studentId: student._id,
            month: feeMonth,
            year: feeYear,
            amountDue,
            amountPaid,
            status,
            schoolCode: school.schoolCode,
            createdBy: principalUser._id,
            updatedBy: principalUser._id
        });

        feeDocs.push(fee);

        student.totalDue = Math.max(0, amountDue - amountPaid);
        await student.save();
    }

    const schoolNotice = await Notice.create({
        _id: objectId(),
        schoolId: school._id,
        schoolCode: school.schoolCode,
        isGlobal: false,
        title: `Welcome Notice - ${school.schoolName}`,
        description: `Bootstrap notice for ${school.schoolName}. Demo data is ready for principals, teachers, students and parents.`,
        noticeType: 'general',
        targetType: 'all',
        targetRoles: ['principal', 'teacher', 'student', 'parent'],
        priority: 'high',
        isPinned: true,
        publishDate: now,
        publishedAt: now,
        isPublished: true,
        isPublic: false,
        status: 'active',
        requireAcknowledgment: false,
        allowComments: true,
        createdBy: principalUser._id,
        updatedBy: principalUser._id,
        publishedBy: principalUser._id
    });

    const publicNotice = await Notice.create({
        _id: objectId(),
        schoolId: school._id,
        schoolCode: school.schoolCode,
        isGlobal: false,
        title: `Public Admission Update - ${school.schoolName}`,
        description: `Public notice for ${school.schoolName} admissions and onboarding.`,
        noticeType: 'event',
        targetType: 'all',
        priority: 'medium',
        publishDate: now,
        publishedAt: now,
        isPublished: true,
        isPublic: true,
        status: 'active',
        requireAcknowledgment: false,
        allowComments: false,
        createdBy: principalUser._id,
        updatedBy: principalUser._id,
        publishedBy: principalUser._id
    });

    return {
        school,
        principalUser,
        teacherUsers,
        teacherProfiles,
        classDocs,
        sectionDocs,
        subjectDocs,
        studentDocs,
        studentUsers,
        parentUsers,
        examDocs,
        resultDocs,
        feeDocs,
        notices: [schoolNotice, publicNotice]
    };
}

async function seedDatabase() {
    console.log('BOOTSTRAP: seed started');

    const readiness = await ensureBootstrapCanRun();
    if (!readiness.shouldRun) {
        console.log(`BOOTSTRAP: seed skipped (${readiness.reason})`);
        return {
            success: true,
            skipped: true,
            reason: readiness.reason,
            counts: {}
        };
    }

    const now = new Date();
    const runId = timestampSeed();
    const sessionLabel = `${now.getFullYear()}-${now.getFullYear() + 1}`;
    const hash = await hashPassword(DEFAULT_PASSWORD);

    let marker = await getBootstrapMarker();
    if (!marker) {
        marker = await BootstrapMarker.create({
            _id: BOOTSTRAP_MARKER_ID,
            completed: false,
            version: BOOTSTRAP_VERSION,
            notes: 'Bootstrap in progress'
        });
    } else {
        marker.completed = false;
        marker.version = BOOTSTRAP_VERSION;
        marker.notes = 'Bootstrap in progress';
        await marker.save();
    }

    try {
        const superAdminUser = await User.create({
            _id: objectId(),
            name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
            email: process.env.SUPER_ADMIN_EMAIL || `superadmin.${runId}@demo.smartcampus.test`,
            password: hash,
            role: 'super_admin',
            schoolId: null,
            schoolCode: null,
            isApproved: true,
            emailVerified: true,
            isActive: true
        });

        const bundles = [];
        for (let schoolIndex = 0; schoolIndex < SCHOOL_COUNT; schoolIndex++) {
            console.log(`BOOTSTRAP: creating school bundle ${schoolIndex + 1}/${SCHOOL_COUNT}`);
            const bundle = await createSchoolBundle({
                schoolIndex,
                hash,
                now,
                runId,
                superAdminUser,
                sessionLabel
            });
            bundles.push(bundle);
        }

        marker.completed = true;
        marker.completedAt = new Date();
        marker.version = BOOTSTRAP_VERSION;
        marker.notes = `Bootstrap completed successfully (${runId})`;
        await marker.save();

        const counts = {
            schools: bundles.length,
            principals: bundles.length,
            teachers: bundles.reduce((sum, bundle) => sum + bundle.teacherUsers.length, 0),
            students: bundles.reduce((sum, bundle) => sum + bundle.studentDocs.length, 0),
            classes: bundles.reduce((sum, bundle) => sum + bundle.classDocs.length, 0),
            sections: bundles.reduce((sum, bundle) => sum + bundle.sectionDocs.length, 0),
            subjects: bundles.reduce((sum, bundle) => sum + bundle.subjectDocs.length, 0),
            teacherAssignments: bundles.reduce((sum, bundle) => sum + bundle.subjectDocs.length, 0),
            exams: bundles.reduce((sum, bundle) => sum + bundle.examDocs.length, 0),
            results: bundles.reduce((sum, bundle) => sum + bundle.resultDocs.length, 0),
            fees: bundles.reduce((sum, bundle) => sum + bundle.feeDocs.length, 0),
            notices: bundles.reduce((sum, bundle) => sum + bundle.notices.length, 0),
            users: await User.countDocuments()
        };

        console.log('BOOTSTRAP: seed completed', counts);

        return {
            success: true,
            skipped: false,
            counts,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        marker.completed = false;
        marker.notes = `Bootstrap failed: ${error.message}`;
        await marker.save();

        console.error('BOOTSTRAP: seed failed', error);
        throw error;
    }
}

module.exports = {
    seedDatabase,
    bootstrapDatabase: seedDatabase
};
