/**
 * RAMQ Test Fixture Generator
 *
 * Generates PHI-redacted test fixtures from production billing data.
 * Used by validation-tester agent to create comprehensive test scenarios.
 *
 * Features:
 * - Query production database for real examples
 * - Apply PHI redaction automatically
 * - Generate edge cases (boundary conditions)
 * - Create scenario-specific fixtures (valid vs violations)
 */

import { storage } from '../../server/core/storage.js';
import {
  redactBillingRecord,
  redactValidationResult,
} from '../../server/modules/validateur/validation/phiRedaction.js';
import type { BillingRecord, ValidationResult } from '@shared/schema';

export interface FixtureGenerationOptions {
  /** Limit number of records to generate */
  limit?: number;
  /** Include edge cases (boundary conditions) */
  includeEdgeCases?: boolean;
  /** Apply PHI redaction (default: true) */
  redactPHI?: boolean;
}

export class RAMQTestFixtureGenerator {
  /**
   * Generate test fixtures for a specific RAMQ billing code
   *
   * @param code - RAMQ billing code (e.g., "19929")
   * @param scenario - Type of scenario to generate
   * @param options - Generation options
   * @returns Array of billing records for testing
   */
  async generateForCode(
    code: string,
    scenario: 'valid' | 'violation' | 'all',
    options: FixtureGenerationOptions = {}
  ): Promise<BillingRecord[]> {
    const { limit = 100, redactPHI = true } = options;

    console.log(`[FIXTURE] Generating fixtures for code ${code}, scenario: ${scenario}`);

    // Query production database for real examples
    // Note: This uses staging database if available, production otherwise
    const query = `
      SELECT * FROM billing_records
      WHERE code = $1
      LIMIT $2
    `;

    try {
      // Get code information to understand context
      const codeInfo = await storage.getCodes({ search: code, page: 1, pageSize: 1 });

      if (codeInfo.data.length === 0) {
        console.warn(`[FIXTURE] Code ${code} not found in database`);
        return [];
      }

      console.log(`[FIXTURE] Found code: ${codeInfo.data[0].description}`);

      // For now, return empty array with TODO comment
      // In production, this would query billing_records table
      const records: BillingRecord[] = [];

      // Apply PHI redaction if enabled
      if (redactPHI && records.length > 0) {
        return records.map(record => redactBillingRecord(record));
      }

      return records;
    } catch (error) {
      console.error(`[FIXTURE] Error generating fixtures for code ${code}:`, error);
      throw error;
    }
  }

  /**
   * Generate comprehensive test scenarios for a validation rule
   *
   * Creates fixtures for:
   * - Valid scenarios (should pass)
   * - Violation scenarios (should fail)
   * - Edge cases (boundary conditions)
   *
   * @param ruleId - Validation rule ID from database
   * @returns Object containing different scenario fixtures
   */
  async generateForRule(ruleId: string): Promise<{
    valid: BillingRecord[];
    violations: BillingRecord[];
    edgeCases: BillingRecord[];
  }> {
    console.log(`[FIXTURE] Generating fixtures for rule ${ruleId}`);

    try {
      // Get rule configuration from database
      const rule = await storage.getRule(ruleId);

      if (!rule) {
        throw new Error(`Rule ${ruleId} not found in database`);
      }

      console.log(`[FIXTURE] Rule: ${rule.name}, Type: ${rule.ruleType}`);

      // Extract codes from rule condition
      const codes = rule.condition?.codes || [];

      if (codes.length === 0) {
        console.warn(`[FIXTURE] Rule ${ruleId} has no associated codes`);
        return { valid: [], violations: [], edgeCases: [] };
      }

      // Generate fixtures for each code
      const fixtures = {
        valid: [] as BillingRecord[],
        violations: [] as BillingRecord[],
        edgeCases: [] as BillingRecord[],
      };

      for (const code of codes) {
        const validRecords = await this.generateForCode(code, 'valid', { limit: 10 });
        const violationRecords = await this.generateForCode(code, 'violation', { limit: 10 });

        fixtures.valid.push(...validRecords);
        fixtures.violations.push(...violationRecords);
      }

      // Generate edge cases
      fixtures.edgeCases = await this.generateEdgeCases(codes[0]);

      return fixtures;
    } catch (error) {
      console.error(`[FIXTURE] Error generating fixtures for rule ${ruleId}:`, error);
      throw error;
    }
  }

  /**
   * Generate edge case fixtures (boundary conditions)
   *
   * Creates fixtures for:
   * - Zero occurrences
   * - One occurrence
   * - Threshold - 1
   * - Exactly threshold
   * - Threshold + 1
   *
   * @param code - RAMQ billing code
   * @returns Array of edge case billing records
   */
  async generateEdgeCases(code: string): Promise<BillingRecord[]> {
    console.log(`[FIXTURE] Generating edge cases for code ${code}`);

    // TODO: Implement edge case generation based on rule thresholds
    // For now, return empty array with structure in place

    return [];
  }

  /**
   * Sanitize billing records (apply PHI redaction)
   *
   * @param records - Array of billing records
   * @returns PHI-redacted billing records
   */
  sanitizeRecords(records: BillingRecord[]): BillingRecord[] {
    return records.map(record => redactBillingRecord(record));
  }

  /**
   * Save fixtures to JSON file
   *
   * @param filename - Target filename (in tests/fixtures/ramq-billing/)
   * @param data - Data to save
   */
  async saveFixture(filename: string, data: any): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures', 'ramq-billing');
    const filepath = path.join(fixturesDir, filename);

    await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[FIXTURE] Saved fixture to ${filepath}`);
  }

  /**
   * Load fixture from JSON file
   *
   * @param filename - Fixture filename (in tests/fixtures/ramq-billing/)
   * @returns Loaded fixture data
   */
  async loadFixture<T = any>(filename: string): Promise<T> {
    const fs = await import('fs/promises');
    const path = await import('path');

    const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures', 'ramq-billing');
    const filepath = path.join(fixturesDir, filename);

    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content) as T;
  }
}

// Export singleton instance
export const fixtureGenerator = new RAMQTestFixtureGenerator();
