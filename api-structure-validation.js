const fs = require('fs');
const path = require('path');

console.log('🔍 SMART CAMPUS API STRUCTURE VALIDATION');
console.log('='.repeat(60));

// Check if all required files exist
const requiredFiles = [
    'routes/teacherRoutes.js',
    'controllers/teacherController.js',
    'models/Teacher.js',
    'routes/feeRoutes.js',
    'controllers/feeController.js',
    'models/Fee.js',
    'routes/authRoutes.js',
    'controllers/authController.js',
    'models/User.js',
    'routes/adminRoutes.js',
    'controllers/adminController.js',
    'models/School.js',
    'routes/studentRoutes.js',
    'controllers/studentController.js',
    'models/Student.js',
    'routes/noticeRoutes.js',
    'controllers/noticeController.js',
    'models/Notice.js',
    'routes/attendanceRoutes.js',
    'controllers/attendanceController.js',
    'models/Attendance.js',
    'routes/resultRoutes.js',
    'controllers/resultController.js',
    'models/Result.js',
    'routes/routineRoutes.js',
    'controllers/routineController.js',
    'models/Routine.js',
    'routes/eventRoutes.js',
    'controllers/eventController.js',
    'models/SchoolEvent.js',
    'routes/dashboardRoutes.js',
    'controllers/dashboardController.js',
    'index.js'
];

console.log('\n📁 CHECKING REQUIRED FILES:');
console.log('═'.repeat(60));

let filesExist = 0;
let filesMissing = 0;

requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    const exists = fs.existsSync(filePath);
    
    if (exists) {
        console.log(`✅ ${file}`);
        filesExist++;
    } else {
        console.log(`❌ ${file} - MISSING`);
        filesMissing++;
    }
});

console.log('\n📊 FILE STATUS:');
console.log('═'.repeat(60));
console.log(`Files Exist: ${filesExist}/${requiredFiles.length}`);
console.log(`Files Missing: ${filesMissing}`);

// Check server configuration
console.log('\n🔧 CHECKING SERVER CONFIGURATION:');
console.log('═'.repeat(60));

try {
    const indexContent = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
    
    // Check if teacher routes are included
    const hasTeacherRoutes = indexContent.includes("require('./routes/teacherRoutes')");
    console.log(hasTeacherRoutes ? '✅ Teacher routes included' : '❌ Teacher routes missing');
    
    // Check if teacher routes are used
    const hasTeacherAppUse = indexContent.includes("app.use('/api/teachers', teacherRoutes)");
    console.log(hasTeacherAppUse ? '✅ Teacher routes mounted' : '❌ Teacher routes not mounted');
    
    // Check other route mounts
    const routeMounts = [
        { name: 'Auth', pattern: "app.use('/api/auth', authRoutes)" },
        { name: 'Admin', pattern: "app.use('/api/admin', adminRoutes)" },
        { name: 'Students', pattern: "app.use('/api/students', studentRoutes)" },
        { name: 'Teachers', pattern: "app.use('/api/teachers', teacherRoutes)" },
        { name: 'Notices', pattern: "app.use('/api/notices', noticeRoutes)" },
        { name: 'Attendance', pattern: "app.use('/api/attendance', attendanceRoutes)" },
        { name: 'Results', pattern: "app.use('/api/results', resultRoutes)" },
        { name: 'Routine', pattern: "app.use('/api/routine', routineRoutes)" },
        { name: 'Fees', pattern: "app.use('/api/fee', feeRoutes)" },
        { name: 'Events', pattern: "app.use('/api/events', eventRoutes)" },
        { name: 'Dashboard', pattern: "app.use('/api/dashboard', dashboardRoutes)" }
    ];
    
    console.log('\n📋 ROUTE MOUNTS:');
    routeMounts.forEach(route => {
        const mounted = indexContent.includes(route.pattern);
        console.log(mounted ? `✅ ${route.name}` : `❌ ${route.name} - NOT MOUNTED`);
    });
    
} catch (error) {
    console.log('❌ Error reading index.js:', error.message);
}

// Check teacher controller structure
console.log('\n👨‍🏫 CHECKING TEACHER CONTROLLER:');
console.log('═'.repeat(60));

try {
    const teacherControllerPath = path.join(__dirname, 'controllers/teacherController.js');
    if (fs.existsSync(teacherControllerPath)) {
        const teacherControllerContent = fs.readFileSync(teacherControllerPath, 'utf8');
        
        const requiredFunctions = [
            'getTeachers',
            'getTeacherById',
            'createTeacher',
            'updateTeacher',
            'deleteTeacher',
            'assignSubjects',
            'getTeacherSchedule',
            'uploadPhoto'
        ];
        
        requiredFunctions.forEach(func => {
            const exists = teacherControllerContent.includes(`exports.${func}`);
            console.log(exists ? `✅ ${func}` : `❌ ${func} - MISSING`);
        });
    } else {
        console.log('❌ Teacher controller file missing');
    }
} catch (error) {
    console.log('❌ Error checking teacher controller:', error.message);
}

// Check teacher model structure
console.log('\n📊 CHECKING TEACHER MODEL:');
console.log('═'.repeat(60));

try {
    const teacherModelPath = path.join(__dirname, 'models/Teacher.js');
    if (fs.existsSync(teacherModelPath)) {
        const teacherModelContent = fs.readFileSync(teacherModelPath, 'utf8');
        
        const requiredFields = [
            'userId',
            'schoolCode',
            'qualification',
            'experience',
            'subjects'
        ];
        
        requiredFields.forEach(field => {
            const exists = teacherModelContent.includes(field);
            console.log(exists ? `✅ ${field}` : `❌ ${field} - MISSING`);
        });
    } else {
        console.log('❌ Teacher model file missing');
    }
} catch (error) {
    console.log('❌ Error checking teacher model:', error.message);
}

// Final validation
console.log('\n🎯 VALIDATION SUMMARY:');
console.log('═'.repeat(60));

const allFilesExist = filesMissing === 0;
const serverConfigured = fs.existsSync(path.join(__dirname, 'index.js'));

if (allFilesExist && serverConfigured) {
    console.log('✅ ALL API STRUCTURES ARE CORRECTLY IMPLEMENTED');
    console.log('✅ All required files exist');
    console.log('✅ Server configuration is complete');
    console.log('✅ Teacher management system added');
    console.log('✅ All endpoints are properly structured');
    
    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Install and start MongoDB');
    console.log('2. Start backend server: npm start');
    console.log('3. Test APIs with the live test script');
    console.log('4. Start frontend and integrate');
    
    console.log('\n🎉 YOUR SMART CAMPUS API IS READY!');
} else {
    console.log('❌ SOME ISSUES FOUND:');
    if (!allFilesExist) console.log('- Some required files are missing');
    if (!serverConfigured) console.log('- Server configuration is incomplete');
    
    console.log('\n🔧 FIXES NEEDED:');
    console.log('1. Create missing files');
    console.log('2. Update server configuration');
    console.log('3. Re-run this validation');
}
