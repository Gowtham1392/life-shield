
# LifeShield – Functional Requirements

## 1. Overview

This document captures the functional requirements for the **LifeShield** life insurance backend platform. The system enables customers to be onboarded, life insurance quotes to be generated, and policies to be issued. It also integrates with **AWS SQS** to trigger asynchronous notifications.

The primary goal of this project is **learning**, but the requirements are designed as if for a real-world enterprise system.

---

## 2. Actors

- **Customer** – Person applying for life insurance (interacts indirectly via client app/API consumer).
- **Operations User** (optional later) – Internal staff reviewing data or troubleshooting.
- **System / API Client** – Frontend or external system consuming the APIs.
- **Notification Worker** – Background service that processes messages from SQS.

---

## 3. Functional Requirements

Each requirement is labeled as FR-x for easy reference.

### 3.1 Customer Management

**FR-1 – Create Customer**  
The system shall provide an API to create a new customer with at least the following data:

- Full name
- Email
- Date of birth
- Smoker status (yes/no)
- Occupation risk category (e.g., LOW, MEDIUM, HIGH)
- Optional: address or country

**FR-2 – Retrieve Customer**  
The system shall provide an API to retrieve a customer by ID, including all stored demographic and risk-related attributes.

**FR-3 – List Customers** (optional)  
The system may provide an API to list customers with basic pagination.

---

### 3.2 Quote Management

**FR-4 – Create Quote**  
The system shall provide an API to create a **quote** for a given customer. The request shall include:

- `customerId`
- `coverageAmount` (e.g., 10,000,000 JPY)
- `termYears` (e.g., 10, 20, 30)
- Optional: `smoker` override (if different from stored profile)

The system shall:

1. Validate the input (customer existence, positive coverage, valid term).
2. Calculate a **monthlyPremium** using a simplified pricing/underwriting algorithm.
3. Persist the quote with status `PENDING`.
4. Return the created quote to the caller.

**FR-5 – Retrieve Quote**  
The system shall provide an API to retrieve a quote by ID, including calculated premium and status.

**FR-6 – List Quotes for Customer**  
The system shall provide an API to list quotes for a given customer, with optional filters (e.g., by status).

**FR-7 – Quote Expiry (Optional/Advanced)**  
The system may support marking quotes as `EXPIRED` after a configurable time window (e.g., 30 days) via a background job or scheduled process.

---

### 3.3 Policy Management

**FR-8 – Accept Quote & Issue Policy**  
The system shall provide an API to **accept a quote** and issue a **policy**. When a quote is accepted:

1. The system shall verify that the quote exists and is in `PENDING` status.
2. The system shall create a policy with:
   - `policyNumber` (generated)
   - `customerId`
   - `quoteId`
   - `startDate` (current date or configurable)
   - `endDate` (startDate + term)
   - `status = ACTIVE`
3. The system shall update the quote status to `ACCEPTED`.
4. These operations shall be performed in a **single transaction** (all succeed or none).

**FR-9 – Retrieve Policy**  
The system shall provide an API to retrieve a policy by ID or policy number.

**FR-10 – List Policies for Customer**  
The system shall provide an API to list policies for a given customer.

**FR-11 – Policy Cancellation (Optional)**  
The system may provide an API to cancel a policy, setting its status to `CANCELLED` and recording a cancellation date/reason.

---

### 3.4 Beneficiaries (Optional Feature)

**FR-12 – Maintain Beneficiaries**  
The system may allow policies to have one or more beneficiaries. Each beneficiary shall include:

- Name
- Relationship (e.g., spouse, child, parent)
- Percentage share

The total percentage across beneficiaries for a policy should not exceed 100%.

---

### 3.5 Notification & Background Processing

**FR-13 – Publish Policy Issued Event**  
When a policy is successfully issued, the system shall publish a message to an **AWS SQS** queue, including at minimum:

- `type = POLICY_ISSUED`
- `policyId`
- `customerId`
- `timestamp`

**FR-14 – Consume Policy Issued Event**  
The Notification Service shall consume `POLICY_ISSUED` messages from SQS and perform a side effect, such as:

- Logging a “Welcome email” action
- (Optional) Inserting a row into a `NotificationLog` table

Any unrecoverable error shall be logged and optionally cause the message to be sent to a DLQ (Dead Letter Queue) or marked as failed.

---

### 3.6 API Gateway & Microservices (Target State)

**FR-15 – API Gateway Routing**  
The system shall provide an API Gateway layer that exposes a unified public API and routes calls to:

- Customer Service
- Policy Service

For example:

- `POST /api/customers` → Customer Service
- `POST /api/quotes` → Policy Service
- `POST /api/quotes/:id/accept` → Policy Service

**FR-16 – Service Isolation**  
Each microservice shall own its data:

- Customer Service: owns `Customer` model/table
- Policy Service: owns `Quote` and `Policy` models/tables
- Notification Service: may own `NotificationLog`

Services communicate via HTTP (synchronous) and SQS (asynchronous).

---

### 3.7 Validation & Error Handling

**FR-17 – Request Validation**  
The system shall validate incoming requests and respond with clear error messages when required fields are missing or invalid (e.g., coverageAmount <= 0).

**FR-18 – Error Responses**  
The system shall use a consistent error response format, for example:

```json
{
  "errorCode": "VALIDATION_ERROR",
  "message": "coverageAmount must be greater than 0",
  "details": [...]
}
```

**FR-19 – Logging of Errors**  
All unexpected errors shall be logged with stack traces on the server side (not exposed to clients).

---

## 4. Non-Functional Requirements (High-Level)

> Detailed NFRs can be moved to their own document later; for now, we capture the essentials.

**NFR-1 – Security**  
- Use `helmet` to set HTTP security headers.
- Do not log sensitive data (e.g., passwords, full PII).

**NFR-2 – Observability**  
- Expose Prometheus metrics from each service (`/metrics` endpoint).
- Track at least requests, latencies, and key domain events (quotes, policies, notifications).

**NFR-3 – Logging**  
- Use Winston + express-winston for structured logs.
- Include service name and a correlation/request ID in logs.

**NFR-4 – Reliability (Learning-Oriented)**  
- Use database transactions for critical operations (quote acceptance).
- Implement basic error handling and retry logic in SQS consumers where appropriate.

**NFR-5 – Extensibility**  
- The architecture shall allow additional features (e.g., more products, riders, underwriting rules) without major rewrites.

---

## 5. Open Points / Future Enhancements

- Detailed authentication & authorization model (e.g., roles for internal staff).
- Support for multiple insurance products (term, whole life, etc.).
- Full email integration instead of log-based notifications.
- More advanced pricing/underwriting rules.
