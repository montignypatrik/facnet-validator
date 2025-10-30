/**
 * Comprehensive Office Fee Validation Rule Tests (19928/19929)
 *
 * Complete test coverage for all 25 scenarios defined in:
 * docs/modules/validateur/rules-implemented/OFFICE_FEE_19928_19929_UPDATED.md
 *
 * Test Categories:
 * - 11 PASS scenarios (P1-P11): Successful validations (severity: info)
 * - 8 ERROR scenarios (E1-E8): Regulation violations (severity: error)
 * - 6 OPTIMIZATION scenarios (O1-O6): Revenue opportunities (severity: optimization)
 *
 * Business Rules:
 * - Code 19928: $32.40 - Requires 6 registered OR 10 walk-in patients
 * - Code 19929: $64.80 - Requires 12 registered OR 20 walk-in patients
 * - Daily maximum: $64.80 per doctor per day
 * - Walk-in contexts: #G160, #AR
 * - Location: Cabinet only (establishment codes 5XXXX)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { officeFeeValidationRule } from '../../server/modules/validateur/validation/rules/officeFeeRule';
import type { BillingRecord, InsertValidationResult } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';

// Test data builder helpers
interface PatientVisit {
  patient: string;
  code: string;
  context?: string | null;
  montantPaye?: string;
  establishment?: string;
}

function createBillingRecords(
  visits: PatientVisit[],
  overrides: Partial<BillingRecord> = {}
): BillingRecord[] {
  const baseDate = new Date('2025-01-06');
  const baseDoctor = '1901594-22114 | Morin, Caroline - Omnipraticien';

  return visits.map((visit, index) => ({
    id: uuidv4(),
    validationRunId: uuidv4(),
    recordNumber: index + 1,
    facture: `INV-${String(index + 1).padStart(3, '0')}`,
    idRamq: `RAMQ-${String(index + 1).padStart(3, '0')}`,
    dateService: baseDate,
    debut: '09:00',
    fin: '17:00',
    periode: null,
    lieuPratique: visit.establishment || '50001', // Cabinet by default
    secteurActivite: '1',
    diagnostic: 'R51',
    code: visit.code,
    unites: null,
    role: '1',
    elementDeContexte: visit.context || null,
    montantPreliminaire: visit.code === '19929' ? '64.80' : '32.40',
    montantPaye: visit.montantPaye !== undefined ? visit.montantPaye : (visit.code === '19929' ? '64.80' : '32.40'),
    doctorInfo: baseDoctor,
    patient: visit.patient,
    grandTotal: null,
    devNoteField1: null,
    devNoteField2: null,
    devNoteField3: null,
    agence: null,
    createdAt: new Date(),
    ...overrides,
  }));
}

function createOfficeFeeRecord(
  code: '19928' | '19929',
  context?: string | null,
  overrides: Partial<BillingRecord> = {}
): BillingRecord {
  return createBillingRecords([{ patient: 'OFFICE-FEE', code, context }], overrides)[0];
}

function createPatientVisits(
  count: number,
  type: 'registered' | 'walkIn',
  paid: boolean = true
): PatientVisit[] {
  const visits: PatientVisit[] = [];
  const context = type === 'walkIn' ? '#G160' : null;

  for (let i = 1; i <= count; i++) {
    visits.push({
      patient: `P${String(i).padStart(3, '0')}`,
      code: '15804', // Regular visit code
      context,
      montantPaye: paid ? '49.15' : '0',
    });
  }

  return visits;
}

describe('Office Fee Validation (19928/19929) - Comprehensive Test Suite', () => {
  describe('PASS Scenarios (Severity: info)', () => {
    describe('P1: Valid Code 19928 - Registered Patients', () => {
      it('should validate 19928 with 8 registered paid patients', async () => {
        const patients = createPatientVisits(8, 'registered', true);
        const officeFee = createOfficeFeeRecord('19928', null);
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p1Result = results.find(r => r.ruleData?.scenarioId === 'P1');
        expect(p1Result).toBeDefined();
        expect(p1Result?.severity).toBe('info');
        expect(p1Result?.message).toContain('Validation réussie');
        expect(p1Result?.message).toContain('19928');
        expect(p1Result?.message).toContain('8 patients inscrits');
        expect(p1Result?.ruleData?.monetaryImpact).toBe(0);
        expect(p1Result?.ruleData?.registeredPaidCount).toBe(8);
        expect(p1Result?.ruleData?.code).toBe('19928');
      });

      it('should validate 19928 with exactly 6 registered patients (minimum)', async () => {
        const patients = createPatientVisits(6, 'registered', true);
        const officeFee = createOfficeFeeRecord('19928', null);
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p1Result = results.find(r => r.ruleData?.scenarioId === 'P1');
        expect(p1Result).toBeDefined();
        expect(p1Result?.severity).toBe('info');
        expect(p1Result?.ruleData?.registeredPaidCount).toBe(6);
      });

      it('should validate 19928 with 11 registered patients (maximum before upgrade)', async () => {
        const patients = createPatientVisits(11, 'registered', true);
        const officeFee = createOfficeFeeRecord('19928', null);
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p1Result = results.find(r => r.ruleData?.scenarioId === 'P1');
        expect(p1Result).toBeDefined();
        expect(p1Result?.ruleData?.registeredPaidCount).toBe(11);
      });
    });

    describe('P2: Valid Code 19928 - Walk-In Patients', () => {
      it('should validate 19928 with 15 walk-in paid patients', async () => {
        const patients = createPatientVisits(15, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19928', '#G160');
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p2Result = results.find(r => r.ruleData?.scenarioId === 'P2');
        expect(p2Result).toBeDefined();
        expect(p2Result?.severity).toBe('info');
        expect(p2Result?.message).toContain('sans rendez-vous');
        expect(p2Result?.message).toContain('15 patients');
        expect(p2Result?.ruleData?.monetaryImpact).toBe(0);
        expect(p2Result?.ruleData?.walkInPaidCount).toBe(15);
        expect(p2Result?.ruleData?.code).toBe('19928');
      });

      it('should validate 19928 with exactly 10 walk-in patients (minimum)', async () => {
        const patients = createPatientVisits(10, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19928', '#G160');
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p2Result = results.find(r => r.ruleData?.scenarioId === 'P2');
        expect(p2Result).toBeDefined();
        expect(p2Result?.ruleData?.walkInPaidCount).toBe(10);
      });

      it('should validate 19928 with walk-in patients using #AR context', async () => {
        const patients = createPatientVisits(12, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19928', '#AR'); // Alternative walk-in context
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p2Result = results.find(r => r.ruleData?.scenarioId === 'P2');
        expect(p2Result).toBeDefined();
        expect(p2Result?.ruleData?.walkInPaidCount).toBe(12);
      });
    });

    describe('P3: Valid Code 19929 - Registered Patients', () => {
      it('should validate 19929 with 15 registered paid patients', async () => {
        const patients = createPatientVisits(15, 'registered', true);
        const officeFee = createOfficeFeeRecord('19929', null);
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p3Result = results.find(r => r.ruleData?.scenarioId === 'P3');
        expect(p3Result).toBeDefined();
        expect(p3Result?.severity).toBe('info');
        expect(p3Result?.message).toContain('19929');
        expect(p3Result?.message).toContain('15 patients inscrits');
        expect(p3Result?.ruleData?.monetaryImpact).toBe(0);
        expect(p3Result?.ruleData?.registeredPaidCount).toBe(15);
        expect(p3Result?.ruleData?.totalAmount).toBe(64.80);
      });

      it('should validate 19929 with exactly 12 registered patients (minimum)', async () => {
        const patients = createPatientVisits(12, 'registered', true);
        const officeFee = createOfficeFeeRecord('19929', null);
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p3Result = results.find(r => r.ruleData?.scenarioId === 'P3');
        expect(p3Result).toBeDefined();
        expect(p3Result?.ruleData?.registeredPaidCount).toBe(12);
      });
    });

    describe('P4: Valid Code 19929 - Walk-In Patients', () => {
      it('should validate 19929 with 23 walk-in paid patients', async () => {
        const patients = createPatientVisits(23, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19929', '#G160');
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p4Result = results.find(r => r.ruleData?.scenarioId === 'P4');
        expect(p4Result).toBeDefined();
        expect(p4Result?.severity).toBe('info');
        expect(p4Result?.message).toContain('sans rendez-vous');
        expect(p4Result?.message).toContain('23 patients');
        expect(p4Result?.ruleData?.monetaryImpact).toBe(0);
        expect(p4Result?.ruleData?.walkInPaidCount).toBe(23);
      });

      it('should validate 19929 with exactly 20 walk-in patients (minimum)', async () => {
        const patients = createPatientVisits(20, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19929', '#G160');
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p4Result = results.find(r => r.ruleData?.scenarioId === 'P4');
        expect(p4Result).toBeDefined();
        expect(p4Result?.ruleData?.walkInPaidCount).toBe(20);
      });
    });

    describe('P5: Valid Double Billing Within Maximum', () => {
      it('should validate two 19928 codes totaling $64.80', async () => {
        const registeredPatients = createPatientVisits(10, 'registered', true);
        const walkInPatients = createPatientVisits(10, 'walkIn', true);
        const officeFee1 = createOfficeFeeRecord('19928', null);
        const officeFee2 = createOfficeFeeRecord('19928', '#G160');

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee1,
          officeFee2,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p5Result = results.find(r => r.ruleData?.scenarioId === 'P5');
        expect(p5Result).toBeDefined();
        expect(p5Result?.severity).toBe('info');
        expect(p5Result?.message).toContain('2 code(s)');
        expect(p5Result?.message).toContain('64,80$');
        expect(p5Result?.ruleData?.monetaryImpact).toBe(0);
        expect(p5Result?.ruleData?.billingCount).toBe(2);
        expect(p5Result?.ruleData?.totalAmount).toBe(64.80);
      });

      it('should validate 19928 + 19929 within maximum', async () => {
        const registeredPatients = createPatientVisits(6, 'registered', true);
        const walkInPatients = createPatientVisits(10, 'walkIn', true);
        const officeFee1 = createOfficeFeeRecord('19928', null);
        const officeFee2 = createOfficeFeeRecord('19928', '#G160');

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee1,
          officeFee2,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p5Result = results.find(r => r.ruleData?.scenarioId === 'P5');
        expect(p5Result).toBeDefined();
        expect(p5Result?.ruleData?.totalAmount).toBe(64.80);
      });
    });

    describe('P6: Valid Cabinet Location', () => {
      it('should validate 19928 in cabinet establishment (50001)', async () => {
        const patients = createPatientVisits(10, 'registered', true);
        const officeFee = createOfficeFeeRecord('19928', null, { lieuPratique: '50001' });
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p6Result = results.find(r => r.ruleData?.scenarioId === 'P6');
        expect(p6Result).toBeDefined();
        expect(p6Result?.severity).toBe('info');
        expect(p6Result?.message).toContain('cabinet');
        expect(p6Result?.message).toContain('50001');
        expect(p6Result?.ruleData?.establishment).toBe('50001');
        expect(p6Result?.ruleData?.code).toBe('19928');
      });

      it('should validate 19929 in different cabinet (5XXXXX)', async () => {
        const patients = createPatientVisits(12, 'registered', true);
        const officeFee = createOfficeFeeRecord('19929', null, { lieuPratique: '52345' });
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p6Result = results.find(r => r.ruleData?.scenarioId === 'P6');
        expect(p6Result).toBeDefined();
        expect(p6Result?.ruleData?.establishment).toBe('52345');
      });
    });

    describe('P7-P11: Strategic/Optimal Billing Scenarios', () => {
      it('P7: should validate optimal 19929 registered when both groups qualify', async () => {
        const registeredPatients = createPatientVisits(14, 'registered', true);
        const walkInPatients = createPatientVisits(22, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19929', null); // Chose registered

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p7Result = results.find(r => r.ruleData?.scenarioId === 'P7');
        expect(p7Result).toBeDefined();
        expect(p7Result?.severity).toBe('info');
        expect(p7Result?.message).toContain('Facturation optimale');
        expect(p7Result?.ruleData?.registeredPaidCount).toBe(14);
        expect(p7Result?.ruleData?.walkInPaidCount).toBe(22);
      });

      it('P8: should validate optimal 19929 walk-in when both groups qualify', async () => {
        const registeredPatients = createPatientVisits(14, 'registered', true);
        const walkInPatients = createPatientVisits(22, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19929', '#G160'); // Chose walk-in

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p8Result = results.find(r => r.ruleData?.scenarioId === 'P8');
        expect(p8Result).toBeDefined();
        expect(p8Result?.severity).toBe('info');
        expect(p8Result?.message).toContain('sans rendez-vous');
        expect(p8Result?.ruleData?.walkInPaidCount).toBe(22);
      });

      it('P9: should validate strategic choice when both qualify for 19929', async () => {
        const registeredPatients = createPatientVisits(13, 'registered', true);
        const walkInPatients = createPatientVisits(21, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19929', null);

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p9Result = results.find(r => r.ruleData?.scenarioId === 'P9');
        expect(p9Result).toBeDefined();
        expect(p9Result?.message).toContain('groupe choisi');
        expect(p9Result?.ruleData?.totalAmount).toBe(64.80);
      });

      it('P10: should validate strategic 19929 walk-in only', async () => {
        const registeredPatients = createPatientVisits(4, 'registered', true);
        const walkInPatients = createPatientVisits(23, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19929', '#G160');

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p10Result = results.find(r => r.ruleData?.scenarioId === 'P10');
        expect(p10Result).toBeDefined();
        expect(p10Result?.ruleData?.walkInPaidCount).toBe(23);
        expect(p10Result?.ruleData?.registeredPaidCount).toBe(4);
      });

      it('P11: should validate strategic 19929 registered only', async () => {
        const registeredPatients = createPatientVisits(18, 'registered', true);
        const walkInPatients = createPatientVisits(7, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19929', null);

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const p11Result = results.find(r => r.ruleData?.scenarioId === 'P11');
        expect(p11Result).toBeDefined();
        expect(p11Result?.ruleData?.registeredPaidCount).toBe(18);
        expect(p11Result?.ruleData?.walkInPaidCount).toBe(7);
      });
    });
  });

  describe('ERROR Scenarios (Severity: error)', () => {
    describe('E1: Insufficient Registered Patients (19928)', () => {
      it('should flag error with only 3 registered patients', async () => {
        const patients = createPatientVisits(3, 'registered', true);
        const officeFee = createOfficeFeeRecord('19928', null);
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const e1Result = results.find(r => r.ruleData?.scenarioId === 'E1');
        expect(e1Result).toBeDefined();
        expect(e1Result?.severity).toBe('error');
        expect(e1Result?.message).toContain('minimum 6 patients inscrits');
        expect(e1Result?.message).toContain('3 trouvé(s)');
        expect(e1Result?.solution).toContain('annuler');
        expect(e1Result?.ruleData?.monetaryImpact).toBe(0);
        expect(e1Result?.ruleData?.required).toBe(6);
        expect(e1Result?.ruleData?.actual).toBe(3);
      });

      it('should suggest correcting unpaid visits when present', async () => {
        const paidPatients = createPatientVisits(3, 'registered', true);
        const unpaidPatients = createPatientVisits(3, 'registered', false);
        const officeFee = createOfficeFeeRecord('19928', null);
        const records = [
          ...createBillingRecords(paidPatients),
          ...createBillingRecords(unpaidPatients),
          officeFee,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const e1Result = results.find(r => r.ruleData?.scenarioId === 'E1');
        expect(e1Result).toBeDefined();
        expect(e1Result?.solution).toContain('3 visite(s) non payée(s)');
        expect(e1Result?.ruleData?.registeredUnpaidCount).toBe(3);
      });

      it('should flag error with 5 registered patients (boundary)', async () => {
        const patients = createPatientVisits(5, 'registered', true);
        const officeFee = createOfficeFeeRecord('19928', null);
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const e1Result = results.find(r => r.ruleData?.scenarioId === 'E1');
        expect(e1Result).toBeDefined();
        expect(e1Result?.ruleData?.actual).toBe(5);
      });
    });

    describe('E2: Insufficient Walk-In Patients (19928)', () => {
      it('should flag error with only 7 walk-in patients', async () => {
        const patients = createPatientVisits(7, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19928', '#G160');
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const e2Result = results.find(r => r.ruleData?.scenarioId === 'E2');
        expect(e2Result).toBeDefined();
        expect(e2Result?.severity).toBe('error');
        expect(e2Result?.message).toContain('minimum 10 patients sans rendez-vous');
        expect(e2Result?.message).toContain('7 trouvé(s)');
        expect(e2Result?.solution).toContain('annuler');
        expect(e2Result?.ruleData?.monetaryImpact).toBe(0);
        expect(e2Result?.ruleData?.required).toBe(10);
        expect(e2Result?.ruleData?.actual).toBe(7);
      });

      it('should flag error with 9 walk-in patients (boundary)', async () => {
        const patients = createPatientVisits(9, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19928', '#G160');
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const e2Result = results.find(r => r.ruleData?.scenarioId === 'E2');
        expect(e2Result).toBeDefined();
        expect(e2Result?.ruleData?.actual).toBe(9);
      });
    });

    describe('E3: Insufficient Registered Patients (19929)', () => {
      it('should flag error with only 8 registered patients', async () => {
        const patients = createPatientVisits(8, 'registered', true);
        const officeFee = createOfficeFeeRecord('19929', null);
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const e3Result = results.find(r => r.ruleData?.scenarioId === 'E3');
        expect(e3Result).toBeDefined();
        expect(e3Result?.severity).toBe('error');
        expect(e3Result?.message).toContain('minimum 12 patients inscrits');
        expect(e3Result?.message).toContain('8 trouvé(s)');
        expect(e3Result?.solution).toContain('Changez le code 19929 pour 19928');
        expect(e3Result?.ruleData?.monetaryImpact).toBe(0);
        expect(e3Result?.ruleData?.required).toBe(12);
        expect(e3Result?.ruleData?.actual).toBe(8);
      });

      it('should flag error with 11 registered patients (boundary)', async () => {
        const patients = createPatientVisits(11, 'registered', true);
        const officeFee = createOfficeFeeRecord('19929', null);
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const e3Result = results.find(r => r.ruleData?.scenarioId === 'E3');
        expect(e3Result).toBeDefined();
        expect(e3Result?.ruleData?.actual).toBe(11);
      });
    });

    describe('E4: Insufficient Walk-In Patients (19929)', () => {
      it('should flag error with only 15 walk-in patients', async () => {
        const patients = createPatientVisits(15, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19929', '#G160');
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const e4Result = results.find(r => r.ruleData?.scenarioId === 'E4');
        expect(e4Result).toBeDefined();
        expect(e4Result?.severity).toBe('error');
        expect(e4Result?.message).toContain('minimum 20 patients sans rendez-vous');
        expect(e4Result?.message).toContain('15 trouvé(s)');
        expect(e4Result?.solution).toContain('Changez le code 19929 pour 19928');
        expect(e4Result?.ruleData?.monetaryImpact).toBe(0);
        expect(e4Result?.ruleData?.required).toBe(20);
        expect(e4Result?.ruleData?.actual).toBe(15);
      });

      it('should flag error with 19 walk-in patients (boundary)', async () => {
        const patients = createPatientVisits(19, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19929', '#G160');
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const e4Result = results.find(r => r.ruleData?.scenarioId === 'E4');
        expect(e4Result).toBeDefined();
        expect(e4Result?.ruleData?.actual).toBe(19);
      });
    });

    describe('E5: Daily Maximum Exceeded', () => {
      it('should flag error when two 19929 codes exceed $64.80', async () => {
        const registeredPatients1 = createPatientVisits(15, 'registered', true);
        const registeredPatients2 = createPatientVisits(15, 'registered', true).map((p, i) => ({
          ...p,
          patient: `P2-${String(i + 1).padStart(3, '0')}`,
        }));

        const officeFee1 = createOfficeFeeRecord('19929', null);
        const officeFee2 = createOfficeFeeRecord('19929', null);

        const records = [
          ...createBillingRecords(registeredPatients1),
          ...createBillingRecords(registeredPatients2),
          officeFee1,
          officeFee2,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const e5Result = results.find(r => r.ruleData?.scenarioId === 'E5');
        expect(e5Result).toBeDefined();
        expect(e5Result?.severity).toBe('error');
        expect(e5Result?.message).toContain('maximum quotidien de 64,80$');
        expect(e5Result?.message).toContain('dépassé');
        expect(e5Result?.message).toContain('129,60'); // Total
        expect(e5Result?.solution).toContain('annuler un des frais de bureau');
        expect(e5Result?.ruleData?.totalAmount).toBe(129.60);
        expect(e5Result?.ruleData?.excessAmount).toBe(64.80);
        expect(e5Result?.ruleData?.billingCount).toBe(2);
      });

      it('should flag error when 19928 + 19929 exceed maximum', async () => {
        const registeredPatients = createPatientVisits(12, 'registered', true);
        const walkInPatients = createPatientVisits(20, 'walkIn', true);

        const officeFee1 = createOfficeFeeRecord('19928', null);
        const officeFee2 = createOfficeFeeRecord('19929', '#G160');

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee1,
          officeFee2,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const e5Result = results.find(r => r.ruleData?.scenarioId === 'E5');
        expect(e5Result).toBeDefined();
        expect(e5Result?.ruleData?.totalAmount).toBe(97.20); // 32.40 + 64.80
      });
    });

    describe('E6: Strategic Maximum Exceeded - Should Keep 19929 Walk-In', () => {
      it('should recommend cancelling 19928 registered and keeping 19929 walk-in', async () => {
        const registeredPatients = createPatientVisits(6, 'registered', true);
        const walkInPatients = createPatientVisits(25, 'walkIn', true);

        const officeFee1 = createOfficeFeeRecord('19928', null); // Registered
        const officeFee2 = createOfficeFeeRecord('19929', '#G160'); // Walk-in

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee1,
          officeFee2,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const e6Result = results.find(r => r.ruleData?.scenarioId === 'E6');
        expect(e6Result).toBeDefined();
        expect(e6Result?.severity).toBe('error');
        expect(e6Result?.message).toContain('19928 inscrits + 19929 sans RDV');
        expect(e6Result?.solution).toContain('Annulez le 19928 inscrits');
        expect(e6Result?.solution).toContain('gardez seulement le 19929 sans RDV');
        expect(e6Result?.ruleData?.monetaryImpact).toBe(-32.40);
        expect(e6Result?.ruleData?.registeredPaidCount).toBe(6);
        expect(e6Result?.ruleData?.walkInPaidCount).toBe(25);
      });
    });

    describe('E7: Mixed Double Billing - Both Insufficient', () => {
      it('should flag error when both 19928 codes fail minimums', async () => {
        const registeredPatients = createPatientVisits(5, 'registered', true);
        const walkInPatients = createPatientVisits(8, 'walkIn', true);

        const officeFee1 = createOfficeFeeRecord('19928', null); // Registered
        const officeFee2 = createOfficeFeeRecord('19928', '#G160'); // Walk-in

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee1,
          officeFee2,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const e7Result = results.find(r => r.ruleData?.scenarioId === 'E7');
        expect(e7Result).toBeDefined();
        expect(e7Result?.severity).toBe('error');
        expect(e7Result?.message).toContain('minimum de 6 patients');
        expect(e7Result?.message).toContain('minimum de 10 patients');
        expect(e7Result?.message).toContain(`en trouve ${5}`);
        expect(e7Result?.message).toContain(`en trouve ${8}`);
        expect(e7Result?.solution).toContain('annuler les deux demandes');
        expect(e7Result?.ruleData?.monetaryImpact).toBe(0);
        expect(e7Result?.ruleData?.registeredPaidCount).toBe(5);
        expect(e7Result?.ruleData?.walkInPaidCount).toBe(8);
      });
    });

    describe('E8: Strategic Maximum Exceeded - Should Keep 19929 Registered', () => {
      it('should recommend cancelling 19928 walk-in and keeping 19929 registered', async () => {
        const registeredPatients = createPatientVisits(15, 'registered', true);
        const walkInPatients = createPatientVisits(12, 'walkIn', true);

        const officeFee1 = createOfficeFeeRecord('19929', null); // Registered
        const officeFee2 = createOfficeFeeRecord('19928', '#G160'); // Walk-in

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee1,
          officeFee2,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const e8Result = results.find(r => r.ruleData?.scenarioId === 'E8');
        expect(e8Result).toBeDefined();
        expect(e8Result?.severity).toBe('error');
        expect(e8Result?.message).toContain('19929 inscrits + 19928 sans RDV');
        expect(e8Result?.solution).toContain('Annulez le 19928 sans RDV');
        expect(e8Result?.solution).toContain('gardez seulement le 19929 inscrits');
        expect(e8Result?.ruleData?.monetaryImpact).toBe(-32.40);
        expect(e8Result?.ruleData?.registeredPaidCount).toBe(15);
        expect(e8Result?.ruleData?.walkInPaidCount).toBe(12);
      });
    });
  });

  describe('OPTIMIZATION Scenarios (Severity: optimization)', () => {
    describe('O1: Could Use Higher Code (19928 → 19929) - Registered', () => {
      it('should suggest upgrading 19928 to 19929 with 15 registered patients', async () => {
        const patients = createPatientVisits(15, 'registered', true);
        const officeFee = createOfficeFeeRecord('19928', null);
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const o1Result = results.find(r => r.ruleData?.scenarioId === 'O1');
        expect(o1Result).toBeDefined();
        expect(o1Result?.severity).toBe('optimization');
        expect(o1Result?.message).toContain('15 patients inscrits ont été vus');
        expect(o1Result?.message).toContain('droit au code 19929');
        expect(o1Result?.solution).toContain('Remplacez le code 19928 par 19929');
        expect(o1Result?.solution).toContain('gain: 32,40$');
        expect(o1Result?.ruleData?.monetaryImpact).toBe(32.40);
        expect(o1Result?.ruleData?.currentCode).toBe('19928');
        expect(o1Result?.ruleData?.suggestedCode).toBe('19929');
        expect(o1Result?.ruleData?.registeredPaidCount).toBe(15);
      });

      it('should suggest upgrade with exactly 12 patients (minimum for 19929)', async () => {
        const patients = createPatientVisits(12, 'registered', true);
        const officeFee = createOfficeFeeRecord('19928', null);
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const o1Result = results.find(r => r.ruleData?.scenarioId === 'O1');
        expect(o1Result).toBeDefined();
        expect(o1Result?.ruleData?.registeredPaidCount).toBe(12);
        expect(o1Result?.ruleData?.monetaryImpact).toBe(32.40);
      });
    });

    describe('O2: Could Use Higher Code (19928 → 19929) - Walk-In', () => {
      it('should suggest upgrading 19928 to 19929 with 23 walk-in patients', async () => {
        const patients = createPatientVisits(23, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19928', '#G160');
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const o2Result = results.find(r => r.ruleData?.scenarioId === 'O2');
        expect(o2Result).toBeDefined();
        expect(o2Result?.severity).toBe('optimization');
        expect(o2Result?.message).toContain('23 patients sans rendez-vous');
        expect(o2Result?.message).toContain('droit au code 19929');
        expect(o2Result?.solution).toContain('Remplacez le code 19928 par 19929');
        expect(o2Result?.solution).toContain('gain: 32,40$');
        expect(o2Result?.ruleData?.monetaryImpact).toBe(32.40);
        expect(o2Result?.ruleData?.currentCode).toBe('19928');
        expect(o2Result?.ruleData?.suggestedCode).toBe('19929');
        expect(o2Result?.ruleData?.walkInPaidCount).toBe(23);
      });

      it('should suggest upgrade with exactly 20 walk-in patients (minimum)', async () => {
        const patients = createPatientVisits(20, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19928', '#G160');
        const records = [...createBillingRecords(patients), officeFee];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const o2Result = results.find(r => r.ruleData?.scenarioId === 'O2');
        expect(o2Result).toBeDefined();
        expect(o2Result?.ruleData?.walkInPaidCount).toBe(20);
      });
    });

    describe('O3: Could Add Second Billing - Walk-In Available', () => {
      it('should suggest adding second 19928 for walk-in patients', async () => {
        const registeredPatients = createPatientVisits(8, 'registered', true);
        const walkInPatients = createPatientVisits(15, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19928', null); // Only registered billed

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const o3Result = results.find(r => r.ruleData?.scenarioId === 'O3');
        expect(o3Result).toBeDefined();
        expect(o3Result?.severity).toBe('optimization');
        expect(o3Result?.message).toContain('15 patients sans RDV');
        expect(o3Result?.message).toContain('facturer un autre 19928');
        expect(o3Result?.solution).toContain('Ajoutez un deuxième 19928 pour les patients sans RDV');
        expect(o3Result?.solution).toContain('gain: 32,40$');
        expect(o3Result?.ruleData?.monetaryImpact).toBe(32.40);
        expect(o3Result?.ruleData?.currentAmount).toBe(32.40);
        expect(o3Result?.ruleData?.expectedAmount).toBe(64.80);
      });
    });

    describe('O4: Could Add Second Billing - Registered Available', () => {
      it('should suggest adding second 19928 for registered patients', async () => {
        const registeredPatients = createPatientVisits(8, 'registered', true);
        const walkInPatients = createPatientVisits(15, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19928', '#G160'); // Only walk-in billed

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const o4Result = results.find(r => r.ruleData?.scenarioId === 'O4');
        expect(o4Result).toBeDefined();
        expect(o4Result?.severity).toBe('optimization');
        expect(o4Result?.message).toContain('8 patients inscrits');
        expect(o4Result?.message).toContain('facturer un autre 19928');
        expect(o4Result?.solution).toContain('Ajoutez un deuxième 19928 pour les patients inscrits');
        expect(o4Result?.solution).toContain('gain: 32,40$');
        expect(o4Result?.ruleData?.monetaryImpact).toBe(32.40);
      });
    });

    describe('O5: Could Add Second Billing - Walk-In Available (Strategic)', () => {
      it('should suggest adding walk-in billing when under maximum', async () => {
        const registeredPatients = createPatientVisits(7, 'registered', true);
        const walkInPatients = createPatientVisits(11, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19928', null);

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const o5Result = results.find(r => r.ruleData?.scenarioId === 'O5');
        expect(o5Result).toBeDefined();
        expect(o5Result?.severity).toBe('optimization');
        expect(o5Result?.message).toContain('patients sans RDV');
        expect(o5Result?.ruleData?.monetaryImpact).toBe(32.40);
      });
    });

    describe('O6: Could Add Second Billing - Registered Available (Strategic)', () => {
      it('should suggest adding registered billing when under maximum', async () => {
        const registeredPatients = createPatientVisits(9, 'registered', true);
        const walkInPatients = createPatientVisits(13, 'walkIn', true);
        const officeFee = createOfficeFeeRecord('19928', '#G160');

        const records = [
          ...createBillingRecords(registeredPatients),
          ...createBillingRecords(walkInPatients),
          officeFee,
        ];

        const results = await officeFeeValidationRule.validate(records, uuidv4());

        const o6Result = results.find(r => r.ruleData?.scenarioId === 'O6');
        expect(o6Result).toBeDefined();
        expect(o6Result?.severity).toBe('optimization');
        expect(o6Result?.message).toContain('patients inscrits');
        expect(o6Result?.ruleData?.monetaryImpact).toBe(32.40);
      });
    });
  });

  describe('Summary and Edge Cases', () => {
    it('P-SUMMARY: should generate validation summary with all scenario counts', async () => {
      const patients = createPatientVisits(8, 'registered', true);
      const officeFee = createOfficeFeeRecord('19928', null);
      const records = [...createBillingRecords(patients), officeFee];

      const results = await officeFeeValidationRule.validate(records, uuidv4());

      const summary = results.find(r => r.ruleData?.scenarioId === 'P-SUMMARY');
      expect(summary).toBeDefined();
      expect(summary?.severity).toBe('info');
      expect(summary?.message).toContain('Validation frais de bureau complétée');
      expect(summary?.ruleData).toHaveProperty('totalRecords');
      expect(summary?.ruleData).toHaveProperty('passCount');
      expect(summary?.ruleData).toHaveProperty('errorCount');
      expect(summary?.ruleData).toHaveProperty('optimizationCount');
      expect(summary?.ruleData).toHaveProperty('totalPotentialGain');
    });

    it('should handle empty records gracefully', async () => {
      const records: BillingRecord[] = [];

      const results = await officeFeeValidationRule.validate(records, uuidv4());

      const summary = results.find(r => r.ruleData?.scenarioId === 'P-SUMMARY');
      expect(summary).toBeDefined();
      expect(summary?.ruleData?.totalRecords).toBe(0);
    });

    it('should handle multiple doctors independently', async () => {
      const doctor1Patients = createPatientVisits(8, 'registered', true);
      const doctor2Patients = createPatientVisits(15, 'registered', true);

      const doctor1Fee = createOfficeFeeRecord('19928', null, {
        doctorInfo: '1901594-22114 | Morin, Caroline - Omnipraticien',
      });
      const doctor2Fee = createOfficeFeeRecord('19928', null, {
        doctorInfo: '1901595-22115 | Tremblay, Jean - Omnipraticien',
      });

      const records = [
        ...createBillingRecords(doctor1Patients, {
          doctorInfo: '1901594-22114 | Morin, Caroline - Omnipraticien',
        }),
        ...createBillingRecords(doctor2Patients, {
          doctorInfo: '1901595-22115 | Tremblay, Jean - Omnipraticien',
        }),
        doctor1Fee,
        doctor2Fee,
      ];

      const results = await officeFeeValidationRule.validate(records, uuidv4());

      // Doctor 1: P1 (valid 19928 with 8 registered)
      const doctor1Result = results.find(
        r => r.ruleData?.scenarioId === 'P1' && r.ruleData?.doctor === 'Dr. M***'
      );
      expect(doctor1Result).toBeDefined();

      // Doctor 2: O1 (could upgrade to 19929 with 15 registered)
      const doctor2Result = results.find(
        r => r.ruleData?.scenarioId === 'O1' && r.ruleData?.doctor === 'Dr. T***'
      );
      expect(doctor2Result).toBeDefined();
    });

    it('should redact doctor names for PHI compliance', async () => {
      const patients = createPatientVisits(8, 'registered', true);
      const officeFee = createOfficeFeeRecord('19928', null, {
        doctorInfo: '1901594-22114 | Morin, Caroline - Omnipraticien',
      });
      const records = [...createBillingRecords(patients), officeFee];

      const results = await officeFeeValidationRule.validate(records, uuidv4());

      const result = results.find(r => r.ruleData?.scenarioId === 'P1');
      expect(result?.ruleData?.doctor).toBe('Dr. M***');
      expect(result?.ruleData?.doctor).not.toContain('Morin');
      expect(result?.ruleData?.doctor).not.toContain('Caroline');
    });

    it('should format currency in Quebec French format', async () => {
      const registeredPatients = createPatientVisits(6, 'registered', true);
      const walkInPatients = createPatientVisits(10, 'walkIn', true);
      const officeFee1 = createOfficeFeeRecord('19928', null);
      const officeFee2 = createOfficeFeeRecord('19928', '#G160');

      const records = [
        ...createBillingRecords(registeredPatients),
        ...createBillingRecords(walkInPatients),
        officeFee1,
        officeFee2,
      ];

      const results = await officeFeeValidationRule.validate(records, uuidv4());

      const p5Result = results.find(r => r.ruleData?.scenarioId === 'P5');
      expect(p5Result).toBeDefined();
      // Message should contain Quebec format: 64,80$ (comma instead of period)
      expect(p5Result?.message).toMatch(/64,80\$/);
    });
  });
});
