# ANNUAL_BILLING_CODE Rule Updates - Quick Start Guide

## What Was Changed?

The ANNUAL_BILLING_CODE validation rule was updated to match the specifications in:
`docs/modules/validateur/rules-implemented/ANNUAL_BILLING_CODE.md`

## Files Created

### 1. Updated Implementation
- **File:** `annualBillingCodeRule_UPDATED.ts`
- **Purpose:** Complete updated rule implementation
- **Action:** Copy to `server/modules/validateur/validation/rules/annualBillingCodeRule.ts`

### 2. Detailed Documentation
- **File:** `ANNUAL_BILLING_CODE_CHANGES_SUMMARY.md`
- **Purpose:** Line-by-line breakdown of all changes
- **Action:** Review for detailed understanding

### 3. Complete Summary
- **File:** `IMPLEMENTATION_COMPLETE_SUMMARY.md`
- **Purpose:** Overview of implementation, testing, and deployment
- **Action:** Read first for quick understanding

### 4. Deployment Scripts
- **Windows:** `apply-annual-billing-updates.bat`
- **Linux/Mac:** `apply-annual-billing-updates.sh`
- **Purpose:** Automated deployment with safety checks
- **Action:** Run from project root directory

## Quick Start (Windows)

### Option 1: Automated (Recommended)
```batch
cd C:\Users\monti\Projects\facnet-validator
apply-annual-billing-updates.bat
```

This will:
1. ✅ Backup original file
2. ✅ Copy updated file
3. ✅ Run TypeScript check
4. ✅ Run all tests
5. ✅ Rollback if any errors occur

### Option 2: Manual
```batch
cd C:\Users\monti\Projects\facnet-validator

REM Backup original
copy server\modules\validateur\validation\rules\annualBillingCodeRule.ts server\modules\validateur\validation\rules\annualBillingCodeRule.ts.backup

REM Apply update
copy annualBillingCodeRule_UPDATED.ts server\modules\validateur\validation\rules\annualBillingCodeRule.ts

REM Test
npm run check
npm test -- annualBillingCode.test.ts
```

## Quick Start (Linux/Mac)

```bash
cd /path/to/facnet-validator
chmod +x apply-annual-billing-updates.sh
./apply-annual-billing-updates.sh
```

## Key Changes Summary

### E1 - Multiple Paid Billings
- ✅ Solution: "Veuillez vérifier si les deux visites ont bien été payées..."
- ✅ Monetary Impact: 0 (was: negative/unknown)

### E2 - One Paid + Unpaid Billings
- ✅ Message: Now includes specific RAMQ IDs
- ✅ Solution: "Veuillez remplacer les factures suivantes {unpaidIdRamqs}..."
- ✅ ruleData: Added paidIdRamq, unpaidIdRamqs
- ✅ Monetary Impact: 0 (unchanged)

### E3 - All Unpaid Billings (CRITICAL)
- ✅ Message: "Le code annuel {code} a été facturé {totalCount} fois..."
- ✅ Solution: "Veuillez valider la raison du refus..."
- ✅ Monetary Impact: **+tariffValue** (was: 0 or negative)
- ✅ Dynamic tariff lookup from database
- ✅ ruleData: Added totalUnpaidAmount, tariffValue

### Infrastructure
- ✅ Added tariff value Map for O(1) lookups
- ✅ Updated leaf patterns to match documentation
- ✅ Scenario-specific ruleData structures

## Verification Steps

After deployment:

1. **Start Dev Server**
   ```bash
   npm run dev
   ```

2. **Test E1 Scenario**
   - Upload CSV with 2 paid billings same code/patient/year
   - Verify message shows "facturé 2 fois et payé 2 fois"
   - Verify solution shows "vérifier si les deux visites"
   - Verify monetaryImpact = 0

3. **Test E2 Scenario**
   - Upload CSV with 1 paid + 2 unpaid same code/patient/year
   - Verify message shows specific RAMQ IDs
   - Verify solution shows "remplacer les factures suivantes"
   - Verify monetaryImpact = 0

4. **Test E3 Scenario**
   - Upload CSV with 3 unpaid billings same code/patient/year
   - Verify message shows "toutes les factures sont impayées"
   - Verify solution shows "valider la raison du refus"
   - **Verify monetaryImpact = +49.15 (or appropriate tariff value)**

## Rollback Procedure

If issues occur:

### Using Backup
```batch
copy server\modules\validateur\validation\rules\annualBillingCodeRule.ts.backup server\modules\validateur\validation\rules\annualBillingCodeRule.ts
```

### Using Git
```bash
git checkout server/modules/validateur/validation/rules/annualBillingCodeRule.ts
```

## Testing

All existing tests already expect the new behavior:

```bash
# Run specific test file
npm test -- annualBillingCode.test.ts

# Run all validation tests
npm test -- validation-rules

# Run with UI
npm run test:ui
```

## Documentation Reference

### Primary Documentation
- **Rule Spec:** `docs/modules/validateur/rules-implemented/ANNUAL_BILLING_CODE.md`
- **Changes:** `ANNUAL_BILLING_CODE_CHANGES_SUMMARY.md`
- **Summary:** `IMPLEMENTATION_COMPLETE_SUMMARY.md`

### Test Files
- **Tests:** `tests/validation-rules/annualBillingCode.test.ts`
- **Test Data:** `tests/validation-rules/test-data/annual-billing-code/`

### Implementation
- **Original:** `server/modules/validateur/validation/rules/annualBillingCodeRule.ts`
- **Updated:** `annualBillingCodeRule_UPDATED.ts`
- **Backup:** `server/modules/validateur/validation/rules/annualBillingCodeRule.ts.backup`

## Production Deployment

Once verified in dev:

```bash
# Commit changes
git add server/modules/validateur/validation/rules/annualBillingCodeRule.ts
git commit -m "feat(validation): update ANNUAL_BILLING_CODE rule per documentation

- E1: Update solution message, set monetaryImpact to 0
- E2: Add specific RAMQ IDs to message, update solution
- E3: Set positive monetaryImpact (+tariffValue), update messages
- Add dynamic tariff value lookup from database
- Update leaf patterns to match documentation"

# Push to main (triggers GitHub Actions deployment)
git push origin main
```

## Support

If you encounter issues:

1. Check `IMPLEMENTATION_COMPLETE_SUMMARY.md` for troubleshooting
2. Review test output for specific failures
3. Verify database has codes with correct leaf patterns
4. Check browser console for runtime errors
5. Verify PostgreSQL connection and tariffValue column

## Questions?

Common questions answered in:
- `ANNUAL_BILLING_CODE_CHANGES_SUMMARY.md` - What changed?
- `IMPLEMENTATION_COMPLETE_SUMMARY.md` - Why changed?
- `docs/modules/validateur/rules-implemented/ANNUAL_BILLING_CODE.md` - What should it do?

---

**Status:** ✅ Ready for Deployment
**Date:** 2025-10-21
**Agent:** Claude (Quebec Healthcare Billing Validation Expert)
