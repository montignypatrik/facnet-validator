# RAMQ Validation Rule Template

Use this template to create new validation rules for the Quebec healthcare billing system. Fill out all sections and provide this to Claude for implementation.

---

## Rule Information

**Rule Name (French)**: `[Name in French for database and UI]`

**Rule ID**: `[UPPERCASE_SNAKE_CASE_ID]` (e.g., `ANNUAL_BILLING_CODE`)

**Rule Type**: `[Select one from list below]`
- `prohibition` - Codes that cannot be billed together
- `time_restriction` - Time-based rules (after-hours, weekends, holidays)
- `requirement` - Codes that require other codes or conditions
- `location_restriction` - Location-based rules (urgence, cabinet, établissement)
- `age_restriction` - Age-based billing rules
- `amount_limit` - Dollar amount limits per period
- `mutual_exclusion` - Only ONE code from group per period
- `missing_annual_opportunity` - Revenue optimization alerts
- `annual_limit` - Once-per-year codes (simple version)
- `annual_billing_code` - Once-per-year codes (advanced with leaf matching)
- `[NEW_TYPE]` - If none of the above fit, describe new type

**Severity**: `[Select one]`
- `error` - Critical violations that must be fixed
- `warning` - Issues that should be reviewed
- `info` - Informational alerts
- `optimization` - Revenue opportunity suggestions

**Category**: `[billing_codes | office_fees | context_missing | annual_limit | etc.]`

---

## Rule Logic Description

### What This Rule Validates:
```
[Describe in plain language what the rule checks for]

Example:
"This rule ensures that billing codes with specific leaf descriptions
(Visite de prise en charge, Visite périodique) can only be billed once
per patient per calendar year (January 1 - December 31)."
```

### When Should This Trigger?
```
[Describe the specific conditions that cause a validation error]

Example:
"Trigger when:
1. Patient has multiple billings of the same annual code in same year
2. Both billings are in the same calendar year (Jan 1 - Dec 31)
3. Code is identified by its leaf field matching target patterns"
```

### When Should This NOT Trigger?
```
[Describe valid scenarios that should pass validation]

Example:
"Should NOT trigger when:
1. Same code billed in different calendar years (2024 vs 2025)
2. Different patients have same code in same year
3. Code is not in the target leaf patterns"
```

---

## Target Data

### Target Billing Codes (if applicable):
```
[Specify codes in one of these ways:]

Option 1 - Specific codes:
codes: ["19928", "19929", "15815"]

Option 2 - Codes by leaf field:
leafPatterns: ["Visite de prise en charge", "Visite périodique"]

Option 3 - Codes by description pattern:
descriptionPattern: "Visite de suivi"

Option 4 - All codes (no filter)
```

### Required Context Elements (if applicable):
```
[List context codes required for this rule]

Example:
walkInContexts: ["G160", "AR"]
registeredContexts: ["85"]
```

### Establishment Restrictions (if applicable):
```
[Specify establishment requirements]

Example:
allowedEstablishments: ["cabinet"] (codes starting with 5XXXX)
excludedEstablishments: ["urgence", "établissement"]
```

---

## Thresholds & Limits

### Daily Maximum (if applicable):
```
dailyMaximum: [dollar amount or count]

Example:
dailyMaximum: 64.80 (dollars per day)
```

### Patient Count Requirements (if applicable):
```
minimumPatients: [number]
maximumPatients: [number]

Example for code 19928:
registeredMinimum: 6
walkInMaximum: 10
```

### Time Periods (if applicable):
```
period: [daily | weekly | monthly | annually]
periodStart: [if custom period, e.g., "January 1"]
periodEnd: [if custom period, e.g., "December 31"]
```

---

## Error Messages (French)

### Primary Error Message:
```
[French message shown when rule is violated]

Example:
"Code annuel {code} facturé {totalCount} fois et payé {paidCount} fois
pour le même patient en {year}. Maximum: 1 par an."
```

### Solution Message:
```
[French message suggesting how to fix the error]

Example:
"Veuillez supprimer {unpaidCount} facture(s) non payée(s).
Ce code ne peut être facturé qu'une fois par année civile."
```

### Different Scenarios (if multiple solutions):
```
Scenario 1: [Condition]
Message: [French message]
Solution: [French solution]

Scenario 2: [Condition]
Message: [French message]
Solution: [French solution]
```

---

## Test Scenarios

### Pass Scenario 1:
```
Description: [What should pass]
Test Data:
- Patient: PATIENT-001
- Code: 15815
- Date: 2025-03-15
- Amount Paid: 49.15
Expected: No error
```

### Pass Scenario 2:
```
[Add more passing scenarios]
```

### Fail Scenario 1:
```
Description: [What should fail]
Test Data:
- Patient: PATIENT-001
- Code: 15815
- Date 1: 2025-01-10, Amount: 49.15 (paid)
- Date 2: 2025-06-15, Amount: 49.15 (paid)
Expected: Error with message about multiple paid billings
```

### Fail Scenario 2:
```
[Add more failing scenarios]
```

### Edge Case Scenarios:
```
1. [Edge case description]
   Expected: [behavior]

2. [Edge case description]
   Expected: [behavior]
```

---

## Additional Requirements

### Special Validation Logic:
```
[Any complex logic not covered above]

Example:
"If montantPaye is NULL or 0, treat as unpaid.
If multiple records are paid, severity is 'error'.
If one paid and others unpaid, severity is 'warning'."
```

### Dependencies on Other Tables:
```
[If rule needs to join with codes, contexts, establishments, etc.]

Example:
"Must join with codes table to get leaf field values.
Must filter codes where leaf IN target patterns."
```

### Performance Considerations:
```
[If rule processes large datasets or needs optimization]

Example:
"This rule queries all 6,740 codes on startup.
Results should be cached to avoid repeated database queries."
```

---

## Examples from Real Data

### Example CSV Input:
```csv
Facture,ID RAMQ,Date de Service,Code,Patient,Montant payé
INV-001,RAMQ-001,2025-01-10,15815,PATIENT-001,49.15
INV-002,RAMQ-002,2025-06-15,15815,PATIENT-001,49.15
```

### Expected Validation Output:
```
Error:
  Message: "Code annuel 15815 facturé 2 fois et payé 2 fois pour le même patient en 2025. Maximum: 1 par an."
  Solution: "Contactez la RAMQ pour corriger les paiements multiples."
  Severity: error
  Affected Records: [INV-001, INV-002]
```

---

## Implementation Priority

**Priority**: `[High | Medium | Low]`

**Estimated Complexity**: `[Simple | Medium | Complex]`

**Business Impact**:
```
[Describe why this rule is important]

Example:
"High - Prevents RAMQ rejection of billings with duplicate annual codes.
Revenue impact: ~$500/month in rejected claims."
```

---

## Notes & Clarifications

```
[Any additional context, edge cases, or clarifications]

Example:
"This rule was requested after RAMQ rejected 15 claims last month
due to duplicate annual visit codes. The rejection cost $745 in lost
revenue and required manual resubmission."
```

---

## Approval & Sign-off

**Requested By**: `[Name/Role]`
**Date Requested**: `[YYYY-MM-DD]`
**Approved By**: `[Name/Role if applicable]`
**Implementation Deadline**: `[Date if applicable]`

---

# Quick Reference: Available Rule Types

| Rule Type | Use Case | Example |
|-----------|----------|---------|
| `prohibition` | Codes that can't be billed together | Code A + Code B forbidden on same invoice |
| `time_restriction` | Time-based rules | After-hours codes only valid outside business hours |
| `requirement` | Codes requiring other codes | Procedure code requires visit code |
| `location_restriction` | Location-based rules | Emergency codes only in urgence |
| `age_restriction` | Age-based rules | Pediatric codes only for patients under 18 |
| `amount_limit` | Dollar limits | Maximum $64.80/day for office fees |
| `mutual_exclusion` | Only one code from group | Only ONE annual exam per year |
| `missing_annual_opportunity` | Revenue optimization | Patient missing annual exam |
| `annual_limit` | Once per year (simple) | Code can only bill 1x annually |
| `annual_billing_code` | Once per year (advanced) | Codes by leaf field, smart paid/unpaid logic |

---

# Example: Filled Template

See [RULE_EXAMPLE_OFFICE_FEE.md](./RULE_EXAMPLE_OFFICE_FEE.md) for a complete example of the office fee validation rule.
