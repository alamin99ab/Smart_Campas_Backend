# Smart School Management System - API Documentation

**Version:** 5.0.0  
**Base URL:** `http://localhost:3001/api` (Local) / `https://your-app.onrender.com/api` (Production)  
**Last Updated:** March 18, 2026

---

## 📚 Table of Contents

1. [Authentication & Overview](#1-authentication--overview)
2. [Authentication APIs](#2-authentication-apis)
3. [Super Admin APIs](#3-super-admin-apis)
4. [Principal APIs](#4-principal-apis)
5. [Teacher APIs](#5-teacher-apis)
6. [Student APIs](#6-student-apis)
7. [Parent APIs](#7-parent-apis)
8. [Accountant APIs](#8-accountant-apis)
9. [Dashboard APIs](#9-dashboard-apis)
10. [Notice APIs](#10-notice-apis)
11. [Attendance APIs](#11-attendance-apis)
12. [Exam & Result APIs](#12-exam--result-apis)
13. [Fees APIs](#13-fees-apis)
14. [Postman Environment Setup](#14-postman-environment-setup)
15. [Testing Guide](#15-testing-guide)

---

## 1. Authentication & Overview

### Default Super Admin Credentials
```
Email: ${SUPER_ADMIN_EMAIL} (from .env file)
Password: ${SUPER_ADMIN_PASSWORD} (from .env file)
Default: admin@school.local / ChangeMe123!
Role: super_admin
```

**⚠️ IMPORTANT:** Change default credentials in production!

### JWT Authentication
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

### Common Response Format
```json
{
  "success": true/false,
  "message": "Description of the result",
  "data": { },
  "meta": { "page": 1, "total": 100 }
}
```

### Standard HTTP Status Codes
| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT requests |
| 201 | Created | Successful POST requests |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Internal server error |

---

## 2. Authentication APIs

### 2.1 Super Admin Login
**Endpoint:** `POST /api/auth/login`  
**Access:** Public  
**Description:** Authenticate Super Admin and get JWT token

**Request Body:**
```json
{
  "email": "${SUPER_ADMIN_EMAIL}",
  "password": "${SUPER_ADMIN_PASSWORD}"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Super Administrator",
      "email": "alamin@admin.com",
      "role": "super_admin",
      "permissions": ["all", "manage_schools", "manage_users"]
    }
  }
}
```

**Error Responses:**
```json
// 401 - Invalid credentials
{
  "success": false,
  "message": "Invalid credentials"
}

// 400 - Missing fields
{
  "success": false,
  "message": "Please provide email and password"
}
```

---

### 2.2 Register Principal
**Endpoint:** `POST /api/auth/register`  
**Access:** Public  
**Description:** Register a new Principal with school

**Request Body:**
```json
{
  "name": "John Principal",
  "email": "principal@test.com",
  "password": "SecurePass123!",
  "role": "principal",
  "schoolName": "Test School",
  "schoolCode": "SCH001",
  "phone": "+1234567890"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Principal registered successfully",
  "data": {
    "user": {
      "_id": "...",
      "name": "John Principal",
      "email": "principal@test.com",
      "role": "principal",
      "schoolCode": "SCH001"
    },
    "school": {
      "_id": "...",
      "schoolName": "Test School",
      "schoolCode": "SCH001",
      "subscription": {
        "plan": "trial",
        "status": "active"
      }
    }
  }
}
```

---

### 2.3 Logout
**Endpoint:** `POST /api/auth/logout`  
**Access:** Protected  
**Description:** Logout user and invalidate token

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 2.4 Refresh Token
**Endpoint:** `POST /api/auth/refresh`  
**Access:** Public (with refresh token)  
**Description:** Get new access token using refresh token

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### 2.5 Get User Profile
**Endpoint:** `GET /api/auth/profile`  
**Access:** Protected  
**Description:** Get current user profile

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "John Principal",
    "email": "principal@test.com",
    "role": "principal",
    "schoolCode": "SCH001",
    "permissions": ["manage_all"]
  }
}
```

---

## 3. Super Admin APIs

### 3.1 Get Super Admin Dashboard
**Endpoint:** `GET /api/super-admin/dashboard`  
**Access:** Protected (Super Admin only)  
**Description:** Get platform-wide statistics and overview

**Headers:**
```
Authorization: Bearer <super_admin_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalSchools": 150,
      "activeSchools": 145,
      "totalUsers": 5000,
      "totalStudents": 35000,
      "totalTeachers": 2800,
      "revenue": {
        "monthly": 50000,
        "annual": 600000
      }
    },
    "recentSchools": [
      {
        "_id": "...",
        "schoolName": "Test School",
        "schoolCode": "SCH001",
        "subscription": { "plan": "premium", "status": "active" }
      }
    ]
  }
}
```

---

### 3.2 Create School with Principal
**Endpoint:** `POST /api/super-admin/schools`  
**Access:** Protected (Super Admin only)  
**Description:** Create a new school with principal account

**Headers:**
```
Authorization: Bearer <super_admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "schoolName": "Sunrise Academy",
  "schoolCode": "SA2024",
  "address": "123 Main Street",
  "city": "New York",
  "state": "NY",
  "country": "USA",
  "phone": "+1234567890",
  "email": "info@sunriseacademy.com",
  "principalName": "Jane Smith",
  "principalEmail": "principal@sunriseacademy.com",
  "principalPhone": "+1234567891",
  "principalPassword": "Principal@123",
  "subscription": {
    "plan": "standard",
    "status": "active"
  }
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "School created successfully with principal",
  "data": {
    "school": {
      "_id": "...",
      "schoolName": "Sunrise Academy",
      "schoolCode": "SA2024",
      "subscription": { "plan": "standard", "status": "active" }
    },
    "principal": {
      "_id": "...",
      "name": "Jane Smith",
      "email": "principal@sunriseacademy.com",
      "role": "principal"
    }
  }
}
```

---

### 3.3 Get All Schools
**Endpoint:** `GET /api/super-admin/schools`  
**Access:** Protected (Super Admin only)  
**Description:** Get list of all schools with filtering

**Headers:**
```
Authorization: Bearer <super_admin_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status (active, inactive, suspended) |
| plan | string | Filter by subscription plan |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 10) |

**Example:** `GET /api/super-admin/schools?status=active&plan=premium&page=1&limit=20`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "schools": [
      {
        "_id": "...",
        "schoolName": "Sunrise Academy",
        "schoolCode": "SA2024",
        "status": "active",
        "subscription": { "plan": "premium", "status": "active" },
        "principal": { "name": "Jane Smith", "email": "..." },
        "stats": { "studentCount": 500, "teacherCount": 35 }
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 150,
      "pages": 15
    }
  }
}
```

---

### 3.4 Get Platform Statistics
**Endpoint:** `GET /api/super-admin/statistics`  
**Access:** Protected (Super Admin only)  
**Description:** Get comprehensive platform analytics

**Headers:**
```
Authorization: Bearer <super_admin_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "platformStats": {
      "totalSchools": 150,
      "totalUsers": 5000,
      "totalStudents": 35000,
      "totalTeachers": 2800,
      "totalParents": 30000
    },
    "subscriptionStats": {
      "trial": 20,
      "basic": 45,
      "standard": 60,
      "premium": 25
    },
    "revenue": {
      "monthly": 50000,
      "quarterly": 150000,
      "annual": 600000
    },
    "growth": {
      "schoolsThisMonth": 5,
      "usersThisMonth": 150
    }
  }
}
```

---

### 3.5 Suspend/Activate School
**Endpoint:** `PATCH /api/super-admin/schools/:id/status`  
**Access:** Protected (Super Admin only)  
**Description:** Change school status (suspend/activate)

**Headers:**
```
Authorization: Bearer <super_admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "suspended",
  "reason": "Payment overdue"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "School status updated to suspended",
  "data": {
    "school": {
      "_id": "...",
      "schoolName": "Sunrise Academy",
      "status": "suspended",
      "updatedAt": "2024-03-18T10:00:00Z"
    }
  }
}
```

---

### 3.6 Reset Principal Password
**Endpoint:** `POST /api/super-admin/schools/:id/reset-password`  
**Access:** Protected (Super Admin only)  
**Description:** Reset principal password

**Headers:**
```
Authorization: Bearer <super_admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "newPassword": "NewSecurePass123!"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Principal password reset successfully",
  "data": {
    "principal": {
      "_id": "...",
      "name": "Jane Smith",
      "email": "principal@sunriseacademy.com"
    }
  }
}
```

---

## 4. Principal APIs

### 4.1 Get Principal Dashboard
**Endpoint:** `GET /api/principal/dashboard`  
**Access:** Protected (Principal only)  
**Description:** Get school overview and statistics

**Headers:**
```
Authorization: Bearer <principal_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "school": {
      "_id": "...",
      "schoolName": "Sunrise Academy",
      "schoolCode": "SA2024"
    },
    "stats": {
      "totalStudents": 500,
      "totalTeachers": 35,
      "totalClasses": 20,
      "attendanceToday": { "present": 485, "absent": 15, "percentage": 97 },
      "feeCollection": { "collected": 45000, "pending": 5000 }
    },
    "recentActivity": [
      {
        "type": "attendance_marked",
        "description": "Class 10A attendance marked",
        "timestamp": "2024-03-18T08:00:00Z"
      }
    ]
  }
}
```

---

### 4.2 Create Teacher
**Endpoint:** `POST /api/principal/teachers`  
**Access:** Protected (Principal only)  
**Description:** Add a new teacher to the school

**Headers:**
```
Authorization: Bearer <principal_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Robert Johnson",
  "email": "teacher@sunriseacademy.com",
  "password": "Teacher@123",
  "phone": "+1234567892",
  "subjects": ["Mathematics", "Physics"],
  "classes": ["Class 9A", "Class 10A"],
  "qualifications": ["M.Sc Mathematics", "B.Ed"],
  "experience": 5,
  "joinDate": "2024-03-18"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Teacher created successfully",
  "data": {
    "teacher": {
      "_id": "...",
      "name": "Robert Johnson",
      "email": "teacher@sunriseacademy.com",
      "role": "teacher",
      "subjects": ["Mathematics", "Physics"],
      "isApproved": true
    }
  }
}
```

---

### 4.3 Get All Teachers
**Endpoint:** `GET /api/principal/teachers`  
**Access:** Protected (Principal only)  
**Description:** Get list of all teachers in school

**Headers:**
```
Authorization: Bearer <principal_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | active, inactive, pending |
| subject | string | Filter by subject |
| page | number | Page number |
| limit | number | Items per page |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "teachers": [
      {
        "_id": "...",
        "name": "Robert Johnson",
        "email": "teacher@sunriseacademy.com",
        "subjects": ["Mathematics"],
        "classes": ["Class 9A", "Class 10A"],
        "isActive": true,
        "attendanceStats": { "present": 95, "absent": 5 }
      }
    ],
    "meta": { "page": 1, "limit": 10, "total": 35 }
  }
}
```

---

### 4.4 Create Student
**Endpoint:** `POST /api/principal/students`  
**Access:** Protected (Principal only)  
**Description:** Add a new student to the school

**Headers:**
```
Authorization: Bearer <principal_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Alice Student",
  "email": "student@sunriseacademy.com",
  "password": "Student@123",
  "rollNumber": "SA2024001",
  "class": "Class 10A",
  "section": "A",
  "dateOfBirth": "2008-05-15",
  "gender": "female",
  "phone": "+1234567893",
  "parentName": "John Parent",
  "parentEmail": "parent@email.com",
  "parentPhone": "+1234567894",
  "address": "456 Student Lane"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Student created successfully",
  "data": {
    "student": {
      "_id": "...",
      "name": "Alice Student",
      "email": "student@sunriseacademy.com",
      "rollNumber": "SA2024001",
      "class": "Class 10A",
      "role": "student"
    }
  }
}
```

---

### 4.5 Create Class
**Endpoint:** `POST /api/principal/classes`  
**Access:** Protected (Principal only)  
**Description:** Create a new class/grade

**Headers:**
```
Authorization: Bearer <principal_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Class 10",
  "sections": ["A", "B", "C"],
  "subjects": ["Mathematics", "Physics", "Chemistry", "Biology", "English"],
  "classTeacher": "teacher_id_here",
  "capacity": 40,
  "academicYear": "2024-2025"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Class created successfully",
  "data": {
    "class": {
      "_id": "...",
      "name": "Class 10",
      "sections": ["A", "B", "C"],
      "subjects": ["Mathematics", "Physics", "Chemistry", "Biology", "English"],
      "academicYear": "2024-2025"
    }
  }
}
```

---

### 4.6 Get School Attendance Report
**Endpoint:** `GET /api/principal/attendance/report`  
**Access:** Protected (Principal only)  
**Description:** Get comprehensive attendance report

**Headers:**
```
Authorization: Bearer <principal_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| startDate | date | Start date (YYYY-MM-DD) |
| endDate | date | End date (YYYY-MM-DD) |
| class | string | Filter by class |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "report": {
      "dateRange": { "start": "2024-03-01", "end": "2024-03-18" },
      "overall": { "present": 485, "absent": 15, "percentage": 97 },
      "byClass": [
        {
          "class": "Class 10A",
          "present": 38,
          "absent": 2,
          "percentage": 95
        }
      ],
      "byStudent": [
        {
          "student": { "name": "Alice Student", "rollNumber": "SA2024001" },
          "attendance": { "present": 18, "absent": 0, "percentage": 100 }
        }
      ]
    }
  }
}
```

---

## 5. Teacher APIs

### 5.1 Get Teacher Dashboard
**Endpoint:** `GET /api/teacher/dashboard`  
**Access:** Protected (Teacher only)  
**Description:** Get teacher's daily overview

**Headers:**
```
Authorization: Bearer <teacher_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "teacher": {
      "_id": "...",
      "name": "Robert Johnson",
      "subjects": ["Mathematics", "Physics"],
      "classes": ["Class 9A", "Class 10A"]
    },
    "today": {
      "date": "2024-03-18",
      "schedule": [
        {
          "time": "09:00-10:00",
          "class": "Class 9A",
          "subject": "Mathematics",
          "room": "101"
        }
      ],
      "attendanceStatus": "pending"
    },
    "stats": {
      "totalStudents": 78,
      "classesToday": 4,
      "pendingAssignments": 3
    }
  }
}
```

---

### 5.2 Mark Attendance
**Endpoint:** `POST /api/teacher/attendance`  
**Access:** Protected (Teacher only)  
**Description:** Mark attendance for a class

**Headers:**
```
Authorization: Bearer <teacher_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "classId": "class_id_here",
  "section": "A",
  "date": "2024-03-18",
  "subject": "Mathematics",
  "attendance": [
    {
      "studentId": "student_id_1",
      "status": "present",
      "remarks": ""
    },
    {
      "studentId": "student_id_2",
      "status": "absent",
      "remarks": "Sick leave"
    }
  ]
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Attendance marked successfully",
  "data": {
    "attendance": {
      "classId": "class_id_here",
      "date": "2024-03-18",
      "totalPresent": 38,
      "totalAbsent": 2,
      "percentage": 95
    }
  }
}
```

---

### 5.3 Get My Students
**Endpoint:** `GET /api/teacher/students`  
**Access:** Protected (Teacher only)  
**Description:** Get students in teacher's assigned classes

**Headers:**
```
Authorization: Bearer <teacher_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| class | string | Filter by specific class |
| subject | string | Filter by subject |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "students": [
      {
        "_id": "...",
        "name": "Alice Student",
        "rollNumber": "SA2024001",
        "class": "Class 10A",
        "attendance": { "percentage": 95 },
        "performance": { "averageMarks": 85 }
      }
    ],
    "summary": { "totalStudents": 78, "byClass": { "Class 9A": 40, "Class 10A": 38 } }
  }
}
```

---

### 5.4 Create Assignment
**Endpoint:** `POST /api/teacher/assignments`  
**Access:** Protected (Teacher only)  
**Description:** Create a new assignment/homework

**Headers:**
```
Authorization: Bearer <teacher_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Algebra Problems",
  "description": "Solve exercises from Chapter 5",
  "subject": "Mathematics",
  "classId": "class_id_here",
  "section": "A",
  "dueDate": "2024-03-25",
  "totalMarks": 100,
  "attachments": [
    {
      "name": "assignment.pdf",
      "url": "https://..."
    }
  ]
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Assignment created successfully",
  "data": {
    "assignment": {
      "_id": "...",
      "title": "Algebra Problems",
      "subject": "Mathematics",
      "dueDate": "2024-03-25",
      "status": "active"
    }
  }
}
```

---

### 5.5 Get Assignment Submissions
**Endpoint:** `GET /api/teacher/assignments/:id/submissions`  
**Access:** Protected (Teacher only)  
**Description:** Get all submissions for an assignment

**Headers:**
```
Authorization: Bearer <teacher_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "submissions": [
      {
        "_id": "...",
        "student": { "name": "Alice Student", "rollNumber": "SA2024001" },
        "submittedAt": "2024-03-24T15:30:00Z",
        "status": "submitted",
        "marks": null,
        "feedback": null
      }
    ],
    "summary": { "total": 40, "submitted": 35, "pending": 5 }
  }
}
```

---

### 5.6 Grade Assignment
**Endpoint:** `POST /api/teacher/assignments/:id/grade`  
**Access:** Protected (Teacher only)  
**Description:** Grade a student's assignment

**Headers:**
```
Authorization: Bearer <teacher_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "studentId": "student_id_here",
  "marks": 85,
  "feedback": "Good work! Improve problem 3."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Assignment graded successfully",
  "data": {
    "submission": {
      "_id": "...",
      "student": { "name": "Alice Student" },
      "marks": 85,
      "feedback": "Good work! Improve problem 3.",
      "gradedAt": "2024-03-25T10:00:00Z"
    }
  }
}
```

---

### 5.7 Enter Exam Marks
**Endpoint:** `POST /api/teacher/marks`  
**Access:** Protected (Teacher only)  
**Description:** Enter marks for an exam

**Headers:**
```
Authorization: Bearer <teacher_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "examId": "exam_id_here",
  "subject": "Mathematics",
  "marks": [
    {
      "studentId": "student_id_1",
      "marks": 85,
      "grade": "A",
      "remarks": "Excellent"
    },
    {
      "studentId": "student_id_2",
      "marks": 72,
      "grade": "B",
      "remarks": "Good"
    }
  ]
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Marks entered successfully",
  "data": {
    "exam": {
      "_id": "exam_id_here",
      "name": "Mid Term Exam",
      "subject": "Mathematics",
      "totalStudents": 40,
      "averageMarks": 78.5
    }
  }
}
```

---

## 6. Student APIs

### 6.1 Get Student Dashboard
**Endpoint:** `GET /api/student/dashboard`  
**Access:** Protected (Student only)  
**Description:** Get student's personal dashboard

**Headers:**
```
Authorization: Bearer <student_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "student": {
      "_id": "...",
      "name": "Alice Student",
      "rollNumber": "SA2024001",
      "class": "Class 10A"
    },
    "today": {
      "schedule": [
        { "time": "09:00", "subject": "Mathematics", "room": "101" }
      ],
      "attendance": "present"
    },
    "stats": {
      "attendance": { "percentage": 95, "present": 57, "absent": 3 },
      "academic": { "averageMarks": 82, "rank": 5 }
    },
    "pending": {
      "assignments": 2,
      "fee": false
    }
  }
}
```

---

### 6.2 Get My Attendance
**Endpoint:** `GET /api/student/attendance`  
**Access:** Protected (Student only)  
**Description:** Get personal attendance record

**Headers:**
```
Authorization: Bearer <student_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| month | number | Filter by month (1-12) |
| year | number | Filter by year |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalDays": 60,
      "present": 57,
      "absent": 3,
      "percentage": 95
    },
    "records": [
      {
        "date": "2024-03-18",
        "status": "present",
        "subject": "Mathematics",
        "teacher": "Robert Johnson"
      }
    ]
  }
}
```

---

### 6.3 Get My Assignments
**Endpoint:** `GET /api/student/assignments`  
**Access:** Protected (Student only)  
**Description:** Get assignments for student's class

**Headers:**
```
Authorization: Bearer <student_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | pending, submitted, graded |
| subject | string | Filter by subject |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "assignments": [
      {
        "_id": "...",
        "title": "Algebra Problems",
        "subject": "Mathematics",
        "dueDate": "2024-03-25",
        "status": "pending",
        "teacher": "Robert Johnson"
      }
    ]
  }
}
```

---

### 6.4 Submit Assignment
**Endpoint:** `POST /api/student/assignments/:id/submit`  
**Access:** Protected (Student only)  
**Description:** Submit an assignment

**Headers:**
```
Authorization: Bearer <student_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "content": "My solution...",
  "attachments": [
    {
      "name": "solution.pdf",
      "url": "https://..."
    }
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Assignment submitted successfully",
  "data": {
    "submission": {
      "_id": "...",
      "assignmentId": "...",
      "submittedAt": "2024-03-24T15:30:00Z",
      "status": "submitted"
    }
  }
}
```

---

### 6.5 Get My Results
**Endpoint:** `GET /api/student/results`  
**Access:** Protected (Student only)  
**Description:** Get academic results and report cards

**Headers:**
```
Authorization: Bearer <student_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| examType | string | midterm, final, quiz |
| year | number | Academic year |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "exam": { "name": "Mid Term Exam", "type": "midterm" },
        "subjects": [
          {
            "subject": "Mathematics",
            "marks": 85,
            "grade": "A",
            "maxMarks": 100
          },
          {
            "subject": "Physics",
            "marks": 78,
            "grade": "B",
            "maxMarks": 100
          }
        ],
        "total": { "obtained": 400, "max": 500, "percentage": 80 },
        "rank": 5
      }
    ]
  }
}
```

---

### 6.6 Get Fee Status
**Endpoint:** `GET /api/student/fees`  
**Access:** Protected (Student only)  
**Description:** Get fee payment status

**Headers:**
```
Authorization: Bearer <student_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "feeStructure": {
      "tuition": 5000,
      "transport": 1000,
      "library": 500,
      "total": 6500
    },
    "payments": [
      {
        "month": "March 2024",
        "amount": 6500,
        "status": "paid",
        "paidDate": "2024-03-01"
      }
    ],
    "pending": { "amount": 0, "months": [] }
  }
}
```

---

## 7. Parent APIs

### 7.1 Get Parent Dashboard
**Endpoint:** `GET /api/parent/dashboard`  
**Access:** Protected (Parent only)  
**Description:** Get overview of all children

**Headers:**
```
Authorization: Bearer <parent_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "children": [
      {
        "_id": "...",
        "name": "Alice Student",
        "rollNumber": "SA2024001",
        "class": "Class 10A",
        "attendance": { "percentage": 95 },
        "academic": { "averageMarks": 82 },
        "pendingFee": false
      }
    ]
  }
}
```

---

### 7.2 Get Child Attendance
**Endpoint:** `GET /api/parent/children/:id/attendance`  
**Access:** Protected (Parent only)  
**Description:** Get attendance report for specific child

**Headers:**
```
Authorization: Bearer <parent_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "student": { "name": "Alice Student", "class": "Class 10A" },
    "summary": { "present": 57, "absent": 3, "percentage": 95 },
    "recentAbsences": [
      { "date": "2024-03-10", "reason": "Sick leave" }
    ]
  }
}
```

---

### 7.3 Get Child Results
**Endpoint:** `GET /api/parent/children/:id/results`  
**Access:** Protected (Parent only)  
**Description:** Get academic results for specific child

**Headers:**
```
Authorization: Bearer <parent_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "exam": "Mid Term Exam",
        "percentage": 80,
        "grade": "A",
        "rank": 5
      }
    ]
  }
}
```

---

### 7.4 Get Fee Details
**Endpoint:** `GET /api/parent/fees`  
**Access:** Protected (Parent only)  
**Description:** Get fee details for all children

**Headers:**
```
Authorization: Bearer <parent_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "children": [
      {
        "student": { "name": "Alice Student" },
        "fees": {
          "total": 6500,
          "paid": 6500,
          "pending": 0
        }
      }
    ]
  }
}
```

---

## 8. Accountant APIs

### 8.1 Get Accountant Dashboard
**Endpoint:** `GET /api/accountant/dashboard`  
**Access:** Protected (Accountant only)  
**Description:** Get financial overview

**Headers:**
```
Authorization: Bearer <accountant_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalCollection": 50000,
      "pendingAmount": 15000,
      "todayCollection": 3000
    },
    "recentPayments": [
      {
        "student": { "name": "Alice Student" },
        "amount": 6500,
        "date": "2024-03-18"
      }
    ]
  }
}
```

---

### 8.2 Get Fee Invoices
**Endpoint:** `GET /api/accountant/invoices`  
**Access:** Protected (Accountant only)  
**Description:** Get all fee invoices

**Headers:**
```
Authorization: Bearer <accountant_token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | paid, pending, overdue |
| student | string | Filter by student ID |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "_id": "...",
        "invoiceNumber": "INV2024001",
        "student": { "name": "Alice Student", "rollNumber": "SA2024001" },
        "amount": 6500,
        "dueDate": "2024-03-31",
        "status": "pending"
      }
    ]
  }
}
```

---

### 8.3 Record Payment
**Endpoint:** `POST /api/accountant/payments`  
**Access:** Protected (Accountant only)  
**Description:** Record a fee payment

**Headers:**
```
Authorization: Bearer <accountant_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "studentId": "student_id_here",
  "amount": 6500,
  "month": "March 2024",
  "paymentMethod": "cash",
  "reference": "Receipt #1234"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Payment recorded successfully",
  "data": {
    "payment": {
      "_id": "...",
      "amount": 6500,
      "date": "2024-03-18",
      "receiptNumber": "RCP2024001"
    }
  }
}
```

---

### 8.4 Get Fee Structure
**Endpoint:** `GET /api/accountant/fee-structure`  
**Access:** Protected (Accountant only)  
**Description:** Get fee structure for school

**Headers:**
```
Authorization: Bearer <accountant_token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "feeStructure": {
      "byClass": [
        {
          "class": "Class 10",
          "tuition": 5000,
          "transport": 1000,
          "library": 500,
          "total": 6500
        }
      ]
    }
  }
}
```

---

## 9. Dashboard APIs

### 9.1 Get Role-Based Dashboard
**Endpoint:** `GET /api/dashboard/:role`  
**Access:** Protected  
**Description:** Get dashboard based on user role

**Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Description |
|-----------|-------------|
| role | super-admin, principal, teacher, student, parent, accountant |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "stats": { },
    "recentActivity": [ ],
    "notifications": [ ]
  }
}
```

---

### 9.2 Get Notifications
**Endpoint:** `GET /api/dashboard/notifications`  
**Access:** Protected  
**Description:** Get user notifications

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| unread | boolean | Filter unread only |
| limit | number | Number of notifications |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "...",
        "title": "New Assignment",
        "message": "Mathematics assignment posted",
        "type": "assignment",
        "read": false,
        "createdAt": "2024-03-18T10:00:00Z"
      }
    ],
    "unreadCount": 3
  }
}
```

---

## 10. Notice APIs

### 10.1 Create Notice (Principal)
**Endpoint:** `POST /api/notices`  
**Access:** Protected (Principal/Admin only)  
**Description:** Create a new school notice

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "School Annual Day",
  "content": "Annual day celebration on March 25th",
  "type": "event",
  "priority": "high",
  "targetAudience": ["all"],
  "expiryDate": "2024-03-26",
  "attachments": [ ]
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Notice created successfully",
  "data": {
    "notice": {
      "_id": "...",
      "title": "School Annual Day",
      "type": "event",
      "priority": "high",
      "status": "active"
    }
  }
}
```

---

### 10.2 Get Notices
**Endpoint:** `GET /api/notices`  
**Access:** Protected  
**Description:** Get notices for user

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Filter by notice type |
| priority | string | high, medium, low |
| page | number | Page number |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "notices": [
      {
        "_id": "...",
        "title": "School Annual Day",
        "content": "Annual day celebration on March 25th",
        "priority": "high",
        "createdAt": "2024-03-18",
        "isRead": false
      }
    ]
  }
}
```

---

### 10.3 Mark Notice as Read
**Endpoint:** `PATCH /api/notices/:id/read`  
**Access:** Protected  
**Description:** Mark notice as read

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Notice marked as read"
}
```

---

## 11. Attendance APIs

### 11.1 Get Attendance Statistics
**Endpoint:** `GET /api/dashboard/attendance-stats`  
**Access:** Protected (Principal/Teacher)  
**Description:** Get attendance statistics

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| startDate | date | Start date |
| endDate | date | End date |
| classId | string | Filter by class |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "overall": { "present": 485, "absent": 15, "percentage": 97 },
    "byClass": [ ],
    "byDate": [ ]
  }
}
```

---

## 12. Exam & Result APIs

### 12.1 Create Exam
**Endpoint:** `POST /api/principal/exams`  
**Access:** Protected (Principal only)  
**Description:** Create a new exam

**Headers:**
```
Authorization: Bearer <principal_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Mid Term Examination",
  "type": "midterm",
  "classId": "class_id_here",
  "subjects": ["Mathematics", "Physics", "Chemistry"],
  "startDate": "2024-03-25",
  "endDate": "2024-03-30",
  "maxMarks": 100,
  "gradingScale": "percentage"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "message": "Exam created successfully",
  "data": {
    "exam": {
      "_id": "...",
      "name": "Mid Term Examination",
      "type": "midterm",
      "status": "scheduled"
    }
  }
}
```

---

### 12.2 Get Exam Results
**Endpoint:** `GET /api/principal/exams/:id/results`  
**Access:** Protected (Principal/Teacher)  
**Description:** Get results for an exam

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "exam": { "name": "Mid Term Examination" },
    "results": [
      {
        "student": { "name": "Alice Student", "rollNumber": "SA2024001" },
        "subjects": [
          { "subject": "Mathematics", "marks": 85, "grade": "A" }
        ],
        "total": { "obtained": 400, "max": 500, "percentage": 80 }
      }
    ]
  }
}
```

---

## 13. Fees APIs

### 13.1 Get Fee Reports
**Endpoint:** `GET /api/accountant/reports`  
**Access:** Protected (Accountant/Principal)  
**Description:** Get fee collection reports

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| month | number | Month (1-12) |
| year | number | Year |

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalExpected": 100000,
      "totalCollected": 85000,
      "pending": 15000
    },
    "byClass": [ ],
    "recentPayments": [ ]
  }
}
```

---

## 14. Postman Environment Setup

### Environment Variables

Create a Postman environment with these variables:

| Variable | Initial Value | Description |
|----------|---------------|-------------|
| `base_url` | `http://localhost:3001/api` | API base URL |
| `token` | `` | JWT access token (auto-populated) |
| `refresh_token` | `` | JWT refresh token (auto-populated) |
| `school_code` | `` | Current school code |
| `student_id` | `` | Test student ID |
| `teacher_id` | `` | Test teacher ID |

### Pre-request Script (Auto-attach Token)

Add this to your collection or folder pre-request script:

```javascript
// Auto-attach JWT token to all requests
const token = pm.environment.get("token");
if (token) {
    pm.request.headers.add({
        key: 'Authorization',
        value: `Bearer ${token}`
    });
}
```

### Post-response Script (Save Token after Login)

Add this to the Login request's Tests tab:

```javascript
// Save tokens to environment after login
if (pm.response.code === 200) {
    const jsonData = pm.response.json();
    if (jsonData.data && jsonData.data.token) {
        pm.environment.set("token", jsonData.data.token);
        pm.environment.set("refresh_token", jsonData.data.refreshToken);
        console.log("✅ Tokens saved to environment");
    }
}
```

### Test Script (Validate Response)

Add this to requests for automated testing:

```javascript
// Test status code
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Test response structure
pm.test("Response has success field", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
    pm.expect(jsonData.success).to.be.true;
});

// Test data exists
pm.test("Response contains data", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('data');
});
```

---

## 15. Testing Guide

### Quick Start Testing

1. **Environment Setup**
   - Import the environment variables above
   - Set `base_url` to your API endpoint

2. **Authentication Flow**
   ```
   POST {{base_url}}/auth/login
   Body: { "email": "${SUPER_ADMIN_EMAIL}", "password": "${SUPER_ADMIN_PASSWORD}" }
   → Tokens automatically saved to environment
   ```

3. **Test Protected Endpoints**
   ```
   GET {{base_url}}/super-admin/dashboard
   Header: Authorization: Bearer {{token}}
   ```

### Suggested Test Sequence

1. **Authentication**
   - Login as Super Admin
   - Verify token received
   - Test profile endpoint

2. **Super Admin Flow**
   - Create school with principal
   - Get dashboard statistics
   - List all schools

3. **Principal Flow**
   - Login as Principal
   - Create teachers
   - Create students
   - Create classes

4. **Teacher Flow**
   - Login as Teacher
   - Mark attendance
   - Create assignment
   - Enter marks

5. **Student Flow**
   - Login as Student
   - View assignments
   - Submit assignment
   - Check results

6. **Parent Flow**
   - Login as Parent
   - View child progress
   - Check fee status

### Common Testing Scenarios

#### Test Error Handling
```
// Invalid credentials
POST {{base_url}}/auth/login
Body: { "email": "wrong@email.com", "password": "wrong" }
→ Expect 401 Unauthorized

// Missing token
GET {{base_url}}/super-admin/dashboard
→ Expect 401 Unauthorized

// Invalid token
GET {{base_url}}/super-admin/dashboard
Header: Authorization: Bearer invalid_token
→ Expect 401 Unauthorized

// Forbidden access (Teacher accessing Super Admin)
GET {{base_url}}/super-admin/dashboard
Header: Authorization: Bearer <teacher_token>
→ Expect 403 Forbidden
```

#### Test Validation
```
// Missing required fields
POST {{base_url}}/auth/register
Body: { "email": "test@test.com" }
→ Expect 400 Bad Request

// Invalid email format
POST {{base_url}}/auth/register
Body: { "email": "invalid-email", "password": "123" }
→ Expect 400 Bad Request
```

---

## 📎 Additional Notes

### Rate Limiting
- 100 requests per 15 minutes per IP
- Exceeding limit returns 429 Too Many Requests

### Pagination
All list endpoints support pagination:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10, max: 100)

### Date Format
All dates use ISO 8601 format: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ssZ`

### File Uploads
- Max file size: 10MB
- Supported formats: PDF, JPG, PNG
- Use `multipart/form-data` for uploads

### Support
For issues or questions, contact: support@smartcampus.com

---

**© 2024 Smart School Management System. All rights reserved.**
