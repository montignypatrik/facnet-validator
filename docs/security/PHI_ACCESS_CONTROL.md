# PHI Access Control System

**Status**: ✅ Implemented (2025-10-06)
**Priority**: P0 - Critical Security Fix
**Branch**: `feature/user-isolation`
**Commit**: `032c2ba`

## Overview

The PHI Access Control System prevents unauthorized access to Protected Health Information (PHI) in the Quebec healthcare billing validator. Before this implementation, any authenticated user could access other users' validation runs containing sensitive patient data.

## Security Vulnerability (Fixed)

### Problem
```typescript
// ❌ BEFORE: No ownership verification
router.get("/api/validations/:id", authenticateToken, async (req, res) => {
  const run = await storage.getValidationRun(req.params.id);
  // User A could access User B's patient billing data!
  res.json(run);
});
```

### Solution
```typescript
// ✅ AFTER: Ownership verification required
router.get("/api/validations/:id",
  authenticateToken,
  requireOwnership(getValidationRunOwner),
  async (req, res) => {
    const run = await storage.getValidationRun(req.params.id);
    res.json(run);
  }
);
```

## Architecture

### requireOwnership Middleware

**Location**: [`server/core/auth.ts:150-232`](../server/core/auth.ts#L150-L232)

**Function Signature**:
```typescript
export function requireOwnership(
  getResourceOwner: (resourceId: string) => Promise<string | null>
): RequestHandler
```

**How It Works**:
1. Extracts resource ID from `req.params.id`
2. Calls `getResourceOwner(resourceId)` to fetch owner's user ID
3. Checks if user owns resource (`ownerId === req.user.uid`)
4. Allows admin access to any resource (with audit logging)
5. Returns 403 Forbidden if unauthorized
6. Returns 404 Not Found if resource doesn't exist

**Example Usage**:
```typescript
async function getValidationRunOwner(validationRunId: string): Promise<string | null> {
  const run = await storage.getValidationRun(validationRunId);
  return run?.createdBy || null;
}

router.get("/api/validations/:id",
  authenticateToken,
  requireOwnership(getValidationRunOwner),
  handler
);
```

## Protected Endpoints

All 5 validation endpoints now require ownership verification:

| Endpoint | Data Type | Risk Level |
|----------|-----------|------------|
| `GET /api/validations/:id` | Validation run details | Medium |
| `GET /api/validations/:id/results` | Validation results (PHI) | **High** |
| `GET /api/validations/:id/records` | Billing records (PHI) | **Critical** |
| `GET /api/validations/:id/logs` | Validation execution logs | Low |
| `POST /api/validations/:id/cleanup` | Delete validation data | High |

## Access Control Rules

### Regular Users (viewer, editor, pending)
- ✅ Can access their own validation runs
- ❌ Cannot access other users' validation runs
- ❌ Receive 403 Forbidden if attempting unauthorized access

### Admin Users
- ✅ Can access any validation run
- ✅ Access is automatically logged for compliance
- ✅ Audit trail includes: user ID, resource ID, IP address, user agent

## Audit Logging

### Security Events Logged

**1. Admin Cross-User Access** (INFO level):
```typescript
logger.info(
  resourceId,
  "SECURITY",
  `Admin admin@facturation.net (admin-999) accessed resource owned by user-123`,
  {
    userId: "admin-999",
    resourceId: "validation-run-id",
    resourceOwnerId: "user-123",
    endpoint: "/api/validations/:id/results",
    method: "GET",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0..."
  }
);
```

**2. Unauthorized Access Attempts** (WARN level):
```typescript
logger.warn(
  resourceId,
  "SECURITY",
  `Unauthorized access attempt: User hacker@facturation.net (user-123) tried to access resource owned by user-456`,
  {
    userId: "user-123",
    resourceId: "validation-run-id",
    resourceOwnerId: "user-456",
    endpoint: "/api/validations/:id/records",
    method: "GET",
    ipAddress: "203.0.113.42",
    userAgent: "curl/7.68.0"
  }
);
```

### Audit Log Location
- **Table**: `validation_logs`
- **Source**: `SECURITY`
- **Retention**: 30 days (configurable)
- **Query Example**:
```sql
SELECT * FROM validation_logs
WHERE source = 'SECURITY'
ORDER BY timestamp DESC
LIMIT 100;
```

## HTTP Response Codes

| Code | Scenario | Example |
|------|----------|---------|
| **200 OK** | User accesses their own resource | Viewer reads their validation |
| **200 OK** | Admin accesses any resource | Admin reviews user's billing data |
| **401 Unauthorized** | User not authenticated | Missing or invalid JWT token |
| **403 Forbidden** | User tries to access another user's resource | Editor tries to view different user's data |
| **404 Not Found** | Resource doesn't exist | Invalid validation run ID |
| **500 Internal Server Error** | Database query fails | PostgreSQL connection error |

## Testing

### Test Suite

**Location**: [`tests/unit/auth/ownership.test.ts`](../tests/unit/auth/ownership.test.ts)

**Coverage**: 24 comprehensive test cases

#### Test Categories

1. **User Owns Resource** (3 tests)
   - Editor can access own validation run
   - Viewer can access own validation run
   - User ownership verified correctly

2. **User Does Not Own Resource** (4 tests)
   - Editor denied access to other user's data
   - Viewer denied access to other user's data
   - Unauthorized access logged for security monitoring
   - 403 Forbidden returned correctly

3. **Admin Access** (3 tests)
   - Admin can access any validation run
   - Admin cross-user access creates audit log
   - Admin accessing own data does NOT create audit log

4. **Resource Not Found** (2 tests)
   - Returns 404 for non-existent validation runs
   - Admin also receives 404 for non-existent resources

5. **Edge Cases** (6 tests)
   - Missing user (401)
   - Missing resource ID (400)
   - Database query failure (500)
   - Legacy data with null owner (404)
   - Empty string as owner ID (403)

6. **Audit Log Metadata** (3 tests)
   - IP address captured correctly
   - User agent captured correctly
   - HTTP method captured correctly

7. **Multiple Role Scenarios** (3 tests)
   - Viewer, editor, pending roles tested
   - All non-admin roles denied cross-user access
   - All roles can access their own data

### Running Tests

```bash
# Run ownership tests only
npm run test -- ownership.test.ts

# Run with coverage
npm run test -- ownership.test.ts --coverage

# Run all tests
npm run test
```

**Expected Result**: ✅ All 24 tests passing

## Database Schema

### validation_runs Table

```sql
CREATE TABLE validation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  created_by TEXT, -- User ID from Auth0 (sub claim)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Field**: `created_by` stores the owner's Auth0 user ID (sub claim)

**Ownership Query**:
```typescript
async function getValidationRunOwner(validationRunId: string): Promise<string | null> {
  const run = await storage.getValidationRun(validationRunId);
  return run?.createdBy || null;
}
```

## Implementation Details

### File Changes

| File | Change | Lines |
|------|--------|-------|
| `server/core/auth.ts` | Added `requireOwnership` middleware | 150-232 |
| `server/modules/validateur/routes.ts` | Applied middleware to 5 endpoints | 7, 40-43, 152, 167, 200, 240, 258 |
| `tests/unit/auth/ownership.test.ts` | Created comprehensive test suite | 1-644 (NEW) |

### Commit Message

```
feat: implement user isolation and PHI access control

SECURITY FIX: Critical vulnerability allowing unauthorized PHI access

Problem:
- Any authenticated user could access other users' validation runs
- PHI (Protected Health Information) from Quebec healthcare billing exposed
- No ownership verification on validation endpoints
- Compliance risk for RAMQ billing system

Solution:
- Added requireOwnership middleware to server/core/auth.ts
- Applied middleware to 5 validation endpoints
- Implemented audit logging for security monitoring
- Admin users can access any resource (with audit trail)
- Regular users restricted to own validation runs only

Testing:
- Added comprehensive Vitest test suite (24 test cases)
- All tests passing ✓
```

## Compliance

### Quebec Healthcare Regulations

This implementation aligns with:
- **RAMQ Billing Requirements**: User data isolation
- **Quebec Privacy Laws**: PHI protection (Loi 25)
- **Healthcare Data Security**: Audit trail for admin access
- **Access Control Standards**: Role-based permissions

### Audit Requirements

For compliance audits, administrators can query:

```sql
-- All admin cross-user access in the last 30 days
SELECT
  timestamp,
  validation_run_id,
  metadata->>'userId' as admin_user,
  metadata->>'resourceOwnerId' as data_owner,
  metadata->>'endpoint' as accessed_endpoint,
  metadata->>'ipAddress' as admin_ip
FROM validation_logs
WHERE source = 'SECURITY'
  AND level = 'INFO'
  AND message LIKE 'Admin%accessed resource%'
  AND timestamp > NOW() - INTERVAL '30 days'
ORDER BY timestamp DESC;
```

```sql
-- All unauthorized access attempts
SELECT
  timestamp,
  validation_run_id,
  metadata->>'userId' as attacker_user,
  metadata->>'resourceOwnerId' as target_owner,
  metadata->>'endpoint' as attempted_endpoint,
  metadata->>'ipAddress' as attacker_ip
FROM validation_logs
WHERE source = 'SECURITY'
  AND level = 'WARN'
  AND message LIKE 'Unauthorized access attempt%'
ORDER BY timestamp DESC;
```

## Known Limitations

1. **Legacy Data**: Validation runs with `createdBy = null` return 404 (treated as non-existent)
2. **Single Resource Type**: Currently only protects validation runs (extensible to other resources)
3. **No Granular Permissions**: Binary access (own data vs. all data for admins)

## Future Enhancements

- [ ] Implement resource sharing (allow users to share validation runs)
- [ ] Add organization-level access (users in same org can view each other's data)
- [ ] Extend to protect other resources (files, billing records)
- [ ] Add rate limiting for failed access attempts
- [ ] Email alerts for suspicious access patterns
- [ ] Export audit logs for compliance reporting

## Troubleshooting

### Issue: 403 Forbidden for own data

**Symptom**: User receives 403 when accessing their own validation run

**Diagnosis**:
```sql
-- Check validation run ownership
SELECT id, created_by FROM validation_runs WHERE id = 'validation-run-id';

-- Check user's Auth0 ID
SELECT id, email FROM users WHERE email = 'user@facturation.net';
```

**Solution**: Ensure `validation_runs.created_by` matches `req.user.uid` (Auth0 sub claim)

### Issue: Admin access not logged

**Symptom**: Admin accesses other user's data but no audit log created

**Diagnosis**:
```sql
-- Check for audit logs
SELECT * FROM validation_logs
WHERE source = 'SECURITY'
  AND validation_run_id = 'validation-run-id';
```

**Solution**: Verify admin is accessing *different* user's data (admin accessing own data doesn't log)

### Issue: Circular dependency error

**Symptom**: `Cannot import logger before initialization`

**Solution**: Already handled via dynamic import in middleware:
```typescript
const { logger } = await import("../modules/validateur/logger.js");
```

## Contact

For security concerns or questions about this implementation:
- **Team**: Patrick Montigny
- **Priority**: P0 - Critical Security
- **Documentation**: This file
- **Tests**: `tests/unit/auth/ownership.test.ts`
- **Implementation**: `server/core/auth.ts`
