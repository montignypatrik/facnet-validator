@echo off
REM Script to apply ANNUAL_BILLING_CODE rule updates
REM Run this from the project root directory

echo =========================================
echo ANNUAL_BILLING_CODE Rule Update Script
echo =========================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo X Error: Not in project root directory
    echo Please run this script from: C:\Users\monti\Projects\facnet-validator
    pause
    exit /b 1
)

REM Check if updated file exists
if not exist "annualBillingCodeRule_UPDATED.ts" (
    echo X Error: Updated file not found
    echo Missing: annualBillingCodeRule_UPDATED.ts
    pause
    exit /b 1
)

REM Backup original file
set ORIGINAL_FILE=server\modules\validateur\validation\rules\annualBillingCodeRule.ts
set BACKUP_FILE=server\modules\validateur\validation\rules\annualBillingCodeRule.ts.backup

echo Step 1: Backing up original file...
copy "%ORIGINAL_FILE%" "%BACKUP_FILE%" > nul
echo V Backup created: %BACKUP_FILE%
echo.

REM Copy updated file
echo Step 2: Applying updates...
copy annualBillingCodeRule_UPDATED.ts "%ORIGINAL_FILE%" > nul
echo V Updated file copied to: %ORIGINAL_FILE%
echo.

REM Run TypeScript type check
echo Step 3: Running TypeScript type check...
call npm run check
if errorlevel 1 (
    echo X TypeScript errors detected!
    echo Restoring backup...
    copy "%BACKUP_FILE%" "%ORIGINAL_FILE%" > nul
    echo ! Update rolled back. Please review errors.
    pause
    exit /b 1
)
echo V TypeScript check passed
echo.

REM Run tests
echo Step 4: Running validation tests...
call npm test -- annualBillingCode.test.ts
if errorlevel 1 (
    echo X Tests failed!
    echo Restoring backup...
    copy "%BACKUP_FILE%" "%ORIGINAL_FILE%" > nul
    echo ! Update rolled back. Please review test failures.
    pause
    exit /b 1
)
echo V All tests passed
echo.

REM Success
echo =========================================
echo V UPDATE COMPLETE!
echo =========================================
echo.
echo Changes applied:
echo   - Updated leaf patterns
echo   - Added tariff value lookup
echo   - E1: Updated solution message, monetaryImpact = 0
echo   - E2: Added specific RAMQ IDs, monetaryImpact = 0
echo   - E3: Positive monetaryImpact (+tariffValue)
echo.
echo Backup available at: %BACKUP_FILE%
echo.
echo Next steps:
echo   1. Test in dev environment: npm run dev
echo   2. Upload test CSV files
echo   3. Verify error messages and monetary impacts
echo   4. Commit and push to main branch for deployment
echo.
echo To rollback:
echo   copy %BACKUP_FILE% %ORIGINAL_FILE%
echo.
pause
