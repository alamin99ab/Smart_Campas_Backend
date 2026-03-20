# Smart Campus Backend - System Architecture

## Overview
This document describes the complete architecture of the Smart Campus SaaS backend system, including role-based access control, workflow design, and core features.

---

## Role-Based Access Control (RBAC)

### 1. Super Admin
**Permissions:**
- Platform-level control
- Create and manage schools
- Assign principal credentials to schools
- Monitor all schools' analytics
- View subscription status and income reports
- Access global settings

**Routes:**
- `/api/super-admin/*` - Full access
- `/api/schools/*` - Create/manage schools

### 2. Principal
**Permissions:**
- Full control of their assigned school
- Manage school setup (classes, sections, subjects)
- Create teachers, students, parents
- Approve and publish results
- Manage and adjust routines (including auto-generate)
- Publish notices
- View all school analytics
- Approve fee structures

**Routes:**
- `/api/principal/*` - Full school control
- `/api/routine/*` - Create, update, publish
- `/api/results/*` - View all, publish results

### 3. Teacher
**Permissions:**
- Manage assigned classes and subjects
- Take attendance for assigned classes
- Enter and update marks (draft mode)
- Create class tests/exams
- Create assignments
- View student academic progress
- Cannot publish final results
- Cannot access another school's data

**Routes:**
- `/api/teacher/*` - Limited to assigned subjects/classes
- `/api/results/*` - Create draft, update own results
- `/api/attendance/*` - Take attendance for assigned classes

### 4. Student
**Permissions:**
- View own profile
- View own attendance
- View own routine
- View own assignments
- View published results
- View notices

**Routes:**
- `/api/dashboard/student` - Own dashboard
- `/api/attendance/*` - Own attendance
- `/api/routine/*` - Own routine
- `/api/results/*` - Own published results only

### 5. Parent
**Permissions:**
- Monitor child's attendance
- Monitor child's results (published only)
- View notices
- View fee information

**Routes:**
- `/api/dashboard/parent` - Child's dashboard
- `/api/results/*` - Child's published results
- `/api/attendance/*` - Child's attendance

### 6. Accountant
**Permissions:**
- Manage fee structure
- Create invoices
- Record payments
- Generate due reports
- School-level finance reporting

**Routes:**
- `/api/fees/*` - Full fee management
- `/api/fee-structure/*` - Fee structure management

### 7. Admin (School-level)
**Permissions:**
- Similar to Principal but usually for larger schools
- Can be assigned by Super Admin

---

## Core Workflows

### 1. Result Publishing Flow (Principal Approval)

```
Teacher creates result (DRAFT)
    ↓
Teacher updates marks (while in draft)
    ↓
Principal reviews marks
    ↓
Principal publishes result (becomes visible to students/parents)
    ↓
Students/Parents can now view results
```

**API Endpoints:**
- `POST /api/results` - Teacher creates draft result
- `PUT /api/results/:id` - Teacher updates marks (draft)
- `PUT /api/results/:id/publish` - Principal publishes result
- `PUT /api/results/publish` - Principal bulk publishes results

### 2. Dynamic Routine Generation

```
Principal creates Teacher
    ↓
Principal assigns Subjects to Teacher
    ↓
Principal calls auto-generate routine
    ↓
System creates routine based on:
    - Teacher subject assignments
    - Available periods
    - Available days
    - Conflict-free constraints
    ↓
Principal reviews and adjusts (manual override)
    ↓
Principal publishes routine
    ↓
Students/Teachers notified
```

**API Endpoints:**
- `POST /api/routine/auto-generate` - Auto-generate based on teacher subjects
- `POST /api/routine` - Manual creation
- `PUT /api/routine/:id/publish` - Principal publishes

### 3. Attendance Flow

```
Teacher logs in
    ↓
System shows assigned classes/subjects
    ↓
Teacher selects class and date
    ↓
Teacher marks attendance (Present/Absent/Late/Excused)
    ↓
Attendance saved
    ↓
Parents notified (if configured)
```

### 4. Fee Management Flow

```
Accountant creates fee structure
    ↓
Principal approves fee structure
    ↓
System generates invoices for students
    ↓
Parents view and pay fees
    ↓
Accountant records payments
    ↓
Due reports generated
```

---

## API Response Standardization

All API responses follow this format:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error description"
}
```

---

## Environment Variables

### Required Variables
| Variable | Description |
|----------|-------------|
| `PORT` | Server port (Render sets this) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Refresh token secret |
| `SUPER_ADMIN_EMAIL` | Super admin email |
| `SUPER_ADMIN_PASSWORD` | Super admin password |

### Optional Variables
| Variable | Description |
|----------|-------------|
| `FRONTEND_URL` | Frontend URL for CORS |
| `ALLOWED_ORIGINS` | Allowed CORS origins |
| `EMAIL_HOST` | SMTP server |
| `EMAIL_PORT` | SMTP port |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASSWORD` | SMTP password |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `OPENAI_API_KEY` | OpenAI API key for AI features |

---

## Database Models

### User Model
- `name`, `email`, `password`, `role`
- `schoolId`, `schoolCode`, `schoolName`
- `isActive`, `isApproved`
- `role`: super_admin, admin, principal, teacher, student, parent, accountant

### School Model
- `schoolName`, `schoolCode`, `schoolType`
- `subscription` (plan, status)
- `features` (routine, attendance, exam, fee, notice, etc.)
- `academicSettings` (currentSession, workingDays, etc.)

### Class Model
- `className`, `section`
- `subjects` (with teacher assignments)
- `classTeacher`

### Subject Model
- `subjectName`, `subjectCode`, `className`
- `teachers` (array with teacherId, isActive)

### Routine Model
- `studentClass`, `section`, `day`, `periods`
- `academicYear`, `semester`
- `isPublished`, `isActive`

### Result Model
- `studentId`, `examName`, `subjects`
- `totalMarks`, `gpa`
- `isPublished`, `status` (draft, pending_review, published)
- `createdBy`, `publishedBy`

### Attendance Model
- `studentId`, `classId`, `subjectId`, `teacherId`
- `date`, `attendance` (array of student status)

---

## Security Features

1. **JWT Authentication** - Token-based auth with expiry
2. **Role-Based Access Control** - Middleware-based enforcement
3. **Multi-Tenant Isolation** - School-based data separation
4. **Input Validation** - express-validator
5. **SQL/NoSQL Injection Prevention** - mongo-sanitize
6. **Rate Limiting** - express-rate-limit
7. **Helmet** - Security headers
8. **Environment Variable Protection** - No hardcoded secrets

---

## Testing Credentials

### Super Admin
- Email: alamin-admin@pandait.com
- Password: pandaitalaminn

### Test School (VIS001)
- Principal: sultana@vis.edu / Sultana@123
- Teacher: khan@vis.edu / Teacher@123
- Student: mahmud@student.vis.edu / Student@123

---

## Version History

- **5.0.0** - Complete overhaul with RBAC, dynamic routines, result publishing workflow
- **4.x** - Previous versions

---

## Deployment

### Render Deployment
1. Push code to GitHub
2. Connect GitHub to Render
3. Set environment variables in Render dashboard
4. Deploy automatically

### Required Environment Variables in Render
```
PORT=10000 (or auto-assigned)
MONGO_URI=<your-mongodb-uri>
JWT_SECRET=<min-32-chars>
JWT_REFRESH_SECRET=<min-32-chars>
SUPER_ADMIN_EMAIL=<email>
SUPER_ADMIN_PASSWORD=<password>
```

---

## Support

For issues or questions, please refer to the API documentation or contact the development team.
