/**
 * Unit Tests for GMF Forfait 8875 Validation Rule
 * Tests Quebec-specific GMF annual forfait billing validation
 *
 * Rule: Code 8875 (Forfait de prise en charge GMF) can only be billed once per patient
 * per calendar year. Also detects missed revenue opportunities for GMF-enrolled patients.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BillingRecord, InsertValidationResult } from '@/shared/schema';
import type { DatabaseRule } from '@/server/modules/validateur/validation/databaseRuleLoader';

// Helper to convert Partial<BillingRecord> to BillingRecord for testing
function createBillingRecord(partial: Partial<BillingRecord>): BillingRecord {
  return {
    id: partial.id || 'test-id',
    validationRunId: partial.validationRunId || 'test-run-gmf-8875',
    recordNumber: partial.recordNumber || null,
    facture: partial.facture !== undefined ? partial.facture : 'INV001',
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

describe('GMF Forfait 8875 Validation', () => {
  const validationRunId = 'test-run-gmf-8875-001';

  // Mock rule configuration
  const gmfForfaitRule: DatabaseRule = {
    id: 'GMF_FORFAIT_8875',
    name: 'Forfait de prise en charge GMF (8875)',
    ruleType: 'gmf_annual_forfait',
    condition: {
      primaryCode: '8875',
      excludedContexts: ['MTA13', 'GMFU', 'GAP', 'G160', 'AR'],
      specificVisitCodes: ['8857', '8859'],
      visitLevel1Groups: [
        'Visites sur rendez-vous (patient de 80 ans ou plus)',
        'Visites sur rendez-vous (patient de moins de 80 ans)',
      ],
    },
    threshold: null,
    enabled: true,
  };

  // Mock codes database with level1_group values
  const mockCodesDb = new Map([
    ['8875', { code: '8875', level1_group: null, description: 'Forfait GMF' }],
    ['8857', { code: '8857', level1_group: 'Visites sur rendez-vous (patient de moins de 80 ans)', description: 'Visite GMF' }],
    ['8859', { code: '8859', level1_group: 'Visites sur rendez-vous (patient de 80 ans ou plus)', description: 'Visite GMF senior' }],
    ['00103', { code: '00103', level1_group: 'Visites sur rendez-vous (patient de moins de 80 ans)', description: 'Visite sur rendez-vous' }],
    ['00113', { code: '00113', level1_group: 'Visites sur rendez-vous (patient de moins de 80 ans)', description: 'Visite sur rendez-vous' }],
    ['00105', { code: '00105', level1_group: 'Visites sur rendez-vous (patient de 80 ans ou plus)', description: 'Visite senior' }],
    ['19929', { code: '19929', level1_group: null, description: 'Frais de bureau' }],
  ]);

  // Mock establishments database with ep_33 values
  const mockEstablishmentsDb = new Map([
    ['55369', { numero: '55369', ep_33: true, nom: 'GMF Example' }],
    ['12345', { numero: '12345', ep_33: true, nom: 'GMF Test Clinic' }],
    ['99999', { numero: '99999', ep_33: false, nom: 'Non-GMF Clinic' }],
    ['88888', { numero: '88888', ep_33: null, nom: 'Unknown Status' }], // ep_33 = NULL treated as non-GMF
  ]);

  // Mock validation handler (to be implemented)
  async function validateGmfForfait8875(
    rule: DatabaseRule,
    records: BillingRecord[],
    validationRunId: string
  ): Promise<InsertValidationResult[]> {
    const results: InsertValidationResult[] = [];
    const condition = rule.condition;
    const primaryCode = condition.primaryCode || '8875';
    const excludedContexts = condition.excludedContexts || [];
    const specificVisitCodes = condition.specificVisitCodes || [];
    const visitLevel1Groups = condition.visitLevel1Groups || [];

    // Helper: Check if code is a qualifying visit
    function isQualifyingVisit(code: string): boolean {
      if (specificVisitCodes.includes(code)) return true;
      const codeData = mockCodesDb.get(code);
      if (!codeData) return false;
      return visitLevel1Groups.includes(codeData.level1_group || '');
    }

    // Helper: Check if context is excluded
    function hasExcludedContext(elementContexte: string | null): boolean {
      if (!elementContexte) return false;
      const codes = elementContexte.toUpperCase().split(',').map(c => c.trim());
      return codes.some(code => excludedContexts.includes(code));
    }

    // Helper: Check if establishment is GMF
    function isGmfEstablishment(lieuPratique: string): boolean {
      const establishment = mockEstablishmentsDb.get(lieuPratique);
      return establishment?.ep_33 === true; // ep_33 === true means GMF, false/null means non-GMF
    }

    // SCENARIO 1: Duplicate Detection (Error)
    // Group 8875 codes by patient and year
    const code8875Records = records.filter(r => r.code === primaryCode);
    const patientYearMap = new Map<string, BillingRecord[]>();

    for (const record of code8875Records) {
      if (!record.patient || !record.dateService) continue;
      const year = record.dateService.getFullYear();
      const key = `${record.patient}_${year}`;
      if (!patientYearMap.has(key)) {
        patientYearMap.set(key, []);
      }
      patientYearMap.get(key)!.push(record);
    }

    // Check for duplicates (totalCount > 1 AND paidCount > 0)
    for (const [key, billings] of patientYearMap.entries()) {
      if (billings.length <= 1) continue; // No duplicate

      const totalCount = billings.length;
      const paidBillings = billings.filter(b => (Number(b.montantPaye) || 0) > 0);
      const paidCount = paidBillings.length;

      if (paidCount > 0) {
        // Sort by date to find first paid
        const sorted = [...billings].sort((a, b) =>
          new Date(a.dateService).getTime() - new Date(b.dateService).getTime()
        );
        const firstPaidIndex = sorted.findIndex(b => (Number(b.montantPaye) || 0) > 0);
        const firstPaid = sorted[firstPaidIndex];
        const year = firstPaid.dateService.getFullYear();

        // Flag all billings AFTER first paid (Row Flagging Strategy)
        for (let i = firstPaidIndex + 1; i < sorted.length; i++) {
          results.push({
            validationRunId,
            ruleId: rule.id,
            billingRecordId: sorted[i].id,
            idRamq: sorted[i].idRamq,
            severity: 'error',
            category: 'gmf_forfait',
            message: `Le code 8875 (forfait GMF) ne peut être facturé qu'une seule fois par année civile par patient. Déjà facturé ${totalCount} fois et payé ${paidCount} fois en ${year}.`,
            solution: `Veuillez annuler cette facturation. Le forfait 8875 a déjà été payé pour ce patient le ${firstPaid.dateService.toISOString().split('T')[0]}.`,
            affectedRecords: sorted.map(b => b.id),
            ruleData: {
              patient: sorted[i].patient,
              year,
              totalCount,
              paidCount,
              firstPaidDate: firstPaid.dateService.toISOString().split('T')[0],
            },
          });
        }
      }
    }

    // SCENARIO 2: Opportunity Detection (Optimization)
    // Find patients with GMF visits but no 8875
    const visitRecords = records.filter(r =>
      isQualifyingVisit(r.code) &&
      isGmfEstablishment(r.lieuPratique || '') &&
      !hasExcludedContext(r.elementContexte)
    );

    const patientYearVisits = new Map<string, BillingRecord[]>();
    for (const record of visitRecords) {
      if (!record.patient || !record.dateService) continue;
      const year = record.dateService.getFullYear();
      const key = `${record.patient}_${year}`;
      if (!patientYearVisits.has(key)) {
        patientYearVisits.set(key, []);
      }
      patientYearVisits.get(key)!.push(record);
    }

    // Check if patient has 8875 for that year
    for (const [key, visits] of patientYearVisits.entries()) {
      const [patient, yearStr] = key.split('_');
      const year = parseInt(yearStr);

      const has8875 = code8875Records.some(c =>
        c.patient === patient && c.dateService && c.dateService.getFullYear() === year
      );

      if (!has8875) {
        // Sort to find first visit
        const sortedVisits = [...visits].sort((a, b) =>
          new Date(a.dateService).getTime() - new Date(b.dateService).getTime()
        );
        const firstVisit = sortedVisits[0];

        results.push({
          validationRunId,
          ruleId: rule.id,
          billingRecordId: firstVisit.id, // Flag FIRST visit (Row Flagging Strategy)
          idRamq: firstVisit.idRamq,
          severity: 'optimization',
          category: 'gmf_forfait',
          message: `Patient inscrit GMF avec ${visits.length} visite(s) en ${year} mais sans forfait 8875 facturé. Perte de revenu : 9,35$.`,
          solution: `Veuillez facturer le code 8875 (9,35$) lors de la première visite de l'année. Date de première visite GMF : ${firstVisit.dateService.toISOString().split('T')[0]}.`,
          affectedRecords: sortedVisits.map(v => v.id),
          ruleData: {
            patient,
            year,
            visitCount: visits.length,
            firstVisitDate: firstVisit.dateService.toISOString().split('T')[0],
            potentialRevenue: 9.35,
          },
        });
      }
    }

    return results;
  }

  describe('PASS Scenarios (No Violations)', () => {
    it('Pass Scenario 1: Single 8875 per year', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '8875',
          patient: 'PATIENT-001',
          dateService: new Date('2025-03-15'),
          montantPaye: '9.35',
          idRamq: 'R001',
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(0);
    });

    it('Pass Scenario 2: Different years (2024 vs 2025)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '8875',
          patient: 'PATIENT-001',
          dateService: new Date('2024-05-10'),
          montantPaye: '9.35',
        }),
        createBillingRecord({
          id: '2',
          code: '8875',
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-20'),
          montantPaye: '9.35',
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(0);
    });

    it('Pass Scenario 3: Patient with 8875 and visits (no optimization)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369', // GMF establishment
        }),
        createBillingRecord({
          id: '2',
          code: '8875',
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-15'),
          montantPaye: '9.35',
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(0); // No error, no optimization
    });
  });

  describe('FAIL Scenarios (Violations)', () => {
    it('Fail Scenario 1: Duplicate in same year (both paid)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '8875',
          patient: 'PATIENT-001',
          dateService: new Date('2025-01-15'),
          montantPaye: '9.35',
          idRamq: 'R001',
        }),
        createBillingRecord({
          id: '2',
          code: '8875',
          patient: 'PATIENT-001',
          dateService: new Date('2025-06-20'),
          montantPaye: '9.35',
          idRamq: 'R002',
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('error');
      expect(results[0].category).toBe('gmf_forfait');
      expect(results[0].message).toContain('Le code 8875');
      expect(results[0].message).toContain('facturé 2 fois et payé 2 fois');
      expect(results[0].message).toContain('2025');
      expect(results[0].solution).toContain('Veuillez annuler cette facturation');
      expect(results[0].solution).toContain('2025-01-15');
      expect(results[0].billingRecordId).toBe('2'); // Flags second billing (after first paid)
      expect(results[0].affectedRecords).toEqual(expect.arrayContaining(['1', '2']));
      expect(results[0].ruleData?.totalCount).toBe(2);
      expect(results[0].ruleData?.paidCount).toBe(2);
    });

    it('Fail Scenario 2: Duplicate - one paid, one unpaid', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '8875',
          patient: 'PATIENT-002',
          dateService: new Date('2025-02-10'),
          montantPaye: '9.35', // PAID
          idRamq: 'R003',
        }),
        createBillingRecord({
          id: '2',
          code: '8875',
          patient: 'PATIENT-002',
          dateService: new Date('2025-08-05'),
          montantPaye: '0', // UNPAID
          idRamq: 'R004',
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('error');
      expect(results[0].message).toContain('facturé 2 fois et payé 1 fois');
      expect(results[0].solution).toContain('2025-02-10');
      expect(results[0].billingRecordId).toBe('2'); // Flags unpaid billing
      expect(results[0].ruleData?.paidCount).toBe(1);
    });
  });

  describe('OPTIMIZATION Scenarios (Revenue Opportunities)', () => {
    it('Optimization Scenario 1: Patient with GMF visits but no 8875', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-003',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369', // GMF establishment
        }),
        createBillingRecord({
          id: '2',
          code: '00113',
          patient: 'PATIENT-003',
          dateService: new Date('2025-02-20'),
          lieuPratique: '55369',
        }),
        createBillingRecord({
          id: '3',
          code: '00105',
          patient: 'PATIENT-003',
          dateService: new Date('2025-05-10'),
          lieuPratique: '55369',
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('optimization');
      expect(results[0].category).toBe('gmf_forfait');
      expect(results[0].message).toContain('Patient inscrit GMF avec 3 visite(s) en 2025');
      expect(results[0].message).toContain('sans forfait 8875 facturé');
      expect(results[0].message).toContain('Perte de revenu : 9,35$');
      expect(results[0].solution).toContain('Veuillez facturer le code 8875');
      expect(results[0].solution).toContain('Date de première visite GMF : 2025-01-15');
      expect(results[0].billingRecordId).toBe('1'); // Flags FIRST visit
      expect(results[0].affectedRecords).toEqual(expect.arrayContaining(['1', '2', '3']));
      expect(results[0].ruleData?.visitCount).toBe(3);
    });

    it('Optimization Scenario 2: Patient with visits but all with excluded contexts (no optimization)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-004',
          dateService: new Date('2025-03-15'),
          lieuPratique: '55369',
          elementContexte: 'MTA13', // EXCLUDED
        }),
        createBillingRecord({
          id: '2',
          code: '00113',
          patient: 'PATIENT-004',
          dateService: new Date('2025-04-20'),
          lieuPratique: '55369',
          elementContexte: 'GMFU', // EXCLUDED
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(0); // No optimization due to excluded contexts
    });
  });

  describe('EDGE Cases', () => {
    it('Edge Case 1: 3 duplicates all paid', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '8875',
          patient: 'PATIENT-005',
          dateService: new Date('2025-01-10'),
          montantPaye: '9.35',
        }),
        createBillingRecord({
          id: '2',
          code: '8875',
          patient: 'PATIENT-005',
          dateService: new Date('2025-06-15'),
          montantPaye: '9.35',
        }),
        createBillingRecord({
          id: '3',
          code: '8875',
          patient: 'PATIENT-005',
          dateService: new Date('2025-11-20'),
          montantPaye: '9.35',
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(2); // 2 errors (second and third billings flagged)
      expect(results[0].severity).toBe('error');
      expect(results[0].ruleData?.totalCount).toBe(3);
      expect(results[0].ruleData?.paidCount).toBe(3);
      expect(results[0].billingRecordId).toBe('2'); // Second billing flagged
      expect(results[1].billingRecordId).toBe('3'); // Third billing flagged
    });

    it('Edge Case 2: Patient with GMF and non-GMF visits, no 8875', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-006',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369', // GMF
        }),
        createBillingRecord({
          id: '2',
          code: '00113',
          patient: 'PATIENT-006',
          dateService: new Date('2025-02-20'),
          lieuPratique: '99999', // NON-GMF
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(1); // Optimization (at least one GMF visit)
      expect(results[0].severity).toBe('optimization');
      expect(results[0].ruleData?.visitCount).toBe(1); // Only counts GMF visit
    });

    it('Edge Case 3: Context "MTA13,85" (mixte) - should exclude', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-007',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369',
          elementContexte: 'MTA13,85', // Contains MTA13 - should be excluded
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(0); // No optimization (visit excluded due to MTA13)
    });

    it('Edge Case 3b: Context "STAR" or "CARDIAC" - should NOT exclude', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-008',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369',
          elementContexte: 'STAR', // NOT excluded (not exact match to "AR")
        }),
        createBillingRecord({
          id: '2',
          code: '00103',
          patient: 'PATIENT-008',
          dateService: new Date('2025-02-20'),
          lieuPratique: '55369',
          elementContexte: 'CARDIAC', // NOT excluded
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(1); // Optimization (visits NOT excluded)
      expect(results[0].severity).toBe('optimization');
      expect(results[0].ruleData?.visitCount).toBe(2);
    });

    it('Edge Case 3c: Context "85,AR,MTA13" (multiple exclusions)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-009',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369',
          elementContexte: '85,AR,MTA13', // Contains AR and MTA13 - excluded
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(0); // No optimization (excluded)
    });

    it('Edge Case 4: montantPaye = NULL treated as unpaid', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '8875',
          patient: 'PATIENT-010',
          dateService: new Date('2025-01-10'),
          montantPaye: '9.35', // PAID
        }),
        createBillingRecord({
          id: '2',
          code: '8875',
          patient: 'PATIENT-010',
          dateService: new Date('2025-06-15'),
          montantPaye: null, // NULL = UNPAID
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('error');
      expect(results[0].ruleData?.paidCount).toBe(1);
    });

    it('Edge Case 5: Patient with visit Dec 31, 2025 and 8875 on Jan 1, 2026', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-011',
          dateService: new Date('2025-12-31T12:00:00Z'), // Explicit UTC to avoid timezone issues
          lieuPratique: '55369', // GMF establishment
        }),
        createBillingRecord({
          id: '2',
          code: '8875',
          patient: 'PATIENT-011',
          dateService: new Date('2026-01-01T12:00:00Z'), // Explicit UTC, Different year
          montantPaye: '9.35',
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      // This test verifies that calendar year boundaries are correctly handled:
      // - Patient has visit in 2025 (Dec 31)
      // - Patient has 8875 in 2026 (Jan 1)
      // - Should trigger optimization for 2025 (8875 is in different year)
      expect(results).toHaveLength(1); // Optimization for 2025 (8875 is in 2026)
      expect(results[0].severity).toBe('optimization');
      expect(results[0].ruleData?.year).toBe(2025);
    });

    it('Edge Case 6: Patient with 8875 but no visits (no optimization)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '8875',
          patient: 'PATIENT-012',
          dateService: new Date('2025-01-15'),
          montantPaye: '9.35',
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(0); // No optimization (no visits to trigger)
    });

    it('Edge Case 7: Establishment with ep_33 = NULL treated as non-GMF', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-013',
          dateService: new Date('2025-01-15'),
          lieuPratique: '88888', // ep_33 = NULL in mockEstablishmentsDb
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(0); // No optimization (not GMF)
    });

    it('Edge Case 8: Code 8857 in GMF establishment (specific visit code)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '8857',
          patient: 'PATIENT-014',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369', // GMF
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(1); // Optimization (8857 is specific visit code)
      expect(results[0].severity).toBe('optimization');
    });

    it('Edge Case 9: Code 8859 in GMF establishment (specific visit code)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '8859',
          patient: 'PATIENT-015',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369', // GMF
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(1); // Optimization (8859 is specific visit code)
      expect(results[0].severity).toBe('optimization');
    });

    it('Edge Case 10: Code in level1_group "Visites sur rendez-vous (patient de 80 ans ou plus)"', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00105',
          patient: 'PATIENT-016',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369', // GMF
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(1); // Optimization (00105 has qualifying level1_group)
      expect(results[0].severity).toBe('optimization');
    });

    it('Edge Case 11: Non-visit code in GMF establishment (no optimization)', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '19929', // Frais de bureau (not a visit code)
          patient: 'PATIENT-017',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369', // GMF
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(0); // No optimization (19929 is not a qualifying visit)
    });
  });

  describe('Context Parsing Edge Cases', () => {
    it('should handle empty context string', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-018',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369',
          elementContexte: '', // Empty string
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(1); // Optimization (empty context not excluded)
      expect(results[0].severity).toBe('optimization');
    });

    it('should handle null context', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-019',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369',
          elementContexte: null, // NULL
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(1); // Optimization (null context not excluded)
      expect(results[0].severity).toBe('optimization');
    });

    it('should handle context with whitespace "85, AR"', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-020',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369',
          elementContexte: '85, AR', // Whitespace before AR
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(0); // No optimization (AR matched after trim)
    });

    it('should be case-insensitive for context matching', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-021',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369',
          elementContexte: 'mta13', // Lowercase
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(0); // No optimization (case-insensitive match)
    });
  });

  describe('Multiple Patients Scenarios', () => {
    it('should handle multiple patients with different violations', async () => {
      const records: BillingRecord[] = [
        // Patient 1: Duplicate 8875
        createBillingRecord({
          id: '1',
          code: '8875',
          patient: 'PATIENT-A',
          dateService: new Date('2025-01-10'),
          montantPaye: '9.35',
        }),
        createBillingRecord({
          id: '2',
          code: '8875',
          patient: 'PATIENT-A',
          dateService: new Date('2025-06-15'),
          montantPaye: '9.35',
        }),
        // Patient 2: Missing 8875 (optimization)
        createBillingRecord({
          id: '3',
          code: '00103',
          patient: 'PATIENT-B',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369',
        }),
        // Patient 3: Valid (single 8875)
        createBillingRecord({
          id: '4',
          code: '8875',
          patient: 'PATIENT-C',
          dateService: new Date('2025-01-15'),
          montantPaye: '9.35',
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(2); // 1 error + 1 optimization

      const errorResult = results.find(r => r.severity === 'error');
      const optimizationResult = results.find(r => r.severity === 'optimization');

      expect(errorResult).toBeDefined();
      expect(errorResult?.ruleData?.patient).toBe('PATIENT-A');

      expect(optimizationResult).toBeDefined();
      expect(optimizationResult?.ruleData?.patient).toBe('PATIENT-B');
    });
  });

  describe('Return Value Structure', () => {
    it('should return correct structure for error results', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '8875',
          patient: 'PATIENT-TEST',
          dateService: new Date('2025-01-15'),
          montantPaye: '9.35',
          idRamq: 'R-TEST-001',
        }),
        createBillingRecord({
          id: '2',
          code: '8875',
          patient: 'PATIENT-TEST',
          dateService: new Date('2025-06-20'),
          montantPaye: '9.35',
          idRamq: 'R-TEST-002',
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        validationRunId,
        ruleId: gmfForfaitRule.id,
        billingRecordId: '2',
        idRamq: 'R-TEST-002',
        severity: 'error',
        category: 'gmf_forfait',
      });
      expect(results[0]).toHaveProperty('message');
      expect(results[0]).toHaveProperty('solution');
      expect(results[0]).toHaveProperty('affectedRecords');
      expect(results[0]).toHaveProperty('ruleData');
    });

    it('should return correct structure for optimization results', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-OPT',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369',
          idRamq: 'R-OPT-001',
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        validationRunId,
        ruleId: gmfForfaitRule.id,
        billingRecordId: '1',
        idRamq: 'R-OPT-001',
        severity: 'optimization',
        category: 'gmf_forfait',
      });
      expect(results[0].message).toContain('Perte de revenu : 9,35$');
      expect(results[0].solution).toContain('Veuillez facturer le code 8875');
    });
  });

  describe('French Language Validation', () => {
    it('should provide French error messages', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '8875',
          patient: 'PATIENT-FR',
          dateService: new Date('2025-01-15'),
          montantPaye: '9.35',
        }),
        createBillingRecord({
          id: '2',
          code: '8875',
          patient: 'PATIENT-FR',
          dateService: new Date('2025-06-20'),
          montantPaye: '9.35',
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results[0].message).toMatch(/Le code|facturé|fois|payé|année civile/);
      expect(results[0].solution).toMatch(/Veuillez|annuler|facturation/);

      // Should NOT contain English-only words (note: "code" is also a French word)
      expect(results[0].message.toLowerCase()).not.toContain('billed');
      expect(results[0].solution?.toLowerCase()).not.toContain('please');
      expect(results[0].solution?.toLowerCase()).not.toContain('delete');
    });

    it('should provide French optimization messages', async () => {
      const records: BillingRecord[] = [
        createBillingRecord({
          id: '1',
          code: '00103',
          patient: 'PATIENT-FR-OPT',
          dateService: new Date('2025-01-15'),
          lieuPratique: '55369',
        }),
      ];

      const results = await validateGmfForfait8875(gmfForfaitRule, records, validationRunId);

      expect(results[0].message).toMatch(/Patient|inscrit|GMF|visite|forfait|Perte de revenu/);
      expect(results[0].solution).toMatch(/Veuillez|facturer|première visite/);
    });
  });
});
