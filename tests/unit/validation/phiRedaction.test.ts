/**
 * Unit Tests for PHI Redaction System
 * Tests Quebec healthcare billing PHI (Protected Health Information) redaction
 *
 * Security Requirements:
 * - Patient IDs must be redacted using deterministic hashing
 * - Doctor information must be fully redacted
 * - RAMQ IDs must NEVER be redacted (billing data, not PHI)
 * - Privacy-first approach (redaction enabled by default)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  redactPatientId,
  redactDoctorInfo,
  redactBillingRecord,
  redactValidationResult,
  shouldRedactPhi,
} from '@/server/modules/validateur/validation/phiRedaction';
import type { BillingRecord, ValidationResult } from '@/shared/schema';

describe('PHI Redaction System', () => {
  // Store original env variable
  let originalSalt: string | undefined;

  beforeEach(() => {
    originalSalt = process.env.PHI_REDACTION_SALT;
  });

  afterEach(() => {
    // Restore original env variable
    if (originalSalt !== undefined) {
      process.env.PHI_REDACTION_SALT = originalSalt;
    } else {
      delete process.env.PHI_REDACTION_SALT;
    }
  });

  describe('redactPatientId()', () => {
    describe('Deterministic Hashing', () => {
      it('should produce same hash for same patient ID', () => {
        const patientId = '12345';

        const hash1 = redactPatientId(patientId);
        const hash2 = redactPatientId(patientId);
        const hash3 = redactPatientId(patientId);

        expect(hash1).toBe(hash2);
        expect(hash2).toBe(hash3);
      });

      it('should produce DIFFERENT hashes for different patient IDs', () => {
        const patient1 = '12345';
        const patient2 = '67890';
        const patient3 = 'ABCDE';

        const hash1 = redactPatientId(patient1);
        const hash2 = redactPatientId(patient2);
        const hash3 = redactPatientId(patient3);

        expect(hash1).not.toBe(hash2);
        expect(hash2).not.toBe(hash3);
        expect(hash1).not.toBe(hash3);
      });

      it('should use environment variable salt if provided', () => {
        const patientId = '12345';

        // Hash with default salt
        const hash1 = redactPatientId(patientId);

        // Change salt
        process.env.PHI_REDACTION_SALT = 'custom-test-salt-2025';
        const hash2 = redactPatientId(patientId);

        // Hashes should be different with different salts
        expect(hash1).not.toBe(hash2);
      });

      it('should be case-sensitive (different cases = different hashes)', () => {
        const hash1 = redactPatientId('patient123');
        const hash2 = redactPatientId('PATIENT123');
        const hash3 = redactPatientId('Patient123');

        expect(hash1).not.toBe(hash2);
        expect(hash2).not.toBe(hash3);
        expect(hash1).not.toBe(hash3);
      });
    });

    describe('Output Format', () => {
      it('should return format [PATIENT-XXXXXXXX] with 8 uppercase hex characters', () => {
        const patientId = '12345';
        const result = redactPatientId(patientId);

        expect(result).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
      });

      it('should always use uppercase letters in hash', () => {
        const patientId = 'abc123';
        const result = redactPatientId(patientId);

        expect(result).toBe(result?.toUpperCase());
        expect(result).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
      });

      it('should truncate hash to exactly 8 characters', () => {
        const patientIds = ['1', '12345', 'very-long-patient-identifier-string'];

        patientIds.forEach((id) => {
          const result = redactPatientId(id);
          const hashPart = result?.match(/\[PATIENT-([0-9A-F]{8})\]/)?.[1];

          expect(hashPart).toHaveLength(8);
        });
      });
    });

    describe('Edge Cases', () => {
      it('should return null for null input', () => {
        const result = redactPatientId(null);
        expect(result).toBeNull();
      });

      it('should return null for empty string', () => {
        const result = redactPatientId('');
        expect(result).toBeNull();
      });

      it('should handle single character patient ID', () => {
        const result = redactPatientId('X');
        expect(result).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
      });

      it('should handle very long patient IDs', () => {
        const longId = 'A'.repeat(1000);
        const result = redactPatientId(longId);

        expect(result).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
      });

      it('should handle patient IDs with special characters', () => {
        const specialIds = [
          'patient@123',
          'patient#456',
          'patient-789',
          'patient_abc',
          'patient.xyz',
        ];

        specialIds.forEach((id) => {
          const result = redactPatientId(id);
          expect(result).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
        });
      });

      it('should handle patient IDs with unicode characters', () => {
        const unicodeIds = ['patient🔒', 'пациент123', '患者ABC'];

        unicodeIds.forEach((id) => {
          const result = redactPatientId(id);
          expect(result).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
        });
      });

      it('should handle whitespace in patient IDs', () => {
        const hash1 = redactPatientId('patient 123');
        const hash2 = redactPatientId('patient123');

        // Whitespace matters - different hashes
        expect(hash1).not.toBe(hash2);
        expect(hash1).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
      });
    });

    describe('Quebec Healthcare Scenarios', () => {
      it('should handle Quebec NAM format (numeric patient IDs)', () => {
        const quebecNAM = '1234567890123'; // 13-digit NAM
        const result = redactPatientId(quebecNAM);

        expect(result).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
      });

      it('should produce consistent hashes for same patient across records', () => {
        const patientId = 'P-QC-2025-001';

        // Simulate multiple billing records for same patient
        const hash1 = redactPatientId(patientId);
        const hash2 = redactPatientId(patientId);
        const hash3 = redactPatientId(patientId);

        // Must be identical for analytics grouping
        expect(hash1).toBe(hash2);
        expect(hash2).toBe(hash3);
      });
    });
  });

  describe('redactDoctorInfo()', () => {
    describe('Full Redaction', () => {
      it('should return [REDACTED] for any doctor information', () => {
        const doctorInfos = [
          'Dr. Jean Tremblay',
          '1068303-00000',
          'Dr. Marie-Claire Dubois, MD',
          'Physician #12345',
        ];

        doctorInfos.forEach((info) => {
          const result = redactDoctorInfo(info);
          expect(result).toBe('[REDACTED]');
        });
      });

      it('should NOT use deterministic hashing (all doctors get same redaction)', () => {
        const doctor1 = 'Dr. Smith';
        const doctor2 = 'Dr. Jones';

        const result1 = redactDoctorInfo(doctor1);
        const result2 = redactDoctorInfo(doctor2);

        // Same redaction for all doctors (no tracking needed)
        expect(result1).toBe('[REDACTED]');
        expect(result2).toBe('[REDACTED]');
        expect(result1).toBe(result2);
      });
    });

    describe('Edge Cases', () => {
      it('should return null for null input', () => {
        const result = redactDoctorInfo(null);
        expect(result).toBeNull();
      });

      it('should return null for empty string', () => {
        const result = redactDoctorInfo('');
        expect(result).toBeNull();
      });

      it('should redact single character', () => {
        const result = redactDoctorInfo('X');
        expect(result).toBe('[REDACTED]');
      });

      it('should redact very long doctor information', () => {
        const longInfo = 'Doctor '.repeat(100);
        const result = redactDoctorInfo(longInfo);
        expect(result).toBe('[REDACTED]');
      });
    });

    describe('Quebec Healthcare Scenarios', () => {
      it('should redact Quebec physician license numbers', () => {
        const quebecLicense = '1068303-00000';
        const result = redactDoctorInfo(quebecLicense);
        expect(result).toBe('[REDACTED]');
      });

      it('should redact French doctor names', () => {
        const frenchNames = [
          'Dr. Jean-Pierre Lefebvre',
          'Dre Marie-Ève Gagnon',
          'Dr François Côté',
        ];

        frenchNames.forEach((name) => {
          const result = redactDoctorInfo(name);
          expect(result).toBe('[REDACTED]');
        });
      });
    });
  });

  describe('redactBillingRecord()', () => {
    // Helper to create test billing record
    function createTestRecord(overrides?: Partial<BillingRecord>): BillingRecord {
      return {
        id: 'test-record-001',
        validationRunId: 'test-run-001',
        recordNumber: '1',
        facture: 'INV-2025-001',
        idRamq: 'RAMQ-2025-12345',
        dateService: new Date('2025-02-05'),
        debut: '08:00',
        fin: '08:15',
        periode: null,
        lieuPratique: '12345',
        secteurActivite: 'Cabinet',
        diagnostic: 'A09',
        code: '00103',
        unites: null,
        role: '1',
        elementContexte: null,
        montantPreliminaire: '50.00',
        montantPaye: '50.00',
        doctorInfo: 'Dr. Jean Tremblay',
        patient: 'P-QC-12345',
        createdAt: new Date(),
        ...overrides,
      };
    }

    describe('Enabled Redaction (enabled=true)', () => {
      it('should redact patient field', () => {
        const record = createTestRecord({ patient: 'P-QC-12345' });
        const result = redactBillingRecord(record, true);

        expect(result.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
        expect(result.patient).not.toBe('P-QC-12345');
      });

      it('should redact doctorInfo field', () => {
        const record = createTestRecord({ doctorInfo: 'Dr. Jean Tremblay' });
        const result = redactBillingRecord(record, true);

        expect(result.doctorInfo).toBe('[REDACTED]');
        expect(result.doctorInfo).not.toBe('Dr. Jean Tremblay');
      });

      it('should NEVER redact idRamq field (CRITICAL)', () => {
        const originalIdRamq = 'RAMQ-2025-12345';
        const record = createTestRecord({ idRamq: originalIdRamq });
        const result = redactBillingRecord(record, true);

        // RAMQ ID must remain unchanged - it's billing data, not PHI
        expect(result.idRamq).toBe(originalIdRamq);
      });

      it('should NEVER redact facture field (invoice number)', () => {
        const originalFacture = 'INV-2025-001';
        const record = createTestRecord({ facture: originalFacture });
        const result = redactBillingRecord(record, true);

        expect(result.facture).toBe(originalFacture);
      });

      it('should preserve all other fields unchanged', () => {
        const record = createTestRecord();
        const result = redactBillingRecord(record, true);

        // Non-PHI fields should be identical
        expect(result.id).toBe(record.id);
        expect(result.validationRunId).toBe(record.validationRunId);
        expect(result.facture).toBe(record.facture);
        expect(result.idRamq).toBe(record.idRamq);
        expect(result.dateService).toBe(record.dateService);
        expect(result.code).toBe(record.code);
        expect(result.diagnostic).toBe(record.diagnostic);
        expect(result.lieuPratique).toBe(record.lieuPratique);
        expect(result.montantPreliminaire).toBe(record.montantPreliminaire);
      });

      it('should use default enabled=true when parameter omitted', () => {
        const record = createTestRecord({ patient: 'P-QC-12345' });
        const result = redactBillingRecord(record); // No enabled param

        // Should default to redacting
        expect(result.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
        expect(result.doctorInfo).toBe('[REDACTED]');
      });
    });

    describe('Disabled Redaction (enabled=false)', () => {
      it('should return unchanged record when disabled', () => {
        const record = createTestRecord({
          patient: 'P-QC-12345',
          doctorInfo: 'Dr. Jean Tremblay',
        });
        const result = redactBillingRecord(record, false);

        expect(result).toEqual(record);
        expect(result.patient).toBe('P-QC-12345');
        expect(result.doctorInfo).toBe('Dr. Jean Tremblay');
      });

      it('should not modify any fields when disabled', () => {
        const record = createTestRecord();
        const result = redactBillingRecord(record, false);

        expect(JSON.stringify(result)).toBe(JSON.stringify(record));
      });
    });

    describe('Null/Empty Field Handling', () => {
      it('should handle null patient field gracefully', () => {
        const record = createTestRecord({ patient: null });
        const result = redactBillingRecord(record, true);

        expect(result.patient).toBeNull();
      });

      it('should handle null doctorInfo field gracefully', () => {
        const record = createTestRecord({ doctorInfo: null });
        const result = redactBillingRecord(record, true);

        expect(result.doctorInfo).toBeNull();
      });

      it('should handle both fields null', () => {
        const record = createTestRecord({ patient: null, doctorInfo: null });
        const result = redactBillingRecord(record, true);

        expect(result.patient).toBeNull();
        expect(result.doctorInfo).toBeNull();
      });

      it('should handle empty string patient field', () => {
        const record = createTestRecord({ patient: '' });
        const result = redactBillingRecord(record, true);

        expect(result.patient).toBeNull();
      });
    });

    describe('Quebec Healthcare Scenarios', () => {
      it('should preserve Quebec billing codes while redacting PHI', () => {
        const record = createTestRecord({
          code: '19929',
          patient: 'P-QC-12345',
          doctorInfo: '1068303-00000',
        });
        const result = redactBillingRecord(record, true);

        // Code preserved, PHI redacted
        expect(result.code).toBe('19929');
        expect(result.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
        expect(result.doctorInfo).toBe('[REDACTED]');
      });

      it('should preserve establishment information (lieu de pratique)', () => {
        const record = createTestRecord({
          lieuPratique: '54321',
          patient: 'P-QC-12345',
        });
        const result = redactBillingRecord(record, true);

        expect(result.lieuPratique).toBe('54321');
        expect(result.patient).not.toBe('P-QC-12345');
      });

      it('should preserve context elements (#G160, #AR)', () => {
        const record = createTestRecord({
          elementContexte: 'G160',
          patient: 'P-QC-12345',
        });
        const result = redactBillingRecord(record, true);

        expect(result.elementContexte).toBe('G160');
        expect(result.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
      });

      it('should handle multiple billing records for same patient consistently', () => {
        const patient = 'P-QC-2025-001';
        const record1 = createTestRecord({ id: '1', patient, code: '19928' });
        const record2 = createTestRecord({ id: '2', patient, code: '19929' });

        const result1 = redactBillingRecord(record1, true);
        const result2 = redactBillingRecord(record2, true);

        // Same patient hash for analytics grouping
        expect(result1.patient).toBe(result2.patient);
        expect(result1.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
      });
    });

    describe('Immutability', () => {
      it('should not mutate original record object', () => {
        const originalPatient = 'P-QC-12345';
        const originalDoctor = 'Dr. Jean Tremblay';
        const record = createTestRecord({
          patient: originalPatient,
          doctorInfo: originalDoctor,
        });

        const originalRecordCopy = JSON.parse(JSON.stringify(record));

        redactBillingRecord(record, true);

        // Original record should be unchanged
        expect(record.patient).toBe(originalPatient);
        expect(record.doctorInfo).toBe(originalDoctor);
        expect(JSON.stringify(record)).toBe(JSON.stringify(originalRecordCopy));
      });
    });
  });

  describe('redactValidationResult()', () => {
    // Helper to create test validation result
    function createTestResult(
      overrides?: Partial<ValidationResult>
    ): ValidationResult {
      return {
        id: 'test-result-001',
        validationRunId: 'test-run-001',
        ruleId: 'RULE-001',
        billingRecordId: 'billing-001',
        idRamq: 'RAMQ-2025-12345',
        severity: 'error',
        category: 'prohibition',
        message: 'Codes prohibés détectés',
        solution: 'Retirer un des codes',
        affectedRecords: ['rec-1', 'rec-2'],
        ruleData: {
          invoice: 'INV-001',
          codes: ['08129', '08135'],
        },
        createdAt: new Date(),
        ...overrides,
      };
    }

    describe('Enabled Redaction (enabled=true)', () => {
      it('should redact patient field in ruleData', () => {
        const result = createTestResult({
          ruleData: {
            patient: 'P-QC-12345',
            invoice: 'INV-001',
          },
        });

        const redacted = redactValidationResult(result, true);

        expect(redacted.ruleData.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
        expect(redacted.ruleData.patient).not.toBe('P-QC-12345');
      });

      it('should redact patientId field in ruleData (alternative field name)', () => {
        const result = createTestResult({
          ruleData: {
            patientId: 'P-QC-67890',
            invoice: 'INV-001',
          },
        });

        const redacted = redactValidationResult(result, true);

        expect(redacted.ruleData.patientId).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
        expect(redacted.ruleData.patientId).not.toBe('P-QC-67890');
      });

      it('should redact doctor field in ruleData', () => {
        const result = createTestResult({
          ruleData: {
            doctor: 'Dr. Jean Tremblay',
            invoice: 'INV-001',
          },
        });

        const redacted = redactValidationResult(result, true);

        expect(redacted.ruleData.doctor).toBe('[REDACTED]');
        expect(redacted.ruleData.doctor).not.toBe('Dr. Jean Tremblay');
      });

      it('should redact doctorInfo field in ruleData (alternative field name)', () => {
        const result = createTestResult({
          ruleData: {
            doctorInfo: '1068303-00000',
            invoice: 'INV-001',
          },
        });

        const redacted = redactValidationResult(result, true);

        expect(redacted.ruleData.doctorInfo).toBe('[REDACTED]');
        expect(redacted.ruleData.doctorInfo).not.toBe('1068303-00000');
      });

      it('should NEVER redact idRamq field (CRITICAL)', () => {
        const originalIdRamq = 'RAMQ-2025-12345';
        const result = createTestResult({ idRamq: originalIdRamq });

        const redacted = redactValidationResult(result, true);

        // idRamq must remain unchanged - it's billing data, not PHI
        expect(redacted.idRamq).toBe(originalIdRamq);
      });

      it('should preserve non-PHI fields in ruleData', () => {
        const result = createTestResult({
          ruleData: {
            invoice: 'INV-001',
            codes: ['08129', '08135'],
            amount: 150.0,
            context: 'G160',
            patient: 'P-QC-12345',
          },
        });

        const redacted = redactValidationResult(result, true);

        // Non-PHI fields preserved
        expect(redacted.ruleData.invoice).toBe('INV-001');
        expect(redacted.ruleData.codes).toEqual(['08129', '08135']);
        expect(redacted.ruleData.amount).toBe(150.0);
        expect(redacted.ruleData.context).toBe('G160');

        // PHI redacted
        expect(redacted.ruleData.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
      });

      it('should use default enabled=true when parameter omitted', () => {
        const result = createTestResult({
          ruleData: { patient: 'P-QC-12345' },
        });

        const redacted = redactValidationResult(result); // No enabled param

        expect(redacted.ruleData.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
      });
    });

    describe('Disabled Redaction (enabled=false)', () => {
      it('should return unchanged result when disabled', () => {
        const result = createTestResult({
          ruleData: {
            patient: 'P-QC-12345',
            doctor: 'Dr. Jean Tremblay',
          },
        });

        const redacted = redactValidationResult(result, false);

        expect(redacted).toEqual(result);
        expect(redacted.ruleData.patient).toBe('P-QC-12345');
        expect(redacted.ruleData.doctor).toBe('Dr. Jean Tremblay');
      });
    });

    describe('Edge Cases', () => {
      it('should handle missing ruleData field gracefully', () => {
        const result = createTestResult({ ruleData: undefined });

        const redacted = redactValidationResult(result, true);

        expect(redacted.ruleData).toBeUndefined();
      });

      it('should handle null ruleData field', () => {
        const result = createTestResult({ ruleData: null });

        const redacted = redactValidationResult(result, true);

        expect(redacted.ruleData).toBeNull();
      });

      it('should handle empty ruleData object', () => {
        const result = createTestResult({ ruleData: {} });

        const redacted = redactValidationResult(result, true);

        expect(redacted.ruleData).toEqual({});
      });

      it('should handle ruleData with non-string values', () => {
        const result = createTestResult({
          ruleData: {
            patient: 12345, // Number instead of string
            count: 5,
            active: true,
          },
        });

        const redacted = redactValidationResult(result, true);

        // Non-string patient field should remain unchanged
        expect(redacted.ruleData.patient).toBe(12345);
        expect(redacted.ruleData.count).toBe(5);
        expect(redacted.ruleData.active).toBe(true);
      });

      it('should handle ruleData with nested objects', () => {
        const result = createTestResult({
          ruleData: {
            patient: 'P-QC-12345',
            details: {
              nestedPatient: 'P-QC-67890', // Not redacted (only top-level)
              invoice: 'INV-001',
            },
          },
        });

        const redacted = redactValidationResult(result, true);

        // Only top-level patient field redacted
        expect(redacted.ruleData.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
        expect(redacted.ruleData.details.nestedPatient).toBe('P-QC-67890');
      });

      it('should handle ruleData with arrays', () => {
        const result = createTestResult({
          ruleData: {
            patient: 'P-QC-12345',
            patients: ['P-QC-67890', 'P-QC-11111'], // Array not redacted
          },
        });

        const redacted = redactValidationResult(result, true);

        expect(redacted.ruleData.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
        expect(redacted.ruleData.patients).toEqual(['P-QC-67890', 'P-QC-11111']);
      });
    });

    describe('Quebec Healthcare Scenarios', () => {
      it('should preserve RAMQ invoice numbers in validation results', () => {
        const result = createTestResult({
          idRamq: 'RAMQ-2025-12345',
          ruleData: {
            patient: 'P-QC-12345',
            idRamq: 'RAMQ-2025-12345', // Also in ruleData
          },
        });

        const redacted = redactValidationResult(result, true);

        expect(redacted.idRamq).toBe('RAMQ-2025-12345');
        expect(redacted.ruleData.idRamq).toBe('RAMQ-2025-12345');
        expect(redacted.ruleData.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
      });

      it('should handle office fee validation results', () => {
        const result = createTestResult({
          category: 'office_fees',
          ruleData: {
            patient: 'P-QC-12345',
            doctor: 'Dr. Jean Tremblay',
            code: '19929',
            amount: 64.8,
            threshold: 64.8,
          },
        });

        const redacted = redactValidationResult(result, true);

        expect(redacted.ruleData.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
        expect(redacted.ruleData.doctor).toBe('[REDACTED]');
        expect(redacted.ruleData.code).toBe('19929');
        expect(redacted.ruleData.amount).toBe(64.8);
      });

      it('should handle prohibition validation results', () => {
        const result = createTestResult({
          category: 'prohibition',
          ruleData: {
            patient: 'P-QC-12345',
            invoice: 'INV-2025-001',
            prohibitedCodes: ['08129', '08135'],
          },
        });

        const redacted = redactValidationResult(result, true);

        expect(redacted.ruleData.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
        expect(redacted.ruleData.invoice).toBe('INV-2025-001');
        expect(redacted.ruleData.prohibitedCodes).toEqual(['08129', '08135']);
      });
    });

    describe('Immutability', () => {
      it('should not mutate original result object', () => {
        const result = createTestResult({
          ruleData: {
            patient: 'P-QC-12345',
            doctor: 'Dr. Jean Tremblay',
          },
        });

        const originalResultCopy = JSON.parse(JSON.stringify(result));

        redactValidationResult(result, true);

        // Original result should be unchanged
        expect(result.ruleData.patient).toBe('P-QC-12345');
        expect(result.ruleData.doctor).toBe('Dr. Jean Tremblay');
        expect(JSON.stringify(result)).toBe(JSON.stringify(originalResultCopy));
      });
    });
  });

  describe('shouldRedactPhi()', () => {
    describe('Privacy-First Defaults', () => {
      it('should return TRUE by default (privacy-first)', () => {
        const result = shouldRedactPhi(undefined);
        expect(result).toBe(true);
      });

      it('should return TRUE for null preference', () => {
        const result = shouldRedactPhi(null);
        expect(result).toBe(true);
      });
    });

    describe('Explicit Preferences', () => {
      it('should return FALSE when explicitly disabled', () => {
        const result = shouldRedactPhi(false);
        expect(result).toBe(false);
      });

      it('should return TRUE when explicitly enabled', () => {
        const result = shouldRedactPhi(true);
        expect(result).toBe(true);
      });
    });

    describe('User Preference Scenarios', () => {
      it('should respect admin user who disabled redaction', () => {
        const adminPreference = false; // Admin has access to PHI
        const result = shouldRedactPhi(adminPreference);
        expect(result).toBe(false);
      });

      it('should respect viewer user with redaction enabled', () => {
        const viewerPreference = true; // Viewer needs redaction
        const result = shouldRedactPhi(viewerPreference);
        expect(result).toBe(true);
      });

      it('should default to redaction for new users without preference', () => {
        const newUserPreference = undefined;
        const result = shouldRedactPhi(newUserPreference);
        expect(result).toBe(true);
      });
    });

    describe('Quebec Healthcare Compliance', () => {
      it('should default to redaction for RAMQ data compliance', () => {
        // By default, protect Quebec healthcare patient data
        const result = shouldRedactPhi(undefined);
        expect(result).toBe(true);
      });

      it('should allow explicit opt-out for authorized medical staff', () => {
        // Authorized medical staff can opt out
        const authorizedStaff = false;
        const result = shouldRedactPhi(authorizedStaff);
        expect(result).toBe(false);
      });
    });
  });

  describe('Integration: End-to-End Redaction Flow', () => {
    it('should redact billing records and validation results consistently', () => {
      // Simulate a billing record with PHI
      const billingRecord: BillingRecord = {
        id: 'billing-001',
        validationRunId: 'run-001',
        recordNumber: '1',
        facture: 'INV-2025-001',
        idRamq: 'RAMQ-2025-12345',
        dateService: new Date('2025-02-05'),
        debut: '08:00',
        fin: '08:15',
        periode: null,
        lieuPratique: '12345',
        secteurActivite: 'Cabinet',
        diagnostic: 'A09',
        code: '19929',
        unites: null,
        role: '1',
        elementContexte: 'G160',
        montantPreliminaire: '64.80',
        montantPaye: '64.80',
        doctorInfo: 'Dr. Jean Tremblay',
        patient: 'P-QC-2025-001',
        createdAt: new Date(),
      };

      // Simulate validation result referencing the billing record
      const validationResult: ValidationResult = {
        id: 'result-001',
        validationRunId: 'run-001',
        ruleId: 'OFFICE_FEE_19929',
        billingRecordId: 'billing-001',
        idRamq: 'RAMQ-2025-12345',
        severity: 'error',
        category: 'office_fees',
        message: 'Frais de bureau maximum dépassé',
        solution: 'Vérifier le nombre de patients inscrits',
        affectedRecords: ['billing-001'],
        ruleData: {
          patient: 'P-QC-2025-001',
          doctor: 'Dr. Jean Tremblay',
          code: '19929',
          amount: 64.8,
        },
        createdAt: new Date(),
      };

      // Redact both with privacy-first approach
      const userPreference = shouldRedactPhi(undefined); // Default: true
      const redactedRecord = redactBillingRecord(billingRecord, userPreference);
      const redactedResult = redactValidationResult(validationResult, userPreference);

      // Verify consistent redaction
      expect(redactedRecord.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);
      expect(redactedResult.ruleData.patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);

      // Same patient should have same hash
      expect(redactedRecord.patient).toBe(redactedResult.ruleData.patient);

      // Doctor info fully redacted
      expect(redactedRecord.doctorInfo).toBe('[REDACTED]');
      expect(redactedResult.ruleData.doctor).toBe('[REDACTED]');

      // RAMQ IDs NEVER redacted
      expect(redactedRecord.idRamq).toBe('RAMQ-2025-12345');
      expect(redactedResult.idRamq).toBe('RAMQ-2025-12345');

      // Billing data preserved
      expect(redactedRecord.code).toBe('19929');
      expect(redactedRecord.facture).toBe('INV-2025-001');
      expect(redactedResult.ruleData.code).toBe('19929');
    });

    it('should allow admin users to access unredacted PHI', () => {
      const billingRecord: BillingRecord = {
        id: 'billing-002',
        validationRunId: 'run-002',
        recordNumber: '2',
        facture: 'INV-2025-002',
        idRamq: 'RAMQ-2025-67890',
        dateService: new Date('2025-02-06'),
        debut: '09:00',
        fin: '09:15',
        periode: null,
        lieuPratique: '67890',
        secteurActivite: 'Établissement',
        diagnostic: 'B01',
        code: '08129',
        unites: null,
        role: '1',
        elementContexte: null,
        montantPreliminaire: '85.00',
        montantPaye: '85.00',
        doctorInfo: 'Dr. Marie Dubois',
        patient: 'P-QC-2025-002',
        createdAt: new Date(),
      };

      // Admin with redaction disabled
      const adminPreference = shouldRedactPhi(false);
      const redactedRecord = redactBillingRecord(billingRecord, adminPreference);

      // PHI not redacted for admin
      expect(redactedRecord.patient).toBe('P-QC-2025-002');
      expect(redactedRecord.doctorInfo).toBe('Dr. Marie Dubois');
      expect(redactedRecord.idRamq).toBe('RAMQ-2025-67890');
    });

    it('should handle batch redaction of multiple records with same patient', () => {
      const patient = 'P-QC-BATCH-001';

      const records: BillingRecord[] = [
        {
          id: 'batch-1',
          validationRunId: 'run-batch',
          recordNumber: '1',
          facture: 'INV-BATCH-001',
          idRamq: 'RAMQ-BATCH-001',
          dateService: new Date('2025-02-07'),
          debut: '08:00',
          fin: '08:15',
          periode: null,
          lieuPratique: '12345',
          secteurActivite: 'Cabinet',
          diagnostic: 'A09',
          code: '19928',
          unites: null,
          role: '1',
          elementContexte: null,
          montantPreliminaire: '32.40',
          montantPaye: '32.40',
          doctorInfo: 'Dr. Batch Test',
          patient: patient,
          createdAt: new Date(),
        },
        {
          id: 'batch-2',
          validationRunId: 'run-batch',
          recordNumber: '2',
          facture: 'INV-BATCH-002',
          idRamq: 'RAMQ-BATCH-002',
          dateService: new Date('2025-02-07'),
          debut: '10:00',
          fin: '10:15',
          periode: null,
          lieuPratique: '12345',
          secteurActivite: 'Cabinet',
          diagnostic: 'B02',
          code: '19929',
          unites: null,
          role: '1',
          elementContexte: null,
          montantPreliminaire: '64.80',
          montantPaye: '64.80',
          doctorInfo: 'Dr. Batch Test',
          patient: patient,
          createdAt: new Date(),
        },
      ];

      const redactedRecords = records.map((r) => redactBillingRecord(r, true));

      // All records for same patient get same hash
      expect(redactedRecords[0].patient).toBe(redactedRecords[1].patient);
      expect(redactedRecords[0].patient).toMatch(/^\[PATIENT-[0-9A-F]{8}\]$/);

      // Other fields unique per record
      expect(redactedRecords[0].id).toBe('batch-1');
      expect(redactedRecords[1].id).toBe('batch-2');
      expect(redactedRecords[0].code).toBe('19928');
      expect(redactedRecords[1].code).toBe('19929');
    });
  });
});
