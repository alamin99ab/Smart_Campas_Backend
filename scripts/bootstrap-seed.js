/**
 * Smart Campus Bootstrap Seeder
 * 
 * This module provides automatic bootstrap seeding for empty databases.
 * It ONLY seeds when the database is completely empty (no schools, no users).
 * It creates a bootstrap marker to ensure idempotency.
 * 
 * Safety features:
 * - Never deletes or resets existing data
 * - Only seeds once (tracked by BootstrapMarker)
 * - Uses unique constraints to prevent duplicates
 * - Production-safe by design
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
const BootstrapMarker = require('./models/BootstrapMarker');

const CLASS_LEVELS = [6, 7, 8, 9, 10];
const SECTIONS = ['A'];
const SUBJECTS = [
  { code: 'BAN', name: 'Bangla' },
  { code: 'ENG', name: 'English' },
  { code: 'MAT', name: 'Mathematics' },
  { code: 'SCI', name: 'Science' },
  { code: 'ICT', name: 'ICT' }
];

const DEFAULT_PASSWORD = process.env.BOOTSTRAP_PASSWORD || '123456';
const BOOTSTRAP_VERSION = '1.0.0';

// Utility functions
function objectId() {
  return new mongoose.Types.ObjectId();
}

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
}

// Check if database is empty (no schools, no users)
async function isDatabaseEmpty() {
  try {
    // Check if any schools exist
    const schoolCount = await School.countDocuments();
    if (schoolCount > 0) return false;
    
    // Check if any users exist
    const userCount = await User.countDocuments();
    if (userCount > 0) return false;
    
    // If both are zero, database is empty
    return true;
  } catch (error) {
    console.error('Error checking database emptiness:', error.message);
    // In case of error, assume it's not empty to be safe
    return false;
  }
}

// Check if bootstrap has already been completed
async function hasBootstrapCompleted() {
  try {
    const marker = await BootstrapMarker.getSingleton();
    return marker?.completed === true;
  } catch (error) {
    console.error('Error checking bootstrap marker:', error.message);
    return false;
  }
}

// Create Super Admin
async function createSuperAdmin(hashedPassword, now) {
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@smartcampus.com';
  
  const superAdmin = new User({
    _id: objectId(),
    name: 'Super Admin',
    email: superAdminEmail,
    password: hashedPassword,
    role: 'super_admin',
    schoolId: null, // Super admin has no school
    schoolCode: null,
    isApproved: true,
    emailVerified: true,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    seedTag: 'bootstrap-v1'
  });
  
  await superAdmin.save();
  console.log('👷 Created Super Admin:', superAdminEmail);
  return superAdmin;
}

// Create a school with complete demo data
async function createSchool(schoolIndex, hashedPassword, superAdminId, now) {
  const schoolCode = `SC${String(schoolIndex + 1).padStart(2, '0')}`;
  const schoolName = `Smart School ${schoolIndex + 1}`;
  
  // Create school
  const school = new School({
    _id: objectId(),
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
    tags: ['bootstrap', 'demo'],
    notes: 'Bootstrap-generated school',
    createdBy: superAdminId,
    createdAt: now,
    updatedAt: now,
    seedTag: 'bootstrap-v1'
  });
  
  await school.save();
  console.log('🏢 Created school:', schoolName);
  
  // Create principal
  const principalId = objectId();
  const principalUser = new User({
    _id: principalId,
    name: `Principal SC${String(schoolIndex + 1).padStart(2, '0')}`,
    email: `principal.sc${String(schoolIndex + 1).padStart(2, '0')}_demo@test.com`,
    password: hashedPassword,
    role: 'principal',
    schoolId: school._id,
    schoolCode: school.schoolCode,
    schoolName: school.schoolName,
    phone: `+8801730000${schoolIndex + 1}`,
    isApproved: true,
    emailVerified: true,
    isActive: true,
    permissions: ['manage_school', 'manage_teachers', 'manage_students'],
    createdAt: now,
    updatedAt: now,
    seedTag: 'bootstrap-v1'
  });
  
  await principalUser.save();
  console.log('👮 Created principal:', principalUser.email);
  
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
      schoolId: school._id,
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
      seedTag: 'bootstrap-v1'
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
      seedTag: 'bootstrap-v1'
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
        seedTag: 'bootstrap-v1'
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
      
      // Find a teacher to be class teacher
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
        seedTag: 'bootstrap-v1'
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
        seedTag: 'bootstrap-v1'
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
  
  // Create students and parents
  const parentDocs = [];
  const studentDocs = [];
  
  let studentCounter = 0;
  
  for (const classDoc of classDocs) {
    for (let i = 1; i <= 5; i++) { // 5 students per class
      studentCounter++;
      const parentGroup = Math.ceil(studentCounter / 2);
      const parentId = objectId();
      
      // Parent User
      const parent = new User({
        _id: parentId,
        name: `Parent ${schoolIndex + 1}-${String(parentGroup).padStart(3, '0')}`,
        email: `parent.sc${String(schoolIndex + 1).padStart(2, '0')}.g${String(parentGroup).padStart(3, '0')}_demo@test.com`,
        password: hashedPassword,
        role: 'parent',
        schoolId: school._id,
        schoolCode: school.schoolCode,
        schoolName: school.schoolName,
        phone: `+8801730002${schoolIndex}${String(parentGroup).padStart(3, '0')}`,
        isApproved: true,
        emailVerified: true,
        isActive: true,
        linkedStudents: 1,
        createdAt: now,
        updatedAt: now,
        seedTag: 'bootstrap-v1'
      });
      
      await parent.save();
      parentDocs.push(parent);
      
      // Student User
      const studentUserId = objectId();
      const studentUser = new User({
        _id: studentUserId,
        name: `Student ${schoolIndex + 1}-${classDoc.classLevel}${classDoc.section}-${i}`,
        email: `std.sc${String(schoolIndex + 1).padStart(2, '0')}.${classDoc.classLevel}${classDoc.section.toLowerCase()}.${i}_demo@test.com`,
        password: hashedPassword,
        role: 'student',
        schoolId: school._id,
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
        seedTag: 'bootstrap-v1'
      });
      
      await studentUser.save();
      
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
        seedTag: 'bootstrap-v1'
      });
      
      await student.save();
      studentDocs.push(student);
      
      // Update class student count
      classDoc.currentStudents += 1;
      await classDoc.save();
    }
  }
  
  console.log('📊 Created students:', studentDocs.length);
  return {
    school,
    principal: principalUser,
    teachers: teacherUsers,
    students: studentDocs,
    subjects: subjectDocs,
    classes: classDocs,
    sections: sectionDocs
  };
}

// Main bootstrap function
async function bootstrapDatabase() {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Checking if database needs bootstrap...');
    
    // Check if database is empty
    const empty = await isDatabaseEmpty();
    if (!empty) {
      console.log('✅ Database already has data - skipping bootstrap');
      return { skipped: true, reason: 'Database not empty', counts: {} };
    }
    
    console.log('📭 Database is empty - starting bootstrap...');
    
    // Check if bootstrap already completed (safety measure)
    const marker = await BootstrapMarker.getSingleton();
    if (marker?.completed === true) {
      console.log('✅ Bootstrap already completed - skipping');
      return { skipped: true, reason: 'Bootstrap already completed', counts: {} };
    }
    
    const now = new Date();
    const hashedPassword = await hashPassword(DEFAULT_PASSWORD);
    
    // Create bootstrap marker (will be marked completed at the end)
    const bootstrapMarker = new BootstrapMarker({
      _id: 'bootstrap-marker',
      version: BOOTSTRAP_VERSION,
      notes: 'Initial system bootstrap'
    });
    
    await bootstrapMarker.save();
    
    // Create Super Admin
    const superAdmin = await createSuperAdmin(hashedPassword, now);
    
    const results = [];
    let totalSchools = 0;
    let totalUsers = 0;
    let totalStudents = 0;
    let totalTeachers = 0;
    
    // Create 5 schools
    for (let i = 0; i < 5; i++) {
      console.log(`🏫 Creating school ${i + 1}/5...`);
      const result = await createSchool(i, hashedPassword, superAdmin._id, now);
      results.push(result);
      
      totalSchools++;
      totalUsers += 1 + 5 + 50 + 13; // super admin + principal + teachers + students + parents (est)
      totalStudents += 50;
      totalTeachers += 5;
    }
    
    // Mark bootstrap as completed
    await bootstrapMarker.markCompleted();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Bootstrap completed in ${duration}ms`);
    console.log(`   Schools: ${totalSchools}`);
    console.log(`   Users: ${totalUsers}`);
    console.log(`   Students: ${totalStudents}`);
    console.log(`   Teachers: ${totalTeachers}`);
    
    return {
      success: true,
      skipped: false,
      counts: {
        schools: totalSchools,
        users: totalUsers,
        students: totalStudents,
        teachers: totalTeachers
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    
    // If bootstrap failed, we should clean up the partially created marker
    try {
      await BootstrapMarker.deleteOne({ _id: 'bootstrap-marker' });
    } catch (cleanupError) {
      console.error('Failed to clean up bootstrap marker:', cleanupError.message);
    }
    
    throw error;
  }
}

module.exports = { bootstrapDatabase };