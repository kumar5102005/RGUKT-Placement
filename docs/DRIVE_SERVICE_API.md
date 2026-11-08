# Placement Drive Management Service API Documentation

**Service**: `company-drive-service` (Placement Drive Module)  
**Base URL**: `http://localhost:8080/api/v1/drives/placement-drives`  
**Direct Port**: `4003`  
**Database**: `rgukt_drive_db` (Collections: `placement_drives`, `drive_registrations`)  
**Phase**: Phase 7 — Placement Drive Management

---

## Overview

The Placement Drive Management Service coordinates institutional campus recruitment drives at RGUKT Ongole:
- Company association and recruitment drive scheduling.
- Automated eligibility verification preventing ineligible registrations (B.Tech CGPA cutoffs, allowed engineering branches, active backlogs, graduation batch).
- Multi-stage selection rounds:
  - **Aptitude Rounds** (Online cognitive/reasoning assessments, test duration, platform links)
  - **Technical Interviews** (Round 1 & 2 panel discussions, coding, video links or campus venues)
  - **HR Interviews** (Cultural fitment, communication, and document verification)
- Drive status tracking (`DRAFT`, `UPCOMING`, `REGISTRATION_OPEN`, `REGISTRATION_CLOSED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
- Student registration and live round progression monitoring.
- Administrator candidate roster management and round score/status updating.

---

## Authentication & Headers

User requests require a valid JWT Bearer token:
```http
Authorization: Bearer <access_token>
```

Internal service queries require:
```http
x-service-key: <SERVICE_API_KEY>
```

---

## Endpoints

### 1. Create Placement Drive
`POST /api/v1/drives/placement-drives`  
**Access**: `ADMIN` only

**Request Body:**
```json
{
  "title": "TCS Digital Campus Recruitment 2026",
  "companyId": "672d9b1a50a12e84bc912345",
  "academicYear": "2025-2026",
  "batchYear": 2026,
  "venue": "RGUKT Ongole Campus & Virtual",
  "eligibilityCriteria": {
    "minCgpa": 7.0,
    "allowedBranches": ["CSE", "ECE", "EEE"],
    "maxActiveBacklogs": 0,
    "maxHistoryBacklogs": 2,
    "minTenthPercentage": 60,
    "minPucCgpa": 6.5
  },
  "registrationWindow": {
    "openDate": "2026-11-08T00:00:00.000Z",
    "closeDate": "2026-11-20T23:59:59.000Z"
  },
  "recruitmentRounds": [
    {
      "roundNumber": 1,
      "roundType": "APTITUDE",
      "name": "Online Cognitive & Technical Test",
      "mode": "ONLINE",
      "venueOrLink": "https://assessment.tcsion.com",
      "instructions": "90 minutes online assessment covering Numerical, Verbal, and Advanced Coding."
    },
    {
      "roundNumber": 2,
      "roundType": "TECHNICAL_INTERVIEW",
      "name": "Technical Interview",
      "mode": "ONLINE",
      "venueOrLink": "MS Teams Panel 3",
      "instructions": "Data Structures, System Design, and Projects."
    },
    {
      "roundNumber": 3,
      "roundType": "HR_INTERVIEW",
      "name": "HR Discussion",
      "mode": "IN_PERSON",
      "venueOrLink": "Placement Cell Board Room",
      "instructions": "Communication, behavioral assessment, and document verification."
    }
  ],
  "driveStatus": "REGISTRATION_OPEN"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Placement drive created and scheduled successfully.",
  "data": {
    "drive": {
      "_id": "672da9876543210fedcba987",
      "title": "TCS Digital Campus Recruitment 2026",
      "driveCode": "DRV-2026-TCSD-8192",
      "companyName": "Tata Consultancy Services",
      "driveStatus": "REGISTRATION_OPEN",
      "registeredStudentsCount": 0,
      "createdAt": "2026-11-08T00:00:00.000Z"
    }
  }
}
```

---

### 2. List Placement Drives
`GET /api/v1/drives/placement-drives`  
**Access**: Authenticated (`STUDENT`, `ADMIN`, `RECRUITER`).

**Query Parameters:**
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `q` | string | Keyword search matching title, company, or driveCode |
| `status` | string | Filter by drive status (`REGISTRATION_OPEN`, `IN_PROGRESS`, etc.) |
| `branch` | string | Filter by eligible branch (`CSE`, `ECE`, etc.) |
| `batchYear` | number | Graduation batch (e.g. `2026`) |
| `academicYear` | string | Academic year (e.g. `2025-2026`) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 10) |

---

### 3. Get Single Drive Details
`GET /api/v1/drives/placement-drives/:id`  
**Access**: Authenticated.  
*Returns drive metadata, round schedule, and the requesting student's registration status if registered.*

---

### 4. Schedule or Add Recruitment Round
`POST /api/v1/drives/placement-drives/:id/rounds`  
**Access**: `ADMIN` only

**Request Body:**
```json
{
  "roundNumber": 2,
  "roundType": "TECHNICAL_INTERVIEW",
  "name": "Technical Interview - Systems",
  "mode": "ONLINE",
  "scheduledDate": "2026-11-28T09:30:00.000Z",
  "venueOrLink": "https://meet.google.com/abc-defg-hij",
  "instructions": "Be ready with camera on and code editor open."
}
```

---

### 5. Register Student for Placement Drive
`POST /api/v1/drives/placement-drives/:id/register`  
**Access**: `STUDENT` only.

**Validation Gatekeeper:**
1. Validates drive is accepting registrations and current date is before `registrationWindow.closeDate`.
2. Validates student has not already registered (enforces uniqueness on `{ driveId, studentUserId }`).
3. Enforces academic cutoffs against student profile:
   - `student.btechCgpa >= eligibilityCriteria.minCgpa`
   - `eligibilityCriteria.allowedBranches.includes(student.branch)`
   - `student.activeBacklogs <= eligibilityCriteria.maxActiveBacklogs`

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Successfully registered for the placement drive! Good luck with your preparation.",
  "data": {
    "registration": {
      "_id": "672db1122334455667788990",
      "driveId": "672da9876543210fedcba987",
      "studentId": "O180123",
      "studentName": "Phani Kumar",
      "branch": "CSE",
      "status": "REGISTERED",
      "roundProgress": [
        { "roundNumber": 1, "roundName": "Online Cognitive & Technical Test", "status": "PENDING" },
        { "roundNumber": 2, "roundName": "Technical Interview", "status": "PENDING" },
        { "roundNumber": 3, "roundName": "HR Discussion", "status": "PENDING" }
      ]
    }
  }
}
```

**Ineligibility Rejection Response (422 Unprocessable Entity):**
```json
{
  "success": false,
  "error": {
    "code": "INELIGIBLE_FOR_DRIVE",
    "message": "You do not meet the academic eligibility criteria for this placement drive.",
    "details": [
      "Your B.Tech CGPA (6.8) is below required minimum of 7.0.",
      "Branch 'CIVIL' is not eligible. Allowed branches: CSE, ECE, EEE."
    ]
  }
}
```

---

### 6. Student Registered Drives
`GET /api/v1/drives/placement-drives/registrations/my`  
**Access**: `STUDENT` only.  
Returns list of all drives the authenticated student is registered for, including round progress status.

---

### 7. Admin Candidate Roster & Round Advancement
- `GET /api/v1/drives/placement-drives/:id/registrations`  
  List all registered students for a drive.
- `PATCH /api/v1/drives/placement-drives/:id/registrations/:registrationId/status`  
  Update overall candidate status (`SHORTLISTED`, `OFFERED`, `REJECTED`) or individual round status (`CLEARED`, `ELIMINATED`, `ABSENT`).

---

## Round Types Taxonomy

| Round Type | Description | Typical Format |
| :--- | :--- | :--- |
| `APTITUDE` | Quantitative, logical reasoning, and verbal assessment | Online proctored platform |
| `CODING_TEST` | Hands-on data structures & algorithms programming | Online coding environment |
| `TECHNICAL_INTERVIEW` | Engineering domain, system architecture & problem solving | Virtual meeting or campus panel |
| `HR_INTERVIEW` | Behavioral fitment, communication & document verification | In-person interview |
| `GROUP_DISCUSSION` | Communication and collaborative problem analysis | In-person or virtual panel |

