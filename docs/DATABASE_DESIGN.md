# RGUKT Ongole Placement Hub - Database Architecture

## 1. Architectural Principles

1. **Database-Per-Service**:
   - Each microservice has an exclusive connection string pointing to its dedicated MongoDB database container.
   - Microservices **NEVER** perform cross-database queries (`$lookup` across DBs) or connect to another service's database.
2. **Polyglot Independence**:
   - Schema modifications in one service never break or require migration of another service's database.
3. **Data Consistency Strategy**:
   - Eventual consistency is maintained via domain events emitted through RabbitMQ.
   - Redundant snapshot data (e.g. `studentName`, `companyName`, `driveTitle`) is denormalized where read efficiency demands it, without sacrificing source-of-truth integrity.

---

## 2. Microservice Databases & Schemas

### A. Auth Service Database (`rgukt_auth_db`)
- **Container**: `auth-db`
- **Port**: `27017`

#### Collections:
1. `users`
   ```javascript
   {
     _id: ObjectId,
     email: String,          // Unique, lowercase, indexed (e.g. o180001@rguktong.ac.in)
     passwordHash: String,   // Salted hash
     role: String,           // Enum: "STUDENT", "ADMIN", "RECRUITER"
     status: String,         // ACTIVE, INACTIVE, SUSPENDED, PENDING_APPROVAL
     studentId: String,      // Lowercase RGUKT ID; unique sparse index for student accounts
     companyName: String,    // Optional recruiter organization name
     lastLoginAt: Date,
     createdAt: Date,
     updatedAt: Date
   }
   ```
   - **Indexes**:
     - `email`: Unique index
     - `role`: Filter index

2. `refresh_tokens`
   ```javascript
   {
     _id: ObjectId,
     userId: ObjectId,       // Reference to users._id
     tokenHash: String,      // Hashed refresh token
     expiresAt: Date,
     isRevoked: Boolean,
     createdAt: Date
   }
   ```
   - **Indexes**:
     - `expiresAt`: TTL Index (auto-expire expired tokens)
     - `userId`: Lookup index

---

### B. Student Service Database (`rgukt_student_db`)
- **Container**: `student-db`
- **Port**: `27017`

#### Collections:
1. `student_profiles`
   ```javascript
   {
     _id: ObjectId,
     userId: String,         // Global auth userId (indexed, unique)
     studentId: String,      // Lowercase RGUKT ID, e.g. "o180123" (indexed, unique)
     fullName: String,
     gender: String,         // "MALE", "FEMALE", "OTHER"
     phone: String,
     branch: String,         // Optional until provided; RGUKT branch enum
     batchYear: Number,      // Optional graduation year
     tenthPercentage: Number,
     pucCgpa: Number,
     btechCgpa: Number,      // Indexed for eligibility queries
     activeBacklogs: Number, // Indexed for eligibility queries
     backlogHistory: Number,
     resumeUrl: String,         // Authenticated profile download route
     resumeDocumentId: String,  // Current immutable ResumeDocument._id
     resumeFileName: String,    // Current private storage key
     resumeVersions: [          // Historical metadata only; bytes are not duplicated
       {
         documentId: String,
         fileName: String,
         storageKey: String,
         originalName: String,
         mimeType: String,
         uploadedAt: Date
       }
     ],
     portfolioUrl: String,
     githubUrl: String,
     linkedinUrl: String,
     technicalSkills: [String],
     nonTechnicalSkills: [String],
     verificationStatus: String, // "PENDING", "VERIFIED", "REJECTED"
     verifiedBy: String,     // Admin ID
     verifiedAt: Date,
     createdAt: Date,
     updatedAt: Date
   }
   ```
   - **Indexes**:
     - `{ studentId: 1 }`: Unique
     - `{ userId: 1 }`: Unique
     - `{ branch: 1, btechCgpa: -1 }`: Compound index for filtering
     - `{ activeBacklogs: 1 }`: Index for eligibility filtering

2. `resumedocuments`
   ```javascript
   {
     _id: ObjectId,
     userId: String,       // Owning student account
     storageKey: String,   // Unique, immutable object key
     originalName: String,
     mimeType: String,
     size: Number,        // May be absent for legacy documents
     sha256: String,      // Empty for legacy documents without a recorded digest
     uploadedAt: Date
   }
   ```
   ResumeDocument owns the immutable version metadata. The document bytes live in the configured private storage provider (local persistent volume in development or private S3 in production).

---

### C. Company & Drive Service Database (`rgukt_drive_db`)
- **Container**: `drive-db`
- **Port**: `27017`

#### Collections:
1. `companies`
   ```javascript
   {
     _id: ObjectId,
     name: String,           // e.g. "Infosys", "TCS"
     website: String,
     industry: String,       // e.g. "IT Services", "Core Engineering"
     description: String,
     logoUrl: String,
     contactEmail: String,
     createdAt: Date,
     updatedAt: Date
   }
   ```
   - **Indexes**:
     - `{ name: 1 }`: Unique
   - Recruiter associations contain the Auth Service `userId`, account name/email, designation, role, and active status. New associations never create credentials; the legacy password field is excluded from Company Service API reads.

2. `placement_drives`
   ```javascript
   {
     _id: ObjectId,
     companyId: ObjectId,    // References companies._id
     companyName: String,    // Denormalized for rapid listing
     companyLogo: String,
     title: String,          // e.g. "Software Development Engineer"
     roleCategory: String,   // "Full-time", "Internship", "Intern + PPO"
     jobLocation: String,
     packageCtc: {
       minLpa: Number,
       maxLpa: Number,
       stipendPerMonth: Number
     },
     eligibility: {
       minCgpa: Number,             // e.g. 7.5
       allowedBranches: [String],   // ["CSE", "ECE"]
       maxBacklogs: Number,         // e.g. 0
       eligibleBatchYear: Number    // e.g. 2026
     },
     rounds: [
       {
         roundNumber: Number,
         name: String,              // "Online Assessment", "Technical", "HR"
         scheduledDate: Date
       }
     ],
     status: String,         // "DRAFT", "PUBLISHED", "CLOSED", "COMPLETED"
     registrationDeadline: Date,
     driveDate: Date,
     description: String,
     createdAt: Date,
     updatedAt: Date
   }
   ```
   - **Indexes**:
     - `{ status: 1, registrationDeadline: 1 }`: Compound index for active drives
     - `{ "eligibility.allowedBranches": 1, "eligibility.minCgpa": 1 }`: Student eligibility filter

---

### D. Application Service Database (`rgukt_application_db`)
- **Container**: `application-db`
- **Port**: `27017`

#### Collections:
1. `applications`
   ```javascript
   {
     _id: ObjectId,
     driveId: String,          // Company & Drive service driveId (indexed)
     studentId: String,        // Student service studentId (indexed)
     userId: String,           // Auth userId
     studentName: String,      // Denormalized snapshot
     studentBranch: String,    // Denormalized snapshot
     studentCgpa: Number,      // Denormalized snapshot
     companyName: String,      // Denormalized snapshot
     driveTitle: String,       // Denormalized snapshot
     resumeUrl: String,        // Authenticated application download route
     resumeDocumentId: String, // Exact ResumeDocument._id submitted
     resumeStorageKey: String, // Immutable storage key captured at submission
     resumeFileName: String,   // Legacy-compatible key field
     resumeOriginalName: String,
     resumeMimeType: String,
     resumeSnapshotAt: Date,
     status: String,           // "APPLIED", "SHORTLISTED", "OA_CLEARED", "INTERVIEW_CLEARED", "OFFERED", "REJECTED"
     recruitmentRounds: [
       {
         roundNumber: Number,
         name: String,
         description: String,
         mode: String,
         scheduledDate: Date,
         durationMinutes: Number,
         venueOrLink: String,
         status: String
       }
     ],
     currentRound: Number,     // e.g. 1
     appliedAt: Date,
     stageHistory: [
       {
         stage: String,
         updatedBy: String,    // Admin/Coordinator ID
         updatedAt: Date,
         notes: String
       }
     ],
     offerDetails: {
       ctcLpa: Number,
       offerLetterUrl: String,
       offerDate: Date
     },
     createdAt: Date,
     updatedAt: Date
   }
   ```
   - **Indexes**:
     - `{ driveId: 1, studentId: 1 }`: **Unique Compound Index** (Enforces single application per student per drive)
     - `{ studentId: 1, status: 1 }`: Student application history index
     - `{ driveId: 1, status: 1 }`: Drive applicant filtering index

---

### E. Notification Service Database (`rgukt_notification_db`)
- **Container**: `notification-db`
- **Port**: `27017`

#### Collections:
1. `notifications`
   ```javascript
   {
     _id: ObjectId,
     userId: String,         // Recipient userId (indexed)
     title: String,
     message: String,
     type: String,           // "DRIVE_ALERT", "STATUS_UPDATE", "DEADLINE_REMINDER", "SYSTEM"
     relatedEntity: {
       entityType: String,   // "DRIVE", "APPLICATION"
       entityId: String
     },
     isRead: Boolean,        // Default: false
     readAt: Date,
     createdAt: Date         // Indexed for recency sorting
   }
   ```
   - **Indexes**:
     - `{ userId: 1, isRead: 1, createdAt: -1 }`: User inbox query index
     - `{ createdAt: 1 }`: TTL index (auto-purge notifications after 90 days)
