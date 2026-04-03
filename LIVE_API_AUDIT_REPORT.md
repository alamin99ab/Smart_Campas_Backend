# LIVE API Audit Report — Smart Campus Backend  
Run date: 2026-04-03 (Asia/Dhaka)

## Environment
- Base URL: `https://smart-campas-backend.onrender.com/api`
- Auth: JWT via `/auth/login`  
  - Tokens obtained: super_admin, principal, teacher, accountant (redacted)  
  - Student login blocked pending approval
- Test data: created `QA Automation School (QA7115)` with principal/teacher/student/accountant test users.

## Coverage
- Total live requests: 41  
- Results: ✅ 33 passed | ⚠️ 2 warnings | ❌ 6 failed

## Endpoint Results
| Result | Method | Route | Auth | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| ✅ | GET | /health | none | 200 | Service alive, version 5.0.0 |
| ✅ | GET | / | none | 200 | Endpoint catalog returned |
| ✅ | POST | /auth/login | none | 200 | Super admin login ok; role super_admin |
| ✅ | POST | /auth/login | none | 401 | Invalid password rejected |
| ✅ | POST | /auth/login | none | 401 | Invalid email rejected |
| ✅ | POST | /auth/login | none | 400 | Malformed body handled |
| ✅ | GET | /super-admin/schools | super_admin | 200 | Lists schools |
| ✅ | GET | /super-admin/dashboard | super_admin | 200 | Counts returned |
| ✅ | GET | /super-admin/statistics | super_admin | 200 | Same as dashboard |
| ✅ | POST | /super-admin/schools | super_admin | 200 | Created QA7115 and principal |
| ✅ | POST | /super-admin/users | super_admin | 200 | Created teacher (QA7115) |
| ✅ | POST | /super-admin/users | super_admin | 200 | Created accountant (QA7115) |
| ✅ | GET | /super-admin/schools | invalid token | 401 | Proper auth failure |
| ✅ | GET | /super-admin/schools | missing token | 401 | Proper auth failure |
| ✅ | POST | /auth/login | none | 200 | Principal login ok |
| ✅ | GET | /principal/dashboard | principal | 200 | Stats returned |
| ✅ | GET | /principal/classes | principal | 200 | Empty list pre-create |
| ❌ | POST | /principal/classes | principal | 500 | Validation errors surface as 500 (should be 400) |
| ✅ | POST | /principal/classes | principal | 200 | Class created after valid payload |
| ✅ | GET | /principal/teachers | principal | 200 | Teacher listed |
| ✅ | GET | /principal/students | principal | 200 | Empty before create |
| ⚠️ | POST | /principal/students | principal | 400 | Validation error on missing fields (expected) |
| ✅ | POST | /principal/students | principal | 200 | Student created |
| ✅ | GET | /principal/subjects | principal | 200 | Empty before create |
| ❌ | POST | /principal/subjects | principal | 500 | Validation errors surface as 500 (should be 400) |
| ✅ | POST | /principal/subjects | principal | 200 | Subject created |
| ❌ | GET | /principal/parents | principal | 404 | Route missing |
| ❌ | POST | /principal/parents | principal | 404 | Route missing |
| ✅ | POST | /auth/login | none | 200 | Teacher login ok |
| ✅ | GET | /teacher/dashboard | teacher | 200 | Works |
| ✅ | GET | /super-admin/schools | teacher | 403 | RBAC enforced |
| ⚠️ | POST | /auth/login | none | 403 | Student blocked: “Account pending approval” |
| ✅ | POST | /auth/login | none | 200 | Accountant login ok |
| ✅ | GET | /accountant/dashboard | accountant | 200 | Works |
| ✅ | GET | /notices | principal | 200 | Empty list; no success flag |
| ✅ | GET | /routines | principal | 200 | Empty list |
| ❌ | GET | /attendance | principal | 404 | Route not implemented |
| ✅ | GET | /fees | principal | 200 | Empty list |
| ✅ | GET | /results | principal | 200 | Empty list |
| ❌ | GET | /analytics | principal | 404 | Route not implemented |

## Workflow Validation
- **Super Admin:** Login, stats, create school/user (teacher/accountant) succeed. Validation for missing schoolCode returns 400.  
- **Principal:** Login, dashboard, teachers, students, subjects ok; can create classes/subjects/students. Parent routes 404. Validation failures on classes/subjects return 500.  
- **Teacher:** Login/dashboard ok; super-admin routes correctly 403.  
- **Student:** Login blocked pending approval; approval action not exposed/tested.  
- **Parent:** `/principal/parents` absent (404).  
- **Accountant:** Login/dashboard ok.  
- **Feature modules:** Notices, Routines, Fees, Results return 200 with empty data. Attendance and Analytics advertised but 404.

## Security / RBAC
- Invalid token → 401 (protected routes)  
- Missing token → 401  
- Wrong role (teacher on super-admin) → 403  
- Tokens scoped by role/schoolCode; no cross-school leakage observed in responses.

## Issues Found
1) Validation errors return 500 on `/principal/classes` and `/principal/subjects` (should be 400).  
   - Severity: Medium — user input can crash endpoint; fix validation error handling.  
2) Parent management routes missing (`GET/POST /principal/parents` 404).  
   - Severity: High — parent workflow unavailable.  
3) Attendance endpoint missing (`GET /attendance` 404) though advertised.  
   - Severity: High — core daily operations unavailable.  
4) Analytics endpoint missing (`GET /analytics` 404) though advertised.  
   - Severity: Medium — reporting unavailable.  
5) Student login blocked: “Account pending approval” and no approval path tested.  
   - Severity: Medium — onboarding blocked; document or expose approval action.  
6) Response shape inconsistency: `/notices` and `/results` lack `success` wrapper while others include it.  
   - Severity: Low — contract inconsistency.

## Final Verdict
❌ Not Ready — advertised modules missing and validation paths returning 500.

## Recommended Next Steps
1) Return 400 with field-level details on class/subject validation errors.  
2) Implement or expose parent, attendance, and analytics endpoints (or remove from discovery until ready).  
3) Provide/document student approval flow so student login can complete post-creation.  
4) Align response envelope across endpoints (`success/message/data`).  
5) Re-run this audit after fixes to confirm status codes and RBAC.  
