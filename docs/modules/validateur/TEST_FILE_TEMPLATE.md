# Test File Template for Validation Rules

This template shows how to structure test files that map directly to scenarios
defined in your rule MD files.

---

## File Naming Convention

```
tests/validation-rules/[ruleId].test.ts

Example:
tests/validation-rules/officeFeeRule.test.ts
tests/validation-rules/annualBillingCode.test.ts
```

---

## Test Structure Template

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { YourValidationRule } from "@/server/modules/validateur/validation/rules/yourRule";
import { BillingRecord } from "@/shared/schema";

describe("[RULE_NAME] - [RULE_ID]", () => {
  let validationRunId: string;

  beforeAll(() => {
    validationRunId = "test-run-id";
  });

  // ========================================
  // ✅ PASS SCENARIOS (Severity: info)
  // ========================================

  describe("✅ PASS Scenarios", () => {

    it("P1: [Scenario name from MD file]", async () => {
      // Arrange - Create test data matching scenario condition
      const records: BillingRecord[] = [
        {
          id: "rec-1",
          validationRunId,
          code: "19928",
          dateService: "2025-01-06",
          montantPaye: 6.48,
          // ... other required fields
        },
        // Add more records as needed for scenario
      ];

      // Act - Run validation
      const results = await YourValidationRule.validate(records, validationRunId);

      // Assert - Verify PASS result
      const passResults = results.filter(r => r.severity === "info");

      expect(passResults).toHaveLength(1);
      expect(passResults[0]).toMatchObject({
        severity: "info",
        category: "your-category",
        message: expect.stringContaining("Validation réussie"),
        solution: null,
      });

      // Verify ruleData structure
      expect(passResults[0].ruleData).toMatchObject({
        monetaryImpact: 0,
        code: "19928",
        patientCount: 8,
        required: 6,
        totalAmount: 51.84,
      });
    });

    it("P2: [Next pass scenario...]", async () => {
      // Same structure as P1
    });

  });

  // ========================================
  // ❌ ERROR SCENARIOS (Severity: error)
  // ========================================

  describe("❌ ERROR Scenarios", () => {

    it("E1: [Scenario name from MD file]", async () => {
      // Arrange
      const records: BillingRecord[] = [
        {
          id: "rec-1",
          validationRunId,
          code: "19928",
          dateService: "2025-01-06",
          montantPaye: 6.48,
          // ... fields that trigger error condition
        },
      ];

      // Act
      const results = await YourValidationRule.validate(records, validationRunId);

      // Assert - Verify ERROR result
      const errorResults = results.filter(r => r.severity === "error");

      expect(errorResults).toHaveLength(1);
      expect(errorResults[0]).toMatchObject({
        severity: "error",
        category: "your-category",
        // Match exact message from MD file scenario E1
        message: expect.stringContaining("exige minimum 6 patients"),
        // Match exact solution from MD file scenario E1
        solution: expect.stringContaining("Changez pour code 19929"),
      });

      // Verify monetary impact
      expect(errorResults[0].ruleData.monetaryImpact).toBe(0); // or -amount

      // Verify ruleData matches MD file example
      expect(errorResults[0].ruleData).toMatchObject({
        code: "19928",
        required: 6,
        actual: 3,
        registeredPaid: 3,
        registeredUnpaid: 2,
      });
    });

    it("E2: [Next error scenario...]", async () => {
      // Same structure as E1
    });

  });

  // ========================================
  // 💡 OPTIMIZATION SCENARIOS (Severity: optimization)
  // ========================================

  describe("💡 OPTIMIZATION Scenarios", () => {

    it("O1: [Scenario name from MD file]", async () => {
      // Arrange
      const records: BillingRecord[] = [
        {
          id: "rec-1",
          validationRunId,
          code: "19928",
          dateService: "2025-01-06",
          montantPaye: 32.10,
          // ... fields that trigger optimization condition
        },
      ];

      // Act
      const results = await YourValidationRule.validate(records, validationRunId);

      // Assert - Verify OPTIMIZATION result
      const optimizationResults = results.filter(r => r.severity === "optimization");

      expect(optimizationResults).toHaveLength(1);
      expect(optimizationResults[0]).toMatchObject({
        severity: "optimization",
        category: "your-category",
        // Match exact message from MD file scenario O1
        message: expect.stringContaining("Optimisation de revenus"),
        // Match exact solution from MD file scenario O1
        solution: expect.stringContaining("Facturer 19929 au lieu de 19928"),
      });

      // CRITICAL: Verify monetary impact is positive
      expect(optimizationResults[0].ruleData.monetaryImpact).toBeGreaterThan(0);
      expect(optimizationResults[0].ruleData.monetaryImpact).toBe(32.10);

      // Verify ruleData matches MD file example
      expect(optimizationResults[0].ruleData).toMatchObject({
        monetaryImpact: 32.10,
        currentCode: "19928",
        suggestedCode: "19929",
        currentAmount: 32.10,
        expectedAmount: 64.20,
      });
    });

    it("O2: [Next optimization scenario...]", async () => {
      // Same structure as O1
    });

  });

  // ========================================
  // 📊 SUMMARY SCENARIO
  // ========================================

  describe("📊 SUMMARY Scenario", () => {

    it("P-SUMMARY: Validation Complete", async () => {
      // Arrange - Mix of scenarios
      const records: BillingRecord[] = [
        // ... records that trigger various scenarios
      ];

      // Act
      const results = await YourValidationRule.validate(records, validationRunId);

      // Assert - Verify summary exists
      const summaryResult = results.find(
        r => r.severity === "info" && r.message.includes("complétée")
      );

      expect(summaryResult).toBeDefined();
      expect(summaryResult?.ruleData).toMatchObject({
        monetaryImpact: 0,
        totalRecords: expect.any(Number),
        errorCount: expect.any(Number),
        optimizationCount: expect.any(Number),
        infoCount: expect.any(Number),
      });
    });

  });

  // ========================================
  // 🧪 EDGE CASES
  // ========================================

  describe("🧪 Edge Cases", () => {

    it("Edge Case 1: Null montantPaye treated as unpaid", async () => {
      // Test edge cases mentioned in MD file
    });

    it("Edge Case 2: Mixed paid/unpaid patients", async () => {
      // Test edge cases mentioned in MD file
    });

  });

});
```

---

## Key Testing Principles

### 1. **Direct Scenario Mapping**
Each test case name should reference the scenario ID from the MD file:
```typescript
it("E1: Insufficient Registered Patients (19928)", async () => {
  // Maps to "Scenario E1" in MD file
});
```

### 2. **Message Verification**
Verify messages match the MD file exactly:
```typescript
expect(result.message).toBe(
  "Code 19928 exige minimum 6 patients inscrits mais seulement 3 trouvé(s)"
);
```

### 3. **RuleData Structure Validation**
Verify all fields specified in MD file scenario are present:
```typescript
expect(result.ruleData).toMatchObject({
  monetaryImpact: 0,
  code: "19928",
  required: 6,
  actual: 3,
  // All fields from MD file example ruleData
});
```

### 4. **Monetary Impact Rules**
- **PASS (info)**: `monetaryImpact: 0` or total processed
- **ERROR**: `monetaryImpact: 0` (unpaid) or `-amount` (at risk)
- **OPTIMIZATION**: `monetaryImpact > 0` (REQUIRED)

### 5. **Display Configuration Testing**
Test that ruleData includes all fields needed for display:
```typescript
// If scenario says "Show billing details box"
expect(result.ruleData).toHaveProperty("code");
expect(result.ruleData).toHaveProperty("currentAmount");

// If scenario says "Show comparison box"
expect(result.ruleData).toHaveProperty("currentCode");
expect(result.ruleData).toHaveProperty("suggestedCode");
```

---

## Test Data Helpers

Create reusable test data builders:

```typescript
// tests/helpers/billingRecordBuilder.ts

export class BillingRecordBuilder {
  private record: Partial<BillingRecord> = {
    id: "test-record-1",
    validationRunId: "test-run-id",
    facture: "F-001",
    idRamq: "RAMQ-001",
    dateService: "2025-01-06",
    code: "19928",
    unites: 1,
    montantPaye: 6.48,
    doctorInfo: "Dr. Test",
    patient: "PATIENT-001",
  };

  withCode(code: string) {
    this.record.code = code;
    return this;
  }

  withAmount(amount: number) {
    this.record.montantPaye = amount;
    return this;
  }

  paid() {
    this.record.montantPaye = 6.48;
    return this;
  }

  unpaid() {
    this.record.montantPaye = 0;
    return this;
  }

  withContext(context: string) {
    this.record.elementContexte = context;
    return this;
  }

  build(): BillingRecord {
    return this.record as BillingRecord;
  }
}

// Usage in tests:
const record = new BillingRecordBuilder()
  .withCode("19928")
  .paid()
  .withContext("G160")
  .build();
```

---

## Coverage Requirements

Every MD file scenario MUST have a corresponding test:

| MD File Scenario | Test File | Status |
|------------------|-----------|--------|
| P1 | ✅ test-P1 | Required |
| P2 | ✅ test-P2 | Required |
| E1 | ✅ test-E1 | Required |
| E2 | ✅ test-E2 | Required |
| O1 | ✅ test-O1 | Required |
| O2 | ✅ test-O2 | Required |
| P-SUMMARY | ✅ test-summary | Required |

**Goal**: 100% scenario coverage

---

## Running Tests

```bash
# Run all validation tests
npm test tests/validation-rules

# Run specific rule tests
npm test officeFeeRule.test.ts

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

---

## Test Output Format

Tests should output clear scenario identification:

```
✅ PASS Scenarios
  ✓ P1: Valid Code 19928 with Sufficient Patients (15ms)
  ✓ P2: Valid Code 19929 with Mixed Patients (12ms)

❌ ERROR Scenarios
  ✓ E1: Insufficient Registered Patients (19928) (8ms)
  ✓ E2: Too Many Walk-In Patients (10ms)

💡 OPTIMIZATION Scenarios
  ✓ O1: Could Use Higher Code (19928→19929) (11ms)
  ✓ O2: Daily Maximum Not Reached (9ms)

📊 SUMMARY Scenario
  ✓ P-SUMMARY: Validation Complete (5ms)

🧪 Edge Cases
  ✓ Edge Case 1: Null montantPaye treated as unpaid (6ms)
  ✓ Edge Case 2: Mixed paid/unpaid patients (7ms)

Test Results: 10 passed, 10 total
```

---

## Best Practices

1. **One test per scenario** - Keep tests focused and mapped to MD scenarios
2. **Descriptive test names** - Include scenario ID (P1, E1, O1)
3. **Exact message matching** - Verify French messages match MD file
4. **Complete ruleData validation** - Check all fields from MD example
5. **Edge case coverage** - Test all edge cases mentioned in MD file
6. **Builder pattern** - Use helpers for cleaner test data creation
7. **Arrange-Act-Assert** - Follow AAA pattern consistently

---

## Validation Checklist

Before merging a new rule:

- [ ] All scenarios from MD file have corresponding tests
- [ ] All tests pass
- [ ] Messages match MD file exactly (French)
- [ ] RuleData structures match MD file examples
- [ ] Monetary impact rules enforced (optimization > 0)
- [ ] Edge cases tested
- [ ] Coverage ≥ 90%
- [ ] Test names include scenario IDs (P1, E1, O1)
