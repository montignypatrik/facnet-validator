# Integration Tests

## Overview

Integration tests validate the complete CSV processing pipeline using real Quebec healthcare billing data. These tests ensure that field mappings, data parsing, and validation logic work correctly with production-like data.

## Test Suites

### CSV Processing Integration Tests

**File**: `csv-processing.test.ts`
**Status**: ✅ All 12 tests passing
**Test Data**: `examples/sample_billing.csv` (174 real Quebec billing records)

#### What's Tested

1. **CSV File Processing** (2 tests)
   - ✅ Successfully parses real Quebec billing CSV with delimiter detection
   - ✅ Correctly maps CSV headers to database field names

2. **Data Type Parsing** (3 tests)
   - ✅ Parses Quebec amount format (comma as decimal separator: "49,15" → 49.15)
   - ✅ Parses billing codes (numeric and alphanumeric: "15650", "15643A")
   - ✅ Parses time fields in HH:MM format

3. **Field Handling** (3 tests)
   - ✅ Handles context elements (empty or filled)
   - ✅ Parses hospital sector data correctly
   - ✅ Handles single or multiple context values

4. **Data Integrity** (2 tests)
   - ✅ Correctly assigns validation run ID to all records
   - ✅ Assigns sequential record numbers

5. **Schema Validation** (2 tests) 🔥 **CRITICAL**
   - ✅ Matches exact database schema field names (lieuPratique, secteurActivite, elementContexte)
   - ✅ Does NOT use incorrect camelCase names (lieuDePratique ❌, secteurDActivite ❌)

## Key Findings

### Critical Field Name Fix

**Issue Discovered**: Test-writer agent originally created fixtures with incorrect field names.

**Wrong Field Names** (would fail in production):
```typescript
lieuDePratique    ❌ // Incorrect - extra capital D
secteurDActivite  ❌ // Incorrect - extra capital D
elementDeContexte ❌ // Incorrect - extra capital D
```

**Correct Field Names** (matches database schema):
```typescript
lieuPratique      ✅ // Correct - matches shared/schema.ts
secteurActivite   ✅ // Correct - matches shared/schema.ts
elementContexte   ✅ // Correct - matches shared/schema.ts
```

**User Contribution**: User questioned test fixture accuracy, leading to discovery of this critical bug. Tests passed with wrong names because they only validated against themselves, not against real CSV processing.

### CSV Encoding Improvement

**Problem**: CSV files with accented characters (é, à, ô) were being read with corrupted encoding.

**Solution**: Updated `csvProcessor.ts` to explicitly use UTF-8 encoding:
```typescript
fs.createReadStream(filePath, { encoding: 'utf8' })
```

**Impact**: Ensures proper parsing of French Quebec healthcare data with accents.

### Test Data Selection

**Initial Attempt**: Used `data/samples/Facturation journalière (12).csv`
**Issue**: Encoding corruption made headers unreadable

**Final Solution**: Used `examples/sample_billing.csv`
**Advantage**: Clean encoding, 174 real records, comprehensive test coverage

## Running Integration Tests

```bash
# Run all integration tests
npm test -- tests/integration/

# Run specific integration test file
npm test -- tests/integration/csv-processing.test.ts

# Run with coverage
npm test -- tests/integration/ --coverage

# Run in watch mode
npm test -- tests/integration/ --watch
```

## Test Coverage Impact

Integration tests validate:
- ✅ Real CSV parsing logic (`csvProcessor.ts`)
- ✅ Field mapping to database schema (`shared/schema.ts`)
- ✅ Quebec-specific data formats (comma decimals, French headers)
- ✅ Delimiter detection (semicolon vs comma)
- ✅ Error handling for missing/null fields

## Next Steps

1. **Add More Integration Tests**:
   - Validation rule execution on real CSV data
   - Database insertion with billing records
   - End-to-end validation pipeline (upload → parse → validate → results)

2. **Test Different CSV Formats**:
   - Empty files
   - Files with errors
   - Files with invalid data types
   - Files with missing required columns

3. **Performance Testing**:
   - Large CSV files (10,000+ records)
   - Memory usage during processing
   - Concurrent file processing

## Lessons Learned

1. **User Questioning is Critical**: User asking "does the agent know what the real data will look like?" exposed a fundamental flaw in test fixtures.

2. **Schema Validation Required**: Tests must validate against actual database schema, not just self-referential fixtures.

3. **Real Data Matters**: Using production-like CSV files catches issues that synthetic test data misses.

4. **Encoding is Important**: Explicit UTF-8 encoding is essential for Quebec French healthcare data.

## Test Results Summary

**Total Tests**: 12
**Passed**: 12 ✅
**Failed**: 0 ❌
**Duration**: ~250ms
**Coverage**: CSV processing, field mapping, data type parsing, schema validation
