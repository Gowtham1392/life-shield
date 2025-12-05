
# LifeShield – Use Case Document

## 1. Overview

This document describes the primary **use cases** for the LifeShield life insurance platform. Each use case is written from the perspective of how an external client or user would interact with the system.

The core functionality revolves around:

1. Managing customers
2. Generating life insurance quotes
3. Accepting quotes and issuing policies
4. Triggering and processing notifications via SQS

---

## 2. Actors

- **Customer (Indirect Actor)**  
  The end user who wants a life insurance policy. In this project, the customer typically interacts through an external UI or API client, not directly with the backend.

- **API Client**  
  Represents any frontend (web app, mobile app) or integration that calls the LifeShield APIs.

- **Notification Worker**  
  A background service (Notification Service) that processes SQS messages and performs actions like “send email”.

- **System Administrator / Developer**  
  Person who deploys, configures, and monitors the services. Mostly relevant for operational use cases (monitoring, troubleshooting).

---

## 3. Use Cases

### UC-1: Create Customer

**Goal:** Register a new customer with basic personal and risk-related details.

**Primary Actor:** API Client (representing a Customer onboarding form)

**Preconditions:**  
- The system is running and database is available.

**Main Flow:**  
1. API Client sends `POST /customers` with customer details (name, email, dateOfBirth, smoker, occupationRisk).
2. System validates the input.
3. System stores a new `Customer` record in the database.
4. System returns the newly created `Customer` with a unique `customerId`.

**Postconditions:**  
- Customer exists in the database and can be referenced by `customerId`.

**Alternative Flows:**  
- 3a. Validation fails → System returns `400` with a validation error message.

---

### UC-2: Generate Quote for Life Insurance

**Goal:** Generate a life insurance quote for a given customer and coverage request.

**Primary Actor:** API Client

**Preconditions:**  
- Customer already exists (UC-1 completed).

**Main Flow:**  
1. API Client sends `POST /quotes` with:
   - `customerId`
   - `coverageAmount`
   - `termYears`
   - (optional) smoker override
2. System validates that:
   - `customerId` exists
   - `coverageAmount` and `termYears` are positive and within allowed ranges
3. System obtains customer risk factors (age, smoker, occupationRisk).
4. System runs a simplified pricing algorithm to compute `monthlyPremium`.
5. System stores a `Quote` record with status `PENDING`.
6. System returns the `Quote` (ID, premium, status).

**Postconditions:**  
- A new `Quote` with status `PENDING` is stored in the database.

**Alternative Flows:**  
- 2a. Customer does not exist → System returns `404` with `CUSTOMER_NOT_FOUND`.
- 2b. Invalid input → System returns `400` with validation details.

---

### UC-3: View Quote Details

**Goal:** Retrieve details of a previously generated quote.

**Primary Actor:** API Client

**Preconditions:**  
- Quote exists in the system.

**Main Flow:**  
1. API Client sends `GET /quotes/{quoteId}`.
2. System validates that the quote exists.
3. System returns quote details (coverage, term, premium, status, timestamps).

**Alternative Flows:**  
- 2a. Quote not found → System returns `404` with `QUOTE_NOT_FOUND`.

---

### UC-4: Accept Quote and Issue Policy

**Goal:** Accept a quote and issue a life insurance policy for the customer.

**Primary Actor:** API Client

**Preconditions:**  
- Quote exists and is in `PENDING` status.

**Main Flow:**  
1. API Client sends `POST /quotes/{quoteId}/accept`.
2. System validates that the quote exists and is `PENDING`.
3. System starts a database transaction.
4. System creates a `Policy` record:
   - Generates `policyNumber`
   - Sets `startDate` and `endDate`
   - Links to `customerId` and `quoteId`
   - Sets status `ACTIVE`
5. System updates the quote status to `ACCEPTED`.
6. System commits the transaction.
7. System publishes a `POLICY_ISSUED` event to SQS.
8. System returns policy details to the client.

**Postconditions:**  
- A new `Policy` is stored in the database.
- The `Quote` is marked `ACCEPTED`.
- A `POLICY_ISSUED` event has been enqueued in SQS.

**Alternative Flows:**  
- 2a. Quote not found → System returns `404`.
- 2b. Quote status is not `PENDING` → System returns `409` (conflict).
- 4a. Database error during transaction → System rolls back and returns `500`.

---

### UC-5: View Policy Details

**Goal:** Retrieve details of an issued policy.

**Primary Actor:** API Client

**Preconditions:**  
- Policy exists.

**Main Flow:**  
1. API Client sends `GET /policies/{policyId}` or `GET /policies/by-number/{policyNumber}`.
2. System validates that policy exists.
3. System returns policy details (coverage, term, dates, status, customer reference).

**Alternative Flows:**  
- 2a. Policy not found → System returns `404` with `POLICY_NOT_FOUND`.

---

### UC-6: List Policies for a Customer

**Goal:** View all policies for a given customer.

**Primary Actor:** API Client

**Preconditions:**  
- Customer exists.

**Main Flow:**  
1. API Client sends `GET /customers/{customerId}/policies`.
2. System validates customer existence.
3. System retrieves all policies linked to the customer.
4. System returns the list of policies.

**Alternative Flows:**  
- 2a. Customer not found → System returns `404`.

---

### UC-7: Process Policy Issued Notification (Background)

**Goal:** Process `POLICY_ISSUED` messages and simulate sending notifications.

**Primary Actor:** Notification Worker (background process)

**Preconditions:**  
- Policy Service has published `POLICY_ISSUED` messages to SQS.

**Main Flow:**  
1. Notification Worker polls SQS for messages.
2. Worker receives a `POLICY_ISSUED` message.
3. Worker logs an action such as "Sending welcome email for policy X".
4. Worker optionally persists a `NotificationLog` entry.
5. Worker deletes the message from SQS.
6. Metrics are updated for processed notifications.

**Alternative Flows:**  
- 2a. Message is malformed → Worker logs error and moves message to DLQ or marks as failed.
- 3a. Database failure while logging notification → Worker logs error and may retry or move to DLQ.

---

### UC-8: Monitor System Health & Metrics

**Goal:** Allow administrators or developers to observe system behavior.

**Primary Actor:** System Administrator / Developer

**Preconditions:**  
- Services expose `/health` and `/metrics` endpoints.

**Main Flow:**  
1. Admin queries `/health` on each service to confirm readiness/liveness.
2. Prometheus scrapes `/metrics` on all services.
3. (Optional) Grafana visualizes metrics dashboards.

**Postconditions:**  
- Admin has visibility into request rates, error rates, and domain-level metrics (quotes, policies, notifications).

---

## 4. Future Use Cases

Possible future use cases include:

- UC-9: Cancel Policy
- UC-10: Update Customer Details
- UC-11: Add/Update Policy Beneficiaries
- UC-12: Generate Reports (e.g., quotes per day, policies per product)
- UC-13: Role-Based Access Control for internal users

These can be added later as the project matures.
