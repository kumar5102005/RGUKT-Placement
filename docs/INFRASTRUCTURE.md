# RGUKT Ongole Placement Hub - Infrastructure Documentation

## 1. Overview

The containerized infrastructure enforces database-per-service boundaries, bridge networking, centralized logging, and environment-driven configuration.

---

## 2. Container & Service Topology

```
                                 [ HOST (Developer Machine / CI) ]
                                                │
                                      Port 8080 │ (HTTP)
                                                ▼
┌── placement_network (Docker Bridge) ────────────────────────────────────────────────────────┐
│                                                                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                NGINX API Gateway                                   │   │
│   │                    - Port 80 (Mapped to Host 8080)                                 │   │
│   │                    - Centralized Reverse Proxy, SSL & Security Headers             │   │
│   │                    - IP Rate Limiting (30 req/s general, 10 req/m auth)            │   │
│   └───────────────┬────────────────────────────┬────────────────────────────┬──────────┘   │
│                   │ /api/v1/auth/*             │ /api/v1/students/*         │              │
│                   ▼                            ▼                            │              │
│          ┌─────────────────┐          ┌─────────────────┐                   │              │
│          │  Auth Service   │          │ Student Service │                   │              │
│          │    Port 4001    │          │    Port 4002    │                   │              │
│          └────────┬────────┘          └────────┬────────┘                   │              │
│                   │ (Isolated URI)             │ (Isolated URI)             │              │
│                   ▼                            ▼                            │              │
│          ┌─────────────────┐          ┌─────────────────┐                   │              │
│          │     auth-db     │          │   student-db    │                   │              │
│          │   MongoDB 7.0   │          │   MongoDB 7.0   │                   │              │
│          │  Vol: auth_data │          │Vol: student_data│                   │              │
│          └─────────────────┘          └─────────────────┘                   │              │
│                                                                             │              │
│                   ┌────────────────────────────┬────────────────────────────┘              │
│                   │ /api/v1/drives/*           │ /api/v1/applications/*                    │
│                   ▼                            ▼                                           │
│          ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐     │
│          │  Drive Service  │          │Application Svc  │          │Notification Svc │     │
│          │    Port 4003    │          │    Port 4004    │          │    Port 4005    │     │
│          └────────┬────────┘          └────────┬────────┘          └────────┬────────┘     │
│                   │ (Isolated URI)             │ (Isolated URI)             │ (Isolated)   │
│                   ▼                            ▼                            ▼              │
│          ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐     │
│          │    drive-db     │          │ application-db  │          │ notification-db │     │
│          │   MongoDB 7.0   │          │   MongoDB 7.0   │          │   MongoDB 7.0   │     │
│          │ Vol: drive_data │          │Vol: application_│          │Vol:notification_│     │
│          └─────────────────┘          └─────────────────┘          └─────────────────┘     │
│                                                                                            │
│   ┌────────────────────────────────────────────────────────────────────────────────────┐   │
│   │ RabbitMQ (internal event transport)                                               │   │
│   └────────────────────────────────────────────────────────────────────────────────────┘   │
│   ┌────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                         React Client SPA (Vite + Tailwind)                         │   │
│   │                                Internal Port: 80                                   │   │
│   └────────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Network Isolation & Database Ownership

- **Bridge Network**: All containers reside within `placement_network`. Microservices communicate using internal DNS names (e.g. `http://auth-service:4001`, `mongodb://student-db:27017`).
- **Zero Exposed Database Ports**: MongoDB containers do not publish ports to the host machine. They are reachable exclusively by their respective microservice inside the Docker virtual network.
- **Dedicated Persistent Volumes**:
  - `auth_data`: Mounts to `/data/db` on `auth-db`.
  - `student_data`: Mounts to `/data/db` on `student-db`.
  - `student_uploads`: Mounts to `/app/uploads` on `student-service` when local resume storage is enabled.
  - `drive_data`: Mounts to `/data/db` on `drive-db`.
  - `application_data`: Mounts to `/data/db` on `application-db`.
  - `notification_data`: Mounts to `/data/db` on `notification-db`.

### Private Resume Storage

Local Compose runs default to `RESUME_STORAGE_PROVIDER=local`; uploaded documents use unique, non-overwriting keys in the persistent `student_uploads` volume. Preserve that volume when recreating containers. If a deployment previously stored files only in a container layer, those files must be copied into the mounted volume before replacing that container; missing objects cannot be reconstructed from MongoDB references alone.

For production, configure `RESUME_STORAGE_PROVIDER=s3`, `RESUME_S3_BUCKET`, and `RESUME_S3_REGION`, and attach an IAM role to Student Service with narrowly scoped `s3:PutObject`, `s3:GetObject`, and `s3:HeadObject` access. Configure S3 Block Public Access and do not use public ACLs. The service streams files through authenticated APIs and does not issue public or pre-signed URLs. MongoDB `ResumeDocument` records retain the owner, immutable object key, optional checksum, and metadata; applications store the corresponding document ID and key. To migrate existing local files, copy each referenced object to S3 using its exact storage key, verify the bytes/checksum, and only then switch the provider; never change MongoDB application references during that transfer.

---

## 4. Port Allocations & Endpoints

| Service / Container | Internal Port | Host Port | Database Container | Database Name | Health Endpoint |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API Gateway** | `80` | `8080` | N/A | N/A | `http://localhost:8080/health` |
| **Client Frontend** | `80` | Via Gateway | N/A | N/A | `http://localhost:8080/` |
| **Auth Service** | `4001` | Via Gateway | `auth-db:27017` | `rgukt_auth_db` | `http://localhost:8080/api/v1/auth/health` |
| **Student Service** | `4002` | Via Gateway | `student-db:27017` | `rgukt_student_db` | `http://localhost:8080/api/v1/students/health` |
| **Drive Service** | `4003` | Via Gateway | `drive-db:27017` | `rgukt_drive_db` | `http://localhost:8080/api/v1/drives/health` |
| **Application Svc** | `4004` | Via Gateway | `application-db:27017` | `rgukt_application_db` | `http://localhost:8080/api/v1/applications/health` |
| **Notification Svc**| `4005` | Via Gateway | `notification-db:27017` | `rgukt_notification_db` | `http://localhost:8080/api/v1/notifications/health` |

---

## 5. Development Execution

### Option A: Running via Docker Compose (Recommended)

1. Copy the example environment file, then set unique strong values for `JWT_SECRET`, `SERVICE_API_KEY`, `RABBITMQ_USER`, and `RABBITMQ_PASSWORD`. Use an alphanumeric RabbitMQ password so it can be embedded safely in the internal AMQP URL:
   ```bash
   cp .env.example .env
   ```
2. Build and launch the services:
   ```bash
   docker compose up --build
   ```
3. Run automated health check verification:
   ```bash
   node scripts/test-health.js
   ```

### Option B: Running Natively for Local Development

1. Install all dependencies across services and client:
   ```bash
   npm run install:all
   ```
2. Run any service directly:
   ```bash
   npm --prefix services/auth-service run dev
   npm --prefix client run dev
   ```
