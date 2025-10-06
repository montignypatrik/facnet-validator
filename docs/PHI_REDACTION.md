# PHI Redaction System

## Overview
The validator implements server-side Protected Health Information (PHI) redaction to comply with Quebec healthcare privacy regulations. Redaction is applied **only at the API response layer** - validation logic continues to use full unredacted data for accuracy.

## Critical Design Principle
**Validation ≠ Redaction**:
- ✅ Validation engine sees FULL unredacted data (maintains 100% accuracy)
- ✅ Database stores FULL unredacted data (for audit and reprocessing)
- ✅ Redaction applied ONLY when sending data to frontend
- ✅ This ensures validation accuracy while protecting patient privacy

## PHI Fields Classification

### Redacted Fields (Contains Personal Information):
- **Patient ID**: Deterministic hashing using SHA-256 with salt
  - Format: `[PATIENT-A1B2C3D4]` (first 8 chars of hash)
  - Same patient always produces same hash (enables grouping/analytics)
  - Configurable via `PHI_REDACTION_SALT` environment variable

- **Doctor Info**: Full redaction
  - Format: `[REDACTED]`
  - No tracking needed for individual physicians

### Never Redacted (Business Data):
- **RAMQ ID**: Invoice/billing number - needed for corrections and tracking
  - Users must see RAMQ IDs to cross-reference with RAMQ submissions
  - Required for making corrections to specific invoices

## User Preferences

### Database Schema:
```typescript
users table:
  phiRedactionEnabled: boolean (default: true)
  redactionLevel: 'full' | 'none' (default: 'full')
```

### Default Behavior:
- **All users**: PHI redaction enabled by default (privacy-first)
- **Admins**: Can disable redaction in Settings for debugging/support
- **Viewers/Editors**: Always have redaction enabled (cannot be disabled)

## Redaction Functions

### Core Utilities (`server/modules/validateur/validation/phiRedaction.ts`):
- `redactPatientId(patientId: string): string` - Deterministic hashing
- `redactDoctorInfo(doctorInfo: string): string` - Full redaction
- `redactBillingRecord(record: BillingRecord, enabled: boolean): BillingRecord`
- `redactValidationResult(result: ValidationResult, enabled: boolean): ValidationResult`
- `shouldRedactPhi(phiRedactionEnabled: boolean): boolean` - Helper

## API Integration

### Endpoints with Redaction:
- `GET /api/validations/:id/results` - Validation results with redacted PHI
- `GET /api/validations/:id/records` - Billing records with redacted PHI

### Audit Logging:
When admins access PHI without redaction, the system logs:
- User ID and email
- Validation run ID
- Endpoint accessed
- Timestamp
- Record count (for billing records)

Log level: INFO
Log source: `PHI_ACCESS`

## Security & Compliance

### Privacy-First Design:
1. ✅ **Default Redacted**: All users have redaction enabled by default
2. ✅ **Server-Side Only**: Redaction happens on server, never trust client
3. ✅ **Audit Trail**: All unredacted PHI access is logged
4. ✅ **Role-Based**: Only admins can disable redaction
5. ✅ **Deterministic Hashing**: Maintains analytics while protecting identity

### Quebec Privacy Law Compliance:
- Meets healthcare data protection requirements
- Patient identifiers never sent to client (unless admin override)
- Complete audit trail for PHI access
- Minimal data exposure principle

## Data Flow with Redaction

```
CSV Upload → Database (FULL DATA) → Validation Engine (FULL DATA)
                                            ↓
                                    Validation Results
                                            ↓
                                    API Endpoint Layer
                                            ↓
                                  [REDACTION APPLIED HERE]
                                            ↓
                                    Frontend (REDACTED DATA)
```

## Configuration

### Environment Variables:
```env
PHI_REDACTION_SALT=your-secure-random-salt-here
```

**Production**: Set a strong random salt (min 32 characters)
**Development**: Uses default salt (not secure for production)

## Frontend Indicators

Users will see:
- 🔒 Icon next to redacted patient IDs
- Tooltip explaining redaction
- Banner when viewing unredacted PHI (admin only)
- PHI visibility toggle in Settings (admin only)

## Example Output

### With Redaction (Default):
```
Patient: [PATIENT-A1B2C3D4]
Doctor: [REDACTED]
RAMQ ID: 2024-INV-001234 (visible - needed for corrections)
```

### Without Redaction (Admin Override):
```
Patient: 12345
Doctor: Dr. Jean Tremblay
RAMQ ID: 2024-INV-001234
```

## Implementation Files

### Backend Files:
- `server/modules/validateur/validation/phiRedaction.ts` - Core redaction utilities
- `server/modules/validateur/routes.ts` - API endpoints with redaction
- `server/schema.ts` - User preferences schema (phiRedactionEnabled, redactionLevel)

### Database Schema:
```sql
ALTER TABLE users ADD COLUMN phi_redaction_enabled BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN redaction_level TEXT DEFAULT 'full';
```

### Testing:
- Unit tests for redaction functions
- Integration tests for API endpoints
- Audit log verification tests

## Security Considerations

1. **Salt Management**: Store `PHI_REDACTION_SALT` securely in environment variables
2. **Audit Logging**: All PHI access logged with timestamps and user IDs
3. **Role-Based Access**: Only admins can disable redaction
4. **Default Secure**: Privacy-first approach with redaction enabled by default
5. **No Client-Side Trust**: All redaction happens on server, never rely on client
