# Security Overview - DASH Healthcare Validation Platform

**Last Updated**: October 2025
**Compliance**: PHI (Protected Health Information), HIPAA-ready

---

## Quick Links

- **[PHI Access Control](PHI_ACCESS_CONTROL.md)** - User isolation and ownership verification
- **[PHI Redaction](PHI_REDACTION.md)** - Automatic sanitization in logs and observability

---

## Security Architecture

### 1. Authentication & Authorization

**Auth0 Integration** (OAuth 2.0 + JWT):
- **Domain**: `dev-x63i3b6hf5kch7ab.ca.auth0.com`
- **Algorithm**: RS256 (asymmetric cryptography)
- **Token Expiration**: Configurable via Auth0 dashboard
- **MFA Support**: Available in Auth0

**Role-Based Access Control (RBAC)**:

| Role | Access Level | Permissions |
|------|--------------|-------------|
| **pending** | None | Awaiting admin approval |
| **viewer** | Read-only | View codes, contexts, validation results |
| **editor** | Read + Write | Upload files, run validations, manage data |
| **admin** | Full access | User management, deletions, system configuration |

**Implementation**: `server/core/auth.ts`

---

### 2. PHI (Protected Health Information) Protection

**PHI Fields in Database**:
- `billing_records.patient` - Patient identifiers
- `billing_records.doctor` - Doctor identifiers
- `validation_results.patient` - Patient references

**Protection Mechanisms**:

#### A. Access Control (Ownership Verification)
Users can only access their own validation runs containing PHI.

```typescript
// Middleware: requireOwnership
app.get('/api/validations/:id',
  authenticateToken,
  requireOwnership('validation_runs', 'user_id'),
  getValidationDetails
);
```

- **Regular users**: 403 Forbidden if accessing others' data
- **Admins**: Can access any data (with audit logging)
- **Audit trail**: All access logged to `validation_logs`

**Documentation**: [PHI_ACCESS_CONTROL.md](PHI_ACCESS_CONTROL.md)

#### B. Automatic PHI Redaction
All logs and observability data automatically sanitized.

**Sanitization Rules**:
- Quebec health card numbers (12 digits) → `[HEALTH-CARD-REDACTED]`
- Patient identifiers → `patient [REDACTED]`
- Doctor information → `doctor: [REDACTED]`

**Implementation**: `server/observability/sanitizer.ts` (whitelist approach)

**Documentation**: [PHI_REDACTION.md](PHI_REDACTION.md)

#### C. Encryption

**Data in Transit**:
- HTTPS/TLS 1.2+ for all API requests
- PostgreSQL SSL/TLS connections (`sslmode=require`)
- Redis TLS support (optional)

**Data at Rest**:
- PostgreSQL: File system encryption (Linux LUKS or similar)
- Redis: File system encryption
- Uploaded files: Automatically deleted after validation

---

### 3. Network Security

**Production Firewall (UFW)**:
```bash
# Only these ports open:
22  (SSH - key authentication only)
80  (HTTP - redirects to 443)
443 (HTTPS)
```

**Internal Services** (localhost only):
- PostgreSQL: 5432 (not exposed externally)
- Redis: 6379 (not exposed externally)
- Application: 5000 (proxied via Nginx)

**Nginx Configuration**:
- Reverse proxy for Node.js application
- SSL termination
- Rate limiting
- Security headers (Helmet.js)

---

### 4. File Upload Security

**Restrictions**:
- **File Type**: CSV only (validated by MIME type and extension)
- **Size Limit**: 10 MB maximum
- **Encoding**: UTF-8 with BOM or ISO-8859-1 (auto-detected)
- **Malware Scanning**: Currently not implemented (recommended for production)

**Lifecycle**:
1. Upload to `uploads/` directory (temporary)
2. Virus scan (recommended but not implemented)
3. Validation processing
4. **Automatic deletion** after processing (PHI security)
5. Soft delete record in database with `deleted_at` timestamp

**Storage**:
- Local filesystem: `uploads/` directory (development)
- AWS S3: Recommended for production (encrypted buckets)

---

### 5. Database Security

**Connection Security**:
- SSL/TLS required (`sslmode=require`)
- Strong passwords (20+ characters)
- Dedicated database user (`dashvalidator_user`)
- Limited permissions (no superuser)

**Access Control**:
```sql
-- Database user permissions
GRANT CONNECT ON DATABASE dashvalidator TO dashvalidator_user;
GRANT USAGE ON SCHEMA public TO dashvalidator_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dashvalidator_user;
-- NO DROP, CREATE, or superuser privileges
```

**Audit Logging**:
- All validation operations logged to `validation_logs`
- Security events logged with source "SECURITY"
- Automatic PHI redaction in all logs

**Backup & Recovery**:
- Daily automated backups (7-day retention)
- Point-in-time recovery capability
- Backup encryption recommended

---

### 6. Security Headers (Helmet.js)

**Content Security Policy (CSP)**:
```javascript
{
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "blob:", "https:"],
  connectSrc: ["'self'", "https://dev-x63i3b6hf5kch7ab.ca.auth0.com"],
  frameSrc: ["'self'", "https://dev-x63i3b6hf5kch7ab.ca.auth0.com"],
}
```

**Other Headers**:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

**Implementation**: `server/index.ts` (lines 28-50)

---

### 7. Rate Limiting

**Current Limits** (recommended, not yet implemented):
- General API: 100 requests/minute per user
- File uploads: 10 uploads/hour per user
- Validation runs: 20 validations/hour per user

**Implementation** (recommended):
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,             // 100 requests per minute
  message: 'Too many requests, please try again later.'
});

app.use('/api/', limiter);
```

---

### 8. Session Management

**Auth0 Session**:
- JWT tokens stored in browser localStorage
- Token expiration managed by Auth0
- No server-side session storage (stateless)

**Redis Session** (optional, for future use):
- `connect-redis` for multi-instance deployments
- Session encryption recommended
- TTL matching JWT expiration

---

### 9. Secrets Management

**Current Approach**:
- `.env` file for local development
- Environment variables on production server
- **Never commit** `.env` to version control

**Production Secrets**:
```bash
DATABASE_URL=postgresql://...
AUTH0_CLIENT_SECRET=...
PHI_REDACTION_SALT=...
REDIS_URL=redis://...
```

**AWS Migration** (recommended):
- AWS Secrets Manager for credential storage
- Automatic rotation for database passwords
- IAM roles for EC2 instances (no hardcoded keys)

---

### 10. Monitoring & Alerting

**Error Tracking** (optional):
- Sentry for real-time error monitoring
- Automatic PHI sanitization before sending to Sentry
- Alert on authentication failures, validation errors

**Audit Logging**:
- All security events logged to `validation_logs`
- Failed authentication attempts
- Unauthorized access attempts (403 errors)
- Admin actions (user role changes, deletions)

**CloudWatch** (AWS migration):
- Failed authentication rate
- 403/401 error rate
- API response times
- Database connection failures

---

## Security Checklist

### Development

- [ ] Environment variables in `.env` (never commit)
- [ ] Auth0 configured with localhost callback URLs
- [ ] PostgreSQL SSL preferred (not required)
- [ ] Test data contains **no real PHI**

### Staging

- [ ] Separate database (`dashvalidator_staging`)
- [ ] Auth0 configured with staging callback URLs
- [ ] SSL/TLS enforced (`sslmode=require`)
- [ ] Firewall rules tested
- [ ] PHI redaction verified

### Production

- [ ] **SSL/TLS enforced** (`sslmode=require`)
- [ ] Firewall configured (UFW with SSH, HTTP, HTTPS only)
- [ ] Fail2ban active (brute-force protection)
- [ ] Auth0 production tenant configured
- [ ] Strong database passwords (20+ characters)
- [ ] Automated backups configured (7-day retention)
- [ ] PHI redaction active and tested
- [ ] Ownership verification middleware enabled
- [ ] Security headers (Helmet.js) configured
- [ ] Rate limiting implemented (recommended)
- [ ] Audit logging enabled
- [ ] File upload limits enforced (10 MB)
- [ ] Automatic file deletion after validation
- [ ] MFA enabled for admin accounts (Auth0)
- [ ] AWS Business Associate Agreement signed (for HIPAA)

---

## Compliance

### HIPAA Readiness

DASH is designed to be **HIPAA-ready** but not yet formally certified:

**✅ Implemented**:
- Encryption in transit (SSL/TLS)
- Access controls (RBAC)
- Audit logging
- PHI redaction in logs
- User isolation (ownership verification)
- Automatic file deletion
- Secure authentication (Auth0)

**⚠️ Recommended for Full HIPAA Compliance**:
- Encryption at rest (file system encryption)
- Business Associate Agreement (BAA) with Auth0
- Formal security audit
- Incident response plan
- Regular penetration testing
- Staff security training
- Physical security controls

### Quebec Healthcare Regulations

**Language Requirements**: ✅ French interface and documentation

**Data Residency**: ⚠️ Current setup uses OVH VPS in Canada. For strict compliance, ensure data remains in Quebec/Canada.

**RAMQ Compliance**: ✅ Validation rules based on official RAMQ regulations.

---

## Incident Response

### Security Incident Types

1. **Data Breach** (PHI exposure)
2. **Unauthorized Access** (403 errors spike)
3. **Authentication Failure** (Auth0 issues)
4. **DDoS Attack** (excessive requests)
5. **Malware Upload** (malicious CSV files)

### Response Procedure

1. **Detect**: Monitor logs, alerts, user reports
2. **Contain**: Isolate affected systems, revoke tokens
3. **Investigate**: Review audit logs, identify root cause
4. **Remediate**: Patch vulnerabilities, restore from backup
5. **Notify**: Inform affected users, regulatory bodies (if required)
6. **Document**: Create incident report, update procedures

### Contact Information

- **Security Issues**: [GitHub Security Advisories](https://github.com/montignypatrik/facnet-validator/security)
- **System Administrator**: (configure contact)
- **Auth0 Support**: support@auth0.com

---

## Security Best Practices for Developers

### 1. Never Commit Secrets

```bash
# Add to .gitignore
.env
.env.local
.env.production
*.pem
*.key
```

### 2. Validate All Input

```typescript
// Use Zod schemas for validation
import { z } from 'zod';

const uploadSchema = z.object({
  file: z.instanceof(File),
  fileName: z.string().max(255)
});
```

### 3. Sanitize Output

```typescript
// Never include PHI in logs
console.log('Validating records for patient: [REDACTED]');

// Use PHI sanitizer
import { sanitizer } from './observability/sanitizer';
const sanitized = sanitizer.sanitize(data);
```

### 4. Use Parameterized Queries

```typescript
// ✅ Good - Drizzle ORM automatically parameterizes
const results = await db.select().from(codes).where(eq(codes.code, userInput));

// ❌ Bad - SQL injection vulnerability
const results = await db.execute(`SELECT * FROM codes WHERE code = '${userInput}'`);
```

### 5. Implement Least Privilege

```typescript
// Check permissions before sensitive operations
if (user.role !== 'admin') {
  return res.status(403).json({ error: 'Admin access required' });
}
```

---

## Security Audit Log

| Date | Event | Action Taken |
|------|-------|--------------|
| 2025-10-06 | PHI access control implemented | Ownership verification middleware added |
| 2025-10-06 | PHI redaction system deployed | Whitelist-based sanitizer with 100% test coverage |
| 2025-09-29 | SSL/TLS enforced in production | `sslmode=require` configured |
| 2025-09-01 | Auth0 integration completed | JWT authentication with RBAC |

---

## Resources

- **PHI Access Control Details**: [PHI_ACCESS_CONTROL.md](PHI_ACCESS_CONTROL.md)
- **PHI Redaction Implementation**: [PHI_REDACTION.md](PHI_REDACTION.md)
- **Auth0 Documentation**: https://auth0.com/docs
- **HIPAA Guidelines**: https://www.hhs.gov/hipaa
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/

---

**Last Updated**: October 2025
**Security Point of Contact**: (configure)
**Next Security Audit**: (schedule)
