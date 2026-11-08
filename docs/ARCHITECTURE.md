# RGUKT Ongole Placement Hub - System Architecture

## 1. High-Level System Architecture

The RGUKT Ongole Placement Hub is designed as an enterprise-grade, distributed microservices platform to manage the complete campus placement lifecycle for students, Training & Placement Office (TPO) administrators, faculty coordinators, and visiting recruiters.

```mermaid
flowchart TD
    subgraph Clients["Presentation Layer (Client)"]
        WebClient["React 18 + Vite + Tailwind SPA\n(Student & TPO Portals)\nPort: 5173"]
    end

    subgraph Edge["Edge / Reverse Proxy Layer"]
        Gateway["NGINX API Gateway\nPort: 8080\n- SSL Termination\n- Rate Limiting\n- Route Reverse Proxy\n- CORS & Security Headers"]
    end

    subgraph Microservices["Microservices Layer (Node.js & Express)"]
        AuthSvc["Auth Service\nPort: 4001\n- Authentication (JWT)\n- RBAC (Student / TPO / Coordinator)\n- Password Hashing (Argon2/Bcrypt)"]
        StudentSvc["Student Service\nPort: 4002\n- Profiles, Academic Records (CGPA, Backlogs)\n- Resume Links & Verification Status"]
        DriveSvc["Company & Drive Service\nPort: 4003\n- Company Profiles\n- Recruitment Drives & Eligibility Criteria\n- Drive Status & Rounds Workflow"]
        AppSvc["Application Service\nPort: 4004\n- Application Submission & Validation\n- Duplicate Prevention\n- Multi-stage Hiring Tracker"]
        NotifSvc["Notification Service\nPort: 4005\n- In-app Notifications\n- Email Notifications\n- Deadline Reminders"]
    end

    subgraph Broker["Asynchronous Messaging Layer"]
        MQ["RabbitMQ Message Broker\nPort: 5672 (AMQP) / 15672 (UI)\n- Topic Exchanges\n- Durable Task Queues\n- Dead Letter Exchanges"]
    end

    subgraph Data["Database Layer (Database-per-Service)"]
        AuthDB[("auth_db\nMongoDB 7.0")]
        StudentDB[("student_db\nMongoDB 7.0")]
        DriveDB[("drive_db\nMongoDB 7.0")]
        AppDB[("application_db\nMongoDB 7.0")]
        NotifDB[("notification_db\nMongoDB 7.0")]
    end

    WebClient -->|HTTP REST / JSON| Gateway

    Gateway -->|/api/v1/auth/*| AuthSvc
    Gateway -->|/api/v1/students/*| StudentSvc
    Gateway -->|/api/v1/drives/*| DriveSvc
    Gateway -->|/api/v1/applications/*| AppSvc
    Gateway -->|/api/v1/notifications/*| NotifSvc

    AuthSvc --- AuthDB
    StudentSvc --- StudentDB
    DriveSvc --- DriveDB
    AppSvc --- AppDB
    NotifSvc --- NotifDB

    DriveSvc -.->|Publish: drive.created / drive.updated| MQ
    AppSvc -.->|Publish: application.submitted / status.changed| MQ
    MQ -.->|Consume: notifications.*| NotifSvc
```

---

## 2. Microservice Boundaries & Database Ownership

In strict compliance with microservice isolation principles:
- **Zero Shared Databases**: No service connects directly to another service's MongoDB instance.
- **Data Encapsulation**: Private state is accessible only via REST APIs or domain events.
- **Dedicated Volumes**: In Docker Compose, each MongoDB instance runs in an isolated container with its own named volume.

| Microservice | Internal Port | Database Name | Docker Container | Volume Name |
| :--- | :--- | :--- | :--- | :--- |
| **Auth Service** | `4001` | `rgukt_auth_db` | `auth-db` | `auth_data` |
| **Student Service** | `4002` | `rgukt_student_db` | `student-db` | `student_data` |
| **Company & Drive Service** | `4003` | `rgukt_drive_db` | `drive-db` | `drive_data` |
| **Application Service** | `4004` | `rgukt_application_db` | `application-db` | `application_data` |
| **Notification Service** | `4005` | `rgukt_notification_db` | `notification-db` | `notification_data` |

---

## 3. Communication Patterns

### A. Synchronous Communication (HTTP / REST)
Used when a client requires an immediate response (e.g., login, profile retrieval, drive listing) or when a service needs immediate, transactional verification:
- **Client to Services via Gateway**: All external traffic flows through NGINX on `http://localhost:8080/api/v1/...`.
- **Inter-Service Verification**: When an application is submitted, `application-service` synchronously verifies student eligibility criteria against `student-service` and `company-drive-service`.
- **Internal Security**: Inter-service synchronous calls include an internal service authorization header (`x-service-key`) to prevent unauthorized cross-service tampering.

### B. Asynchronous Communication (Event-Driven via RabbitMQ)
Used when processing can occur in the background without blocking the caller:
- **Decoupled Workflow**: State transitions publish domain events to a RabbitMQ Topic Exchange (`placement.topic`).
- **Events Published**:
  - `drive.published`: Triggers notification broadcasts to eligible students.
  - `application.submitted`: Triggers confirmation email and notification to student & TPO.
  - `application.status_changed`: Triggers progress alerts (e.g., shortlisted for interview).
  - `student.registered`: Triggers welcome email and initializes default notification preferences.

```mermaid
sequenceDiagram
    autonumber
    actor Student as Student
    participant Gateway as NGINX Gateway (:8080)
    participant AppSvc as Application Service (:4004)
    participant StudentSvc as Student Service (:4002)
    participant DriveSvc as Drive Service (:4003)
    participant MQ as RabbitMQ Exchange
    participant NotifSvc as Notification Service (:4005)

    Student->>Gateway: POST /api/v1/applications { driveId } (Bearer Token)
    Gateway->>AppSvc: Forward POST /api/v1/applications (x-user-id, x-user-role)
    
    rect rgb(240, 248, 255)
        Note over AppSvc,StudentSvc: Synchronous Verification
        AppSvc->>StudentSvc: GET /api/v1/students/internal/:id (x-service-key)
        StudentSvc-->>AppSvc: 200 OK { cgpa, branch, backlogs }
        AppSvc->>DriveSvc: GET /api/v1/drives/internal/:id (x-service-key)
        DriveSvc-->>AppSvc: 200 OK { minCgpa, allowedBranches, maxBacklogs }
    end

    AppSvc->>AppSvc: Verify Eligibility & Check Existing Application
    AppSvc->>AppSvc: Save Application (status: APPLIED)
    AppSvc-->>Gateway: 201 Created { applicationId, status: "APPLIED" }
    Gateway-->>Student: 201 Created Application Confirmation

    rect rgb(255, 250, 240)
        Note over AppSvc,NotifSvc: Asynchronous Event Dispatch
        AppSvc-)MQ: Publish "application.submitted"
        MQ-)NotifSvc: Consume "application.submitted"
        NotifSvc->>NotifSvc: Persist In-App Notification & Dispatch Email
    end
```

---

## 4. API Gateway Responsibilities

The NGINX API Gateway acts as the single public entry point:
1. **Reverse Proxying**: Maps public endpoints (`/api/v1/auth/*`, `/api/v1/students/*`, etc.) to respective internal microservices.
2. **Rate Limiting**:
   - Standard APIs: 30 requests/second per IP with a burst of 50.
   - Authentication APIs: 5 requests/minute per IP to guard against brute-force attacks.
3. **SSL/TLS Termination**: Centralized certificate handling for secure production deployments.
4. **CORS & Security Headers**: Adds `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, and cross-origin resource sharing policies.
5. **Gateway Health Check**: Exposes `/health` to verify edge availability.

---

## 5. Authentication & Authorization Flow

The platform implements **Stateless JWT-based Authentication** with **Role-Based Access Control (RBAC)**:

### User Roles:
- `STUDENT`: Can manage personal profile, browse eligible drives, apply for drives, and view application status.
- `TPO_ADMIN`: Can create/update drives, verify student profiles, update application stages, access reports and audit logs.
- `COORDINATOR`: Faculty/student placement representative with department-scoped view privileges.

```mermaid
sequenceDiagram
    autonumber
    actor User as Student / TPO
    participant Gateway as NGINX Gateway
    participant AuthSvc as Auth Service
    participant Svc as Target Microservice

    User->>Gateway: POST /api/v1/auth/login { email, password }
    Gateway->>AuthSvc: Forward login request
    AuthSvc->>AuthSvc: Verify credentials (Argon2 / Scrypt)
    AuthSvc-->>Gateway: 200 OK { accessToken (JWT), refreshToken, userProfile }
    Gateway-->>User: Set cookies / return JWT Bearer

    Note over User,Svc: Subsequent Authenticated Request
    User->>Gateway: GET /api/v1/drives (Authorization: Bearer <token>)
    Gateway->>Svc: Forward request with Bearer token
    Svc->>Svc: Verify JWT signature & check role permissions (RBAC)
    Svc-->>Gateway: 200 OK { drives: [...] }
    Gateway-->>User: 200 OK { drives: [...] }
```

- **Access Token**: Short-lived (15 minutes), signed with asymmetric/HMAC-SHA256, contains `{ userId, email, role, department }`.
- **Refresh Token**: Long-lived (7 days), stored securely in `auth_db` to allow token rotation and revoking.

