/**
 * Unit Tests for Prohibition Validation Rule
 * Tests Quebec-specific prohibited billing code combinations
 *
 * Rule: Codes 08129 and 08135 cannot be billed together on the same invoice
 */

import { describe, it, expect } from 'vitest';
import { validateProhibition } from '@/server/modules/validateur/validation/ruleTypeHandlers';
import { sampleValidationRules } from '@/tests/fixtures/validation-rules';
import type { BillingRecord, InsertValidationResult } from '@/shared/schema';

// Helper to convert Partial<BillingRecord> to BillingRecord for testing
function createBillingRecord(partial: Partial<BillingRecord>): BillingRecord {
  return {
    id: partial.id || 'test-id',
    validationRunId: partial.validationRunId || 'test-run-123',
    recordNumber: partial.recordNumber || null,
    facture: partial.facture !== undefined ? partial.facture : 'INV001', // Allow null to pass through
    idRamq: partial.idRamq || 'R001',
    dateService: partial.dateService ? new Date(partial.dateService) : new Date('2025-02-05'),
    debut: partial.debut || '08:00',
    fin: partial.fin || '08:15',
    periode: partial.periode || null,
    lieuPratique: partial.lieuPratique || '12345',
    secteurActivite: partial.secteurActivite || 'Cabinet',
    diagnostic: partial.diagnostic || 'A09',
    code: partial.code || '00103',
    unites: partial.unites || null,
    role: partial.role || '1',
    elementContexte: partial.elementContexte || null,
    montantPreliminaire: partial.montantPreliminaire || null,
    montantPaye: partial.montantPaye || null,
    doctorInfo: partial.doctorInfo || '1068303-00000',
    patient: partial.patient || 'P001',
    createdAt: partial.createdAt || new Date(),
  };
}

describe('validateProhibition', () => {
  const rule = sampleValidationRules[0]; // prohibition_08129_08135
  const validationRunId = 'test-run-prohibition-001';

  describe('Positive Cases (Should NOT Flag)', () => {
    it('should not flag prohibited codes on DIFFERENT invoices', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          facture: 'INV001',
          code: '08129',
          idRamq: 'R001',
          dateService: '2025-02-05',
          patient: 'P001',
        }),
        createBillingRecord({
          id: '2',
          facture: 'INV002', // Different invoice - should be allowed
          code: '08135',
          idRamq: 'R002',
          dateService: '2025-02-05',
          patient: 'P002',
        }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results).toHaveLength(0);
    });

    it('should not flag when only ONE prohibited code is present', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          facture: 'INV001',
          code: '08129',
          idRamq: 'R001',
          patient: 'P001',
        }),
        createBillingRecord({
          id: '2',
          facture: 'INV001',
          code: '00103', // Non-prohibited code
          idRamq: 'R001',
          patient: 'P001',
        }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results).toHaveLength(0);
    });

    it('should not flag prohibited codes on different DATES (different patient-day grouping)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          facture: null, // No invoice number - groups by patient+date
          code: '08129',
          dateService: new Date('2025-02-05'), // Explicit Date object
          patient: 'P001',
        }),
        createBillingRecord({
          id: '2',
          facture: null,
          code: '08135',
          dateService: new Date('2025-02-06'), // Different date - should create different group
          patient: 'P001',
        }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results).toHaveLength(0);
    });

    it('should handle empty billing records array', async () => {
      const records: BillingRecord[] = [];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results).toHaveLength(0);
    });

    it('should not flag when NONE of the prohibited codes are present', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '00103', facture: 'INV001' }),
        createBillingRecord({ code: '15838', facture: 'INV001' }),
        createBillingRecord({ code: '19929', facture: 'INV001' }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results).toHaveLength(0);
    });
  });

  describe('Negative Cases (Should Flag Violations)', () => {
    it('should DETECT prohibited codes 08129 and 08135 on SAME invoice', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '3',
          facture: 'INV003',
          code: '08129',
          idRamq: 'R003',
          dateService: '2025-02-05',
          patient: 'P003',
          montantPreliminaire: '85.00',
        }),
        createBillingRecord({
          id: '4',
          facture: 'INV003', // SAME invoice - VIOLATION!
          code: '08135',
          idRamq: 'R003',
          dateService: '2025-02-05',
          patient: 'P003',
          montantPreliminaire: '125.00',
        }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        validationRunId,
        ruleId: rule.id,
        severity: 'error',
        category: 'prohibition',
        idRamq: 'R003',
      });
      expect(results[0].billingRecordId).toBeTruthy();
      expect(results[0].affectedRecords).toHaveLength(2);
      expect(results[0].affectedRecords).toContain('3');
      expect(results[0].affectedRecords).toContain('4');
    });

    it('should include French error message with "prohibés"', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ id: '1', facture: 'INV001', code: '08129' }),
        createBillingRecord({ id: '2', facture: 'INV001', code: '08135' }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results[0].message).toContain('prohibés');
      expect(results[0].message).toContain('08129');
      expect(results[0].message).toContain('08135');
    });

    it('should detect prohibited codes grouped by PATIENT+DATE when facture is null', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '5',
          facture: null, // No invoice - groups by patient_date
          code: '08129',
          patient: 'P005',
          dateService: '2025-02-05',
        }),
        createBillingRecord({
          id: '6',
          facture: null,
          code: '08135',
          patient: 'P005', // Same patient
          dateService: '2025-02-05', // Same date
        }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('error');
      expect(results[0].category).toBe('prohibition');
    });

    it('should detect prohibition with MULTIPLE instances of same code on same invoice', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ id: '1', facture: 'INV001', code: '08129' }),
        createBillingRecord({ id: '2', facture: 'INV001', code: '08129' }), // Duplicate
        createBillingRecord({ id: '3', facture: 'INV001', code: '08135' }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].affectedRecords).toHaveLength(3); // All 3 records affected
    });
  });

  describe('Edge Cases', () => {
    it('should handle single billing record', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '08129', facture: 'INV001' }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results).toHaveLength(0);
    });

    it('should handle rule with only ONE code (invalid rule configuration)', async () => {
      const invalidRule = {
        ...rule,
        condition: {
          ...rule.condition,
          codes: ['08129'], // Only one code - can't have prohibition
        },
      };

      const records: BillingRecord[] = [
        createBillingRecord({ code: '08129', facture: 'INV001' }),
      ];

      const results = await validateProhibition(invalidRule, records, validationRunId);

      expect(results).toHaveLength(0);
    });

    it('should handle rule with EMPTY codes array', async () => {
      const invalidRule = {
        ...rule,
        condition: {
          ...rule.condition,
          codes: [],
        },
      };

      const records: BillingRecord[] = [
        createBillingRecord({ code: '08129', facture: 'INV001' }),
        createBillingRecord({ code: '08135', facture: 'INV001' }),
      ];

      const results = await validateProhibition(invalidRule, records, validationRunId);

      expect(results).toHaveLength(0);
    });

    it('should include ruleData with invoice, codes, and context', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ id: '1', facture: 'INV999', code: '08129' }),
        createBillingRecord({ id: '2', facture: 'INV999', code: '08135' }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results[0].ruleData).toMatchObject({
        invoice: 'INV999',
        prohibitedCodes: expect.arrayContaining(['08129', '08135']),
        allCodes: expect.arrayContaining(['08129', '08135']),
      });
    });

    it('should handle multiple DIFFERENT invoices with violations', async () => {
      const records: BillingRecord[] = [
        // Invoice 1 - violation
        createBillingRecord({ id: '1', facture: 'INV001', code: '08129' }),
        createBillingRecord({ id: '2', facture: 'INV001', code: '08135' }),
        // Invoice 2 - violation
        createBillingRecord({ id: '3', facture: 'INV002', code: '08129' }),
        createBillingRecord({ id: '4', facture: 'INV002', code: '08135' }),
        // Invoice 3 - no violation
        createBillingRecord({ id: '5', facture: 'INV003', code: '08129' }),
        createBillingRecord({ id: '6', facture: 'INV003', code: '00103' }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results).toHaveLength(2); // Two violations
      expect(results[0].ruleData.invoice).toBe('INV001');
      expect(results[1].ruleData.invoice).toBe('INV002');
    });

    it('should handle records with missing dateService when facture is null', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          facture: null,
          code: '08129',
          patient: 'P001',
          dateService: undefined,
        }),
        createBillingRecord({
          id: '2',
          facture: null,
          code: '08135',
          patient: 'P001',
          dateService: undefined,
        }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      // Should still detect because they group by patient_undefined
      expect(results).toHaveLength(1);
    });
  });

  describe('Quebec-Specific Scenarios', () => {
    it('should detect prohibition in walk-in clinic context (G160)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          facture: 'INV001',
          code: '08129',
          elementContexte: 'G160', // Walk-in context
          secteurActivite: 'Cabinet',
        }),
        createBillingRecord({
          id: '2',
          facture: 'INV001',
          code: '08135',
          elementContexte: 'G160',
          secteurActivite: 'Cabinet',
        }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].message).toContain('prohibés');
    });

    it('should detect prohibition in establishment (établissement) context', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          facture: 'INV001',
          code: '08129',
          secteurActivite: 'Établissement',
          lieuPratique: '54321',
        }),
        createBillingRecord({
          id: '2',
          facture: 'INV001',
          code: '08135',
          secteurActivite: 'Établissement',
          lieuPratique: '54321',
        }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('error');
    });

    it('should handle Quebec-specific date format (ISO 8601)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          facture: 'INV001',
          code: '08129',
          dateService: '2025-02-05T00:00:00.000Z',
        }),
        createBillingRecord({
          id: '2',
          facture: 'INV001',
          code: '08135',
          dateService: '2025-02-05T00:00:00.000Z',
        }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results).toHaveLength(1);
    });

    it('should work with RAMQ ID format (alphanumeric)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          facture: 'INV001',
          code: '08129',
          idRamq: 'ABCD1234567890', // RAMQ format
        }),
        createBillingRecord({
          id: '2',
          facture: 'INV001',
          code: '08135',
          idRamq: 'ABCD1234567890',
        }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].idRamq).toBe('ABCD1234567890');
    });

    it('should handle multiple patients on same invoice (should not happen but test edge case)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          facture: 'INV001',
          code: '08129',
          patient: 'P001',
        }),
        createBillingRecord({
          id: '2',
          facture: 'INV001',
          code: '08135',
          patient: 'P002', // Different patient, same invoice
        }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      // Still flags because same invoice
      expect(results).toHaveLength(1);
    });
  });

  describe('Return Value Structure', () => {
    it('should return array of InsertValidationResult objects', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ id: '1', facture: 'INV001', code: '08129' }),
        createBillingRecord({ id: '2', facture: 'INV001', code: '08135' }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

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

    it('should return severity as "error"', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ id: '1', facture: 'INV001', code: '08129' }),
        createBillingRecord({ id: '2', facture: 'INV001', code: '08135' }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results[0].severity).toBe('error');
    });

    it('should return category as "prohibition"', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ id: '1', facture: 'INV001', code: '08129' }),
        createBillingRecord({ id: '2', facture: 'INV001', code: '08135' }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results[0].category).toBe('prohibition');
    });

    it('should include all affected record IDs', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ id: 'rec-1', facture: 'INV001', code: '08129' }),
        createBillingRecord({ id: 'rec-2', facture: 'INV001', code: '08135' }),
        createBillingRecord({ id: 'rec-3', facture: 'INV001', code: '08129' }),
      ];

      const results = await validateProhibition(rule, records, validationRunId);

      expect(results[0].affectedRecords).toEqual(
        expect.arrayContaining(['rec-1', 'rec-2', 'rec-3'])
      );
    });
  });
});
