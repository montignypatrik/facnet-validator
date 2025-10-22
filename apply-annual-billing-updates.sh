#!/bin/bash

# Script to apply ANNUAL_BILLING_CODE rule updates
# Run this from the project root directory

echo "========================================="
echo "ANNUAL_BILLING_CODE Rule Update Script"
echo "========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Not in project root directory"
    echo "Please run this script from: C:\Users\monti\Projects\facnet-validator"
    exit 1
fi

# Check if updated file exists
if [ ! -f "annualBillingCodeRule_UPDATED.ts" ]; then
    echo "❌ Error: Updated file not found"
    echo "Missing: annualBillingCodeRule_UPDATED.ts"
    exit 1
fi

# Backup original file
ORIGINAL_FILE="server/modules/validateur/validation/rules/annualBillingCodeRule.ts"
BACKUP_FILE="server/modules/validateur/validation/rules/annualBillingCodeRule.ts.backup"

echo "📋 Step 1: Backing up original file..."
cp "$ORIGINAL_FILE" "$BACKUP_FILE"
echo "✅ Backup created: $BACKUP_FILE"
echo ""

# Copy updated file
echo "📋 Step 2: Applying updates..."
cp annualBillingCodeRule_UPDATED.ts "$ORIGINAL_FILE"
echo "✅ Updated file copied to: $ORIGINAL_FILE"
echo ""

# Run TypeScript type check
echo "📋 Step 3: Running TypeScript type check..."
npm run check
if [ $? -ne 0 ]; then
    echo "❌ TypeScript errors detected!"
    echo "Restoring backup..."
    cp "$BACKUP_FILE" "$ORIGINAL_FILE"
    echo "⚠️  Update rolled back. Please review errors."
    exit 1
fi
echo "✅ TypeScript check passed"
echo ""

# Run tests
echo "📋 Step 4: Running validation tests..."
npm test -- annualBillingCode.test.ts
if [ $? -ne 0 ]; then
    echo "❌ Tests failed!"
    echo "Restoring backup..."
    cp "$BACKUP_FILE" "$ORIGINAL_FILE"
    echo "⚠️  Update rolled back. Please review test failures."
    exit 1
fi
echo "✅ All tests passed"
echo ""

# Success
echo "========================================="
echo "✅ UPDATE COMPLETE!"
echo "========================================="
echo ""
echo "Changes applied:"
echo "  - Updated leaf patterns"
echo "  - Added tariff value lookup"
echo "  - E1: Updated solution message, monetaryImpact = 0"
echo "  - E2: Added specific RAMQ IDs, monetaryImpact = 0"
echo "  - E3: Positive monetaryImpact (+tariffValue)"
echo ""
echo "Backup available at: $BACKUP_FILE"
echo ""
echo "Next steps:"
echo "  1. Test in dev environment: npm run dev"
echo "  2. Upload test CSV files"
echo "  3. Verify error messages and monetary impacts"
echo "  4. Commit and push to main branch for deployment"
echo ""
echo "To rollback:"
echo "  cp $BACKUP_FILE $ORIGINAL_FILE"
echo ""
