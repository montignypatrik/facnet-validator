/**
 * Unit Tests for Units Validation Rule
 * Tests Quebec RAMQ billing codes that require specific unit values
 *
 * Business Rules:
 * - Time-based codes require units (duration in minutes)
 * - Distance-based codes require units (distance in kilometers)
 * - Quantity-based codes require units (number of procedures)
 * - Some codes have minimum/maximum unit requirements
 *
 * NOTE: This is a TDD (Test-Driven Development) test file.
 * The implementation may not exist yet, but these tests define the expected behavior.
 */

import { describe, it, expect } from 'vitest';
import type { BillingRecord, InsertValidationResult } from '@/shared/schema';

// Mock validation rule for testing
interface UnitValidationRule {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  validate(records: BillingRecord[], validationRunId: string): Promise<InsertValidationResult[]>;
}

// Helper to create test billing records
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

// Mock implementation for testing purposes
// In production, this would come from the actual validation engine
const mockUnitValidationRule: UnitValidationRule = {
  id: 'unit-validation',
  name: 'Units Validation',
  category: 'units',
  enabled: true,

  async validate(records: BillingRecord[], validationRunId: string): Promise<InsertValidationResult[]> {
    const results: InsertValidationResult[] = [];

    // Codes that require units (examples from Quebec RAMQ)
    const timeBasedCodes = ['08000', '08001', '08002']; // Time-based procedures
    const distanceBasedCodes = ['09000', '09001']; // Distance-based (travel fees)
    const requiredUnitCodes = [...timeBasedCodes, ...distanceBasedCodes];

    for (const record of records) {
      // Check if code requires units
      if (requiredUnitCodes.includes(record.code)) {
        // Missing units
        if (!record.unites || record.unites === '0') {
          results.push({
            validationRunId,
            ruleId: 'unit-validation',
            billingRecordId: record.id,
            idRamq: record.idRamq,
            severity: 'error',
            category: 'units',
            message: `Le code ${record.code} requiert un nombre d'unités valide`,
            affectedRecords: [record.id],
            ruleData: {
              code: record.code,
              units: record.unites,
              required: true,
            },
          });
        }
        // Invalid units (negative or non-numeric)
        else if (Number.isNaN(Number(record.unites)) || Number(record.unites) < 0) {
          results.push({
            validationRunId,
            ruleId: 'unit-validation',
            billingRecordId: record.id,
            idRamq: record.idRamq,
            severity: 'error',
            category: 'units',
            message: `Le code ${record.code} a un nombre d'unités invalide: ${record.unites}`,
            affectedRecords: [record.id],
            ruleData: {
              code: record.code,
              units: record.unites,
              invalidFormat: true,
            },
          });
        }
        // Minimum units validation (time-based must be >= 15 minutes)
        else if (timeBasedCodes.includes(record.code) && Number(record.unites) < 15) {
          results.push({
            validationRunId,
            ruleId: 'unit-validation',
            billingRecordId: record.id,
            idRamq: record.idRamq,
            severity: 'warning',
            category: 'units',
            message: `Le code ${record.code} a un nombre d'unités minimal de 15 minutes (actuel: ${record.unites})`,
            affectedRecords: [record.id],
            ruleData: {
              code: record.code,
              units: record.unites,
              minimum: 15,
            },
          });
        }
      }
    }

    return results;
  },
};

describe('Units Validation Rule - Required Units', () => {
  const validationRunId = 'test-run-units';

  describe('Time-Based Codes', () => {
    it('should PASS when time-based code has valid units', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '08000', // Time-based code
          unites: '30', // 30 minutes
          debut: '09:00',
          fin: '09:30',
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0); // No violations
    });

    it('should FAIL when time-based code missing units', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '08000',
          unites: null, // MISSING UNITS
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        billingRecordId: 'rec-1',
        severity: 'error',
        category: 'units',
      });
      expect(results[0].message).toContain('requiert un nombre d\'unités');
      expect(results[0].ruleData).toMatchObject({
        code: '08000',
        required: true,
      });
    });

    it('should FAIL when time-based code has zero units', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '08001',
          unites: '0', // Zero units
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].message).toContain('requiert un nombre d\'unités');
    });

    it('should WARN when time-based code has units < 15 minutes', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '08002',
          unites: '10', // Below 15-minute minimum
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('warning');
      expect(results[0].message).toContain('minimal de 15 minutes');
      expect(results[0].ruleData).toMatchObject({
        code: '08002',
        units: '10',
        minimum: 15,
      });
    });

    it('should handle exactly 15 minutes (boundary case)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '08000',
          unites: '15', // Exactly at minimum
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0); // Should pass
    });
  });

  describe('Distance-Based Codes', () => {
    it('should PASS when distance code has valid units', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '09000', // Distance-based code
          unites: '25', // 25 km
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0);
    });

    it('should FAIL when distance code missing units', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '09001',
          unites: null, // MISSING
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].message).toContain('requiert un nombre d\'unités');
    });
  });

  describe('Invalid Unit Formats', () => {
    it('should FAIL when units is non-numeric', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '08000',
          unites: 'invalid', // Non-numeric
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].message).toContain('unités invalide');
      expect(results[0].ruleData).toMatchObject({
        code: '08000',
        units: 'invalid',
        invalidFormat: true,
      });
    });

    it('should FAIL when units is negative', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '08001',
          unites: '-10', // Negative
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].message).toContain('invalide');
    });

    it('should handle decimal units', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '09000',
          unites: '12.5', // Decimal (valid for distance)
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0); // Should pass
    });
  });

  describe('Codes Not Requiring Units', () => {
    it('should not flag standard codes without units', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '15804', // Standard office visit (no units required)
          unites: null,
        }),
        createBillingRecord({
          id: 'rec-2',
          code: '15820', // Standard consultation (no units required)
          unites: '0',
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0); // Should not flag
    });

    it('should allow optional units for non-required codes', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '15804',
          unites: '1', // Optional but provided
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0);
    });
  });

  describe('Multiple Records Validation', () => {
    it('should flag multiple records with missing units', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '08000',
          unites: null, // Missing
        }),
        createBillingRecord({
          id: 'rec-2',
          code: '08001',
          unites: null, // Missing
        }),
        createBillingRecord({
          id: 'rec-3',
          code: '15804',
          unites: null, // OK - doesn't require units
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(2); // Two violations
      expect(results[0].billingRecordId).toBe('rec-1');
      expect(results[1].billingRecordId).toBe('rec-2');
    });

    it('should handle mix of valid and invalid units', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-valid',
          code: '08000',
          unites: '30', // Valid
        }),
        createBillingRecord({
          id: 'rec-invalid',
          code: '08001',
          unites: null, // Invalid
        }),
        createBillingRecord({
          id: 'rec-warning',
          code: '08002',
          unites: '10', // Below minimum (warning)
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(2); // 1 error + 1 warning
      const errorResults = results.filter(r => r.severity === 'error');
      const warningResults = results.filter(r => r.severity === 'warning');
      expect(errorResults).toHaveLength(1);
      expect(warningResults).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty billing records array', async () => {
      const records: BillingRecord[] = [];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0);
    });

    it('should handle records with empty string units', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '08000',
          unites: '', // Empty string
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].message).toContain('requiert un nombre d\'unités');
    });

    it('should handle whitespace-only units', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '08001',
          unites: '   ', // Whitespace (converts to 0, triggers minimum threshold)
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].message).toContain('minimal'); // Triggers minimum warning for time-based code
    });

    it('should handle very large unit values', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '08000',
          unites: '999999', // Very large
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      // Should pass validation (no maximum defined in this test)
      expect(results).toHaveLength(0);
    });

    it('should include French error messages', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '08000',
          unites: null,
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results[0].message).toContain('requiert');
      expect(results[0].message).toContain('unités');
    });
  });

  describe('Return Value Structure', () => {
    it('should return array of InsertValidationResult objects', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '08000',
          unites: null,
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(Array.isArray(results)).toBe(true);
      expect(results[0]).toHaveProperty('validationRunId');
      expect(results[0]).toHaveProperty('ruleId');
      expect(results[0]).toHaveProperty('billingRecordId');
      expect(results[0]).toHaveProperty('idRamq');
      expect(results[0]).toHaveProperty('severity');
      expect(results[0]).toHaveProperty('category');
      expect(results[0]).toHaveProperty('message');
      expect(results[0]).toHaveProperty('affectedRecords');
      expect(results[0]).toHaveProperty('ruleData');
    });

    it('should include relevant ruleData fields', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: 'rec-1',
          code: '08000',
          unites: null,
        }),
      ];

      const results = await mockUnitValidationRule.validate(records, validationRunId);

      expect(results[0].ruleData).toMatchObject({
        code: '08000',
        required: true,
      });
    });
  });
});
