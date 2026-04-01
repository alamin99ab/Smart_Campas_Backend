# SYSTEM ARCHITECTURE

## Executive Summary
Smart Campus is a modern, multi-tenant school management SaaS platform with role-based access (Super Admin, Principal, Teacher, Student, Parent, Accountant). Backend is Node.js + Express + MongoDB with a React/TypeScript frontend in `smart-campus-connect`. Security is hardened with JWT auth, bcrypt, RBAC, tenant isolation, rate limiting, and robust startup checks.

## High-Level Architecture
- Frontend: React + Vite, using `/src/pages`, stores in `src/stores/authStore`, API layer via `fetch`/`axios`.
- Backend: Express app in `index.js`; modular routes in `routes/*`; controllers in `controllers/*`; data models in `models/*`; middleware in `middleware/*`.
- Database: MongoDB with Mongoose. Models include User, School, Notice, Class, Subject, Routine, Fee, Attendance, Exam, Result, etc.
- Authentication: `routes/auth.js`, `controllers/authController.js`, `middleware/authMiddleware.js`.
- Tenant isolation: `middleware/multiTenant.js` (ensureTenantIsolation, addSchoolScope, checkFeatureAccess).

## Deployment Architecture
- Environment variables (via `.env`/Render) control `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `JWT_SECRET`, `NODE_ENV`, `MONGO_URI`.
- `index.js` fail-fast in production on DB failure (process.exit). Non-prod fallback uses mock DB in test mode.
- Auto Admin Setup endpoints are environment-based only.

## Security
- Authentication: JWT with 7d expiry, refresh tokens stored in user sessions.
- Password policy: enforced on registration, teacher/student creations, reset via regex in `authController` and principal controls.
- Access control via `middleware/authMiddleware` and `authorize` roles.
- Tenant scope enforced via `ensureTenantIsolation` and `addSchoolScope`.
- Global notices with `isGlobal=true` and school-specific with `schoolId`.
- Rate limiting on login endpoints.
- No public principal/super_admin creation.

## Workflows
- Super Admin: login, create school+principal (transactional), manage schools and users.
- Principal: login + educational setup (classes, subjects, teachers, students, routines, exams, fees, notices).
- Teacher: attendance, marks entry via proper controllers and permission checks.
- Student/Parent/Accountant: data retrieval and permissible actions.

## Critical Improvements Delivered
- Missing public register route `POST /api/auth/register` added.
- Notice management now uses schoolId properly for queries and fetches global as fallback.
- DB startup now fails in production when DB is unavailable.
- School creation wrapped in transaction.
- Tenant scoping strongly enforced in mutation operations.
