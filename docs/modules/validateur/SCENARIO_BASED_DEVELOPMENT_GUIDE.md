# Scenario-Based Development Guide

**Complete workflow for creating validation rules using the scenario-based approach.**

---

## Overview

This system uses **markdown files as the single source of truth** for validation rules.
Each MD file defines:

1. **Business logic** - What the rule validates
2. **All possible scenarios** - Pass, Error, and Optimization outcomes
3. **Exact messages** - French user-facing text (pre-approved)
4. **Display requirements** - Which UI components to show
5. **Test cases** - Direct mapping to test files

---

## The Three Severity Types

Your system now has **exactly 3 severity types**:

| Severity | Symbol | Purpose | User Action | Display |
|----------|--------|---------|-------------|---------|
| **info** | ✅ | Validation passed | None (informational) | Collapsed by default |
| **error** | ❌ | Regulation violation | **MUST fix** | Always visible, expanded |
| **optimization** | 💡 | Missed revenue | **SHOULD implement** | Always visible, highlighted |

**Removed**: `warning` severity (no longer used)

---

## File Structure

```
docs/modules/validateur/
├── RULE_TEMPLATE.md                    # ⭐ Blank template for new rules
├── TEST_FILE_TEMPLATE.md               # ⭐ Test file structure guide
├── SCENARIO_BASED_DEVELOPMENT_GUIDE.md # ⭐ This file
├── OFFICE_FEE_SCENARIOS_EXAMPLE.md     # ⭐ Complete reference example
│
├── rules-implemented/
│   ├── OFFICE_FEE_19928_19929.md       # Original example (to be updated)
│   ├── intervention_clinique_rule.md
│   ├── gmf_8875_validation.md
│   ├── VISIT_DURATION_OPTIMIZATION.md
│   └── ANNUAL_BILLING_CODE.md
│
tests/validation-rules/
├── officeFeeRule.test.ts               # Maps to OFFICE_FEE_19928_19929.md
├── interventionCliniqueRule.test.ts
├── gmfForfait8875Rule.test.ts
├── visitDurationOptimizationRule.test.ts
└── annualBillingCodeRule.test.ts
```

---

## Complete Workflow

### Step 1: Create MD File Specification

**Use:** `RULE_TEMPLATE.md`

1. **Copy the template**
2. **Fill in Rule Information** (name, ID, type, category)
3. **Define business logic** (what validates, when triggers, when not)
4. **Specify target data** (codes, contexts, establishments)
5. **Define ALL scenarios** (P1, P2, E1, E2, O1, O2, P-SUMMARY)

**For each scenario, specify:**
- **Condition** - When does this occur?
- **Message (French)** - Exact text to show user
- **Solution (French)** - Exactly what to do (or `null` for PASS)
- **Monetary Impact** - Number (0, positive, or negative)
- **Display Configuration** - Which UI boxes to show
- **Test Case Reference** - Maps to test file (e.g., `test-E1`)
- **Example ruleData** - JSON structure with all fields

### Step 2: Review & Approve Messages

**Before implementation:**
1. Review all French messages for accuracy
2. Ensure solutions are specific and actionable
3. Verify monetary impact calculations
4. Confirm display requirements are clear

**This is your chance to approve all user-facing text!**

### Step 3: Create Test File

**Use:** `TEST_FILE_TEMPLATE.md`

1. **Create test file**: `tests/validation-rules/[ruleId].test.ts`
2. **Add describe blocks** for each severity group (PASS, ERROR, OPTIMIZATION)
3. **Create one test per scenario** - Name tests with scenario ID (P1, E1, O1)
4. **Verify messages match MD file exactly**
5. **Verify ruleData structure matches MD example**

**Example:**
```typescript
describe("✅ PASS Scenarios", () => {
  it("P1: Valid Code 19928 - Registered Patients", async () => {
    // Arrange - Create test data matching Scenario P1 condition
    const records = [/* ... */];

    // Act
    const results = await rule.validate(records, validationRunId);

    // Assert - Verify matches Scenario P1 specification
    expect(results[0].message).toBe("Validation réussie: Code 19928...");
    expect(results[0].ruleData).toMatchObject({
      monetaryImpact: 0,
      code: "19928",
      registeredPaidCount: 8,
      // All fields from MD file example
    });
  });
});
```

### Step 4: Implement Validation Rule

**Agent task**: Create TypeScript rule based on MD scenarios

**Claude will:**
1. Read the MD file scenarios
2. Implement validation logic for each scenario
3. Emit results with **exact messages** from MD file
4. Structure `ruleData` to match MD examples
5. Ensure monetary impact follows MD specification

**Rule implementation pattern:**
```typescript
export async function myRule(
  records: BillingRecord[],
  validationRunId: string
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // Scenario P1: Valid case
  if (condition_P1) {
    results.push({
      severity: "info",
      message: "Validation réussie: ...", // From MD file
      solution: null,
      ruleData: {
        monetaryImpact: 0,
        // Fields from MD example
      }
    });
  }

  // Scenario E1: Error case
  if (condition_E1) {
    results.push({
      severity: "error",
      message: "Code 19928 exige...", // From MD file
      solution: "Changez pour code 19929...", // From MD file
      ruleData: {
        monetaryImpact: 0,
        // Fields from MD example
      }
    });
  }

  // Scenario O1: Optimization case
  if (condition_O1) {
    results.push({
      severity: "optimization",
      message: "Optimisation de revenus...", // From MD file
      solution: "Facturer 19929 au lieu...", // From MD file
      ruleData: {
        monetaryImpact: 32.10, // MUST be positive
        // Fields from MD example
      }
    });
  }

  // Scenario P-SUMMARY: Always add summary
  results.push({
    severity: "info",
    message: "Validation complétée...",
    solution: null,
    ruleData: {
      monetaryImpact: 0,
      totalRecords: records.length,
      errorCount: results.filter(r => r.severity === "error").length,
      optimizationCount: results.filter(r => r.severity === "optimization").length,
    }
  });

  return results;
}
```

### Step 5: Implement Display Components

**Agent task**: Create UI components based on MD display configuration

**Claude will:**
1. Read display configuration from each scenario
2. Create result card with appropriate boxes:
   - Billing details box (if checked in MD)
   - Visit statistics grid (if checked in MD)
   - Temporal information box (if checked in MD)
   - Comparison box (if checked in MD)
3. Apply collapse/expand defaults from MD
4. Show monetary impact badge based on severity

**Display logic:**
```typescript
// Display configuration from Scenario E1
if (result.severity === "error") {
  return (
    <ValidationResultCard expanded={true}>  {/* From MD: "Collapsed by default: No" */}
      <ErrorMessage>{result.message}</ErrorMessage>
      <SolutionBox>{result.solution}</SolutionBox>

      {/* From MD: "Show in details: [X] Billing details box" */}
      <BillingDetailsBox data={result.ruleData} />

      {/* From MD: "Show in details: [X] Visit statistics grid" */}
      <VisitStatisticsGrid data={result.ruleData} />
    </ValidationResultCard>
  );
}

// Display configuration from Scenario O1
if (result.severity === "optimization") {
  return (
    <ValidationResultCard expanded={true}>  {/* From MD: "Collapsed by default: No" */}
      <MonetaryImpactBadge amount={result.ruleData.monetaryImpact} />
      <OptimizationMessage>{result.message}</OptimizationMessage>
      <SolutionBox highlighted>{result.solution}</SolutionBox>

      {/* From MD: "Show in details: [X] Comparison box" */}
      <ComparisonBox
        current={result.ruleData.currentCode}
        suggested={result.ruleData.suggestedCode}
        gain={result.ruleData.monetaryImpact}
      />
    </ValidationResultCard>
  );
}

// Display configuration from Scenario P1
if (result.severity === "info") {
  return (
    <ValidationResultCard collapsed={true}>  {/* From MD: "Collapsed by default: Yes" */}
      <InfoMessage>{result.message}</InfoMessage>

      {/* Expandable section */}
      <ExpandableDetails>
        {/* From MD: "Show when expanded: [X] Visit statistics grid" */}
        <VisitStatisticsGrid data={result.ruleData} />
      </ExpandableDetails>
    </ValidationResultCard>
  );
}
```

### Step 6: Run Tests & Verify

```bash
# Run tests
npm test tests/validation-rules/[ruleId].test.ts

# Expected output:
# ✅ PASS Scenarios
#   ✓ P1: Valid Code 19928 - Registered Patients
#   ✓ P2: Valid Code 19929 - Mixed Patients
#
# ❌ ERROR Scenarios
#   ✓ E1: Insufficient Registered Patients (19928)
#   ✓ E2: Insufficient Registered Patients (19929)
#
# 💡 OPTIMIZATION Scenarios
#   ✓ O1: Could Use Higher Code (19928 → 19929)
#
# 📊 SUMMARY Scenario
#   ✓ P-SUMMARY: Validation Complete
#
# Test Results: 6 passed, 6 total
```

**Verification checklist:**
- [ ] All scenarios have corresponding tests
- [ ] Messages match MD file exactly
- [ ] ruleData structures match MD examples
- [ ] Monetary impact follows rules:
  - [ ] PASS: `0` or total processed
  - [ ] ERROR: `0` (unpaid) or `-amount` (at risk)
  - [ ] OPTIMIZATION: `positive number > 0`
- [ ] Display configuration matches MD specs
- [ ] All tests pass

### Step 7: Integration Testing

1. **Upload test CSV** with data matching each scenario
2. **Verify results display correctly:**
   - ✅ PASS results are collapsed
   - ❌ ERROR results are expanded with solution box
   - 💡 OPTIMIZATION results show gain badge
3. **Verify French messages match MD file**
4. **Verify display boxes show correct data**

---

## Scenario Naming Convention

**Strict naming for consistency:**

| Prefix | Severity | Example | Purpose |
|--------|----------|---------|---------|
| `P1, P2, P3...` | info | P1: Valid Code 19928 | Pass scenarios |
| `E1, E2, E3...` | error | E1: Insufficient Patients | Error scenarios |
| `O1, O2, O3...` | optimization | O1: Could Use Higher Code | Optimization scenarios |
| `P-SUMMARY` | info | P-SUMMARY: Validation Complete | Summary (always include) |

---

## Monetary Impact Rules

**Critical for display and business logic:**

### PASS (info)
```json
{
  "monetaryImpact": 0,  // Usually 0 for informational
  // OR
  "monetaryImpact": 486.00  // Total amount processed (summary)
}
```

### ERROR
```json
{
  // If billing not yet paid:
  "monetaryImpact": 0,  // No revenue at risk

  // If billing already paid:
  "monetaryImpact": -64.20  // Revenue at risk if rejected
}
```

### OPTIMIZATION
```json
{
  "monetaryImpact": 32.10,  // MUST be positive (gain)
  // Calculation: expectedAmount - currentAmount
  // Example: 64.20 - 32.10 = 32.10
}
```

**Validation:**
- `monetaryImpact` MUST always be a **number** (never string)
- Optimizations MUST have `monetaryImpact > 0`
- Pass scenarios typically have `monetaryImpact = 0`
- Errors have `monetaryImpact = 0` (unpaid) or negative (at risk)

---

## Display Configuration Options

**For each scenario, specify which boxes to show:**

### Standard Detail Boxes

#### Billing Details Box
```markdown
- [X] Billing details box
```
Shows: code, amount, type, context

**When to use:** Errors and optimizations with specific billing codes

#### Visit Statistics Grid
```markdown
- [X] Visit statistics grid
```
Shows: registered paid/unpaid, walk-in paid/unpaid

**When to use:** Office fee and intervention clinique rules

#### Temporal Information Box
```markdown
- [X] Temporal information box
```
Shows: date, start time, end time, duration

**When to use:** Date-sensitive or time-duration rules

#### Comparison Box
```markdown
- [X] Comparison box
```
Shows: current code/amount → suggested code/amount, gain

**When to use:** Optimizations showing current vs suggested

---

## Example: Complete Scenario Definition

```markdown
#### Scenario E1: Insufficient Registered Patients (19928)

**Condition:** `Code 19928 billed with <6 paid registered patients`

**Message (French):**
```
"Code 19928 exige minimum 6 patients inscrits mais seulement {registeredPaidCount} trouvé(s) pour {doctor} le {date}"
```

**Solution (French):**
```
"Changez pour code 19929 ou corrigez les {registeredUnpaidCount} visite(s) non payée(s)"
```

**Monetary Impact:**
- `0` if all billings unpaid
- `-{totalAmount}` if billings already paid

**Display Configuration:**
- **Collapsed by default:** No (always expanded)
- **Always show:**
  - [X] Error message
  - [X] Solution box (highlighted)
- **Show in details:**
  - [X] Billing details box
  - [X] Visit statistics grid
  - [ ] Temporal information box
  - [ ] Comparison box
- **Custom data fields to display:** `code, required, actual, registeredPaidCount, registeredUnpaidCount, totalAmount, doctor, date`

**Test Case Reference:** `test-E1`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "code": "19928",
  "required": 6,
  "actual": 3,
  "registeredPaidCount": 3,
  "registeredUnpaidCount": 2,
  "walkInPaidCount": 0,
  "walkInUnpaidCount": 0,
  "totalAmount": 19.44,
  "doctor": "Dr. M***",
  "date": "2025-01-06"
}
```
```

---

## Benefits of This System

### 1. **Pre-Approved Messages**
All French messages reviewed and approved in MD file before coding

### 2. **Single Source of Truth**
MD file defines logic, messages, display, and tests

### 3. **Clear Agent Instructions**
Display specialist knows exactly what to show and when

### 4. **Better Testing**
Test scenarios map directly to MD scenarios (100% coverage)

### 5. **Easier Maintenance**
Update messages/display in MD file, regenerate code

### 6. **Documentation = Specification**
MD file serves as both spec and documentation

---

## Quick Reference

| Task | Use This File |
|------|---------------|
| Create new rule | `RULE_TEMPLATE.md` |
| See complete example | `OFFICE_FEE_SCENARIOS_EXAMPLE.md` |
| Create test file | `TEST_FILE_TEMPLATE.md` |
| Understand workflow | `SCENARIO_BASED_DEVELOPMENT_GUIDE.md` (this file) |
| Review display framework | `VALIDATION_RESULT_DISPLAY_FRAMEWORK.md` |

---

## Migration Plan for Existing Rules

**Update existing rules to use scenario-based approach:**

1. **Read existing rule implementation** (TypeScript file)
2. **Identify all possible outcomes** (pass, error, optimization cases)
3. **Create scenarios section** in existing MD file
4. **Map each outcome to a scenario** (P1, E1, O1, etc.)
5. **Specify messages, solutions, display config**
6. **Update test file** to reference scenarios
7. **Verify implementation** matches new spec

**Priority order:**
1. Office Fee (19928/19929) - ✅ Example created
2. Intervention Clinique - Next
3. GMF Forfait 8875 - Next
4. Visit Duration Optimization - Next
5. Annual Billing Code - Next

---

## Getting Help

**If you're unsure:**
1. Look at `OFFICE_FEE_SCENARIOS_EXAMPLE.md` for reference
2. Copy scenario structure exactly
3. Ask Claude: "Review my scenario definition for [rule name]"

---

## Workflow Summary

```
1. Fill RULE_TEMPLATE.md with all scenarios
   ↓
2. Review & approve French messages
   ↓
3. Create test file (TEST_FILE_TEMPLATE.md)
   ↓
4. Claude implements TypeScript rule
   ↓
5. Claude creates display components
   ↓
6. Run tests (npm test)
   ↓
7. Integration testing (upload CSV)
   ↓
8. Deploy to production
```

**Total time:** ~2-4 hours per rule (including review and testing)

---

**You're now ready to create validation rules with complete scenario specifications!** 🚀
