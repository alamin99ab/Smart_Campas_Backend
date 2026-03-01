# Postman – Smart Campus API

## Import collection

1. Open Postman.
2. **Import** → **File** → select `postman/Smart_Campus_API_Collection.json`.
3. The collection **Smart Campus API** will appear with 25 folders.

## Variables

- **baseUrl:** Default `http://localhost:5000`. Change to your API URL (e.g. `https://api.yourdomain.com`).
- **token:** Leave empty. After **Auth → Login** or **Super Admin → Super Admin Login**, copy the `token` from the response and set it in the collection variables (or in Environment). All protected requests use **Authorization: Bearer {{token}}**.

## Auth

- **Public:** Health & Public, Auth (Register/Login/Refresh/Forgot/Reset/Verify), Result Search, Admission Apply. These use **No Auth** in the collection.
- **Protected:** All other requests use **Bearer Token**; set **token** after login.
- **Role-specific:** Some endpoints require Principal, Super Admin, or Admin. Use a user of that role to get a token.

## Response format

- **Success (2xx):**
  ```json
  {
    "success": true,
    "data": { ... },
    "message": "Success",
    "timestamp": "2025-02-28T...",
    "requestId": "..."
  }
  ```
- **Error (4xx/5xx):**
  ```json
  {
    "success": false,
    "message": "Error description",
    "timestamp": "2025-02-28T...",
    "requestId": "..."
  }
  ```
- **Pagination:** When applicable, `data` or root includes `pagination: { page, limit, total, pages }`.

## Quick test

1. **GET** `{{baseUrl}}/api/health` → expect `200`, `"status": "healthy"`.
2. **POST** `{{baseUrl}}/api/auth/login` with valid credentials → copy `data.token` (or `token`) into collection variable **token**.
3. **GET** `{{baseUrl}}/api/auth/profile` → expect `200` with user profile.

## Folders overview

| Folder | Description |
|--------|-------------|
| 1. Health & Public | Root, health check |
| 2. Auth | Register, login, profile, 2FA, audit logs |
| 3. Super Admin | Platform login, dashboard, schools, users |
| 4. Admin | Stats, school CRUD, export |
| 5. Principal | Students (add, bulk, promote, transfer), classes, subjects, routine, analytics |
| 6. School | Profile, stats, settings |
| 7. Students (Panel) | Student dashboard, notices, results, attendance, routine |
| 8. Notices | CRUD notices |
| 9. Attendance | Take, report, today, monthly, alerts (75%), export |
| 10. Results | Search, upload, lock/unlock, PDF, export |
| 11. Fee | Collect, report, due list, fee structure |
| 12. Routine | Check conflicts, CRUD, publish |
| 13. Leaves | Apply, list, approve, reject |
| 14. Substitutes | Assign, suggest, list |
| 15. Rooms | CRUD rooms |
| 16. Academic Sessions | Create, list, set current |
| 17. Notifications | List, unread count, mark read |
| 18. Events | CRUD events |
| 19. Activity | Activity feed |
| 20. Search | Global search |
| 21. Admission | Apply, list, approve, confirm |
| 22. Teacher Assignments | Assign subject, list, load, update |
| 23. Dashboard & Analytics | Dashboard, analytics |
| 24. Exam Schedule | Create, list, update, publish exam routine |
| 25. Admit Card | Download single/bulk, template |
