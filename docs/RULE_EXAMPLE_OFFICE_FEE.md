# Example Rule: Office Fee Validation (Frais de Bureau)

This is a complete example showing how to fill out the rule template.

---

## Rule Information

**Rule Name (French)**: `Frais de bureau (19928/19929)`

**Rule ID**: `OFFICE_FEE_19928_19929`

**Rule Type**: `office_fee_validation` (custom type)

**Severity**: `error`

**Category**: `office_fees`

---

## Rule Logic Description

### What This Rule Validates:
```
This rule validates daily office fee maximums for Quebec billing codes
19928 and 19929. Each code has different patient count requirements
and thresholds based on whether patients are registered or walk-in.

The rule also enforces:
1. Codes can only be billed in cabinet (not établissement)
2. Daily maximum of $64.80 per doctor
3. Different thresholds for registered vs walk-in patients
4. Walk-in patients must have context codes G160 or AR
```

### When Should This Trigger?
```
Trigger when:
1. Code 19928 billed with <6 registered patients (minimum requirement)
2. Code 19928 billed with >10 walk-in patients (maximum allowed)
3. Code 19929 billed with <12 registered patients (minimum requirement)
4. Code 19929 billed with >20 walk-in patients (maximum allowed)
5. Daily total for doctor exceeds $64.80
6. Codes billed in établissement instead of cabinet
7. Walk-in patient missing G160 or AR context code
```

### When Should This NOT Trigger?
```
Should NOT trigger when:
1. Code 19928 with 6-10 patients (within limits)
2. Code 19929 with 12-20 patients (within limits)
3. Daily total ≤ $64.80
4. Billed in cabinet (establishment code 5XXXX)
5. Walk-in patients have proper context codes
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

### Time Periods:
```javascript
period: "daily"
periodStart: "00:00"
periodEnd: "23:59"
```

---

## Error Messages (French)

### Scenario 1: Not Enough Registered Patients (Code 19928)
```
Message: "Code 19928 exige un minimum de 6 patients inscrits. Actuellement: 3 patients inscrits."

Solution: "Changez le code 19929 pour 19928 ou corrigez les visites non payées"
```

### Scenario 2: Not Enough Registered Patients (Code 19929)
```
Message: "Code 19929 exige un minimum de 12 patients inscrits. Actuellement: 8 patients inscrits."

Solution: "Veuillez annuler la demande ou corrigez les visites non payées"
```

### Scenario 3: Too Many Walk-In Patients
```
Message: "Code 19928 permet maximum 10 patients sans RDV. Actuellement: 12 patients sans RDV alors que le code exige la présence de contexte #G160 ou #AR."

Solution: "Réduisez le nombre de patients sans rendez-vous ou vérifiez les contextes"
```

### Scenario 4: Daily Maximum Exceeded
```
Message: "Le maximum quotidien de 64.80$ pour les frais de bureau a été dépassé pour ce médecin"

Solution: "Réduisez le nombre de factures ou annulez certaines demandes"
```

### Scenario 5: Wrong Location
```
Message: "Les codes 19928 et 19929 peuvent seulement être facturés en cabinet"

Solution: "Changez le lieu de pratique ou utilisez un code différent"
```

---

## Test Scenarios

### Pass Scenario 1: Valid Code 19928
```
Description: Code 19928 with exactly 6 registered patients
Test Data:
- Doctor: DR-001
- Date: 2025-01-06
- Code: 19928
- 6 patients inscrits (paid)
- 0 patients sans RDV
- Establishment: 50001 (cabinet)
Expected: No error
```

### Pass Scenario 2: Valid Code 19929
```
Description: Code 19929 with 12 registered and 5 walk-in
Test Data:
- Doctor: DR-001
- Date: 2025-01-06
- Code: 19929
- 12 patients inscrits (paid)
- 5 patients sans RDV with G160 context
- Establishment: 50001 (cabinet)
Expected: No error
```

### Fail Scenario 1: Not Enough Patients (19928)
```
Description: Code 19928 with only 3 registered patients
Test Data:
- Doctor: DR-001
- Date: 2025-01-06
- Code: 19928
- 3 patients inscrits (paid)
- 2 patients inscrits (NOT paid)
- Establishment: 50001 (cabinet)
Expected: Error - "Code 19928 exige un minimum de 6 patients inscrits. Actuellement: 3 patients inscrits."
Solution: "Changez le code 19929 pour 19928 ou corrigez les visites non payées"
```

### Fail Scenario 2: Too Many Walk-In (19928)
```
Description: Code 19928 with 12 walk-in patients (max 10)
Test Data:
- Doctor: DR-001
- Date: 2025-01-06
- Code: 19928
- 6 patients inscrits
- 12 patients sans RDV with G160
Expected: Error - "Code 19928 permet maximum 10 patients sans RDV"
```

### Fail Scenario 3: Wrong Establishment
```
Description: Code 19928 billed in établissement
Test Data:
- Code: 19928
- Establishment: 20001 (établissement, starts with 2XXXX)
Expected: Error - "Les codes 19928 et 19929 peuvent seulement être facturés en cabinet"
```

### Fail Scenario 4: Daily Maximum Exceeded
```
Description: Multiple doctors hitting daily limit
Test Data:
- Doctor: DR-001
- Date: 2025-01-06
- 10 billings of 19928 @ $6.48 = $64.80
- 1 additional billing = $71.28 (exceeds limit)
Expected: Error - "Le maximum quotidien de 64.80$ a été dépassé"
```

### Edge Case Scenarios:
```
1. Patient with no montantPaye (NULL or 0)
   Expected: Treated as unpaid, doesn't count toward minimum

2. Mixed paid/unpaid patients
   Expected: Only paid patients count toward thresholds

3. Walk-in patient missing G160/AR context
   Expected: Still counts but gets separate error about missing context

4. Same patient multiple visits same day
   Expected: Each visit counts separately toward totals
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
- contexts table: To validate G160/AR requirements
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

## Examples from Real Data

### Example CSV Input (Scenario 5 from test file):
```csv
#,Facture,ID RAMQ,Date de Service,Lieu de pratique,Code,Unités,Élement de contexte,Montant Preliminaire,Montant payé,Doctor Info,Patient
1,F1,R1,2025-01-06,50001,19929,1,G160,3.24,3.24,DR-001,P1
2,F2,R2,2025-01-06,50001,19929,1,G160,3.24,3.24,DR-001,P2
3,F3,R3,2025-01-06,50001,19929,1,G160,3.24,3.24,DR-001,P3
4,F4,R4,2025-01-06,50001,19929,1,G160,3.24,3.24,DR-001,P4
5,F5,R5,2025-01-06,50001,19929,1,G160,3.24,3.24,DR-001,P5
6,F6,R6,2025-01-06,50001,19929,1,G160,3.24,3.24,DR-001,P6
7,F7,R7,2025-01-06,50001,19929,1,G160,3.24,3.24,DR-001,P7
8,F8,R8,2025-01-06,50001,19929,1,G160,3.24,3.24,DR-001,P8
```

### Expected Validation Output:
```json
{
  "severity": "error",
  "category": "office_fees",
  "message": "Code 19929 exige un minimum de 12 patients inscrits. Actuellement: 0 patients inscrits.",
  "solution": "Veuillez annuler la demande ou corrigez les visites non payées",
  "ruleData": {
    "code": "19929",
    "date": "2025-01-06",
    "doctor": "DR-001",
    "registeredPaidCount": 0,
    "walkInPaidCount": 8,
    "required": 12,
    "actual": 0
  }
}
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
