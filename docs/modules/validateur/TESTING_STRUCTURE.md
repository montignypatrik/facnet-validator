# Validation Rules Testing Structure

**Complete guide to the testing system for Quebec RAMQ validation rules.**

---

## Overview

This testing system uses **realistic CSV files** as input and **JSON files** as expected output specifications. Each test scenario maps 1:1 with scenarios defined in rule documentation MD files.

### The Three-File System

For each test scenario, you create **3 files**:

1. **CSV file** - Realistic billing data (input)
2. **JSON file** - Expected validation results (expected output)
3. **Test code** - TypeScript test that compares actual vs expected

---

## Complete Directory Structure

```
facnet-validator/
│
├── docs/modules/validateur/
│   ├── TESTING_STRUCTURE.md                    # ⭐ THIS FILE - Master testing guide
│   ├── EXPECTED_RESULTS_TEMPLATE.md            # ⭐ Complete JSON guide with examples
│   ├── EXPECTED_RESULTS_QUICK_TEMPLATE.json    # ⭐ Copy-paste JSON template
│   ├── SCENARIO_BASED_DEVELOPMENT_GUIDE.md     # Overall development workflow
│   ├── RULE_TEMPLATE.md                        # Template for new rules
│   ├── TEST_FILE_TEMPLATE.md                   # Template for test files
│   │
│   └── rules-implemented/
│       ├── ANNUAL_BILLING_CODE.md              # Rule spec with scenarios
│       ├── gmf_8875_validation.md              # Rule spec with scenarios
│       ├── intervention_clinique_rule.md       # Rule spec with scenarios
│       └── VISIT_DURATION_OPTIMIZATION.md      # Rule spec with scenarios
│
├── tests/validation-rules/
│   ├── test-data/                              # ⭐ All test CSV + JSON files
│   │   │
│   │   ├── annual-billing-code/                # One folder per rule
│   │   │   ├── README.md                       # Test scenarios index
│   │   │   ├── P1-single-billing.csv           # Input CSV
│   │   │   ├── P1-single-billing.expected.json # Expected output JSON
│   │   │   ├── E1-multiple-paid.csv            # Input CSV
│   │   │   ├── E1-multiple-paid.expected.json  # Expected output JSON
│   │   │   └── ...
│   │   │
│   │   ├── gmf-8875/
│   │   │   ├── README.md
│   │   │   ├── P1-single-8875.csv
│   │   │   ├── P1-single-8875.expected.json
│   │   │   └── ...
│   │   │
│   │   ├── intervention-clinique/
│   │   │   └── ...
│   │   │
│   │   └── visit-duration-optimization/
│   │       └── ...
│   │
│   ├── annualBillingCodeRule.test.ts           # ⭐ Test file for annual billing
│   ├── gmfForfait8875Rule.test.ts              # Test file for GMF
│   ├── interventionCliniqueRule.test.ts        # Test file for intervention clinique
│   └── visitDurationOptimizationRule.test.ts   # Test file for visit duration
│
└── server/modules/validateur/validation/
    └── rules/
        ├── annualBillingCodeRule.ts            # Rule implementation
        ├── gmfForfait8875Rule.ts               # Rule implementation
        ├── interventionCliniqueRule.ts         # Rule implementation
        └── visitDurationOptimizationRule.ts    # Rule implementation
```

---

## File Types & Purposes

### 1. Rule Documentation (MD files)

**Location**: `docs/modules/validateur/rules-implemented/[RULE_NAME].md`

**Purpose**: Single source of truth for rule logic and scenarios

**Contains**:
- Rule information (ID, name, category)
- Business logic description
- Target codes and contexts
- **Validation Scenarios** section with:
  - P1, P2... (PASS scenarios)
  - E1, E2... (ERROR scenarios)
  - O1, O2... (OPTIMIZATION scenarios)
  - P-SUMMARY (summary scenario)

**Example**: `ANNUAL_BILLING_CODE.md`

---

### 2. Test Data Folder

**Location**: `tests/validation-rules/test-data/[rule-name]/`

**Purpose**: Contains all CSV inputs and JSON expected outputs for one rule

**Structure**:
```
annual-billing-code/
├── README.md                           # Scenarios index
├── P1-single-billing.csv               # PASS scenario 1
├── P1-single-billing.expected.json     # Expected for P1
├── P2-different-years.csv              # PASS scenario 2
├── P2-different-years.expected.json    # Expected for P2
├── E1-multiple-paid.csv                # ERROR scenario 1
├── E1-multiple-paid.expected.json      # Expected for E1
└── ...
```

---

### 3. Input CSV Files

**Location**: `tests/validation-rules/test-data/[rule-name]/[SCENARIO_ID]-[name].csv`

**Naming Convention**: `[SCENARIO_ID]-[descriptive-name].csv`

**Examples**:
- `P1-single-billing.csv`
- `E1-multiple-paid.csv`
- `O1-patient-without-8875.csv`

**Format**: Real Quebec healthcare billing CSV
```csv
Facture,ID RAMQ,Date de Service,Code,Patient,Montant payé,Medecin
INV-001,RAMQ-001,2025-01-10,15815,PATIENT-001,49.15,Dr. Smith
INV-002,RAMQ-002,2025-06-15,15815,PATIENT-001,49.15,Dr. Smith
```

**Purpose**: Realistic test data that triggers specific scenario conditions

**How to Create**:
1. Read scenario "Condition" from MD file
2. Create CSV rows that match that condition
3. Use anonymized patient IDs (PATIENT-001, PATIENT-002)
4. Use realistic codes from RAMQ database

---

### 4. Expected JSON Files

**Location**: `tests/validation-rules/test-data/[rule-name]/[SCENARIO_ID]-[name].expected.json`

**Naming Convention**: `[SCENARIO_ID]-[descriptive-name].expected.json`

**Examples**:
- `P1-single-billing.expected.json`
- `E1-multiple-paid.expected.json`
- `O1-patient-without-8875.expected.json`

**Format**: JSON structure defining expected validation results

```json
{
  "scenarioId": "E1",
  "scenarioName": "Multiple Paid Billings (CRITICAL)",
  "description": "Code annuel facturé et payé plusieurs fois...",
  "expectedResults": [
    {
      "severity": "error",
      "category": "annual_limit",
      "message": "Code annuel 15815 facturé 2 fois...",
      "solution": "Contactez la RAMQ...",
      "ruleData": {
        "monetaryImpact": -98.30,
        "code": "15815",
        "patient": "PATIENT-001",
        "year": 2025,
        "totalCount": 2,
        "paidCount": 2,
        "unpaidCount": 0,
        "dates": ["2025-01-10", "2025-06-15"],
        "amounts": [49.15, 49.15],
        "totalPaidAmount": 98.30
      },
      "affectedRecordCount": 2
    },
    {
      "severity": "info",
      "category": "annual_limit",
      "message": "Validation complétée pour 2 enregistrement(s)...",
      "solution": null,
      "ruleData": {
        "monetaryImpact": -98.30,
        "totalRecords": 2,
        "errorCount": 1,
        "totalAtRisk": 98.30,
        "codesChecked": ["15815"]
      }
    }
  ]
}
```

**Purpose**: Machine-readable expected output for automated testing

**How to Create**: See [EXPECTED_RESULTS_TEMPLATE.md](EXPECTED_RESULTS_TEMPLATE.md)

---

### 5. Test README Files

**Location**: `tests/validation-rules/test-data/[rule-name]/README.md`

**Purpose**: Index of all test scenarios for this rule

**Contains**:
- Table mapping scenarios to files
- Status tracking (TODO/DONE)
- Quick descriptions
- Running instructions

**Example**:
```markdown
# Annual Billing Code - Test Data

| Scenario | Input CSV | Expected JSON | Status | Description |
|----------|-----------|---------------|--------|-------------|
| P1 | P1-single-billing.csv | P1-single-billing.expected.json | ✅ DONE | Single billing per year |
| E1 | E1-multiple-paid.csv | E1-multiple-paid.expected.json | ✅ DONE | Multiple paid billings |
| E2 | E2-one-paid-unpaid.csv | E2-one-paid-unpaid.expected.json | ⏳ TODO | One paid + unpaid |
```

---

### 6. TypeScript Test Files

**Location**: `tests/validation-rules/[ruleName].test.ts`

**Naming Convention**: `[camelCaseRuleName].test.ts`

**Examples**:
- `annualBillingCodeRule.test.ts`
- `gmfForfait8875Rule.test.ts`
- `interventionCliniqueRule.test.ts`

**Purpose**: Vitest test suite that loads CSV + JSON and validates rule output

**Structure**:
```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";
import { annualBillingCodeRule } from "../../server/modules/validateur/validation/rules";

const TEST_DATA_DIR = join(__dirname, "test-data", "annual-billing-code");

describe("Annual Billing Code Rule", () => {
  describe("✅ PASS Scenarios", () => {
    it("P1: Single Billing Per Year", async () => {
      // Load CSV + JSON
      const { records, expected } = loadTestData("P1-single-billing");

      // Run validation
      const results = await annualBillingCodeRule(records, "test-run-001");

      // Assert results match expected
      expect(results).toHaveLength(expected.expectedResults.length);
      expect(results[0].message).toBe(expected.expectedResults[0].message);
      expect(results[0].ruleData).toMatchObject(expected.expectedResults[0].ruleData);
    });
  });

  describe("❌ ERROR Scenarios", () => {
    it("E1: Multiple Paid Billings", async () => {
      // Same pattern...
    });
  });
});
```

**How to Create**: See [TEST_FILE_TEMPLATE.md](TEST_FILE_TEMPLATE.md)

---

## Complete Workflow

### Step 1: Define Scenarios in MD File

**File**: `docs/modules/validateur/rules-implemented/ANNUAL_BILLING_CODE.md`

Add scenarios section with P1-Pn, E1-En, O1-On, P-SUMMARY

Each scenario specifies:
- Condition (when it triggers)
- Message (French)
- Solution (French, or null for PASS)
- Monetary impact
- Display configuration
- Test case reference
- Example ruleData

✅ **Already done for all 4 implemented rules!**

---

### Step 2: Create Test Data Directory

```bash
mkdir -p tests/validation-rules/test-data/annual-billing-code
```

---

### Step 3: Create Test Files for Each Scenario

For scenario **P1** (example):

#### 3a. Create CSV Input

**File**: `tests/validation-rules/test-data/annual-billing-code/P1-single-billing.csv`

```csv
Facture,ID RAMQ,Date de Service,Code,Patient,Montant payé,Medecin
INV-001,RAMQ-001,2025-03-15,15815,PATIENT-001,49.15,Dr. Smith
```

**How**: Match the scenario "Condition" from MD file

---

#### 3b. Create Expected JSON

**File**: `tests/validation-rules/test-data/annual-billing-code/P1-single-billing.expected.json`

**Template**: Use `EXPECTED_RESULTS_QUICK_TEMPLATE.json`

**Process**:
1. Copy template
2. Fill in scenario details from MD file
3. Replace {variables} in messages with CSV values
4. Copy ruleData structure from MD file
5. Fill ruleData with actual CSV values
6. Delete comment lines
7. Validate JSON syntax

**Guide**: See `EXPECTED_RESULTS_TEMPLATE.md`

---

### Step 4: Create Test README

**File**: `tests/validation-rules/test-data/annual-billing-code/README.md`

Create index table showing all scenarios with status tracking.

---

### Step 5: Write TypeScript Test

**File**: `tests/validation-rules/annualBillingCodeRule.test.ts`

**Template**: Use `TEST_FILE_TEMPLATE.md`

Structure:
```typescript
describe("✅ PASS Scenarios", () => {
  it("P1: Single Billing Per Year", async () => { ... });
  it("P2: Different Years", async () => { ... });
});

describe("❌ ERROR Scenarios", () => {
  it("E1: Multiple Paid Billings", async () => { ... });
  it("E2: One Paid + Unpaid", async () => { ... });
});

describe("💡 OPTIMIZATION Scenarios", () => {
  it("O1: Patient Without 8875", async () => { ... });
});
```

---

### Step 6: Run Tests

```bash
# Run all tests
npm test

# Run specific rule tests
npm test tests/validation-rules/annualBillingCodeRule.test.ts

# Run in watch mode
npm test -- --watch

# Run with UI
npm run test:ui
```

**Expected output**:
```
✅ PASS Scenarios
  ✓ P1: Single Billing Per Year
  ✓ P2: Different Years

❌ ERROR Scenarios
  ✓ E1: Multiple Paid Billings
  ✓ E2: One Paid + Unpaid

Test Results: 4 passed, 4 total
```

---

## File Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  ANNUAL_BILLING_CODE.md (Rule Documentation)                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Scenario P1: Single Billing Per Year                       │ │
│  │ Scenario E1: Multiple Paid Billings                        │ │
│  │ Scenario E2: One Paid + Unpaid Billings                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Scenarios defined here
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  test-data/annual-billing-code/                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ P1-single-billing.csv              ◄───┐                   │ │
│  │ P1-single-billing.expected.json    ◄───┼─── Test P1        │ │
│  │                                         │                   │ │
│  │ E1-multiple-paid.csv               ◄───┤                   │ │
│  │ E1-multiple-paid.expected.json     ◄───┼─── Test E1        │ │
│  │                                         │                   │ │
│  │ E2-one-paid-unpaid.csv             ◄───┤                   │ │
│  │ E2-one-paid-unpaid.expected.json   ◄───┴─── Test E2        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Loaded by test code
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  annualBillingCodeRule.test.ts (TypeScript Test)                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ it("P1: Single Billing Per Year", async () => {            │ │
│  │   const records = loadCSV("P1-single-billing.csv");        │ │
│  │   const expected = loadJSON("P1-single-billing.expected"); │ │
│  │   const results = await annualBillingCodeRule(records);    │ │
│  │   expect(results).toMatchObject(expected);                 │ │
│  │ });                                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Calls implementation
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  annualBillingCodeRule.ts (Rule Implementation)                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ export async function annualBillingCodeRule(               │ │
│  │   records: BillingRecord[],                                │ │
│  │   validationRunId: string                                  │ │
│  │ ): Promise<ValidationResult[]> {                           │ │
│  │   // Validation logic based on MD file scenarios           │ │
│  │   return results;                                          │ │
│  │ }                                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Example: Complete Test Scenario (E1)

### File 1: Rule Documentation

**Location**: `docs/modules/validateur/rules-implemented/ANNUAL_BILLING_CODE.md`

```markdown
#### Scenario E1: Multiple Paid Billings (CRITICAL)

**Condition:** `Code annuel facturé et payé plusieurs fois pour le même patient la même année`

**Message (French):**
```
"Code annuel {code} facturé {totalCount} fois et payé {paidCount} fois pour le même patient en {year}. Maximum: 1 par an."
```

**Solution (French):**
```
"Contactez la RAMQ pour corriger les paiements multiples. Ce code ne peut être payé qu'une fois par année civile."
```

**Monetary Impact:** `-{totalPaidAmount}` (revenue at risk)

**Test Case Reference:** `test-E1`

**Example ruleData:**
```json
{
  "monetaryImpact": -98.30,
  "code": "15815",
  "patient": "PATIENT-001",
  "year": 2025,
  "totalCount": 2,
  "paidCount": 2,
  "unpaidCount": 0,
  "dates": ["2025-01-10", "2025-06-15"],
  "amounts": [49.15, 49.15],
  "totalPaidAmount": 98.30
}
```
```

---

### File 2: CSV Input

**Location**: `tests/validation-rules/test-data/annual-billing-code/E1-multiple-paid.csv`

```csv
Facture,ID RAMQ,Date de Service,Code,Patient,Montant payé,Medecin
INV-001,RAMQ-001,2025-01-10,15815,PATIENT-001,49.15,Dr. Smith
INV-002,RAMQ-002,2025-06-15,15815,PATIENT-001,49.15,Dr. Smith
```

**Why this triggers E1**: Same patient, same code, same year, both paid

---

### File 3: Expected JSON

**Location**: `tests/validation-rules/test-data/annual-billing-code/E1-multiple-paid.expected.json`

```json
{
  "scenarioId": "E1",
  "scenarioName": "Multiple Paid Billings (CRITICAL)",
  "description": "Code annuel facturé et payé plusieurs fois pour le même patient la même année",
  "expectedResults": [
    {
      "severity": "error",
      "category": "annual_limit",
      "message": "Code annuel 15815 facturé 2 fois et payé 2 fois pour le même patient en 2025. Maximum: 1 par an.",
      "solution": "Contactez la RAMQ pour corriger les paiements multiples. Ce code ne peut être payé qu'une fois par année civile.",
      "ruleData": {
        "monetaryImpact": -98.30,
        "code": "15815",
        "patient": "PATIENT-001",
        "year": 2025,
        "totalCount": 2,
        "paidCount": 2,
        "unpaidCount": 0,
        "dates": ["2025-01-10", "2025-06-15"],
        "amounts": [49.15, 49.15],
        "totalPaidAmount": 98.30
      },
      "affectedRecordCount": 2
    },
    {
      "severity": "info",
      "category": "annual_limit",
      "message": "Validation complétée pour 2 enregistrement(s) de codes annuels. 1 erreur(s) détectée(s).",
      "solution": null,
      "ruleData": {
        "monetaryImpact": -98.30,
        "totalRecords": 2,
        "errorCount": 1,
        "totalAtRisk": 98.30,
        "codesChecked": ["15815"],
        "breakdown": {
          "E1": 1,
          "E2": 0,
          "E3": 0
        }
      }
    }
  ]
}
```

---

### File 4: TypeScript Test

**Location**: `tests/validation-rules/annualBillingCodeRule.test.ts`

```typescript
describe("❌ ERROR Scenarios", () => {
  it("E1: Multiple Paid Billings (CRITICAL)", async () => {
    // Load test data
    const { records, expected } = loadTestData("E1-multiple-paid");

    // Run validation
    const results = await annualBillingCodeRule(records, "test-run-001");

    // Assert results match expected
    expect(results).toHaveLength(expected.expectedResults.length);

    // Verify error result
    const errorResult = results.find(r => r.severity === "error");
    const expectedError = expected.expectedResults.find(r => r.severity === "error");

    expect(errorResult).toBeDefined();
    expect(errorResult!.message).toBe(expectedError!.message);
    expect(errorResult!.solution).toBe(expectedError!.solution);
    expect(errorResult!.ruleData).toMatchObject(expectedError!.ruleData);
    expect(errorResult!.ruleData.monetaryImpact).toBe(-98.30);
  });
});
```

---

## Checklist: Creating a New Test Scenario

- [ ] **Read MD file** - Find scenario definition (P1, E1, O1, etc.)
- [ ] **Create CSV file** - Match scenario condition exactly
- [ ] **Create JSON file** - Use template, copy from MD file
- [ ] **Update README** - Add row to scenarios table
- [ ] **Write test code** - Add `it()` block to test file
- [ ] **Run test** - `npm test [testFile]`
- [ ] **Fix failures** - Debug using actual vs expected output
- [ ] **Commit files** - All 3 files together (CSV + JSON + test code)

---

## Current Status

### ✅ Completed

- [X] All 4 rule MD files updated with scenarios
- [X] Testing structure documentation created
- [X] Expected results template and guide created
- [X] Example test data created (E1 scenario)
- [X] Test data directory structure set up

### ⏳ TODO

- [ ] Create CSV + JSON for all scenarios in each rule:
  - [ ] Annual Billing Code (6 scenarios: P1-P3, E1-E3)
  - [ ] GMF 8875 (7 scenarios: P1-P3, E1-E2, O1, P-SUMMARY)
  - [ ] Intervention Clinique (6 scenarios: P1-P3, E1-E2, P-SUMMARY)
  - [ ] Visit Duration Optimization (8 scenarios: P1-P4, O1-O3, P-SUMMARY)

- [ ] Write TypeScript test files for each rule:
  - [ ] `annualBillingCodeRule.test.ts`
  - [ ] `gmfForfait8875Rule.test.ts`
  - [ ] `interventionCliniqueRule.test.ts`
  - [ ] `visitDurationOptimizationRule.test.ts`

---

## Quick Reference

| Need | File | Purpose |
|------|------|---------|
| **Overview** | `TESTING_STRUCTURE.md` (this file) | Complete testing system guide |
| **JSON help** | `EXPECTED_RESULTS_TEMPLATE.md` | How to create .expected.json files |
| **Quick template** | `EXPECTED_RESULTS_QUICK_TEMPLATE.json` | Copy-paste JSON template |
| **Test code template** | `TEST_FILE_TEMPLATE.md` | How to write .test.ts files |
| **Rule scenarios** | `rules-implemented/[RULE].md` | Scenario definitions |
| **Test files** | `test-data/[rule-name]/` | CSV + JSON files |

---

## Getting Help

**If you're stuck**:
1. Read the scenario in the MD file
2. Look at the E1 example (already created)
3. Copy the structure exactly
4. Ask Claude for clarification on specific fields

**Common issues**:
- JSON syntax errors → Use https://jsonlint.com
- Test failures → Compare actual vs expected in test output
- Missing fields → Check MD file "Example ruleData"

---

**You now have a complete testing system for validation rules!** 🚀
