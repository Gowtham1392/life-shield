
# LifeShield – Detailed Design (DDD)

## 1. Purpose

This Detailed Design document specifies the lower-level design for LifeShield, including:

- Data models (Sequelize)
- API endpoints and payloads
- Module responsibilities and key functions
- Configuration details and patterns

This is a living document and can be refined as you implement.

---

## 2. Common Design Elements

### 2.1 Naming & Conventions

- Code style: JavaScript or TypeScript (TS recommended), following standard ESLint + Prettier rules.
- File structure: group by domain or component (`controllers/`, `services/`, `models/`, `routes/`, `middlewares/`).
- Error handling: custom error classes (e.g., `NotFoundError`, `ValidationError`) that carry HTTP status codes.

### 2.2 Environment Variables (Examples)

Common env vars (names can vary per service):

- `NODE_ENV` (development, production)
- `PORT` (HTTP port)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `AWS_REGION`
- `SQS_POLICY_ISSUED_QUEUE_URL`
- `LOG_LEVEL`

Config will be loaded via a small `config` module that reads `process.env` and applies defaults.

---

## 3. Data Model Design (Sequelize)

### 3.1 Customer Service Models

**Customer**

```js
// models/Customer.js
module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define('Customer', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    smoker: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    occupationRisk: {
      type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH'),
      allowNull: false,
      defaultValue: 'LOW',
    },
  }, {
    tableName: 'customers',
    timestamps: true,
  });

  return Customer;
};
```

---

### 3.2 Policy Service Models

**Quote**

```js
// models/Quote.js
module.exports = (sequelize, DataTypes) => {
  const Quote = sequelize.define('Quote', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    coverageAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    termYears: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    monthlyPremium: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'EXPIRED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
  }, {
    tableName: 'quotes',
    timestamps: true,
  });

  return Quote;
};
```

**Policy**

```js
// models/Policy.js
module.exports = (sequelize, DataTypes) => {
  const Policy = sequelize.define('Policy', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    policyNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    quoteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'LAPSED', 'CANCELLED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
  }, {
    tableName: 'policies',
    timestamps: true,
  });

  return Policy;
};
```

### 3.3 Notification Service Models (Optional)

**NotificationLog**

```js
// models/NotificationLog.js
module.exports = (sequelize, DataTypes) => {
  const NotificationLog = sequelize.define('NotificationLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    policyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('SENT', 'FAILED'),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'notification_logs',
    timestamps: true,
  });

  return NotificationLog;
};
```

---

## 4. API Design

### 4.1 API Gateway – External Routes

(All routes are prefixed with `/api/` for clients.)

#### 4.1.1 `POST /api/customers`

- Body:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "dateOfBirth": "1990-01-01",
    "smoker": false,
    "occupationRisk": "LOW"
  }
  ```
- Validations:
  - Required fields, valid email, valid date, occupationRisk in [LOW, MEDIUM, HIGH].
- Flow:
  - Gateway validates and forwards to Customer Service `POST /customers`.
- Response: `201 Created` with created customer JSON.

#### 4.1.2 `GET /api/customers/:id`

- Flow:
  - Forwards to Customer Service `GET /customers/:id`.
- Response:
  - `200 OK` with customer JSON or `404` if not found.

#### 4.1.3 `POST /api/quotes`

- Body:
  ```json
  {
    "customerId": 1,
    "coverageAmount": 10000000,
    "termYears": 20
  }
  ```
- Validations:
  - coverageAmount > 0, termYears > 0, customerId is integer.
- Flow:
  - Forwards to Policy Service `POST /quotes`.

#### 4.1.4 `POST /api/quotes/:id/accept`

- Flow:
  - Forwards to Policy Service `POST /quotes/:id/accept`.

#### 4.1.5 `GET /api/policies/:id`

- Flow:
  - Forwards to Policy Service `GET /policies/:id`.

(Additional routes can follow similar pattern.)

---

### 4.2 Customer Service – Internal Routes

Base path: `/customers`

#### 4.2.1 `POST /customers`

- Business Logic:
  - Validate request (same as gateway or deeper).
  - Check email uniqueness.
  - Create `Customer` via Sequelize.
  - Return 201 with newly created object.

#### 4.2.2 `GET /customers/:id`

- Business Logic:
  - Fetch by ID.
  - If not found → throw `NotFoundError`.

---

### 4.3 Policy Service – Internal Routes

Base paths: `/quotes`, `/policies`

#### 4.3.1 `POST /quotes`

- Steps:
  1. Validate request body.
  2. Optionally call Customer Service to confirm `customerId` exists.
  3. Fetch customer details (if required by pricing logic).
  4. Call `pricingService.calculatePremium(customer, coverageAmount, termYears)`.
  5. Create `Quote` in DB with status `PENDING`.
  6. Increment metrics (`quotes_created_total`).
  7. Return 201 with quote.

- Pricing Logic (Example Pseudocode):

  ```js
  function calculatePremium({ age, smoker, occupationRisk }, coverageAmount, termYears) {
    const baseRate = 0.0005; // base monthly rate per unit coverage
    let riskFactor = 1.0;

    if (age > 50) riskFactor += 0.3;
    else if (age > 40) riskFactor += 0.2;
    else if (age > 30) riskFactor += 0.1;

    if (smoker) riskFactor += 0.5;

    if (occupationRisk === 'MEDIUM') riskFactor += 0.1;
    if (occupationRisk === 'HIGH') riskFactor += 0.25;

    const monthlyPremium = coverageAmount * baseRate * riskFactor / 12;
    return roundToTwoDecimals(monthlyPremium);
  }
  ```

#### 4.3.2 `POST /quotes/:id/accept`

- Steps:
  1. Validate `id` is integer.
  2. Fetch `Quote` by ID.
  3. If not found → 404.
  4. If status != `PENDING` → 409 Conflict.
  5. Start Sequelize transaction:
     - Create `Policy`:
       - `policyNumber` = e.g., `"LS-" + Date.now() + "-" + quote.id`
       - `startDate` = today
       - `endDate` = startDate + `termYears`
       - `status` = `ACTIVE`
     - Update Quote status to `ACCEPTED`.
  6. Commit transaction.
  7. Publish `POLICY_ISSUED` event to SQS via `sqsPublisher`.
  8. Increment metrics (`policies_issued_total`).
  9. Return `201 Created` with policy details.

#### 4.3.3 `GET /policies/:id`

- Fetch policy by ID and return or 404 if not found.

---

## 5. Notification Service Detailed Flow

### 5.1 SQS Consumer Loop

Pseudocode for `worker.js`:

```js
async function poll() {
  while (true) {
    try {
      const messages = await sqs.receiveMessage({
        QueueUrl: config.sqsPolicyIssuedQueueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
      }).promise();

      if (!messages.Messages || messages.Messages.length === 0) {
        continue;
      }

      for (const msg of messages.Messages) {
        const startTime = Date.now();
        try {
          await handleMessage(msg);
          await sqs.deleteMessage({
            QueueUrl: config.sqsPolicyIssuedQueueUrl,
            ReceiptHandle: msg.ReceiptHandle,
          }).promise();
          metrics.incrementProcessed();
          metrics.observeProcessingDuration(Date.now() - startTime);
        } catch (err) {
          logger.error('Error processing SQS message', { err, msg });
          metrics.incrementFailed();
          // Optionally: move to DLQ, or rely on SQS redrive policy.
        }
      }
    } catch (err) {
      logger.error('Error in SQS polling loop', { err });
      // Optional delay before retrying
      await delay(5000);
    }
  }
}
```

### 5.2 Message Handler Example

```js
async function handleMessage(msg) {
  const body = JSON.parse(msg.Body);
  if (body.type === 'POLICY_ISSUED') {
    await handlePolicyIssued(body);
  } else {
    logger.warn('Unhandled message type', { type: body.type });
  }
}

async function handlePolicyIssued({ policyId, customerId }) {
  logger.info('Simulating welcome email for policy', { policyId, customerId });
  // Optional DB logging:
  // await NotificationLog.create({ type: 'POLICY_ISSUED', policyId, customerId, status: 'SENT' });
}
```

---

## 6. Logging Design

Each service has `logging/logger.js` like:

```js
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  defaultMeta: { service: process.env.SERVICE_NAME || 'lifeshield-service' },
  transports: [
    new transports.Console(),
  ],
});

module.exports = logger;
```

`express-winston` uses this logger for HTTP logging; domain code imports the same logger for application logs.

---

## 7. Metrics Design

Each service has `metrics/metrics.js` similar to:

```js
const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route'],
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDurationSeconds);

function observeRequest(method, route, status, durationSeconds) {
  httpRequestsTotal.labels(method, route, status).inc();
  httpRequestDurationSeconds.labels(method, route).observe(durationSeconds);
}

module.exports = { register, observeRequest };
```

Express middleware can wrap requests to measure duration and then call `observeRequest`.

`/metrics` endpoint returns `register.metrics()`.

---

## 8. Error Handling Classes

Example custom error class:

```js
class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode || 500;
    this.errorCode = errorCode || 'INTERNAL_ERROR';
  }
}

class NotFoundError extends AppError {
  constructor(message, errorCode = 'NOT_FOUND') {
    super(message, 404, errorCode);
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

module.exports = { AppError, NotFoundError, ValidationError };
```

Global error middleware in Express:

```js
function errorHandler(err, req, res, next) {
  logger.error('Unhandled error', { err, path: req.path });
  const status = err.statusCode || 500;
  const payload = {
    errorCode: err.errorCode || 'INTERNAL_ERROR',
    message: err.message || 'Unexpected error',
  };
  if (err.details) {
    payload.details = err.details;
  }
  res.status(status).json(payload);
}
```

---

## 9. Deployment & Configuration Notes (Detailed)

- Each service has its own `Dockerfile` and `docker-compose` can orchestrate them.
- DB migrations are run via Sequelize CLI or a custom script at container startup.
- SQS endpoints can be real AWS or LocalStack in dev; switch controlled by env vars.
- Logging verbosity is controlled by `LOG_LEVEL`; in dev it may be `debug`, in prod `info`.

---

This detailed design provides enough structure to start implementing the LifeShield services while keeping flexibility for adjustments as you learn and iterate.
