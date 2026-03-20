# Render Deployment Fixes

Apply these fixes to your codebase and redeploy to Render.

---

## Fix 1: middleware/multiTenant.js (Line ~32)

**Problem:** The school query was trying to use `{ _id: schoolCode }` where schoolCode is a string like "SRC001", but _id expects an ObjectId.

**Change from:**
```javascript
const school = await School.findOne({ 
    $or: [{ _id: schoolCode }, { schoolCode }],
    isActive: true 
});
```

**To:**
```javascript
const school = await School.findOne({ 
    schoolCode: schoolCode,
    isActive: true 
});
```

---

## Fix 2: controllers/superAdminController.js (Lines ~562-575)

**Problem:** Password was being double-hashed - manually hashed in createSchool AND by User model's pre-save hook.

**Change from:**
```javascript
// Create principal account in MongoDB
const bcrypt = require('bcryptjs');
const salt = await bcrypt.genSalt(12);
const passwordToHash = principalPassword || 'Principal@123';
const hashedPassword = await bcrypt.hash(passwordToHash, salt);

// Save school first to get the _id
await school.save();

// Now create principal with schoolId
const principal = new User({
    name: principalName,
    email: principalEmail,
    password: hashedPassword,
```

**To:**
```javascript
// Create principal account in MongoDB
// Don't hash here - User model's pre-save middleware will handle hashing
const passwordToUse = principalPassword || 'Principal@123';

// Save school first to get the _id
await school.save();

// Now create principal with schoolId - pass plain password, model will hash it
const principal = new User({
    name: principalName,
    email: principalEmail,
    password: passwordToUse,
```

---

## Fix 3: controllers/dashboardController.js

**Problem:** Teacher/Student dashboards were calling User.findById() which was failing. Use req.user directly instead.

**Replace getTeacherDashboard with:**
```javascript
exports.getTeacherDashboard = async (req, res) => {
    try {
        const teacher = req.user;
        const schoolCode = req.user.schoolCode;
        
        res.status(200).json({
            success: true,
            data: {
                teacher: {
                    name: teacher.name,
                    email: teacher.email,
                    schoolCode: schoolCode
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
```

**Replace getStudentDashboard with:**
```javascript
exports.getStudentDashboard = async (req, res) => {
    try {
        const student = req.user;
        const schoolCode = req.user.schoolCode;
        
        res.status(200).json({
            success: true,
            data: {
                student: {
                    name: student.name,
                    email: student.email,
                    schoolCode: schoolCode
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
```

---

## Summary

After applying these fixes:
1. Commit and push to GitHub
2. Render will auto-deploy
3. Teacher and Student dashboards will work
4. Principal login will work after school creation
