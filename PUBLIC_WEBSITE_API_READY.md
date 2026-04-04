# Public Website API Readiness (Smart Campus Backend)
Updated: 2026-04-04 (Asia/Dhaka)

## Purpose
Enable every school to ship a public website without backend redesign. Public APIs now return only published, tenant-scoped data with clean, stable shapes.

## Core Public Endpoints

### Notices (public list)
- `GET /api/public/notices?schoolCode=ABC123&priority=high&category=exam&page=1&limit=20`
- `GET /api/public/notices/latest?schoolCode=ABC123&limit=5`
Response (shape):
```json
{
  "success": true,
  "message": "Data fetched successfully",
  "data": [
    {
      "id": "6642...",
      "title": "Exam Schedule",
      "description": "Mid-term exam dates",
      "category": "exam",
      "publishDate": "2026-04-03T00:00:00.000Z",
      "publishedAt": "2026-04-03T01:10:00.000Z",
      "expiryDate": null,
      "priority": "high",
      "isPinned": true,
      "pinOrder": 1,
      "attachments": [{ "name": "schedule.pdf", "url": "https://..." }]
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12, "pages": 1 }
}
```
Rules: schoolCode validated (active only); filters `isPublished=true`, `status='active'`, not deleted, publishDate ≤ now, not expired; safe attachments only (name/url/mime/size).

### Results – Public Summary Mode
- `GET /api/public/results?schoolCode=ABC123&class=Class 1&section=A&exam=Mid&session=2026&page=1&limit=50`
- Alias: `GET /api/public/results/lookup` (same handler) without roll/studentId to stay in summary mode.
Response (shape):
```json
{
  "success": true,
  "message": "Data fetched successfully",
  "data": [
    {
      "id": "6651...",
      "examName": "Mid Term",
      "session": "2026",
      "class": "Class 1",
      "section": "A",
      "roll": "S1",
      "publishDate": "2026-03-20T00:00:00.000Z",
      "examDate": "2026-03-15T00:00:00.000Z",
      "totalMarks": 480,
      "gpa": 4.8
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 6, "pages": 1 }
}
```
Rules: requires `schoolCode`; filters `isPublished=true` and `isActive!=false`; optional filters `class`, `section`, `exam` (regex), `session|academicYear`.

### Results – Student Lookup Mode
- `GET /api/public/results/lookup?schoolCode=ABC123&rollNumber=S1&exam=Mid&session=2026`
- Also supported: `GET /api/public/result/:rollNumber?schoolCode=ABC123` (path alias).
Response (shape):
```json
{
  "success": true,
  "message": "Data fetched successfully",
  "data": {
    "student": { "id": "663...", "name": "QA Student", "rollNumber": "S1", "class": "Class 1", "section": "A" },
    "results": [
      {
        "id": "6651...",
        "examName": "Mid Term",
        "session": "2026",
        "examDate": "2026-03-15T00:00:00.000Z",
        "class": "Class 1",
        "section": "A",
        "roll": "S1",
        "subjects": [{ "subjectName": "Math", "marks": 95, "grade": "A+" }],
        "totalMarks": 480,
        "gpa": 4.8,
        "publishedAt": "2026-03-20T00:00:00.000Z"
      }
    ],
    "summary": {
      "totalExams": 1,
      "overallPercentage": 96,
      "totalMarksObtained": 480,
      "totalMaxMarks": 500,
      "grade": "A+"
    }
  }
}
```
Rules: requires `schoolCode` and either `rollNumber` or `studentId`; filters `isPublished=true`, `isActive!=false`; optional `exam`, `session|academicYear`, `class`, `section`. Returns only safe student fields.

### Optional helpers
- `GET /api/public/school/:schoolCode`
- `GET /api/public/dashboard/:schoolCode` (top 5 notices + recent results + stats)

## Publish Controls (Principal/Admin)
- Notices: `POST /api/notices/:id/publish` now sets `isPublished=true`, `publishedAt`, `status=active`, stamps `schoolCode` for public filtering.
- Results: `PUT /api/results/:id/publish` or bulk `/api/results/publish` set `isPublished=true`, `publishedAt`, `isActive=true`, `publishedBy`.
- Soft delete of results now hides them publicly (`isPublished=false`, `isActive=false`, `publishedAt=null`).

## Multi-tenant Safety
- `schoolCode` normalized to uppercase and validated against `School.isActive=true`.
- All public queries scope by `schoolCode` (and `schoolId` for notices) plus published/active flags and expiry windows; no cross-school leakage.
- Missing/invalid `schoolCode` returns 400/404 with safe message.

## Response Contract
- Consistent: `{ "success": true|false, "message": "...", "data": [...|{}], "pagination": {...} }`
- No audit/internal/admin fields; attachments expose only `name/url/mimeType/size`.

## Verification Checklist
- Notice: create → publish → appears in `/public/notices`; expired/unpublished stays hidden.
- Result: create/update → publish → appears in summary list; student lookup returns detailed rows; deleted/unpublished stays hidden.
- Safety: wrong `schoolCode` or cross-tenant roll lookup never returns data; responses stay in the contract above.
