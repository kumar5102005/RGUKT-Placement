# RGUKT Ongole Placement Hub - Student Management Service API Documentation

## 1. Overview

The Student Management Service (`student-service`) owns student academic records, branch information, CGPA, semester SGPA history, backlog tracking, technical/non-technical skill sets, project portfolios, resume document uploads, dynamic profile completion metrics, and TPO administrative verification.

- **Gateway URL**: `http://localhost:8080/api/v1/students`
- **Internal Microservice Port**: `4002`
- **Independent Database**: `mongodb://student-db:27017/rgukt_student_db`
- **Database Ownership**: Strict Database-per-Service (Exclusive access to `rgukt_student_db`)

---

## 2. Profile Completion Algorithm

The service computes a dynamic completion score (0 - 100%) every time a profile or resume is updated:

| Category | Maximum Points | Conditions |
| :--- | :--- | :--- |
| **Personal Information** | 20% | Full Name (5%), Email (5%), Phone (5%), Gender (2.5%), DOB (2.5%) |
| **Academic Performance** | 25% | Branch (5%), Batch Year (5%), 10th % (5%), PUC CGPA (5%), B.Tech CGPA > 0 (5%) |
| **Semester History** | 10% | At least 1 semester SGPA record registered |
| **Skills & Competencies** | 15% | ≥ 2 Technical Skills (10%), ≥ 1 Non-Technical Skill (5%) |
| **Projects & Links** | 15% | ≥ 1 Project (10%), Professional portfolio link present (5%) |
| **Resume Document** | 15% | Valid PDF/DOC/DOCX resume uploaded to server |
| **Total** | **100%** | Comprehensive placement-ready score |

---

## 3. API Endpoints

### A. Get Own Student Profile
`GET /api/v1/students/profile`

- **Access**: `STUDENT`, `ADMIN` (Bearer JWT)
- **Description**: Returns the profile of the authenticated student. If no profile exists yet, auto-initializes a seeded draft.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "profile": {
        "userId": "6724a1b0c9e0a12345678001",
        "studentId": "O180555",
        "fullName": "K. Sai Kumar",
        "email": "o180555@rguktong.ac.in",
        "branch": "CSE",
        "batchYear": 2026,
        "btechCgpa": 8.85,
        "activeBacklogs": 0,
        "backlogHistory": 0,
        "technicalSkills": ["React", "Node.js", "MongoDB"],
        "nonTechnicalSkills": ["Problem Solving"],
        "completionPercentage": 85,
        "verificationStatus": "VERIFIED",
        "placementStatus": "NOT_PLACED"
      }
    }
  }
  ```

---

### B. Update Student Profile
`PUT /api/v1/students/profile`

- **Access**: `STUDENT`, `ADMIN` (Bearer JWT)
- **Request Body**:
  ```json
  {
    "fullName": "K. Sai Kumar",
    "phone": "+91 9876543210",
    "gender": "MALE",
    "dateOfBirth": "2002-05-15",
    "branch": "CSE",
    "batchYear": 2026,
    "tenthPercentage": 92.5,
    "pucCgpa": 9.4,
    "btechCgpa": 8.85,
    "activeBacklogs": 0,
    "backlogHistory": 0,
    "semesters": [
      { "semesterNumber": 1, "sgpa": 8.9, "creditsCompleted": 22, "hasBacklog": false },
      { "semesterNumber": 2, "sgpa": 8.8, "creditsCompleted": 24, "hasBacklog": false }
    ],
    "technicalSkills": ["JavaScript", "React", "Node.js", "MongoDB", "Docker"],
    "nonTechnicalSkills": ["Leadership", "Communication"],
    "projects": [
      {
        "title": "Placement Hub Microservices",
        "description": "Full-stack university recruitment portal",
        "technologies": ["React", "Express", "MongoDB"],
        "githubUrl": "https://github.com/saikumar/placement-hub"
      }
    ],
    "certifications": [
      {
        "name": "AWS Certified Cloud Practitioner",
        "issuingOrganization": "Amazon Web Services",
        "credentialUrl": "https://aws.amazon.com/verification/123"
      }
    ],
    "linkedinUrl": "https://linkedin.com/in/sai-kumar",
    "githubUrl": "https://github.com/sai-kumar"
  }
  ```
- **Response `200 OK`**: Returns updated profile and newly recalculated `completionPercentage`.

---

### C. Resume File Upload
`POST /api/v1/students/profile/resume`

- **Access**: `STUDENT` (Bearer JWT)
- **Content-Type**: `multipart/form-data`
- **Field Name**: `resume`
- **Allowed Formats**: `.pdf`, `.doc`, `.docx`
- **File Size Limit**: `5 MB`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Resume uploaded successfully",
    "data": {
      "resumeUrl": "/uploads/resumes/O180555-1731000000000-123456.pdf",
      "originalName": "SaiKumar_Resume_2026.pdf",
      "sizeBytes": 245120,
      "completionPercentage": 100
    }
  }
  ```

---

### D. Academic Eligibility Evaluation
`GET /api/v1/students/eligibility-check?minCgpa=7.5&allowedBranches=CSE,ECE&maxBacklogs=0&eligibleBatchYear=2026`

- **Access**: `STUDENT` (Bearer JWT)
- **Response `200 OK` (Eligible Candidate)**:
  ```json
  {
    "success": true,
    "data": {
      "isEligible": true,
      "checks": {
        "cgpaEligible": true,
        "branchEligible": true,
        "backlogsEligible": true,
        "batchEligible": true,
        "verifiedProfile": true
      },
      "reasons": [],
      "academicSnapshot": {
        "studentId": "O180555",
        "fullName": "K. Sai Kumar",
        "branch": "CSE",
        "batchYear": 2026,
        "btechCgpa": 8.85,
        "activeBacklogs": 0,
        "verificationStatus": "VERIFIED",
        "hasResume": true
      }
    }
  }
  ```

---

### E. Search Students (Admin Only)
`GET /api/v1/students/search?branch=CSE&minCgpa=8.0&maxBacklogs=0&verificationStatus=VERIFIED&page=1&limit=20`

- **Access**: `ADMIN` (Bearer JWT)
- **Query Parameters**:
  - `search`: Case-insensitive text match on `fullName`, `studentId`, `email`.
  - `branch`: Filter by department (`CSE`, `ECE`, `EEE`, `MECH`, `CIVIL`, `CHEM`, `MME`).
  - `minCgpa`: Minimum B.Tech CGPA cutoff filter.
  - `maxBacklogs`: Maximum allowed active backlogs.
  - `batchYear`: Passing out year.
  - `verificationStatus`: `PENDING`, `VERIFIED`, `REJECTED`.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "students": [...]
    },
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 65,
      "totalPages": 4
    }
  }
  ```

---

### F. Verify Student Profile (Admin Only)
`PATCH /api/v1/students/:id/verify`

- **Access**: `ADMIN` (Bearer JWT)
- **Request Body**:
  ```json
  {
    "verificationStatus": "VERIFIED",
    "verificationNotes": "Grade sheets and identity verified against university records."
  }
  ```
- **Response `200 OK`**: Profile marked as `VERIFIED`.

---

### G. Internal Service Academic Query
`GET /api/v1/students/internal/:id`

- **Access**: Internal Microservice Call (Requires `x-service-key`)
- **Description**: Synchronous query executed by `application-service` during drive application submission to verify eligibility without cross-database access.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "studentId": "O180555",
      "userId": "6724a1b0c9e0a12345678001",
      "fullName": "K. Sai Kumar",
      "email": "o180555@rguktong.ac.in",
      "branch": "CSE",
      "batchYear": 2026,
      "btechCgpa": 8.85,
      "activeBacklogs": 0,
      "resumeUrl": "/uploads/resumes/O180555-12345.pdf",
      "verificationStatus": "VERIFIED",
      "placementStatus": "NOT_PLACED"
    }
  }
  ```

