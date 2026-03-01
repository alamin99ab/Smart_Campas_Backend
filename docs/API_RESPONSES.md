# API Response Format & Analysis

## Standard response shape

All API responses follow a consistent structure so clients can handle them uniformly.

### Success (2xx)

```json
{
  "success": true,
  "data": { ... },
  "message": "Success",
  "timestamp": "2025-02-28T12:00:00.000Z",
  "requestId": "req_abc123"
}
```

- **data:** Response payload (object or array). Omitted for simple success (e.g. delete).
- **message:** Short human-readable message.
- **timestamp:** ISO 8601.
- **requestId:** Present when request-id middleware is used (for tracing).

Controllers that already send `res.json({ success: true, data: ... })` are left as-is; the middleware does not double-wrap.

### Error (4xx / 5xx)

```json
{
  "success": false,
  "message": "Error description",
  "error": "Stack trace or detail (development only)",
  "timestamp": "2025-02-28T12:00:00.000Z",
  "requestId": "req_abc123"
}
```

- **message:** Always present; safe to show to users.
- **error:** Only in development (`NODE_ENV !== 'production'`) for debugging.

Produced by the global **errorHandler** middleware (Mongoose, JWT, validation, etc.).

### 404 (Not Found)

```json
{
  "success": false,
  "message": "API endpoint not found"
}
```

Returned when no route matches.

## Pagination

List endpoints that support pagination include:

- **data:** Array of items.
- **pagination:** `{ "page": 1, "limit": 20, "total": 100, "pages": 5 }` (or equivalent inside **data**).

Example: `GET /api/notices`, `GET /api/results`, `GET /api/fee/report`.

## Auth errors

- **401 Unauthorized:** Missing or invalid token → `"message": "Not authorized, no token"` or `"Not authorized, token invalid or expired"`.
- **403 Forbidden:** Valid token but insufficient role → `"message": "Access denied. Insufficient permissions."`.

## Validation errors

- **400 Bad Request:** ValidationError from Mongoose or express-validator → **message** contains field-level errors or a summary.

## Summary

| Scenario   | success | data   | message   |
|-----------|---------|--------|-----------|
| Success   | true    | payload| "Success" or custom |
| Error     | false   | -      | error text |
| 404 route | false   | -      | "API endpoint not found" |

Use **success** to branch; use **message** for user-facing text; use **data** for payload.
