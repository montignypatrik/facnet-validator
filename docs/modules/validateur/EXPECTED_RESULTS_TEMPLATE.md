# Expected Results JSON Template & Guide

**Purpose**: This file teaches you how to create `.expected.json` files for validation rule testing.

---

## JSON File Structure Overview

Every `.expected.json` file has **3 main parts**:

```json
{
  "scenarioId": "...",           // 1. Which scenario from the MD file (P1, E1, O1, etc.)
  "scenarioName": "...",          // 2. Human-readable name
  "description": "...",           // 3. What this test validates
  "expectedResults": [...]        // 4. Array of validation results (main part!)
}
```

---

## Field Explanations

### Top-Level Fields

| Field | Type | Example | What It Means |
|-------|------|---------|---------------|
| `scenarioId` | Text | `"P1"` or `"E1"` | Matches scenario ID from MD file |
| `scenarioName` | Text | `"Single Billing Per Year"` | Copy from MD file scenario title |
| `description` | Text | `"Code annuel facturé une seule fois..."` | Copy **Condition** from MD file |
| `expectedResults` | Array | `[{...}, {...}]` | List of validation results (usually 1-2 items) |

---

### Inside Each Result Object

Each item in `expectedResults` array has these fields:

| Field | Type | Example | What It Means |
|-------|------|---------|---------------|
| `severity` | Text | `"info"` or `"error"` or `"optimization"` | Type of result (see severity table below) |
| `category` | Text | `"annual_limit"` | Rule category (copy from MD file) |
| `message` | Text | `"Validation réussie: Code annuel 15815..."` | Exact French message from MD scenario |
| `solution` | Text or `null` | `"Contactez la RAMQ..."` or `null` | Exact French solution from MD scenario (PASS = `null`) |
| `ruleData` | Object | `{...}` | Data fields specific to this scenario (see below) |
| `affectedRecordCount` | Number (optional) | `1` or `2` | How many CSV rows triggered this result |

---

### Severity Types

| Severity | When to Use | Message Starts With | Solution |
|----------|-------------|---------------------|----------|
| `"info"` | PASS scenarios (P1, P2, P-SUMMARY) | `"Validation réussie..."` or `"Validation complétée..."` | Always `null` |
| `"error"` | ERROR scenarios (E1, E2, E3) | Describes the problem | Required - tells user how to fix |
| `"optimization"` | OPTIMIZATION scenarios (O1, O2) | `"Optimisation de revenus..."` | Required - tells user what to change |

---

### The `ruleData` Object

This is **the most important part** - it contains all the data shown to the user.

**Copy the `ruleData` structure from the MD file scenario example**, then fill in values based on your CSV test data.

Example from Annual Billing Code E1 scenario:

```json
"ruleData": {
  "monetaryImpact": -98.30,               // Revenue at risk (negative for errors)
  "code": "15815",                         // Billing code from CSV
  "patient": "TEST12345678",                // Patient ID from CSV
  "year": 2025,                            // Calendar year
  "totalCount": 2,                         // How many times code was billed
  "paidCount": 2,                          // How many are paid
  "unpaidCount": 0,                        // How many are unpaid
  "dates": ["2025-01-10", "2025-06-15"],  // Array of dates from CSV
  "amounts": [49.15, 49.15],              // Array of amounts from CSV
  "totalPaidAmount": 98.30                 // Sum of paid amounts
}
```

**Important**: Every rule has different `ruleData` fields. Always copy from the MD file scenario example!

---

## Step-by-Step Guide

### Step 1: Create CSV File

Create your test data CSV file matching the scenario condition.

**Example**: `E1-multiple-paid.csv`

**⚠️ IMPORTANT**: Use realistic Quebec CSV format! See [CSV_FORMAT_REFERENCE.md](CSV_FORMAT_REFERENCE.md)
- Delimiter: `;` (semicolon)
- Decimal: `49,15` (comma)
- Patient NAM: `ABCD12345678`

```csv
#;Facture;ID RAMQ;Date de Service;Début;Fin;Periode;Lieu de pratique;Secteur d'activité;Diagnostic;Code;Unités;Rôle;Élément de contexte;Montant Preliminaire;Montant payé;Doctor Info;Patient
1;128357270;15600245854;2025-01-10;00:00;;202520;55489;Aucun Secteur;;15815;0;1;;49,15;49,15;1069491-00000 | Boyadjian, Shogher - Omnipraticien  ;TEST12345678 - TEST, PATIENT A
2;128357315;15600247173;2025-06-15;00:00;;202520;55489;Aucun Secteur;;15815;0;1;;49,15;49,15;1069491-00000 | Boyadjian, Shogher - Omnipraticien  ;TEST12345678 - TEST, PATIENT A
```

### Step 2: Open the Rule's MD File

Open: `docs/modules/validateur/rules-implemented/ANNUAL_BILLING_CODE.md`

Find the scenario section (e.g., **Scenario E1: Multiple Paid Billings**)

### Step 3: Copy Template

Use the template below for your scenario type:

---

## Templates by Scenario Type

### PASS Scenario Template (P1, P2, P3...)

```json
{
  "scenarioId": "P1",
  "scenarioName": "[Copy from MD file - e.g., Single Billing Per Year]",
  "description": "[Copy 'Condition' from MD file]",
  "expectedResults": [
    {
      "severity": "info",
      "category": "[Copy from MD file - e.g., annual_limit]",
      "message": "[Copy 'Message (French)' from MD file, replace {variables} with actual values]",
      "solution": null,
      "ruleData": {
        "monetaryImpact": 0,
        "[Copy all fields from MD file 'Example ruleData']": "[Fill with values from CSV]"
      },
      "affectedRecordCount": 1
    }
  ]
}
```

---

### ERROR Scenario Template (E1, E2, E3...)

```json
{
  "scenarioId": "E1",
  "scenarioName": "[Copy from MD file]",
  "description": "[Copy 'Condition' from MD file]",
  "expectedResults": [
    {
      "severity": "error",
      "category": "[Copy from MD file]",
      "message": "[Copy 'Message (French)' from MD file, replace {variables}]",
      "solution": "[Copy 'Solution (French)' from MD file, replace {variables}]",
      "ruleData": {
        "monetaryImpact": -98.30,
        "[Copy all fields from MD file 'Example ruleData']": "[Fill with values from CSV]"
      },
      "affectedRecordCount": 2
    },
    {
      "severity": "info",
      "category": "[Same category]",
      "message": "Validation complétée pour [X] enregistrement(s) de codes annuels. [Y] erreur(s) détectée(s).",
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

**Note**: ERROR scenarios usually have **2 results**:
1. The error itself
2. The P-SUMMARY result

---

### OPTIMIZATION Scenario Template (O1, O2, O3...)

```json
{
  "scenarioId": "O1",
  "scenarioName": "[Copy from MD file]",
  "description": "[Copy 'Condition' from MD file]",
  "expectedResults": [
    {
      "severity": "optimization",
      "category": "[Copy from MD file]",
      "message": "[Copy 'Message (French)' from MD file, replace {variables}]",
      "solution": "[Copy 'Solution (French)' from MD file, replace {variables}]",
      "ruleData": {
        "monetaryImpact": 32.10,
        "[Copy all fields from MD file 'Example ruleData']": "[Fill with values from CSV]"
      },
      "affectedRecordCount": 1
    },
    {
      "severity": "info",
      "category": "[Same category]",
      "message": "Validation complétée pour [X] enregistrement(s). [Y] optimisation(s) identifiée(s).",
      "solution": null,
      "ruleData": {
        "monetaryImpact": 32.10,
        "totalRecords": 1,
        "optimizationCount": 1,
        "totalGain": 32.10
      }
    }
  ]
}
```

**Note**: `monetaryImpact` for optimization **MUST be positive** (it's a gain!)

---

## Complete Examples

### Example 1: PASS Scenario (P1)

**CSV File**: `P1-single-billing.csv`
```csv
Facture,ID RAMQ,Date de Service,Code,Patient,Montant payé,Medecin
INV-001,RAMQ-001,2025-03-15,15815,PATIENT-001,49.15,Dr. Smith
```

**JSON File**: `P1-single-billing.expected.json`
```json
{
  "scenarioId": "P1",
  "scenarioName": "Single Billing Per Year",
  "description": "Code annuel facturé une seule fois pour un patient dans l'année civile",
  "expectedResults": [
    {
      "severity": "info",
      "category": "annual_limit",
      "message": "Validation réussie: Code annuel 15815 facturé correctement (1 fois) pour le patient en 2025",
      "solution": null,
      "ruleData": {
        "monetaryImpact": 0,
        "code": "15815",
        "patient": "TEST12345678",
        "year": 2025,
        "totalCount": 1,
        "paidCount": 1,
        "unpaidCount": 0,
        "date": "2025-03-15",
        "amount": 49.15
      },
      "affectedRecordCount": 1
    }
  ]
}
```

---

### Example 2: ERROR Scenario (E1)

**CSV File**: `E1-multiple-paid.csv`

**Note**: Using realistic Quebec CSV format (semicolon delimiter, comma decimals, real NAM structure)

```csv
#;Facture;ID RAMQ;Date de Service;Début;Fin;Periode;Lieu de pratique;Secteur d'activité;Diagnostic;Code;Unités;Rôle;Élément de contexte;Montant Preliminaire;Montant payé;Doctor Info;Patient
1;128357270;15600245854;2025-01-10;00:00;;202520;55489;Aucun Secteur;;15815;0;1;;49,15;49,15;1069491-00000 | Boyadjian, Shogher - Omnipraticien  ;TEST12345678 - TEST, PATIENT A
2;128357315;15600247173;2025-06-15;00:00;;202520;55489;Aucun Secteur;;15815;0;1;;49,15;49,15;1069491-00000 | Boyadjian, Shogher - Omnipraticien  ;TEST12345678 - TEST, PATIENT A
```

**JSON File**: `E1-multiple-paid.expected.json`
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
        "patient": "TEST12345678",
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

### Example 3: OPTIMIZATION Scenario (O1)

**CSV File**: `O1-patient-without-8875.csv`
```csv
Facture,ID RAMQ,Date de Service,Code,Patient,Montant payé,Medecin
INV-001,RAMQ-001,2025-03-15,00103,PATIENT-001,42.50,Dr. Smith
INV-002,RAMQ-002,2025-04-10,00103,PATIENT-001,42.50,Dr. Smith
INV-003,RAMQ-003,2025-05-20,00103,PATIENT-001,42.50,Dr. Smith
```

**JSON File**: `O1-patient-without-8875.expected.json`
```json
{
  "scenarioId": "O1",
  "scenarioName": "Patient Without 8875",
  "description": "Patient inscrit sans forfait 8875 malgré 3+ visites admissibles",
  "expectedResults": [
    {
      "severity": "optimization",
      "category": "gmf_forfait",
      "message": "Optimisation de revenus: Le patient PATIENT-001 pourrait bénéficier du forfait GMF 8875 (3 visites admissibles). Gain potentiel: 128.60$",
      "solution": "Facturez le code 8875 (forfait GMF) au lieu des codes 00103 individuels pour maximiser vos revenus.",
      "ruleData": {
        "monetaryImpact": 128.60,
        "patient": "TEST12345678",
        "currentCodes": ["00103", "00103", "00103"],
        "currentTotal": 127.50,
        "suggestedCode": "8875",
        "suggestedAmount": 256.10,
        "gain": 128.60,
        "visitCount": 3
      },
      "affectedRecordCount": 3
    },
    {
      "severity": "info",
      "category": "gmf_forfait",
      "message": "Validation complétée pour 3 enregistrement(s). 1 optimisation(s) identifiée(s). Gain total possible: 128.60$",
      "solution": null,
      "ruleData": {
        "monetaryImpact": 128.60,
        "totalRecords": 3,
        "optimizationCount": 1,
        "totalGain": 128.60
      }
    }
  ]
}
```

---

## Common Questions

### Q: How many items should be in `expectedResults`?

**A**: Usually 2 items:
1. The main result (pass/error/optimization)
2. The summary result (P-SUMMARY)

PASS scenarios might only have 1 item if it's simple.

---

### Q: What if my CSV has 5 rows but only 2 trigger an error?

**A**: The `affectedRecordCount` would be `2`, and `totalRecords` in the summary would be `5`.

---

### Q: How do I replace `{variables}` in messages?

**A**:
- MD file: `"Code {code} facturé {totalCount} fois"`
- JSON file: `"Code 15815 facturé 2 fois"` (replace with actual values from CSV)

---

### Q: What's the difference between `monetaryImpact` in the error vs summary?

**A**:
- **Error result**: Impact for THIS specific error (e.g., `-98.30` for one duplicate)
- **Summary result**: Total impact across ALL errors (sum of all negative impacts)

---

### Q: Can I omit fields from `ruleData`?

**A**: No - copy ALL fields from the MD file scenario example. Tests verify the complete structure.

---

## JSON Syntax Rules (Important!)

### ✅ Valid JSON
```json
{
  "field": "value",
  "number": 123,
  "array": [1, 2, 3],
  "boolean": true,
  "null": null
}
```

### ❌ Common Mistakes

```json
{
  "field": "value",          // ❌ No trailing comma on last item
  'field': 'value',          // ❌ Must use double quotes, not single
  "field": value,            // ❌ Strings must be quoted
  "field": "O'Connor"        // ✅ Apostrophes inside strings are OK
}
```

### Testing Your JSON

**VS Code**: Install "JSON" extension - it will highlight syntax errors

**Online**: https://jsonlint.com/ - paste your JSON to validate

---

## Quick Checklist

Before committing your `.expected.json` file:

- [ ] `scenarioId` matches MD file scenario (P1, E1, O1)
- [ ] `scenarioName` copied from MD file
- [ ] `description` copied from MD file "Condition"
- [ ] `severity` is `"info"`, `"error"`, or `"optimization"`
- [ ] `category` copied from MD file
- [ ] `message` has {variables} replaced with actual CSV values
- [ ] `solution` is `null` for PASS, text for ERROR/OPTIMIZATION
- [ ] `ruleData` has ALL fields from MD scenario example
- [ ] `monetaryImpact` is a number (not string!)
- [ ] ERROR scenarios have negative or 0 `monetaryImpact`
- [ ] OPTIMIZATION scenarios have positive `monetaryImpact`
- [ ] `expectedResults` array has 1-2 items (main + summary)
- [ ] JSON syntax is valid (no trailing commas, double quotes)

---

## Next Steps

1. Read the scenario in the MD file
2. Create CSV test data matching the condition
3. Copy the appropriate template (PASS/ERROR/OPTIMIZATION)
4. Fill in the values based on your CSV data
5. Validate JSON syntax
6. Run the test!

**You're ready to create expected results files!** 🎉
