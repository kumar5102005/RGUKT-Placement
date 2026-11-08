# Application Service API Documentation

## Base URL
```
http://localhost:<PORT>/api/v1/applications
```
Replace `<PORT>` with the port your **application-service** is running on (default `4004`).

---

### 1. Apply for a Job (Student)
- **Endpoint**: `POST /`
- **Roles**: `STUDENT`
- **Request Body**:
  ```json
  {
    "jobId": "<job-id>",
    "studentUserId": "<student-user-id>",
    "coverLetter": "Optional cover letter text",
    "resumeUrl": "URL to the uploaded resume (optional)"
  }
  ```
- **Responses**:
  - `201 Created` – Application created.
  - `400 Bad Request` – Validation failed (ineligible, deadline passed, etc.).
  - `409 Conflict` – Duplicate application (student already applied for this job).

---

### 2. Get My Applications (Student)
- **Endpoint**: `GET /me`
- **Roles**: `STUDENT`
- **Query Params** (optional): `status` (e.g., `APPLIED`, `UNDER_REVIEW`).
- **Response**: Array of application objects.

---

### 3. List All Applications (Recruiter / Admin)
- **Endpoint**: `GET /`
- **Roles**: `RECRUITER`, `ADMIN`
- **Query Params** (optional):
  - `jobId`
  - `studentUserId`
  - `status`
- **Response**: Paginated list of applications.

---

### 4. Get Application Details
- **Endpoint**: `GET /:appId`
- **Roles**: `STUDENT` (own), `RECRUITER` (job's recruiter), `ADMIN`
- **Response**: Full application payload including interview rounds and history.

---

### 5. Update Application Stage
- **Endpoint**: `PATCH /:appId/stage`
- **Roles**: `RECRUITER`, `ADMIN`
- **Request Body**:
  ```json
  { "newStage": "UNDER_REVIEW" }
  ```
- **Response**: Updated application object.

---

### 6. Schedule Interview
- **Endpoint**: `POST /:appId/interviews`
- **Roles**: `RECRUITER`, `ADMIN`
- **Request Body**:
  ```json
  {
    "roundNumber": 1,
    "date": "2024-10-01T10:00:00Z",
    "mode": "online",
    "link": "https://meet.example.com/xyz"
  }
  ```
- **Response**: Interview object added to the application.

---

### 7. Submit Interview Evaluation
- **Endpoint**: `PATCH /:appId/interviews/:roundNumber/evaluation`
- **Roles**: `RECRUITER`, `ADMIN`
- **Request Body**:
  ```json
  {
    "score": 8,
    "feedback": "Good problem‑solving skills",
    "passed": true
  }
  ```
- **Response**: Updated interview entry.

---

### 8. Update Offer Details
- **Endpoint**: `PATCH /:appId/offer`
- **Roles**: `RECRUITER`, `ADMIN`
- **Request Body**:
  ```json
  {
    "salary": 85000,
    "joiningDate": "2025-01-15",
    "status": "OFFERED"
  }
  ```
- **Response**: Application with offer subsection populated.

---

### 9. Get Configurable Workflow Stages (Admin)
- **Endpoint**: `GET /stages`
- **Roles**: `ADMIN`
- **Response**: Array of stage objects `{ name, order, isDefault }`.

---

### 10. Create Custom Stage (Admin)
- **Endpoint**: `POST /stages`
- **Roles**: `ADMIN`
- **Request Body**:
  ```json
  { "name": "TECHNICAL_EVAL", "order": 3 }
  ```
- **Response**: Created stage object.

---

## Error Codes
| Code | Meaning |
|------|---------|
| 401  | Unauthorized / missing JWT |
| 403  | Forbidden – role does not permit the action |
| 404  | Resource not found |
| 409  | Conflict – duplicate application |
| 422  | Validation error – eligibility, deadline, missing fields |
| 500  | Internal server error |

---

## Notes
- All endpoints expect the `Authorization: Bearer <jwt>` header.
- For internal service‑to‑service calls (e.g., when Job Service notifies Application Service), include the `x-service-key` header with the internal key configured via `SERVICE_API_KEY` env var.
- Stage transitions are recorded in the `history` array of the `Application` model for auditability.
- The `Application` schema indexes `{ jobId, studentUserId }` uniquely to prevent duplicate submissions.

