
# LifeShield – Life Insurance Platform (Learning Project)

LifeShield is an educational, enterprise-style backend project designed to help you learn **Node.js** and modern backend architecture by building a realistic **life insurance** platform step by step.

The goal is **not** just to have a working app, but to understand:

- How to structure Node.js/Express services for real-world use
- How to design and interact with **microservices**
- How to use **MySQL with Sequelize** cleanly
- How to integrate **AWS SQS** for background jobs
- How to implement **logging** and **observability** (Winston, Prometheus)
- How to think in terms of **requirements, use cases, and architecture** like an enterprise project

This repo is intentionally designed like a professional project, with design documents and clear phases.

---

## 1. Domain Summary

LifeShield is a simplified **life insurance** backend that supports:

- Customer onboarding
- Life insurance quote generation
- Quote acceptance → policy issuance
- Asynchronous notification processing via SQS

Core entities:

- **Customer** – a person applying for life insurance
- **Quote** – an offer with premium for specific coverage & term
- **Policy** – an active life insurance contract created when a quote is accepted

---

## 2. Tech Stack

### Backend

- Node.js (LTS)
- Express.js
- Express middlewares:
  - `helmet` for security headers
  - Body parsing & CORS
  - Validation middleware (e.g., `express-validator`)
  - Logging via `express-winston`

### Database

- **MySQL**
- **Sequelize ORM**
  - Models, migrations, associations
  - Transactions for critical flows (e.g., quote → policy)

### AWS / Background Jobs

- AWS SDK (`aws-sdk` or `@aws-sdk/client-sqs`)
- **SQS** for background events:
  - When a policy is issued, an event is pushed to SQS
- Separate **Notification Service** consumes SQS queue and performs side effects (e.g., "send" emails, log events).

### Logging

- **Winston** for structured application logging
- **express-winston** for HTTP access logs
- Correlation / request IDs

### Observability

- **Prometheus** metrics using `prom-client`
  - Request counters and latency histograms
  - Domain metrics (quotes created, policies issued, notifications processed)
- Ready to plug into **Grafana** dashboards in a production-like environment.

### Architecture

- **Microservices** (final state)
  - API Gateway
  - Customer Service
  - Policy Service
  - Notification (Jobs) Service

Initial phases may start as a monolith and **evolve** into microservices to maximize learning.

---

## 3. Services Overview

### 3.1 API Gateway

- Single entry point for clients (e.g., React/SPA/Postman).
- Responsibilities:
  - Request routing to downstream services
  - Common middleware: security headers, logging, validation
  - Authentication & authorization (optional phase)
  - Expose `/metrics` for gateway-level metrics

### 3.2 Customer Service

- Manages customer-related data and operations.
- Key responsibilities:
  - Create and retrieve customers
  - Store demographics and risk-related attributes (age, smoker, occupation risk)
- Owns `Customer` table in MySQL.

### 3.3 Policy Service

- Manages quotes and policies.
- Responsibilities:
  - Generate quotes given customer profile and coverage request
  - Apply simplified underwriting / pricing rules
  - Accept quotes and issue policies in a transaction
  - Publish events to AWS SQS when a policy is issued

- Owns `Quote` and `Policy` tables in MySQL.

### 3.4 Notification Service

- Runs as background worker(s).
- Responsibilities:
  - Consume messages from SQS (e.g., `POLICY_ISSUED`)
  - Perform side effects (send emails / log to NotificationLog)
  - Track metrics for processed / failed messages

---

## 4. Documents Included

Design and requirements docs are under `./docs`:

- [`docs/FunctionalRequirements.md`](./docs/FunctionalRequirements.md)
- [`docs/UseCases.md`](./docs/UseCases.md)
- [`docs/Architecture.md`](./docs/Architecture.md)
- [`docs/HighLevelDesign.md`](./docs/HighLevelDesign.md)
- [`docs/DetailedDesign.md`](./docs/DetailedDesign.md)

These are meant to be living documents you can update as the implementation evolves.

---

## 5. Suggested Project Structure (Top-Level)

```text
lifeshield/
  README.md
  docs/
    FunctionalRequirements.md
    UseCases.md
    Architecture.md
    HighLevelDesign.md
    DetailedDesign.md

  services/
    api-gateway/
      src/
      package.json
    customer-service/
      src/
      package.json
    policy-service/
      src/
      package.json
    notification-service/
      src/
      package.json

  docker/
    docker-compose.yml      # MySQL, Prometheus, Grafana, localstack (optional)

  scripts/
    dev-setup.sh            # Optional helper scripts
```

You can adjust this as you go, but this layout supports a microservices style cleanly.

---

## 6. Implementation Phases (Learning-Oriented)

1. **Phase 1 – Monolithic Service**
   - Single Express app with `/customers`, `/quotes`, `/policies`
   - In-memory storage or one MySQL DB using Sequelize
   - Focus: Express basics, routing, middleware, basic Sequelize usage

2. **Phase 2 – Proper Persistence & Transactions**
   - MySQL schema via Sequelize models & migrations
   - Transactional quote → policy flow
   - Focus: DB schema, transactions, error handling

3. **Phase 3 – Logging & Error Handling**
   - Introduce Winston + express-winston
   - Global error handler, request IDs, structured logs
   - Focus: production-grade logging

4. **Phase 4 – Observability**
   - Add Prometheus metrics (`prom-client`) to the service
   - Focus: metrics vs logs and how to monitor Node.js applications

5. **Phase 5 – SQS & Notification Worker**
   - On `policy issued`, publish message to SQS
   - Separate Node worker consumes messages and logs "emails"
   - Focus: event-driven design and background jobs

6. **Phase 6 – Split into Microservices**
   - Extract Customer and Policy into separate services
   - Introduce API Gateway
   - Focus: service boundaries, service-to-service calls, configs

You can stop after any phase and still have learned a lot; the later phases just push you closer to real enterprise architecture.

---

## 7. Getting Started (Dev Notes)

> These are generic steps; you’ll adapt them once you actually start coding.

1. **Clone / Initialize Repo**
   - Create your project folder (`lifeshield/`) and copy this README + docs into it.

2. **Create First Service (Monolith in `/services/lifeshield-api`)**
   - Initialize Node:
     ```bash
     cd services
     mkdir lifeshield-api && cd lifeshield-api
     npm init -y
     npm install express helmet cors express-winston winston mysql2 sequelize
     npm install --save-dev nodemon
     ```

3. **Add Basic Express App**
   - Create `src/app.js` with a simple `/health` endpoint and basic middleware.

4. **Attach Sequelize & MySQL**
   - Configure DB connection and define first `Customer` model.

5. **Iterate According to Phases in Section 6**

---

## 8. Updating the Documents

As you refine the project:

- Add new endpoints to **DetailedDesign.md**
- Update tables & attributes in **Architecture.md** / **HighLevelDesign.md**
- Add or refine use cases in **UseCases.md**
- Refine acceptance criteria in **FunctionalRequirements.md**

Treat this like a real enterprise project: the docs and code should co-evolve.

---

Happy building! LifeShield is your playground to learn Node.js the way large systems are actually built.
