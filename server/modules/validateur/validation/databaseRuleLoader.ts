import { storage } from "../../../core/storage";
import { ValidationRule } from "./engine";
import { BillingRecord, InsertValidationResult } from "@shared/schema";
import * as RuleHandlers from "./ruleTypeHandlers";

export interface DatabaseRule {
  id: string;
  name: string;
  ruleType: string | null;
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
    const ruleType = rule.ruleType || condition.rule_type || condition.type;

    // Route to appropriate handler based on rule type
    switch (ruleType) {
      case "office_fee_validation":
        return await validateOfficeFeeFromDatabase(rule, records, validationRunId, condition);

      case "prohibition":
        return await RuleHandlers.validateProhibition(rule, records, validationRunId);

      case "time_restriction":
        return await RuleHandlers.validateTimeRestriction(rule, records, validationRunId);

      case "requirement":
        return await RuleHandlers.validateRequirement(rule, records, validationRunId);

      case "location_restriction":
        return await RuleHandlers.validateLocationRestriction(rule, records, validationRunId);

      case "age_restriction":
        return await RuleHandlers.validateAgeRestriction(rule, records, validationRunId);

      case "amount_limit":
        return await RuleHandlers.validateAmountLimit(rule, records, validationRunId);

      case "mutual_exclusion":
        return await RuleHandlers.validateMutualExclusion(rule, records, validationRunId);

      case "missing_annual_opportunity":
        return await RuleHandlers.validateMissingAnnualOpportunity(rule, records, validationRunId);

      case "annual_limit":
        return await RuleHandlers.validateAnnualLimit(rule, records, validationRunId);

      case "annual_billing_code":
        return await RuleHandlers.validateAnnualBillingCode(rule, records, validationRunId);

      case "gmf_annual_forfait":
        return await RuleHandlers.validateGmfForfait8875(rule, records, validationRunId);

      case "intervention_clinique_daily_limit":
        return await RuleHandlers.validateInterventionCliniqueDailyLimit(rule, records, validationRunId);

      case "visit_duration_optimization":
        return await RuleHandlers.validateVisitDurationOptimization(rule, records, validationRunId);

      default:
        console.warn(`[RULES] Unknown rule type: ${ruleType}`);
        return results;
    }

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

// Determine if a billing record is a registered or walk-in visit
function determineVisitType(record: BillingRecord, codeCategories: Map<string, string>): 'registered' | 'walk-in' | null {
  const code = record.code;
  const category = codeCategories.get(code) || '';
  const elementContexte = record.elementContexte || '';

  // Check context tags for walk-in indicators (with or without # symbol)
  const hasWalkInContext = elementContexte.includes('G160') || elementContexte.includes('AR');

  // Special handling for codes 8857/8859 - context tags are REQUIRED to differentiate
  if (code === '8857' || code === '8859') {
    if (hasWalkInContext) {
      return 'walk-in';
    } else {
      return 'registered';
    }
  }

  // For all other codes, use category to determine type
  // Context tags are optional (category already defines the type)

  // Registered visit categories
  const registeredCategories = [
    'Visites sur rendez-vous (patient inscrit ou non inscrit, sans égard à l\'âge)',
    'Visites sur rendez-vous ou sans rendez-vous (patient inscrit ou non inscrit, sans égard à l\'âge)',
    'Visites sur rendez-vous (patient de moins de 80 ans)',
    'Visites sur rendez-vous (patient de 80 ans ou plus)'
  ];

  if (registeredCategories.some(cat => category.includes(cat))) {
    return 'registered';
  }

  // Walk-in visit categories
  const walkInCategories = [
    'Visites sans rendez vous, ou sur rendez vous pour un patient non inscrit (patient de moins de 80 ans inscrit ou non inscrit)',
    'Visites sans rendez vous, ou sur rendez vous pour un patient non inscrit (patient de 80 ans ou plus inscrit ou non inscrit)',
    'Visites sans rendez vous'
  ];

  if (walkInCategories.some(cat => category.includes(cat))) {
    return 'walk-in';
  }

  // Not a visit code we care about for office fee validation
  return null;
}

// Office fee validation using database configuration
async function validateOfficeFeeFromDatabase(
  rule: DatabaseRule,
  records: BillingRecord[],
  validationRunId: string,
  condition: any
): Promise<InsertValidationResult[]> {
  const results: InsertValidationResult[] = [];

  // Load code categories from database for visit type determination
  const { db } = await import("../../../core/db");
  const { codes: codesTable } = await import("@shared/schema");
  const allCodes = await db.select({ code: codesTable.code, category: codesTable.category }).from(codesTable);

  const codeCategories = new Map<string, string>();
  for (const codeRow of allCodes) {
    if (codeRow.category) {
      codeCategories.set(codeRow.code, codeRow.category);
    }
  }

  console.log(`[DEBUG] Loaded ${codeCategories.size} code categories from database`);

  // Get configuration from database rule
  const config = {
    codes: condition.codes || ["19928", "19929"],
    walkInContexts: condition.walkInContexts || ["G160", "AR", "#G160", "#AR"],
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
        registeredPaidPatients: new Set(),
        walkInPaidPatients: new Set(),
        registeredUnpaidPatients: new Set(),
        walkInUnpaidPatients: new Set(),
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
      // Track patient visits based on code category AND context tags
      const visitType = determineVisitType(record, codeCategories);
      const isPaid = Number(record.montantPaye || 0) > 0;

      console.log(`[DEBUG] Patient: ${record.patient}, Code: ${record.code}, Category: ${codeCategories.get(record.code) || 'NOT FOUND'}, VisitType: ${visitType}, Paid: ${isPaid}`);

      if (visitType === 'walk-in') {
        dayData.walkInPatients.add(record.patient);
        if (isPaid) {
          dayData.walkInPaidPatients.add(record.patient);
        } else {
          dayData.walkInUnpaidPatients.add(record.patient);
        }
      } else if (visitType === 'registered') {
        dayData.registeredPatients.add(record.patient);
        if (isPaid) {
          dayData.registeredPaidPatients.add(record.patient);
        } else {
          dayData.registeredUnpaidPatients.add(record.patient);
        }
      }
      // If visitType is null, ignore this record (not a valid visit code)
    }
  }

  // Second pass: validate each doctor-day using database thresholds
  for (const [key, dayData] of doctorDayMap.entries()) {
    const registeredCount = dayData.registeredPatients.size;
    const walkInCount = dayData.walkInPatients.size;
    const registeredPaidCount = dayData.registeredPaidPatients.size;
    const walkInPaidCount = dayData.walkInPaidPatients.size;
    const registeredUnpaidCount = dayData.registeredUnpaidPatients.size;
    const walkInUnpaidCount = dayData.walkInUnpaidPatients.size;

    // Group office fees by error type and RAMQ ID for consolidated error messages
    const errorGroups = new Map<string, {
      ramqIds: Set<string>;
      billingRecordIds: string[];
      code: string;
      type: string;
      required: number;
      actual: number;
      establishment?: string;
    }>();

    // Check each office fee claim and group by error type
    for (const officeFee of dayData.officeFees) {
      console.log(`[OFFICE FEE DEBUG] Code: ${officeFee.code}, Establishment: ${officeFee.lieuPratique}, Doctor: ${dayData.doctor}, Date: ${dayData.date}`);

      // Establishment validation: codes 19928/19929 are for cabinet only (establishment number starts with 5)
      if (officeFee.lieuPratique && !officeFee.lieuPratique.startsWith('5')) {
        const errorKey = `establishment_${officeFee.code}`;
        if (!errorGroups.has(errorKey)) {
          errorGroups.set(errorKey, {
            ramqIds: new Set(),
            billingRecordIds: [],
            code: officeFee.code,
            type: 'establishment',
            required: 0,
            actual: 0,
            establishment: officeFee.lieuPratique
          });
        }
        const group = errorGroups.get(errorKey)!;
        group.ramqIds.add(officeFee.idRamq || "N'existe pas");
        group.billingRecordIds.push(officeFee.id);
        continue; // Skip further validation for this record
      }

      const hasWalkInContext = config.walkInContexts.some(ctx =>
        officeFee.elementContexte?.includes(ctx)
      );

      console.log(`[OFFICE FEE CONTEXT DEBUG] Code: ${officeFee.code}, Context: "${officeFee.elementContexte}", HasWalkIn: ${hasWalkInContext}, WalkInContexts: ${JSON.stringify(config.walkInContexts)}`);

      const codeThresholds = config.thresholds[officeFee.code];
      if (!codeThresholds) continue;

      if (hasWalkInContext) {
        // Walk-in validation
        if (walkInCount < codeThresholds.walkIn) {
          const errorKey = `walk_in_${officeFee.code}`;
          if (!errorGroups.has(errorKey)) {
            errorGroups.set(errorKey, {
              ramqIds: new Set(),
              billingRecordIds: [],
              code: officeFee.code,
              type: 'walk_in',
              required: codeThresholds.walkIn,
              actual: walkInCount
            });
          }
          const group = errorGroups.get(errorKey)!;
          group.ramqIds.add(officeFee.idRamq || "N'existe pas");
          group.billingRecordIds.push(officeFee.id);
        }
      } else {
        // Registered patient validation
        if (registeredCount < codeThresholds.registered) {
          const errorKey = `registered_${officeFee.code}`;
          if (!errorGroups.has(errorKey)) {
            errorGroups.set(errorKey, {
              ramqIds: new Set(),
              billingRecordIds: [],
              code: officeFee.code,
              type: 'registered',
              required: codeThresholds.registered,
              actual: registeredCount
            });
          }
          const group = errorGroups.get(errorKey)!;
          group.ramqIds.add(officeFee.idRamq || "N'existe pas");
          group.billingRecordIds.push(officeFee.id);
        }
      }
    }

    // Create one validation result per error group (grouped by RAMQ ID)
    for (const [errorKey, group] of errorGroups.entries()) {
      const ramqList = Array.from(group.ramqIds).sort().join(', ');
      const count = group.billingRecordIds.length;

      if (group.type === 'establishment') {
        results.push({
          validationRunId,
          ruleId: rule.id,
          billingRecordId: group.billingRecordIds[0], // Use first record ID
          idRamq: ramqList, // Add RAMQ ID at top level
          severity: "error",
          category: "office_fees",
          message: `Les codes 19928 et 19929 peuvent seulement être facturés en cabinet`,
          solution: `Veuillez annuler la demande`,
          affectedRecords: group.billingRecordIds,
          ruleData: {
            code: group.code,
            count: count,
            ramqIds: ramqList,
            establishment: group.establishment,
            expectedPattern: "5XXXX",
            doctor: dayData.doctor,
            date: dayData.date
          }
        });
      } else if (group.type === 'walk_in') {
        results.push({
          validationRunId,
          ruleId: rule.id,
          billingRecordId: group.billingRecordIds[0], // Use first record ID
          idRamq: ramqList, // Add RAMQ ID at top level
          severity: "error",
          category: "office_fees",
          message: `Le code ${group.code} requiert la présence d'un minimum de ${group.required} patients sans rendez-vous alors qu'on en trouve seulement ${group.actual} pour cette date de service`,
          solution: `Veuillez annuler la demande ou corrigez les visites non payées`,
          affectedRecords: group.billingRecordIds,
          ruleData: {
            code: group.code,
            count: count,
            ramqIds: ramqList,
            type: "walk_in",
            required: group.required,
            actual: group.actual,
            paidVisits: walkInPaidCount,
            unpaidVisits: walkInUnpaidCount,
            registeredVisits: registeredCount,
            // Full breakdown for UI display
            registeredPaidCount,
            walkInPaidCount,
            registeredUnpaidCount,
            walkInUnpaidCount,
            doctor: dayData.doctor,
            date: dayData.date
          }
        });
      } else if (group.type === 'registered') {
        // Determine appropriate solution based on CSV scenarios
        let solution: string;
        if (group.code === '19929' && group.actual < group.required) {
          // Scenario 5: 8 inscrits with 19929 → suggest changing to 19928
          solution = `Changez le code 19929 pour 19928 ou corrigez les visites non payées`;
        } else if (group.code === '19928' && group.actual < group.required) {
          // Scenario 2: 3 inscrits with 19928 → cannot suggest upgrade, just cancel
          solution = `Veuillez annuler la demande ou corrigez les visites non payées`;
        } else {
          // Fallback
          solution = `Veuillez annuler la demande ou corrigez les visites non payées`;
        }

        results.push({
          validationRunId,
          ruleId: rule.id,
          billingRecordId: group.billingRecordIds[0], // Use first record ID
          idRamq: ramqList, // Add RAMQ ID at top level
          severity: "error",
          category: "office_fees",
          message: `Le code ${group.code} requiert la présence d'un minimum de ${group.required} patients inscrits alors qu'on en trouve seulement ${group.actual} pour cette date de service`,
          solution: solution,
          affectedRecords: group.billingRecordIds,
          ruleData: {
            code: group.code,
            count: count,
            ramqIds: ramqList,
            type: "registered",
            required: group.required,
            actual: group.actual,
            paidVisits: registeredPaidCount,
            unpaidVisits: registeredUnpaidCount,
            walkInVisits: walkInCount,
            // Full breakdown for UI display
            registeredPaidCount,
            walkInPaidCount,
            registeredUnpaidCount,
            walkInUnpaidCount,
            doctor: dayData.doctor,
            date: dayData.date
          }
        });
      }
    }

    // Check daily maximum
    if (dayData.totalAmount > config.dailyMaximum) {
      const affectedIds = dayData.officeFees.map(fee => fee.id).filter(id => id !== null) as string[];
      const ramqIds = dayData.officeFees.map(fee => fee.idRamq || "N'existe pas");
      const uniqueRamqIds = Array.from(new Set(ramqIds)).sort().join(', ');
      const count = dayData.officeFees.length;

      results.push({
        validationRunId,
        ruleId: rule.id,
        billingRecordId: dayData.officeFees[0]?.id || null,
        idRamq: uniqueRamqIds, // Add RAMQ ID at top level
        severity: "error",
        category: "office_fees",
        message: `Le maximum quotidien de ${config.dailyMaximum.toFixed(2)} pour les frais de bureau a été dépassé pour ce médecin`,
        solution: `Veuillez annuler un des deux frais de bureau`,
        affectedRecords: affectedIds,
        ruleData: {
          count: count,
          ramqIds: uniqueRamqIds,
          doctor: dayData.doctor,
          date: dayData.date,
          totalAmount: dayData.totalAmount,
          maximum: config.dailyMaximum
        }
      });
    }

    // Add informational result showing visit counts (always, even when correct)
    if (dayData.officeFees.length > 0) {
      const officeFeeCodes = dayData.officeFees.map(f => f.code).join(', ');
      const ramqIds = dayData.officeFees.map(fee => fee.idRamq || "N'existe pas");
      const uniqueRamqIds = Array.from(new Set(ramqIds)).sort().join(', ');

      results.push({
        validationRunId,
        ruleId: rule.id,
        billingRecordId: dayData.officeFees[0]?.id || null,
        idRamq: uniqueRamqIds,
        severity: "info",
        category: "office_fees",
        message: `Comptage des visites: ${registeredCount} patients inscrits, ${walkInCount} patients sans rendez-vous. Frais de bureau facturé: ${officeFeeCodes} (${dayData.totalAmount.toFixed(2)}$)`,
        solution: null,
        affectedRecords: dayData.officeFees.map(f => f.id).filter(id => id !== null) as string[],
        ruleData: {
          doctor: dayData.doctor,
          date: dayData.date,
          registeredCount,
          walkInCount,
          registeredPaidCount,
          walkInPaidCount,
          registeredUnpaidCount,
          walkInUnpaidCount,
          officeFeeCodes,
          totalAmount: dayData.totalAmount,
          maximum: config.dailyMaximum
        }
      });
    }
  }

  return results;
}