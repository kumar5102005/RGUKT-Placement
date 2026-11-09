# Job Management Service API Documentation

**Service**: `company-drive-service` (Job Management Module)  
**Base URL**: `http://localhost:8080/api/v1/jobs` (via NGINX API Gateway)  
**Alternative Gateway Path**: `http://localhost:8080/api/v1/drives/jobs`  
**Direct Port**: `4003`  
**Database**: `rgukt_drive_db` (MongoDB - collection: `jobs`)  

---

## Overview

The Job Management Service handles the end-to-end lifecycle of campus recruitment postings for RGUKT Ongole:
- Job posting creation, editing, and deletion by authorized recruiters and administrators.
- Configurable eligibility criteria (Minimum CGPA, allowed branches, eligible batch years, active/historical backlogs, 10th standard percentage, PUC/12th CGPA, and mandatory technical competencies).
- Full-text search and multi-parameter filtering (by branch, CGPA cutoff, employment type, workplace, location, salary range).
- Real-time candidate eligibility evaluation endpoint.
- Internal service query interface (`x-service-key`) for downstream integration with the Application Service.

---

## Authentication & Headers

All user endpoints require a Bearer JWT Token:
```http
Authorization: Bearer <access_token>
```

Internal service-to-service endpoints require the internal service key:
```http
x-service-key: <SERVICE_API_KEY>
```

---

## Endpoints

### 1. Health Check
`GET /health`  
Public endpoint returning service status and database connectivity.

**Response (200 OK):**
```json
{
  "status": "ok",
  "service": "company-drive-service",
  "timestamp": "2026-11-08T00:00:00.000Z",
  "uptime": 1420.35,
  "database": {
    "status": "connected",
    "name": "rgukt_drive_db"
  }
}
```

---

### 2. Create Job Posting
`POST /api/v1/jobs`  
**Access**: `RECRUITER` (for own verified company) or `ADMIN` (for any company).

**Request Body:**
```json
{
  "title": "Software Development Engineer - Trainee",
  "roleCategory": "Full-Time",
  "workplaceType": "On-site",
  "locations": ["Ongole", "Hyderabad"],
  "description": "We are seeking ambitious B.Tech graduates to join our Core Engineering team.",
  "responsibilities": [
    "Design and develop backend microservices in Node.js / Java",
    "Collaborate with cross-functional product and QA teams",
    "Participate in code reviews and cloud deployments"
  ],
  "requirements": [
    "Strong foundation in Data Structures, Algorithms, and OOP concepts",
    "Proficiency with modern web frameworks and database design"
  ],
  "requiredSkills": ["Java", "SQL", "Data Structures"],
  "preferredSkills": ["Docker", "Spring Boot", "React"],
  "salary": {
    "minLpa": 7.0,
    "maxLpa": 12.0,
    "stipendPerMonth": 35000,
    "currency": "INR",
    "breakup": "Base 8.5 LPA + Performance Bonus 2.5 LPA + Retaining Bonus 1.0 LPA"
  },
  "eligibility": {
    "minCgpa": 7.0,
    "allowedBranches": ["CSE", "ECE", "EEE"],
    "eligibleBatchYears": [2025, 2026],
    "maxActiveBacklogs": 0,
    "maxHistoryBacklogs": 2,
    "minTenthPercentage": 60,
    "minTwelfthPucCgpa": 6.5,
    "genderPreference": "All",
    "requiredSkills": ["Java", "SQL"]
  },
  "selectionRounds": [
    {
      "roundNumber": 1,
      "name": "Online Aptitude & Coding Test",
      "description": "Complete the timed assessment.",
      "mode": "Online",
      "scheduledDate": "2026-11-26T09:00:00.000Z",
      "durationMinutes": 90,
      "venueOrLink": "https://assessment.example.com",
      "status": "SCHEDULED"
    },
    {
      "roundNumber": 2,
      "name": "Technical Interview",
      "mode": "Online",
      "status": "PLANNED"
    }
  ],
  "applicationDeadline": "2026-11-25T23:59:59.000Z",
  "driveDate": "2026-12-01T09:00:00.000Z",
  "status": "ACTIVE",
  "companyId": "672d9b1a50a12e84bc912345" // Required only when posted by ADMIN
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Job posting created successfully.",
  "data": {
    "job": {
      "_id": "672da123456789abcdef0123",
      "companyId": "672d9b1a50a12e84bc912345",
      "companyName": "TechCorp Global",
      "title": "Software Development Engineer - Trainee",
      "slug": "techcorp-global-software-development-engineer-trainee-kx8192",
      "status": "ACTIVE",
      "totalApplicants": 0,
      "createdAt": "2026-11-08T00:00:00.000Z"
    }
  }
}
```

---

### 3. List & Filter Job Postings
`GET /api/v1/jobs`  
**Access**: Authenticated (`STUDENT`, `RECRUITER`, `ADMIN`).  
*Note*: Students automatically receive only `ACTIVE` job postings whose application deadline is open.

**Query Parameters:**
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `q` | string | Keyword search matching title, company, description, or skills |
| `branch` | string | Allowed branch filter (`CSE`, `ECE`, `EEE`, `MECH`, `CIVIL`, `CHEM`, `MME`) |
| `minCgpa` | number | Returns jobs whose minimum CGPA cutoff is `<= minCgpa` |
| `maxBacklogs` | number | Returns jobs whose allowed backlogs is `>= maxBacklogs` |
| `batchYear` | number | Graduation batch (e.g. `2026`) |
| `roleCategory` | string | `Full-Time`, `Internship`, `Internship + PPO`, `Contract` |
| `workplaceType` | string | `On-site`, `Hybrid`, `Remote` |
| `city` | string | Job location search (e.g. `Hyderabad`) |
| `minSalary` | number | Minimum package threshold in LPA |
| `status` | string | `ACTIVE`, `DRAFT`, `PAUSED`, `CLOSED` (Recruiters & Admins) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 10, max: 50) |
| `sortBy` | string | `createdAt`, `applicationDeadline`, `salary.maxLpa`, `title` |
| `sortOrder` | string | `asc` or `desc` (default: `desc`) |

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "jobs": [ ... ],
    "pagination": {
      "total": 24,
      "page": 1,
      "limit": 10,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

### 4. Get Recruiter's Company Jobs
`GET /api/v1/jobs/my`  
**Access**: `RECRUITER`  
Returns all job postings associated with the recruiter's company, including drafts and closed drives.

---

### 5. Get Job Details by ID
`GET /api/v1/jobs/:id`  
**Access**: Authenticated  
Returns complete job specifications and company snapshot. Students receive the round outline; full schedules and venues are available to applicants in their application records.

---

### 6. Update Job Posting
`PUT /api/v1/jobs/:id`  
**Access**: `ADMIN` or the owning `RECRUITER`.  
Allows modifying title, package, deadlines, description, and eligibility cutoffs.
Round updates are synchronized to applications and trigger idempotent applicant notifications. If synchronization fails, the job is saved and the API returns `RECRUITMENT_ROUND_SYNC_FAILED`; resubmitting an update retries the pending synchronization.

---

### 7. Delete Job Posting
`DELETE /api/v1/jobs/:id`  
**Access**: `ADMIN` or the owning `RECRUITER`.  
Removes the job document and decrements the company's placement drive counter.

---

### 8. Quick Status Toggle
`PATCH /api/v1/jobs/:id/status`  
**Access**: `ADMIN` or the owning `RECRUITER`.

**Request Body:**
```json
{
  "status": "CLOSED" // ACTIVE, DRAFT, PAUSED, CLOSED
}
```

---

### 9. Real-Time Eligibility Evaluator
`POST /api/v1/jobs/:id/check-eligibility`  
**Access**: Authenticated (`STUDENT`, `RECRUITER`, `ADMIN`).

**Request Body:** No student academic data is accepted from the browser. The service loads the authenticated student's profile from Student Service.
```json
{}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "jobId": "672da123456789abcdef0123",
    "jobTitle": "Software Development Engineer - Trainee",
    "companyName": "TechCorp Global",
    "eligibilityRules": { ... },
    "evaluation": {
      "status": "ELIGIBLE",
      "eligible": true,
      "isEligible": true,
      "reasons": [],
      "criteria": {
        "cgpa": { "required": 7.0, "actual": 7.45, "status": "PASS", "passed": true },
        "branch": { "required": ["CSE", "ECE", "EEE"], "actual": "CSE", "status": "PASS", "passed": true }
      }
    }
  }
}
```

Evaluation status is `ELIGIBLE`, `NOT_ELIGIBLE`, or `INSUFFICIENT_DATA`. `INSUFFICIENT_DATA` means a required academic value is missing or invalid; it is not treated as an eligible result. Detailed round schedules and venues are returned to applicants in their application records, while the public student job response contains only round names, descriptions, and modes.

---

### 10. Internal Microservice Synchronous Query
`GET /api/v1/jobs/internal/:id`  
**Auth**: Header `x-service-key: <SERVICE_API_KEY>`  
Used by the Application Service to verify drive validity, deadlines, and eligibility before accepting an application.

---

## Configurable Eligibility Rules Architecture

All eligibility rules are dynamically stored on each Job document and verified at runtime:
1. **No Hardcoded Business Rules**: Every parameter (CGPA cutoff, allowed engineering branches, backlogs, batch year, skill prerequisites) can be configured independently per posting.
2. **Standardized Branch Vocabulary**:
   - `CSE`: Computer Science & Engineering
   - `ECE`: Electronics & Communication Engineering
   - `EEE`: Electrical & Electronics Engineering
   - `MECH`: Mechanical Engineering
   - `CIVIL`: Civil Engineering
   - `CHEM`: Chemical Engineering
   - `MME`: Metallurgical & Materials Engineering
3. **Database Performance**:
   - Compound indexes on `{ status: 1, applicationDeadline: 1 }`
   - Multikey indexes on `{ "eligibility.allowedBranches": 1 }` and `{ "eligibility.eligibleBatchYears": 1 }`
   - Full-text search index across `title`, `companyName`, `description`, and `requiredSkills`.
