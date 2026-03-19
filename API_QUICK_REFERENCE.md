# 📚 Smart Campus Backend - API Quick Reference

## Base URL
```
Production: http://localhost:3001/api
```

## Authentication
All protected endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

---

## 🔐 Authentication APIs

### Login (Universal)
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "role": "student" // optional: super_admin, principal, teacher, student, parent
}

Response: { success: true, token: "jwt_token", user: {...} }
```

### Get Profile
```http
GET /api/auth/profile
Authorization: Bearer <token>

Response: { success: true, user: {...} }
```

### Change Password
```http
PUT /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

---

## 👑 Super Admin APIs

### Create School
```http
POST /api/super-admin/schools
Authorization: Bearer <super_admin_token>
Content-Type: application/json

{
  "name": "ABC School",
  "email": "school@example.com",
  "phone": "1234567890",
  "address": "School Address",
  "subscriptionPlan": "premium",
  "subscriptionEndDate": "2025-12-31"
}
```

### Get All Schools
```http
GET /api/super-admin/schools
Authorization: Bearer <super_admin_token>

Response: { success: true, schools: [...] }
```

### Get Dashboard
```http
GET /api/super-admin/dashboard
Authorization: Bearer <super_admin_token>

Response: { success: true, data: {...} }
```

---

## 🏫 Principal APIs

### Create Teacher
```http
POST /api/principal/teachers
Authorization: Bearer <principal_token>
Content-Type: application/json

{
  "name": "John Doe",
  "email": "teacher@example.com",
  "phone": "1234567890",
  "subjects": ["Math", "Science"],
  "qualification": "M.Sc"
}
```

### Create Student
```http
POST /api/principal/students
Authorization: Bearer <principal_token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "student@example.com",
  "rollNumber": "2024001",
  "class": "class_id",
  "section": "section_id",
  "dateOfBirth": "2010-01-01"
}
```

### Create Class
```http
POST /api/principal/classes
Authorization: Bearer <principal_token>
Content-Type: application/json

{
  "name": "Class 10",
  "academicSession": "session_id"
}
```

### Create Routine
```http
POST /api/principal/routine/weekly
Authorization: Bearer <principal_token>
Content-Type: application/json

{
  "classId": "class_id",
  "sectionId": "section_id",
  "academicSessionId": "session_id",
  "schedule": [
    {
      "day": "Monday",
      "periods": [
        {
          "subject": "subject_id",
          "teacher": "teacher_id",
          "startTime": "09:00",
          "endTime": "10:00",
          "room": "room_id"
        }
      ]
    }
  ]
}
```

---

## 👨‍🏫 Teacher APIs

### Mark Attendance
```http
POST /api/teacher/attendance/mark
Authorization: Bearer <teacher_token>
Content-Type: application/json

{
  "classId": "class_id",
  "sectionId": "section_id",
  "date": "2024-03-19",
  "attendance": [
    {
      "studentId": "student_id",
      "status": "present" // present, absent, late, excused
    }
  ]
}
```

### Enter Marks
```http
POST /api/teacher/marks/enter
Authorization: Bearer <teacher_token>
Content-Type: application/json

{
  "examId": "exam_id",
  "subjectId": "subject_id",
  "marks": [
    {
      "studentId": "student_id",
      "obtainedMarks": 85,
      "totalMarks": 100
    }
  ]
}
```

### Get Dashboard
```http
GET /api/teacher/dashboard
Authorization: Bearer <teacher_token>

Response: { success: true, data: {...} }
```

---

## 🎓 Student APIs

### Get Dashboard
```http
GET /api/student/dashboard
Authorization: Bearer <student_token>

Response: { success: true, data: {...} }
```

### Get Attendance
```http
GET /api/student/attendance
Authorization: Bearer <student_token>

Response: { success: true, attendance: [...] }
```

### Get Results
```http
GET /api/student/results
Authorization: Bearer <student_token>

Response: { success: true, results: [...] }
```

### Get Routine
```http
GET /api/student/routine
Authorization: Bearer <student_token>

Response: { success: true, routine: {...} }
```

### Get Fees
```http
GET /api/student/fees
Authorization: Bearer <student_token>

Response: { success: true, fees: {...} }
```

---

## 👨‍👩‍👧 Parent APIs

### Get Children
```http
GET /api/parent/children
Authorization: Bearer <parent_token>

Response: { success: true, children: [...] }
```

### Get Child Attendance
```http
GET /api/parent/attendance/:studentId
Authorization: Bearer <parent_token>

Response: { success: true, attendance: [...] }
```

### Get Child Results
```http
GET /api/parent/results/:studentId
Authorization: Bearer <parent_token>

Response: { success: true, results: [...] }
```

---

## 💰 Fee Management APIs

### Create Fee Structure
```http
POST /api/fees/structure
Authorization: Bearer <principal_token>
Content-Type: application/json

{
  "name": "Tuition Fee",
  "amount": 5000,
  "class": "class_id",
  "frequency": "monthly",
  "dueDate": "2024-04-01"
}
```

### Collect Payment
```http
POST /api/fees/collect
Authorization: Bearer <accountant_token>
Content-Type: application/json

{
  "studentId": "student_id",
  "amount": 5000,
  "paymentMethod": "cash",
  "transactionId": "TXN123"
}
```

### Get Due Fees
```http
GET /api/fees/due-list
Authorization: Bearer <accountant_token>

Response: { success: true, dueFees: [...] }
```

---

## 📢 Notice APIs

### Create Notice
```http
POST /api/notices
Authorization: Bearer <principal_token>
Content-Type: application/json

{
  "title": "Important Notice",
  "content": "Notice content here",
  "priority": "high",
  "targetAudience": ["student", "teacher"],
  "expiryDate": "2024-04-30"
}
```

### Get Notices
```http
GET /api/notices
Authorization: Bearer <token>

Response: { success: true, notices: [...] }
```

---

## 📊 Dashboard APIs

### Super Admin Dashboard
```http
GET /api/dashboard/super-admin
Authorization: Bearer <super_admin_token>
```

### Principal Dashboard
```http
GET /api/dashboard/principal
Authorization: Bearer <principal_token>
```

### Teacher Dashboard
```http
GET /api/dashboard/teacher
Authorization: Bearer <teacher_token>
```

### Student Dashboard
```http
GET /api/dashboard/student
Authorization: Bearer <student_token>
```

---

## 🤖 AI APIs

### Analyze Student Performance
```http
POST /api/ai/analyze-performance
Authorization: Bearer <teacher_token>
Content-Type: application/json

{
  "studentId": "student_id",
  "timeframe": "semester"
}
```

### Generate Exam Questions
```http
POST /api/ai/generate-questions
Authorization: Bearer <teacher_token>
Content-Type: application/json

{
  "subject": "Mathematics",
  "topic": "Algebra",
  "difficulty": "medium",
  "count": 10
}
```

### Get AI Status
```http
GET /api/ai/status
Authorization: Bearer <principal_token>

Response: { success: true, data: {...} }
```

---

## 📝 Common Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {...}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error"
}
```

### Validation Error
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

---

## 🔑 Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## 🛡️ Security Notes

1. **Always use HTTPS in production**
2. **Store JWT tokens securely** (httpOnly cookies recommended)
3. **Never expose sensitive data** in responses
4. **Implement rate limiting** on client side
5. **Validate all inputs** before sending
6. **Handle errors gracefully**

---

## 📞 Support

For detailed API documentation, refer to:
- `COMPREHENSIVE_API_ANALYSIS_REPORT.md`
- `scripts/comprehensive-api-test.js`

---

**Last Updated:** 2026-03-19  
**Version:** 5.0.0
