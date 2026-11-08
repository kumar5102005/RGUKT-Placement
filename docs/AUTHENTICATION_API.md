# RGUKT Ongole Placement Hub - Authentication & RBAC API Documentation

## 1. Overview

The Authentication & Authorization Service (`auth-service`) manages user registration, identity verification, role-based authorization (RBAC), and session security for the RGUKT Ongole Placement Hub.

- **Base Gateway URL**: `http://localhost:8080/api/v1/auth`
- **Internal Microservice Port**: `4001`
- **Target Database**: `mongodb://auth-db:27017/rgukt_auth_db`
- **Authentication Scheme**: `Bearer <JWT_ACCESS_TOKEN>`

---

## 2. Role-Based Access Control (RBAC) Matrix

| Endpoint | Method | Required Role | Description |
| :--- | :--- | :--- | :--- |
| `/register` | `POST` | Public | Account creation (Student, Admin, Recruiter) |
| `/login` | `POST` | Public | Credential verification & token issuance |
| `/refresh-token` | `POST` | Public | Secure refresh token rotation |
| `/logout` | `POST` | Public / Auth | Refresh token invalidation |
| `/me` | `GET` | Authenticated | Retrieve current user profile context |
| `/student-portal` | `GET` | `STUDENT` | Student-only protected placement area |
| `/recruiter-portal` | `GET` | `RECRUITER`, `ADMIN` | Recruiter-only candidate access area |
| `/admin-portal` | `GET` | `ADMIN` | TPO Admin management area |
| `/users` | `GET` | `ADMIN` | List all accounts with pagination |
| `/users/:id/status` | `PATCH` | `ADMIN` | Account status updater (`ACTIVE`, `SUSPENDED`, etc.) |

---

## 3. Detailed Endpoint Contracts

### A. Register Account
`POST /api/v1/auth/register`

- **Headers**: `Content-Type: application/json`
- **Request Body (Student)**:
  ```json
  {
    "email": "o180123@rguktong.ac.in",
    "password": "SecurePassword123#",
    "fullName": "Sai Kumar Koneti",
    "role": "STUDENT",
    "studentId": "O180123"
  }
  ```
- **Request Body (Recruiter)**:
  ```json
  {
    "email": "campus.hr@google.com",
    "password": "SecurePassword123#",
    "fullName": "Priya Sharma",
    "role": "RECRUITER",
    "companyName": "Google India"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "message": "Account registered successfully",
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "7c8e9b01a2d3...",
      "user": {
        "id": "6724a1b0c9e0a12345678901",
        "email": "o180123@rguktong.ac.in",
        "fullName": "Sai Kumar Koneti",
        "role": "STUDENT",
        "status": "ACTIVE",
        "studentId": "O180123"
      }
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation failure (weak password, invalid email format, invalid student ID).
  - `409 Conflict`: Account with this email or student ID already exists.

---

### B. User Login
`POST /api/v1/auth/login`

- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "email": "o180123@rguktong.ac.in",
    "password": "SecurePassword123#"
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "accessToken": "eyJhbGciOiJIUzI1Ni...",
      "refreshToken": "d8f1e2c3b4...",
      "user": {
        "id": "6724a1b0c9e0a12345678901",
        "email": "o180123@rguktong.ac.in",
        "fullName": "Sai Kumar Koneti",
        "role": "STUDENT",
        "status": "ACTIVE",
        "studentId": "O180123"
      }
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Invalid email or password.
  - `403 Forbidden`: Account is `SUSPENDED` or `INACTIVE`.

---

### C. Refresh Token Rotation
`POST /api/v1/auth/refresh-token`

- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "refreshToken": "d8f1e2c3b4..."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Token refreshed successfully",
    "data": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "a1b2c3d4e5..."
    }
  }
  ```
- **Security Feature (Replay Attack Detection)**:
  - If an already revoked refresh token is presented, the service immediately marks **all** active refresh tokens for that user as revoked, logging a security breach attempt and returning `403 Forbidden`.

---

### D. User Logout
`POST /api/v1/auth/logout`

- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "refreshToken": "a1b2c3d4e5..."
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully. Session invalidated."
  }
  ```

---

### E. Get Current Authenticated User Context
`GET /api/v1/auth/me`

- **Headers**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "6724a1b0c9e0a12345678901",
        "email": "o180123@rguktong.ac.in",
        "fullName": "Sai Kumar Koneti",
        "role": "STUDENT",
        "status": "ACTIVE",
        "studentId": "O180123"
      }
    }
  }
  ```

---

### F. Update Account Status (Admin Only)
`PATCH /api/v1/auth/users/:id/status`

- **Headers**:
  - `Authorization: Bearer <ADMIN_JWT_TOKEN>`
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "status": "SUSPENDED"
  }
  ```
- **Allowed Statuses**: `ACTIVE`, `INACTIVE`, `SUSPENDED`, `PENDING_APPROVAL`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Account status updated to 'SUSPENDED' successfully",
    "data": {
      "user": {
        "id": "6724a1b0c9e0a12345678901",
        "email": "o180123@rguktong.ac.in",
        "status": "SUSPENDED"
      }
    }
  }
  ```
- **Note**: Transitioning to `SUSPENDED` or `INACTIVE` automatically revokes all active refresh tokens for the target user.

---

### G. List Users (Admin Only)
`GET /api/v1/auth/users?role=STUDENT&status=ACTIVE&page=1&limit=20`

- **Headers**: `Authorization: Bearer <ADMIN_JWT_TOKEN>`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "users": [...]
    },
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 450,
      "totalPages": 23
    }
  }
  ```

