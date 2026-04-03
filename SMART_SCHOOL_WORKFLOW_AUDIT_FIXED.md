# Smart Campus Workflow Fixes (2026-04-03, Asia/Dhaka)

## What was broken (from live audit)
- Class/subject validation failures returned 500 instead of 400.
- Parent management endpoints missing under principal scope.
- `/api/attendance` and `/api/analytics` root paths returned 404 despite being advertised.
- Student onboarding blocked by `isApproved=false`.
- No clear teacher ⇄ subject ⇄ class assignment flow.
- Responses inconsistent (`success` missing on notices/results).

## Key fixes (backend)
- **Validation → 400**: Principal class/subject creation now validates required fields and converts Mongoose validation/duplicate errors to HTTP 400 with clear messages.
- **Parents API**: Added `POST/GET /api/principal/parents` to create and list parents; links guardian info to students.
- **Attendance/Analytics discovery**: Root `GET /api/attendance` and `GET /api/analytics` now return 200 with available endpoints; analytics overview reachable at `/api/analytics`.
- **Student onboarding**: Students created by principal/super-admin are auto-approved; Student collection mirror is created for analytics/parent dashboards.
- **Teacher assignment**: New `POST /api/principal/classes/:classId/subjects/assign` to map teacher ↔ subject ↔ class with periods/week.
- **Response shape**: Notices and Results now return `success/message/data` while keeping legacy fields for compatibility.

## Workflow alignment (expected order)
1) Principal creates Class (and optional Section/Academic Session).  
2) Principal creates Subjects for the class.  
3) Principal adds Students to the class (auto-approved, mirrored to Student collection).  
4) Principal adds Teachers.  
5) Principal assigns Teacher ↔ Subject ↔ Class via new assignment endpoint.  
6) Routine/Timetable can use class.subjects assignments (no double booking logic changed).  
7) Daily ops: attendance (student), notices, fees, exams/results, analytics, parent monitoring now have reachable routes.  
8) Parent creation/listing available for linking guardians.

## Frontend notes
- Parents page now backed by real `/principal/parents` data.
- Notices/Results responses keep legacy fields plus standardized envelope; existing UI remains compatible.

## Outstanding items to monitor
- Legacy Student-based features (promotion/results) now receive mirrored Student docs, but bulk-import flows were not altered.
- Routine collision detection logic unchanged; relies on existing advancedRoutineController.

## Current verdict
⚠️ Minor Issues Remaining — core blockers from the live audit resolved; continue regression test across promotion/results and routine collisions.
