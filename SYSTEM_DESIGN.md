# SYSTEM DESIGN

## 1. User Roles
- `super_admin`: environment-based login, manages all schools and platform settings.
- `principal`: manages one school (class/subject/teacher/student/routine/exam/fee/notice).
- `teacher`: daily operations (attendance, marks).
- `student`: view routines, results, attendance, fees, notices.
- `parent`: view child data, attendance, results.
- `accountant`: fee collections and reports.

## 2. Data Model Strategy
- `User`: contains `role`, `schoolId`, `schoolCode`, `schoolName`, `email`, `password`, sessions, 2FA flags.
- `School`: contains `schoolCode` unique, subscription status, principal reference, features, isActive.
- `Notice`: global or per-school (`schoolId`, `isGlobal`), target roles/classes/sections.
- Ancillary models: `Class`, `Subject`, `Routine`, `AcademicSession`, `Attendance`, `Exam`, `Result`, `Fee`, `PaymentHistory`.

## 3. API Architecture
- Route groups under `/api/auth`, `/api/super-admin`, `/api/principal`, `/api/teacher`, `/api/student`, `/api/parent`, `/api/accountant`, plus modules for `/api/attendance`, `/api/routines`, `/api/exams`, etc.
- Consistent response shape: `success`, `message`, `data` (some existing endpoints match and most do now).
- Service layer exists partially via utilities: `utils/emailService`, `utils/smsService`, `services/passwordResetService`.

## 4. Multi-Tenant Isolation
- Tenant identity derived from JWT (user.schoolCode).
- Middleware `ensureTenantIsolation` verifies active school and attaches `req.tenant` context.
- `addSchoolScope` forcing tenant values on mutation operations and query params, clearing client-provided fields.
- Role-based `authorize()` guards per route.

## 5. Security Design
- Password hashing: bcrypt, with pre-save hook in User model.
- Password policy: strong regex checks in registration and principal creation endpoints.
- Account lockout after failed login attempts (5 attempts -> blocked).
- Rate limit login route to 10 attempts per 5 minutes.
- Forgot password returns non-enumerative response.
- DB fail-fast in production.

## 6. Workflow Design
- School onboarding: Super Admin create school and principal transactionally.
- Academic setup: Principal create sessions, classes, sections, subjects, routines.
- Attendance: Teacher marks attendance via `attendanceController`.
- Results: Exams and result publishing via `examController` and `resultController`.
- Fees: accountant pattern through `feeController`.
- Notices: `noticeController` with filtering by school, role, and global scope.

## 7. Deployment Notes
- Keep environment secrets strong (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `SUPER_ADMIN_PASSWORD`).
- `NODE_ENV=production` triggers hard-failure when DB not available.
- Use connection retries at hosting level with health checks.

## 8. Remaining Manual Validation
- Run full Cypress/Playwright E2E with frontend.
- Visual test for all UI flows (button, forms, nav, error states).
- Add integration tests for cross-school isolation and tenant mutation behavior.
