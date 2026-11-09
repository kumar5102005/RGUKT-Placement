# Company Service API Documentation

**Service**: `company-drive-service`  
**Base URL**: `http://localhost:8080/api/v1/drives` (via NGINX Gateway)  
**Direct Port**: `4003`  
**Database**: `rgukt_drive_db` (MongoDB)  

---

## Authentication

All endpoints require a JWT Bearer token (except `/health` and internal endpoints):

```
Authorization: Bearer <access_token>
```

Internal endpoints require:
```
x-service-key: <SERVICE_API_KEY>
```

---

## Endpoints

### Health Check

**GET** `/health`

No authentication required.

**Response:**
```json
{
  "status": "ok",
  "service": "company-drive-service",
  "timestamp": "2026-11-08T00:00:00.000Z",
  "uptime": 1234.56,
  "database": { "status": "connected", "name": "rgukt_drive_db" }
}
```

---

### Register Company

**POST** `/api/v1/drives`

**Role**: `RECRUITER` only  
**Note**: Each recruiter can only register one company.

**Request Body:**
```json
{
  "name": "Accenture India Pvt. Ltd.",
  "industry": "IT Services",
  "description": "Global professional services company.",
  "contactEmail": "hr@accenture.com",
  "contactPhone": "+91 40 1234 5678",
  "hrName": "Priya Sharma",
  "websiteUrl": "https://www.accenture.com",
  "logoUrl": "https://logo.example.com/accenture.png",
  "linkedinUrl": "https://linkedin.com/company/accenture",
  "glassdoorUrl": "https://glassdoor.com/company/accenture",
  "location": {
    "city": "Hyderabad",
    "state": "Telangana",
    "country": "India"
  }
}
```

**Required Fields**: `name`, `industry`, `contactEmail`

**Industries Enum:**
- `IT Services`, `Software Product`, `Core Engineering`, `Banking & Finance`
- `Consulting`, `Healthcare`, `E-Commerce`, `Manufacturing`
- `Telecommunications`, `Education & Ed-Tech`, `Government & PSU`
- `Research & Development`, `Other`

**Response (201):**
```json
{
  "success": true,
  "message": "Company registered successfully. Awaiting admin verification.",
  "data": { "company": { ...companyObject } }
}
```

**Error Codes:**
- `409 COMPANY_ALREADY_REGISTERED` — Recruiter already has a company
- `409 COMPANY_NAME_TAKEN` — Name already in use
- `422 VALIDATION_ERROR` — Validation failed

---

### Get Own Company (Recruiter)

**GET** `/api/v1/drives/my`

**Role**: `RECRUITER` only

**Response (200):**
```json
{
  "success": true,
  "data": { "company": { ...companyObject } }
}
```

**Error**: `404 COMPANY_NOT_FOUND` if not registered yet.

---

### Update Own Company

**PUT** `/api/v1/drives/my`

**Role**: `RECRUITER` only  
**Note**: Changing `name`, `industry`, or `contactEmail` on a `VERIFIED` company resets its status to `PENDING`.

**Request Body** (all fields optional):
```json
{
  "description": "Updated description.",
  "contactPhone": "+91 40 9876 5432",
  "hrName": "Ravi Kumar",
  "websiteUrl": "https://new.accenture.com",
  "location": { "city": "Bangalore", "state": "Karnataka" }
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Company profile updated successfully.",
  "data": { "company": { ...companyObject } }
}
```

---

### List All Companies

**GET** `/api/v1/drives`

**Role**: Authenticated (ADMIN, RECRUITER, STUDENT)  
**Note**: Students only see `VERIFIED` companies.

**Query Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 10, max: 50) |
| `q` | string | Search by name or description |
| `industry` | string | Filter by industry |
| `verificationStatus` | string | Filter by status (PENDING/VERIFIED/REJECTED) |
| `city` | string | Filter by city |
| `state` | string | Filter by state |
| `sortBy` | string | Sort field: `name`, `createdAt`, `industry`, `placementDriveCount` |
| `sortOrder` | string | `asc` or `desc` (default: desc) |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "companies": [ ...companyObjects ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "totalPages": 5,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

### Search Companies

**GET** `/api/v1/drives/search`

**Role**: Authenticated

**Query Parameters:** Same as List All (above). Sorted by `name` ascending.

---

### Get Company by ID

**GET** `/api/v1/drives/:id`

**Role**: Authenticated  
**Note**: Students only see VERIFIED companies.

**Response (200):**
```json
{
  "success": true,
  "data": { "company": { ...companyObject } }
}
```

---

### Verify / Reject Company

**PATCH** `/api/v1/drives/:id/verify`

**Role**: `ADMIN` only

**Request Body:**
```json
{
  "status": "VERIFIED",
  "notes": "Company documents verified. Approved for campus drives."
}
```

| Field | Required | Values |
|---|---|---|
| `status` | Yes | `VERIFIED`, `REJECTED` |
| `notes` | No | Max 500 characters |

**Response (200):**
```json
{
  "success": true,
  "message": "Company verified successfully.",
  "data": { "company": { ...companyObject } }
}
```

---

### Add Recruiter to Company

**POST** `/api/v1/drives/:id/recruiters`

**Roles**: `ADMIN`, or the primary recruiter managing their own company

**Request Body:**
```json
{
  "email": "ravi.teja@accenture.com",
  "designation": "Technical Recruiter",
  "phone": "+91 40 1234 5678"
}
```

| Field | Required | Values |
|---|---|---|
| `email` | Yes | Email of an existing active `RECRUITER` account |
| `designation` | No | Company role/title |
| `phone` | No | Contact number |

Auth Service verifies the account and supplies its user ID and name. The association always has the `SECONDARY` role. This endpoint does not create accounts or generate, accept, or return passwords.

**Response (200):**
```json
{
  "success": true,
  "message": "Recruiter added to company.",
  "data": {
    "company": { ...companyObject },
    "recruiter": { "userId": "...", "email": "...", "role": "SECONDARY", "status": "ACTIVE" }
  }
}
```

The primary recruiter can also use **POST** `/api/v1/drives/my/recruiters` with the same body. Active company recruiters can view the company and team; only the primary recruiter can manage membership and edit the company profile.

---

### Remove Recruiter from Company

**DELETE** `/api/v1/drives/:id/recruiters/:recruiterId`

**Roles**: `ADMIN`, or the primary recruiter managing their own company
**`:recruiterId`** is the recruiter's `userId`.

Company managers cannot remove the primary recruiter or change their status.

**Response (200):**
```json
{
  "success": true,
  "message": "Recruiter removed from company.",
  "data": { "company": { ...companyObject } }
}
```

---

### Internal Company Data

**GET** `/api/v1/drives/internal/:id`

**Auth**: Requires `x-service-key` header (not JWT)

Used by other microservices (application-service, etc.) to fetch company info without crossing DB boundaries.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "companyId": "64abc123def456",
    "name": "Accenture India Pvt. Ltd.",
    "industry": "IT Services",
    "verificationStatus": "VERIFIED",
    "isActive": true,
    "placementDriveCount": 3,
    "location": { "city": "Hyderabad", "state": "Telangana", "country": "India" },
    "contactEmail": "hr@accenture.com",
    "recruiters": [ ...recruiterObjects ]
  }
}
```

---

## Company Object Schema

```json
{
  "_id": "64abc123def456",
  "name": "Accenture India Pvt. Ltd.",
  "slug": "accenture-india-pvt-ltd",
  "industry": "IT Services",
  "description": "Global professional services company.",
  "websiteUrl": "https://www.accenture.com",
  "logoUrl": "https://...",
  "location": {
    "city": "Hyderabad",
    "state": "Telangana",
    "country": "India"
  },
  "contactEmail": "hr@accenture.com",
  "contactPhone": "+91 40 1234 5678",
  "hrName": "Priya Sharma",
  "linkedinUrl": "https://linkedin.com/company/accenture",
  "glassdoorUrl": "https://glassdoor.com/company/accenture",
  "verificationStatus": "PENDING",
  "verifiedBy": null,
  "verifiedAt": null,
  "verificationNotes": "",
  "registeredBy": "recruiterUserId",
  "recruiters": [
    {
      "userId": "recruiterUserId",
      "fullName": "Recruiter Name",
      "email": "recruiter@company.com",
      "role": "PRIMARY",
      "status": "ACTIVE",
      "designation": "Primary Recruiter",
      "addedAt": "2026-11-08T00:00:00.000Z"
    }
  ],
  "isActive": true,
  "placementDriveCount": 0,
  "createdAt": "2026-11-08T00:00:00.000Z",
  "updatedAt": "2026-11-08T00:00:00.000Z"
}
```

---

## Error Response Format

All errors follow the same format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [ { "field": "fieldName", "message": "Validation message" } ]
  }
}
```

**Common Error Codes:**

| Code | HTTP | Description |
|---|---|---|
| `NO_TOKEN` | 401 | No Bearer token provided |
| `TOKEN_EXPIRED` | 401 | JWT has expired |
| `INVALID_TOKEN` | 401 | JWT is malformed or invalid |
| `FORBIDDEN` | 403 | Insufficient role permissions |
| `INVALID_SERVICE_KEY` | 403 | Bad internal service key |
| `COMPANY_NOT_FOUND` | 404 | Company does not exist |
| `COMPANY_ALREADY_REGISTERED` | 409 | Recruiter already has a company |
| `COMPANY_NAME_TAKEN` | 409 | Company name in use |
| `RECRUITER_ALREADY_LINKED` | 409 | Recruiter already associated |
| `RECRUITER_NOT_FOUND` | 404 | Recruiter not in company |
| `VALIDATION_ERROR` | 422 | Input validation failed |
| `INVALID_ID` | 400 | Malformed MongoDB ObjectId |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Database Indexes

| Field(s) | Type | Purpose |
|---|---|---|
| `name` | Unique | Prevent duplicate companies |
| `slug` | Unique | URL-safe name lookup |
| `verificationStatus` | Index | Filter by status |
| `industry` | Index | Filter by industry |
| `location.city`, `location.state` | Compound | Location-based filtering |
| `name`, `description` | Text | Full-text search |
| `registeredBy` | Index | Recruiter's company lookup |
