
# LifeShield – High-Level Design (HLD)

## 1. Purpose

This High-Level Design document describes the overall structure and major components of the LifeShield system. It connects the **Architecture** and **Functional Requirements** to concrete services, modules, and flows without diving into all implementation details (those go into the Detailed Design).

---

## 2. Major Components & Responsibilities

### 2.1 API Gateway

**Responsibilities:**

- Accept incoming HTTP requests from clients.
- Apply common middleware: security (`helmet`), logging, validation.
- (Optional) Authentication & authorization via JWT.
- Route requests to appropriate backend services:
  - Customer Service
  - Policy Service
- Expose `/health` and `/metrics` endpoints.

**Key Modules (within API Gateway):**

- `app.js` / `server.js` – Express bootstrap, middleware registration.
- `routes/` – Route definitions mapping external URLs to internal handlers / proxy logic.
- `middleware/` – For logging, validation, CORS, security.
- `metrics/` – `prom-client` setup and registry.

---

### 2.2 Customer Service

**Responsibilities:**

- Provide CRUD operations for customers (primarily create & read in this project).
- Handle customer-specific business rules (e.g., deriving age from dateOfBirth).
- Persist customer data in MySQL using Sequelize.

**Key Modules:**

- `app.js` – Express app definition, basic middlewares and routes.
- `models/Customer.js` – Sequelize model for customer table.
- `controllers/customerController.js` – HTTP handler methods.
- `services/customerService.js` – Business logic (e.g., data validation beyond simple checks).
- `db/index.js` – Sequelize initialization and DB config.
- `metrics/metrics.js` – Prometheus metrics setup for this service.
- `logging/logger.js` – Winston logger configuration.

---

### 2.3 Policy Service

**Responsibilities:**

- Manage **Quote** and **Policy** lifecycle.
- Implement pricing/underwriting logic for generating quotes.
- Issue policies via quote acceptance and ensure transactional integrity.
- Publish events to SQS when policies are issued.

**Key Modules:**

- `app.js` – Express app and middlewares.
- `models/Quote.js` – Sequelize model for quotes.
- `models/Policy.js` – Sequelize model for policies.
- `controllers/quoteController.js` – Endpoints for creating and retrieving quotes.
- `controllers/policyController.js` – Endpoints for policies (issue, get, list).
- `services/pricingService.js` – Implements premium calculation algorithm.
- `services/policyService.js` – Orchestrates quote acceptance and policy creation with DB transactions.
- `services/sqsPublisher.js` – Encapsulates SQS publish logic.
- `db/index.js` – Sequelize initialization for this service.
- `metrics/metrics.js` – Prometheus metrics.
- `logging/logger.js` – Winston logger.

---

### 2.4 Notification Service

**Responsibilities:**

- Run as a background worker that consumes SQS messages.
- Process `POLICY_ISSUED` events (and potentially other event types later).
- Log “email sent” or persist `NotificationLog` records.
- Track monitoring metrics (processed, failed, latency).

**Key Modules:**

- `worker.js` – Main loop for polling SQS and dispatching handlers.
- `handlers/policyIssuedHandler.js` – Logic to process `POLICY_ISSUED` messages.
- `services/sqsConsumer.js` – Encapsulates SQS polling and message deletion logic.
- `models/NotificationLog.js` (optional) – Sequelize model.
- `db/index.js` – DB initialization if needed.
- `metrics/metrics.js` – Prometheus metrics for processed messages.
- `logging/logger.js` – Winston logger.

---

## 3. High-Level Data Flows

### 3.1 Customer Creation Flow

1. Client → API Gateway → `POST /api/customers`
2. API Gateway validates request and forwards to Customer Service `POST /customers`.
3. Customer Service:
   - Validates data.
   - Creates `Customer` row in MySQL via Sequelize.
   - Returns created customer.
4. API Gateway forwards response to client.

### 3.2 Quote Creation Flow

1. Client → API Gateway → `POST /api/quotes`
2. API Gateway validates input and forwards to Policy Service `POST /quotes`.
3. Policy Service:
   - Validates inputs and checks (via Customer Service or shared identifier) that customer exists.
   - Loads customer data (direct call to Customer Service or via data already present).
   - Calls `pricingService` to compute `monthlyPremium`.
   - Persists `Quote` entity with status `PENDING` via Sequelize.
   - Updates domain and technical metrics.
4. Policy Service returns quote to API Gateway, which returns it to client.

### 3.3 Accept Quote & Issue Policy Flow

1. Client → API Gateway → `POST /api/quotes/{id}/accept`
2. API Gateway forwards to Policy Service `POST /quotes/{id}/accept`.
3. Policy Service:
   - Validates quote status.
   - Starts DB transaction.
   - Creates `Policy` record and updates `Quote` to `ACCEPTED`.
   - Commits transaction.
   - Publishes `POLICY_ISSUED` event to SQS via `sqsPublisher`.
   - Records metrics (e.g., `policies_issued_total++`).
4. Policy Service returns created policy to API Gateway, then to client.

### 3.4 Notification Processing Flow

1. Notification Service polls SQS for messages.
2. For each `POLICY_ISSUED` message:
   - Parses payload.
   - Logs “Sending welcome email” (or persists a notification row).
   - Updates metrics (increment processed counter, record latency).
   - Deletes message from SQS on success.
3. On error:
   - Logs details with Winston.
   - Optionally re-queues or sends to DLQ depending on error type (in this project, likely log only).

---

## 4. Error Handling Strategy (High-Level)

- A **common error-handling middleware** will be implemented in each Express service that:
  - Logs error details with Winston.
  - Converts internal errors to user-friendly HTTP responses.
  - Uses a consistent JSON shape for error responses.
- Known error types (e.g., validation errors, not-found errors) will map to specific HTTP status codes (400, 404, 409).

---

## 5. Logging Strategy (High-Level)

- Each service uses a **shared logger** module that wraps Winston.
- HTTP requests are logged with `express-winston` including method, path, status, duration.
- Logs include a `serviceName` field (e.g., `lifeshield-api-gateway`, `lifeshield-policy-service`).
- Error logs include stack traces and correlation/request IDs.
- Sensitive data is never logged.

---

## 6. Metrics Strategy (High-Level)

- Each service exposes `/metrics` endpoint powered by `prom-client`.
- Metrics include:
  - **HTTP metrics**:
    - `http_requests_total{service, method, route, status}`
    - `http_request_duration_seconds{service, method, route}`
  - **Domain metrics**:
    - `lifeshield_quotes_created_total`
    - `lifeshield_policies_issued_total`
    - `lifeshield_notifications_processed_total`
- Prometheus scrapes all services; Grafana visualizes.

---

## 7. Security Considerations (High-Level)

- Use `helmet` in every HTTP-facing service for security headers.
- Enable CORS appropriately (restricted origins in real production).
- Do not log secrets or sensitive personal information.
- Authentication & authorization (JWT-based) can be introduced in a later phase without changing the core architecture.

---

## 8. Extensibility Considerations

- New products (e.g., different insurance types) can be modeled by extending the **Policy Service** with product types and associated pricing rules.
- More event types can be added to SQS (e.g., `POLICY_CANCELLED`, `QUOTE_EXPIRED`) with new handlers in Notification Service.
- Additional microservices (e.g., Reporting Service, Billing Service) can be introduced that integrate via HTTP/SQS using the same patterns.
