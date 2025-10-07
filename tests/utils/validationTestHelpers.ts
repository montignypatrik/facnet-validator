/**
 * Validation Test Helpers
 *
 * Utility functions for testing RAMQ validation rules.
 * Used by validation-tester agent and test suites.
 */

import { validationEngine, type ValidationRule } from '../../server/modules/validateur/validation/engine.js';
import type { BillingRecord, InsertValidationResult } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';

/**
 * Run a single validation rule against billing records
 *
 * @param rule - Validation rule to test
 * @param records - Billing records to validate
 * @returns Validation results
 */
export async function validateWithRule(
  rule: ValidationRule,
  records: BillingRecord[]
): Promise<InsertValidationResult[]> {
  const testRunId = uuidv4(); // Pure UUID without prefix

  // Clear existing rules and register only the test rule
  validationEngine.clearRules();
  validationEngine.registerRule(rule);

  // Run validation
  const results = await validationEngine.validateRecords(records, testRunId);

  return results;
}

/**
 * Load fixture from JSON file
 *
 * @param filename - Fixture filename (relative to tests/fixtures/ramq-billing/)
 * @returns Loaded billing records
 */
export async function loadFixture(filename: string): Promise<BillingRecord[]> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures', 'ramq-billing');
  const filepath = path.join(fixturesDir, filename);

  try {
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content) as BillingRecord[];
  } catch (error) {
    console.error(`Failed to load fixture ${filename}:`, error);
    throw new Error(`Fixture not found: ${filename}`);
  }
}

/**
 * Create mock billing record for testing
 *
 * @param overrides - Properties to override defaults
 * @returns Mock billing record
 */
export function createMockBillingRecord(
  overrides: Partial<BillingRecord> = {}
): BillingRecord {
  const defaultRecord: BillingRecord = {
    id: uuidv4(),
    validationRunId: uuidv4(), // Pure UUID without prefix
    recordNumber: 1,
    facture: 'FAC-001',
    idRamq: 'RAMQ-001',
    dateService: new Date('2025-01-06'),
    debut: '09:00',
    fin: '09:30',
    periode: null,
    lieuPratique: '12345',
    secteurActivite: '1',
    diagnostic: 'R51',
    code: '15804',
    unites: null,
    role: '1',
    elementDeContexte: null,
    montantPreliminaire: '49.15',
    montantPaye: '49.15',
    doctorInfo: 'REDACTED',
    patient: 'PATIENT-001',
    grandTotal: null,
    devNoteField1: null,
    devNoteField2: null,
    devNoteField3: null,
    agence: null,
    createdAt: new Date(),
  };

  return { ...defaultRecord, ...overrides };
}

/**
 * Create multiple mock billing records with common properties
 *
 * @param count - Number of records to create
 * @param baseRecord - Base record to clone
 * @returns Array of mock billing records
 */
export function createMockBillingRecords(
  count: number,
  baseRecord: Partial<BillingRecord> = {}
): BillingRecord[] {
  return Array.from({ length: count }, (_, index) =>
    createMockBillingRecord({
      ...baseRecord,
      recordNumber: index + 1,
      patient: `PATIENT-${String(index + 1).padStart(3, '0')}`,
    })
  );
}

/**
 * Assert that validation results contain expected error
 *
 * @param results - Validation results
 * @param expectedMessage - Expected error message (substring)
 * @param severity - Expected severity level
 */
export function assertValidationError(
  results: InsertValidationResult[],
  expectedMessage: string,
  severity: 'error' | 'warning' = 'error'
): void {
  const matchingResults = results.filter(
    r => r.severity === severity && r.message.includes(expectedMessage)
  );

  if (matchingResults.length === 0) {
    throw new Error(
      `Expected validation ${severity} with message "${expectedMessage}" but found none.\n` +
      `Actual results: ${JSON.stringify(results, null, 2)}`
    );
  }
}

/**
 * Assert that validation results are empty (no violations)
 *
 * @param results - Validation results
 */
export function assertNoValidationErrors(results: InsertValidationResult[]): void {
  if (results.length > 0) {
    throw new Error(
      `Expected no validation errors but found ${results.length}:\n` +
      JSON.stringify(results, null, 2)
    );
  }
}

/**
 * Group billing records by patient for testing patient-specific rules
 *
 * @param records - Billing records
 * @returns Map of patient ID to billing records
 */
export function groupRecordsByPatient(
  records: BillingRecord[]
): Map<string, BillingRecord[]> {
  const groups = new Map<string, BillingRecord[]>();

  for (const record of records) {
    const patient = record.patient;
    if (!groups.has(patient)) {
      groups.set(patient, []);
    }
    groups.get(patient)!.push(record);
  }

  return groups;
}

/**
 * Group billing records by date for testing daily limit rules
 *
 * @param records - Billing records
 * @returns Map of date string to billing records
 */
export function groupRecordsByDate(
  records: BillingRecord[]
): Map<string, BillingRecord[]> {
  const groups = new Map<string, BillingRecord[]>();

  for (const record of records) {
    const dateKey = record.dateService.toISOString().split('T')[0];
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(record);
  }

  return groups;
}

/**
 * Calculate total billing amount for records
 *
 * @param records - Billing records
 * @returns Total amount in dollars
 */
export function calculateTotalAmount(records: BillingRecord[]): number {
  return records.reduce((total, record) => {
    const amount = parseFloat(record.montantPreliminaire || '0');
    return total + amount;
  }, 0);
}

/**
 * Filter records by walk-in context (G160, AR)
 *
 * @param records - Billing records
 * @returns Records with walk-in contexts
 */
export function filterWalkInRecords(records: BillingRecord[]): BillingRecord[] {
  const walkInContexts = ['G160', 'AR'];
  return records.filter(r =>
    r.elementDeContexte && walkInContexts.includes(r.elementDeContexte)
  );
}

/**
 * Filter records by registered patient (not walk-in)
 *
 * @param records - Billing records
 * @returns Records without walk-in contexts
 */
export function filterRegisteredRecords(records: BillingRecord[]): BillingRecord[] {
  const walkInContexts = ['G160', 'AR'];
  return records.filter(r =>
    !r.elementDeContexte || !walkInContexts.includes(r.elementDeContexte)
  );
}
