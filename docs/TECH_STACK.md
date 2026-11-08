# RGUKT Ongole Placement Hub - Technology Selection Document

## 1. Executive Summary

The technology choices for the RGUKT Ongole Placement Hub satisfy the strict project mandates:
1. Fast, responsive, accessible Single Page Application (SPA).
2. Clean, modular, decoupled microservices architecture.
3. Isolated database per microservice.
4. Smooth containerized local development and production parity via Docker Compose.

---

## 2. Technology Stack Matrix

| Layer | Component | Selected Technology | Version | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | Build Tool | **Vite** | 5.x / 6.x | Instant Hot Module Replacement (HMR), lightweight build overhead, fast ES module bundling. |
| **Frontend** | UI Framework | **React.js** | 18.x / 19.x | Declarative component model, rich ecosystem, ideal for complex dashboards and interactive application trackers. |
| **Frontend** | Styling Engine | **Tailwind CSS** | 3.4.x / 4.x | Utility-first CSS, consistent design system, highly responsive layouts, dark-mode ready. |
| **Frontend** | State & Data Fetching | **TanStack Query / Axios** | Latest | Automatic caching, background refetching, optimistic UI updates for application tracking. |
| **Frontend** | Icons & UI Utilities | **Lucide React** | Latest | Consistent, tree-shakeable icon set matching modern dashboard requirements. |
| **API Gateway** | Reverse Proxy | **NGINX** | 1.27-alpine | Ultra-fast C-based proxy, low memory footprint (~15MB), industry-standard rate limiting and header security. |
| **Backend** | Runtime Environment| **Node.js** | 20 LTS (Iron) | Robust asynchronous non-blocking I/O, enterprise support lifecycle, native ES module support. |
| **Backend** | Web Framework | **Express.js** | 4.x / 5.x | Minimal, modular, unopinionated HTTP framework with extensive middleware ecosystem. |
| **Backend** | Input Validation | **Joi / Zod** | Latest | Schema-based strict runtime validation for incoming payloads before controller execution. |
| **Database** | Primary Storage | **MongoDB** | 7.0 | Document model fits rich, evolving student profiles, flexible drive round workflows, and rapid indexing. |
| **Database** | Object Modeling | **Mongoose** | 8.x | Schema validation, business logic hooks, connection pooling, and strict type casting. |
| **Messaging** | Message Broker | **RabbitMQ** | 3.13-alpine | AMQP 0-9-1 compliant, robust message acknowledgment, dead-letter routing, durable queues for placement events. |
| **DevOps** | Containerization | **Docker & Docker Compose** | v2.x | Multi-container local orchestration mirroring cloud microservices topology with one command. |
| **Testing** | Unit & Integration | **Jest / Supertest / Vitest** | Latest | Fast mock testing for REST endpoints, service layer validation, and React components. |

---

## 3. Justification for Key Architectural Selections

### Why NGINX for API Gateway?
- Eliminates Node.js single-thread bottlenecks for SSL termination and static routing.
- Provides native `limit_req_zone` memory-efficient rate limiting against bot traffic and accidental denial of service during peak drive registrations.

### Why Database-per-Service with MongoDB?
- Student academic profiles and recruitment drive requirements contain variable, nested properties (e.g. dynamic round configurations, skill arrays, semester-wise grades).
- Document collections provide natural mapping without costly relational joins across microservice boundaries.
- Running separate MongoDB instances per service enforces clean domain isolation at the infrastructure level.

### Why RabbitMQ as Message Broker?
- Placement events (such as drive announcements and shortlist releases) must not fail even if a service or email gateway is temporarily undergoing maintenance.
- RabbitMQ queues guarantee at-least-once message delivery, automatic retries, and persistence across service restarts.

