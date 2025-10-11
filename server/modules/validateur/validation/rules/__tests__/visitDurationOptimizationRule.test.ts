import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BillingRecord, InsertValidationResult } from '@shared/schema';

/**
 * Comprehensive test suite for Visit Duration Optimization Rule
 *
 * Tests revenue optimization suggestions for converting regular consultation/visit codes
 * to intervention clinique billing (codes 8857/8859) when financially advantageous.
 *
 * Key Features Tested:
 * - Duration calculation from debut/fin fields
 * - Filtering for "B - CONSULTATION, EXAMEN ET VISITE" codes (474 codes in DB)
 * - Financial gain calculation (intervention amount vs current amount)
 * - Exclusion of codes 8857/8859 (already intervention clinique)
 * - Minimum duration threshold (30 minutes)
 * - Info summary result (always present)
 */

// Mock database query for consultation/visit codes
vi.mock("../../../../core/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          // Sample consultation/visit codes for testing
          { code: '00103', topLevel: 'B - CONSULTATION, EXAMEN ET VISITE' },
          { code: '00105', topLevel: 'B - CONSULTATION, EXAMEN ET VISITE' },
          { code: '00113', topLevel: 'B - CONSULTATION, EXAMEN ET VISITE' },
          { code: '15275', topLevel: 'B - CONSULTATION, EXAMEN ET VISITE' },
          // Add 8857/8859 to verify they're excluded
          { code: '8857', topLevel: 'B - CONSULTATION, EXAMEN ET VISITE' },
          { code: '8859', topLevel: 'B - CONSULTATION, EXAMEN ET VISITE' },
        ])
      })
    })
  }
}));

import { visitDurationOptimizationRule, resetConsultationCodeCache } from '../visitDurationOptimizationRule';

// Helper function to create test billing records with sensible defaults
function createBillingRecord(overrides: Partial<BillingRecord> = {}): BillingRecord {
  return {
    id: 'id' in overrides ? overrides.id : crypto.randomUUID(),
    validationRunId: 'validationRunId' in overrides ? overrides.validationRunId! : 'test-run-123',
    recordNumber: 'recordNumber' in overrides ? overrides.recordNumber : null,
    facture: 'facture' in overrides ? overrides.facture : 'F001',
    idRamq: 'idRamq' in overrides ? overrides.idRamq : 'R001',
    dateService: 'dateService' in overrides ? overrides.dateService : new Date('2025-01-07T10:00:00Z'),
    debut: 'debut' in overrides ? overrides.debut : '10:00',
    fin: 'fin' in overrides ? overrides.fin : '10:30',
    periode: 'periode' in overrides ? overrides.periode : null,
    lieuPratique: 'lieuPratique' in overrides ? overrides.lieuPratique : null,
    secteurActivite: 'secteurActivite' in overrides ? overrides.secteurActivite : null,
    diagnostic: 'diagnostic' in overrides ? overrides.diagnostic : null,
    code: 'code' in overrides ? overrides.code : '00103',
    unites: 'unites' in overrides ? overrides.unites : '0',
    role: 'role' in overrides ? overrides.role : null,
    elementContexte: 'elementContexte' in overrides ? overrides.elementContexte : null,
    montantPreliminaire: 'montantPreliminaire' in overrides ? overrides.montantPreliminaire : '42.50',
    montantPaye: 'montantPaye' in overrides ? overrides.montantPaye : null,
    doctorInfo: 'doctorInfo' in overrides ? overrides.doctorInfo : 'DR-001',
    patient: 'patient' in overrides ? overrides.patient : 'P001',
    createdAt: 'createdAt' in overrides ? overrides.createdAt! : new Date(),
  };
}

describe('visitDurationOptimizationRule', () => {
  const validationRunId = 'test-run-123';

  // Reset cache before each test to ensure clean state
  beforeEach(() => {
    resetConsultationCodeCache();
  });

  describe('Rule Metadata', () => {
    it('should have correct rule configuration', () => {
      expect(visitDurationOptimizationRule.id).toBe('VISIT_DURATION_OPTIMIZATION');
      expect(visitDurationOptimizationRule.name).toBe('Optimisation intervention clinique vs visite régulière');
      expect(visitDurationOptimizationRule.category).toBe('revenue_optimization');
      expect(visitDurationOptimizationRule.enabled).toBe(true);
    });
  });

  describe('Pass Scenarios - No Optimization', () => {
    it('should pass for visits < 30 minutes (too short)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '00103', debut: '10:00', fin: '10:20', montantPreliminaire: '35.00' })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(0);
    });

    it('should pass for codes already 8857 (intervention clinique)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8857', debut: '10:00', fin: '10:35', montantPreliminaire: '59.70' })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(0);
    });

    it('should pass for codes already 8859 (intervention clinique)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '8859', debut: '10:00', fin: '10:35', montantPreliminaire: '29.85' })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(0);
    });

    it('should pass when debut is missing', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '00103', debut: null, fin: '10:30', montantPreliminaire: '42.50' })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(0);
    });

    it('should pass when fin is missing', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({ code: '00103', debut: '10:00', fin: null, montantPreliminaire: '42.50' })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(0);
    });

    it('should pass when intervention NOT advantageous (current amount higher)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: '10:00',
          fin: '10:30',
          montantPreliminaire: '75.00' // Higher than intervention ($59.70)
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(0);
    });

    it('should pass for non-consultation codes (not in B category)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '19928', // Office fee, not consultation/visit
          debut: '10:00',
          fin: '10:35',
          montantPreliminaire: '6.48'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(0);
    });
  });

  describe('Optimization Scenarios', () => {
    it('should optimize 30-minute visit (8857 alone)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: '10:00',
          fin: '10:30',
          montantPreliminaire: '42.50'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(1);

      const opt = optimizations[0];
      expect(opt.message).toContain('l\'intervention clinique est plus avantageuse');
      expect(opt.message).toContain('00103');
      expect(opt.solution).toContain('180 minutes quotidien');
      expect(opt.solution).toContain('ICEP, ICSM et ICTOX');

      expect(opt.ruleData).toMatchObject({
        currentCode: '00103',
        duration: 30,
        currentAmount: '42.50',
        interventionAmount: '59.70',
        gain: '17.20',
        suggestedCodes: ['8857']
      });
    });

    it('should optimize 45-minute visit (8857 + 8859)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00113',
          debut: '14:00',
          fin: '14:45',
          montantPreliminaire: '52.00'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(1);

      const opt = optimizations[0];
      expect(opt.ruleData).toMatchObject({
        currentCode: '00113',
        duration: 45,
        interventionAmount: '89.55', // 59.70 + 29.85
        suggestedCodes: ['8857', '8859']
      });

      const gain = parseFloat(opt.ruleData?.gain as string);
      expect(gain).toBeGreaterThan(35); // Should be ~37.55
    });

    it('should optimize 60-minute visit (8857 + 8859 x2)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00105',
          debut: '09:00',
          fin: '10:00',
          montantPreliminaire: '65.00'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(1);

      const opt = optimizations[0];
      expect(opt.ruleData).toMatchObject({
        currentCode: '00105',
        duration: 60,
        interventionAmount: '119.40', // 59.70 + (2 * 29.85)
        suggestedCodes: ['8857', '8859']
      });
    });

    it('should optimize multiple visits in same file', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          debut: '10:00',
          fin: '10:35',
          montantPreliminaire: '42.50'
        }),
        createBillingRecord({
          id: '2',
          code: '00113',
          debut: '11:00',
          fin: '11:50',
          montantPreliminaire: '55.00'
        }),
        createBillingRecord({
          id: '3',
          code: '00105',
          debut: '14:00',
          fin: '14:25', // Only 25 min - no optimization
          montantPreliminaire: '35.00'
        }),
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(2); // First two should optimize, third should not
    });
  });

  describe('Edge Cases - Duration Calculation', () => {
    it('should handle exact 30-minute threshold', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: '10:00',
          fin: '10:30',
          montantPreliminaire: '40.00'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(1);
      expect(optimizations[0].ruleData?.duration).toBe(30);
    });

    it('should NOT optimize 29-minute visit (just under threshold)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: '10:00',
          fin: '10:29',
          montantPreliminaire: '40.00'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(0);
    });

    it('should handle time crossing midnight', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: '23:30',
          fin: '00:15', // 45 minutes
          montantPreliminaire: '40.00'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(1);
      expect(optimizations[0].ruleData?.duration).toBe(45);
    });

    it('should handle invalid time format gracefully (non-numeric)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: 'invalid',
          fin: '10:30',
          montantPreliminaire: '40.00'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(0);
    });

    it('should handle fin before debut gracefully (returns 0)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: '10:30',
          fin: '10:00', // Before start
          montantPreliminaire: '40.00'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(0);
    });

    it('should handle debut and fin identical (0 duration)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: '10:00',
          fin: '10:00',
          montantPreliminaire: '40.00'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(0);
    });

    it('should handle times with spaces (trimmed)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: ' 10:00 ',
          fin: ' 10:35 ',
          montantPreliminaire: '40.00'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(1);
      expect(optimizations[0].ruleData?.duration).toBe(35);
    });
  });

  describe('Edge Cases - Amount Validation', () => {
    it('should handle NULL montantPreliminaire gracefully', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: '10:00',
          fin: '10:35',
          montantPreliminaire: null
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(0);
    });

    it('should handle zero montantPreliminaire (optimization always suggested)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: '10:00',
          fin: '10:35',
          montantPreliminaire: '0.00'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(1);
      expect(parseFloat(optimizations[0].ruleData?.gain as string)).toBeCloseTo(59.70);
    });

    it('should handle exact same amount (no optimization, gain = 0)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: '10:00',
          fin: '10:30',
          montantPreliminaire: '59.70' // Exact same as intervention
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(0); // Gain is 0, so no optimization
    });
  });

  describe('Informational Summary', () => {
    it('should always include info summary when records are analyzed', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: '10:00',
          fin: '10:35',
          montantPreliminaire: '42.50'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const infoResults = results.filter(r => r.severity === 'info');
      expect(infoResults).toHaveLength(1);

      const info = infoResults[0];
      expect(info.message).toContain('Validation optimisation intervention clinique complétée');
      expect(info.message).toMatch(/\d+ visite\(s\) analysée\(s\)/);
      expect(info.message).toMatch(/\d+ opportunité\(s\) d'optimisation/);
      expect(info.message).toContain('Revenu potentiel');
    });

    it('should include statistics in info summary', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: '10:00',
          fin: '10:35',
          montantPreliminaire: '42.50'
        }),
        createBillingRecord({
          code: '00113',
          debut: '11:00',
          fin: '11:50',
          montantPreliminaire: '55.00'
        }),
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const infoResults = results.filter(r => r.severity === 'info');
      expect(infoResults).toHaveLength(1);

      const info = infoResults[0];
      expect(info.ruleData).toHaveProperty('totalAnalyzed');
      expect(info.ruleData).toHaveProperty('totalOptimizations');
      expect(info.ruleData).toHaveProperty('totalPotentialRevenue');
      expect(info.ruleData).toHaveProperty('optimizationRate');
      expect(info.ruleData).toHaveProperty('avgDuration');
      expect(info.ruleData).toHaveProperty('consultationCodesInDatabase');

      expect(info.ruleData?.totalAnalyzed).toBe(2);
      expect(info.ruleData?.totalOptimizations).toBe(2);
    });

    it('should not include info summary when no records analyzed', async () => {
      const records: BillingRecord[] = [
        // Non-consultation code (will be skipped)
        createBillingRecord({
          code: '19928',
          debut: '10:00',
          fin: '10:35',
          montantPreliminaire: '6.48'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      expect(results).toHaveLength(0); // No info, no optimizations
    });
  });

  describe('French Messages', () => {
    it('should display optimization message in French', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: '10:00',
          fin: '10:35',
          montantPreliminaire: '42.50'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations[0].message).toMatch(/intervention clinique est plus avantageuse/);
      expect(optimizations[0].message).toContain('00103');
    });

    it('should display solution message in French', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          code: '00103',
          debut: '10:00',
          fin: '10:35',
          montantPreliminaire: '42.50'
        })
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations[0].solution).toContain('Veuillez valider');
      expect(optimizations[0].solution).toContain('180 minutes quotidien');
      expect(optimizations[0].solution).toContain('ICEP, ICSM et ICTOX');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle typical medical office visit optimization', async () => {
      const records: BillingRecord[] = [
        // Short visit - no optimization
        createBillingRecord({
          id: '1',
          code: '00103',
          debut: '08:00',
          fin: '08:20',
          montantPreliminaire: '35.00',
          patient: 'P1'
        }),
        // Medium visit - optimize
        createBillingRecord({
          id: '2',
          code: '00105',
          debut: '09:00',
          fin: '09:35',
          montantPreliminaire: '42.50',
          patient: 'P2'
        }),
        // Long visit - optimize
        createBillingRecord({
          id: '3',
          code: '00113',
          debut: '10:00',
          fin: '10:55',
          montantPreliminaire: '60.00',
          patient: 'P3'
        }),
        // Already intervention clinique - no optimization
        createBillingRecord({
          id: '4',
          code: '8857',
          debut: '11:00',
          fin: '11:30',
          montantPreliminaire: '59.70',
          patient: 'P4'
        }),
      ];

      const results = await visitDurationOptimizationRule.validate(records, validationRunId);

      const optimizations = results.filter(r => r.severity === 'optimization');
      expect(optimizations).toHaveLength(2); // Only records 2 and 3

      const infoResults = results.filter(r => r.severity === 'info');
      expect(infoResults).toHaveLength(1);
      expect(infoResults[0].ruleData?.totalAnalyzed).toBe(3); // Records 1, 2, 3 (not 4, it's 8857)
    });
  });
});
