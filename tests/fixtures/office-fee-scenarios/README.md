# Office Fee Test Fixtures

This directory contains realistic test data for office fee validation scenarios (19928/19929).

## Structure

Each JSON file represents a complete billing scenario with:
- Patient visit records (codes like 15804, 08129, etc.)
- Office fee records (19928 or 19929)
- Proper Quebec healthcare formatting
- PHI-redacted doctor names

## Usage

```typescript
import { loadFixture } from '../../utils/validationTestHelpers';

const records = await loadFixture('office-fee-scenarios/P1-valid-19928-registered.json');
const results = await officeFeeValidationRule.validate(records, uuidv4());
```

## Available Fixtures

### PASS Scenarios
- `P1-valid-19928-registered.json` - 8 registered patients, code 19928
- `P2-valid-19928-walkin.json` - 15 walk-in patients, code 19928
- `P3-valid-19929-registered.json` - 15 registered patients, code 19929
- `P4-valid-19929-walkin.json` - 23 walk-in patients, code 19929
- `P5-valid-double-billing.json` - Two 19928 codes totaling $64.80
- `P6-valid-cabinet-location.json` - Valid cabinet establishment

### ERROR Scenarios
- `E1-insufficient-registered-19928.json` - Only 3 registered patients
- `E2-insufficient-walkin-19928.json` - Only 7 walk-in patients
- `E3-insufficient-registered-19929.json` - Only 8 registered patients
- `E4-insufficient-walkin-19929.json` - Only 15 walk-in patients
- `E5-daily-maximum-exceeded.json` - Two 19929 codes ($129.60)

### OPTIMIZATION Scenarios
- `O1-upgrade-19928-to-19929-registered.json` - 15 registered, billed 19928
- `O2-upgrade-19928-to-19929-walkin.json` - 23 walk-in, billed 19928
- `O3-add-second-19928-walkin.json` - Could add walk-in billing
- `O4-add-second-19928-registered.json` - Could add registered billing

## Fixture Format

```json
[
  {
    "id": "uuid",
    "code": "15804",
    "patient": "P001",
    "doctorInfo": "1901594-22114 | Morin, Caroline - Omnipraticien",
    "dateService": "2025-01-06T00:00:00.000Z",
    "elementDeContexte": null,
    "montantPreliminaire": "49.15",
    "montantPaye": "49.15",
    "lieuPratique": "50001"
  },
  {
    "id": "uuid",
    "code": "19928",
    "patient": "OFFICE-FEE",
    "doctorInfo": "1901594-22114 | Morin, Caroline - Omnipraticien",
    "dateService": "2025-01-06T00:00:00.000Z",
    "elementDeContexte": null,
    "montantPreliminaire": "32.40",
    "montantPaye": "32.40",
    "lieuPratique": "50001"
  }
]
```

## Creating New Fixtures

Use the test builder helpers:

```typescript
import { createBillingRecords, createPatientVisits } from '../../utils/validationTestHelpers';

const patients = createPatientVisits(8, 'registered', true);
const officeFee = createOfficeFeeRecord('19928', null);
const fixture = [...createBillingRecords(patients), officeFee];

// Save to JSON file
await fs.writeFile('P1-valid-19928-registered.json', JSON.stringify(fixture, null, 2));
```

## Quebec Healthcare Context

- **Walk-in contexts**: `#G160`, `#AR` (sans rendez-vous)
- **Registered patients**: No context or other codes
- **Cabinet establishments**: Codes starting with `5XXXX`
- **Hospital establishments**: Codes starting with `2XXXX`
- **Currency format**: Quebec French `64,80$` (comma separator)
- **Doctor names**: Redacted as `Dr. M***` for PHI compliance
