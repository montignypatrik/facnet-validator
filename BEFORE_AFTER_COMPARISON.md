# ANNUAL_BILLING_CODE Rule - Before/After Code Comparison

## Overview
This document shows side-by-side comparison of key changes made to the ANNUAL_BILLING_CODE validation rule.

---

## 1. Leaf Patterns

### ❌ BEFORE
```typescript
// Hardcoded leaf patterns for annual billing codes
// These are the categories of codes that can only be billed once per year
const leafPatterns = [
  "04 - Examen annuel complet",
  // Add more leaf patterns as needed based on RAMQ regulations
];
```

### ✅ AFTER
```typescript
// Leaf patterns for annual billing codes
// These are the categories of codes that can only be billed once per year
const leafPatterns = [
  "Visite de prise en charge",
  "Visite périodique"
];
```

**Reason:** Match updated documentation specification

---

## 2. Tariff Value Lookup (NEW)

### ❌ BEFORE
```typescript
// No tariff value lookup - relied on hardcoded or missing values
```

### ✅ AFTER
```typescript
// Create a map for quick tariff value lookup
const codeTariffMap = new Map<string, number>();
allCodes.data.forEach(code => {
  if (code.tariffValue) {
    codeTariffMap.set(code.code, Number(code.tariffValue));
  }
});

// Later in code:
const tariffValue = codeTariffMap.get(code) || 0;
```

**Reason:** Enable dynamic monetary impact calculation for E3 scenario

---

## 3. E1 Scenario - Multiple Paid Billings

### ❌ BEFORE
```typescript
if (paidCount > 1) {
  // CRITICAL: Multiple paid billings for same annual code
  message = `Code annuel ${code} facturé ${totalCount} fois et payé ${paidCount} fois pour le même patient en ${year}. Maximum: 1 par an.`;
  solution = `Contactez la RAMQ pour corriger les paiements multiples. Ce code ne peut être payé qu'une fois par année civile.`;
  severity = "error";
}

// Generic ruleData at end...
```

### ✅ AFTER
```typescript
if (paidCount > 1) {
  // E1: Multiple paid billings for same annual code
  const dates = paidRecords.map(r => r.dateService?.toISOString().split('T')[0] || '');
  const amounts = paidRecords.map(r => Number(r.montantPaye || 0));
  const totalPaidAmount = amounts.reduce((sum, amt) => sum + amt, 0);

  message = `Code annuel ${code} facturé ${totalCount} fois et payé ${paidCount} fois pour le même patient en ${year}. Maximum: 1 par an.`;
  solution = `Veuillez vérifier si les deux visites ont bien été payées. Si oui, remplacez l'une d'entre elles par une visite conforme au besoin.`;
  monetaryImpact = 0; // Cannot calculate - depends on replacement code
  severity = "error";

  ruleData = {
    monetaryImpact: 0,
    code,
    patient,
    year,
    totalCount,
    paidCount,
    unpaidCount,
    dates,
    amounts,
    totalPaidAmount,
    // ... other fields
  };
}
```

**Changes:**
- ✅ Solution message updated to be more actionable
- ✅ Explicit monetaryImpact = 0
- ✅ Added dates, amounts, totalPaidAmount to ruleData

---

## 4. E2 Scenario - One Paid + Unpaid Billings

### ❌ BEFORE
```typescript
} else if (paidCount === 1 && unpaidCount > 0) {
  // One paid, others unpaid - suggest deleting unpaid
  message = `Code annuel ${code} facturé ${totalCount} fois en ${year}. Un est payé, ${unpaidCount} ${unpaidCount === 1 ? 'reste' : 'restent'} non ${unpaidCount === 1 ? 'payé' : 'payés'}.`;
  solution = `Veuillez supprimer ${unpaidCount === 1 ? 'la facture non payée' : `les ${unpaidCount} factures non payées`}. Ce code ne peut être facturé qu'une fois par année civile.`;
  severity = "warning";
}

// Generic ruleData at end...
```

### ✅ AFTER
```typescript
} else if (paidCount === 1 && unpaidCount > 0) {
  // E2: One paid, others unpaid
  const paidRecord = paidRecords[0];
  const paidIdRamq = paidRecord.idRamq || '';
  const paidDate = paidRecord.dateService?.toISOString().split('T')[0] || '';
  const paidAmount = Number(paidRecord.montantPaye || 0);

  const unpaidIdRamqs = unpaidRecords.map(r => r.idRamq).filter(Boolean) as string[];
  const unpaidDates = unpaidRecords.map(r => r.dateService?.toISOString().split('T')[0] || '');
  const unpaidAmounts = unpaidRecords.map(r => Number(r.montantPaye || 0));

  message = `Code annuel ${code} facturé ${totalCount} fois en ${year}. La facture ${paidIdRamq} est payée, mais les factures ${unpaidIdRamqs.join(', ')} restent non payées.`;
  solution = `Veuillez remplacer les factures suivantes ${unpaidIdRamqs.join(', ')} pour qu'elles soient conformes. Ce code ne peut être facturé qu'une fois par année civile.`;
  monetaryImpact = 0; // Unpaid billings can be removed before submission
  severity = "error";

  ruleData = {
    monetaryImpact: 0,
    code,
    patient,
    year,
    totalCount,
    paidCount,
    unpaidCount,
    paidIdRamq,
    paidDate,
    paidAmount,
    unpaidIdRamqs,
    unpaidDates,
    unpaidAmounts,
    // ... other fields
  };
}
```

**Changes:**
- ✅ Message now includes specific RAMQ IDs
- ✅ Solution references specific unpaid invoice IDs
- ✅ Severity changed from "warning" to "error"
- ✅ Added paidIdRamq, unpaidIdRamqs to ruleData
- ✅ Explicit monetaryImpact = 0

---

## 5. E3 Scenario - All Unpaid Billings (CRITICAL CHANGE)

### ❌ BEFORE
```typescript
} else {
  // All unpaid - suggest keeping only one
  message = `Code annuel ${code} facturé ${totalCount} fois en ${year}, tous non payés.`;
  solution = `Veuillez supprimer ${totalCount - 1} des factures et n'en garder qu'une seule. Ce code ne peut être facturé qu'une fois par année civile.`;
  severity = "warning";
}

// Generic ruleData at end (no monetaryImpact or tariffValue)
```

### ✅ AFTER
```typescript
} else {
  // E3: All unpaid billings
  const dates = unpaidRecords.map(r => r.dateService?.toISOString().split('T')[0] || '');
  const amounts = unpaidRecords.map(r => Number(r.montantPaye || 0));
  const totalUnpaidAmount = totalCount * tariffValue; // Total potential value if all were paid

  message = `Le code annuel ${code} a été facturé ${totalCount} fois en ${year}, toutes les factures sont impayées.`;
  solution = `Veuillez valider la raison du refus et corriger les demandes restantes pour que le tout soit conforme.`;
  monetaryImpact = tariffValue; // Minimum revenue gain - at least 1 billing will be paid
  severity = "error";

  ruleData = {
    monetaryImpact: tariffValue,
    code,
    patient,
    year,
    totalCount,
    paidCount,
    unpaidCount,
    dates,
    amounts,
    totalUnpaidAmount,
    tariffValue,
    // ... other fields
  };
}
```

**Changes:**
- ✅ Message updated to be more descriptive
- ✅ Solution focuses on validating rejection reason
- ✅ **CRITICAL:** monetaryImpact changed from 0 to +tariffValue
- ✅ Severity changed from "warning" to "error"
- ✅ Added totalUnpaidAmount and tariffValue to ruleData
- ✅ Uses dynamic tariff lookup from database

**Monetary Impact Logic:**
```
BEFORE: monetaryImpact = 0 (or undefined)
AFTER:  monetaryImpact = +49.15 (for code 15815)

Calculation:
- Current revenue: $0 (all unpaid)
- After correction: At least 1 billing will be paid = +tariffValue
- Net impact: POSITIVE GAIN
```

---

## 6. ruleData Structure

### ❌ BEFORE
```typescript
// Single generic ruleData for all scenarios
results.push({
  validationRunId,
  ruleId: "ANNUAL_BILLING_CODE",
  billingRecordId: patientRecords[0]?.id || null,
  idRamq: ramqIds.join(', ') || null,
  severity,
  category: "annual_limit",
  message,
  solution,
  affectedRecords: patientRecords.map(r => r.id).filter(Boolean) as string[],
  ruleData: {
    patientYear: key,
    patient,
    year,
    code,
    totalCount,
    paidCount,
    unpaidCount,
    leafPattern: allCodes.data.find(c => c.code === code)?.leaf || null,
    ramqIds,
    paidRecordIds: paidRecords.map(r => r.id).filter(Boolean) as string[],
    unpaidRecordIds: unpaidRecords.map(r => r.id).filter(Boolean) as string[]
  }
});
```

### ✅ AFTER
```typescript
// Scenario-specific ruleData created in each if/else block
// E1, E2, E3 each create custom ruleData

// Variables declared before scenarios:
let message: string;
let solution: string;
let monetaryImpact: number;
let severity: "error" | "warning" = "error";
let ruleData: Record<string, any>;

// ... E1, E2, E3 scenarios populate these variables ...

// Single push at the end with populated variables
results.push({
  validationRunId,
  ruleId: "ANNUAL_BILLING_CODE",
  billingRecordId: patientRecords[0]?.id || null,
  idRamq: ramqIds.join(', ') || null,
  severity,
  category: "annual_limit",
  message,
  solution,
  affectedRecords: patientRecords.map(r => r.id).filter(Boolean) as string[],
  ruleData
});
```

**Changes:**
- ✅ Each scenario creates scenario-specific ruleData
- ✅ E1 includes: dates, amounts, totalPaidAmount
- ✅ E2 includes: paidIdRamq, unpaidIdRamqs, dates, amounts
- ✅ E3 includes: totalUnpaidAmount, tariffValue
- ✅ All include monetaryImpact as first field

---

## Summary of Impact

### Error Messages
| Scenario | Before | After |
|----------|--------|-------|
| E1 | Generic "Contact RAMQ" | Actionable "Verify both paid, replace one" |
| E2 | Generic "delete unpaid" | Specific RAMQ IDs referenced |
| E3 | "Delete N-1 invoices" | "Validate rejection reason" |

### Monetary Impact
| Scenario | Before | After | Change |
|----------|--------|-------|--------|
| E1 | undefined/0 | 0 | ✅ Explicit |
| E2 | undefined/0 | 0 | ✅ Explicit |
| E3 | 0 | **+tariffValue** | ✅ POSITIVE |

### Severity
| Scenario | Before | After |
|----------|--------|-------|
| E1 | error | error |
| E2 | warning | **error** |
| E3 | warning | **error** |

### Database Integration
- **BEFORE:** No tariff value lookup
- **AFTER:** Dynamic lookup from `codes.tariffValue` field

### User Experience
- **BEFORE:** Generic error messages
- **AFTER:** Specific invoice IDs, actionable solutions, accurate revenue impact

---

## Testing Alignment

All test cases already expect the NEW behavior:

```typescript
// Test for E1
expect(results[0].solution).toContain('Veuillez vérifier si les deux visites');
expect(results[0].ruleData?.monetaryImpact).toBe(0);

// Test for E2
expect(results[0].message).toContain('RAMQ-001');
expect(results[0].solution).toContain('Veuillez remplacer');
expect(results[0].ruleData?.monetaryImpact).toBe(0);

// Test for E3
expect(results[0].solution).toContain('Veuillez valider la raison du refus');
expect(results[0].ruleData?.monetaryImpact).toBe(49.15); // ✅ POSITIVE
```

---

**Conclusion:** All changes align with documentation and existing tests. Implementation is production-ready.
