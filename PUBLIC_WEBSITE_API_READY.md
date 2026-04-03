# Public Website API Readiness (Smart Campus Backend)
Updated: 2026-04-03 (Asia/Dhaka)

## Purpose
Enable each school to plug its own public website into Smart Campus without backend redesign. Public APIs expose only published, school-scoped notices and results, with clean responses and tenant safety.

## Core Public Endpoints

### Notices
- `GET /api/public/notices?schoolCode=ABC123&priority=high&page=1&limit=20`
- `GET /api/public/notices/latest?schoolCode=ABC123&limit=5`
Response:
```json
{
  "success": true,
  "message": "Notices fetched successfully",
  "data": [
    {
      "title": "Exam Schedule",
      "description": "Mid-term exam dates",
      "noticeType": "exam",
      "publishDate": "2026-04-03T00:00:00.000Z",
      "expiryDate": null,
      "priority": "high",
      "isPinned": true,
      "pinOrder": 1,
      "attachments": [
        { "filename": "schedule.pdf", "url": "https://..." }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12, "pages": 1 }
}
```
Rules:
- Filters by `schoolCode` (validated, active school only).
- Only `status='active'`, `publishDate<=now`, not expired, not deleted.
- No admin/audit/internal fields returned.

### Results (public summary)
- `GET /api/public/results?schoolCode=ABC123&class=Class 1&section=A&exam=Mid&academicYear=2026`
Response:
```json
{
  "success": true,
  "message": "Results fetched successfully",
  "data": [
    {
      "examName": "Mid Term",
      "examDate": "2026-03-15T00:00:00.000Z",
      "class": "Class 1",
      "section": "A",
      "roll": "S1",
      "publishedAt": "2026-03-20T00:00:00.000Z",
      "totalMarks": 480,
      "gpa": 4.8
    }
  ],
  "total": 6
}
```
Rules:
- Requires `schoolCode`; only `isPublished=true` and active results.
- Optional filters: `class`, `section`, `exam` (regex), `academicYear`, `roll`, `studentId`.

### Result lookup (student-specific)
- `GET /api/public/result/:rollNumber?schoolCode=ABC123&exam=Mid`
Response:
```json
{
  "success": true,
  "data": {
    "student": { "name": "QA Student", "rollNumber": "S1", "class": "Class 1" },
    "results": [
      {
        "examName": "Mid Term",
        "examDate": "2026-03-15T00:00:00.000Z",
        "studentClass": "Class 1",
        "section": "A",
        "roll": "S1",
        "subjects": [ { "subjectName": "Math", "marks": 95, "grade": "A+" } ],
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
Rules:
- Requires `schoolCode`; only `isPublished=true`.
- Optional filters: `exam`, `examType`, `academicYear`, `studentId`.
- Does not expose unpublished drafts or other-school data.

### School Info (optional helper)
- `GET /api/public/school/:schoolCode`

## Publish Controls (Principal/Admin)
- Notices: create/update, `POST /api/notices/:id/publish` sets `status=active`, adds `publishedAt`, and now stamps `schoolCode` for public filtering.
- Results: `PUT /api/results/:id/publish` and `PUT /api/results/publish` set `isPublished=true`, `publishedAt`, `publishedBy`.

## Multi-tenant Safety
- `schoolCode` is normalized uppercase and validated against active School.
- Queries use `schoolCode` (and fallback `schoolId`) plus published/active filters; no cross-school leakage.
- Public routes never return data when `schoolCode` is missing/invalid.

## Response Contract
- Consistent shape: `{ success, message?, data, pagination? }`
- Frontend-friendly fields only; audit/internal metadata removed.

## Future Website Usage Notes
- Public pages can list latest notices via `/public/notices/latest`.
- For result portals, use summary `/public/results` for class/section pages and `/public/result/:rollNumber` for student lookups.
- Pagination already included on notices; can be extended to results if needed.
