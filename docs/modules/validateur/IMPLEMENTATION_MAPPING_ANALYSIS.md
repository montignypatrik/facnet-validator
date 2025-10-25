# Implementation Mapping Analysis: Office Fee Rule

## Purpose
This document maps the current TypeScript implementation to the documented scenarios to identify gaps and required updates.

## Scenario Comparison

### ✅ PASS Scenarios (Info Severity)

| Scenario ID | Description | In Docs? | In Code? | Notes |
|------------|-------------|----------|----------|-------|
| P1 | Valid 19928 registered (6-10 patients) | ✅ | ❌ | Need to add |
| P2 | Valid 19928 walk-in (10-20 patients) | ✅ | ❌ | Need to add |
| P3 | Valid 19929 registered (12+ patients) | ✅ | ❌ | Need to add |
| P4 | Valid 19929 walk-in (20+ patients) | ✅ | ❌ | Need to add |
| P5 | Valid double billing within maximum | ✅ | ❌ | Need to add |
| P6 | Valid cabinet location | ✅ | ❌ | Need to add |

**Status:** 0/6 implemented. All PASS scenarios need to be added.

### ❌ ERROR Scenarios (Error Severity)

| Scenario ID | Description | In Docs? | In Code? | Code Location | Notes |
|------------|-------------|----------|----------|---------------|-------|
| E1 | Insufficient registered patients for 19928 (<6) | ✅ | ✅ | Lines 179-212 | ✅ Matches |
| E2 | Insufficient walk-in patients for 19928 (<10) | ✅ | ✅ | Lines 149-176 | ✅ Matches (code calls this E3) |
| E3 | Insufficient registered patients for 19929 (<12) | ✅ | ✅ | Lines 247-280 | ✅ Matches (code calls this E2) |
| E4 | Insufficient walk-in patients for 19929 (<20) | ✅ | ✅ | Lines 217-244 | ✅ Matches |
| E5 | Daily maximum exceeded (>$64.80) | ✅ | ⚠️ | Lines 286-373 | Uses "warning" severity sometimes, should be "error" |
| E6 | Invalid hospital location | ✅ | ❌ | - | Need to add |
| E7 | Mixed double billing - both insufficient | ✅ | ❌ | - | Need to add |

**Status:** 4/7 implemented (E1-E4), 1 needs fix (E5), 2 missing (E6-E7).

### 💡 OPTIMIZATION Scenarios (Optimization Severity)

| Scenario ID | Description | In Docs? | In Code? | Code Location | Notes |
|------------|-------------|----------|----------|---------------|-------|
| O1 | Upgrade 19928 → 19929 (registered) | ✅ | ✅ | Lines 410-442 | ✅ Matches (code calls this O3) |
| O2 | Upgrade 19928 → 19929 (walk-in) | ✅ | ✅ | Lines 512-545 | ✅ Matches (code calls this O6) |
| O3 | Add second 19928 (registered billed, walk-in available) | ✅ | ❌ | - | Need to add |
| O4 | Add second 19928 (walk-in billed, registered available) | ✅ | ❌ | - | Need to add |
| O5 | Mixed double - upgrade but would exceed max | ✅ | ❌ | - | Need to add |

**Status:** 2/5 implemented (O1-O2), 3 missing (O3-O5).

**Extra optimizations in code (not in docs):**
- Code O1 (lines 444-475): Could bill 19928 registered but didn't → **Remove or document**
- Code O2 (lines 379-409): Could bill 19929 registered but didn't → **Remove or document**
- Code O4 (lines 547-579): Could bill 19928 walk-in but didn't → **Remove or document**
- Code O5 (lines 480-511): Could bill 19929 walk-in but didn't → **Remove or document**
- Code O7 (lines 584-613): Missing context for 19928 → **Remove or document**
- Code O8 (lines 614-644): Missing context for 19929 → **Remove or document**

### 📊 SUMMARY Scenario

| Scenario ID | Description | In Docs? | In Code? | Notes |
|------------|-------------|----------|----------|-------|
| P-SUMMARY | Validation complete summary | ✅ | ❌ | Need to add |

**Status:** 0/1 implemented.

## Implementation Gaps Summary

### Must Add (11 scenarios):
1. **PASS scenarios (6):** P1, P2, P3, P4, P5, P6
2. **ERROR scenarios (2):** E6, E7
3. **OPTIMIZATION scenarios (3):** O3, O4, O5
4. **SUMMARY scenario (1):** P-SUMMARY

### Must Fix (1 scenario):
1. **E5:** Change severity from "warning" to "error" (always)

### Must Decide (6 extra scenarios in code):
These are in the code but not documented:
- Code O1: "Could bill 19928 registered but didn't"
- Code O2: "Could bill 19929 registered but didn't"
- Code O4: "Could bill 19928 walk-in but didn't"
- Code O5: "Could bill 19929 walk-in but didn't"
- Code O7: "Missing context for 19928"
- Code O8: "Missing context for 19929"

**Decision:** Remove these for now to match documentation strictly. Can be re-added later if needed.

## Message Updates Required

### Current vs. Required Messages

**E1 (Current):**
```
"Code 19928 (avec rendez-vous) nécessite minimum 6 patients avec rendez-vous mais seulement ${registeredCount} trouvé(s)..."
```

**E1 (Required from docs):**
```
"Code 19928 exige minimum 6 patients inscrits mais seulement {registeredPaidCount} trouvé(s) pour {doctor} le {date}"
```

**Changes needed:**
- Remove "(avec rendez-vous)" from message
- Use "patients inscrits" instead of "patients avec rendez-vous"
- Use `registeredPaidCount` instead of `registeredCount`
- Simplify message structure

Similar updates needed for E2, E3, E4, E5, and all optimization messages.

## Monetary Impact Rules

From SCENARIO_BASED_DEVELOPMENT_GUIDE.md:

- **PASS (info):** Always `0`
- **ERROR (error):** Always `0` (errors don't calculate potential loss)
- **OPTIMIZATION (optimization):** Positive number representing potential gain

**Current implementation:**
- Errors use `monetaryImpact: "0.00"` ✅ Correct
- Optimizations use positive values ✅ Correct
- No PASS scenarios yet ❌ Need to add

## Data Structure Updates

### Required ruleData fields per scenario type:

**PASS scenarios need:**
- `scenarioId` (e.g., "P1", "P2")
- `monetaryImpact: 0`
- Visit statistics (registeredPaidCount, walkInPaidCount, etc.)
- Core fields (code, doctor, date, totalAmount)

**ERROR scenarios need:**
- `scenarioId` (e.g., "E1", "E2")
- `monetaryImpact: 0`
- `required` and `actual` values
- Visit statistics
- Error-specific fields

**OPTIMIZATION scenarios need:**
- `scenarioId` (e.g., "O1", "O2")
- `monetaryImpact: {positive number}`
- Current vs. expected values
- Suggested actions

## Next Steps

1. ✅ Review documentation scenarios (complete)
2. ✅ Review current implementation (complete)
3. ✅ Create mapping analysis (complete)
4. ⏭️ Update TypeScript implementation:
   - Add all PASS scenarios (P1-P6)
   - Add missing ERROR scenarios (E6-E7)
   - Fix E5 severity
   - Add missing OPTIMIZATION scenarios (O3-O5)
   - Remove extra code scenarios (O1, O2, O4, O5, O7, O8)
   - Add P-SUMMARY scenario
   - Update all messages to match documentation
   - Add scenarioId to all ruleData
5. ⏭️ Update test file:
   - Add tests for all 19 scenarios
   - Map tests to scenario IDs
6. ⏭️ Run tests and verify

## Files to Update

1. `server/modules/validateur/validation/rules/officeFeeRule.ts` - Main implementation
2. `tests/validation-rules/officeFeeRule.test.ts` - Test file
3. `scenarios_frais_bureau.csv` - Already has test data for all scenarios
