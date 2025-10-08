# Dash Healthcare SAAS - Microservices Evolution Roadmap

> **⚠️ PLANNING DOCUMENT**
>
> This document contains a long-term microservices migration roadmap. The information represents proposed architecture and is **not yet implemented**. Current architecture uses a modular monolith approach (see [Architecture Overview](../architecture/README.md)).
>
> **Status**: Planning Phase (18-24 month roadmap)
> **Last Updated**: October 2025

---

## Executive Summary

This roadmap guides the evolution of Dash from a **modular monolith** to a **microservices architecture**, ensuring zero downtime, regulatory compliance, and scalable Quebec healthcare billing validation.

**Current State**: Modular Monolith (7 modules, 1 database, 1 codebase)
**Target State**: Distributed Microservices (Event-Driven, Multi-Region, Service Mesh)
**Timeline**: 18-24 months (3 phases)
**Approach**: Strangler Fig Pattern (gradual migration, not big-bang rewrite)

---

## Why Migrate to Microservices?

### Current Limitations of Modular Monolith

| Limitation | Impact | Microservices Benefit |
|-----------|--------|----------------------|
| **Synchronous CSV Processing** | Blocks event loop, timeouts | Background workers scale independently |
| **Shared Database** | Performance bottleneck | Database-per-service pattern |
| **Monolithic Deployment** | One bug breaks entire app | Independent deployment cycles |
| **Single Point of Failure** | VPS crash = total downtime | Service redundancy and failover |
| **Scaling Constraints** | Scale entire app (wasteful) | Scale only high-load services |
| **Technology Lock-In** | All modules must use Node.js | Polyglot architecture (Python ML, Go workers) |

### Business Drivers

1. **Scalability**: Support 1,000+ concurrent users (currently ~20)
2. **SAAS Multi-Tenancy**: Serve multiple Quebec healthcare organizations
3. **Regulatory Compliance**: Isolate PHI data with service boundaries
4. **Team Velocity**: Independent teams work on separate services
5. **Innovation**: Experiment with new tech (AI validation) without risk

---

## Migration Strategy: Strangler Fig Pattern

### ❌ **NOT** Big-Bang Rewrite

```
Old Way (Risky):
1. Stop development on monolith
2. Build entire microservices system from scratch
3. Flip switch to new system
4. Pray nothing breaks 🙏

Result: 6-12 months of no new features, high failure risk
```

### ✅ **Strangler Fig Pattern (Recommended)**

```
Gradual Migration:
1. Monolith continues serving production traffic
2. Extract ONE service at a time
3. Route traffic to new service via API gateway
4. Retire corresponding monolith code
5. Repeat until monolith is "strangled"

Result: Zero downtime, incremental value delivery
```

### Visual Representation

```
Phase 1: Current State
┌─────────────────────────────────────┐
│       MODULAR MONOLITH              │
│  ┌─────────────────────────────┐   │
│  │ Validateur Module           │   │
│  │ Database Module             │   │
│  │ Chatbot Module              │   │
│  │ Administration Module       │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ PostgreSQL Database         │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘

Phase 2: Hybrid Architecture (Strangler Fig)
┌─────────────────────────────────────┐
│       MODULAR MONOLITH              │
│  ┌─────────────────────────────┐   │
│  │ Database Module             │   │
│  │ Chatbot Module              │   │
│  │ Administration Module       │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
           │
           │ API Gateway (Kong)
           ▼
┌─────────────────────────────────────┐
│  Validation Service (NEW)           │
│  ├─ CSV Processing Worker           │
│  ├─ Rule Engine                     │
│  ├─ PostgreSQL (Validation DB)      │
│  └─ Redis Queue (Bull)              │
└─────────────────────────────────────┘

Phase 3: Full Microservices
           API Gateway (Kong)
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Validation│ │Database │ │Chatbot  │
│Service   │ │Service  │ │Service  │
└─────────┘ └─────────┘ └─────────┘
    │            │            │
    ▼            ▼            ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│Postgres │ │Postgres │ │Postgres │
│+ Redis  │ │(Codes)  │ │+ Ollama │
└─────────┘ └─────────┘ └─────────┘
```

---

## Phase 1: Foundation (Months 1-6)

### Objectives

1. Prepare infrastructure for microservices
2. Extract first service (Validation Engine)
3. Implement async processing with job queue
4. Establish monitoring and observability

### Milestone 1.1: Infrastructure Setup (Month 1)

#### 1.1.1 Redis Job Queue (Bull/BullMQ)

**Purpose**: Enable background CSV processing

**Implementation**:
```typescript
// server/queue/validation-queue.ts
import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null, // BullMQ requirement
});

export const validationQueue = new Queue('validation', { connection });

// Worker process (separate Node.js process)
const worker = new Worker(
  'validation',
  async (job) => {
    const { validationRunId, filePath } = job.data;

    // Update progress
    await job.updateProgress(10);

    const processor = new BillingCSVProcessor();
    const { records } = await processor.processBillingCSV(filePath, validationRunId);

    await job.updateProgress(50);

    const results = await processor.validateBillingRecords(records, validationRunId);

    await job.updateProgress(100);

    return { recordCount: records.length, errorCount: results.length };
  },
  { connection }
);

worker.on('completed', (job) => {
  console.log(`Validation ${job.id} completed`);
});
```

**Route Changes**:
```typescript
// Before: Synchronous processing
router.post("/api/validations", async (req, res) => {
  // ... create validation run ...
  processBillingValidation(run.id, file.fileName); // ⚠️ BLOCKS
  res.json({ validationId: run.id });
});

// After: Async with job queue
router.post("/api/validations", async (req, res) => {
  const run = await storage.createValidationRun({
    fileId,
    status: "queued",
  });

  // Queue background job
  await validationQueue.add('process-validation', {
    validationRunId: run.id,
    filePath: file.fileName,
  });

  res.status(202).json({ validationId: run.id, status: "queued" });
});
```

**Deliverables**:
- ✅ Redis deployed (Docker Compose for dev, Redis Cloud for prod)
- ✅ BullMQ queue and worker implemented
- ✅ Health check for queue status
- ✅ Dashboard for monitoring jobs (Bull Board UI)

**Effort**: 5-7 days
**Cost**: $15/month (Redis Cloud 250MB)

---

#### 1.1.2 API Gateway (Kong or Nginx)

**Purpose**: Route traffic between monolith and new services

**Kong Configuration**:
```yaml
# kong.yml
_format_version: "3.0"

services:
  - name: validation-service
    url: http://validation-service:3001
    routes:
      - name: validation-routes
        paths:
          - /api/validations
          - /api/files
        methods:
          - GET
          - POST
          - PATCH

  - name: monolith
    url: http://monolith:3000
    routes:
      - name: monolith-routes
        paths:
          - /api

plugins:
  - name: rate-limiting
    service: validation-service
    config:
      minute: 100
      policy: local

  - name: cors
    config:
      origins:
        - https://148.113.196.245
```

**Deliverables**:
- ✅ Kong API Gateway deployed
- ✅ Traffic routing configured
- ✅ Rate limiting enabled (100 req/min per service)
- ✅ CORS policies configured

**Effort**: 3-4 days
**Cost**: Free (Kong OSS)

---

#### 1.1.3 Observability Stack (Structured Logging + APM)

**Purpose**: Monitor distributed system performance

**Stack**:
- **Winston** (Structured logging)
- **Sentry** (Error tracking)
- **Prometheus + Grafana** (Metrics)
- **Jaeger** (Distributed tracing - optional)

**Winston Setup**:
```typescript
// server/lib/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'dash-monolith',
    environment: process.env.NODE_ENV,
  },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
```

**Sentry Integration**:
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
});

// Express middleware
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

**Deliverables**:
- ✅ Winston logging in all services
- ✅ Sentry error tracking
- ✅ Prometheus metrics exposed
- ✅ Grafana dashboards for CPU, memory, requests/sec

**Effort**: 4-5 days
**Cost**: $26/month (Sentry Team plan)

---

### Milestone 1.2: Extract Validation Service (Months 2-3)

#### Service Boundary Definition

**Validation Service Responsibilities**:
- File upload handling
- CSV parsing and validation
- Rule engine execution
- Result storage and retrieval

**Database Schema** (Dedicated PostgreSQL instance):
```sql
-- validation_service database
CREATE TABLE files (
  id UUID PRIMARY KEY,
  original_name VARCHAR(255),
  file_name VARCHAR(255),
  uploaded_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE validation_runs (
  id UUID PRIMARY KEY,
  file_id UUID REFERENCES files(id),
  status VARCHAR(50),
  error_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE billing_records (
  id UUID PRIMARY KEY,
  validation_run_id UUID REFERENCES validation_runs(id),
  -- ... 23+ columns from CSV ...
);

CREATE TABLE validation_results (
  id UUID PRIMARY KEY,
  validation_run_id UUID REFERENCES validation_runs(id),
  rule_id TEXT,
  severity VARCHAR(50),
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**API Contract** (REST API):
```yaml
# validation-service OpenAPI spec
openapi: 3.0.0
info:
  title: Validation Service
  version: 1.0.0

paths:
  /api/files:
    post:
      summary: Upload CSV file
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
      responses:
        '200':
          description: File uploaded successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  fileId:
                    type: string
                    format: uuid

  /api/validations:
    post:
      summary: Start validation run
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                fileId:
                  type: string
                  format: uuid
      responses:
        '202':
          description: Validation queued
          content:
            application/json:
              schema:
                type: object
                properties:
                  validationId:
                    type: string
                    format: uuid
                  status:
                    type: string
                    enum: [queued, processing, completed, failed]

    get:
      summary: List validation runs
      responses:
        '200':
          description: List of validation runs
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ValidationRun'

  /api/validations/{id}:
    get:
      summary: Get validation run details
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Validation run details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationRun'
```

**Service Structure**:
```
services/validation/
├── src/
│   ├── api/
│   │   ├── routes.ts
│   │   └── middleware/
│   ├── domain/
│   │   ├── validation-engine.ts
│   │   ├── csv-processor.ts
│   │   └── rules/
│   ├── infrastructure/
│   │   ├── database.ts
│   │   ├── queue.ts
│   │   └── logger.ts
│   └── index.ts
├── tests/
├── Dockerfile
├── package.json
└── docker-compose.yml
```

**Deployment**:
```yaml
# docker-compose.yml (dev environment)
version: '3.8'

services:
  validation-api:
    build: ./services/validation
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://user:pass@validation-db:5432/validation
      REDIS_URL: redis://redis:6379
    depends_on:
      - validation-db
      - redis

  validation-worker:
    build: ./services/validation
    command: npm run worker
    environment:
      DATABASE_URL: postgresql://user:pass@validation-db:5432/validation
      REDIS_URL: redis://redis:6379
    depends_on:
      - validation-db
      - redis

  validation-db:
    image: postgres:16
    environment:
      POSTGRES_DB: validation
      POSTGRES_USER: validation_user
      POSTGRES_PASSWORD: secure_password
    volumes:
      - validation-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  validation-data:
```

**Deliverables**:
- ✅ Validation service extracted from monolith
- ✅ Dedicated PostgreSQL database
- ✅ Docker images for API and worker
- ✅ API documentation (OpenAPI spec)
- ✅ Health checks and metrics endpoints

**Effort**: 20-25 days
**Cost**: $50/month (dedicated database instance)

---

### Milestone 1.3: Data Migration Strategy (Month 4)

#### Challenge: Migrate Existing Validation Data

**Options**:

| Option | Pros | Cons |
|--------|------|------|
| **Big Bang Migration** | Simple, one-time effort | Downtime required, risky |
| **Dual Write** | Zero downtime | Complex, data sync issues |
| **Read-Only Archive** | Safe, no data loss | Old data not migrated |

**Recommended Approach**: **Read-Only Archive + Dual Write**

```typescript
// ✅ MIGRATION STRATEGY

// Step 1: Freeze old validation_runs table (read-only)
ALTER TABLE validation_runs ADD COLUMN migrated BOOLEAN DEFAULT FALSE;
ALTER TABLE validation_runs ADD COLUMN archived BOOLEAN DEFAULT FALSE;

// Step 2: New validations go to new service
router.post("/api/validations", async (req, res) => {
  // Route to new validation service via Kong
  const response = await fetch('http://validation-service:3001/api/validations', {
    method: 'POST',
    body: JSON.stringify(req.body),
    headers: { 'Content-Type': 'application/json' },
  });

  res.json(await response.json());
});

// Step 3: Old validations retrieved from monolith
router.get("/api/validations/:id", async (req, res) => {
  const id = req.params.id;

  // Check if validation exists in new service
  const newServiceRun = await fetch(`http://validation-service:3001/api/validations/${id}`);

  if (newServiceRun.ok) {
    return res.json(await newServiceRun.json());
  }

  // Fallback to monolith database (archived data)
  const oldRun = await storage.getValidationRun(id);
  if (oldRun) {
    return res.json({ ...oldRun, archived: true });
  }

  res.status(404).json({ error: 'Validation run not found' });
});
```

**Deliverables**:
- ✅ Data migration scripts
- ✅ Rollback plan documented
- ✅ Archived data access via monolith

**Effort**: 5-7 days

---

### Milestone 1.4: Testing & Rollout (Months 5-6)

#### Testing Strategy

**1. Unit Tests**:
```typescript
// tests/validation-engine.test.ts
import { describe, it, expect } from 'vitest';
import { ValidationEngine } from '../src/domain/validation-engine';

describe('ValidationEngine', () => {
  it('should register and execute rules', async () => {
    const engine = new ValidationEngine();
    const mockRule = {
      id: 'test-rule',
      name: 'Test Rule',
      category: 'test',
      enabled: true,
      validate: async (records) => [],
    };

    engine.registerRule(mockRule);

    const results = await engine.validateRecords([], 'test-run-id');
    expect(results).toEqual([]);
  });
});
```

**2. Integration Tests**:
```typescript
// tests/integration/validation-api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/index';
import { setupTestDatabase, teardownTestDatabase } from './helpers/db';

describe('Validation API Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('should queue validation and process asynchronously', async () => {
    // Upload file
    const uploadRes = await request(app)
      .post('/api/files')
      .attach('file', './test-fixtures/sample.csv');

    expect(uploadRes.status).toBe(200);
    const { fileId } = uploadRes.body;

    // Start validation
    const validationRes = await request(app)
      .post('/api/validations')
      .send({ fileId });

    expect(validationRes.status).toBe(202);
    const { validationId } = validationRes.body;

    // Wait for processing (poll until completed)
    let status = 'queued';
    for (let i = 0; i < 30; i++) {
      const statusRes = await request(app).get(`/api/validations/${validationId}`);
      status = statusRes.body.status;
      if (status === 'completed' || status === 'failed') break;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    expect(status).toBe('completed');
  });
});
```

**3. Load Testing** (k6):
```javascript
// tests/load/validation-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },  // Ramp up to 10 users
    { duration: '3m', target: 10 },  // Stay at 10 users
    { duration: '1m', target: 50 },  // Ramp up to 50 users
    { duration: '3m', target: 50 },  // Stay at 50 users
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],   // Error rate < 1%
  },
};

export default function () {
  // Upload file
  const file = open('./sample.csv', 'b');
  const uploadRes = http.post('http://validation-service:3001/api/files', {
    file: http.file(file, 'sample.csv'),
  });

  check(uploadRes, {
    'upload status is 200': (r) => r.status === 200,
  });

  const fileId = uploadRes.json('fileId');

  // Start validation
  const validationRes = http.post('http://validation-service:3001/api/validations', {
    fileId,
  });

  check(validationRes, {
    'validation status is 202': (r) => r.status === 202,
  });

  sleep(1);
}
```

#### Rollout Plan

**Week 1-2: Internal Testing**
- Deploy to staging environment
- Run integration and load tests
- Fix bugs discovered

**Week 3: Canary Deployment**
- Route 10% of production traffic to new service
- Monitor error rates and performance
- Rollback if error rate > 1%

**Week 4: Gradual Rollout**
- Increase to 25% traffic
- Increase to 50% traffic
- Increase to 100% traffic

**Week 5: Deprecate Monolith Code**
- Remove validation routes from monolith
- Archive old validation data
- Update documentation

**Deliverables**:
- ✅ Test coverage > 80%
- ✅ Load testing passing (50 concurrent users)
- ✅ Canary deployment successful
- ✅ Production traffic at 100% on new service

**Effort**: 15-20 days

---

## Phase 1 Summary

### Deliverables After 6 Months

✅ **Infrastructure**:
- Redis job queue (BullMQ)
- Kong API Gateway
- Observability stack (Winston, Sentry, Prometheus, Grafana)

✅ **Services**:
- Validation Service (independent deployment)
- Background worker for CSV processing

✅ **Performance Improvements**:
- CSV processing no longer blocks event loop
- Support for 50+ concurrent users
- Zero-downtime deployments

✅ **Monitoring & Ops**:
- Structured logging across all services
- Error tracking with Sentry
- Metrics dashboards in Grafana

### Total Cost (Monthly)

| Item | Cost |
|------|------|
| Redis Cloud (250MB) | $15 |
| Validation Service PostgreSQL | $50 |
| Sentry Team Plan | $26 |
| **Total** | **$91/month** |

### Team Effort

- **Backend Engineer**: 50-60 days
- **DevOps Engineer**: 15-20 days
- **QA Engineer**: 10-15 days

---

## Phase 2: Service Expansion (Months 7-12)

### Objectives

1. Extract 2-3 more services (Database, Chatbot, Administration)
2. Implement event-driven architecture with message queue
3. Add row-level security for multi-tenancy
4. Create API versioning strategy

### Milestone 2.1: Database Service (Months 7-8)

**Purpose**: Manage reference data (codes, contexts, establishments, rules)

**Service Boundary**:
```
Database Service:
- GET /api/codes
- GET /api/contexts
- GET /api/establishments
- GET /api/rules
- POST /api/{table} (Editor/Admin)
- PATCH /api/{table}/:id (Editor/Admin)
- DELETE /api/{table}/:id (Admin)
- POST /api/{table}/import (CSV import)
- GET /api/{table}/export (CSV export)
```

**Why Extract This Service**:
- Reference data accessed by multiple modules (Validation, Chatbot, Formation)
- Needs independent scaling (read-heavy workload)
- Can benefit from aggressive caching

**Architecture**:
```
Database Service:
├─ API Layer (Express.js)
├─ Cache Layer (Redis)
│  ├─ codes (TTL: 1 hour)
│  ├─ contexts (TTL: 1 hour)
│  └─ rules (TTL: 24 hours, invalidate on update)
└─ PostgreSQL (Reference Data Only)
```

**Deliverables**:
- ✅ Database service extracted
- ✅ Redis caching implemented
- ✅ API documentation (OpenAPI spec)

**Effort**: 15-20 days

---

### Milestone 2.2: Event-Driven Architecture (Months 9-10)

**Purpose**: Decouple services via asynchronous events

**Message Queue**: RabbitMQ or Apache Kafka

**Event Examples**:
```typescript
// validation.service.ts
// When validation completes, emit event
await eventBus.publish('validation.completed', {
  validationRunId: run.id,
  errorCount: results.length,
  timestamp: new Date(),
});

// chatbot.service.ts
// Chatbot listens for validation events to provide suggestions
eventBus.subscribe('validation.completed', async (event) => {
  if (event.errorCount > 0) {
    // Generate AI suggestion for fixing errors
    await generateErrorSuggestions(event.validationRunId);
  }
});
```

**Benefits**:
- Services don't need to know about each other
- Easy to add new event consumers
- Built-in retry and dead-letter queues

**Deliverables**:
- ✅ RabbitMQ deployed
- ✅ Event bus abstraction layer
- ✅ 3-5 key events defined (validation.completed, file.uploaded, etc.)

**Effort**: 10-15 days

---

### Milestone 2.3: Multi-Tenancy (Months 11-12)

**Purpose**: Support multiple Quebec healthcare organizations

**Tenant Isolation Strategy**:
```sql
-- Add tenant_id to all user-specific tables
ALTER TABLE files ADD COLUMN tenant_id UUID;
ALTER TABLE validation_runs ADD COLUMN tenant_id UUID;
ALTER TABLE billing_records ADD COLUMN tenant_id UUID;

-- Enable Row-Level Security
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY tenant_isolation_files ON files
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_validation_runs ON validation_runs
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Middleware**:
```typescript
// Set tenant context from JWT claims
app.use(async (req, res, next) => {
  const tenantId = req.user?.tenantId;

  if (tenantId) {
    await db.execute(sql`SET app.current_tenant_id = ${tenantId}`);
  }

  next();
});
```

**Deliverables**:
- ✅ Row-level security implemented
- ✅ Tenant management API
- ✅ Tenant-specific billing/analytics

**Effort**: 15-20 days

---

## Phase 2 Summary

### Deliverables After 12 Months

✅ **Services (Total: 3-4)**:
- Validation Service
- Database Service
- Chatbot Service (if extracted)

✅ **Architecture Patterns**:
- Event-driven communication (RabbitMQ)
- Multi-tenancy with row-level security
- API versioning (v1, v2)

✅ **Performance**:
- Support for 100-200 concurrent users
- 80% reduction in API response times (caching)

### Total Cost (Monthly)

| Item | Cost |
|------|------|
| Phase 1 Infrastructure | $91 |
| RabbitMQ Cloud (Standard) | $30 |
| Database Service PostgreSQL | $50 |
| Additional Sentry events | $20 |
| **Total** | **$191/month** |

---

## Phase 3: Full Microservices (Months 13-18)

### Objectives

1. Extract all remaining services (Administration, Formation, Chatbot)
2. Implement service mesh (Istio/Linkerd)
3. Multi-region deployment (Quebec + backup)
4. GraphQL federation for unified API

### Milestone 3.1: Service Mesh (Months 13-14)

**Purpose**: Service-to-service communication, security, observability

**Service Mesh**: Istio or Linkerd

**Features**:
- **Traffic Management**: Load balancing, retries, circuit breakers
- **Security**: mTLS between services
- **Observability**: Distributed tracing, metrics

**Architecture**:
```
                    Kong API Gateway
                           │
                ┌──────────┴──────────┐
                │   Service Mesh      │
                │   (Istio/Linkerd)   │
                └─────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  Validation Service  Database Service  Chatbot Service
  (with sidecar)      (with sidecar)    (with sidecar)
```

**Deliverables**:
- ✅ Istio/Linkerd deployed
- ✅ mTLS enabled between services
- ✅ Circuit breakers configured

**Effort**: 15-20 days

---

### Milestone 3.2: Multi-Region Deployment (Months 15-16)

**Purpose**: High availability and disaster recovery

**Architecture**:
```
                  Cloudflare DNS
                       │
            ┌──────────┴──────────┐
            ▼                     ▼
     Quebec Region          Backup Region
     (Primary)              (Toronto/Montreal)
     ├─ Kubernetes          ├─ Kubernetes
     ├─ PostgreSQL (RDS)    ├─ PostgreSQL (replica)
     └─ Redis (Primary)     └─ Redis (replica)
```

**Failover Strategy**:
- Primary region fails → DNS switches to backup
- Database replication (streaming replication)
- Redis Sentinel for automatic failover

**Deliverables**:
- ✅ Kubernetes cluster in 2 regions
- ✅ Database replication configured
- ✅ Automated failover testing

**Effort**: 20-25 days

---

### Milestone 3.3: GraphQL Federation (Months 17-18)

**Purpose**: Unified API for frontend

**Architecture**:
```
                  GraphQL Gateway
                  (Apollo Federation)
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  Validation Subgraph  Database Subgraph  Chatbot Subgraph

# Query example
query GetValidationWithCodes {
  validation(id: "123") {    # From Validation Service
    id
    status
    results {
      code {                  # From Database Service
        description
        tariffValue
      }
    }
  }
}
```

**Deliverables**:
- ✅ Apollo Federation Gateway
- ✅ Subgraph schemas defined
- ✅ Frontend migrated to GraphQL

**Effort**: 15-20 days

---

## Phase 3 Summary

### Deliverables After 18 Months

✅ **Services (Total: 7+)**:
- All modules extracted as microservices

✅ **Infrastructure**:
- Service mesh (Istio/Linkerd)
- Multi-region deployment
- GraphQL federation

✅ **Performance**:
- Support for 500+ concurrent users
- 99.9% uptime SLA
- Multi-region failover (< 1 min RTO)

### Total Cost (Monthly)

| Item | Cost |
|------|------|
| Phase 2 Infrastructure | $191 |
| Kubernetes Cluster (2 regions) | $300 |
| RDS PostgreSQL Multi-AZ | $200 |
| Redis Cluster | $100 |
| CDN (Cloudflare Pro) | $20 |
| **Total** | **$811/month** |

---

## Decision Points & Rollback Strategy

### When to Stop/Pause Migration

**Red Flags** (Stop migration):
- Error rate > 5% for new service
- User complaints about performance
- Team velocity drops > 30%
- Budget overrun > 50%

**Rollback Plan**:
```
If Service Extraction Fails:
1. Route 100% traffic back to monolith via Kong
2. Disable new service in Docker Compose
3. Restore database from backup (if schema changed)
4. Investigate root cause before retrying
```

**Go/No-Go Criteria**:
- ✅ Test coverage > 80%
- ✅ Load testing passes (target user count)
- ✅ Error rate < 1% in staging
- ✅ Team trained on new architecture

---

## Technology Stack Recommendations

### Phase 1 (Months 1-6)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Job Queue** | BullMQ | Best Node.js queue, Redis-backed |
| **API Gateway** | Kong OSS | Feature-rich, free tier |
| **Logging** | Winston | De-facto Node.js standard |
| **Error Tracking** | Sentry | Best developer experience |
| **Metrics** | Prometheus + Grafana | Industry standard, free |
| **Containerization** | Docker + Docker Compose | Simple for dev/staging |

### Phase 2 (Months 7-12)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Message Queue** | RabbitMQ | Simpler than Kafka, sufficient for now |
| **Caching** | Redis | Already used for job queue |
| **Database** | PostgreSQL 16 | Existing expertise |

### Phase 3 (Months 13-18)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Orchestration** | Kubernetes | Industry standard for microservices |
| **Service Mesh** | Linkerd | Lighter than Istio, easier to learn |
| **API Federation** | Apollo GraphQL | Best GraphQL gateway |
| **Cloud Provider** | AWS or GCP | Multi-region support, managed services |

---

## Team Skills & Training

### Required Skills by Phase

**Phase 1**:
- Docker & Docker Compose
- Redis & BullMQ
- API Gateway concepts (Kong)
- Prometheus & Grafana basics

**Phase 2**:
- RabbitMQ / Apache Kafka
- Event-driven architecture patterns
- PostgreSQL row-level security
- API versioning strategies

**Phase 3**:
- Kubernetes (CKA certification recommended)
- Service mesh concepts (Istio/Linkerd)
- GraphQL schema design
- Multi-region deployment strategies

### Training Plan

**Month 1-2**: Docker, Redis, API Gateway fundamentals
**Month 6-7**: Event-driven architecture workshops
**Month 12-13**: Kubernetes certification prep
**Month 15-16**: Service mesh training

---

## Success Metrics

### Technical Metrics

| Metric | Current | Phase 1 Target | Phase 2 Target | Phase 3 Target |
|--------|---------|---------------|---------------|---------------|
| **Concurrent Users** | 20 | 50 | 200 | 500+ |
| **CSV Processing Time (10k rows)** | 2-5 min | < 30 sec | < 15 sec | < 10 sec |
| **API Response Time (p95)** | 500ms | 300ms | 200ms | 100ms |
| **Error Rate** | 2-3% | < 1% | < 0.5% | < 0.1% |
| **Deployment Frequency** | 1x/week | 3x/week | Daily | Multiple/day |
| **Mean Time to Recovery (MTTR)** | 2-4 hours | 1 hour | 30 min | 10 min |
| **Uptime** | 99% | 99.5% | 99.9% | 99.99% |

### Business Metrics

| Metric | Current | Phase 1 | Phase 2 | Phase 3 |
|--------|---------|---------|---------|---------|
| **Tenants Supported** | 1 | 1-3 | 10-20 | 100+ |
| **Monthly Active Users** | 50 | 100 | 500 | 2000+ |
| **Validation Runs/Month** | 1,000 | 5,000 | 25,000 | 100,000+ |
| **Revenue (MRR)** | $0 | $500 | $5,000 | $25,000+ |

---

## Conclusion

This roadmap provides a **phased, low-risk approach** to evolving Dash from a modular monolith to a scalable microservices architecture. By using the **Strangler Fig Pattern**, you minimize downtime and deliver incremental value.

**Key Principles**:
1. ✅ Extract services gradually, not in one big-bang rewrite
2. ✅ Maintain backward compatibility during migration
3. ✅ Test extensively before production rollout
4. ✅ Monitor aggressively and rollback if needed
5. ✅ Train team continuously on new technologies

**Next Steps**:
1. Review and approve this roadmap with stakeholders
2. Set up Phase 1 infrastructure (Redis, Kong, observability)
3. Extract Validation Service (highest value)
4. Measure success metrics and iterate

**Timeline Summary**:
- **Phase 1**: Months 1-6 (Foundation)
- **Phase 2**: Months 7-12 (Expansion)
- **Phase 3**: Months 13-18 (Full Microservices)

Good luck with your microservices journey! 🚀

---

**Document Version**: 1.0
**Last Updated**: October 5, 2025
**Author**: Healthcare SAAS Architect Agent
**Next Review**: April 2026 (post Phase 1 completion)
