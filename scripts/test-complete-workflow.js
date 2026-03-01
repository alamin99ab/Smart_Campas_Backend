/**
 * 🧪 SMART CAMPUS SaaS - COMPLETE WORKFLOW TEST
 * Demonstrates the complete implementation flow
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
let authToken = '';
let schoolId = '';
let principalId = '';
let teacherId = '';
let studentId = '';

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logPhase(phase) {
    log(`\n🔹 ${phase}`, 'blue');
    log('='.repeat(50), 'blue');
}

function logStep(step, status = 'pending') {
    const icon = status === 'success' ? '✅' : status === 'error' ? '❌' : '🔄';
    log(`${icon} ${step}`, status === 'success' ? 'green' : status === 'error' ? 'red' : 'yellow');
}

// Test functions
async function testSuperAdminLogin() {
    try {
        logStep('Super Admin Login', 'pending');
        
        const response = await axios.post(`${BASE_URL}/api/auth/super-admin/login`, {
            email: 'superadmin@smartcampus.com',
            password: 'admin123'
        });

        if (response.data.success) {
            authToken = response.data.data.token;
            logStep('Super Admin Login - SUCCESS', 'success');
            return true;
        }
    } catch (error) {
        logStep(`Super Admin Login - FAILED: ${error.message}`, 'error');
        return false;
    }
}

async function testCreateSchool() {
    try {
        logStep('Create New School', 'pending');
        
        const schoolData = {
            schoolName: 'Test International School',
            address: '123 Test Street, Dhaka',
            email: 'info@testschool.com',
            phone: '+8801234567890',
            schoolType: 'secondary',
            subscriptionPlan: 'standard',
            principalName: 'Test Principal',
            principalEmail: 'principal@testschool.com',
            principalPhone: '+8801234567891'
        };

        const response = await axios.post(`${BASE_URL}/api/super-admin/schools`, schoolData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        if (response.data.success) {
            schoolId = response.data.data.school._id;
            principalId = response.data.data.principal.id;
            logStep('Create School - SUCCESS', 'success');
            log(`  School ID: ${schoolId}`, 'green');
            log(`  Principal ID: ${principalId}`, 'green');
            return true;
        }
    } catch (error) {
        logStep(`Create School - FAILED: ${error.message}`, 'error');
        return false;
    }
}

async function testPrincipalLogin() {
    try {
        logStep('Principal Login', 'pending');
        
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'principal@testschool.com',
            password: 'generated_password' // This would be provided in real scenario
        });

        if (response.data.success) {
            authToken = response.data.data.token;
            logStep('Principal Login - SUCCESS', 'success');
            return true;
        }
    } catch (error) {
        logStep(`Principal Login - FAILED: ${error.message}`, 'error');
        return false;
    }
}

async function testAcademicSetup() {
    try {
        logStep('Academic Setup - Creating Classes', 'pending');
        
        // Create Academic Session
        const sessionResponse = await axios.post(`${BASE_URL}/api/principal/academic-sessions`, {
            sessionName: '2026',
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            isActive: true
        }, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        if (sessionResponse.data.success) {
            logStep('Academic Session Created - SUCCESS', 'success');
        }

        // Create Class
        const classResponse = await axios.post(`${BASE_URL}/api/principal/classes`, {
            className: 'Class 6',
            section: 'A',
            classLevel: 6,
            capacity: 40,
            academicYear: '2026'
        }, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        if (classResponse.data.success) {
            logStep('Class Created - SUCCESS', 'success');
            return true;
        }
    } catch (error) {
        logStep(`Academic Setup - FAILED: ${error.message}`, 'error');
        return false;
    }
}

async function testCreateTeacher() {
    try {
        logStep('Create Teacher', 'pending');
        
        const teacherData = {
            name: 'Test Teacher',
            email: 'teacher@testschool.com',
            phone: '+8801234567892',
            password: 'teacher123',
            subjects: ['Mathematics', 'English'],
            assignedClasses: ['Class 6-A'],
            maxLoad: 30
        };

        const response = await axios.post(`${BASE_URL}/api/principal/teachers`, teacherData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        if (response.data.success) {
            teacherId = response.data.data._id;
            logStep('Create Teacher - SUCCESS', 'success');
            log(`  Teacher ID: ${teacherId}`, 'green');
            return true;
        }
    } catch (error) {
        logStep(`Create Teacher - FAILED: ${error.message}`, 'error');
        return false;
    }
}

async function testCreateStudent() {
    try {
        logStep('Create Student', 'pending');
        
        const studentData = {
            name: 'Test Student',
            email: 'student@testschool.com',
            phone: '+8801234567893',
            password: 'student123',
            rollNumber: '1001',
            classId: 'class_6a_id', // This would be actual class ID
            section: 'A',
            dateOfBirth: '2010-01-01',
            gender: 'Male',
            parentName: 'Test Parent',
            parentPhone: '+8801234567894'
        };

        const response = await axios.post(`${BASE_URL}/api/principal/students`, studentData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        if (response.data.success) {
            studentId = response.data.data._id;
            logStep('Create Student - SUCCESS', 'success');
            log(`  Student ID: ${studentId}`, 'green');
            return true;
        }
    } catch (error) {
        logStep(`Create Student - FAILED: ${error.message}`, 'error');
        return false;
    }
}

async function testCreateRoutine() {
    try {
        logStep('Create Class Routine', 'pending');
        
        const routineData = {
            classId: 'class_6a_id',
            sectionId: 'section_a_id',
            academicSessionId: 'session_2026_id',
            routines: [
                {
                    day: 'sunday',
                    periodNumber: 1,
                    startTime: '08:00',
                    endTime: '08:45',
                    subjectId: 'math_subject_id',
                    teacherId: teacherId,
                    roomId: 'room_101_id'
                },
                {
                    day: 'sunday',
                    periodNumber: 2,
                    startTime: '08:50',
                    endTime: '09:35',
                    subjectId: 'english_subject_id',
                    teacherId: teacherId,
                    roomId: 'room_101_id'
                }
            ]
        };

        const response = await axios.post(`${BASE_URL}/api/principal/routine/weekly`, routineData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        if (response.data.success) {
            logStep('Create Routine - SUCCESS', 'success');
            log(`  Conflicts Found: ${response.data.data.conflicts.length}`, 'green');
            return true;
        }
    } catch (error) {
        logStep(`Create Routine - FAILED: ${error.message}`, 'error');
        return false;
    }
}

async function testTeacherLogin() {
    try {
        logStep('Teacher Login', 'pending');
        
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'teacher@testschool.com',
            password: 'teacher123'
        });

        if (response.data.success) {
            authToken = response.data.data.token;
            logStep('Teacher Login - SUCCESS', 'success');
            return true;
        }
    } catch (error) {
        logStep(`Teacher Login - FAILED: ${error.message}`, 'error');
        return false;
    }
}

async function testMarkAttendance() {
    try {
        logStep('Mark Student Attendance', 'pending');
        
        const attendanceData = {
            classId: 'class_6a_id',
            sectionId: 'section_a_id',
            subjectId: 'math_subject_id',
            periodNumber: 1,
            date: '2026-03-01',
            attendanceData: [
                {
                    studentId: studentId,
                    status: 'present',
                    notes: 'On time'
                }
            ]
        };

        const response = await axios.post(`${BASE_URL}/api/teacher/attendance/mark`, attendanceData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        if (response.data.success) {
            logStep('Mark Attendance - SUCCESS', 'success');
            return true;
        }
    } catch (error) {
        logStep(`Mark Attendance - FAILED: ${error.message}`, 'error');
        return false;
    }
}

async function testStudentLogin() {
    try {
        logStep('Student Login', 'pending');
        
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            email: 'student@testschool.com',
            password: 'student123'
        });

        if (response.data.success) {
            authToken = response.data.data.token;
            logStep('Student Login - SUCCESS', 'success');
            return true;
        }
    } catch (error) {
        logStep(`Student Login - FAILED: ${error.message}`, 'error');
        return false;
    }
}

async function testStudentDashboard() {
    try {
        logStep('Access Student Dashboard', 'pending');
        
        const response = await axios.get(`${BASE_URL}/api/student/dashboard`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        if (response.data.success) {
            logStep('Student Dashboard - SUCCESS', 'success');
            log(`  Welcome: ${response.data.data.student.name}`, 'green');
            return true;
        }
    } catch (error) {
        logStep(`Student Dashboard - FAILED: ${error.message}`, 'error');
        return false;
    }
}

// Main test execution
async function runCompleteWorkflowTest() {
    log('🚀 SMART CAMPUS SaaS - COMPLETE WORKFLOW TEST', 'blue');
    log('Testing all phases of the implementation...', 'blue');
    log('='.repeat(60), 'blue');

    let allTestsPassed = true;

    // Phase 1 & 2: Super Admin Flow
    logPhase('PHASE 1 & 2: SUPER ADMIN FLOW');
    allTestsPassed &= await testSuperAdminLogin();
    allTestsPassed &= await testCreateSchool();

    // Phase 3: Principal Flow
    logPhase('PHASE 3: PRINCIPAL FLOW');
    allTestsPassed &= await testPrincipalLogin();
    allTestsPassed &= await testAcademicSetup();
    allTestsPassed &= await testCreateTeacher();
    allTestsPassed &= await testCreateStudent();
    allTestsPassed &= await testCreateRoutine();

    // Phase 5: Daily Operation Flow
    logPhase('PHASE 5: DAILY OPERATION FLOW');
    allTestsPassed &= await testTeacherLogin();
    allTestsPassed &= await testMarkAttendance();
    allTestsPassed &= await testStudentLogin();
    allTestsPassed &= await testStudentDashboard();

    // Final Results
    log('\n' + '='.repeat(60), 'blue');
    if (allTestsPassed) {
        log('🎉 ALL TESTS PASSED - WORKFLOW COMPLETE!', 'green');
        log('✅ Smart Campus SaaS is fully functional', 'green');
        log('✅ All phases implemented correctly', 'green');
        log('✅ Ready for production deployment', 'green');
    } else {
        log('❌ SOME TESTS FAILED - CHECK IMPLEMENTATION', 'red');
    }
    log('='.repeat(60), 'blue');

    process.exit(allTestsPassed ? 0 : 1);
}

// Health check before running tests
async function checkAPIHealth() {
    try {
        const response = await axios.get(`${BASE_URL}/api/health`);
        if (response.data.success) {
            log('✅ API Server is running', 'green');
            log(`📍 Server: ${BASE_URL}`, 'green');
            log(`📊 Version: ${response.data.version}`, 'green');
            return true;
        }
    } catch (error) {
        log('❌ API Server is not running', 'red');
        log(`📍 Expected: ${BASE_URL}`, 'red');
        log('Please start the server first: npm start', 'yellow');
        return false;
    }
}

// Run the test
if (require.main === module) {
    checkAPIHealth().then(isHealthy => {
        if (isHealthy) {
            runCompleteWorkflowTest();
        }
    });
}

module.exports = {
    runCompleteWorkflowTest,
    checkAPIHealth
};
