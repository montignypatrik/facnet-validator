# ANNUAL_BILLING_CODE Rule Implementation Changes

## File Modified
`C:\Users\monti\Projects\facnet-validator\server\modules\validateur\validation\rules\annualBillingCodeRule.ts`

## Summary of Changes

Based on the updated documentation in `docs/modules/validateur/rules-implemented/ANNUAL_BILLING_CODE.md`, the following changes need to be implemented:

### 1. Update Leaf Patterns (Lines 35-40)

**OLD:**
```typescript
    // Hardcoded leaf patterns for annual billing codes
    // These are the categories of codes that can only be billed once per year
    const leafPatterns = [
      "04 - Examen annuel complet",
      // Add more leaf patterns as needed based on RAMQ regulations
    ];
```

**NEW:**
```typescript
    // Leaf patterns for annual billing codes
    // These are the categories of codes that can only be billed once per year
    const leafPatterns = [
      "Visite de prise en charge",
      "Visite périodique"
    ];
```

### 2. Add Tariff Value Map (After line 51)

**ADD AFTER LINE 51:**
```typescript
    // Create a map for quick tariff value lookup
    const codeTariffMap = new Map<string, number>();
    allCodes.data.forEach(code => {
      if (code.tariffValue) {
        codeTariffMap.set(code.code, Number(code.tariffValue));
      }
    });
```

### 3. Update E1 Scenario - Multiple Paid Billings (Lines 105-109)

**Changes:**
- Update solution message
- Set monetaryImpact to 0
- Add comprehensive ruleData fields

**OLD:**
```typescript
      if (paidCount > 1) {
        // CRITICAL: Multiple paid billings for same annual code
        message = `Code annuel ${code} facturé ${totalCount} fois et payé ${paidCount} fois pour le même patient en ${year}. Maximum: 1 par an.`;
        solution = `Contactez la RAMQ pour corriger les paiements multiples. Ce code ne peut être payé qu'une fois par année civile.`;
        severity = "error";
      }
```

**NEW:**
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
          // ... existing fields
        };
      }
```

### 4. Update E2 Scenario - One Paid + Unpaid Billings (Lines 110-114)

**Changes:**
- Update message to include specific ID RAMQ
- Update solution message
- Add paidIdRamq and unpaidIdRamqs to ruleData

**OLD:**
```typescript
      } else if (paidCount === 1 && unpaidCount > 0) {
        // One paid, others unpaid - suggest deleting unpaid
        message = `Code annuel ${code} facturé ${totalCount} fois en ${year}. Un est payé, ${unpaidCount} ${unpaidCount === 1 ? 'reste' : 'restent'} non ${unpaidCount === 1 ? 'payé' : 'payés'}.`;
        solution = `Veuillez supprimer ${unpaidCount === 1 ? 'la facture non payée' : `les ${unpaidCount} factures non payées`}. Ce code ne peut être facturé qu'une fois par année civile.`;
        severity = "warning";
      }
```

**NEW:**
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
          // ... existing fields
        };
      }
```

### 5. Update E3 Scenario - All Unpaid Billings (Lines 115-120)

**Changes:**
- Update message and solution
- **CRITICAL**: Change monetaryImpact to POSITIVE (+tariffValue)
- Query tariff_value dynamically from codes table
- Add totalUnpaidAmount and tariffValue to ruleData

**OLD:**
```typescript
      } else {
        // All unpaid - suggest keeping only one
        message = `Code annuel ${code} facturé ${totalCount} fois en ${year}, tous non payés.`;
        solution = `Veuillez supprimer ${totalCount - 1} des factures et n'en garder qu'une seule. Ce code ne peut être facturé qu'une fois par année civile.`;
        severity = "warning";
      }
```

**NEW:**
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
          // ... existing fields
        };
      }
```

### 6. Update ruleData Structure (Lines 135-147)

**Change:**
The ruleData object needs to be created separately for each scenario (E1, E2, E3) instead of having a single generic structure at the end.

**OLD:**
```typescript
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

**NEW:**
```typescript
      // Get tariff value for this code
      const tariffValue = codeTariffMap.get(code) || 0;

      // Generate appropriate error message, solution, and monetary impact
      let message: string;
      let solution: string;
      let monetaryImpact: number;
      let severity: "error" | "warning" = "error";
      let ruleData: Record<string, any>;

      // ... E1, E2, E3 scenarios create their own ruleData ...

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

### 7. Update File Documentation Header (Lines 5-25)

**OLD:**
```typescript
/**
 * Annual Billing Code Validation Rule
 *
 * Codes identified by leaf field that can only be billed once per calendar year.
 * Provides smart guidance based on paid/unpaid status.
 *
 * Key Features:
 * - Queries database for codes matching specific leaf patterns (e.g., "04 - Examen annuel complet")
 * - Groups billing by patient and calendar year
 * - Distinguishes between paid and unpaid duplicate billings
 * - Provides context-aware solutions based on payment status
 *
 * Business Rules:
 * - If multiple paid billings: CRITICAL ERROR → Contact RAMQ
 * - If 1 paid + unpaid billings: WARNING → Delete unpaid billings
 * - If all unpaid billings: WARNING → Keep only one, delete others
 *
 * References:
 * - Rule spec: docs/modules/validateur/rules-implemented/ANNUAL_BILLING_CODE.md
 * - Leaf patterns: Defined in codes table
 */
```

**NEW:**
```typescript
/**
 * Annual Billing Code Validation Rule
 *
 * Codes identified by leaf field that can only be billed once per calendar year.
 * Provides smart guidance based on paid/unpaid status.
 *
 * Key Features:
 * - Queries database for codes matching specific leaf patterns (e.g., "Visite de prise en charge", "Visite périodique")
 * - Groups billing by patient and calendar year
 * - Distinguishes between paid and unpaid duplicate billings
 * - Provides context-aware solutions based on payment status
 *
 * Business Rules:
 * - E1 - Multiple paid billings: ERROR → Verify both visits were paid, replace one if needed (monetaryImpact: 0)
 * - E2 - One paid + unpaid billings: ERROR → Replace unpaid billings (monetaryImpact: 0)
 * - E3 - All unpaid billings: ERROR → Validate rejection reason, correct remaining requests (monetaryImpact: +tariffValue)
 *
 * References:
 * - Rule spec: docs/modules/validateur/rules-implemented/ANNUAL_BILLING_CODE.md
 * - Leaf patterns: Defined in codes table
 */
```

## Key Implementation Details

### Tariff Value Lookup
- Query from `codes` table dynamically (do NOT hardcode)
- Create a Map for efficient lookup: `codeTariffMap.get(code)`
- Field name in database: `tariffValue` (numeric)

### Monetary Impact Logic
- **E1 (Multiple Paid)**: `0` - Cannot calculate, depends on replacement code
- **E2 (One Paid + Unpaid)**: `0` - Unpaid billings can be removed before submission
- **E3 (All Unpaid)**: `+tariffValue` - Minimum revenue gain (at least 1 billing will be paid)

### Severity
- All three scenarios (E1, E2, E3) should be `"error"` severity (not "warning")

### ruleData Fields by Scenario

**E1 (Multiple Paid):**
- monetaryImpact, code, patient, year
- totalCount, paidCount, unpaidCount
- dates, amounts, totalPaidAmount
- patientYear, leafPattern, ramqIds
- paidRecordIds, unpaidRecordIds

**E2 (One Paid + Unpaid):**
- monetaryImpact, code, patient, year
- totalCount, paidCount, unpaidCount
- paidIdRamq, paidDate, paidAmount
- unpaidIdRamqs, unpaidDates, unpaidAmounts
- patientYear, leafPattern, ramqIds
- paidRecordIds, unpaidRecordIds

**E3 (All Unpaid):**
- monetaryImpact, code, patient, year
- totalCount, paidCount, unpaidCount
- dates, amounts
- totalUnpaidAmount, tariffValue
- patientYear, leafPattern, ramqIds
- paidRecordIds, unpaidRecordIds

## Testing Requirements

After implementing these changes:

1. Test E1 scenario with 2+ paid billings
2. Test E2 scenario with 1 paid + multiple unpaid
3. Test E3 scenario with all unpaid billings
4. Verify monetaryImpact calculations match specification
5. Verify all ruleData fields are populated correctly
6. Verify French error messages match documentation exactly

## Questions/Issues

None encountered. All changes are well-defined in the documentation.
