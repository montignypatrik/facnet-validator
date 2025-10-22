# Annual Billing Code - Test Data

**Rule Documentation**: [ANNUAL_BILLING_CODE.md](../../../../docs/modules/validateur/rules-implemented/ANNUAL_BILLING_CODE.md)

**Test File**: [annualBillingCodeRule.test.ts](../../annualBillingCodeRule.test.ts)

---

## Test Scenarios

This directory contains realistic test data for each scenario defined in the rule documentation.

| Scenario | Input CSV | Expected JSON | Status | Description |
|----------|-----------|---------------|--------|-------------|
| **P1** | `P1-single-billing.csv` | `P1-single-billing.expected.json` | ⏳ TODO | Single billing per year (valid) |
| **P2** | `P2-different-years.csv` | `P2-different-years.expected.json` | ⏳ TODO | Same code in different years (valid) |
| **P3** | `P3-different-patients.csv` | `P3-different-patients.expected.json` | ⏳ TODO | Same code for different patients (valid) |
| **E1** | `E1-multiple-paid.csv` | `E1-multiple-paid.expected.json` | ✅ DONE | Multiple paid billings (CRITICAL) |
| **E2** | `E2-one-paid-unpaid.csv` | `E2-one-paid-unpaid.expected.json` | ⏳ TODO | One paid + unpaid billings |
| **E3** | `E3-all-unpaid.csv` | `E3-all-unpaid.expected.json` | ⏳ TODO | All unpaid billings |

---

## How to Add New Test Scenarios

### Step 1: Create CSV File

Create a CSV file with realistic test data matching the scenario condition.

**Naming**: `[SCENARIO_ID]-[descriptive-name].csv`

Example: `E1-multiple-paid.csv`

**CSV Format**:
```csv
Facture,ID RAMQ,Date de Service,Code,Patient,Montant payé,Medecin
INV-001,RAMQ-001,2025-01-10,15815,PATIENT-001,49.15,Dr. Smith
INV-002,RAMQ-002,2025-06-15,15815,PATIENT-001,49.15,Dr. Smith
```

### Step 2: Create Expected JSON File

Create the corresponding `.expected.json` file.

**Naming**: `[SCENARIO_ID]-[descriptive-name].expected.json`

Example: `E1-multiple-paid.expected.json`

**Use the template**: See [EXPECTED_RESULTS_TEMPLATE.md](../../../../docs/modules/validateur/EXPECTED_RESULTS_TEMPLATE.md)

### Step 3: Run Tests

```bash
npm test tests/validation-rules/annualBillingCodeRule.test.ts
```

---

## Example: E1 Scenario

### Input CSV (`E1-multiple-paid.csv`)

```csv
Facture,ID RAMQ,Date de Service,Code,Patient,Montant payé,Medecin
INV-001,RAMQ-001,2025-01-10,15815,PATIENT-001,49.15,Dr. Smith
INV-002,RAMQ-002,2025-06-15,15815,PATIENT-001,49.15,Dr. Smith
```

**What this tests**: Same patient (PATIENT-001), same code (15815), same year (2025), both PAID → ERROR

### Expected JSON (`E1-multiple-paid.expected.json`)

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

## Field Explanations

See the complete guide: [EXPECTED_RESULTS_TEMPLATE.md](../../../../docs/modules/validateur/EXPECTED_RESULTS_TEMPLATE.md)

### Key Fields

- `scenarioId`: Matches MD file scenario (P1, E1, O1, etc.)
- `severity`: `"info"` (pass), `"error"` (must fix), `"optimization"` (revenue opportunity)
- `message`: French message shown to user (copy from MD file, replace {variables})
- `solution`: How to fix (or `null` for PASS scenarios)
- `ruleData.monetaryImpact`:
  - PASS: `0`
  - ERROR: `0` (unpaid) or negative (revenue at risk)
  - OPTIMIZATION: positive number (gain)
- `affectedRecordCount`: How many CSV rows triggered this result

---

## Notes

- Always create BOTH files (CSV + JSON) for each scenario
- CSV should have realistic Quebec healthcare billing data
- JSON must match the MD file scenario specification exactly
- Patient IDs should be anonymized (PATIENT-001, PATIENT-002, etc.)
- Test with `npm test` before committing
