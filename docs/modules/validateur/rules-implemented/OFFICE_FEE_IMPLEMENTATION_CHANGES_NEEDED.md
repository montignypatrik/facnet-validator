# Office Fee Validation Rule - Required Changes

**File**: `D:\Projects\facnet-validator\server\modules\validateur\validation\rules\officeFeeRule.ts`
**Current Lines**: 765
**Status**: Implementation incomplete - requires updates

---

## CRITICAL BUG FOUND

**Line 153-154**: Eligibility determination using wrong counts

```typescript
// WRONG (current implementation):
const registeredEligible = determineEligibility(registeredCount, 'registered');
const walkInEligible = determineEligibility(walkInCount, 'walkIn');

// CORRECT (should be):
const registeredEligible = determineEligibility(registeredPaidCount, 'registered');
const walkInEligible = determineEligibility(walkInPaidCount, 'walkIn');
```

**Impact**: This bug causes incorrect eligibility calculations because unpaid patients are included in the count. According to spec, only PAID patients should count toward thresholds.

**Priority**: FIX IMMEDIATELY

---

## Required Changes

### 1. Fix Critical Bug (Line 153-154)

**Current Code:**
```typescript
  const registeredEligible = determineEligibility(registeredCount, 'registered');
  const walkInEligible = determineEligibility(walkInCount, 'walkIn');
```

**Change To:**
```typescript
  const registeredEligible = determineEligibility(registeredPaidCount, 'registered');
  const walkInEligible = determineEligibility(walkInPaidCount, 'walkIn');
```

---

### 2. Move Establishment Check (Lines 177-203)

**Current**: E6 scenario ID used for establishment check
**Problem**: E6 should be "Strategic Maximum Exceeded - Keep 19929 Walk-In" per spec

**Action**: Change scenario ID from "E6" to "ESTABLISHMENT_ERROR"

**Current Code (Line 191):**
```typescript
          scenarioId: "E6",
```

**Change To:**
```typescript
          scenarioId: "ESTABLISHMENT_ERROR",
```

**Note**: Keep the check logic, just rename the scenario ID

---

###3. Update E5/E6/E8 Logic (Lines 354-405)

**Current**: E5 handles ALL daily maximum exceeded cases
**Problem**: Need strategic differentiation for E6 and E8

**Replace Lines 354-405 With:**

```typescript
  // E5, E6, E8: Check daily maximum ($64.80) with strategic recommendations
  if (dayData.totalAmount > 64.80) {
    const affectedIds = dayData.officeFees.map(fee => fee.id).filter(id => id !== null) as string[];
    const excessAmount = dayData.totalAmount - 64.80;
    const redactedDoctor = redactDoctorName(dayData.doctor);

    // E6: Strategic Maximum Exceeded - Should Keep 19929 Walk-In
    if (billed19928Registered && billed19929WalkIn) {
      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: null,
        severity: "error",
        category: "office_fees",
        message: `Le maximum quotidien de 64,80$ pour les frais de bureau a été dépassé pour ${redactedDoctor} le ${dayData.date}. Total facturé: ${formatCurrency(dayData.totalAmount)} (19928 inscrits + 19929 sans RDV)`,
        solution: `Annulez le 19928 inscrits et gardez seulement le 19929 sans RDV pour maximiser le remboursement`,
        affectedRecords: affectedIds,
        ruleData: {
          scenarioId: "E6",
          doctor: redactedDoctor,
          date: dayData.date,
          totalAmount: dayData.totalAmount,
          dailyMaximum: 64.80,
          excessAmount: excessAmount,
          billingCount: dayData.officeFees.length,
          codes: ["19928", "19929"],
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount,
          monetaryImpact: -32.40
        }
      });
    }
    // E8: Strategic Maximum Exceeded - Should Keep 19929 Registered
    else if (billed19929Registered && billed19928WalkIn) {
      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: null,
        severity: "error",
        category: "office_fees",
        message: `Le maximum quotidien de 64,80$ pour les frais de bureau a été dépassé pour ${redactedDoctor} le ${dayData.date}. Total facturé: ${formatCurrency(dayData.totalAmount)} (19929 inscrits + 19928 sans RDV)`,
        solution: `Annulez le 19928 sans RDV et gardez seulement le 19929 inscrits pour maximiser le remboursement`,
        affectedRecords: affectedIds,
        ruleData: {
          scenarioId: "E8",
          doctor: redactedDoctor,
          date: dayData.date,
          totalAmount: dayData.totalAmount,
          dailyMaximum: 64.80,
          excessAmount: excessAmount,
          billingCount: dayData.officeFees.length,
          codes: ["19929", "19928"],
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount,
          monetaryImpact: -32.40
        }
      });
    }
    // E5: Generic daily maximum exceeded
    else {
      const affectedRamqIds = dayData.officeFees
        .map(fee => fee.idRamq)
        .filter((id, index, self) => id && self.indexOf(id) === index) as string[];

      const feeBreakdownWithPatients = dayData.officeFees.map(fee => ({
        code: fee.code || 'Unknown',
        amount: parseFloat(fee.montantPreliminaire || '0'),
        idRamq: fee.idRamq || 'Unknown',
        paid: fee.montantPaye ? parseFloat(fee.montantPaye.toString()) : 0
      }));

      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: null,
        severity: "error",
        category: "office_fees",
        message: `Le maximum quotidien de 64,80$ pour les frais de bureau a été dépassé pour ${redactedDoctor} le ${dayData.date}. Total facturé: ${formatCurrency(dayData.totalAmount)}`,
        solution: `Veuillez annuler un des frais de bureau pour respecter le maximum quotidien`,
        affectedRecords: affectedIds,
        ruleData: {
          scenarioId: "E5",
          doctor: redactedDoctor,
          date: dayData.date,
          totalAmount: dayData.totalAmount,
          dailyMaximum: 64.80,
          excessAmount: excessAmount,
          billingCount: dayData.officeFees.length,
          affectedRamqIds,
          feeBreakdownWithPatients,
          monetaryImpact: 0,
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount
        }
      });
    }
  }
```

---

### 4. Add O6 Optimization (After Line 591)

**Location**: After O5 scenario, before PASS scenarios section
**Condition**: Only one 19928 walk-in billed, registered patients qualify (6-11)

**Insert After Line 591:**

```typescript
  }

  // O6: Could Add Second Billing - Registered Available (Strategic)
  if (dayData.totalAmount === 32.40 && dayData.officeFees.length === 1) {
    if (billed19928WalkIn && registeredPaidCount >= 6 && registeredPaidCount < 12) {
      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: null,
        severity: "optimization",
        category: "office_fees",
        message: `Vous avez aussi vu ${registeredPaidCount} patients inscrits et vous pourriez facturer un autre 19928 pour atteindre le maximum quotidien de 64,80$`,
        solution: `Ajoutez un deuxième 19928 pour les patients inscrits (gain: 32,40$)`,
        affectedRecords: [],
        ruleData: {
          scenarioId: "O6",
          monetaryImpact: 32.40,
          currentCode: "19928",
          currentAmount: 32.40,
          expectedAmount: 64.80,
          registeredPaidCount,
          walkInPaidCount,
          doctor: redactDoctorName(dayData.doctor),
          date: dayData.date
        }
      });
    }
  }

  // ===== PASS SCENARIOS (successful validations) =====
```

---

### 5. Add P7-P11 Strategic PASS Scenarios

**Location**: Within code === "19929" section, after P4 check
**Replace**: The current P3 simple check needs enhancement for strategic scenarios

**Find (around Line 701):**
```typescript
          } else if (!hasContext && registeredPaidCount >= 12) {
            // P3: Valid 19929 - Registered Patients
            results.push({
              ...
            });
          }
```

**Replace With:**
```typescript
          } else if (!hasContext && registeredPaidCount >= 12) {
            // Check for strategic scenarios first
            if (registeredPaidCount >= 12 && walkInPaidCount >= 20) {
              // P7, P8, P9: Optimal Mixed Billing - Both Groups Qualify
              if (billed19929Registered && !billed19929WalkIn) {
                // P7: Optimal Mixed Billing - Code 19929 (Registered)
                results.push({
                  validationRunId,
                  ruleId: "office-fee-validation",
                  billingRecordId: officeFee.id,
                  severity: "info",
                  category: "office_fees",
                  message: `Facturation optimale: Code 19929 facturé avec ${registeredPaidCount} patients inscrits. Maximum quotidien atteint: ${formatCurrency(dayData.totalAmount)}`,
                  affectedRecords: [officeFee.id].filter((id): id is string => id !== null),
                  ruleData: {
                    scenarioId: "P7",
                    monetaryImpact: 0,
                    code: "19929",
                    registeredPaidCount,
                    walkInPaidCount,
                    totalAmount: dayData.totalAmount,
                    doctor: redactDoctorName(dayData.doctor),
                    date: dayData.date,
                    registeredUnpaidCount,
                    walkInUnpaidCount
                  }
                });
              } else if (billed19929WalkIn && !billed19929Registered) {
                // P8: Optimal Mixed Billing - Code 19929 (Walk-In)
                results.push({
                  validationRunId,
                  ruleId: "office-fee-validation",
                  billingRecordId: officeFee.id,
                  severity: "info",
                  category: "office_fees",
                  message: `Facturation optimale: Code 19929 facturé avec ${walkInPaidCount} patients sans rendez-vous. Maximum quotidien atteint: ${formatCurrency(dayData.totalAmount)}`,
                  affectedRecords: [officeFee.id].filter((id): id is string => id !== null),
                  ruleData: {
                    scenarioId: "P8",
                    monetaryImpact: 0,
                    code: "19929",
                    walkInPaidCount,
                    registeredPaidCount,
                    totalAmount: dayData.totalAmount,
                    doctor: redactDoctorName(dayData.doctor),
                    date: dayData.date,
                    registeredUnpaidCount,
                    walkInUnpaidCount
                  }
                });
              } else {
                // P9: Strategic Choice - Both Groups Qualify
                results.push({
                  validationRunId,
                  ruleId: "office-fee-validation",
                  billingRecordId: officeFee.id,
                  severity: "info",
                  category: "office_fees",
                  message: `Facturation optimale: Code 19929 facturé (groupe choisi). Les deux groupes qualifient mais vous ne pouvez choisir qu'un seul. Maximum quotidien atteint: ${formatCurrency(dayData.totalAmount)}`,
                  affectedRecords: [officeFee.id].filter((id): id is string => id !== null),
                  ruleData: {
                    scenarioId: "P9",
                    monetaryImpact: 0,
                    code: "19929",
                    registeredPaidCount,
                    walkInPaidCount,
                    totalAmount: dayData.totalAmount,
                    doctor: redactDoctorName(dayData.doctor),
                    date: dayData.date,
                    registeredUnpaidCount,
                    walkInUnpaidCount
                  }
                });
              }
            } else if (walkInPaidCount >= 20 && registeredPaidCount < 12) {
              // P10: Strategic Billing - 19929 Walk-In Only
              results.push({
                validationRunId,
                ruleId: "office-fee-validation",
                billingRecordId: officeFee.id,
                severity: "info",
                category: "office_fees",
                message: `Facturation optimale: Code 19929 facturé avec ${walkInPaidCount} patients sans rendez-vous. Maximum quotidien atteint: ${formatCurrency(dayData.totalAmount)}`,
                affectedRecords: [officeFee.id].filter((id): id is string => id !== null),
                ruleData: {
                  scenarioId: "P10",
                  monetaryImpact: 0,
                  code: "19929",
                  walkInPaidCount,
                  registeredPaidCount,
                  totalAmount: dayData.totalAmount,
                  doctor: redactDoctorName(dayData.doctor),
                  date: dayData.date,
                  registeredUnpaidCount,
                  walkInUnpaidCount
                }
              });
            } else if (registeredPaidCount >= 12 && walkInPaidCount < 20) {
              // P11: Strategic Billing - 19929 Registered Only (also covers P3)
              results.push({
                validationRunId,
                ruleId: "office-fee-validation",
                billingRecordId: officeFee.id,
                severity: "info",
                category: "office_fees",
                message: `Facturation optimale: Code 19929 facturé avec ${registeredPaidCount} patients inscrits. Maximum quotidien atteint: ${formatCurrency(dayData.totalAmount)}`,
                affectedRecords: [officeFee.id].filter((id): id is string => id !== null),
                ruleData: {
                  scenarioId: dayData.totalAmount >= 64.80 ? "P11" : "P3",
                  monetaryImpact: 0,
                  code: "19929",
                  registeredPaidCount,
                  walkInPaidCount,
                  totalAmount: dayData.totalAmount,
                  doctor: redactDoctorName(dayData.doctor),
                  date: dayData.date,
                  registeredUnpaidCount,
                  walkInUnpaidCount
                }
              });
            } else {
              // P3: Valid 19929 - Registered Patients (basic case)
              results.push({
                validationRunId,
                ruleId: "office-fee-validation",
                billingRecordId: officeFee.id,
                severity: "info",
                category: "office_fees",
                message: `Validation réussie: Code 19929 facturé correctement avec ${registeredPaidCount} patients inscrits (minimum: 12). Montant: ${formatCurrency(Number(officeFee.montantPreliminaire || 0))}`,
                affectedRecords: [officeFee.id].filter((id): id is string => id !== null),
                ruleData: {
                  scenarioId: "P3",
                  monetaryImpact: 0,
                  code: "19929",
                  registeredPaidCount,
                  totalAmount: Number(officeFee.montantPreliminaire || 0),
                  doctor: redactDoctorName(dayData.doctor),
                  date: dayData.date,
                  registeredUnpaidCount,
                  walkInPaidCount,
                  walkInUnpaidCount
                }
              });
            }
          }
```

---

## Summary of Changes

| Change | Lines | Priority | Type |
|--------|-------|----------|------|
| Fix eligibility bug | 153-154 | CRITICAL | Bug Fix |
| Rename E6 to ESTABLISHMENT_ERROR | 191 | High | Refactor |
| Add E6/E8 strategic scenarios | 354-405 | High | Feature |
| Add O6 optimization | After 591 | Medium | Feature |
| Add P7-P11 strategic PASS | ~701-725 | Medium | Feature |

---

## Testing After Changes

Run these tests to verify:

1. **Eligibility Bug Fix**: Verify unpaid patients don't count toward thresholds
2. **E6 Scenario**: 19928 registered + 19929 walk-in exceeding max → recommends canceling 19928
3. **E8 Scenario**: 19929 registered + 19928 walk-in exceeding max → recommends canceling 19928
4. **O6 Scenario**: Single 19928 walk-in with 6-11 registered → suggests adding 19928
5. **P7-P11 Scenarios**: All strategic optimal billing scenarios trigger correctly

---

## File Locations

- **Implementation File**: `server/modules/validateur/validation/rules/officeFeeRule.ts`
- **Specification**: `docs/modules/validateur/rules-implemented/OFFICE_FEE_19928_19929_UPDATED.md`
- **Test CSV**: `server/modules/validateur/validation/rules/__tests__/fixtures/office_fee_scenarios.csv`

---

## Next Steps

1. Apply changes to `officeFeeRule.ts`
2. Run TypeScript type checking: `npm run check`
3. Trigger validation-tester agent to generate test suite
4. Run tests: `npm test`
5. Review results with validation-debugger if failures occur
6. Perform impact analysis with rule-analyzer before deployment

---

**Status**: READY FOR IMPLEMENTATION
**Estimated Time**: 30-45 minutes
**Risk Level**: LOW (well-defined changes, existing tests will catch regressions)
