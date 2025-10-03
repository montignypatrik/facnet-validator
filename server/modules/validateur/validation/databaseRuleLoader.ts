import { storage } from "../../../core/storage";
import { ValidationRule } from "./engine";
import { BillingRecord, InsertValidationResult } from "@shared/schema";

export interface DatabaseRule {
  id: string;
  name: string;
  condition: any; // JSON condition from database
  threshold: number | null;
  enabled: boolean;
}

// Load validation rules from database and convert to ValidationRule interface
export async function loadDatabaseRules(): Promise<ValidationRule[]> {
  const validationRules: ValidationRule[] = [];

  try {
    // Get rules from database
    const dbRules = await storage.getAllRules();
    console.log(`[RULES] Loading ${dbRules.length} rules from database`);

    for (const dbRule of dbRules) {
      if (!dbRule.enabled) {
        console.log(`[RULES] Skipping disabled rule: ${dbRule.name}`);
        continue;
      }

      // Convert database rule to ValidationRule
      const validationRule: ValidationRule = {
        id: dbRule.id,
        name: dbRule.name,
        category: dbRule.condition?.category || "general",
        enabled: dbRule.enabled,
        validate: async (records: BillingRecord[], validationRunId: string) => {
          return await validateWithDatabaseRule(dbRule, records, validationRunId);
        }
      };

      validationRules.push(validationRule);
      console.log(`[RULES] Loaded rule: ${dbRule.name} (${dbRule.id})`);
    }

  } catch (error) {
    console.error('[RULES] Failed to load database rules:', error);
  }

  return validationRules;
}

// Validate records using a database rule configuration
async function validateWithDatabaseRule(
  rule: DatabaseRule,
  records: BillingRecord[],
  validationRunId: string
): Promise<InsertValidationResult[]> {
  const results: InsertValidationResult[] = [];

  try {
    const condition = rule.condition;

    if (condition.type === "office_fee_validation") {
      // Handle office fee validation from database
      return await validateOfficeFeeFromDatabase(rule, records, validationRunId, condition);
    }

    // Add more rule types here as needed
    console.warn(`[RULES] Unknown rule type: ${condition.type}`);

  } catch (error) {
    console.error(`[RULES] Error in rule ${rule.name}:`, error);

    // Return system error
    results.push({
      validationRunId,
      ruleId: rule.id,
      billingRecordId: null,
      severity: "error",
      category: "system_error",
      message: `Rule "${rule.name}" failed: ${error.message}`,
      affectedRecords: [],
      ruleData: { error: error.message }
    });
  }

  return results;
}

// Office fee validation using database configuration
async function validateOfficeFeeFromDatabase(
  rule: DatabaseRule,
  records: BillingRecord[],
  validationRunId: string,
  condition: any
): Promise<InsertValidationResult[]> {
  const results: InsertValidationResult[] = [];

  // Get configuration from database rule
  const config = {
    codes: condition.codes || ["19928", "19929"],
    walkInContexts: condition.walkInContexts || ["#G160", "#AR"],
    thresholds: condition.thresholds || {
      "19928": { registered: 6, walkIn: 10 },
      "19929": { registered: 12, walkIn: 20 }
    },
    dailyMaximum: Number(rule.threshold) || 64.80
  };

  // Group data by doctor and date (same logic as hardcoded rule)
  const doctorDayMap = new Map();

  // First pass: collect all patient visits and office fees
  for (const record of records) {
    if (!record.doctorInfo || !record.dateService) continue;

    const key = `${record.doctorInfo}_${record.dateService.toISOString().split('T')[0]}`;

    if (!doctorDayMap.has(key)) {
      doctorDayMap.set(key, {
        doctor: record.doctorInfo,
        date: record.dateService.toISOString().split('T')[0],
        registeredPatients: new Set(),
        walkInPatients: new Set(),
        officeFees: [],
        totalAmount: 0
      });
    }

    const dayData = doctorDayMap.get(key);

    // Track office fee codes
    if (config.codes.includes(record.code)) {
      dayData.officeFees.push(record);
      dayData.totalAmount += Number(record.montantPreliminaire || 0);
    } else if (record.patient) {
      // Track patient visits
      const hasWalkInContext = config.walkInContexts.some(ctx =>
        record.elementContexte?.includes(ctx)
      );

      if (hasWalkInContext) {
        dayData.walkInPatients.add(record.patient);
      } else {
        dayData.registeredPatients.add(record.patient);
      }
    }
  }

  // Second pass: validate each doctor-day using database thresholds
  for (const [key, dayData] of doctorDayMap.entries()) {
    const registeredCount = dayData.registeredPatients.size;
    const walkInCount = dayData.walkInPatients.size;

    // Check each office fee claim
    for (const officeFee of dayData.officeFees) {
      const hasWalkInContext = config.walkInContexts.some(ctx =>
        officeFee.elementContexte?.includes(ctx)
      );

      const codeThresholds = config.thresholds[officeFee.code];
      if (!codeThresholds) continue;

      if (hasWalkInContext) {
        // Walk-in validation
        if (walkInCount < codeThresholds.walkIn) {
          results.push({
            validationRunId,
            ruleId: rule.id,
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code ${officeFee.code} (walk-in) requires minimum ${codeThresholds.walkIn} walk-in patients but only ${walkInCount} found for ${dayData.doctor} on ${dayData.date}`,
            affectedRecords: [officeFee.id],
            ruleData: {
              code: officeFee.code,
              type: "walk_in",
              required: codeThresholds.walkIn,
              actual: walkInCount,
              doctor: dayData.doctor,
              date: dayData.date
            }
          });
        }
      } else {
        // Registered patient validation
        if (registeredCount < codeThresholds.registered) {
          results.push({
            validationRunId,
            ruleId: rule.id,
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code ${officeFee.code} (registered) requires minimum ${codeThresholds.registered} registered patients but only ${registeredCount} found for ${dayData.doctor} on ${dayData.date}`,
            affectedRecords: [officeFee.id],
            ruleData: {
              code: officeFee.code,
              type: "registered",
              required: codeThresholds.registered,
              actual: registeredCount,
              doctor: dayData.doctor,
              date: dayData.date
            }
          });
        }
      }
    }

    // Check daily maximum
    if (dayData.totalAmount > config.dailyMaximum) {
      const affectedIds = dayData.officeFees.map(fee => fee.id).filter(id => id !== null) as string[];
      results.push({
        validationRunId,
        ruleId: rule.id,
        billingRecordId: null,
        severity: "error",
        category: "office_fees",
        message: `Daily office fee maximum of $${config.dailyMaximum.toFixed(2)} exceeded for ${dayData.doctor} on ${dayData.date} (total: $${dayData.totalAmount.toFixed(2)})`,
        affectedRecords: affectedIds,
        ruleData: {
          doctor: dayData.doctor,
          date: dayData.date,
          totalAmount: dayData.totalAmount,
          maximum: config.dailyMaximum
        }
      });
    }
  }

  return results;
}