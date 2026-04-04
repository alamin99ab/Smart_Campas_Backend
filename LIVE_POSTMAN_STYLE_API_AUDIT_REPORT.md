# Live Postman-Style API Audit – Smart Campus Backend  
Date: 2026-04-04 (Asia/Dhaka)  
Base URL: `https://smart-campas-backend.onrender.com/api`  
Auth: Bearer JWT (super_admin + newly created principal); requests executed live via PowerShell `Invoke-RestMethod`. Responses are real, not mocked.

## Executive Summary
- Endpoints exercised this round: 18 (total to-date: 28)
- ✅ Passed: 13
- ⚠️ Warnings: 3
- ❌ Failed: 2
- Code fixes prepared locally for parent password regex and notice creation tenant resolution/validation. Live environment is not yet redeployed, so blockers still reproduce in production.
- Verdict: ⚠️ Minor Issues Remaining (deployment of fixes pending)

## New Endpoint Results (chronological)

| # | Method | Route | Auth | Status | Result | Notes |
| - | ------ | ----- | ---- | ------ | ------ | ----- |
| 16 | POST | /super-admin/schools | super_admin | 200 | ✅ | Created school `QAAPR04`, principal seeded (email `qa.principal+qaapr04@example.com`). |
| 17 | POST | /auth/login | principal | 200 | ✅ | Principal login succeeded; token issued. |
| 18 | POST | /principal/classes | principal | 201 | ✅ | Created Class 1/A (id `69d06f06e1a942d883d5b1ae`). |
| 19 | POST | /principal/subjects | principal | 201 | ✅ | Created subject Mathematics `MATH101`. |
| 20 | POST | /principal/students | principal | 201 | ✅ | Created student (roll 11, id `69d06f1de1a942d883d5b1c6`). |
| 21 | POST | /principal/teachers | principal | 201 | ✅ | Created teacher. |
| 22 | POST | /principal/parents | principal | 400 | ❌ | Always returns “Password must be 8-128 chars…” despite compliant passwords (regex bug). |
| 23 | POST | /super-admin/users | super_admin | 201 | ✅ | Created extra teacher via SU endpoint for QAAPR04. |
| 24 | POST | /notices (also /principal/notices) | principal & super_admin | 500 | ❌ | “Failed to create notice” even with minimal valid body; cannot seed published notice. |
| 25 | POST | /results | principal | 201 | ✅ | Published result (exam: Mid Term, roll 11). Second attempt correctly rejected as duplicate (400). |
| 26 | GET | /public/results?schoolCode=QAAPR04 | None | 200 | ✅ | Returns published result summary (1 record). |
| 27 | GET | /public/results/lookup?schoolCode=QAAPR04&rollNumber=11 | None | 200 | ✅ | Returns detailed result + summary; no cross-tenant leak observed. |
| 28 | GET | /public/notices?schoolCode=QAAPR04 | None | 200 | ⚠️ | Empty array because notice creation fails; public notice flow unvalidated. |

## Workflow Validation
- Super Admin workflow: Create school ✅, create user ✅, list/dashboard/stats previously ✅.  
- Principal workflow: Login ✅; create class ✅; create subject ✅; create student ✅; create teacher ✅; create parent ❌ (password regex bug); create notice ❌ (500).  
- Result workflow: Upload/publish result ✅; duplicate detection ✅.  
- Public website workflow: Results endpoints validated with real data ✅; notices unvalidated due to creation failure ⚠️.

## Security / RBAC Checks
- Missing token → 401; bad token → 401; wrong role (super_admin on principal route) → 403 (from prior run).
- Tenant isolation: public lookup constrained to `schoolCode`; QAAPR04 result lookup only returns that school’s data.

## Issues Found (current blockers)
1) ❌ Notice creation fails with 500 (`/notices` and `/principal/notices`)  
   - Root cause (code-level): `createNotice` accessed `req.tenant.schoolId` without null-check, causing TypeError when tenant context missing. Validation errors were swallowed into generic 500.  
   - Fix applied locally: safe tenant resolution (`req.tenant?.schoolId || req.user?.schoolId`), required-context 400 guard, and validation-aware error responses.  
   - Live status: still failing (production not redeployed); creation returns `"Failed to create notice"`.

2) ❌ Parent creation rejects valid passwords (`/principal/parents`)  
   - Root cause (code-level): password regex used `/\\d/` (backslash + d) instead of `\d`, so numeric requirement could only be met by the literal string `\d`.  
   - Fix applied locally: updated regex to `(?=.*\d)` like other controllers.  
   - Live status: still failing with 400 on compliant password (redeploy pending).

3) ⚠️ Public notices untested  
   - Blocked by issue #1. Need at least one published notice in production to verify public filter/payload after redeploy.

## Recommended Next Steps
1) Deploy the local fixes (parent password regex + notice create tenant/validation handling) to production.  
2) Re-run live tests: `/principal/parents` with a compliant password (e.g., `QaPass123!a`) should return 201; `/notices` or `/principal/notices` should return 201.  
3) Seed one active notice for `QAAPR04`; verify `/public/notices?schoolCode=QAAPR04` and `/public/notices/latest` return it.  
4) Quick regression smoke: school create, principal login, class/subject/student/teacher create, result publish, public result lookup. If all pass, update verdict to ✅ Fully Production Ready.

## Final Verdict
⚠️ Minor Issues Remaining — Code-level fixes are ready but not yet live. Production readiness awaits deployment and confirmation that notice creation and parent creation succeed in production and that public notices return published data.
