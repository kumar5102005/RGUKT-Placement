# Microservice Responsibility & Boundary Document

## 1. Overview of Microservices

The RGUKT Ongole Placement Hub is decoupled into 5 focused microservices and 1 API Gateway. Each microservice follows the Single Responsibility Principle (SRP) and operates independently.

---

## 2. Microservice Profiles

### 1. API Gateway (`gateway`)
- **Port**: `8080` (External Host Port)
- **Technology**: NGINX 1.27-alpine
- **Core Responsibilities**:
  - Unified entry point for all frontend and mobile client traffic.
  - Path-based reverse proxy routing to upstream container services.
  - IP-based rate limiting to protect services during peak campus drive announcements.
  - Injection of security headers (`X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`).
  - CORS configuration for the web client.

---

### 2. Auth Service (`services/auth-service`)
- **Port**: `4001` (Internal)
- **Database**: `mongodb://auth-db:27017/rgukt_auth_db`
- **Domain Scope**: Identity and Access Management (IAM).
- **Core Responsibilities**:
  - Student registration using verified RGUKT institutional email domains (e.g. `@rguktong.ac.in`).
  - Secure credential hashing using `argon2` or `scrypt`.
  - Issuance of JSON Web Tokens (`accessToken` and `refreshToken`).
  - Refresh token rotation, blacklisting, and session invalidation.
  - Role management (`STUDENT`, `TPO_ADMIN`, `COORDINATOR`).
  - Password reset flows and security audit logs.
- **Out of Scope**:
  - Detailed student academic records, resume storage, drive records.

---

### 3. Student Service (`services/student-service`)
- **Port**: `4002` (Internal)
- **Database**: `mongodb://student-db:27017/rgukt_student_db`
- **Domain Scope**: Student Academic & Professional Profile.
- **Core Responsibilities**:
  - Student profile creation linked to the `userId` issued by the Auth Service.
  - RGUKT-specific academic record management:
    - Student ID (e.g., `O180001`, `O190002`).
    - Department / Branch (`CSE`, `ECE`, `EEE`, `MECH`, `CIVIL`, `CHEMICAL`).
    - CGPA (Overall and semester-wise), 10th and PUC percentages.
    - Active backlogs and backlog history.
  - Resume links, GitHub/LinkedIn portfolios, skill tags, certifications.
  - TPO Profile Verification workflow: TPO can mark student profiles as `VERIFIED`, `PENDING_CORRECTION`, or `UNVERIFIED`.
  - Internal endpoint for eligibility querying (`GET /api/v1/students/internal/:id`).
- **Out of Scope**:
  - Login credentials or token generation.
  - Company drive postings or application stage tracking.

---

### 4. Company & Drive Service (`services/company-drive-service`)
- **Port**: `4003` (Internal)
- **Database**: `mongodb://drive-db:27017/rgukt_drive_db`
- **Domain Scope**: Recruiter Companies & Campus Placement Drives.
- **Core Responsibilities**:
  - Company directory management (company name, sector, website, logo URL, HR contact).
  - Placement drive publishing with eligibility criteria:
    - Minimum CGPA required.
    - Eligible branches (array of departments).
    - Maximum allowed active backlogs.
    - Package details: CTC (LPA), fixed, variable, internship stipend.
    - Drive dates and registration deadline.
    - Selection rounds pipeline (e.g. `Online Assessment`, `Technical Interview`, `HR`).
  - Drive status lifecycle: `DRAFT` ➔ `PUBLISHED` ➔ `REGISTRATIONS_CLOSED` ➔ `IN_PROGRESS` ➔ `COMPLETED` ➔ `CANCELLED`.
  - Publishes `drive.published` and `drive.updated` events to RabbitMQ.
- **Out of Scope**:
  - Managing individual student submissions (handled by Application Service).

---

### 5. Application Service (`services/application-service`)
- **Port**: `4004` (Internal)
- **Database**: `mongodb://application-db:27017/rgukt_application_db`
- **Domain Scope**: Placement Applications & Recruitment Workflow Engine.
- **Core Responsibilities**:
  - Application submission by students for eligible drives.
  - Strict eligibility gatekeeping (checks student branch, CGPA, backlogs against drive criteria).
  - Duplicate application prevention (unique compound index on `{ studentId, driveId }`).
  - Deadline validation (rejects applications submitted after drive deadline).
  - Recruitment round advancement (e.g. moving candidates from `APPLIED` to `SHORTLISTED` to `ROUND_1_CLEARED` to `OFFERED`).
  - Batch status updates by TPO administrators.
  - Publishes `application.submitted` and `application.status_changed` events.
- **Out of Scope**:
  - Directly querying student or drive database collections (calls internal REST APIs).

---

### 6. Notification Service (`services/notification-service`)
- **Port**: `4005` (Internal)
- **Database**: `mongodb://notification-db:27017/rgukt_notification_db`
- **Domain Scope**: Multi-Channel Alerts & Communications.
- **Core Responsibilities**:
  - Consumes domain events from RabbitMQ (`drive.published`, `application.status_changed`, etc.).
  - Generates in-app notifications stored in database with read/unread status.
  - Provides REST API for student and admin notification feeds:
    - `GET /api/v1/notifications`
    - `PATCH /api/v1/notifications/:id/read`
    - `PATCH /api/v1/notifications/mark-all-read`
  - Integration with email transport (e.g. Nodemailer with SMTP) for critical placement alerts.
- **Out of Scope**:
  - Modifying placement drive or application statuses.

---

## 3. Cross-Cutting Standards

### A. Validation Strategy
- Request bodies, query parameters, and route parameters must be validated at the route boundary using **Joi** or **Zod**.
- Invalid inputs immediately return standard `400 Bad Request` with structured error messages before reaching controllers or services.

### B. Error Handling & Standard Error Response
Every service uses a centralized error handling middleware. Unhandled errors are caught and transformed into a standard JSON payload:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Student CGPA (6.8) is below the drive cutoff (7.5)",
    "details": [],
    "timestamp": "2026-11-07T23:00:00.000Z"
  }
}
```

### C. Logging Standard
- Structured logging using **Winston** or **Pino**.
- Every log entry includes timestamp, service name, log level (`info`, `warn`, `error`, `debug`), correlation ID (`x-correlation-id`), and request metadata.
- Production business data, passwords, and sensitive student tokens are redacted from all logs.

