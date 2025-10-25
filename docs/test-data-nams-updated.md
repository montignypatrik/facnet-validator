# Test Data NAM Update - Quebec Format

**Date**: October 22, 2025
**File Updated**: `C:\Users\monti\Projects\facnet-validator\data\samples\Charron, Caroline.csv`
**Lines Updated**: 4263-4282 (20 billing records)

## Summary

Replaced unrealistic test NAMs (TEST001-TEST010) with realistic Quebec NAM format following the standard pattern: **4 letters from last name + 8 digits (birth date information)**.

## NAM Replacements

### Scenario P1: Single Visit with Code 15815
**Patient**: TREMBLAY, PIERRE
**NAM**: `TREM65030515`
**Birth Date Encoded**: March 5, 1965 (sequence 15)
**Lines**: 4263-4264

---

### Scenario E1: Two Visits with Code 15815 in Same Period
**Patient**: GAGNON, MARIE
**NAM**: `GAGN72081223`
**Birth Date Encoded**: August 12, 1972 (sequence 23)
**Lines**: 4265-4268 (2 visits, 2 billing codes each)

**Visit Details**:
- Visit 1: 2025-02-10 (Period 202506)
- Visit 2: 2025-07-22 (Period 202530)

---

### Scenario E2: Three Visits with Code 15816 in Same Period
**Patient**: DUPONT, OLIVIER
**NAM**: `DUPO68070822`
**Birth Date Encoded**: July 8, 1968 (sequence 22)
**Lines**: 4269-4274 (3 visits, 2 billing codes each)

**Visit Details**:
- Visit 1: 2025-01-20 (Period 202504)
- Visit 2: 2025-04-15 (Period 202516)
- Visit 3: 2025-08-05 (Period 202532)

---

### Scenario E3: Three Visits with Code 15817 in Same Period
**Patient**: LAVOIE, JACQUES
**NAM**: `LAVO55120918`
**Birth Date Encoded**: December 9, 1955 (sequence 18)
**Lines**: 4275-4280 (3 visits, 2 billing codes each)

**Visit Details**:
- Visit 1: 2025-03-01 (Period 202510)
- Visit 2: 2025-05-12 (Period 202520)
- Visit 3: 2025-09-18 (Period 202538)

---

### Scenario P1-15819: Single Visit with Code 15819
**Patient**: COTE, SOPHIE
**NAM**: `COTE81091512`
**Birth Date Encoded**: September 15, 1981 (sequence 12)
**Lines**: 4281-4282

---

## Quebec NAM Format Reference

**Structure**: `AAAA YYMMDDRR`

- **AAAA**: 4 letters from patient's last name (uppercase)
- **YY**: Birth year (2 digits)
- **MM**: Birth month (01-12)
- **DD**: Birth day (01-31)
- **RR**: Sequence number (random/assigned by RAMQ)

### Examples from French-Canadian Common Names

All test patients use realistic French-Canadian surnames:
- TREMBLAY (most common surname in Quebec)
- GAGNON (2nd most common)
- DUPONT (classic French surname)
- LAVOIE (common in Quebec)
- COTE (without accent in NAM)

### Birth Dates Selected

Birth years span from 1955 to 1981 to represent realistic adult patient demographics:
- 1950s: 1 patient (LAVOIE - senior)
- 1960s: 2 patients (TREMBLAY, DUPONT - middle-aged)
- 1970s: 1 patient (GAGNON - middle-aged)
- 1980s: 1 patient (COTE - younger adult)

## Validation Test Coverage

These realistic NAMs support testing of:

1. **Single Visit Validation** (P1, P1-15819)
   - Code 15815: TREMBLAY, PIERRE
   - Code 15819: COTE, SOPHIE

2. **Multiple Visit Detection** (E1, E2, E3)
   - Code 15815: GAGNON, MARIE (2 visits)
   - Code 15816: DUPONT, OLIVIER (3 visits)
   - Code 15817: LAVOIE, JACQUES (3 visits)

3. **Period-Based Restrictions**
   - Tests span multiple billing periods (202504-202538)
   - Covers different months and weeks of 2025

## PHI Compliance

All NAMs are **synthetic test data** and do not represent real Quebec residents. The format follows RAMQ standards but uses fictional combinations to ensure PHI compliance.

## Script Used

**Location**: `C:\Users\monti\Projects\facnet-validator\scripts\fix-test-nams.js`
**Execution**: `node scripts/fix-test-nams.js`
**Replacements**: 20 NAM occurrences + 10 patient identifier strings

---

**Status**: ✅ Complete - All test data now uses realistic Quebec NAM format
