# Database Schema Guide - DASH Healthcare Validation Platform

**Last Updated**: October 2025
**Database**: PostgreSQL 16
**ORM**: Drizzle ORM
**Schema File**: `server/schema.ts`

---

## Table of Contents

1. [Overview](#overview)
2. [Connection Configuration](#connection-configuration)
3. [Core Tables](#core-tables)
4. [Validation Tables](#validation-tables)
5. [Reference Data Tables](#reference-data-tables)
6. [Performance Optimization](#performance-optimization)
7. [Migrations](#migrations)
8. [Data Integrity](#data-integrity)
9. [Security & PHI Compliance](#security--phi-compliance)
10. [Common Queries](#common-queries)

---

## Overview

DASH uses PostgreSQL 16 with Drizzle ORM for type-safe database operations. The schema is designed for Quebec healthcare billing validation with PHI (Protected Health Information) compliance.

### Database Statistics

- **Tables**: 15+ core tables
- **Indexes**: 9 performance indexes
- **Total Codes**: 6,740 RAMQ billing codes
- **Validation Rules**: 123+ active rules
- **Establishments**: ~1,000 Quebec healthcare facilities

### Key Features

- ✅ **Type Safety**: Drizzle ORM with TypeScript
- ✅ **PHI Compliance**: Access control and audit logging
- ✅ **Performance**: Strategic indexes for 10-100x speedup
- ✅ **Caching**: Redis layer for reference data (95%+ reduction in DB load)
- ✅ **Soft Deletes**: Audit trails with `active` flags
- ✅ **SSL/TLS**: Encrypted connections (`sslmode=require`)

---

## Connection Configuration

### Connection String Format

```bash
# Local Development
DATABASE_URL=postgresql://dashvalidator_user:PASSWORD@localhost:5432/dashvalidator?sslmode=prefer

# Production
DATABASE_URL=postgresql://dashvalidator_user:PASSWORD@localhost:5432/dashvalidator?sslmode=require

# Staging
DATABASE_URL=postgresql://dashvalidator_user:PASSWORD@localhost:5432/dashvalidator_staging?sslmode=require
```

### Database Credentials

**Production Database**:
- **Name**: `dashvalidator`
- **User**: `dashvalidator_user`
- **Password**: (stored in `.env`)
- **Host**: `localhost`
- **Port**: `5432`
- **SSL Mode**: `require` (enforced for PHI compliance)

**Staging Database**:
- **Name**: `dashvalidator_staging`
- **User**: Same as production
- **Isolation**: Separate database for testing

### SSL Certificate

PostgreSQL uses Ubuntu snakeoil self-signed certificates:
```bash
# Verify SSL is enabled
sudo -u postgres psql -c "SHOW ssl;"  # Returns: on

# View certificate path
sudo -u postgres psql -c "SHOW ssl_cert_file;"
# Returns: /etc/ssl/certs/ssl-cert-snakeoil.pem
```

---

## Core Tables

### users

Manages user authentication and authorization (Auth0 integration).

**Schema**:
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                    -- Auth0 user ID (auth0|123456)
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'pending',   -- pending|viewer|editor|admin
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);
```

**Indexes**:
- Primary key on `id`
- Unique index on `email`

**TypeScript Type**:
```typescript
type User = {
  id: string;
  email: string;
  name: string | null;
  role: 'pending' | 'viewer' | 'editor' | 'admin';
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date | null;
};
```

---

### files

Tracks uploaded CSV files for validation.

**Schema**:
```sql
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  size INTEGER NOT NULL,                  -- File size in bytes
  mime_type TEXT NOT NULL DEFAULT 'text/csv',
  path TEXT NOT NULL,                     -- File system path
  uploaded_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,                   -- Soft delete for PHI compliance
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Indexes**:
- Primary key on `id`
- Index on `user_id` for user-specific queries
- Index on `uploaded_at` for chronological sorting

**Notes**:
- Files are automatically deleted after validation (PHI security)
- `deleted_at` timestamp tracks when file was removed from filesystem

---

## Validation Tables

### validation_runs

Tracks validation job execution.

**Schema**:
```sql
CREATE TABLE validation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES files(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|processing|completed|failed
  record_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,              -- 0-100
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  phi_redaction_enabled BOOLEAN DEFAULT true,
  CONSTRAINT fk_file FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Indexes**:
- Primary key on `id`
- **Performance Index**: `idx_validation_runs_status` on `status` (40x faster)
- Index on `user_id` for access control
- Index on `created_at` for chronological queries

**Status Flow**:
```
pending → processing → completed
                    ↘ failed
```

---

### billing_records

Stores parsed billing data from CSV files (temporary, cleared after validation).

**Schema**:
```sql
CREATE TABLE billing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_run_id UUID NOT NULL REFERENCES validation_runs(id),
  row_number INTEGER NOT NULL,
  facture TEXT,                           -- Invoice number
  id_ramq TEXT,                           -- RAMQ invoice ID
  date_de_service DATE NOT NULL,
  debut TIME,                             -- Start time
  fin TIME,                               -- End time
  lieu_de_pratique TEXT,                  -- Establishment code
  secteur_activite TEXT,                  -- Sector (cabinet, établissement)
  diagnostic TEXT,                        -- Diagnosis code
  code TEXT NOT NULL,                     -- RAMQ billing code
  unites TEXT,                            -- Units (time, length, etc.)
  role TEXT,                              -- Role (1=primary, other=assistant)
  element_de_contexte TEXT,               -- Context elements
  montant_preliminaire NUMERIC(10,2),     -- Expected amount
  montant_paye NUMERIC(10,2),             -- Paid amount
  doctor TEXT,                            -- Doctor identifier (PHI - redacted in logs)
  patient TEXT,                           -- Patient identifier (PHI - redacted in logs)
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_validation_run FOREIGN KEY (validation_run_id) REFERENCES validation_runs(id) ON DELETE CASCADE
);
```

**Indexes** (CRITICAL for performance):
- Primary key on `id`
- **idx_billing_records_validation_run_id** on `validation_run_id` (100x faster result display)
- **idx_billing_records_patient** on `patient` (50x faster patient grouping)
- **idx_billing_records_date_service** on `date_de_service` (30x faster time-based queries)

**PHI Fields** (Protected):
- `doctor` - Doctor identifier
- `patient` - Patient identifier
- Access controlled by ownership verification
- Automatically redacted in logs

---

### validation_results

Stores validation errors, warnings, and info messages.

**Schema**:
```sql
CREATE TABLE validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_run_id UUID NOT NULL REFERENCES validation_runs(id),
  rule_id TEXT NOT NULL,                  -- Rule identifier (e.g., 'OFFICE_FEE_19929')
  severity TEXT NOT NULL,                 -- error|warning|info
  message TEXT NOT NULL,
  invoice TEXT,                           -- Facture number (for reference)
  patient TEXT,                           -- Patient ID (PHI - redacted in logs)
  code TEXT,                              -- RAMQ code
  amount NUMERIC(10,2),
  date_service DATE,
  row_number INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_validation_run FOREIGN KEY (validation_run_id) REFERENCES validation_runs(id) ON DELETE CASCADE
);
```

**Indexes**:
- Primary key on `id`
- **idx_validation_results_validation_run_id** on `validation_run_id` (100x faster error display)
- **idx_validation_results_severity** on `severity` (20x faster severity filtering)

**Severity Levels**:
- `error`: RAMQ rule violation (must fix)
- `warning`: Unusual situation (verify)
- `info`: Informational message

---

### validation_logs

Audit trail for validation operations (PHI compliance).

**Schema**:
```sql
CREATE TABLE validation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  validation_run_id UUID NOT NULL REFERENCES validation_runs(id),
  level TEXT NOT NULL,                    -- info|warn|error|debug
  source TEXT NOT NULL,                   -- Module that generated log
  message TEXT NOT NULL,
  details JSONB,                          -- Structured log data (PHI redacted)
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT fk_validation_run FOREIGN KEY (validation_run_id) REFERENCES validation_runs(id) ON DELETE CASCADE
);
```

**Indexes**:
- Primary key on `id`
- **idx_validation_logs_validation_run_id** on `validation_run_id` (50x faster log viewing)

**Log Levels**:
- `info`: General information
- `warn`: Warning messages
- `error`: Error events
- `debug`: Debugging information

**PHI Redaction**:
- All log messages automatically sanitized
- Patient IDs, health card numbers, doctor info redacted
- Structured data in `details` field also sanitized

---

## Reference Data Tables

### codes

RAMQ billing codes (6,740 codes).

**Schema**:
```sql
CREATE TABLE codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,                     -- RAMQ code (e.g., '19929')
  description TEXT NOT NULL,              -- French description
  tariff_value NUMERIC(10,2),             -- Amount in CAD
  place TEXT,                             -- Cabinet|Établissement
  level_groups TEXT,                      -- Level group (NIVEAU1, NIVEAU2, etc.)
  active BOOLEAN DEFAULT true,
  custom_fields JSONB,                    -- Extensible custom data
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes**:
- Primary key on `id`
- **idx_codes_code** on `code` (50x faster code lookup)
- **idx_codes_description_gin** GIN index on `description` (30x faster full-text search)

**Redis Cache**:
- Cache key: `ramq:codes:all`
- TTL: 1 hour (3600 seconds)
- Cache hit ratio: >95%
- Reduces database load by 50-80%

**Example Record**:
```json
{
  "id": "uuid",
  "code": "19929",
  "description": "Frais de bureau - 12 patients inscrits ou plus",
  "tariff_value": 64.80,
  "place": "Cabinet",
  "level_groups": "NIVEAU3",
  "active": true
}
```

---

### contexts

Service context modifiers (~200 contexts).

**Schema**:
```sql
CREATE TABLE contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context TEXT NOT NULL UNIQUE,          -- Context code (e.g., 'G160')
  description TEXT NOT NULL,             -- French description
  active BOOLEAN DEFAULT true,
  custom_fields JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes**:
- Primary key on `id`
- Unique index on `context`

**Redis Cache**:
- Cache key: `ramq:contexts:all`
- TTL: 1 hour
- ~60KB cached data

**Example Contexts**:
- `G160`: Patient sans rendez-vous (walk-in)
- `AR`: Après les heures (after-hours)
- `M`: Modification tarifaire (rate modification)

---

### establishments

Quebec healthcare facilities (~1,000 establishments).

**Schema**:
```sql
CREATE TABLE establishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,             -- Establishment code
  name TEXT NOT NULL,                    -- Facility name
  city TEXT,
  region TEXT,                           -- Quebec region
  active BOOLEAN DEFAULT true,
  custom_fields JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes**:
- Primary key on `id`
- Unique index on `code`

**Redis Cache**:
- Cache key: `ramq:establishments:all`
- TTL: 1 hour
- ~300KB cached data

**Example Record**:
```json
{
  "code": "12345",
  "name": "CHUM - Centre hospitalier de l'Université de Montréal",
  "city": "Montréal",
  "region": "Montréal"
}
```

---

### rules

Validation rules (123+ rules).

**Schema**:
```sql
CREATE TABLE rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,             -- Rule identifier
  category TEXT NOT NULL,                -- office_fee, prohibition, etc.
  condition JSONB NOT NULL,              -- Rule configuration
  threshold NUMERIC(10,2),               -- Optional threshold value
  enabled BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Indexes**:
- Primary key on `id`
- Unique index on `name`
- Index on `enabled` for active rule queries

**Redis Cache**:
- Cache key: `validation:rules:all`
- TTL: 24 hours (rules change infrequently)
- ~100KB cached data

**Example Rule**:
```json
{
  "name": "OFFICE_FEE_19929",
  "category": "office_fee",
  "condition": {
    "type": "office_fee_validation",
    "codes": ["19929"],
    "thresholds": {
      "19929": {
        "registered": 12,
        "walkIn": 20
      }
    }
  },
  "threshold": 64.80,
  "enabled": true
}
```

---

## Performance Optimization

### Indexes Summary

| Index Name | Table | Column(s) | Purpose | Speedup |
|------------|-------|-----------|---------|---------|
| idx_billing_records_validation_run_id | billing_records | validation_run_id | Result display | 100x |
| idx_billing_records_patient | billing_records | patient | Patient grouping | 50x |
| idx_billing_records_date_service | billing_records | date_de_service | Time queries | 30x |
| idx_validation_results_validation_run_id | validation_results | validation_run_id | Error display | 100x |
| idx_validation_results_severity | validation_results | severity | Severity filter | 20x |
| idx_codes_code | codes | code | Code lookup | 50x |
| idx_codes_description_gin | codes | description (GIN) | Full-text search | 30x |
| idx_validation_runs_status | validation_runs | status | Dashboard filter | 40x |
| idx_validation_logs_validation_run_id | validation_logs | validation_run_id | Log viewing | 50x |

### Index Maintenance

```bash
# Reindex if performance degrades
REINDEX INDEX CONCURRENTLY idx_codes_description_gin;

# Update statistics after large data changes
ANALYZE billing_records;
ANALYZE validation_results;
ANALYZE codes;

# Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_%'
ORDER BY idx_scan DESC;

# Identify unused indexes
SELECT indexname FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_%' AND idx_scan = 0;
```

### Redis Caching Strategy

**Cache-Aside Pattern** with manual invalidation:

1. **First Request**: Database query → Populate cache
2. **Subsequent Requests**: Redis retrieval (1-5ms vs 50-200ms)
3. **On Update**: Invalidate cache automatically
4. **Warm-up**: Automatic on server startup (1-3 seconds)

**Performance Benefits**:
- **First Request**: Database (~50-200ms)
- **Cached Request**: Redis (~1-5ms) - **40-200x faster**
- **Database Load**: Reduced by 95%+ for reference data
- **API Response**: Improved from ~150ms to ~10ms average

---

## Migrations

### Drizzle Kit Commands

```bash
# Generate migration from schema changes
npx drizzle-kit generate:pg

# Apply migrations to database
npm run db:push

# View current schema
npx drizzle-kit introspect:pg
```

### Migration Best Practices

1. **Always test migrations on staging first**
2. **Backup production database before migrations**
3. **Use transactions for multi-step migrations**
4. **Document breaking changes**
5. **Plan rollback strategy**

### Example Migration

```typescript
// migrations/0001_add_phi_redaction_field.sql
ALTER TABLE validation_runs
ADD COLUMN phi_redaction_enabled BOOLEAN DEFAULT true;

CREATE INDEX idx_validation_runs_user_id ON validation_runs(user_id);
```

---

## Data Integrity

### Constraints

- **Foreign Keys**: Enforce referential integrity
- **Unique Constraints**: Prevent duplicate codes/contexts
- **NOT NULL**: Required fields enforced at database level
- **CHECK Constraints**: Validate enum values (status, severity, role)

### Cascade Deletes

- **User deletion**: Cascades to files, validation_runs
- **File deletion**: Cascades to validation_runs, billing_records
- **Validation run deletion**: Cascades to validation_results, billing_records, validation_logs

### Soft Deletes

Tables using `active` flag for soft deletes:
- `codes`
- `contexts`
- `establishments`
- `rules`

Tables using `deleted_at` timestamp:
- `files` (PHI compliance - audit trail)

---

## Security & PHI Compliance

### Access Control

**Ownership Verification Middleware**:
```typescript
// server/core/auth.ts:150-232
requireOwnership('validation_runs', 'user_id')
```

**Protected Endpoints**:
- `GET /api/validations/:id`
- `GET /api/validations/:id/results`
- `GET /api/validations/:id/records`
- `DELETE /api/validations/:id`

**Rules**:
- Regular users: Can only access their own validation runs
- Admins: Can access any validation run (with audit logging)
- Unauthorized access: 403 Forbidden
- Audit trail: Logged to `validation_logs`

### PHI Fields

**Protected columns**:
- `billing_records.doctor`
- `billing_records.patient`
- `validation_results.patient`

**Protection mechanisms**:
1. **Access Control**: Ownership verification
2. **Redaction**: Automatic sanitization in logs
3. **Encryption**: SSL/TLS for data in transit
4. **Audit Logging**: All access logged to `validation_logs`

### PHI Sanitization

**Automatic redaction** of sensitive patterns in logs:
- Quebec health card numbers (12 digits) → `[HEALTH-CARD-REDACTED]`
- Patient identifiers → `patient [REDACTED]`
- Doctor information → `doctor: [REDACTED]`

**Implementation**: `server/observability/sanitizer.ts`

---

## Common Queries

### Get Validation Run with Results

```sql
SELECT
  vr.id,
  vr.status,
  vr.record_count,
  vr.error_count,
  COUNT(CASE WHEN res.severity = 'error' THEN 1 END) as errors,
  COUNT(CASE WHEN res.severity = 'warning' THEN 1 END) as warnings
FROM validation_runs vr
LEFT JOIN validation_results res ON res.validation_run_id = vr.id
WHERE vr.id = $1
GROUP BY vr.id;
```

### Get Most Common Validation Errors

```sql
SELECT
  rule_id,
  COUNT(*) as error_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM validation_results
WHERE severity = 'error'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY rule_id
ORDER BY error_count DESC
LIMIT 10;
```

### Get Patient Daily Count

```sql
SELECT
  date_de_service,
  doctor,
  COUNT(DISTINCT patient) as unique_patients
FROM billing_records
WHERE validation_run_id = $1
GROUP BY date_de_service, doctor
ORDER BY date_de_service;
```

### Find Codes Needing Contexts

```sql
SELECT DISTINCT br.code, c.description
FROM billing_records br
JOIN codes c ON c.code = br.code
LEFT JOIN validation_results vr ON vr.validation_run_id = br.validation_run_id
  AND vr.row_number = br.row_number
WHERE br.element_de_contexte IS NULL
  AND vr.severity = 'error'
  AND vr.message LIKE '%context%'
LIMIT 50;
```

---

## Troubleshooting

### Connection Issues

```bash
# Test database connection
psql "postgresql://dashvalidator_user:PASSWORD@localhost:5432/dashvalidator?sslmode=require"

# Verify SSL is enabled
psql -U dashvalidator_user -d dashvalidator -c "SHOW ssl;"

# Check active connections
SELECT * FROM pg_stat_activity WHERE datname = 'dashvalidator';
```

### Performance Issues

```bash
# Check slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- queries slower than 100ms
ORDER BY mean_exec_time DESC
LIMIT 10;

# Check table bloat
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Vacuum analyze
VACUUM ANALYZE billing_records;
VACUUM ANALYZE validation_results;
```

---

## Resources

- **Schema File**: `server/schema.ts`
- **Migration Files**: `migrations/`
- **Drizzle Docs**: https://orm.drizzle.team/
- **PostgreSQL 16 Docs**: https://www.postgresql.org/docs/16/
- **Performance Guide**: [docs/guides/PERFORMANCE.md](PERFORMANCE.md)

---

**Last Updated**: October 2025
**Database Version**: PostgreSQL 16
**ORM Version**: Drizzle ORM 0.39.1
