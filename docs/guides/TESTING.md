# Testing Guide - DASH Healthcare Validation Platform

**Last Updated**: October 2025
**Test Framework**: Vitest
**Coverage Tool**: Vitest Coverage (v8)

---

## Table of Contents

1. [Overview](#overview)
2. [Running Tests](#running-tests)
3. [Test Structure](#test-structure)
4. [Writing Unit Tests](#writing-unit-tests)
5. [Integration Tests](#integration-tests)
6. [Test Coverage](#test-coverage)
7. [Testing Validation Rules](#testing-validation-rules)
8. [Mocking Strategies](#mocking-strategies)
9. [CI/CD Integration](#cicd-integration)
10. [Best Practices](#best-practices)

---

## Overview

DASH uses **Vitest** as its testing framework for both unit and integration tests. Tests are located in the `tests/` directory and mirror the application structure.

### Test Categories

| Category | Location | Purpose |
|----------|----------|---------|
| **Unit Tests** | `tests/unit/` | Test individual functions and modules |
| **Integration Tests** | `tests/integration/` | Test API endpoints and database operations |
| **Validation Tests** | `tests/unit/validation/` | Test RAMQ validation rules |
| **Cache Tests** | `tests/unit/cache/` | Test Redis caching layer |
| **Auth Tests** | `tests/unit/auth/` | Test authentication and authorization |

---

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI interface
npm run test:ui
```

### Run Specific Tests

```bash
# Run tests in a specific file
npm test -- auth.test.ts

# Run tests matching a pattern
npm test -- validation

# Run a specific test suite
npm test -- --grep "Office Fee Validation"
```

### Coverage Thresholds

Current coverage requirements:
- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

---

## Test Structure

### Directory Organization

```
tests/
├── unit/
│   ├── auth/
│   │   ├── auth.test.ts               # Authentication tests
│   │   └── ownership.test.ts          # PHI access control tests (24 tests)
│   ├── cache/
│   │   └── cacheService.test.ts       # Redis caching tests (20 tests)
│   ├── validation/
│   │   ├── officeFee.test.ts          # Office fee rule tests (14 tests)
│   │   └── annualBilling.test.ts      # Annual billing rule tests (13 tests)
│   └── observability/
│       └── sanitizer.test.ts          # PHI sanitization tests (31 tests)
├── integration/
│   ├── api/
│   │   ├── validations.test.ts        # Validation API tests
│   │   └── codes.test.ts              # Codes API tests
│   └── database/
│       └── schema.test.ts             # Database schema tests
└── fixtures/
    ├── sample-billing.csv             # Test CSV files
    └── mock-data.ts                   # Mock data generators
```

### Test File Naming

- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.test.ts` (future)

---

## Writing Unit Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { functionToTest } from '../path/to/module';

describe('Module Name', () => {
  describe('functionToTest', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test input';
      const expected = 'expected output';

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe(expected);
    });

    it('should handle edge cases', () => {
      expect(functionToTest(null)).toBeNull();
      expect(functionToTest('')).toBe('');
    });
  });
});
```

### Example: Testing a Validation Rule

```typescript
import { describe, it, expect } from 'vitest';
import { validateOfficeFee } from '../../server/validation/ruleTypeHandlers';

describe('Office Fee Validation', () => {
  const rule = {
    name: 'OFFICE_FEE_19929',
    condition: {
      type: 'office_fee_validation',
      codes: ['19929'],
      walkInContexts: ['G160', 'AR'],
      thresholds: {
        '19929': { registered: 12, walkIn: 20 }
      }
    },
    threshold: 64.80
  };

  it('should pass when registered patient count meets threshold', async () => {
    const records = createMockRecords({
      code: '19929',
      patientCount: 12,
      doctorId: 'DOC001',
      date: '2025-02-05'
    });

    const errors = await validateOfficeFee(rule, records, 'run-123');

    expect(errors).toHaveLength(0);
  });

  it('should fail when registered patient count is below threshold', async () => {
    const records = createMockRecords({
      code: '19929',
      patientCount: 8,  // Below threshold of 12
      doctorId: 'DOC001',
      date: '2025-02-05'
    });

    const errors = await validateOfficeFee(rule, records, 'run-123');

    expect(errors).toHaveLength(1);
    expect(errors[0].severity).toBe('error');
    expect(errors[0].message).toContain('12 patients');
  });

  it('should handle walk-in patients separately', async () => {
    const records = [
      ...createMockRecords({ patientCount: 10, context: '' }),      // Registered
      ...createMockRecords({ patientCount: 5, context: 'G160' })    // Walk-in
    ];

    const errors = await validateOfficeFee(rule, records, 'run-123');

    // 10 registered < 12 (threshold) → Should fail
    expect(errors).toHaveLength(1);
  });
});

// Helper function to create mock billing records
function createMockRecords(params: MockRecordParams): BillingRecord[] {
  return Array.from({ length: params.patientCount }, (_, i) => ({
    facture: `INV${i}`,
    patient: `PAT${i}`,
    code: params.code,
    dateDeService: params.date,
    doctor: params.doctorId,
    elementDeContexte: params.context || '',
    montantPreliminaire: 64.80
  }));
}
```

---

## Integration Tests

### Database Testing

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../server/storage';
import { codes } from '../server/schema';

describe('Codes API', () => {
  beforeAll(async () => {
    // Setup test database
    await db.insert(codes).values({
      code: '19929',
      description: 'Test code',
      tariffValue: 64.80,
      place: 'Cabinet'
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await db.delete(codes).where(eq(codes.code, '19929'));
  });

  it('should fetch code by ID', async () => {
    const result = await db.select().from(codes).where(eq(codes.code, '19929'));

    expect(result).toHaveLength(1);
    expect(result[0].tariffValue).toBe(64.80);
  });
});
```

### API Endpoint Testing

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../server/index';

describe('GET /api/codes', () => {
  it('should return paginated codes', async () => {
    const response = await request(app)
      .get('/api/codes')
      .query({ page: 1, limit: 50 })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('total');
    expect(response.body.data).toBeInstanceOf(Array);
  });

  it('should require authentication', async () => {
    await request(app)
      .get('/api/codes')
      .expect(401);
  });

  it('should support search filtering', async () => {
    const response = await request(app)
      .get('/api/codes')
      .query({ search: '19929' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);

    expect(response.body.data.every(c => c.code.includes('19929'))).toBe(true);
  });
});
```

---

## Test Coverage

### Generate Coverage Report

```bash
npm run test:coverage
```

### Coverage Report Formats

- **Terminal**: Summary displayed in console
- **HTML**: `coverage/index.html` (detailed interactive report)
- **JSON**: `coverage/coverage-final.json` (machine-readable)
- **LCOV**: `coverage/lcov.info` (for CI/CD tools)

### View HTML Coverage Report

```bash
# Generate and open coverage report
npm run test:coverage
# Open coverage/index.html in browser
```

### Coverage by Module (Current)

| Module | Statements | Branches | Functions | Lines |
|--------|-----------|----------|-----------|-------|
| **validation/** | 95% | 92% | 94% | 95% |
| **cache/** | 100% | 100% | 100% | 100% |
| **auth/** | 98% | 95% | 97% | 98% |
| **observability/** | 100% | 100% | 100% | 100% |
| **storage.ts** | 75% | 68% | 72% | 76% |
| **routes.ts** | 70% | 65% | 68% | 71% |

---

## Testing Validation Rules

### Rule Test Template

Use this template for testing new validation rules:

```typescript
import { describe, it, expect } from 'vitest';
import { yourRuleHandler } from '../../server/validation/ruleTypeHandlers';

describe('Your Rule Name', () => {
  const rule = {
    name: 'YOUR_RULE_ID',
    condition: {
      type: 'your_rule_type',
      // Rule-specific configuration
    }
  };

  describe('Valid scenarios', () => {
    it('should pass when conditions are met', async () => {
      const records = createValidRecords();
      const errors = await yourRuleHandler(rule, records, 'run-123');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Invalid scenarios', () => {
    it('should fail when condition X is violated', async () => {
      const records = createInvalidRecords();
      const errors = await yourRuleHandler(rule, records, 'run-123');

      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('error');
      expect(errors[0].message).toContain('expected message');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty records', async () => {
      const errors = await yourRuleHandler(rule, [], 'run-123');
      expect(errors).toHaveLength(0);
    });

    it('should handle null values', async () => {
      const records = createRecordsWithNulls();
      const errors = await yourRuleHandler(rule, records, 'run-123');
      // Assert expected behavior
    });
  });
});
```

### Example: Complete Validation Rule Test

See existing tests for real-world examples:
- **Office Fee**: `tests/unit/validation/officeFee.test.ts` (14 tests, 100% coverage)
- **Annual Billing**: `tests/unit/validation/annualBilling.test.ts` (13 tests, 93% coverage)

---

## Mocking Strategies

### Mock Database Queries

```typescript
import { vi } from 'vitest';
import { db } from '../server/storage';

vi.mock('../server/storage', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([mockData]))
      }))
    }))
  }
}));
```

### Mock Redis Cache

```typescript
import { vi } from 'vitest';

vi.mock('../server/cache/cacheService', () => ({
  cacheService: {
    get: vi.fn(() => Promise.resolve(null)),
    set: vi.fn(() => Promise.resolve(true)),
    invalidate: vi.fn(() => Promise.resolve(true))
  }
}));
```

### Mock Auth0 JWT

```typescript
import { vi } from 'vitest';

vi.mock('../server/auth', () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = {
      sub: 'auth0|123456',
      email: 'test@example.com',
      role: 'editor'
    };
    next();
  })
}));
```

### Mock File System

```typescript
import { vi } from 'vitest';
import fs from 'fs';

vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(() => Promise.resolve('mock CSV content')),
    unlink: vi.fn(() => Promise.resolve())
  }
}));
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Run Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: dashvalidator_test
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:latest
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests with coverage
        run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://test_user:test_password@localhost:5432/dashvalidator_test
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true
```

---

## Best Practices

### 1. Test Organization

✅ **DO**:
- Group related tests with `describe` blocks
- Use descriptive test names (`it('should...')`)
- Follow Arrange-Act-Assert pattern
- Test one behavior per test case

❌ **DON'T**:
- Write tests that depend on execution order
- Test implementation details instead of behavior
- Create overly complex test setups

### 2. Test Isolation

✅ **DO**:
- Clean up test data after each test
- Use `beforeEach`/`afterEach` for setup/teardown
- Mock external dependencies
- Use separate test database

❌ **DON'T**:
- Share state between tests
- Rely on production data
- Leave test data in database

### 3. Assertion Quality

✅ **DO**:
```typescript
// Specific assertions
expect(result.errorCount).toBe(3);
expect(result.errors[0].message).toContain('12 patients');

// Test for specific error types
expect(() => validateCode()).toThrow(ValidationError);
```

❌ **DON'T**:
```typescript
// Vague assertions
expect(result).toBeTruthy();
expect(result.errors.length > 0).toBe(true);
```

### 4. Mocking Best Practices

✅ **DO**:
- Mock external services (Auth0, file system, network)
- Use factory functions for test data
- Reset mocks between tests

❌ **DON'T**:
- Mock internal modules unnecessarily
- Create brittle mocks tied to implementation
- Mock the entire application

### 5. Test Data Management

✅ **DO**:
```typescript
// Use factory functions
function createMockBillingRecord(overrides = {}) {
  return {
    facture: 'INV001',
    code: '19929',
    patient: 'PAT001',
    dateDeService: '2025-02-05',
    ...overrides
  };
}

// Create test fixtures
const fixtures = {
  validOfficeFeeBilling: createMockBillingRecord({ code: '19929' }),
  invalidOfficeFeeBilling: createMockBillingRecord({ code: '19929', patient: 'PAT999' })
};
```

### 6. Performance

- Keep unit tests fast (< 50ms each)
- Use `it.concurrent` for independent tests
- Mock slow operations (database, file I/O)
- Profile slow tests with `--reporter=verbose`

---

## Common Pitfalls

### 1. Async/Await Issues

❌ **Wrong**:
```typescript
it('should validate code', () => {
  validateCode('19929').then(result => {
    expect(result).toBe(true);  // Might not run!
  });
});
```

✅ **Correct**:
```typescript
it('should validate code', async () => {
  const result = await validateCode('19929');
  expect(result).toBe(true);
});
```

### 2. Database Connection Leaks

❌ **Wrong**:
```typescript
describe('Database tests', () => {
  it('test 1', async () => {
    const db = createConnection();
    // No cleanup!
  });
});
```

✅ **Correct**:
```typescript
describe('Database tests', () => {
  let db;

  beforeAll(async () => {
    db = await createConnection();
  });

  afterAll(async () => {
    await db.close();
  });
});
```

### 3. Mock Pollution

❌ **Wrong**:
```typescript
vi.mock('../module', () => ({ fn: vi.fn() }));

it('test 1', () => {
  fn.mockReturnValue('value1');
  // Mock persists to next test!
});

it('test 2', () => {
  // Still has 'value1' from test 1!
});
```

✅ **Correct**:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

---

## Resources

- **Vitest Documentation**: https://vitest.dev/
- **Test Coverage Best Practices**: https://vitest.dev/guide/coverage.html
- **Example Tests**: `tests/unit/` and `tests/integration/`
- **Rule Testing Guide**: [docs/modules/validateur/RULE_CREATION_GUIDE.md](../modules/validateur/RULE_CREATION_GUIDE.md)

---

**Last Updated**: October 2025
**Test Framework Version**: Vitest 3.2.4
