
# LifeShield – Architecture Document

## 1. Overview

LifeShield is a learning-oriented but enterprise-style **life insurance backend** implemented using **Node.js**, **Express**, **MySQL (Sequelize)**, **AWS SQS**, **Winston**, and **Prometheus**. The final architecture is **microservices-based**, though early phases might start as a monolith for easier learning.

This document describes the target architecture, including system context, microservices, data storage, communication patterns, and cross-cutting concerns.

---

## 2. System Context

### 2.1 External Systems & Actors

- **Client Applications (Web/Mobile/UI)**  
  Call the LifeShield APIs via the API Gateway.

- **AWS SQS**  
  Acts as a message queue for asynchronous events (e.g., `POLICY_ISSUED`).

- **Prometheus & Grafana**  
  Monitor system metrics and visualize dashboards.

- **MySQL Database(s)**  
  Persist domain data for different services.

### 2.2 Context Diagram (Logical)

```text
+------------------------+
|   Client Applications  |
| (Web/Mobile/Postman)   |
+-----------+------------+
            |
            v
   +------------------+             +-----------------+
   |   API Gateway    |------------>|  Customer Svc   |
   |  (Node/Express)  |            /+-----------------+
   +------------------+           /
            |                    /
            v                   v
   +------------------+   +-----------------+
   |   Policy Svc     |   | Notification Svc|
   +------------------+   +-----------------+
            |                    ^
            v                    |
        +--------+         +-----------+
        |  SQS   |<--------|  Prometheus etc.
        +--------+         +-----------+

         ^
         |
    +---------+
    | MySQL   | (separate schemas for Customer, Policy,
    +---------+  Notification, or a shared instance)
```

---

## 3. Microservices Overview

### 3.1 API Gateway

**Responsibilities:**

- Acts as a single entrypoint for all external clients.
- Handles common HTTP concerns:
  - Security headers (`helmet`)
  - Request logging (`express-winston`)
  - Input validation (e.g., `express-validator`)
  - (Optional) Authentication and authorization.
- Routes incoming requests to appropriate microservices using HTTP calls.
- Exposes `/metrics` to provide gateway-level Prometheus metrics.
- Exposes `/health` endpoints.

**Key Technology:**

- Node.js, Express
- Winston + express-winston
- prom-client

---

### 3.2 Customer Service

**Responsibilities:**

- Manages **Customer** data:
  - Create, retrieve, and list customers.
  - Stores demographics and risk attributes (date of birth, smoker, occupationRisk).
- Exposes a REST API (called by API Gateway).
- Owns the `Customer` table and related schema in MySQL.

**Key Technology:**

- Node.js, Express
- MySQL with Sequelize
- Winston logging
- prom-client for metrics

**Main Endpoints (examples):**

- `POST /customers`
- `GET /customers/:id`
- `GET /customers` (optional listing)

---

### 3.3 Policy Service

**Responsibilities:**

- Manages **Quote** and **Policy** lifecycle.
- Calculates premiums based on customer data and coverage requests.
- Issues policies when quotes are accepted (transactional DB updates).
- Publishes **POLICY_ISSUED** events to AWS SQS.
- Exposes a REST API (via API Gateway).

**Key Technology:**

- Node.js, Express
- MySQL with Sequelize (owning `Quote` and `Policy` tables)
- Winston + express-winston
- prom-client for metrics
- AWS SDK for SQS (`aws-sdk` or `@aws-sdk/client-sqs`)

**Main Endpoints (examples):**

- `POST /quotes`
- `GET /quotes/:id`
- `GET /customers/:customerId/quotes`
- `POST /quotes/:id/accept`
- `GET /policies/:id`
- `GET /customers/:customerId/policies`

---

### 3.4 Notification Service

**Responsibilities:**

- Consumes messages from SQS (e.g., `POLICY_ISSUED`).
- Performs asynchronous processing such as sending “welcome” emails (simulated via logging) and/or tracking `NotificationLog` records.
- Exposes `/metrics` for Prometheus.

**Key Technology:**

- Node.js (Express optional)
- AWS SDK for SQS (consumer)
- MySQL + Sequelize (if using `NotificationLog`)
- Winston for logging
- prom-client for metrics

**Message Flow (simplified):**

1. Policy Service issues a policy and sends `POLICY_ISSUED` event to SQS.
2. Notification Service retrieves the message from SQS.
3. Notification Service logs or records a notification action.
4. Notification Service deletes the message from SQS if processed successfully.

---

## 4. Data Storage

### 4.1 Database Strategy

- Use **MySQL** as RDBMS.
- Each service **owns** its schema (could be separate databases or separate schemas in one DB instance).
- Data ownership:
  - Customer Service: `Customer` table
  - Policy Service: `Quote`, `Policy` tables
  - Notification Service: (optional) `NotificationLog` table

### 4.2 Example Core Tables (Simplified)

**Customer**  
- `id` (PK)
- `name`
- `email`
- `dateOfBirth`
- `smoker` (boolean)
- `occupationRisk` (enum/string)
- `createdAt`
- `updatedAt`

**Quote**  
- `id` (PK)
- `customerId` (FK → Customer, referenced via service boundary)
- `coverageAmount`
- `termYears`
- `monthlyPremium`
- `status` (PENDING, ACCEPTED, EXPIRED)
- `createdAt`
- `updatedAt`

**Policy**  
- `id` (PK)
- `policyNumber` (unique)
- `customerId` (FK-like reference)
- `quoteId` (FK-like reference)
- `startDate`
- `endDate`
- `status` (ACTIVE, LAPSED, CANCELLED)
- `createdAt`
- `updatedAt`

**NotificationLog** (optional)  
- `id` (PK)
- `type` (e.g., POLICY_ISSUED)
- `policyId`
- `customerId`
- `status` (SENT, FAILED)
- `message`
- `createdAt`

---

## 5. Communication Patterns

### 5.1 Synchronous HTTP Calls

- API Gateway → Customer Service  
- API Gateway → Policy Service

Standard REST JSON over HTTP/HTTPS.

Potential future pattern: API Gateway can apply authentication/authorization and forward identity to backend services via headers.

### 5.2 Asynchronous Messaging (SQS)

- Policy Service → SQS (producer)
- Notification Service → SQS (consumer)

Message example:

```json
{
  "type": "POLICY_ISSUED",
  "policyId": 42,
  "customerId": 10,
  "issuedAt": "2025-12-01T10:00:00Z"
}
```

This allows Policy Service to remain responsive and offload notification work to the background.

---

## 6. Cross-Cutting Concerns

### 6.1 Logging

- **Winston** is used for structured logs.
- **express-winston** logs HTTP requests/responses at gateway and service levels.
- Log fields may include:
  - timestamp
  - level
  - message
  - serviceName
  - requestId / correlationId
  - route, method, statusCode
  - error stack (for server-side only)

### 6.2 Observability & Metrics

- All services expose `/metrics` endpoint.
- **prom-client** is used to track:
  - HTTP request count and latency
  - Error counts
  - Domain-specific counters (e.g., quotes created, policies issued, notifications processed)

Prometheus scrapes these endpoints periodically; Grafana can be configured to visualize.

### 6.3 Security

- `helmet` middleware in all HTTP-facing services.
- CORS configuration in API Gateway.
- No sensitive data (passwords, secrets) is logged.
- JWT-based authentication may be introduced in a later stage.

### 6.4 Configuration Management

- Services load config from environment variables (`process.env`):
  - DB connection details (host, port, user, password, database)
  - SQS queue URL and AWS region
  - Log levels
  - Metrics configuration (port, path)
- Optionally use a small config module per service to centralize this.

---

## 7. Deployment & Runtime View (High-Level)

### 7.1 Local / Dev (Docker Compose)

A typical local deployment may look like:

```text
- api-gateway (Node container)
- customer-service (Node container)
- policy-service (Node container)
- notification-service (Node container)
- mysql (DB container)
- prometheus (metrics)
- grafana (dashboards)
- localstack (optional, to emulate AWS SQS locally)
```

Prometheus scrapes `/metrics` from each Node service, and Grafana connects to Prometheus.

### 7.2 Scaling Considerations

In a real environment, each service could be scaled independently:

- `customer-service` scaled by number of API calls for customer operations.
- `policy-service` scaled by quote/policy traffic.
- `notification-service` scaled by SQS message throughput.

SQS acts as a buffer between producer and consumer.

---

## 8. Evolution Path

The architecture is intentionally designed to evolve:

1. Start as **single service** (monolith) for learning fundamentals.
2. Introduce **SQS** and a separate Notification Worker.
3. Split into **microservices** and add API Gateway.

This way, you learn **why** each architectural step exists instead of starting from an overcomplicated baseline.
