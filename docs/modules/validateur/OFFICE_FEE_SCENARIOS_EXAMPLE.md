# Office Fee Validation - Complete Scenario Example

This document shows the **new scenario-based specification** for the Office Fee rule.
Use this as a reference when creating new rules.

---

## Rule Information

**Rule Name (French)**: `Frais de bureau (19928/19929)`

**Rule ID**: `OFFICE_FEE_19928_19929`

**Rule Type**: `office_fee_validation` (custom type)

**Severity**: Mixed (info, error, optimization depending on scenario)

**Category**: `office_fees`

---

## Rule Logic Description

### What This Rule Validates:
```
This rule validates daily office fee maximums for Quebec billing codes
19928 and 19929. Each code has different patient count requirements
and thresholds based on whether patients are registered or walk-in.

The rule enforces:
1. Codes can only be billed in cabinet (not établissement)
2. Daily maximum of $64.80 per doctor
3. Different thresholds for registered vs walk-in patients
4. Walk-in patients must have context codes G160 or AR
```

---

## Target Data

### Target Billing Codes:
```javascript
codes: ["19928", "19929"]
```

### Required Context Elements:
```javascript
walkInContexts: ["G160", "AR"]  // Sans rendez-vous contexts
```

### Establishment Restrictions:
```javascript
allowedEstablishments: ["cabinet"]  // Codes starting with 5XXXX
excludedEstablishments: ["établissement", "urgence"]
```

---

## Thresholds & Limits

### Daily Maximum:
```javascript
dailyMaximum: 64.80  // Maximum dollars per doctor per day
```

### Patient Count Requirements:
```javascript
code19928: {
  registeredMinimum: 6,   // Minimum patients inscrits
  walkInMaximum: 10,      // Maximum patients sans RDV
  tariff: 6.48           // Per-patient amount
}

code19929: {
  registeredMinimum: 12,  // Minimum patients inscrits
  walkInMaximum: 20,      // Maximum patients sans RDV
  tariff: 3.24           // Per-patient amount
}
```

---

## Validation Scenarios & Expected Results

> **Purpose:** This section defines ALL possible outcomes of the office fee validation rule.
> Each scenario specifies the exact message users will see and how results should be displayed.
>
> **Naming Convention:**
> - P1, P2, P3... = PASS scenarios (severity: info)
> - E1, E2, E3... = ERROR scenarios (severity: error)
> - O1, O2, O3... = OPTIMIZATION scenarios (severity: optimization)

### ✅ PASS Scenarios (Severity: info)

These scenarios represent successful validation. Results should be **collapsed by default**
but expandable to show validation details.

---

#### Scenario P1: Valid Code 19928 - Registered Patients

**Condition:** Code 19928 billed with 6-10 registered patients (paid), in cabinet

**Message (French):**
```
"Validation réussie: Code 19928 facturé correctement avec {registeredPaidCount} patients inscrits (minimum: 6). Montant: {totalAmount}$"
```

**Solution (French):** `null`

**Monetary Impact:** `0`

**Display Configuration:**
- **Collapsed by default:** Yes
- **Show when expanded:**
  - [X] Visit statistics grid
  - [ ] Billing details box
  - [ ] Temporal information box
  - [ ] Comparison box
- **Custom data fields to display:** `code, registeredPaidCount, totalAmount, date, doctor`

**Test Case Reference:** `test-P1`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "code": "19928",
  "registeredPaidCount": 8,
  "registeredUnpaidCount": 0,
  "walkInPaidCount": 0,
  "walkInUnpaidCount": 0,
  "totalAmount": 51.84,
  "doctor": "Dr. M***",
  "date": "2025-01-06"
}
```

---

#### Scenario P2: Valid Code 19929 - Mixed Patients

**Condition:** Code 19929 billed with 12+ registered patients (paid), optional walk-ins with G160/AR

**Message (French):**
```
"Validation réussie: Code 19929 facturé correctement avec {registeredPaidCount} patients inscrits et {walkInPaidCount} patients sans rendez-vous (minimum: 12 inscrits). Montant: {totalAmount}$"
```

**Solution (French):** `null`

**Monetary Impact:** `0`

**Display Configuration:**
- **Collapsed by default:** Yes
- **Show when expanded:**
  - [X] Visit statistics grid
- **Custom data fields to display:** `code, registeredPaidCount, walkInPaidCount, totalAmount, date, doctor`

**Test Case Reference:** `test-P2`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "code": "19929",
  "registeredPaidCount": 12,
  "registeredUnpaidCount": 0,
  "walkInPaidCount": 5,
  "walkInUnpaidCount": 0,
  "totalAmount": 55.08,
  "doctor": "Dr. M***",
  "date": "2025-01-06"
}
```

---

### ❌ FAIL Scenarios - Errors (Severity: error)

These scenarios represent regulation violations that **must be fixed**.
Results should be **always visible, expanded by default**.

---

#### Scenario E1: Insufficient Registered Patients (19928)

**Condition:** Code 19928 billed with <6 paid registered patients

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
- `-{totalAmount}` if billings already paid (revenue at risk)

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

---

#### Scenario E2: Insufficient Registered Patients (19929)

**Condition:** Code 19929 billed with <12 paid registered patients

**Message (French):**
```
"Code 19929 exige minimum 12 patients inscrits mais seulement {registeredPaidCount} trouvé(s) pour {doctor} le {date}"
```

**Solution (French):**
```
"Veuillez annuler la demande ou corrigez les {registeredUnpaidCount} visite(s) non payée(s)"
```

**Monetary Impact:** `0` (typically unpaid)

**Display Configuration:**
- **Collapsed by default:** No (always expanded)
- **Always show:**
  - [X] Error message
  - [X] Solution box (highlighted)
- **Show in details:**
  - [X] Billing details box
  - [X] Visit statistics grid
- **Custom data fields to display:** `code, required, actual, registeredPaidCount, registeredUnpaidCount, doctor, date`

**Test Case Reference:** `test-E2`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "code": "19929",
  "required": 12,
  "actual": 8,
  "registeredPaidCount": 0,
  "registeredUnpaidCount": 0,
  "walkInPaidCount": 8,
  "walkInUnpaidCount": 0,
  "totalAmount": 25.92,
  "doctor": "Dr. M***",
  "date": "2025-01-06"
}
```

---

#### Scenario E3: Too Many Walk-In Patients (19928)

**Condition:** Code 19928 billed with >10 walk-in patients (with G160/AR context)

**Message (French):**
```
"Code 19928 permet maximum 10 patients sans RDV mais {walkInPaidCount} trouvé(s) pour {doctor} le {date}"
```

**Solution (French):**
```
"Réduisez le nombre de patients sans rendez-vous ou vérifiez les contextes"
```

**Monetary Impact:** `0`

**Display Configuration:**
- **Collapsed by default:** No
- **Always show:**
  - [X] Error message
  - [X] Solution box
- **Show in details:**
  - [X] Visit statistics grid
- **Custom data fields to display:** `code, walkInPaidCount, maximum, doctor, date`

**Test Case Reference:** `test-E3`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "code": "19928",
  "walkInPaidCount": 12,
  "maximum": 10,
  "registeredPaidCount": 6,
  "totalAmount": 77.76,
  "doctor": "Dr. M***",
  "date": "2025-01-06"
}
```

---

#### Scenario E4: Daily Maximum Exceeded

**Condition:** Total office fees for doctor exceed $64.80 in a single day

**Message (French):**
```
"Le maximum quotidien de 64,80$ pour les frais de bureau a été dépassé pour {doctor} le {date}. Total facturé: {totalAmount}$"
```

**Solution (French):**
```
"Réduisez le nombre de factures ou annulez certaines demandes pour respecter le maximum de 64,80$/jour"
```

**Monetary Impact:** `0` or `-{excessAmount}`

**Display Configuration:**
- **Collapsed by default:** No
- **Always show:**
  - [X] Error message
  - [X] Solution box
- **Show in details:**
  - [X] Billing details box
  - [X] Visit statistics grid
- **Custom data fields to display:** `totalAmount, dailyMaximum, excessAmount, billingCount, doctor, date`

**Test Case Reference:** `test-E4`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "totalAmount": 71.28,
  "dailyMaximum": 64.80,
  "excessAmount": 6.48,
  "billingCount": 11,
  "doctor": "Dr. M***",
  "date": "2025-01-06"
}
```

---

### 💡 FAIL Scenarios - Optimizations (Severity: optimization)

These scenarios represent **missed revenue opportunities**.
Results should be **always visible, highlighted with gain amount**.

---

#### Scenario O1: Could Use Higher Code (19928 → 19929)

**Condition:** Code 19928 billed but doctor has 12+ registered patients (qualifies for 19929 which pays more)

**Message (French):**
```
"Optimisation de revenus: {doctor} a vu {registeredPaidCount} patients inscrits le {date} et a facturé 19928 ({currentAmount}$), mais pourrait facturer 19929 ({expectedAmount}$)"
```

**Solution (French):**
```
"Facturer 19929 au lieu de 19928 pour un gain de {gain}$"
```

**Monetary Impact:** `{gain}` (positive number, expectedAmount - currentAmount)

**Display Configuration:**
- **Collapsed by default:** No (always expanded)
- **Always show:**
  - [X] Optimization message
  - [X] Solution box (highlighted in amber)
  - [X] Monetary gain badge (prominent)
- **Show in details:**
  - [X] Comparison box (19928 vs 19929)
  - [X] Visit statistics grid
- **Custom data fields to display:** `currentCode, suggestedCode, currentAmount, expectedAmount, monetaryImpact, registeredPaidCount, doctor, date`

**Test Case Reference:** `test-O1`

**Example ruleData:**
```json
{
  "monetaryImpact": 32.10,
  "currentCode": "19928",
  "suggestedCode": "19929",
  "currentAmount": 32.10,
  "expectedAmount": 64.20,
  "registeredPaidCount": 15,
  "registeredUnpaidCount": 0,
  "walkInPaidCount": 0,
  "walkInUnpaidCount": 0,
  "doctor": "Dr. M***",
  "date": "2025-01-06"
}
```

---

#### Scenario O2: Daily Maximum Not Reached

**Condition:** Doctor has capacity for more office fees without exceeding $64.80 limit

**Message (French):**
```
"Opportunité de revenus: {doctor} a facturé {totalAmount}$ le {date} et pourrait facturer jusqu'à {availableAmount}$ supplémentaire avant d'atteindre le maximum de 64,80$"
```

**Solution (French):**
```
"Ajoutez {additionalBillings} facturation(s) de 19928 ou 19929 pour maximiser les revenus"
```

**Monetary Impact:** `{availableAmount}` (positive number)

**Display Configuration:**
- **Collapsed by default:** No
- **Always show:**
  - [X] Optimization message
  - [X] Solution box
  - [X] Monetary gain badge
- **Show in details:**
  - [X] Billing details box
- **Custom data fields to display:** `totalAmount, dailyMaximum, availableAmount, additionalBillings, doctor, date`

**Test Case Reference:** `test-O2`

**Example ruleData:**
```json
{
  "monetaryImpact": 32.40,
  "totalAmount": 32.40,
  "dailyMaximum": 64.80,
  "availableAmount": 32.40,
  "additionalBillings": 5,
  "currentBillingCount": 5,
  "doctor": "Dr. M***",
  "date": "2025-01-06"
}
```

---

### 📊 Summary Scenario (Always Include)

Every rule should include a summary info scenario at the end of validation.

---

#### Scenario P-SUMMARY: Validation Complete

**Condition:** End of validation run for all office fee records

**Message (French):**
```
"Validation frais de bureau complétée: {totalRecords} enregistrement(s) traité(s), {errorCount} erreur(s), {optimizationCount} opportunité(s)"
```

**Solution (French):** `null`

**Monetary Impact:** `0` or total amount processed

**Display Configuration:**
- **Collapsed by default:** Yes
- **Show when expanded:**
  - [X] Summary statistics

**Test Case Reference:** `test-summary`

**Example ruleData:**
```json
{
  "monetaryImpact": 0,
  "totalRecords": 150,
  "errorCount": 3,
  "optimizationCount": 2,
  "infoCount": 1,
  "totalAmount": 486.00
}
```

---

## Additional Requirements

### Special Validation Logic:
```javascript
// Paid vs unpaid detection
isPaid = (record.montantPaye > 0)

// Registered vs walk-in detection
isWalkIn = record.elementContexte.includes("G160") || record.elementContexte.includes("AR")

// Establishment type detection
isCabinet = record.lieuPratique.startsWith("5")

// Grouping
groupBy: doctor + date (daily validation per doctor)
```

### Dependencies on Other Tables:
```
- establishments table: To verify cabinet vs établissement
- contexts table: To validate G160/AR requirements (optional)
- codes table: Not required (codes hardcoded)
```

### Performance Considerations:
```
This rule processes every billing record and groups by doctor+date.
For a file with 10,000 records and 50 doctors:
- 50 doctor-day groups to validate
- ~200 records per group average
- Executes in <100ms

No special optimization needed.
```

---

## Implementation Priority

**Priority**: `High`

**Estimated Complexity**: `Complex`
- Custom grouping by doctor+date
- Multiple validation criteria
- Different thresholds per code
- Paid/unpaid detection
- Context validation

**Business Impact**:
```
Critical - Office fees represent ~30% of monthly billing revenue ($15K-20K).
RAMQ frequently rejects these claims for threshold violations.
Last month: 23 rejections totaling $1,247 in lost revenue.

Implementing this rule prevents rejection and saves ~2 hours/week
of manual claim review.
```

---

## Notes & Clarifications

```
Context codes G160 and AR indicate "sans rendez-vous" (walk-in) visits.
These are common in walk-in clinics and emergency situations.

The 19929 code is designed for high-volume practices with many registered
patients (12+ per day), while 19928 is for smaller practices (6+ per day).

Cabinet establishments are identified by codes starting with "5" (50001-59999).
Établissement codes start with "2" (20001-29999).
Urgence codes start with "3" (30001-39999).

Daily maximum of $64.80 = 10 billings of 19928 ($6.48) or 20 billings of
19929 ($3.24), ensuring fair compensation while preventing over-billing.
```

---

## Approval & Sign-off

**Requested By**: Dr. Martin (Medical Director)
**Date Requested**: 2024-12-15
**Approved By**: Finance Department
**Implementation Deadline**: 2025-01-15
**Status**: ✅ Implemented and tested (2025-01-06)

---

## Test Coverage Matrix

| Scenario ID | Description | Test File | Status |
|-------------|-------------|-----------|--------|
| P1 | Valid 19928 - Registered | `test-P1` | ✅ |
| P2 | Valid 19929 - Mixed | `test-P2` | ✅ |
| E1 | Insufficient Patients (19928) | `test-E1` | ✅ |
| E2 | Insufficient Patients (19929) | `test-E2` | ✅ |
| E3 | Too Many Walk-Ins (19928) | `test-E3` | ✅ |
| E4 | Daily Maximum Exceeded | `test-E4` | ✅ |
| O1 | Could Use 19929 | `test-O1` | ✅ |
| O2 | Daily Maximum Not Reached | `test-O2` | ✅ |
| P-SUMMARY | Validation Complete | `test-summary` | ✅ |

**Coverage**: 9/9 scenarios (100%)
