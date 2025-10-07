/**
 * Annual Billing Code Validation Tests
 *
 * Tests for codes that can only be billed once per patient per calendar year
 * Identified by leaf field: "Visite de prise en charge", "Visite périodique", etc.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { validateWithRule, createMockBillingRecord } from '../utils/validationTestHelpers';
import { ValidationRule } from '../../server/modules/validateur/validation/engine';
import { BillingRecord } from '@shared/schema';

// Mock annual billing code rule matching database configuration
const annualBillingCodeRule: ValidationRule = {
  id: 'test-annual-billing-code',
  name: 'Code à facturation annuel',
  category: 'annual_limit',
  enabled: true,
  validate: async (records: BillingRecord[], validationRunId: string) => {
    // This will be handled by the database rule loader in real implementation
    // For testing, we manually import and call the handler
    const { validateAnnualBillingCode } = await import('../../server/modules/validateur/validation/ruleTypeHandlers');
    const mockRule = {
      id: 'test-annual-billing-code',
      name: 'Code à facturation annuel',
      ruleType: 'annual_billing_code',
      condition: {
        category: 'annual_limit',
        leafPatterns: [
          'Visite de prise en charge',
          'Visite périodique',
          'Visite de prise en charge d\'un problème musculo squelettique'
        ]
      },
      threshold: null,
      enabled: true
    };
    return await validateAnnualBillingCode(mockRule, records, validationRunId);
  }
};

describe('Annual Billing Code Validation', () => {

  describe('No Violations', () => {

    it('should pass when patient has single annual code in year', async () => {
      const records: BillingRecord[] = [
        createMockBillingRecord({
          code: '15815', // Visite de prise en charge
          patient: 'PATIENT-001',
          dateService: new Date('2025-03-15'),
          montantPaye: '49.15',
          doctorInfo: 'DR-001'
        })
      ];

      const results = await validateWithRule(annualBillingCodeRule, records);
      expect(results).toHaveLength(0);
    });

    it('should pass when patient has annual code in different years', async () => {
      const records: BillingRecord[] = [
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2024-06-15'),
          montantPaye: '49.15'
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-06-15'),
          montantPaye: '49.15'
        })
      ];

      const results = await validateWithRule(annualBillingCodeRule, records);
      expect(results).toHaveLength(0);
    });

    it('should pass when different patients have same annual code in same year', async () => {
      const records: BillingRecord[] = [
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-03-15'),
          montantPaye: '49.15'
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-002',
          dateService: new Date('2025-03-15'),
          montantPaye: '49.15'
        })
      ];

      const results = await validateWithRule(annualBillingCodeRule, records);
      expect(results).toHaveLength(0);
    });

  });

  describe('Multiple Paid Billings (Critical Error)', () => {

    it('should create error when patient has 2 paid billings of same annual code in same year', async () => {
      const records: BillingRecord[] = [
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-10'),
          montantPaye: '49.15', // PAID
          idRamq: 'RAMQ-001'
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-06-15'),
          montantPaye: '49.15', // PAID
          idRamq: 'RAMQ-002'
        })
      ];

      const results = await validateWithRule(annualBillingCodeRule, records);

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('error');
      expect(results[0].category).toBe('annual_limit');
      expect(results[0].message).toContain('Code annuel 15815');
      expect(results[0].message).toContain('facturé 2 fois et payé 2 fois');
      expect(results[0].message).toContain('2025');
      expect(results[0].solution).toContain('Contactez la RAMQ');
      expect(results[0].ruleData?.paidCount).toBe(2);
      expect(results[0].ruleData?.unpaidCount).toBe(0);
    });

    it('should create error when patient has 3 paid billings of same annual code', async () => {
      const records: BillingRecord[] = [
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-10'),
          montantPaye: '49.15'
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-06-15'),
          montantPaye: '49.15'
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-11-20'),
          montantPaye: '49.15'
        })
      ];

      const results = await validateWithRule(annualBillingCodeRule, records);

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('error');
      expect(results[0].message).toContain('facturé 3 fois et payé 3 fois');
      expect(results[0].ruleData?.paidCount).toBe(3);
    });

  });

  describe('Mixed Paid/Unpaid Billings (Warning)', () => {

    it('should create warning when 1 paid and 1 unpaid exist', async () => {
      const records: BillingRecord[] = [
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-10'),
          montantPaye: '49.15', // PAID
          idRamq: 'RAMQ-001'
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-06-15'),
          montantPaye: '0', // UNPAID
          idRamq: 'RAMQ-002'
        })
      ];

      const results = await validateWithRule(annualBillingCodeRule, records);

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('warning');
      expect(results[0].category).toBe('annual_limit');
      expect(results[0].message).toContain('Code annuel 15815');
      expect(results[0].message).toContain('facturé 2 fois');
      expect(results[0].message).toContain('Un est payé');
      expect(results[0].message).toContain('reste non payé');
      expect(results[0].solution).toContain('Veuillez supprimer la facture non payée');
      expect(results[0].ruleData?.paidCount).toBe(1);
      expect(results[0].ruleData?.unpaidCount).toBe(1);
    });

    it('should create warning when 1 paid and 2 unpaid exist', async () => {
      const records: BillingRecord[] = [
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-10'),
          montantPaye: '49.15', // PAID
          idRamq: 'RAMQ-001'
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-06-15'),
          montantPaye: '0', // UNPAID
          idRamq: 'RAMQ-002'
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-09-20'),
          montantPaye: '0', // UNPAID
          idRamq: 'RAMQ-003'
        })
      ];

      const results = await validateWithRule(annualBillingCodeRule, records);

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('warning');
      expect(results[0].message).toContain('facturé 3 fois');
      expect(results[0].message).toContain('2 restent non payés');
      expect(results[0].solution).toContain('Veuillez supprimer les 2 factures non payées');
      expect(results[0].ruleData?.paidCount).toBe(1);
      expect(results[0].ruleData?.unpaidCount).toBe(2);
    });

  });

  describe('All Unpaid Billings (Warning)', () => {

    it('should create warning when patient has 2 unpaid billings', async () => {
      const records: BillingRecord[] = [
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-10'),
          montantPaye: '0', // UNPAID
          idRamq: 'RAMQ-001'
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-06-15'),
          montantPaye: '0', // UNPAID
          idRamq: 'RAMQ-002'
        })
      ];

      const results = await validateWithRule(annualBillingCodeRule, records);

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('warning');
      expect(results[0].category).toBe('annual_limit');
      expect(results[0].message).toContain('Code annuel 15815');
      expect(results[0].message).toContain('facturé 2 fois');
      expect(results[0].message).toContain('tous non payés');
      expect(results[0].solution).toContain('Veuillez supprimer 1 des factures');
      expect(results[0].solution).toContain('n\'en garder qu\'une seule');
      expect(results[0].ruleData?.paidCount).toBe(0);
      expect(results[0].ruleData?.unpaidCount).toBe(2);
    });

    it('should create warning when patient has 3 unpaid billings', async () => {
      const records: BillingRecord[] = [
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-10'),
          montantPaye: '0'
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-06-15'),
          montantPaye: '0'
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-09-20'),
          montantPaye: '0'
        })
      ];

      const results = await validateWithRule(annualBillingCodeRule, records);

      expect(results).toHaveLength(1);
      expect(results[0].message).toContain('facturé 3 fois');
      expect(results[0].solution).toContain('Veuillez supprimer 2 des factures');
      expect(results[0].ruleData?.unpaidCount).toBe(3);
    });

  });

  describe('Edge Cases', () => {

    it('should handle NULL montantPaye as unpaid', async () => {
      const records: BillingRecord[] = [
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-10'),
          montantPaye: '49.15' // PAID
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-06-15'),
          montantPaye: null as any // NULL treated as UNPAID
        })
      ];

      const results = await validateWithRule(annualBillingCodeRule, records);

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('warning');
      expect(results[0].ruleData?.paidCount).toBe(1);
      expect(results[0].ruleData?.unpaidCount).toBe(1);
    });

    it('should handle multiple patients with different annual codes', async () => {
      const records: BillingRecord[] = [
        // Patient 1 with duplicate code 15815
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-10'),
          montantPaye: '49.15'
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-06-15'),
          montantPaye: '49.15'
        }),
        // Patient 2 with duplicate code 15816
        createMockBillingRecord({
          code: '15816',
          patient: 'PATIENT-002',
          dateService: new Date('2025-03-10'),
          montantPaye: '49.15'
        }),
        createMockBillingRecord({
          code: '15816',
          patient: 'PATIENT-002',
          dateService: new Date('2025-08-15'),
          montantPaye: '49.15'
        })
      ];

      const results = await validateWithRule(annualBillingCodeRule, records);

      expect(results).toHaveLength(2); // One error per patient
      expect(results.some(r => r.ruleData?.patient === 'PATIENT-001')).toBe(true);
      expect(results.some(r => r.ruleData?.patient === 'PATIENT-002')).toBe(true);
    });

    it('should only flag annual billing codes, not regular codes', async () => {
      const records: BillingRecord[] = [
        // Regular code billed multiple times (should NOT trigger this rule)
        createMockBillingRecord({
          code: '15804', // Regular follow-up visit, NOT annual
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-10'),
          montantPaye: '49.15'
        }),
        createMockBillingRecord({
          code: '15804',
          patient: 'PATIENT-001',
          dateService: new Date('2025-06-15'),
          montantPaye: '49.15'
        }),
        // Annual code billed once (should also NOT trigger)
        createMockBillingRecord({
          code: '15815', // Annual code
          patient: 'PATIENT-001',
          dateService: new Date('2025-03-20'),
          montantPaye: '49.15'
        })
      ];

      const results = await validateWithRule(annualBillingCodeRule, records);
      expect(results).toHaveLength(0); // No violations
    });

    it('should group by calendar year (January 1 - December 31)', async () => {
      const records: BillingRecord[] = [
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2024-12-31'), // End of 2024
          montantPaye: '49.15'
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-01'), // Start of 2025
          montantPaye: '49.15'
        })
      ];

      const results = await validateWithRule(annualBillingCodeRule, records);
      expect(results).toHaveLength(0); // Different calendar years, no violation
    });

  });

  describe('French Language Messages', () => {

    it('should provide French error messages for all scenarios', async () => {
      const records: BillingRecord[] = [
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-10'),
          montantPaye: '49.15'
        }),
        createMockBillingRecord({
          code: '15815',
          patient: 'PATIENT-001',
          dateService: new Date('2025-06-15'),
          montantPaye: '0'
        })
      ];

      const results = await validateWithRule(annualBillingCodeRule, records);

      expect(results).toHaveLength(1);
      // Verify French language
      expect(results[0].message).toMatch(/Code annuel|facturé|fois|payé|non payé/);
      expect(results[0].solution).toMatch(/Veuillez|supprimer|facture|année civile/);
      // Should NOT contain English words
      expect(results[0].message.toLowerCase()).not.toContain('annual');
      expect(results[0].message.toLowerCase()).not.toContain('billed');
      expect(results[0].solution?.toLowerCase()).not.toContain('delete');
      expect(results[0].solution?.toLowerCase()).not.toContain('please');
    });

  });

});
