/**
 * Comprehensive Unit Tests for Office Fee Validation Rule
 * Tests Quebec-specific office fee billing codes 19928 and 19929
 *
 * Business Rules:
 * - Code 19928 registered: Minimum 6 registered patients per day
 * - Code 19928 walk-in: Minimum 10 walk-in patients per day (requires #G160 or #AR context)
 * - Code 19929 registered: Minimum 12 registered patients per day
 * - Code 19929 walk-in: Minimum 20 walk-in patients per day (requires #G160 or #AR context)
 * - Daily maximum: $64.80 per doctor per day
 */

import { describe, it, expect } from 'vitest';
import { officeFeeValidationRule } from '@/server/modules/validateur/validation/rules/officeFeeRule';
import type { BillingRecord } from '@/shared/schema';

// Helper to convert Partial<BillingRecord> to BillingRecord for testing
function createBillingRecord(partial: Partial<BillingRecord>): BillingRecord {
  return {
    id: partial.id || `rec-${Math.random().toString(36).substring(7)}`,
    validationRunId: partial.validationRunId || 'test-run-123',
    recordNumber: partial.recordNumber || null,
    facture: partial.facture || 'INV001',
    idRamq: partial.idRamq || 'RAMQ-2024-001',
    dateService: partial.dateService ? new Date(partial.dateService) : new Date('2024-10-01'),
    debut: partial.debut || '09:00',
    fin: partial.fin || '09:15',
    periode: partial.periode || null,
    lieuPratique: partial.lieuPratique || '12345',
    secteurActivite: partial.secteurActivite || 'CABINET',
    diagnostic: partial.diagnostic || 'A001',
    code: partial.code || '15804',
    unites: partial.unites !== undefined ? partial.unites : '1',
    role: partial.role || '1',
    elementContexte: partial.elementContexte !== undefined ? partial.elementContexte : null,
    montantPreliminaire: partial.montantPreliminaire !== undefined ? partial.montantPreliminaire : '49.15',
    montantPaye: partial.montantPaye !== undefined ? partial.montantPaye : '49.15',
    doctorInfo: partial.doctorInfo || 'Dr. Jean Tremblay',
    patient: partial.patient !== undefined ? partial.patient : 'PATIENT-001',
    createdAt: partial.createdAt || new Date(),
  };
}

describe('Office Fee Validation Rule - Code 19928', () => {
  const validationRunId = 'test-run-office-fee';
  const doctor = 'Dr. Jean Tremblay';
  const date = '2024-10-01';

  describe('Registered Patients (19928)', () => {
    it('should PASS when registered patients >= 6', async () => {
      const records: BillingRecord[] = [
        // 6 registered patient visits
        ...Array.from({ length: 6 }, (_, i) =>
          createBillingRecord({
            id: `visit-${i}`,
            code: '15804',
            patient: `PATIENT-${i}`,
            elementContexte: '11', // Registered context
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        // Office fee claim
        createBillingRecord({
          id: 'office-fee-1',
          code: '19928',
          montantPreliminaire: '10.80',
          elementContexte: null, // No walk-in context = registered
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0); // No violations
    });

    it('should FAIL when registered patients < 6', async () => {
      const records: BillingRecord[] = [
        // Only 5 registered patient visits
        ...Array.from({ length: 5 }, (_, i) =>
          createBillingRecord({
            id: `visit-${i}`,
            code: '15804',
            patient: `PATIENT-${i}`,
            elementContexte: '11',
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        // Office fee claim - SHOULD FAIL
        createBillingRecord({
          id: 'office-fee-1',
          code: '19928',
          montantPreliminaire: '10.80',
          elementContexte: null,
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        billingRecordId: 'office-fee-1',
        severity: 'error',
        category: 'office_fees',
      });
      expect(results[0].message).toContain('Code 19928 (registered)');
      expect(results[0].message).toContain('requires minimum 6');
      expect(results[0].ruleData).toMatchObject({
        code: '19928',
        type: 'registered',
        required: 6,
        actual: 5,
      });
    });

    it('should handle exactly 6 registered patients (boundary case)', async () => {
      const records: BillingRecord[] = [
        // Exactly 6 registered patients
        ...Array.from({ length: 6 }, (_, i) =>
          createBillingRecord({
            id: `visit-${i}`,
            code: '15804',
            patient: `PATIENT-${i}`,
            elementContexte: '12',
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        createBillingRecord({
          id: 'office-fee-1',
          code: '19928',
          montantPreliminaire: '10.80',
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0); // Should pass with exactly 6
    });

    it('should count unique patients (not duplicate visits)', async () => {
      const records: BillingRecord[] = [
        // Patient 1 visits 3 times
        createBillingRecord({
          id: 'visit-1a',
          code: '15804',
          patient: 'PATIENT-001',
          elementContexte: '11',
          doctorInfo: doctor,
          dateService: date,
        }),
        createBillingRecord({
          id: 'visit-1b',
          code: '15804',
          patient: 'PATIENT-001',
          elementContexte: '11',
          doctorInfo: doctor,
          dateService: date,
        }),
        createBillingRecord({
          id: 'visit-1c',
          code: '15804',
          patient: 'PATIENT-001',
          elementContexte: '11',
          doctorInfo: doctor,
          dateService: date,
        }),
        // Only 3 more unique patients (total 4 unique)
        createBillingRecord({
          id: 'visit-2',
          code: '15804',
          patient: 'PATIENT-002',
          elementContexte: '11',
          doctorInfo: doctor,
          dateService: date,
        }),
        createBillingRecord({
          id: 'visit-3',
          code: '15804',
          patient: 'PATIENT-003',
          elementContexte: '11',
          doctorInfo: doctor,
          dateService: date,
        }),
        createBillingRecord({
          id: 'visit-4',
          code: '15804',
          patient: 'PATIENT-004',
          elementContexte: '11',
          doctorInfo: doctor,
          dateService: date,
        }),
        // Office fee - SHOULD FAIL (only 4 unique patients)
        createBillingRecord({
          id: 'office-fee-1',
          code: '19928',
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].ruleData.actual).toBe(4); // 4 unique patients
    });
  });

  describe('Walk-in Patients (19928)', () => {
    it('should PASS when walk-in patients >= 10 with #G160 context', async () => {
      const records: BillingRecord[] = [
        // 10 walk-in patient visits with #G160
        ...Array.from({ length: 10 }, (_, i) =>
          createBillingRecord({
            id: `visit-${i}`,
            code: '15804',
            patient: `PATIENT-WALKIN-${i}`,
            elementContexte: '#G160', // Walk-in context
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        // Walk-in office fee claim
        createBillingRecord({
          id: 'office-fee-1',
          code: '19928',
          montantPreliminaire: '10.80',
          elementContexte: '#G160',
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0); // Should pass
    });

    it('should PASS when walk-in patients >= 10 with #AR context', async () => {
      const records: BillingRecord[] = [
        // 10 walk-in patients with #AR
        ...Array.from({ length: 10 }, (_, i) =>
          createBillingRecord({
            id: `visit-${i}`,
            code: '15804',
            patient: `PATIENT-WALKIN-${i}`,
            elementContexte: '#AR', // Alternative walk-in context
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        createBillingRecord({
          id: 'office-fee-1',
          code: '19928',
          elementContexte: '#AR',
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0);
    });

    it('should FAIL when walk-in patients < 10', async () => {
      const records: BillingRecord[] = [
        // Only 9 walk-in patients
        ...Array.from({ length: 9 }, (_, i) =>
          createBillingRecord({
            id: `visit-${i}`,
            code: '15804',
            patient: `PATIENT-WALKIN-${i}`,
            elementContexte: '#G160',
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        createBillingRecord({
          id: 'office-fee-1',
          code: '19928',
          elementContexte: '#G160',
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].message).toContain('Code 19928 (walk-in)');
      expect(results[0].message).toContain('requires minimum 10 walk-in patients');
      expect(results[0].ruleData).toMatchObject({
        code: '19928',
        type: 'walk_in',
        required: 10,
        actual: 9,
      });
    });

    it('should FAIL when walk-in office fee missing required context', async () => {
      const records: BillingRecord[] = [
        // 10 walk-in patients (with context)
        ...Array.from({ length: 10 }, (_, i) =>
          createBillingRecord({
            id: `visit-${i}`,
            code: '15804',
            patient: `PATIENT-WALKIN-${i}`,
            elementContexte: '#G160',
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        // Office fee WITHOUT walk-in context - SHOULD FAIL
        createBillingRecord({
          id: 'office-fee-1',
          code: '19928',
          elementContexte: '11', // Registered context instead of walk-in
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      // Should fail for insufficient registered patients (0 registered)
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].message).toContain('requires minimum');
    });

    it('should handle mixed #G160 and #AR walk-in patients', async () => {
      const records: BillingRecord[] = [
        // 5 with #G160
        ...Array.from({ length: 5 }, (_, i) =>
          createBillingRecord({
            id: `visit-g160-${i}`,
            code: '15804',
            patient: `PATIENT-G160-${i}`,
            elementContexte: '#G160',
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        // 5 with #AR
        ...Array.from({ length: 5 }, (_, i) =>
          createBillingRecord({
            id: `visit-ar-${i}`,
            code: '15804',
            patient: `PATIENT-AR-${i}`,
            elementContexte: '#AR',
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        // Office fee (total 10 walk-in patients)
        createBillingRecord({
          id: 'office-fee-1',
          code: '19928',
          elementContexte: '#G160',
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0); // Should pass with mixed contexts
    });
  });
});

describe('Office Fee Validation Rule - Code 19929', () => {
  const validationRunId = 'test-run-19929';
  const doctor = 'Dr. Marie Leblanc';
  const date = '2024-10-01';

  describe('Registered Patients (19929)', () => {
    it('should PASS when registered patients >= 12', async () => {
      const records: BillingRecord[] = [
        // 12 registered patients
        ...Array.from({ length: 12 }, (_, i) =>
          createBillingRecord({
            id: `visit-${i}`,
            code: '15804',
            patient: `PATIENT-${i}`,
            elementContexte: '11',
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        createBillingRecord({
          id: 'office-fee-1',
          code: '19929',
          montantPreliminaire: '5.40',
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0);
    });

    it('should FAIL when registered patients < 12', async () => {
      const records: BillingRecord[] = [
        // Only 11 registered patients
        ...Array.from({ length: 11 }, (_, i) =>
          createBillingRecord({
            id: `visit-${i}`,
            code: '15804',
            patient: `PATIENT-${i}`,
            elementContexte: '12',
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        createBillingRecord({
          id: 'office-fee-1',
          code: '19929',
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].message).toContain('Code 19929 (registered)');
      expect(results[0].message).toContain('requires minimum 12');
      expect(results[0].ruleData).toMatchObject({
        code: '19929',
        type: 'registered',
        required: 12,
        actual: 11,
      });
    });

    it('should handle exactly 12 registered patients (boundary case)', async () => {
      const records: BillingRecord[] = [
        ...Array.from({ length: 12 }, (_, i) =>
          createBillingRecord({
            id: `visit-${i}`,
            code: '15804',
            patient: `PATIENT-${i}`,
            elementContexte: '11',
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        createBillingRecord({
          id: 'office-fee-1',
          code: '19929',
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0); // Should pass with exactly 12
    });
  });

  describe('Walk-in Patients (19929)', () => {
    it('should PASS when walk-in patients >= 20', async () => {
      const records: BillingRecord[] = [
        // 20 walk-in patients
        ...Array.from({ length: 20 }, (_, i) =>
          createBillingRecord({
            id: `visit-${i}`,
            code: '15804',
            patient: `PATIENT-WALKIN-${i}`,
            elementContexte: '#G160',
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        createBillingRecord({
          id: 'office-fee-1',
          code: '19929',
          elementContexte: '#G160',
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0);
    });

    it('should FAIL when walk-in patients < 20', async () => {
      const records: BillingRecord[] = [
        // Only 19 walk-in patients
        ...Array.from({ length: 19 }, (_, i) =>
          createBillingRecord({
            id: `visit-${i}`,
            code: '15804',
            patient: `PATIENT-WALKIN-${i}`,
            elementContexte: '#AR',
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        createBillingRecord({
          id: 'office-fee-1',
          code: '19929',
          elementContexte: '#AR',
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].message).toContain('Code 19929 (walk-in)');
      expect(results[0].message).toContain('requires minimum 20 walk-in patients');
      expect(results[0].ruleData).toMatchObject({
        code: '19929',
        type: 'walk_in',
        required: 20,
        actual: 19,
      });
    });

    it('should handle exactly 20 walk-in patients (boundary case)', async () => {
      const records: BillingRecord[] = [
        ...Array.from({ length: 20 }, (_, i) =>
          createBillingRecord({
            id: `visit-${i}`,
            code: '15804',
            patient: `PATIENT-WALKIN-${i}`,
            elementContexte: '#G160',
            doctorInfo: doctor,
            dateService: date,
          })
        ),
        createBillingRecord({
          id: 'office-fee-1',
          code: '19929',
          elementContexte: '#G160',
          doctorInfo: doctor,
          dateService: date,
        }),
      ];

      const results = await officeFeeValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0); // Should pass with exactly 20
    });
  });
});

describe('Office Fee Daily Maximum ($64.80)', () => {
  const validationRunId = 'test-run-daily-max';
  const doctor = 'Dr. Jean Tremblay';
  const date = '2024-10-01';

  it('should PASS when total daily amount <= $64.80', async () => {
    const records: BillingRecord[] = [
      // 6 registered patients (meets 19928 requirement)
      ...Array.from({ length: 6 }, (_, i) =>
        createBillingRecord({
          id: `visit-${i}`,
          code: '15804',
          patient: `PATIENT-${i}`,
          elementContexte: '11',
          doctorInfo: doctor,
          dateService: date,
        })
      ),
      // 6 x $10.80 = $64.80 (exactly at limit)
      ...Array.from({ length: 6 }, (_, i) =>
        createBillingRecord({
          id: `office-fee-${i}`,
          code: '19928',
          montantPreliminaire: '10.80',
          doctorInfo: doctor,
          dateService: date,
        })
      ),
    ];

    const results = await officeFeeValidationRule.validate(records, validationRunId);

    // Should not have daily maximum violation
    const maxViolation = results.find(r => r.message.includes('Daily office fee maximum'));
    expect(maxViolation).toBeUndefined();
  });

  it('should FAIL when total daily amount > $64.80', async () => {
    const records: BillingRecord[] = [
      // 6 registered patients
      ...Array.from({ length: 6 }, (_, i) =>
        createBillingRecord({
          id: `visit-${i}`,
          code: '15804',
          patient: `PATIENT-${i}`,
          elementContexte: '11',
          doctorInfo: doctor,
          dateService: date,
        })
      ),
      // 7 x $10.80 = $75.60 (exceeds $64.80 limit)
      ...Array.from({ length: 7 }, (_, i) =>
        createBillingRecord({
          id: `office-fee-${i}`,
          code: '19928',
          montantPreliminaire: '10.80',
          doctorInfo: doctor,
          dateService: date,
        })
      ),
    ];

    const results = await officeFeeValidationRule.validate(records, validationRunId);

    const maxViolation = results.find(r => r.message.includes('Daily office fee maximum'));
    expect(maxViolation).toBeDefined();
    expect(maxViolation!.message).toContain('$64.80 exceeded');
    expect(maxViolation!.message).toContain('$75.60'); // Actual amount
    expect(maxViolation!.ruleData).toMatchObject({
      totalAmount: 75.60,
      maximum: 64.80,
    });
  });

  it('should handle mixed 19928 and 19929 codes in daily total', async () => {
    const records: BillingRecord[] = [
      // 6 registered patients (for 19928)
      ...Array.from({ length: 6 }, (_, i) =>
        createBillingRecord({
          id: `visit-registered-${i}`,
          code: '15804',
          patient: `PATIENT-${i}`,
          elementContexte: '11',
          doctorInfo: doctor,
          dateService: date,
        })
      ),
      // 12 more for 19929
      ...Array.from({ length: 12 }, (_, i) =>
        createBillingRecord({
          id: `visit-${i + 6}`,
          code: '15804',
          patient: `PATIENT-${i + 6}`,
          elementContexte: '12',
          doctorInfo: doctor,
          dateService: date,
        })
      ),
      // 3 x 19928 ($10.80 each) + 10 x 19929 ($5.40 each) = $32.40 + $54.00 = $86.40
      createBillingRecord({
        id: 'office-fee-1',
        code: '19928',
        montantPreliminaire: '10.80',
        doctorInfo: doctor,
        dateService: date,
      }),
      createBillingRecord({
        id: 'office-fee-2',
        code: '19928',
        montantPreliminaire: '10.80',
        doctorInfo: doctor,
        dateService: date,
      }),
      createBillingRecord({
        id: 'office-fee-3',
        code: '19928',
        montantPreliminaire: '10.80',
        doctorInfo: doctor,
        dateService: date,
      }),
      ...Array.from({ length: 10 }, (_, i) =>
        createBillingRecord({
          id: `office-fee-19929-${i}`,
          code: '19929',
          montantPreliminaire: '5.40',
          doctorInfo: doctor,
          dateService: date,
        })
      ),
    ];

    const results = await officeFeeValidationRule.validate(records, validationRunId);

    const maxViolation = results.find(r => r.message.includes('Daily office fee maximum'));
    expect(maxViolation).toBeDefined();
    expect(maxViolation!.ruleData.totalAmount).toBeCloseTo(86.40, 2);
  });

  it('should not count non-office-fee codes in daily total', async () => {
    const records: BillingRecord[] = [
      // 6 registered patients
      ...Array.from({ length: 6 }, (_, i) =>
        createBillingRecord({
          id: `visit-${i}`,
          code: '15804',
          patient: `PATIENT-${i}`,
          elementContexte: '11',
          doctorInfo: doctor,
          dateService: date,
        })
      ),
      // Regular billing codes (high amounts, but not office fees)
      createBillingRecord({
        id: 'regular-1',
        code: '15804',
        montantPreliminaire: '100.00',
        doctorInfo: doctor,
        dateService: date,
      }),
      createBillingRecord({
        id: 'regular-2',
        code: '15820',
        montantPreliminaire: '200.00',
        doctorInfo: doctor,
        dateService: date,
      }),
      // Office fee (within limit)
      createBillingRecord({
        id: 'office-fee-1',
        code: '19928',
        montantPreliminaire: '10.80',
        doctorInfo: doctor,
        dateService: date,
      }),
    ];

    const results = await officeFeeValidationRule.validate(records, validationRunId);

    const maxViolation = results.find(r => r.message.includes('Daily office fee maximum'));
    expect(maxViolation).toBeUndefined(); // Should not violate because only $10.80 in office fees
  });
});

describe('Office Fee Multi-Doctor and Multi-Date Scenarios', () => {
  const validationRunId = 'test-run-multi-scenario';

  it('should isolate validation by doctor (different doctors, same day)', async () => {
    const date = '2024-10-01';

    const records: BillingRecord[] = [
      // Doctor 1: 6 patients + office fee (valid)
      ...Array.from({ length: 6 }, (_, i) =>
        createBillingRecord({
          id: `dr1-visit-${i}`,
          code: '15804',
          patient: `PATIENT-DR1-${i}`,
          elementContexte: '11',
          doctorInfo: 'Dr. Jean Tremblay',
          dateService: date,
        })
      ),
      createBillingRecord({
        id: 'dr1-office-fee',
        code: '19928',
        doctorInfo: 'Dr. Jean Tremblay',
        dateService: date,
      }),
      // Doctor 2: 3 patients + office fee (invalid - insufficient patients)
      ...Array.from({ length: 3 }, (_, i) =>
        createBillingRecord({
          id: `dr2-visit-${i}`,
          code: '15804',
          patient: `PATIENT-DR2-${i}`,
          elementContexte: '11',
          doctorInfo: 'Dr. Marie Leblanc',
          dateService: date,
        })
      ),
      createBillingRecord({
        id: 'dr2-office-fee',
        code: '19928',
        doctorInfo: 'Dr. Marie Leblanc',
        dateService: date,
      }),
    ];

    const results = await officeFeeValidationRule.validate(records, validationRunId);

    // Should only flag Dr. Marie Leblanc
    expect(results).toHaveLength(1);
    expect(results[0].billingRecordId).toBe('dr2-office-fee');
    expect(results[0].ruleData.doctor).toBe('Dr. Marie Leblanc');
  });

  it('should isolate validation by date (same doctor, different days)', async () => {
    const doctor = 'Dr. Jean Tremblay';

    const records: BillingRecord[] = [
      // Day 1: 6 patients + office fee (valid)
      ...Array.from({ length: 6 }, (_, i) =>
        createBillingRecord({
          id: `day1-visit-${i}`,
          code: '15804',
          patient: `PATIENT-${i}`,
          elementContexte: '11',
          doctorInfo: doctor,
          dateService: '2024-10-01',
        })
      ),
      createBillingRecord({
        id: 'day1-office-fee',
        code: '19928',
        doctorInfo: doctor,
        dateService: '2024-10-01',
      }),
      // Day 2: 2 patients + office fee (invalid)
      ...Array.from({ length: 2 }, (_, i) =>
        createBillingRecord({
          id: `day2-visit-${i}`,
          code: '15804',
          patient: `PATIENT-${i}`,
          elementContexte: '11',
          doctorInfo: doctor,
          dateService: '2024-10-02',
        })
      ),
      createBillingRecord({
        id: 'day2-office-fee',
        code: '19928',
        doctorInfo: doctor,
        dateService: '2024-10-02',
      }),
    ];

    const results = await officeFeeValidationRule.validate(records, validationRunId);

    // Should only flag Day 2
    expect(results).toHaveLength(1);
    expect(results[0].billingRecordId).toBe('day2-office-fee');
    expect(results[0].ruleData.date).toBe('2024-10-02');
  });

  it('should handle multiple violations for different doctor-day combinations', async () => {
    const records: BillingRecord[] = [
      // Dr. 1, Day 1: Invalid (3 patients, needs 6)
      ...Array.from({ length: 3 }, (_, i) =>
        createBillingRecord({
          id: `dr1-day1-visit-${i}`,
          code: '15804',
          patient: `PATIENT-${i}`,
          doctorInfo: 'Dr. Jean Tremblay',
          dateService: '2024-10-01',
        })
      ),
      createBillingRecord({
        id: 'dr1-day1-office-fee',
        code: '19928',
        doctorInfo: 'Dr. Jean Tremblay',
        dateService: '2024-10-01',
      }),
      // Dr. 2, Day 1: Invalid (4 patients, needs 6)
      ...Array.from({ length: 4 }, (_, i) =>
        createBillingRecord({
          id: `dr2-day1-visit-${i}`,
          code: '15804',
          patient: `PATIENT-${i}`,
          doctorInfo: 'Dr. Marie Leblanc',
          dateService: '2024-10-01',
        })
      ),
      createBillingRecord({
        id: 'dr2-day1-office-fee',
        code: '19928',
        doctorInfo: 'Dr. Marie Leblanc',
        dateService: '2024-10-01',
      }),
    ];

    const results = await officeFeeValidationRule.validate(records, validationRunId);

    // Should flag both violations
    expect(results).toHaveLength(2);
    const doctors = results.map(r => r.ruleData.doctor);
    expect(doctors).toContain('Dr. Jean Tremblay');
    expect(doctors).toContain('Dr. Marie Leblanc');
  });
});

describe('Office Fee Edge Cases', () => {
  const validationRunId = 'test-run-edge-cases';

  it('should handle empty billing records array', async () => {
    const records: BillingRecord[] = [];

    const results = await officeFeeValidationRule.validate(records, validationRunId);

    expect(results).toHaveLength(0);
  });

  it('should handle records with no office fee codes', async () => {
    const records: BillingRecord[] = [
      createBillingRecord({ code: '15804' }),
      createBillingRecord({ code: '15820' }),
      createBillingRecord({ code: '15838' }),
    ];

    const results = await officeFeeValidationRule.validate(records, validationRunId);

    expect(results).toHaveLength(0);
  });

  it('should handle missing doctorInfo gracefully', async () => {
    const records: BillingRecord[] = [
      createBillingRecord({
        code: '19928',
        doctorInfo: '', // Empty doctor info
        dateService: '2024-10-01',
      }),
    ];

    const results = await officeFeeValidationRule.validate(records, validationRunId);

    // Should not crash, may or may not flag depending on implementation
    expect(Array.isArray(results)).toBe(true);
  });

  it('should handle missing dateService gracefully', async () => {
    const records: BillingRecord[] = [
      createBillingRecord({
        code: '19928',
        doctorInfo: 'Dr. Jean Tremblay',
        dateService: undefined as any,
      }),
    ];

    const results = await officeFeeValidationRule.validate(records, validationRunId);

    expect(Array.isArray(results)).toBe(true);
  });

  it('should handle records with null or zero montantPreliminaire', async () => {
    const records: BillingRecord[] = [
      ...Array.from({ length: 6 }, (_, i) =>
        createBillingRecord({
          id: `visit-${i}`,
          code: '15804',
          patient: `PATIENT-${i}`,
          doctorInfo: 'Dr. Jean Tremblay',
          dateService: '2024-10-01',
        })
      ),
      createBillingRecord({
        id: 'office-fee-1',
        code: '19928',
        montantPreliminaire: null,
        doctorInfo: 'Dr. Jean Tremblay',
        dateService: '2024-10-01',
      }),
    ];

    const results = await officeFeeValidationRule.validate(records, validationRunId);

    // Should not crash when calculating daily total
    expect(Array.isArray(results)).toBe(true);
  });

  it('should handle patients without patient ID', async () => {
    const records: BillingRecord[] = [
      ...Array.from({ length: 6 }, (_, i) =>
        createBillingRecord({
          id: `visit-${i}`,
          code: '15804',
          patient: null, // No patient ID
          doctorInfo: 'Dr. Jean Tremblay',
          dateService: '2024-10-01',
        })
      ),
      createBillingRecord({
        id: 'office-fee-1',
        code: '19928',
        doctorInfo: 'Dr. Jean Tremblay',
        dateService: '2024-10-01',
      }),
    ];

    const results = await officeFeeValidationRule.validate(records, validationRunId);

    // With no patient IDs, registered patient count = 0, should fail
    expect(results.length).toBeGreaterThan(0);
  });
});
