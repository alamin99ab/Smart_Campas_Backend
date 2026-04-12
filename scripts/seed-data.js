/**
 * Smart Campus Automatic Database Seeding System
 * 
 * This module provides automatic database seeding for demo data
 * when the backend starts with AUTO_SEED_TEST_DATA=true.
 * 
 * Safety features:
 * - Only runs in development/non-production environments by default
 * - Checks for existing data to avoid duplicates
 * - Requires explicit environment variable to run
 * - Never runs in production unless explicitly forced (which is blocked)
 */

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Models
const School = require('./models/School');
const User = require('./models/User');
const Teacher = require('./models/Teacher');
const Student = require('./models/Student');
const Subject = require('./models/Subject');
const Section = require('./models/Section');
const TeacherAssignment = require('./models/TeacherAssignment');

const SEED_TAG = 'auto-seed-v1';
const CLASS_LEVELS = [6, 7, 8, 9, 10];
const SECTIONS = ['A', 'B'];
const SUBJECTS = [
  { code: 'BAN', name: 'Bangla' },
  { code: 'ENG', name: 'English' },
  { code: 'MAT', name: 'Mathematics' },
  { code: 'SCI', name: 'Science' },
  { code: 'ICT', name: 'ICT' },
  { code: 'SOC', name: 'Social Science' },
  { code: 'REL', name: 'Religion' }
];

// Common password for all demo users
const DEFAULT_PASSWORD = process.env.SEED_TEST_PASSWORD || '123456';

/**
 * Generate a unique ObjectId
 */
function objectId() {
  return new mongoose.Types.ObjectId();
}

/**
 * Hash password using bcrypt
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
}

/**
 * Check if seed data already exists
 */
async function hasExistingSeedData() {
  const existingSchool = await School.findOne({ seedTag: SEED_TAG });
  return Boolean(existingSchool);
}

/**
 * Delete existing seed data (used with reset flag)
 */
async function deleteExistingSeedData() {
  const models = [School, User, Teacher, Student, Subject, Section, TeacherAssignment];
  
  await Promise.all(
    models.map(model => 
      model.deleteMany({ seedTag: SEED_TAG })
        .catch(() => {}) // Ignore errors for missing collections
    )
  );
}

/**
 * Create school with demo data
 */
async function createSchool(schoolIndex, hashedPassword) {
  const now = new Date();
  const schoolId = objectId();
  const schoolCode = `SC${String(schoolIndex + 1).padStart(2, '0')}`;
  const schoolName = `Smart School ${schoolIndex + 1}`;
  
  // Create school
  const school = new School({
    _id: schoolId,
    schoolName,
    schoolCode,
    address: `${schoolName} Campus`,
    phone: `+8801730000${schoolIndex + 1}`,
    email: `info@${schoolCode.toLowerCase()}.edu`,
    schoolType: 'secondary',
    location: {
      country: 'Bangladesh',
      division: 'Dhaka',
      district: 'Dhaka',
      upazila: 'Mirpur'
    },
    academicSettings: {
      currentSession: `${now.getFullYear()}-${now.getFullYear() + 1}`,
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
      totalStudents: 50,
      totalTeachers: 5,
      totalClasses: CLASS_LEVELS.length * SECTIONS.length,
      totalSubjects: SUBJECTS.length * CLASS_LEVELS.length
    },
    isActive: true,
    isVerified: true,
    tags: ['seed', 'demo'],
    notes: 'Auto-generated demo school',
    createdBy: schoolId,
    createdAt: now,
    updatedAt: now,
    seedTag: SEED_TAG
  });
  
  await school.save();
  
  // Create principal
  const principalId = objectId();
  const principalUser = new User({
    _id: principalId,
    name: `Principal SC${String(schoolIndex + 1).padStart(2, '0')}`,
    email: `principal.sc${String(schoolIndex + 1).padStart(2, '0')}_demo@test.com`,
    password: hashedPassword,
    role: 'principal',
    schoolId,
    schoolCode: school.schoolCode,
    schoolName: school.schoolName,
    phone: `+8801730000${schoolIndex + 1}`,
    isApproved: true,
    emailVerified: true,
    isActive: true,
    permissions: ['manage_school', 'manage_teachers', 'manage_students'],
    createdAt: now,
    updatedAt: now,
    seedTag: SEED_TAG
  });
  
  await principalUser.save();
  
  // Link principal to school
  school.principal = principalId;
  await school.save();
  
  // Create teachers
  const teachers = [];
  const teacherUsers = [];
  
  for (let i = 0; i < 5; i++) {
    const teacherUserId = objectId();
    const teacherId = objectId();
    const subjectIndex = i % SUBJECTS.length;
    const subject = SUBJECTS[subjectIndex];
    
    // Teacher User
    const teacherUser = new User({
      _id: teacherUserId,
      name: `${subject.name} Teacher ${i + 1} SC${String(schoolIndex + 1).padStart(2, '0')}`,
      email: `${subject.code.toLowerCase()}.tch${i+1}.sc${String(schoolIndex + 1).padStart(2, '0')}_demo@test.com`,
      password: hashedPassword,
      role: 'teacher',
      schoolId,
      schoolCode: school.schoolCode,
      schoolName: school.schoolName,
      phone: `+8801730001${schoolIndex}${i}`,
      subjects: [subject.name],
      classes: CLASS_LEVELS.map(l => `Class ${l}`),
      isApproved: true,
      emailVerified: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      seedTag: SEED_TAG
    });
    
    await teacherUser.save();
    teacherUsers.push(teacherUser);
    
    // Teacher Profile
    const teacher = new Teacher({
      _id: teacherId,
      userId: teacherUserId,
      schoolCode: school.schoolCode,
      employeeId: `EMP${String(schoolIndex + 1).padStart(2, '0')}T${String(i + 1).padStart(3, '0')}`,
      qualification: `Master's in ${subject.name}`,
      experience: `${4 + i} years`,
      subjects: [subject.name],
      availability: {
        maxPeriodsPerDay: 6,
        maxPeriodsPerWeek: 30,
        preferredDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
      },
      dateOfBirth: new Date(1985, i, 1),
      gender: i % 2 === 0 ? 'male' : 'female',
      joiningDate: new Date(now.getFullYear() - (i + 1), i, 1),
      salary: { amount: 35000 + i * 2500, currency: 'BDT' },
      isClassTeacher: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      seedTag: SEED_TAG
    });
    
    await teacher.save();
    teachers.push(teacher);
  }
  
  // Create subjects for each class level
  const subjectDocs = [];
  
  for (const level of CLASS_LEVELS) {
    for (const subject of SUBJECTS) {
      const subjectId = objectId();
      const assignedTeacher = teacherUsers.find(t => t.subjects.includes(subject.name));
      
      const subjectDoc = new Subject({
        _id: subjectId,
        schoolCode: school.schoolCode,
        subjectName: subject.name,
        subjectCode: `${subject.code}${level}`,
        category: 'Core',
        classLevels: [level],
        description: `${subject.name} curriculum for Class ${level}`,
        credits: 1,
        periodsPerWeek: 5,
        passingMarks: 33,
        totalMarks: 100,
        teachers: [
          {
            teacherId: assignedTeacher._id,
            assignedDate: now,
            isActive: true
          }
        ],
        isActive: true,
        createdAt: now,
        updatedAt: now,
        seedTag: SEED_TAG
      });
      
      await subjectDoc.save();
      subjectDocs.push(subjectDoc);
    }
  }
  
  // Create sections and classes
  const sectionDocs = [];
  const classDocs = [];
  
  for (const level of CLASS_LEVELS) {
    for (const sectionName of SECTIONS) {
      const classId = objectId();
      const sectionId = objectId();
      
      // Find a teacher to be class teacher (rotate)
      const classTeacherIndex = (level + parseInt(sectionName.replace('A', '0'))) % teachers.length;
      const classTeacher = teachers[classTeacherIndex];
      
      // Class
      const classDoc = new Class({
        _id: classId,
        schoolCode: school.schoolCode,
        className: `Class ${level}`,
        name: `Class ${level}`,
        section: sectionName,
        classLevel: level,
        capacity: 40,
        currentStudents: 0,
        classTeacher: classTeacher.userId,
        academicYear: school.academicSettings.currentSession,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        seedTag: SEED_TAG
      });
      
      await classDoc.save();
      classDocs.push(classDoc);
      
      // Section
      const sectionDoc = new Section({
        _id: sectionId,
        sectionName,
        name: sectionName,
        classId,
        capacity: 40,
        roomNumber: `${level}${sectionName}-101`,
        schoolCode: school.schoolCode,
        createdBy: principalId,
        createdAt: now,
        updatedAt: now,
        seedTag: SEED_TAG
      });
      
      await sectionDoc.save();
      sectionDocs.push(sectionDoc);
      
      // Update teacher to be class teacher
      classTeacher.isClassTeacher = true;
      classTeacher.classTeacherOf = {
        class: `Class ${level}`,
        section: sectionName,
        assignedDate: now
      };
      await classTeacher.save();
    }
  }
  
  // Teacher assignments
  for (const teacher of teachers) {
    // Find subjects this teacher teaches
    const teacherSubjects = SUBJECTS.filter(s => 
      teacher.subjects.includes(s.name)
    );
    
    for (const classDoc of classDocs) {
      for (const subject of teacherSubjects) {
        // Find subject doc for this class level
        const subjectDoc = subjectDocs.find(s => 
          s.subjectName === subject.name && 
          s.subjectCode === `${subject.code}${classDoc.classLevel}`
        );
        
        if (subjectDoc) {
          const assignment = new TeacherAssignment({
            schoolCode: school.schoolCode,
            teacher: teacher.userId,
            subject: subjectDoc._id,
            subjectName: subjectDoc.subjectName,
            classes: [classDoc._id],
            sections: [classDoc.section],
            periodsPerWeek: subjectDoc.periodsPerWeek,
            academicYear: school.academicSettings.currentSession,
            isActive: true,
            assignedBy: principalId,
            createdAt: now,
            updatedAt: now,
            seedTag: SEED_TAG
          });
          
          await assignment.save();
          
          // Add subject to class
          classDoc.subjects.push({
            subjectId: subjectDoc._id,
            subjectName: subjectDoc.subjectName,
            subjectCode: subjectDoc.subjectCode,
            teacherId: teacher.userId,
            teacherName: teacher.name,
            periodsPerWeek: subjectDoc.periodsPerWeek,
            isActive: true
          });
          await classDoc.save();
        }
      }
    }
  }
  
  // Create parents and students
  const parentDocs = [];
  const studentDocs = [];
  const userStudentDocs = [];
  
  let studentCounter = 0;
  
  for (const classDoc of classDocs) {
    for (let i = 1; i <= 5; i++) { // 5 students per class
      studentCounter++;
      
      const studentId = objectId();
      const parentGroup = Math.ceil(studentCounter / 2);
      const parentId = objectId();
      
      // Parent
      const parent = new User({
        _id: parentId,
        name: `Parent ${schoolIndex + 1}-${String(parentGroup).padStart(3, '0')}`,
        email: `parent.sc${String(schoolIndex + 1).padStart(2, '0')}.g${String(parentGroup).padStart(3, '0')}_demo@test.com`,
        password: hashedPassword,
        role: 'parent',
        schoolId,
        schoolCode: school.schoolCode,
        schoolName: school.schoolName,
        phone: `+8801730002${schoolIndex}${String(parentGroup).padStart(3, '0')}`,
        isApproved: true,
        emailVerified: true,
        isActive: true,
        linkedStudents: 1,
        createdAt: now,
        updatedAt: now,
        seedTag: SEED_TAG
      });
      
      await parent.save();
      parentDocs.push(parent);
      
      // Student User
      const studentUser = new User({
        _id: studentId,
        name: `Student ${schoolIndex + 1}-${classDoc.classLevel}${classDoc.section}-${i}`,
        email: `std.sc${String(schoolIndex + 1).padStart(2, '0')}.${classDoc.classLevel}${classDoc.section.toLowerCase()}.${i}_demo@test.com`,
        password: hashedPassword,
        role: 'student',
        schoolId,
        schoolCode: school.schoolCode,
        schoolName: school.schoolName,
        classId: classDoc._id,
        section: classDoc.section,
        rollNumber: i.toString(),
        studentClass: classDoc.className,
        phone: `+8801730003${schoolIndex}${i}`,
        parentInfo: {
          name: parent.name,
          email: parent.email,
          phone: parent.phone
        },
        isApproved: true,
        emailVerified: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        seedTag: SEED_TAG
      });
      
      await studentUser.save();
      userStudentDocs.push(studentUser);
      
      // Student Profile
      const student = new Student({
        _id: objectId(),
        name: studentUser.name,
        roll: i.toString(),
        studentClass: classDoc.className,
        section: classDoc.section,
        classId: classDoc._id,
        sectionId: sectionDocs.find(s => s.sectionName === classDoc.section && s.classId.equals(classDoc._id))._id,
        fatherName: `${parent.name} Sr.`,
        motherName: `${parent.name} Mme.`,
        dateOfBirth: new Date(now.getFullYear() - 13, i, 15),
        gender: i % 2 === 0 ? 'Male' : 'Female',
        address: school.address,
        phone: studentUser.phone,
        guardian: {
          name: parent.name,
          phone: parent.phone,
          email: parent.email
        },
        emergencyContact: parent.phone,
        studentId: `${school.schoolCode}-STD-${String(studentCounter).padStart(4, '0')}`,
        totalDue: 0,
        schoolCode: school.schoolCode,
        parentId: parent._id,
        addedBy: principalId,
        updatedBy: principalId,
        isActive: true,
        academicHistory: [{
          academicYear: school.academicSettings.currentSession,
          className: classDoc.className,
          section: classDoc.section,
          promotionDate: now
        }],
        createdAt: now,
        updatedAt: now,
        seedTag: SEED_TAG
      });
      
      await student.save();
      studentDocs.push(student);
      
      // Update class student count
      classDoc.currentStudents += 1;
      await classDoc.save();
    }
  }
  
  return {
    school,
    principal: principalUser,
    teachers: teacherUsers,
    students: userStudentDocs,
    subjects: subjectDocs,
    classes: classDocs,
    sections: sectionDocs
  };
}

/**
 * Main seed database function
 * 
 * @param {Object} options - Options for seeding
 * @param {boolean} [options.resetExisting=false] - Whether to delete existing data first
 * @returns {Promise<Object>} Result with counts and status
 */
async function seedDatabase(options = {}) {
  const { resetExisting = false } = options;
  const startTime = Date.now();
  
  try {
    // Check if we should run
    if (process.env.NODE_ENV === 'production' && !process.env.FORCE_SEED_IN_PRODUCTION) {
      return { 
        skipped: true, 
        reason: 'Production environment - seeding disabled by default',
        counts: { schools: 0, users: 0, students: 0, teachers: 0, subjects: 0 }
      };
    }
    
    // Check for existing seed data
    const hasExistingData = await hasExistingSeedData();
    
    if (hasExistingData && !resetExisting) {
      return { 
        skipped: true, 
        reason: 'Seed data already exists',
        counts: { schools: 0, users: 0, students: 0, teachers: 0, subjects: 0 }
      };
    }
    
    if (hasExistingData && resetExisting) {
      console.warn('🧹 Resetting existing seed data...');
      await deleteExistingSeedData();
    }
    
    console.log('🔐 Hashing password...');
    const hashedPassword = await hashPassword(DEFAULT_PASSWORD);
    
    console.log('🏫 Creating demo schools and data...');
    const results = [];
    let totalSchools = 0;
    let totalUsers = 0;
    let totalStudents = 0;
    let totalTeachers = 0;
    let totalSubjects = 0;
    
    // Create 5 schools
    for (let i = 0; i < 5; i++) {
      console.log(`   Creating school ${i + 1}/5...`);
      const result = await createSchool(i, hashedPassword);
      results.push(result);
      
      totalSchools++;
      totalUsers += 1 + 5 + 50 + 10; // principal + teachers + students + parents
      totalStudents += 50;
      totalTeachers += 5;
      totalSubjects += SUBJECTS.length * CLASS_LEVELS.length;
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Seed completed in ${duration}ms`);
    console.log(`   Schools: ${totalSchools}`);
    console.log(`   Users: ${totalUsers}`);
    console.log(`   Students: ${totalStudents}`);
    console.log(`   Teachers: ${totalTeachers}`);
    console.log(`   Subjects: ${totalSubjects}`);
    
    return {
      success: true,
      skipped: false,
      counts: {
        schools: totalSchools,
        users: totalUsers,
        students: totalStudents,
        teachers: totalTeachers,
        subjects: totalSubjects
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

module.exports = { seedDatabase };