# RGUKT Ongole Placement Hub - API Contracts Specification

## 1. Global API Standards

- **Base URL**: `http://localhost:8080/api/v1`
- **Data Format**: `application/json`
- **Standard Authentication**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- **Internal Service Authentication**: `x-service-key: <INTERNAL_KEY>`
- **Correlation ID Header**: `x-correlation-id: <UUID>`

### Standard Success Response Format
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 120
  }
}
```

### Standard Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested placement drive was not found",
    "details": []
  }
}
```

---

## 2. API Endpoints by Service

### A. Auth Service Endpoints (`/api/v1/auth`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Public | Register new student or admin account |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user and issue JWTs |
| `POST` | `/api/v1/auth/refresh-token` | Public | Exchange refresh token for new access token |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revoke refresh token and invalidate session |
| `GET`  | `/api/v1/auth/me` | Authenticated | Fetch authenticated user context |

#### Sample Contract: `POST /api/v1/auth/login`
- **Request Body**:
  ```json
  {
    "email": "o180123@rguktong.ac.in",
    "password": "SecurePassword#2026"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "d8f3a1...",
      "user": {
        "id": "6724a1b...",
        "email": "o180123@rguktong.ac.in",
        "role": "STUDENT"
      }
    }
  }
  ```

---

### B. Student Service Endpoints (`/api/v1/students`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET`  | `/api/v1/students/profile` | Student | Get own profile |
| `PUT`  | `/api/v1/students/profile` | Student | Update own profile (CGPA, resume, skills) |
| `GET`  | `/api/v1/students` | TPO Admin | List/filter all student profiles with pagination |
| `GET`  | `/api/v1/students/:id` | TPO Admin | Get specific student profile by ID |
| `PATCH`| `/api/v1/students/:id/verify` | TPO Admin | Update verification status (`VERIFIED` / `REJECTED`) |
| `GET`  | `/api/v1/students/internal/:id` | Internal Only | Internal query for academic credentials |

#### Sample Contract: `PUT /api/v1/students/profile`
- **Request Body**:
  ```json
  {
    "studentId": "O180123",
    "fullName": "K. Sai Kumar",
    "branch": "CSE",
    "batchYear": 2026,
    "btechCgpa": 8.42,
    "activeBacklogs": 0,
    "skills": ["JavaScript", "React", "Node.js", "MongoDB", "Docker"],
    "githubUrl": "https://github.com/saikumar-rgukt"
  }
  ```

---

### C. Company & Drive Service Endpoints (`/api/v1/drives`)

Placement-drive `recruitmentRounds` are configurable: a drive may have no rounds or any number of sequentially numbered rounds. Round numbering, names, types, and scheduling values are validated on create and update. Registered-candidate status and round decisions can only be changed by an active recruiter for the drive's company who has decision-management permission; admins retain read-only monitoring access.

Company recruiters can grant or remove decision-management permission for an active secondary recruiter with `PATCH /api/v1/companies/my/recruiters/:recruiterId/permissions` and `{ "canManageRecruitment": true|false }`. The owner and primary recruiter retain this permission.

`GET /api/v1/drives/placement-drives/:driveId/registrations/:registrationId/resume` streams a private resume for its owning student, an authorized recruiter for the drive's company, or an admin. Resume metadata is snapshotted at registration time so a later student upload does not change the submitted document.

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET`  | `/api/v1/drives` | Authenticated | List placement drives (filtered by status/branch) |
| `GET`  | `/api/v1/drives/:id` | Authenticated | Get detailed drive information |
| `POST` | `/api/v1/drives` | TPO Admin | Create a new recruitment drive |
| `PUT`  | `/api/v1/drives/:id` | TPO Admin | Update drive details and deadlines |
| `PATCH`| `/api/v1/drives/:id/status`| TPO Admin | Transition drive status (`PUBLISHED`, `CLOSED`, etc.) |
| `POST` | `/api/v1/companies` | TPO Admin | Register a new recruiting company |
| `GET`  | `/api/v1/companies` | Authenticated | List partner recruiting companies |
| `GET`  | `/api/v1/drives/internal/:id` | Internal Only | Internal query for drive eligibility criteria |

#### Sample Contract: `POST /api/v1/drives`
- **Request Body**:
  ```json
  {
    "companyName": "TechCorp Global",
    "title": "Software Engineer - Trainee",
    "roleCategory": "Full-time",
    "jobLocation": "Hyderabad",
    "packageCtc": {
      "minLpa": 8.0,
      "maxLpa": 12.0
    },
    "eligibility": {
      "minCgpa": 7.5,
      "allowedBranches": ["CSE", "ECE"],
      "maxBacklogs": 0,
      "eligibleBatchYear": 2026
    },
    "registrationDeadline": "2026-11-20T23:59:59.000Z",
    "driveDate": "2026-11-25T09:00:00.000Z",
    "description": "Full-stack development, cloud architecture, problem-solving skills."
  }
  ```

---

### D. Application Service Endpoints (`/api/v1/applications`)

Application records snapshot the resume file name, original name, MIME type, and submission time. `GET /api/v1/applications/:applicationId/resume` permits access to the owning student, an authorized recruiter for the application's company, or an admin. Application status, interview, evaluation, and offer changes are restricted to authorized recruiters; admins have read-only access.

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/applications` | Student | Submit application for a drive (enforces eligibility) |
| `GET`  | `/api/v1/applications/my` | Student | View current student's applications & status history |
| `GET`  | `/api/v1/applications/drive/:driveId` | TPO Admin | List all applicants for a specific drive |
| `PATCH`| `/api/v1/applications/:id/stage` | TPO Admin | Update applicant status / advance to next round |
| `POST` | `/api/v1/applications/batch-stage` | TPO Admin | Bulk advance shortlisted applicants |

#### Sample Contract: `POST /api/v1/applications`
- **Request Body**:
  ```json
  {
    "driveId": "6724b9a0c1e8a9341209e801"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "message": "Application submitted successfully",
    "data": {
      "applicationId": "6724cf10a9018e21094002",
      "driveId": "6724b9a0c1e8a9341209e801",
      "status": "APPLIED",
      "appliedAt": "2026-11-07T23:15:00.000Z"
    }
  }
  ```

---

### E. Notification Service Endpoints (`/api/v1/notifications`)

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET`  | `/api/v1/notifications` | Authenticated | Get paginated notifications for current user |
| `PATCH`| `/api/v1/notifications/:id/read` | Authenticated | Mark a single notification as read |
| `PATCH`| `/api/v1/notifications/read-all` | Authenticated | Mark all notifications as read |
