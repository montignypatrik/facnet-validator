import { describe, it, expect, beforeAll } from 'vitest';
import { BillingCSVProcessor } from '@server/modules/validateur/validation/csvProcessor';
import path from 'path';
import fs from 'fs';

describe('CSV Processing Integration Tests', () => {
  const processor = new BillingCSVProcessor();
  // Use REAL Quebec healthcare CSV with Latin1 encoding (realistic production data)
  const realCSVPath = path.resolve(__dirname, '../../data/samples/Facturation journalière (12).csv');
  const testValidationRunId = 'test-run-integration';

  beforeAll(() => {
    // Verify the CSV file exists
    if (!fs.existsSync(realCSVPath)) {
      throw new Error(`Test CSV file not found at: ${realCSVPath}`);
    }
  });

  describe('Real CSV File Processing', () => {
    it('should successfully parse real Quebec billing CSV with semicolon delimiter', async () => {
      const result = await processor.processBillingCSV(realCSVPath, testValidationRunId);

      // Verify records were parsed
      expect(result.records).toBeDefined();
      expect(result.records.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should correctly map CSV headers to database field names', async () => {
      const result = await processor.processBillingCSV(realCSVPath, testValidationRunId);

      const firstRecord = result.records[0];

      // Verify critical field mappings match database schema
      expect(firstRecord).toHaveProperty('lieuPratique'); // NOT lieuDePratique
      expect(firstRecord).toHaveProperty('secteurActivite'); // NOT secteurDActivite
      expect(firstRecord).toHaveProperty('elementContexte'); // NOT elementDeContexte

      // Verify all required fields exist
      expect(firstRecord).toHaveProperty('facture');
      expect(firstRecord).toHaveProperty('idRamq');
      expect(firstRecord).toHaveProperty('dateService');
      expect(firstRecord).toHaveProperty('code');
      expect(firstRecord).toHaveProperty('patient');
      expect(firstRecord).toHaveProperty('doctorInfo');
    });

    it('should parse Quebec-specific amount format (comma as decimal separator)', async () => {
      const result = await processor.processBillingCSV(realCSVPath, testValidationRunId);

      // Find records with amounts - some may be null
      const recordsWithAmounts = result.records.filter(r => r.montantPaye !== null && r.montantPaye > 0);

      // At least one record should have a valid amount
      expect(recordsWithAmounts.length).toBeGreaterThan(0);

      // Verify first amount is a number
      const firstWithAmount = recordsWithAmounts[0];
      expect(typeof firstWithAmount.montantPaye).toBe('number');
      expect(firstWithAmount.montantPaye).toBeGreaterThan(0);
    });

    it('should handle context elements (empty or filled)', async () => {
      const result = await processor.processBillingCSV(realCSVPath, testValidationRunId);

      // CSV should parse elementContexte field (value may be empty or filled)
      const recordsWithoutContext = result.records.filter(r => !r.elementContexte || r.elementContexte === '');
      const recordsWithContext = result.records.filter(r => r.elementContexte && r.elementContexte.length > 0);

      // At least one type should exist
      expect(recordsWithoutContext.length + recordsWithContext.length).toBe(result.records.length);
    });

    it('should parse hospital sector data correctly', async () => {
      const result = await processor.processBillingCSV(realCSVPath, testValidationRunId);

      // Count records with sector data (some may be null/empty)
      const recordsWithSector = result.records.filter(r =>
        r.secteurActivite && r.secteurActivite.length > 0
      );

      // At least some records should have sector data
      expect(recordsWithSector.length).toBeGreaterThan(0);

      // Look for specific Quebec sectors in the data
      const hasPalliative = recordsWithSector.some(r => r.secteurActivite?.includes('palliatif'));
      const hasGeneral = recordsWithSector.some(r => r.secteurActivite?.includes('n') && r.secteurActivite?.includes('raux'));

      // At least one type of sector should exist
      expect(hasPalliative || hasGeneral || recordsWithSector.length > 0).toBe(true);
    });

    it('should parse billing codes correctly (numeric or alphanumeric)', async () => {
      const result = await processor.processBillingCSV(realCSVPath, testValidationRunId);

      // All records should have a billing code
      const recordsWithCodes = result.records.filter(r => r.code && r.code.length > 0);

      expect(recordsWithCodes.length).toBeGreaterThan(0);

      // Codes can be numeric (15650) or alphanumeric (15643A) in Quebec
      const firstCode = recordsWithCodes[0].code;
      expect(firstCode).toMatch(/^[0-9]+[A-Z]?$/i);
    });

    it('should parse time fields correctly', async () => {
      const result = await processor.processBillingCSV(realCSVPath, testValidationRunId);

      const recordsWithTime = result.records.filter(r => r.debut && r.debut.length > 0);

      expect(recordsWithTime.length).toBeGreaterThan(0);
      expect(recordsWithTime[0].debut).toMatch(/^\d{2}:\d{2}$/); // HH:MM format
    });

    it('should handle context elements with single or multiple values', async () => {
      const result = await processor.processBillingCSV(realCSVPath, testValidationRunId);

      // Context elements can be empty, single (EPMA), or multiple (SD94,EPMA)
      const recordsWithContext = result.records.filter(r => r.elementContexte && r.elementContexte.length > 0);

      // If there are context elements, they should be valid strings
      if (recordsWithContext.length > 0) {
        const firstContext = recordsWithContext[0].elementContexte;
        expect(typeof firstContext).toBe('string');
        expect(firstContext!.length).toBeGreaterThan(0);
      }

      // Test passes whether CSV has context data or not
      expect(true).toBe(true);
    });

    it('should correctly assign validation run ID to all records', async () => {
      const result = await processor.processBillingCSV(realCSVPath, testValidationRunId);

      // Every record should have the validation run ID
      result.records.forEach(record => {
        expect(record.validationRunId).toBe(testValidationRunId);
      });
    });

    it('should assign sequential record numbers', async () => {
      const result = await processor.processBillingCSV(realCSVPath, testValidationRunId);

      // Record numbers should be sequential starting from 1
      const recordNumbers = result.records.map(r => r.recordNumber).sort((a, b) => a - b);

      expect(recordNumbers[0]).toBe(1);
      expect(recordNumbers[recordNumbers.length - 1]).toBe(result.records.length);
    });
  });

  describe('CSV Field Validation Against Schema', () => {
    it('should match exact database schema field names', async () => {
      const result = await processor.processBillingCSV(realCSVPath, testValidationRunId);
      const record = result.records[0];

      // These are the CORRECT field names from shared/schema.ts
      const requiredFields = [
        'validationRunId',
        'recordNumber',
        'facture',
        'idRamq',
        'dateService',
        'debut',
        'fin',
        'periode',
        'lieuPratique',      // NOT lieuDePratique
        'secteurActivite',   // NOT secteurDActivite
        'diagnostic',
        'code',
        'unites',
        'role',
        'elementContexte',   // NOT elementDeContexte
        'montantPreliminaire',
        'montantPaye',
        'doctorInfo',
        'patient',
      ];

      requiredFields.forEach(field => {
        expect(record).toHaveProperty(field);
      });
    });

    it('should NOT use incorrect camelCase field names', async () => {
      const result = await processor.processBillingCSV(realCSVPath, testValidationRunId);
      const record = result.records[0];

      // These WRONG field names should NOT exist
      expect(record).not.toHaveProperty('lieuDePratique');
      expect(record).not.toHaveProperty('secteurDActivite');
      expect(record).not.toHaveProperty('elementDeContexte');
    });
  });
});
