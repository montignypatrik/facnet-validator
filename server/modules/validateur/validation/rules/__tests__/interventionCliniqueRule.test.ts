import { describe, it, expect, beforeEach } from 'vitest';
import { interventionCliniqueRule } from '../interventionCliniqueRule';
import { BillingRecord, InsertValidationResult } from '@shared/schema';

/**
 * Comprehensive test suite for the Intervention Clinique Daily Limit Rule
 *
 * Tests validation of RAMQ article 2.2.6 B:
 * "Le médecin ne peut facturer plus de 180 minutes d'interventions cliniques dans une journée"
 *
 * Key Features Tested:
 * - Codes 8857 (30 min fixed) and 8859 (variable duration from unites)
 * - Context exclusions: ICEP, ICSM, ICTOX (exact match after comma split)
 * - Daily grouping by doctor + date
 * - Violations when totalMinutes > 180 (strictly greater than)
 */

// Helper function to create test billing records with sensible defaults
function createBillingRecord(overrides: Partial<BillingRecord> = {}): BillingRecord {
  return {
    id: 'id' in overrides ? overrides.id : crypto.randomUUID(),
    validationRunId: 'validationRunId' in overrides ? overrides.validationRunId! : 'test-run-123',
    recordNumber: 'recordNumber' in overrides ? overrides.recordNumber : null,
    facture: 'facture' in overrides ? overrides.facture : 'INV001',
    idRamq: 'idRamq' in overrides ? overrides.idRamq : '15417623657',
    dateService: 'dateService' in overrides ? overrides.dateService : new Date('2025-01-07T10:00:00Z'),
    debut: 'debut' in overrides ? overrides.debut : '10:00',
    fin: 'fin' in overrides ? overrides.fin : '10:30',
    periode: 'periode' in overrides ? overrides.periode : null,
    lieuPratique: 'lieuPratique' in overrides ? overrides.lieuPratique : null,
    secteurActivite: 'secteurActivite' in overrides ? overrides.secteurActivite : null,
    diagnostic: 'diagnostic' in overrides ? overrides.diagnostic : null,
    code: 'code' in overrides ? overrides.code : '8857',
    unites: 'unites' in overrides ? overrides.unites : '0',
    role: 'role' in overrides ? overrides.role : null,
    elementContexte: 'elementContexte' in overrides ? overrides.elementContexte : null,
    montantPreliminaire: 'montantPreliminaire' in overrides ? overrides.montantPreliminaire : null,
    montantPaye: 'montantPaye' in overrides ? overrides.montantPaye : null,
    doctorInfo: 'doctorInfo' in overrides ? overrides.doctorInfo : '1068303-00000 | Krait, Aurélie',
    patient: 'patient' in overrides ? overrides.patient : 'LEPF65102328',
    createdAt: 'createdAt' in overrides ? overrides.createdAt! : new Date(),
  };
}

describe('interventionCliniqueRule', () => {
  const validationRunId = 'test-run-123';
  const defaultDoctor = '1068303-00000 | Krait, Aurélie';

  describe('Rule Metadata', () => {
    it('should have correct rule configuration', () => {
      expect(interventionCliniqueRule.id).toBe('INTERVENTION_CLINIQUE_DAILY_LIMIT');
      expect(interventionCliniqueRule.name).toBe('Limite quotidienne interventions cliniques (180 min)');
      expect(interventionCliniqueRule.category).toBe('intervention_clinique');
      expect(interventionCliniqueRule.enabled).toBe(true);
    });
  });

  describe('Pass Scenarios - Valid Cases', () => {
    it('should pass with 150 minutes (5 records of 8857)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', patient: 'P1' }),
        createBillingRecord({ code: '8857', patient: 'P2' }),
        createBillingRecord({ code: '8857', patient: 'P3' }),
        createBillingRecord({ code: '8857', patient: 'P4' }),
        createBillingRecord({ code: '8857', patient: 'P5' }),
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should pass at exactly 180 minutes (6 records of 8857)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', patient: 'P1' }),
        createBillingRecord({ code: '8857', patient: 'P2' }),
        createBillingRecord({ code: '8857', patient: 'P3' }),
        createBillingRecord({ code: '8857', patient: 'P4' }),
        createBillingRecord({ code: '8857', patient: 'P5' }),
        createBillingRecord({ code: '8857', patient: 'P6' }),
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should exclude ICEP contexts from calculation (200 total but 120 counted)', async () => {
      const records: BillingRecord[] = [
        // ICEP context - excluded (30 + 30 = 60 minutes)
        createBillingRecord({ code: '8857', elementContexte: 'ICEP', patient: 'P1' }),
        createBillingRecord({ code: '8859', unites: '30', elementContexte: 'ICEP', patient: 'P1' }),

        // No context - counted (30 minutes)
        createBillingRecord({ code: '8857', elementContexte: null, patient: 'P2' }),

        // No context - counted (30 + 60 = 90 minutes)
        createBillingRecord({ code: '8857', elementContexte: null, patient: 'P3' }),
        createBillingRecord({ code: '8859', unites: '60', elementContexte: null, patient: 'P3' }),
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should exclude ICSM contexts from calculation', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', elementContexte: 'ICSM' }),
        createBillingRecord({ code: '8859', unites: '30', elementContexte: 'ICSM' }),
        createBillingRecord({ code: '8857', elementContexte: 'ICSM' }),
        createBillingRecord({ code: '8857', elementContexte: 'ICSM' }),
        createBillingRecord({ code: '8857', elementContexte: 'ICSM' }),
        createBillingRecord({ code: '8857', elementContexte: 'ICSM' }),
        createBillingRecord({ code: '8857', elementContexte: 'ICSM' }),
        createBillingRecord({ code: '8857', elementContexte: 'ICSM' }),
        // 240 minutes total, but all excluded
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should exclude ICTOX contexts from calculation', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', elementContexte: 'ICTOX' }),
        createBillingRecord({ code: '8859', unites: '60', elementContexte: 'ICTOX' }),
        createBillingRecord({ code: '8857', elementContexte: 'ICTOX' }),
        createBillingRecord({ code: '8857', elementContexte: 'ICTOX' }),
        createBillingRecord({ code: '8857', elementContexte: 'ICTOX' }),
        // 210 minutes total, but all excluded
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should calculate separate totals for different doctors', async () => {
      const doctor1 = '1068303-00000 | Krait, Aurélie';
      const doctor2 = '2345678-00000 | Dupont, Jean';

      const records: BillingRecord[] = [
        // Doctor 1: 150 minutes
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P1' }),
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P2' }),
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P3' }),
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P4' }),
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P5' }),

        // Doctor 2: 150 minutes
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P6' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P7' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P8' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P9' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P10' }),
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should calculate separate totals for different days', async () => {
      const records: BillingRecord[] = [
        // Day 1: 180 minutes
        createBillingRecord({ dateService: new Date('2025-01-07'), code: '8857', patient: 'P1' }),
        createBillingRecord({ dateService: new Date('2025-01-07'), code: '8857', patient: 'P2' }),
        createBillingRecord({ dateService: new Date('2025-01-07'), code: '8857', patient: 'P3' }),
        createBillingRecord({ dateService: new Date('2025-01-07'), code: '8857', patient: 'P4' }),
        createBillingRecord({ dateService: new Date('2025-01-07'), code: '8857', patient: 'P5' }),
        createBillingRecord({ dateService: new Date('2025-01-07'), code: '8857', patient: 'P6' }),

        // Day 2: 180 minutes
        createBillingRecord({ dateService: new Date('2025-01-08'), code: '8857', patient: 'P7' }),
        createBillingRecord({ dateService: new Date('2025-01-08'), code: '8857', patient: 'P8' }),
        createBillingRecord({ dateService: new Date('2025-01-08'), code: '8857', patient: 'P9' }),
        createBillingRecord({ dateService: new Date('2025-01-08'), code: '8857', patient: 'P10' }),
        createBillingRecord({ dateService: new Date('2025-01-08'), code: '8857', patient: 'P11' }),
        createBillingRecord({ dateService: new Date('2025-01-08'), code: '8857', patient: 'P12' }),
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should ignore non-intervention codes', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857' }),
        createBillingRecord({ code: '8857' }),
        createBillingRecord({ code: '8857' }),
        createBillingRecord({ code: '8857' }),
        createBillingRecord({ code: '8857' }),
        createBillingRecord({ code: '8857' }),
        // 180 minutes from 8857

        // These should be ignored (not intervention codes)
        createBillingRecord({ code: '19928' }),
        createBillingRecord({ code: '08129' }),
        createBillingRecord({ code: '15275' }),
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });
  });

  describe('Fail Scenarios - Invalid Cases', () => {
    it('should fail with 210 minutes (7 records of 8857, excess = 30)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ id: '1', code: '8857', patient: 'P1', debut: '09:00' }),
        createBillingRecord({ id: '2', code: '8857', patient: 'P2', debut: '09:30' }),
        createBillingRecord({ id: '3', code: '8857', patient: 'P3', debut: '10:00' }),
        createBillingRecord({ id: '4', code: '8857', patient: 'P4', debut: '10:30' }),
        createBillingRecord({ id: '5', code: '8857', patient: 'P5', debut: '11:00' }),
        createBillingRecord({ id: '6', code: '8857', patient: 'P6', debut: '11:30' }),
        createBillingRecord({ id: '7', code: '8857', patient: 'P7', debut: '12:00' }),
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info');
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('error');
      expect(errors[0].category).toBe('intervention_clinique');
      expect(errors[0].ruleId).toBe('INTERVENTION_CLINIQUE_DAILY_LIMIT');
      expect(errors[0].message).toContain('210 minutes');
      expect(errors[0].message).toContain('180 minutes par jour');
      expect(errors[0].solution).toContain('30 minutes');
      expect(errors[0].affectedRecords).toHaveLength(7);

      // Check ruleData details
      expect(errors[0].ruleData).toMatchObject({
        totalMinutes: 210,
        limit: 180,
        excessMinutes: 30,
        code8857Minutes: 210,
        code8859Minutes: 0,
        recordCount: 7
      });
    });

    it('should fail with 195 minutes using mixed codes (8857 + 8859, excess = 15)', async () => {
      const records: BillingRecord[] = [
        // Intervention 1: 90 minutes (30 + 60)
        createBillingRecord({ id: '1', code: '8857', patient: 'P1', debut: '09:00' }),
        createBillingRecord({ id: '2', code: '8859', unites: '60', patient: 'P1', debut: '09:30' }),

        // Intervention 2: 60 minutes (30 + 30)
        createBillingRecord({ id: '3', code: '8857', patient: 'P2', debut: '10:30' }),
        createBillingRecord({ id: '4', code: '8859', unites: '30', patient: 'P2', debut: '11:00' }),

        // Intervention 3: 45 minutes (30 + 15)
        createBillingRecord({ id: '5', code: '8857', patient: 'P3', debut: '11:30' }),
        createBillingRecord({ id: '6', code: '8859', unites: '15', patient: 'P3', debut: '12:00' }),
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info');
      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe('error');
      expect(errors[0].message).toContain('195 minutes');
      expect(errors[0].solution).toContain('15 minutes');
      expect(errors[0].affectedRecords).toHaveLength(6);

      expect(errors[0].ruleData).toMatchObject({
        totalMinutes: 195,
        limit: 180,
        excessMinutes: 15,
        code8857Minutes: 90,
        code8859Minutes: 105,
        recordCount: 6
      });
    });

    it('should flag the first record chronologically as the primary violation', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ id: 'record-3', code: '8857', debut: '11:00', patient: 'P3' }),
        createBillingRecord({ id: 'record-1', code: '8857', debut: '09:00', patient: 'P1' }), // First
        createBillingRecord({ id: 'record-7', code: '8857', debut: '14:00', patient: 'P7' }),
        createBillingRecord({ id: 'record-2', code: '8857', debut: '09:30', patient: 'P2' }),
        createBillingRecord({ id: 'record-5', code: '8857', debut: '12:00', patient: 'P5' }),
        createBillingRecord({ id: 'record-6', code: '8857', debut: '13:00', patient: 'P6' }),
        createBillingRecord({ id: 'record-4', code: '8857', debut: '11:30', patient: 'P4' }),
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info');
      expect(errors).toHaveLength(1);
      expect(errors[0].billingRecordId).toBe('record-1'); // Earliest record
    });

    it('should create separate violations for different doctors exceeding limit', async () => {
      const doctor1 = '1068303-00000 | Krait, Aurélie';
      const doctor2 = '2345678-00000 | Dupont, Jean';

      const records: BillingRecord[] = [
        // Doctor 1: 210 minutes (exceeds)
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P1' }),
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P2' }),
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P3' }),
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P4' }),
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P5' }),
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P6' }),
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P7' }),

        // Doctor 2: 240 minutes (exceeds)
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P8' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P9' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P10' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P11' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P12' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P13' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P14' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P15' }),
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info');
      expect(errors).toHaveLength(2);

      const doctor1Result = errors.find(r => r.ruleData?.doctor === doctor1);
      const doctor2Result = errors.find(r => r.ruleData?.doctor === doctor2);

      expect(doctor1Result).toBeDefined();
      expect(doctor1Result?.ruleData?.totalMinutes).toBe(210);
      expect(doctor1Result?.ruleData?.excessMinutes).toBe(30);

      expect(doctor2Result).toBeDefined();
      expect(doctor2Result?.ruleData?.totalMinutes).toBe(240);
      expect(doctor2Result?.ruleData?.excessMinutes).toBe(60);
    });
  });

  describe('Edge Cases - Context Exclusion Logic', () => {
    it('should exclude mixed context "CLSC,ICEP" (contains ICEP)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', elementContexte: 'CLSC,ICEP' }),
        createBillingRecord({ code: '8857', elementContexte: 'CLSC,ICEP' }),
        createBillingRecord({ code: '8857', elementContexte: 'CLSC,ICEP' }),
        createBillingRecord({ code: '8857', elementContexte: 'CLSC,ICEP' }),
        createBillingRecord({ code: '8857', elementContexte: 'CLSC,ICEP' }),
        createBillingRecord({ code: '8857', elementContexte: 'CLSC,ICEP' }),
        createBillingRecord({ code: '8857', elementContexte: 'CLSC,ICEP' }),
        // 210 minutes, but all excluded
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should exclude mixed context "ICEP,ICSM" (contains both excluded codes)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', elementContexte: 'ICEP,ICSM' }),
        createBillingRecord({ code: '8859', unites: '60', elementContexte: 'ICEP,ICSM' }),
        createBillingRecord({ code: '8857', elementContexte: 'ICEP,ICSM' }),
        createBillingRecord({ code: '8857', elementContexte: 'ICEP,ICSM' }),
        createBillingRecord({ code: '8857', elementContexte: 'ICEP,ICSM' }),
        // 210 minutes, but all excluded
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should count context "CLSC" (not an excluded context)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', elementContexte: 'CLSC' }),
        createBillingRecord({ code: '8857', elementContexte: 'CLSC' }),
        createBillingRecord({ code: '8857', elementContexte: 'CLSC' }),
        createBillingRecord({ code: '8857', elementContexte: 'CLSC' }),
        createBillingRecord({ code: '8857', elementContexte: 'CLSC' }),
        createBillingRecord({ code: '8857', elementContexte: 'CLSC' }),
        createBillingRecord({ code: '8857', elementContexte: 'CLSC' }),
        // 210 minutes, should trigger error
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info');
      expect(errors).toHaveLength(1);
      expect(errors[0].ruleData?.totalMinutes).toBe(210);
    });

    it('should count empty string context (not excluded)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', elementContexte: '' }),
        createBillingRecord({ code: '8857', elementContexte: '' }),
        createBillingRecord({ code: '8857', elementContexte: '' }),
        createBillingRecord({ code: '8857', elementContexte: '' }),
        createBillingRecord({ code: '8857', elementContexte: '' }),
        createBillingRecord({ code: '8857', elementContexte: '' }),
        createBillingRecord({ code: '8857', elementContexte: '' }),
        // 210 minutes, should trigger error
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info');
      expect(errors).toHaveLength(1);
      expect(errors[0].ruleData?.totalMinutes).toBe(210);
    });

    it('should count NULL context (not excluded)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', elementContexte: null }),
        createBillingRecord({ code: '8857', elementContexte: null }),
        createBillingRecord({ code: '8857', elementContexte: null }),
        createBillingRecord({ code: '8857', elementContexte: null }),
        createBillingRecord({ code: '8857', elementContexte: null }),
        createBillingRecord({ code: '8857', elementContexte: null }),
        createBillingRecord({ code: '8857', elementContexte: null }),
        // 210 minutes, should trigger error
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info');
      expect(errors).toHaveLength(1);
      expect(errors[0].ruleData?.totalMinutes).toBe(210);
    });

    it('should NOT exclude "EPICENE" (false positive check - contains "ICEP" as substring)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', elementContexte: 'EPICENE' }),
        createBillingRecord({ code: '8857', elementContexte: 'EPICENE' }),
        createBillingRecord({ code: '8857', elementContexte: 'EPICENE' }),
        createBillingRecord({ code: '8857', elementContexte: 'EPICENE' }),
        createBillingRecord({ code: '8857', elementContexte: 'EPICENE' }),
        createBillingRecord({ code: '8857', elementContexte: 'EPICENE' }),
        createBillingRecord({ code: '8857', elementContexte: 'EPICENE' }),
        // 210 minutes, should trigger error (EPICENE is NOT an excluded context)
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info');
      expect(errors).toHaveLength(1);
      expect(errors[0].ruleData?.totalMinutes).toBe(210);
    });

    it('should NOT exclude "MUSICAL" (false positive check - contains "ICSM" as substring)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', elementContexte: 'MUSICAL' }),
        createBillingRecord({ code: '8857', elementContexte: 'MUSICAL' }),
        createBillingRecord({ code: '8857', elementContexte: 'MUSICAL' }),
        createBillingRecord({ code: '8857', elementContexte: 'MUSICAL' }),
        createBillingRecord({ code: '8857', elementContexte: 'MUSICAL' }),
        createBillingRecord({ code: '8857', elementContexte: 'MUSICAL' }),
        createBillingRecord({ code: '8857', elementContexte: 'MUSICAL' }),
        // 210 minutes, should trigger error (MUSICAL is NOT an excluded context)
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info');
      expect(errors).toHaveLength(1);
      expect(errors[0].ruleData?.totalMinutes).toBe(210);
    });

    it('should handle whitespace in comma-separated contexts', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', elementContexte: ' CLSC , ICEP ' }), // Whitespace around values
        createBillingRecord({ code: '8857', elementContexte: 'CLSC,ICEP' }), // No whitespace
        createBillingRecord({ code: '8857', elementContexte: 'CLSC, ICEP' }), // Space after comma
        // All should be excluded
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should handle case-insensitive context matching', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', elementContexte: 'icep' }), // Lowercase
        createBillingRecord({ code: '8857', elementContexte: 'IcEp' }), // Mixed case
        createBillingRecord({ code: '8857', elementContexte: 'ICEP' }), // Uppercase
        // All should be excluded
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });
  });

  describe('Edge Cases - Code 8859 Duration Calculation', () => {
    it('should treat code 8859 with unites=0 as 0 minutes', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857' }), // 30 min
        createBillingRecord({ code: '8859', unites: '0' }), // 0 min
        createBillingRecord({ code: '8857' }), // 30 min
        createBillingRecord({ code: '8859', unites: '0' }), // 0 min
        // Total: 60 minutes
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should treat code 8859 with NULL unites as 0 minutes', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857' }), // 30 min
        createBillingRecord({ code: '8859', unites: null }), // 0 min
        createBillingRecord({ code: '8857' }), // 30 min
        createBillingRecord({ code: '8859', unites: null }), // 0 min
        // Total: 60 minutes
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should handle code 8859 with numeric unites value', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857' }), // 30 min
        createBillingRecord({ code: '8859', unites: 45 as any }), // 45 min (numeric not string)
        createBillingRecord({ code: '8857' }), // 30 min
        createBillingRecord({ code: '8859', unites: 15 as any }), // 15 min
        // Total: 120 minutes
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should handle code 8859 with invalid/non-numeric unites as 0 minutes', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857' }), // 30 min
        createBillingRecord({ code: '8859', unites: 'invalid' }), // 0 min
        createBillingRecord({ code: '8857' }), // 30 min
        createBillingRecord({ code: '8859', unites: 'N/A' }), // 0 min
        // Total: 60 minutes
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });
  });

  describe('Edge Cases - Missing/NULL Required Fields', () => {
    it('should skip records with NULL doctorInfo', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', doctorInfo: null }),
        createBillingRecord({ code: '8857', doctorInfo: null }),
        createBillingRecord({ code: '8857', doctorInfo: null }),
        createBillingRecord({ code: '8857', doctorInfo: null }),
        createBillingRecord({ code: '8857', doctorInfo: null }),
        createBillingRecord({ code: '8857', doctorInfo: null }),
        createBillingRecord({ code: '8857', doctorInfo: null }),
        // 210 minutes, but all skipped due to missing doctorInfo
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should skip records with NULL dateService', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', dateService: null }),
        createBillingRecord({ code: '8857', dateService: null }),
        createBillingRecord({ code: '8857', dateService: null }),
        createBillingRecord({ code: '8857', dateService: null }),
        createBillingRecord({ code: '8857', dateService: null }),
        createBillingRecord({ code: '8857', dateService: null }),
        createBillingRecord({ code: '8857', dateService: null }),
        // 210 minutes, but all skipped due to missing dateService
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should process valid records and skip invalid records in mixed dataset', async () => {
      const records: BillingRecord[] = [
        // Valid records (120 minutes)
        createBillingRecord({ code: '8857', patient: 'P1' }),
        createBillingRecord({ code: '8857', patient: 'P2' }),
        createBillingRecord({ code: '8857', patient: 'P3' }),
        createBillingRecord({ code: '8857', patient: 'P4' }),

        // Invalid records (skipped)
        createBillingRecord({ code: '8857', doctorInfo: null, patient: 'P5' }),
        createBillingRecord({ code: '8857', dateService: null, patient: 'P6' }),
        createBillingRecord({ code: '8857', doctorInfo: null, dateService: null, patient: 'P7' }),
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0); // 120 minutes is under limit
    });
  });

  describe('Edge Cases - Date/Time Handling', () => {
    it('should group by date only, ignoring time component', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', dateService: new Date('2025-01-07T08:00:00Z') }),
        createBillingRecord({ code: '8857', dateService: new Date('2025-01-07T14:30:00Z') }),
        createBillingRecord({ code: '8857', dateService: new Date('2025-01-07T18:45:00Z') }),
        createBillingRecord({ code: '8857', dateService: new Date('2025-01-07T20:00:00Z') }),
        createBillingRecord({ code: '8857', dateService: new Date('2025-01-07T23:59:59Z') }),
        createBillingRecord({ code: '8857', dateService: new Date('2025-01-07T00:00:00Z') }),
        createBillingRecord({ code: '8857', dateService: new Date('2025-01-07T12:00:00Z') }),
        // All same day (2025-01-07), different times = 210 minutes total
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info');
      expect(errors).toHaveLength(1);
      expect(errors[0].ruleData?.totalMinutes).toBe(210);
      expect(errors[0].ruleData?.date).toBe('2025-01-07');
    });

    it('should handle timezone differences correctly', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', dateService: new Date('2025-01-07T23:00:00-05:00') }), // EST
        createBillingRecord({ code: '8857', dateService: new Date('2025-01-08T04:00:00Z') }), // UTC (same as above in EST)
        createBillingRecord({ code: '8857', dateService: new Date('2025-01-08T00:00:00-05:00') }), // EST next day
        createBillingRecord({ code: '8857', dateService: new Date('2025-01-08T05:00:00Z') }), // UTC (same as above in EST)
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      // First two should be grouped together, last two should be grouped together
      // Each group has 60 minutes (under limit)
      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle a typical busy day at 180 minutes (valid)', async () => {
      const records: BillingRecord[] = [
        // Morning: 3 simple patients (90 minutes)
        createBillingRecord({ code: '8857', patient: 'P1', debut: '08:00' }),
        createBillingRecord({ code: '8857', patient: 'P2', debut: '08:30' }),
        createBillingRecord({ code: '8857', patient: 'P3', debut: '09:00' }),

        // Afternoon: 2 patients with extended time (60 + 30 = 90 minutes)
        createBillingRecord({ code: '8857', patient: 'P4', debut: '13:00' }),
        createBillingRecord({ code: '8859', unites: '30', patient: 'P4', debut: '13:30' }),
        createBillingRecord({ code: '8857', patient: 'P5', debut: '14:00' }),
        // Total: 90 + 60 + 30 = 180 minutes
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info'); expect(errors).toHaveLength(0);
    });

    it('should handle mixed regular and ICEP interventions', async () => {
      const records: BillingRecord[] = [
        // ICEP interventions (excluded - 90 minutes but not counted)
        createBillingRecord({ code: '8857', elementContexte: 'ICEP', patient: 'P1', debut: '08:00' }),
        createBillingRecord({ code: '8859', unites: '60', elementContexte: 'ICEP', patient: 'P1', debut: '08:30' }),

        // Regular interventions (counted - 240 minutes total)
        // P2: 30 + 30 = 60
        createBillingRecord({ code: '8857', patient: 'P2', debut: '10:00' }),
        createBillingRecord({ code: '8859', unites: '30', patient: 'P2', debut: '10:30' }),
        // P3: 30 + 30 = 60
        createBillingRecord({ code: '8857', patient: 'P3', debut: '11:00' }),
        createBillingRecord({ code: '8859', unites: '30', patient: 'P3', debut: '11:30' }),
        // P4: 30 + 30 = 60
        createBillingRecord({ code: '8857', patient: 'P4', debut: '13:00' }),
        createBillingRecord({ code: '8859', unites: '30', patient: 'P4', debut: '13:30' }),
        // P5: 30 + 30 = 60
        createBillingRecord({ code: '8857', patient: 'P5', debut: '14:00' }),
        createBillingRecord({ code: '8859', unites: '30', patient: 'P5', debut: '14:30' }),
        // Total regular: 240 minutes (exceeds by 60)
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info');
      expect(errors).toHaveLength(1);
      expect(errors[0].ruleData?.totalMinutes).toBe(240);
      expect(errors[0].ruleData?.excessMinutes).toBe(60);
    });

    it('should handle multi-doctor clinic with one violation', async () => {
      const doctor1 = '1068303-00000 | Krait, Aurélie';
      const doctor2 = '2345678-00000 | Dupont, Jean';
      const doctor3 = '3456789-00000 | Tremblay, Marie';

      const records: BillingRecord[] = [
        // Doctor 1: 150 minutes (OK)
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P1' }),
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P2' }),
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P3' }),
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P4' }),
        createBillingRecord({ doctorInfo: doctor1, code: '8857', patient: 'P5' }),

        // Doctor 2: 210 minutes (VIOLATION)
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P6' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P7' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P8' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P9' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P10' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P11' }),
        createBillingRecord({ doctorInfo: doctor2, code: '8857', patient: 'P12' }),

        // Doctor 3: 120 minutes (OK)
        createBillingRecord({ doctorInfo: doctor3, code: '8857', patient: 'P13' }),
        createBillingRecord({ doctorInfo: doctor3, code: '8857', patient: 'P14' }),
        createBillingRecord({ doctorInfo: doctor3, code: '8857', patient: 'P15' }),
        createBillingRecord({ doctorInfo: doctor3, code: '8857', patient: 'P16' }),
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info');
      expect(errors).toHaveLength(1);
      expect(errors[0].ruleData?.doctor).toBe(doctor2);
      expect(errors[0].ruleData?.totalMinutes).toBe(210);
    });
  });

  describe('French Error Messages', () => {
    it('should display error message in French', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857' }),
        createBillingRecord({ code: '8857' }),
        createBillingRecord({ code: '8857' }),
        createBillingRecord({ code: '8857' }),
        createBillingRecord({ code: '8857' }),
        createBillingRecord({ code: '8857' }),
        createBillingRecord({ code: '8857' }),
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info');
      expect(errors[0].message).toMatch(/Limite quotidienne d'interventions cliniques dépassée/);
      expect(errors[0].message).toMatch(/minutes facturées/);
      expect(errors[0].message).toMatch(/maximum : 180 minutes par jour/);

      expect(errors[0].solution).toMatch(/Veuillez vérifier/);
      expect(errors[0].solution).toMatch(/ICEP, ICSM ou ICTOX/);
      expect(errors[0].solution).toMatch(/minutes d'interventions/);
    });

    it('should include date in French format in error message', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', dateService: new Date('2025-02-06') }),
        createBillingRecord({ code: '8857', dateService: new Date('2025-02-06') }),
        createBillingRecord({ code: '8857', dateService: new Date('2025-02-06') }),
        createBillingRecord({ code: '8857', dateService: new Date('2025-02-06') }),
        createBillingRecord({ code: '8857', dateService: new Date('2025-02-06') }),
        createBillingRecord({ code: '8857', dateService: new Date('2025-02-06') }),
        createBillingRecord({ code: '8857', dateService: new Date('2025-02-06') }),
      ];

      const results = await interventionCliniqueRule.validate(records, validationRunId);

      const errors = results.filter(r => r.severity !== 'info');
      expect(errors[0].message).toContain('2025-02-06');
      expect(errors[0].ruleData?.date).toBe('2025-02-06');
    });
  });
});
