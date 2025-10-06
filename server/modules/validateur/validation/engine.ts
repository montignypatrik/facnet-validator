import { BillingRecord, ValidationResult, InsertValidationResult } from "@shared/schema";
import { logger } from '../logger';

export interface ValidationRule {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  validate: (records: BillingRecord[], validationRunId: string) => Promise<InsertValidationResult[]>;
}

export class ValidationEngine {
  private rules: ValidationRule[] = [];

  registerRule(rule: ValidationRule) {
    this.rules.push(rule);
  }

  clearRules() {
    this.rules = [];
  }

  async validateRecords(records: BillingRecord[], validationRunId: string): Promise<InsertValidationResult[]> {
    const results: InsertValidationResult[] = [];
    const startTime = Date.now();

    await logger.info(validationRunId, 'engine', `Starting validation with ${this.rules.length} rules`, {
      ruleCount: this.rules.length,
      rowCount: records.length,
    });

    for (const rule of this.rules) {
      if (rule.enabled) {
        const ruleStartTime = Date.now();

        await logger.debug(validationRunId, 'engine', `Executing rule: ${rule.name}`, {
          ruleId: rule.id,
        });

        try {
          const ruleResults = await rule.validate(records, validationRunId);
          const ruleEndTime = Date.now();
          const duration = ruleEndTime - ruleStartTime;

          results.push(...ruleResults);

          await logger.info(
            validationRunId,
            'engine',
            `Rule "${rule.name}" completed - found ${ruleResults.length} violations`,
            {
              ruleId: rule.id,
              violationCount: ruleResults.length,
              duration,
            }
          );
        } catch (error: any) {
          await logger.error(
            validationRunId,
            'engine',
            `Rule "${rule.name}" failed: ${error.message}`,
            {
              ruleId: rule.id,
              errorType: error.name,
            }
          );

          // Add system error result
          results.push({
            validationRunId,
            ruleId: rule.id,
            billingRecordId: null,
            severity: "error",
            category: "system_error",
            message: `Validation rule "${rule.name}" failed: ${error.message}`,
            affectedRecords: [],
            ruleData: { error: error.message }
          });
        }
      }
    }

    const totalDuration = Date.now() - startTime;

    // Count results by severity
    const errorCount = results.filter(r => r.severity === 'error').length;
    const warningCount = results.filter(r => r.severity === 'warning').length;

    await logger.info(
      validationRunId,
      'engine',
      `Validation completed - ${errorCount} errors, ${warningCount} warnings`,
      {
        violationCount: results.length,
        errorCount,
        warningCount,
        duration: totalDuration,
      }
    );

    return results;
  }

  getRules(): ValidationRule[] {
    return this.rules;
  }
}

// Global validation engine instance
export const validationEngine = new ValidationEngine();