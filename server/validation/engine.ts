import { BillingRecord, ValidationResult, InsertValidationResult } from "../../shared/schema";

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

  async validateRecords(records: BillingRecord[], validationRunId: string): Promise<InsertValidationResult[]> {
    const results: InsertValidationResult[] = [];

    for (const rule of this.rules) {
      if (rule.enabled) {
        try {
          const ruleResults = await rule.validate(records, validationRunId);
          results.push(...ruleResults);
        } catch (error) {
          console.error(`Error in validation rule ${rule.name}:`, error);
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

    return results;
  }

  getRules(): ValidationRule[] {
    return this.rules;
  }
}

// Global validation engine instance
export const validationEngine = new ValidationEngine();