# RGUKT Ongole Placement Hub

A containerized, microservices-based placement management platform for **Rajiv Gandhi University of Knowledge Technologies (RGUKT) Ongole**.

---

## 🏛️ System Overview

The platform automates the campus recruitment workflow:
- **Frontend**: Single Page Application built with **React.js**, **Vite**, and **Tailwind CSS**.
- **Backend**: Decoupled **Node.js** & **Express.js** microservices.
- **Database**: Strict **Database-per-Service** architecture using dedicated **MongoDB 7.0** instances.
- **API Gateway**: **NGINX 1.27-alpine** providing unified routing, IP rate limiting, and security hardening.
- **Messaging**: **RabbitMQ** message broker for asynchronous event-driven notifications.
- **DevOps**: Fully automated multi-container orchestration via **Docker Compose**.

---

## 📁 Project Directory Structure

```text
placement-hub/
├── .env                                # Local development environment
├── .env.example                        # Template for environment variables
├── .gitignore                          # Git ignore definitions
├── README.md                           # Master project documentation
├── docker-compose.yml                  # Docker Compose orchestration (11 containers)
├── package.json                        # Monorepo workspaces & orchestration scripts
├── docs/                               # Architectural & API Documentation
│   ├── ARCHITECTURE.md                 # System architecture & sequence diagrams
│   ├── MICROSERVICES.md                # Microservice responsibilities & boundaries
│   ├── DATABASE_DESIGN.md              # Database-per-service schemas & index designs
│   ├── API_CONTRACTS.md                # Standardized REST endpoint specifications
│   ├── AUTHENTICATION_API.md           # Authentication, RBAC & Token rotation specs
│   ├── STUDENT_SERVICE_API.md          # Student management, profile & resume specs
│   ├── COMPANY_SERVICE_API.md          # Company registration & verification specs
│   ├── JOB_SERVICE_API.md              # Job postings, eligibility rules & drive specs
│   ├── DRIVE_SERVICE_API.md            # Placement drives, multi-round scheduling & registration
│   ├── TECH_STACK.md                   # Technology justification matrix
│   ├── ROADMAP.md                      # Phased development roadmap
│   └── INFRASTRUCTURE.md               # Infrastructure topology & network isolation
├── gateway/                            # NGINX API Gateway
│   ├── Dockerfile
│   └── nginx.conf                      # Reverse proxy & rate limiting configuration
├── client/                             # React + Vite + Tailwind CSS frontend portal
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── App.jsx                     # Router, AuthProvider & Navigation
│       ├── context/
│       │   └── AuthContext.jsx         # Authentication context & token management
│       ├── components/
│       │   └── ProtectedRoute.jsx      # Role-based route guard
│       └── pages/
│           ├── Login.jsx               # Sign in page
│           ├── Register.jsx            # Account registration (Student, Recruiter, Admin)
│           ├── Dashboard.jsx           # Role-customized dashboard & token diagnostics
│           ├── StudentProfile.jsx      # Student profile & resume upload editor
│           ├── AdminStudentSearch.jsx  # TPO student directory, filter & verification
│           ├── AdminUserManagement.jsx # Admin account status & user console
│           ├── RecruiterCompanyProfile.jsx # Recruiter company registration & profile editor
│           ├── AdminCompanyManagement.jsx  # TPO company verification & recruiter manager
│           ├── JobList.jsx             # Public & student job search, filter & explorer
│           ├── JobDetails.jsx          # Detailed job specs, rounds & eligibility auditor
│           ├── RecruiterJobManagement.jsx  # Recruiter & Admin job manager & drive creator
│           └── PlacementDrives.jsx     # Drive scheduling UI, candidate roster & student registration
└── services/                           # Independent Microservices
    ├── auth-service/                   # Full Phase 3 Authentication & RBAC Engine
    │   ├── src/                        # Models, controllers, middleware, routes
    │   └── tests/auth.test.js          # Authentication & RBAC Test Suite
    ├── student-service/                # Full Phase 4 Student Management Service
    │   ├── src/
    │   │   ├── controllers/            # Profile, resume upload, eligibility, search, verify
    │   │   ├── middleware/             # Multer upload, auth, rbac, internal key check
    │   │   ├── models/                 # StudentProfile schema (academics, skills, projects)
    │   │   ├── routes/                 # Student and Admin routes
    │   │   ├── utils/                  # Dynamic profile completion calculator
    │   │   └── index.js                # Express app, static uploads, database connection
    │   ├── uploads/resumes/            # Isolated directory for student resume files
    │   └── tests/student.test.js       # Student Management Test Suite
    ├── company-drive-service/          # Full Phase 5, 6 & 7 Company, Job & Drive Service
    │   └── src/
    │       ├── controllers/            # Company, Job & Placement Drive controllers
    │       ├── middleware/             # JWT auth, RBAC authorize, drive & job validation
    │       ├── models/                 # Company, Job, PlacementDrive & DriveRegistration schemas
    │       ├── routes/                 # Recruiter, Student & Admin drive, job & company routes
    │       ├── utils/                  # Configurable academic eligibility evaluator
    │       └── index.js                # Express app, MongoDB connection, health check
    ├── application-service/            # Express skeleton + MongoDB connection + Health
    └── notification-service/           # Express skeleton + MongoDB connection + Health
```

---

## 🎓 Student Management Service (Phase 4)

### Core Capabilities
- **Academic Profile Management**: Tracks branch (`CSE`, `ECE`, `EEE`, `MECH`, `CIVIL`, `CHEM`, `MME`), batch year, 10th %, PUC CGPA, B.Tech CGPA, active backlogs, and semester-by-semester SGPA.
- **Skills Portfolio**: Manages technical and non-technical skills with interactive tag editors.
- **Project & Certification Repository**: Stores project titles, descriptions, tech stacks, GitHub/live URLs, and credential links.
- **Resume Upload & Serving**: Validates file types (`.pdf`, `.doc`, `.docx`) up to 5MB, assigns unique sanitized identifiers, and serves uploaded documents via static routes.
- **Dynamic Profile Completion**: Automatically evaluates a 100-point weighted completion score based on personal details, academics, skills, projects, and resume status.
- **Academic Eligibility Engine**: Evaluates student credentials against recruitment drive cutoffs (minimum CGPA, allowed departments, maximum allowed backlogs, and graduating batch year).
- **TPO Candidate Directory & Verification**: Administrator multi-filter search console (by branch, CGPA, backlogs, status) and verification workflow (`VERIFIED`, `REJECTED`, `PENDING`).
- **Internal Microservice Query**: Provides real-time synchronous academic snapshots to downstream services using secure internal service keys (`x-service-key`).

### Student Service Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET`  | `/api/v1/students/profile` | Student | Retrieve own profile (auto-creates draft) |
| `PUT`  | `/api/v1/students/profile` | Student | Update academic records, skills, projects |
| `POST` | `/api/v1/students/profile/resume` | Student | Upload resume document (PDF/DOC, max 5MB) |
| `GET`  | `/api/v1/students/eligibility-check` | Student | Evaluate student eligibility against drive criteria |
| `GET`  | `/api/v1/students/search` | Admin | Search & filter students with multi-criteria |
| `GET`  | `/api/v1/students/:id` | Admin | Inspect full student profile |
| `PATCH`| `/api/v1/students/:id/verify` | Admin | Verify or reject student profile |
| `GET`  | `/api/v1/students/internal/:id` | Internal | Synchronous microservice query (`x-service-key`) |

---

## 🧪 Testing the Student Service

An automated test suite is provided at `services/student-service/tests/student.test.js`.

To run the Student Service tests separately:
```bash
# Set target URL (if running via gateway: http://localhost:8080/api/v1/students or directly: http://localhost:4002)
node services/student-service/tests/student.test.js
```
The test suite validates:
1. Service health check.
2. Initial profile retrieval and automatic draft generation.
3. Profile updates (academics, skills, projects, and certifications).
4. Dynamic profile completion percentage calculation.
5. Academic eligibility gatekeeper (eligible vs ineligible scenarios).
6. Administrator student search and filtering by branch/CGPA/backlogs.
7. Role enforcement (preventing student from accessing admin search).
8. Administrator profile verification workflow (`VERIFIED`).
9. Internal service-to-service query with `x-service-key`.

---

## 🏢 Company & Recruiter Management Service (Phase 5)

### Core Capabilities
- **Company Registration**: Authorized recruiters can register their corporate profile with name, industry, description, logo URL, official website, and full contact details.
- **Industry & Domain Taxonomy**: Supports 13 standardized industries (`IT Services`, `Software Product`, `Core Engineering`, `Banking & Finance`, `Consulting`, `Healthcare`, `E-Commerce`, `Manufacturing`, `Telecommunications`, `Education & Ed-Tech`, `Government & PSU`, `Research & Development`, `Other`).
- **HR & Recruiter Association**: Binds primary and secondary recruiters to company profiles with contact email and phone verification.
- **Admin Verification Workflow**: Dedicated TPO verification workflow (`PENDING`, `VERIFIED`, `REJECTED`) with administrative audit notes and timestamps.
- **Dynamic Re-verification Trigger**: Changing critical profile fields (`name`, `industry`, `contactEmail`) on a `VERIFIED` company resets verification back to `PENDING` automatically.
- **Multi-Factor Search & Filtering**: Fast full-text and indexed filtering by company name, industry, verification status, and city/state.
- **Student Privacy & Access Control**: Public/student queries return only `VERIFIED` companies, hiding unverified or rejected submissions.
- **Internal Microservice Query**: Downstream services (such as drive-posting and application filtering) query verified company profiles using the secure internal key (`x-service-key`).

### Company Service Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST`   | `/api/v1/drives` | Recruiter | Register new company profile (1 per recruiter) |
| `GET`    | `/api/v1/drives/my` | Recruiter | Retrieve own registered company details |
| `PUT`    | `/api/v1/drives/my` | Recruiter | Update own company information (triggers re-verification on critical changes) |
| `GET`    | `/api/v1/drives` | Authenticated | List all companies (students only see `VERIFIED`) |
| `GET`    | `/api/v1/drives/search` | Authenticated | Search & filter companies with pagination |
| `GET`    | `/api/v1/drives/:id` | Authenticated | Retrieve company details by MongoDB ID |
| `PATCH`  | `/api/v1/drives/:id/verify` | Admin | Approve (`VERIFIED`) or reject (`REJECTED`) company with notes |
| `POST`   | `/api/v1/drives/:id/recruiters` | Admin | Associate a secondary recruiter account with company |
| `DELETE` | `/api/v1/drives/:id/recruiters/:rid` | Admin | Disassociate a recruiter from company |
| `GET`    | `/api/v1/drives/internal/:id` | Internal | Synchronous microservice query (`x-service-key`) |

---

## 💼 Job Management Service (Phase 6)

### Core Capabilities
- **Recruitment Drive & Job Creation**: Authorized recruiters (from verified companies) and administrators can create, edit, publish, pause, and delete campus job postings.
- **Configurable Dynamic Eligibility Rules**: No hardcoded business logic. Cutoffs are fully customizable per job posting:
  - Minimum B.Tech CGPA (e.g. `6.5`, `7.0`, `8.0`).
  - Allowed Engineering Branches (`CSE`, `ECE`, `EEE`, `MECH`, `CIVIL`, `CHEM`, `MME`).
  - Eligible Graduation Batches (e.g. `2025`, `2026`).
  - Maximum Active & Historical Backlog thresholds.
  - Secondary (10th) and Higher Secondary (12th/PUC) percentage/CGPA requirements.
  - Mandatory Technical Skills (e.g. Java, Python, SQL, React).
- **Real-Time Eligibility Auditor**: Students can verify their qualifications against any job posting's rules in real-time, receiving an instant pass/fail checklist with granular failure reasons.
- **Multi-Factor Search & Filtering**: Fast full-text search (matching title, company, description, and skills) along with multi-parameter filtering by branch, CGPA, role category, workplace type, location, and compensation.
- **Selection Process Timeline**: Defines selection stages and interview rounds (Online Assessment, Technical Round, HR Discussion).
- **Internal Microservice Synchronous Query**: Exposes `GET /api/v1/jobs/internal/:id` secured via `x-service-key` for downstream microservice synchronization.

### Job Service Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST`   | `/api/v1/jobs` | Recruiter / Admin | Create a new campus job posting |
| `GET`    | `/api/v1/jobs` | Authenticated | List & filter active jobs with pagination |
| `GET`    | `/api/v1/jobs/my` | Recruiter | Retrieve all job postings for recruiter's company |
| `GET`    | `/api/v1/jobs/:id` | Authenticated | Get detailed job specifications, rounds & cutoffs |
| `PUT`    | `/api/v1/jobs/:id` | Owner / Admin | Update job parameters, description, and eligibility |
| `DELETE` | `/api/v1/jobs/:id` | Owner / Admin | Delete job posting and decrement company counter |
| `PATCH`  | `/api/v1/jobs/:id/status` | Owner / Admin | Toggle posting status (`ACTIVE`, `PAUSED`, `DRAFT`, `CLOSED`) |
| `POST`   | `/api/v1/jobs/:id/check-eligibility` | Authenticated | Real-time candidate eligibility evaluation |
| `GET`    | `/api/v1/jobs/internal/:id` | Internal | Synchronous microservice query (`x-service-key`) |

---

## 🎯 Placement Drive Management Service (Phase 7)

### Core Capabilities
- **Placement Drive Orchestration**: Administrators schedule institutional hiring drives, associate verified corporate partners, generate unique drive codes (e.g. `DRV-2026-TCSD-8192`), and configure registration deadlines.
- **Multi-Stage Recruitment Pipeline**:
  - **Aptitude Rounds**: Online cognitive/verbal assessments, duration, and test links.
  - **Technical Interviews**: Multi-round technical interview panels, meeting links, or campus venues.
  - **HR Interviews**: Behavioral fitment, compensation discussions, and document verification.
- **Academic Eligibility Enforcement**: Automatic validation preventing ineligible student registrations (B.Tech CGPA cutoffs, allowed engineering branches, maximum active/historical backlogs, and graduation batch).
- **Duplicate Prevention**: Guaranteed uniqueness enforcing one registration per student per drive.
- **Student Registered Drives Portfolio**: Students view their active drive registrations and track real-time round statuses (`PENDING`, `CLEARED`, `ELIMINATED`).
- **TPO Candidate Roster**: Administrators inspect applicant lists, filter by branch/CGPA, advance candidates through interview rounds, and record evaluator scores/remarks.

### Placement Drive Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST`   | `/api/v1/drives/placement-drives` | Admin | Create &amp; schedule new placement drive |
| `GET`    | `/api/v1/drives/placement-drives` | Authenticated | List drives with filters (branch, status, batch) |
| `GET`    | `/api/v1/drives/placement-drives/:id` | Authenticated | Get full drive details &amp; user registration status |
| `PUT`    | `/api/v1/drives/placement-drives/:id` | Admin | Update drive parameters, deadlines, and cutoffs |
| `DELETE` | `/api/v1/drives/placement-drives/:id` | Admin | Delete placement drive &amp; associated registrations |
| `PATCH`  | `/api/v1/drives/placement-drives/:id/status` | Admin | Update drive lifecycle status |
| `POST`   | `/api/v1/drives/placement-drives/:id/rounds` | Admin | Schedule/update Aptitude, Tech, or HR round |
| `POST`   | `/api/v1/drives/placement-drives/:id/register` | Student | Register for drive with eligibility validation |
| `GET`    | `/api/v1/drives/placement-drives/registrations/my` | Student | Retrieve student's registered drives &amp; round progress |
| `GET`    | `/api/v1/drives/placement-drives/:id/registrations` | Admin | View registered candidate roster for drive |
| `PATCH`  | `/api/v1/drives/placement-drives/:id/registrations/:rid/status` | Admin | Advance candidate round or update status |

---

## 🚦 Phase Status

- **Phase 1: Requirements Analysis and Architecture** — **COMPLETED**
- **Phase 2: Project Initialization and Infrastructure** — **COMPLETED**
- **Phase 3: Authentication and Authorization** — **COMPLETED**
- **Phase 4: Student Management Service** — **COMPLETED**
- **Phase 5: Company & Recruiter Management** — **COMPLETED**
- **Phase 6: Job Management Service** — **COMPLETED**
- **Phase 7: Placement Drive Management** — **COMPLETED** (Pending Approval)
- **Phase 8: Application Service & Selection Workflow** — Pending
- **Phase 9: Notification Service & Message Broker** — Pending
- **Phase 10: End-to-End Integration & Final Polish** — Pending
