# DASH Testing Documentation

## Overview

This directory contains the test suite for the DASH Quebec healthcare billing validation platform.

## Test Infrastructure

- **Framework**: Vitest 3.2.4
- **Coverage Tool**: @vitest/coverage-v8
- **UI**: @vitest/ui (interactive test viewer)
- **Target Coverage**: 70%+ for critical validation logic

## Directory Structure

```
tests/
├── setup.ts                    # Global test setup and configuration
├── fixtures/                   # Test data and sample records
│   ├── ramq-codes.ts          # Sample RAMQ billing codes
│   ├── billing-records.ts     # Sample Quebec billing records
│   └── validation-rules.ts    # Sample validation rules
├── unit/                      # Unit tests for individual functions
│   └── validation/            # Validation rule handler tests
│       └── validateProhibition.test.ts
└── integration/               # Integration tests (coming soon)
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Test Coverage Status

| Module | Coverage | Tests | Status |
|--------|----------|-------|--------|
| **validateProhibition** | ✅ Complete | 24 tests | All passing |
| validateTimeRestriction | ❌ Not started | 0 tests | Pending |
| validateRequirement | ❌ Not started | 0 tests | Pending |
| validateLocationRestriction | ❌ Not started | 0 tests | Pending |
| validateAgeRestriction | ❌ Not started | 0 tests | Pending |
| validateAmountLimit | ❌ Not started | 0 tests | Pending |
| validateMutualExclusion | ❌ Not started | 0 tests | Pending |
| validateMissingAnnualOpportunity | ❌ Not started | 0 tests | Pending |
| validateAnnualLimit | ❌ Not started | 0 tests | Pending |

**Overall Progress**: 11.4% statement coverage on ruleTypeHandlers.ts (1 of 9 functions tested)

## Test Fixtures

### RAMQ Codes (`tests/fixtures/ramq-codes.ts`)

Sample Quebec healthcare billing codes including:
- **19928**: Office fee - 6 registered patients ($32.40)
- **19929**: Office fee - 12 registered patients ($64.80)
- **08129**: Consultation code (prohibited with 08135)
- **08135**: Extended consultation (prohibited with 08129)

### Billing Records (`tests/fixtures/billing-records.ts`)

Realistic Quebec billing data with helper functions:
- `sampleBillingRecords`: Array of test billing records
- `generateRegisteredPatients(count, code, date)`: Generate registered patient records
- `generateWalkInPatients(count, date)`: Generate walk-in patient records with G160 context

### Validation Rules (`tests/fixtures/validation-rules.ts`)

Sample validation rules matching database structure:
- Prohibition rules (codes that cannot be billed together)
- Office fee validation rules (patient count thresholds)
- Time restriction rules (minimum intervals)
- Requirement rules (context requirements)

## Writing New Tests

### Using the Test-Writer Agent

The fastest way to write comprehensive tests is using the `test-writer` agent:

```
@test-writer Please write tests for validateTimeRestriction function with Quebec-specific time-based scenarios
```

### Manual Test Creation

1. Create test file in appropriate directory:
   - `tests/unit/` for unit tests
   - `tests/integration/` for integration tests

2. Import test framework and fixtures:
```typescript
import { describe, it, expect } from 'vitest';
import { sampleValidationRules } from '@/tests/fixtures/validation-rules';
import { sampleBillingRecords } from '@/tests/fixtures/billing-records';
```

3. Write tests following the pattern:
```typescript
describe('functionName', () => {
  it('should do something specific', async () => {
    // Arrange
    const rule = sampleValidationRules[0];
    const records = sampleBillingRecords;

    // Act
    const results = await functionUnderTest(rule, records, 'test-run-id');

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('error');
  });
});
```

## Quebec-Specific Test Scenarios

When writing tests for Quebec healthcare billing, include:

1. **Walk-in Contexts**: Test with `#G160` and `#AR` context elements
2. **French Error Messages**: Verify error messages contain French text
3. **RAMQ Code Formats**: Use realistic 5-digit RAMQ codes
4. **Establishment Types**: Test "Cabinet" vs "Établissement"
5. **Patient Classification**: Test registered vs walk-in patient thresholds
6. **Date Formats**: Use ISO 8601 dates (YYYY-MM-DD)
7. **Doctor Identification**: Use realistic format (7 digits + hyphen + 5 digits)

## Coverage Goals

### Phase 1 (Current)
- ✅ Set up Vitest infrastructure
- ✅ Create test fixtures
- ✅ Write first validation test (prohibition)
- Target: 11.4% coverage achieved

### Phase 2 (Next Week)
- Write tests for all 9 validation rule handlers
- Target: 70%+ coverage on ruleTypeHandlers.ts

### Phase 3 (Week After)
- Add integration tests for CSV processing
- Test database rule loader
- Test validation engine orchestration
- Target: 80%+ overall coverage

## Continuous Integration

Tests run automatically on:
- Every git commit (via pre-commit hook - coming soon)
- Every pull request (GitHub Actions - coming soon)
- Production deployments (verification step)

## Troubleshooting

### Tests Fail with Database Connection Error

The test suite uses a separate test database. Set the connection string:

```bash
export TEST_DATABASE_URL="postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator_test"
```

### Coverage Report Not Generating

Install coverage dependencies:

```bash
npm install -D @vitest/coverage-v8
```

### Slow Test Execution

Run tests in parallel (Vitest default):

```bash
npm test -- --reporter=verbose
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [CLAUDE_CODE_SETUP.md](../CLAUDE_CODE_SETUP.md) - Agent usage guide
- [PROJECT_ANALYSIS.md](../PROJECT_ANALYSIS.md) - Testing priorities
- RAMQ Billing Documentation (internal)

## Next Steps

1. **Immediate**: Write tests for remaining 8 validation handlers
2. **This Week**: Achieve 70%+ coverage on critical validation logic
3. **This Month**: Add integration tests for full validation pipeline
4. **Long Term**: Maintain 70%+ coverage as new features are added

---

**Last Updated**: October 5, 2025
**Maintained By**: Development Team
**Test Coverage**: 11.4% (Target: 70%+)
