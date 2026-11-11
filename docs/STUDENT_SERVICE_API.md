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
- **File Size Limit**: `10 MB`
- The service validates the file signature and derives the stored content type from the accepted extension; the client-supplied MIME type is not trusted.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Resume uploaded successfully",
    "data": {
      "resumeUrl": "/api/v1/students/O180555/resume",
      "originalName": "SaiKumar_Resume_2026.pdf",
      "sizeBytes": 245120,
      "completionPercentage": 100
    }
  }
  ```
- The returned URL is a private authenticated route, not a public static file URL.
- `GET /api/v1/students/profile/resume` lets the authenticated student download their current resume. `GET /api/v1/students/:profileId/resume` is available to the owning student or an admin; `profileId` may be the profile Mongo `_id` or student ID.
- Each upload is stored under a unique immutable key and recorded as a `ResumeDocument` owned by the authenticated student. The profile points to its current document; earlier versions remain in the document collection and are not deleted when the profile changes.
- Internal services may retrieve an exact version with `GET /api/v1/students/internal/:userId/resume?documentId=<resume-document-id>` and the `x-service-key` header. Legacy references may use `fileName`; they are accepted only when the key belongs to that student's recorded profile history and the object exists.
- Internal services may validate a reference with `GET /api/v1/students/internal/:userId/resume-reference?documentId=<resume-document-id>` and the `x-service-key` header. The response includes the verified owner, immutable key, document ID, and content metadata; it does not return the file.
- Local development uses `RESUME_STORAGE_PROVIDER=local` and stores objects under `RESUME_UPLOAD_DIR` (default `uploads/resumes`). Docker Compose mounts this directory in the persistent `student_uploads` named volume. Keep that volume when recreating containers; a newly created volume will not contain earlier files.
- Production may set `RESUME_STORAGE_PROVIDER=s3`, `RESUME_S3_BUCKET`, and `RESUME_S3_REGION`. Attach an IAM role granting only the required `s3:PutObject`, `s3:GetObject`, and `s3:HeadObject` actions for the resume bucket/prefix. Do not configure public ACLs or public bucket access; enable S3 Block Public Access and route all downloads through the authenticated Student Service. The service uses the AWS SDK credential provider chain and never returns an S3 URL.

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

`:id` is the Mongo `_id` returned with the student profile/search result, not the student's university ID or auth user ID.

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
- **Description**: Returns the student-service-owned profile fields used by job and placement-drive eligibility evaluation. Academic values are omitted when not provided; missing values are never replaced with fabricated defaults.
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
      "tenthPercentage": 88.5,
      "pucCgpa": 9.1,
      "btechCgpa": 8.85,
      "activeBacklogs": 0,
      "backlogHistory": 1,
      "gender": "FEMALE",
      "technicalSkills": ["Java", "SQL"],
      "nonTechnicalSkills": ["Communication"],
      "resumeUrl": "/api/v1/students/O180555/resume",
      "verificationStatus": "VERIFIED",
      "placementStatus": "NOT_PLACED"
    }
  }
  ```
