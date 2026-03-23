# Smart Campus API Documentation

## Production Base URL
```
https://smart-campas-backend.onrender.com/api
```

## Authentication Method
All protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <token>
```

## Common Headers
```javascript
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <token>"
}
```

---

## Authentication APIs

### POST /auth/login
**Purpose:** User login for all roles

**Request Body:**
```json
{
  "email": "user@school.edu",
  "password": "Password@123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "data": {
    "user": {
      "_id": "...",
      "name": "User Name",
      "email": "user@school.edu",
      "role": "principal|teacher|student|parent|super_admin",
      "schoolCode": "SCH001"
    }
  }
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

## Dashboard APIs

### GET /dashboard/super-admin
**Purpose:** Get Super Admin dashboard statistics
- **Auth:** Bearer token (super_admin role)
- **Method:** GET

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalSchools": 11,
    "activeSchools": 0,
    "totalUsers": 15,
    "totalPrincipals": 8,
    "totalTeachers": 3,
    "totalStudents": 3
  }
}
```

### GET /dashboard/principal
**Purpose:** Get Principal dashboard statistics
- **Auth:** Bearer token (principal role)
- **Method:** GET

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "totalTeachers": 1,
    "totalStudents": 1,
    "totalClasses": 1,
    "totalSubjects": 1
  }
}
```

### GET /dashboard/teacher
**Purpose:** Get Teacher dashboard data
- **Auth:** Bearer token (teacher role)
- **Method:** GET

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "teacher": {
      "name": "Mr. Khan",
      "email": "khan@vis.edu",
      "schoolCode": "VIS001"
    }
  }
}
```

### GET /dashboard/student
**Purpose:** Get Student dashboard data
- **Auth:** Bearer token (student role)
- **Method:** GET

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "student": {
      "name": "Mahmud",
      "email": "mahmud@student.vis.edu",
      "schoolCode": "VIS001"
    }
  }
}
```

---

## Super Admin APIs

### GET /super-admin/schools
**Purpose:** Get all schools
- **Auth:** Bearer token (super_admin role)
- **Method:** GET

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "schools": [
      {
        "_id": "...",
        "schoolName": "Victory International School",
        "schoolCode": "VIS001",
        "email": "admin@vis.edu",
        "isActive": true,
        "subscription": {
          "plan": "trial",
          "status": "active"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 11,
      "pages": 2
    }
  }
}
```

---

## Principal APIs

### GET /principal/classes
**Purpose:** Get all classes for the school
- **Auth:** Bearer token (principal role)
- **Method:** GET

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "schoolCode": "VIS001",
      "className": "Class Six",
      "section": "A",
      "classLevel": 6,
      "capacity": 40,
      "currentStudents": 0,
      "isActive": true
    }
  ]
}
```

### GET /principal/subjects
**Purpose:** Get all subjects
- **Auth:** Bearer token (principal role)
- **Method:** GET

### GET /principal/teachers
**Purpose:** Get all teachers
- **Auth:** Bearer token (principal role)
- **Method:** GET

### GET /principal/students
**Purpose:** Get all students
- **Auth:** Bearer token (principal role)
- **Method:** GET

---

## Notice APIs

### GET /notices
**Purpose:** Get all notices
- **Auth:** Bearer token
- **Method:** GET

**Success Response (200):**
```json
{
  "notices": [],
  "total": 0,
  "activeCount": 0,
  "totalPages": 0,
  "currentPage": 1
}
```

---

## Fees APIs

### GET /fees
**Purpose:** Get all fee records
- **Auth:** Bearer token
- **Method:** GET

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "fees": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 0,
      "pages": 0
    }
  }
}
```

---

## Routine APIs

### GET /routines
**Purpose:** Get all routines
- **Auth:** Bearer token
- **Method:** GET

**Success Response (200):**
```json
{
  "success": true,
  "data": []
}
```

---

## Exam Schedule APIs

### GET /exam-schedules
**Purpose:** Get all exam schedules
- **Auth:** Bearer token
- **Method:** GET

**Success Response (200):**
```json
{
  "success": true,
  "data": []
}
```

---

## Leave APIs

### GET /leave
**Purpose:** Get all leave requests
- **Auth:** Bearer token
- **Method:** GET

**Success Response (200):**
```json
{
  "success": true,
  "data": []
}
```

---

## Notification APIs

### GET /notifications
**Purpose:** Get all notifications
- **Auth:** Bearer token
- **Method:** GET

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "notifications": [],
    "unreadCount": 0,
    "hasMore": false
  }
}
```

---

## Attendance APIs

### GET /attendance/report
**Purpose:** Get attendance report
- **Auth:** Bearer token
- **Method:** GET
- **Query Params:** class, section (required)

**Response (needs class and section parameters):**
```json
{
  "message": "Class and section are required"
}
```

---

## Teacher Assignment APIs

### GET /teacher-assignments
**Purpose:** Get teacher subject assignments
- **Auth:** Bearer token
- **Method:** GET

**Success Response (200):**
```json
{
  "success": true,
  "data": []
}
```

---

## Common Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Route not found",
  "path": "/api/endpoint",
  "method": "GET",
  "availableEndpoints": { ... }
}
```

---

## Known Issues

1. **Teacher/Student/Results Routes (404):** 
   - The following routes are returning 404 and need investigation:
     - `/api/teacher/*`
     - `/api/student/*`
     - `/api/results/*`
   - These routes work locally but return 404 on production deployment.

---

## Role-Based Access Control

| Role | Dashboard | Schools | Classes | Teachers | Students | Notices | Fees | Routine |
|------|-----------|---------|---------|----------|----------|--------|------|---------|
| super_admin | ✓ | ✓ | - | - | - | - | - | - |
| principal | ✓ | - | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| teacher | ✓ | - | View | - | View | ✓ | - | View |
| student | ✓ | - | - | - | - | View | View | View |
| parent | ✓ | - | - | - | View | View | View | - |

---

## Frontend Integration Notes

1. **Token Handling:**
   - Store token in localStorage or secure storage
   - Include token in Authorization header for all protected requests
   - Handle token refresh on 401 responses

2. **Error Handling:**
   - Check `success` field in response
   - Display user-friendly error messages from `message` field
   - Handle 401 (unauthorized) by redirecting to login

3. **Pagination:**
   - Many list endpoints support `page` and `limit` query parameters
   - Check `pagination` object in response for total pages

4. **Role-Based UI:**
   - Check user role from login response
   - Show/hide features based on role permissions
