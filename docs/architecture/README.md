# Dash Architecture Overview

This document provides a high-level overview of the Dash platform architecture, including system design, technology choices, and key architectural decisions.

## System Overview

Dash is a **modular SAAS platform** designed to centralize business operations with a focus on Quebec healthcare billing validation. The architecture follows modern best practices for scalability, security, and maintainability.

### Core Principles

1. **Modular Design**: Business functions as self-contained modules
2. **Security First**: PHI protection, Auth0 integration, role-based access
3. **Performance**: Redis caching, database indexes, background job processing
4. **Observability**: Sentry error tracking, OpenTelemetry tracing
5. **Quebec Compliance**: French interface, RAMQ validation rules, data residency

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT TIER                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         React 18 (TypeScript + Vite)                   │ │
│  │  - Pages (Dashboard, Codes, Validateur, etc.)         │ │
│  │  - Components (DataTable, Forms, Charts)              │ │
│  │  - TanStack Query (API state management)             │ │
│  │  - Auth0 React SDK (authentication)                   │ │
│  │  - Tailwind CSS + Radix UI (styling)                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/REST API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      APPLICATION TIER                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Express.js (TypeScript + Node.js)              │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │          MODULE REGISTRY                          │ │ │
│  │  │  - Dynamic module loading                        │ │ │
│  │  │  - Route registration                            │ │ │
│  │  │  - Feature flags                                 │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                         │ │
│  │  [Modules]                                             │ │
│  │  ├─ core-auth         (Auth0 integration)             │ │
│  │  ├─ observability     (Sentry + OpenTelemetry)        │ │
│  │  ├─ validateur        (RAMQ validation - flagship)    │ │
│  │  ├─ database          (Reference data management)     │ │
│  │  ├─ administration    (User management)               │ │
│  │  ├─ chatbot           (AI assistant - disabled)       │ │
│  │  ├─ formation         (Training - disabled)           │ │
│  │  └─ tasks             (Kanban board - disabled)       │ │
│  │                                                         │ │
│  │  [Middleware]                                          │ │
│  │  ├─ authenticateToken (JWT verification)              │ │
│  │  ├─ requireRole       (RBAC authorization)            │ │
│  │  ├─ requireOwnership  (PHI access control)            │ │
│  │  └─ phiSanitizer      (PHI redaction in logs)         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   DATA TIER     │  │   CACHE TIER    │  │   QUEUE TIER    │
│                 │  │                 │  │                 │
│  PostgreSQL 16  │  │    Redis 7      │  │    BullMQ       │
│                 │  │                 │  │                 │
│  - Drizzle ORM  │  │  - Cache-aside  │  │  - Background   │
│  - 15+ tables   │  │  - 1hr TTL      │  │    validation   │
│  - 9 indexes    │  │  - 95%+ hit     │  │  - Job queue    │
│  - PHI data     │  │  - Warm-up      │  │  - Retry logic  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Technology Stack

### Frontend

| Technology | Purpose | Version |
|------------|---------|---------|
| **React** | UI framework | 18.3.1 |
| **TypeScript** | Type safety | 5.6.3 |
| **Vite** | Build tool | 5.4.11 |
| **Wouter** | Routing | 3.3.5 |
| **TanStack Query** | API state management | 5.59.16 |
| **Radix UI** | UI primitives | Various |
| **Tailwind CSS** | Styling | 3.4.15 |
| **Auth0 React** | Authentication | 2.2.4 |
| **Recharts** | Data visualization | 2.13.3 |

### Backend

| Technology | Purpose | Version |
|------------|---------|---------|
| **Node.js** | Runtime | 18+ |
| **Express** | Web framework | 4.21.1 |
| **TypeScript** | Type safety | 5.6.3 |
| **Drizzle ORM** | Database ORM | 0.36.4 |
| **PostgreSQL** | Database | 16+ |
| **Redis** | Caching | 7+ (ioredis 5.4.1) |
| **BullMQ** | Job queue | 5.28.1 |
| **Auth0** | Authentication | 4.7.0 (express-oauth2-jwt-bearer) |
| **Zod** | Validation | 3.23.8 |
| **Multer** | File uploads | 1.4.5-lts.1 |
| **CSV-Parser** | CSV processing | 3.0.0 |

### Observability (Optional)

| Technology | Purpose |
|------------|---------|
| **Sentry** | Error tracking |
| **OpenTelemetry** | Distributed tracing |
| **Winston** | Logging |

## Module Architecture

### Module System Design

Dash uses a **plug-and-play module architecture** where each business function is a self-contained module:

```
Module Structure:
├── dash.json           # Module manifest (config)
├── routes.ts           # Express routes
├── storage.ts          # Database operations
├── validation.ts       # Business logic
└── types.ts            # TypeScript types
```

**Key Benefits**:
- **Isolation**: Modules don't interfere with each other
- **Scalability**: Add new features without touching existing code
- **Feature Flags**: Enable/disable modules without code changes
- **Testing**: Test modules independently

See [Module System Documentation](../modules/README.md) for details.

## Authentication & Authorization

### Auth0 Integration

```
┌──────────────┐
│   Browser    │
└──────┬───────┘
       │ 1. Redirect to Auth0
       ▼
┌──────────────┐
│    Auth0     │ 2. User authenticates
└──────┬───────┘
       │ 3. JWT token issued
       ▼
┌──────────────┐
│  Dash API    │ 4. Verify JWT signature
└──────┬───────┘    5. Extract user claims
       │            6. Check role (RBAC)
       ▼            7. Check ownership (PHI)
┌──────────────┐
│   Resource   │ 8. Return protected data
└──────────────┘
```

**Token Validation**:
- Algorithm: RS256 (asymmetric cryptography)
- Issuer: Auth0 domain
- Audience: `facnet-validator-api`
- Expiration: Configurable via Auth0 dashboard

**Role-Based Access Control (RBAC)**:
- `pending` - No access (awaiting approval)
- `viewer` - Read-only access
- `editor` - Read + write access
- `admin` - Full access including user management

### Ownership Verification

For PHI protection, users can only access their own validation runs:

```typescript
app.get('/api/validations/:id',
  authenticateToken,           // Verify JWT
  requireOwnership('validation_runs', 'user_id'),  // Check ownership
  getValidationDetails         // Return data
);
```

See [PHI Access Control](../security/PHI_ACCESS_CONTROL.md) for details.

## Data Architecture

### Database Schema

**15+ Tables**:
- **Core**: users, validation_runs, billing_records, validation_results
- **Reference**: codes, contexts, establishments, rules
- **System**: files, validation_logs, field_catalog

**Key Design Decisions**:
- **UUID Primary Keys**: Allow duplicate billing codes with different attributes
- **Soft Deletes**: `deleted_at` timestamp for audit trails
- **Custom JSON Fields**: Extensibility without schema changes
- **PHI Isolation**: User ID on validation runs for ownership verification

**9 Performance Indexes**:
- Foreign keys: validation_run_id, user_id
- Query fields: code, patient, date_service, severity, status
- Full-text search: GIN index on code descriptions (French)

See [Database Documentation](../guides/DATABASE.md) for complete schema.

### Redis Caching Strategy

**Cache-Aside Pattern**:

```
1. Check cache (Redis)
   ├─ Hit:  Return cached data (1-5ms)
   └─ Miss: Query database (50-200ms)
            └─ Populate cache (TTL: 1hr)
```

**Cached Data**:
- RAMQ codes (6,740 records, ~4MB)
- Service contexts (~200 records)
- Healthcare establishments (~1,000 records)
- Validation rules (~50 rules)

**Cache Invalidation**:
- Automatic on create/update/delete operations
- Manual flush for development/testing

**Performance Impact**:
- 40-200x faster for cached data
- 95%+ reduction in database load
- ~10ms API response time (vs ~150ms without cache)

## Background Job Processing

### BullMQ Queue Architecture

```
┌────────────────┐
│  API Request   │ 1. Create validation job
└────────┬───────┘
         │
         ▼
┌────────────────┐
│  Redis Queue   │ 2. Job queued
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ BullMQ Worker  │ 3. Process CSV file
└────────┬───────┘    4. Run validation rules
         │            5. Save results
         ▼
┌────────────────┐
│  PostgreSQL    │ 6. Store billing records
└────────────────┘    7. Store validation results
```

**Job Types**:
- **CSV Validation**: Process uploaded CSV files
- **Batch Import**: Import reference data (codes, contexts)
- **Data Export**: Generate CSV exports

**Retry Strategy**:
- Max retries: 3
- Backoff: Exponential (1s, 2s, 4s)
- Error handling: Log failures, notify user

## Security Architecture

### PHI (Protected Health Information) Protection

**Defense in Depth**:

1. **Access Control**: Ownership verification middleware
2. **Encryption in Transit**: HTTPS/TLS 1.2+
3. **Encryption at Rest**: PostgreSQL file system encryption
4. **Audit Logging**: All PHI access logged to `validation_logs`
5. **PHI Redaction**: Automatic sanitization in logs/observability
6. **File Cleanup**: Uploaded files deleted after processing

**PHI Redaction**:

```typescript
// Input (with PHI)
{
  patient: "PATIENT_001",
  healthCard: "123456789012",
  doctor: "Dr. Smith"
}

// Output (redacted)
{
  patient: "[REDACTED]",
  healthCard: "[HEALTH-CARD-REDACTED]",
  doctor: "[REDACTED]"
}
```

See [Security Overview](../security/README.md) for complete details.

### Network Security

**Production Firewall (UFW)**:
```
22  (SSH - key authentication only)
80  (HTTP - redirects to 443)
443 (HTTPS)
```

**Internal Services** (localhost only):
- PostgreSQL: 5432 (not exposed)
- Redis: 6379 (not exposed)
- Application: 5000 (proxied via Nginx)

## Observability

### Error Tracking (Sentry)

- Real-time error monitoring
- Automatic exception capture
- PHI sanitization before transmission
- User context (ID only, no email/username)
- Release tracking for deployments

### Distributed Tracing (OpenTelemetry)

- Trace CSV processing pipeline
- Trace validation rule execution
- Trace database queries
- Trace background jobs
- Custom spans for critical operations

**Sampling Rates**:
- Development: 100% (all traces)
- Staging: 50% (balanced monitoring)
- Production: 10% (cost-effective)

See [Observability Documentation](../operations/OBSERVABILITY.md) for setup guide.

## Deployment Architecture

### Current Production (OVH VPS)

```
┌──────────────────────────────────────────┐
│         Ubuntu 24.04 LTS Server          │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │            Nginx                    │ │
│  │  - SSL termination                 │ │
│  │  - Reverse proxy                   │ │
│  │  - Rate limiting                   │ │
│  │  - Security headers                │ │
│  └────────────┬───────────────────────┘ │
│               │                          │
│  ┌────────────▼───────────────────────┐ │
│  │          PM2 Cluster               │ │
│  │  - 6 Node.js instances             │ │
│  │  - Auto-restart on failure         │ │
│  │  - Zero-downtime deployments       │ │
│  └────────────┬───────────────────────┘ │
│               │                          │
│  ┌────────────▼───────────────────────┐ │
│  │      PostgreSQL 16 + Redis 7       │ │
│  │  - Local filesystem                │ │
│  │  - Daily backups (7-day retention) │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Proposed AWS Architecture

See [AWS Deployment Plan](../planning/AWS_DEPLOYMENT_PLAN.md) for complete migration strategy.

**Key Components**:
- **EC2**: Application servers with Auto Scaling
- **RDS PostgreSQL**: Managed database with Multi-AZ
- **ElastiCache Redis**: Managed cache cluster
- **S3**: File uploads and backups
- **ALB**: Application Load Balancer
- **Route 53**: DNS management
- **VPC**: Network isolation

**Cost Estimate**: ~$540/month

## Performance Optimizations

### Database

1. **Strategic Indexes** (9 total):
   - Foreign keys: 100x faster joins
   - Query fields: 50x faster lookups
   - Full-text search: 30x faster text queries

2. **Connection Pooling**: Max 20 connections

3. **Query Optimization**: Drizzle ORM with prepared statements

### Caching

1. **Redis Layer**: 95%+ cache hit ratio
2. **Warm-up on Startup**: 1-3 seconds to populate cache
3. **Automatic Invalidation**: On data mutations

### Frontend

1. **Code Splitting**: Vite automatic chunking
2. **Lazy Loading**: Routes loaded on demand
3. **Asset Optimization**: Minification, compression
4. **API State Management**: TanStack Query with caching

### Backend

1. **PM2 Clustering**: 6 instances for load distribution
2. **Background Jobs**: Offload heavy processing to BullMQ
3. **Graceful Shutdown**: Drain connections before restart

## Scalability Considerations

### Horizontal Scaling

- **Frontend**: Serve from CDN (CloudFront)
- **Backend**: Add EC2 instances behind ALB
- **Database**: Read replicas for read-heavy workloads
- **Cache**: Redis cluster with sharding

### Vertical Scaling

- **Database**: Larger RDS instance types
- **Cache**: ElastiCache memory increase
- **Application**: Larger EC2 instance types

### Current Limits

- **Concurrent Users**: ~100-200 (single VPS)
- **File Size**: 10 MB max
- **Database Size**: ~10 GB (current usage)
- **Cache Size**: ~5 MB reference data

## Technology Decisions

### Why React?

- Large ecosystem and community
- Component reusability
- TanStack Query for API state management
- Excellent TypeScript support

### Why Express?

- Minimal and flexible
- Large middleware ecosystem
- Well-documented and stable
- Easy to extend with modules

### Why PostgreSQL?

- Robust SQL features (joins, aggregations)
- JSONB for flexible schemas
- Full-text search with GIN indexes
- Proven reliability for healthcare data

### Why Redis?

- In-memory speed (1-5ms latency)
- Simple cache-aside pattern
- BullMQ integration for job queues
- Minimal operational overhead

### Why Drizzle ORM?

- Type-safe queries
- Better performance than Prisma
- SQL-like syntax
- Migrations support

### Why Auth0?

- OAuth 2.0/JWT industry standard
- MFA support for healthcare compliance
- User management UI
- HIPAA Business Associate Agreement available

## Related Documentation

- [Module System](../modules/README.md) - Modular architecture details
- [Database Schema](../guides/DATABASE.md) - Complete database documentation
- [API Reference](../guides/API.md) - REST API endpoints
- [Security Overview](../security/README.md) - Security architecture
- [Testing Guide](../guides/TESTING.md) - Testing strategy
- [AWS Deployment Plan](../planning/AWS_DEPLOYMENT_PLAN.md) - Cloud migration

## Maintenance

- **Database Backups**: Daily automated backups (7-day retention)
- **Log Rotation**: PM2 automatic log rotation
- **Dependency Updates**: Monthly security updates
- **Performance Monitoring**: PM2 status, health endpoints
- **Error Tracking**: Sentry alerts for critical errors

---

**Last Updated**: January 2025
**Architecture Version**: 1.0.0
**Production Environment**: OVH VPS (Ubuntu 24.04 LTS)
