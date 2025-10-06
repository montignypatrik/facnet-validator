/**
 * Rule Type Handlers
 * Implements validation logic for each RAMQ rule type
 */

import { BillingRecord, InsertValidationResult } from "@shared/schema";
import { DatabaseRule } from "./databaseRuleLoader";

/**
 * PROHIBITION RULES
 * Codes that cannot be billed together
 */
export async function validateProhibition(
  rule: DatabaseRule,
  records: BillingRecord[],
  validationRunId: string
): Promise<InsertValidationResult[]> {
  const results: InsertValidationResult[] = [];
  const condition = rule.condition;
  const prohibitedCodes = condition.codes || [];

  if (prohibitedCodes.length < 2) {
    return results; // Need at least 2 codes for prohibition
  }

  // Group records by invoice (Facture) or by patient+date
  const groupedByInvoice = new Map<string, BillingRecord[]>();

  for (const record of records) {
    const groupKey = record.facture || `${record.patient}_${record.dateService?.toISOString().split('T')[0]}`;
    if (!groupedByInvoice.has(groupKey)) {
      groupedByInvoice.set(groupKey, []);
    }
    groupedByInvoice.get(groupKey)!.push(record);
  }

  // Check each invoice for prohibited combinations
  for (const [invoiceKey, invoiceRecords] of groupedByInvoice.entries()) {
    const codesInInvoice = invoiceRecords.map(r => r.code);
    const foundProhibitedCodes = prohibitedCodes.filter(code => codesInInvoice.includes(code));

    if (foundProhibitedCodes.length > 1) {
      // Found prohibited combination
      const affectedRecords = invoiceRecords.filter(r => foundProhibitedCodes.includes(r.code));

      results.push({
        validationRunId,
        ruleId: rule.id,
        billingRecordId: affectedRecords[0]?.id || null,
        idRamq: affectedRecords[0]?.idRamq || null,
        severity: "error",
        category: "prohibition",
        message: `Codes prohibés facturés ensemble: ${foundProhibitedCodes.join(', ')}. ${condition.description || ''}`,
        affectedRecords: affectedRecords.map(r => r.id),
        ruleData: {
          invoice: invoiceKey,
          prohibitedCodes: foundProhibitedCodes,
          allCodes: codesInInvoice
        }
      });
    }
  }

  return results;
}

/**
 * TIME RESTRICTION RULES
 * Time-based billing rules (after-hours, weekends, holidays)
 */
export async function validateTimeRestriction(
  rule: DatabaseRule,
  records: BillingRecord[],
  validationRunId: string
): Promise<InsertValidationResult[]> {
  const results: InsertValidationResult[] = [];
  const condition = rule.condition;
  const restrictedCodes = condition.codes || [];
  const pattern = condition.pattern || '';

  // Determine restriction type from pattern
  const isWeekendRule = /week-end|weekend|fin de semaine/i.test(pattern);
  const isHolidayRule = /jour férié|holiday|congé/i.test(pattern);
  const isAfterHoursRule = /nuit|nocturne|nighttime/i.test(pattern);

  for (const record of records) {
    if (!restrictedCodes.includes(record.code)) continue;
    if (!record.dateService) continue;

    const serviceDate = new Date(record.dateService);
    const dayOfWeek = serviceDate.getDay(); // 0 = Sunday, 6 = Saturday
    const serviceTime = record.debut || '';

    let violation = false;
    let violationMessage = '';

    if (isWeekendRule) {
      // Weekend rule: code should ONLY be billed on weekends
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      if (!isWeekend) {
        violation = true;
        violationMessage = `Code ${record.code} est réservé pour les fins de semaine mais facturé un jour de semaine`;
      }
    }

    if (isAfterHoursRule) {
      // After-hours rule: code should only be billed outside business hours
      const hour = parseInt(serviceTime.split(':')[0] || '0');
      const isBusinessHours = hour >= 8 && hour < 17;
      if (isBusinessHours) {
        violation = true;
        violationMessage = `Code ${record.code} est pour service hors heures régulières mais facturé pendant heures d'ouverture (${serviceTime})`;
      }
    }

    if (violation) {
      results.push({
        validationRunId,
        ruleId: rule.id,
        billingRecordId: record.id || null,
        idRamq: record.idRamq || null,
        severity: "info", // Time restrictions are often informational
        category: "time_restriction",
        message: violationMessage,
        affectedRecords: [record.id],
        ruleData: {
          code: record.code,
          date: serviceDate.toISOString().split('T')[0],
          time: serviceTime,
          dayOfWeek
        }
      });
    }
  }

  return results;
}

/**
 * REQUIREMENT RULES
 * Codes that require other codes or conditions
 */
export async function validateRequirement(
  rule: DatabaseRule,
  records: BillingRecord[],
  validationRunId: string
): Promise<InsertValidationResult[]> {
  const results: InsertValidationResult[] = [];
  const condition = rule.condition;
  const triggerCodes = condition.codes || [];

  // Group records by invoice
  const groupedByInvoice = new Map<string, BillingRecord[]>();

  for (const record of records) {
    const groupKey = record.facture || `${record.patient}_${record.dateService?.toISOString().split('T')[0]}`;
    if (!groupedByInvoice.has(groupKey)) {
      groupedByInvoice.set(groupKey, []);
    }
    groupedByInvoice.get(groupKey)!.push(record);
  }

  // Check each invoice for missing required codes
  for (const [invoiceKey, invoiceRecords] of groupedByInvoice.entries()) {
    const codesInInvoice = invoiceRecords.map(r => r.code);
    const hasTriggerCode = triggerCodes.some(code => codesInInvoice.includes(code));

    if (hasTriggerCode) {
      // This invoice has a trigger code, check for required conditions
      // For now, just log that we found the trigger (full logic depends on specific requirements)
      const triggerRecord = invoiceRecords.find(r => triggerCodes.includes(r.code));

      // Check if visit code is present (common requirement)
      const visitCodes = ['15838', '15804', '15315', '15313']; // Common visit codes
      const hasVisitCode = visitCodes.some(code => codesInInvoice.includes(code));

      if (!hasVisitCode && condition.pattern?.includes('visite')) {
        results.push({
          validationRunId,
          ruleId: rule.id,
          billingRecordId: triggerRecord?.id || null,
          idRamq: triggerRecord?.idRamq || null,
          severity: "warning",
          category: "requirement",
          message: `Code ${triggerRecord?.code} exige un code de visite. ${condition.description || ''}`,
          affectedRecords: [triggerRecord?.id],
          ruleData: {
            invoice: invoiceKey,
            triggerCode: triggerRecord?.code,
            allCodes: codesInInvoice
          }
        });
      }
    }
  }

  return results;
}

/**
 * LOCATION RESTRICTION RULES
 * Location-based rules (urgence, cabinet, etc.)
 */
export async function validateLocationRestriction(
  rule: DatabaseRule,
  records: BillingRecord[],
  validationRunId: string
): Promise<InsertValidationResult[]> {
  const results: InsertValidationResult[] = [];
  const condition = rule.condition;
  const restrictedCodes = condition.codes || [];
  const pattern = condition.pattern || '';

  // Determine location type from pattern
  const isEmergencyRule = /urgence|emergency/i.test(pattern);
  const isCabinetRule = /cabinet|office/i.test(pattern);
  const isHomeRule = /domicile|home/i.test(pattern);

  for (const record of records) {
    if (!restrictedCodes.includes(record.code)) continue;

    const establishment = record.lieuPratique || '';
    const sector = record.secteurActivite || '';

    let violation = false;
    let violationMessage = '';

    if (isEmergencyRule) {
      // Code should only be billed in emergency
      const isEmergency = sector.toLowerCase().includes('urgence') || establishment.includes('urgence');
      if (!isEmergency) {
        violation = true;
        violationMessage = `Code ${record.code} est réservé pour l'urgence mais facturé ailleurs`;
      }
    }

    if (isCabinetRule) {
      // Code should only be billed in office/cabinet
      const isCabinet = !sector.toLowerCase().includes('urgence') && !sector.toLowerCase().includes('établissement');
      if (!isCabinet) {
        violation = true;
        violationMessage = `Code ${record.code} est réservé pour le cabinet mais facturé à ${sector}`;
      }
    }

    if (violation) {
      results.push({
        validationRunId,
        ruleId: rule.id,
        billingRecordId: record.id || null,
        idRamq: record.idRamq || null,
        severity: "error",
        category: "location_restriction",
        message: violationMessage,
        affectedRecords: [record.id],
        ruleData: {
          code: record.code,
          establishment,
          sector
        }
      });
    }
  }

  return results;
}

/**
 * AGE RESTRICTION RULES
 * Age-based billing rules
 */
export async function validateAgeRestriction(
  rule: DatabaseRule,
  records: BillingRecord[],
  validationRunId: string
): Promise<InsertValidationResult[]> {
  const results: InsertValidationResult[] = [];
  const condition = rule.condition;
  const restrictedCodes = condition.codes || [];

  // Note: We don't have patient age in the current billing records
  // This would need to be enhanced to fetch patient birthdate from patient table

  // For now, return empty results (would need patient age data)
  console.warn(`[RULES] Age restriction validation requires patient age data (not available in billing records)`);

  return results;
}

/**
 * AMOUNT LIMIT RULES
 * Dollar amount limits per period
 */
export async function validateAmountLimit(
  rule: DatabaseRule,
  records: BillingRecord[],
  validationRunId: string
): Promise<InsertValidationResult[]> {
  const results: InsertValidationResult[] = [];
  const condition = rule.condition;
  const limitCodes = condition.codes || [];
  const maxAmount = rule.threshold || condition.amount || 0;

  // Group by doctor and date
  const doctorDayMap = new Map<string, { records: BillingRecord[], totalAmount: number }>();

  for (const record of records) {
    if (!limitCodes.includes(record.code)) continue;
    if (!record.doctorInfo || !record.dateService) continue;

    const key = `${record.doctorInfo}_${record.dateService.toISOString().split('T')[0]}`;

    if (!doctorDayMap.has(key)) {
      doctorDayMap.set(key, { records: [], totalAmount: 0 });
    }

    const dayData = doctorDayMap.get(key)!;
    dayData.records.push(record);
    dayData.totalAmount += Number(record.montantPreliminaire || 0);
  }

  // Check each doctor-day for amount limit violations
  for (const [key, dayData] of doctorDayMap.entries()) {
    if (dayData.totalAmount > maxAmount) {
      results.push({
        validationRunId,
        ruleId: rule.id,
        billingRecordId: dayData.records[0]?.id || null,
        idRamq: dayData.records[0]?.idRamq || null,
        severity: "error",
        category: "amount_limit",
        message: `Montant journalier dépassé: ${dayData.totalAmount.toFixed(2)}$ (maximum: ${maxAmount.toFixed(2)}$)`,
        affectedRecords: dayData.records.map(r => r.id),
        ruleData: {
          doctorDay: key,
          totalAmount: dayData.totalAmount,
          limit: maxAmount,
          excess: dayData.totalAmount - maxAmount
        }
      });
    }
  }

  return results;
}

/**
 * MUTUAL EXCLUSION RULES
 * Only ONE code from group can be billed per period
 */
export async function validateMutualExclusion(
  rule: DatabaseRule,
  records: BillingRecord[],
  validationRunId: string
): Promise<InsertValidationResult[]> {
  const results: InsertValidationResult[] = [];
  const condition = rule.condition;
  const exclusiveCodes = condition.codes || [];

  // Group by patient and year
  const patientYearMap = new Map<string, BillingRecord[]>();

  for (const record of records) {
    if (!exclusiveCodes.includes(record.code)) continue;
    if (!record.patient || !record.dateService) continue;

    const year = record.dateService.getFullYear();
    const key = `${record.patient}_${year}`;

    if (!patientYearMap.has(key)) {
      patientYearMap.set(key, []);
    }

    patientYearMap.get(key)!.push(record);
  }

  // Check for multiple exclusive codes per patient per year
  for (const [key, patientRecords] of patientYearMap.entries()) {
    const uniqueCodes = new Set(patientRecords.map(r => r.code));

    if (uniqueCodes.size > 1) {
      results.push({
        validationRunId,
        ruleId: rule.id,
        billingRecordId: patientRecords[0]?.id || null,
        idRamq: patientRecords[0]?.idRamq || null,
        severity: "error",
        category: "mutual_exclusion",
        message: `Codes mutuellement exclusifs facturés: ${Array.from(uniqueCodes).join(', ')}. ${condition.description || ''}`,
        affectedRecords: patientRecords.map(r => r.id),
        ruleData: {
          patientYear: key,
          codes: Array.from(uniqueCodes),
          count: patientRecords.length
        }
      });
    }
  }

  return results;
}

/**
 * MISSING ANNUAL OPPORTUNITY RULES
 * Revenue optimization - missing annual visits
 */
export async function validateMissingAnnualOpportunity(
  rule: DatabaseRule,
  records: BillingRecord[],
  validationRunId: string
): Promise<InsertValidationResult[]> {
  const results: InsertValidationResult[] = [];
  const condition = rule.condition;

  const followupCodes = condition.followup_codes || ['15838', '15837', '15823', '15824'];
  const annualCodes = condition.annual_codes || ['15840', '15839', '15836'];
  const revenueOpportunity = condition.revenue_opportunity || 129.15;

  // Group by patient and year
  const patientYearMap = new Map<string, { followups: BillingRecord[], annuals: BillingRecord[] }>();

  for (const record of records) {
    if (!record.patient || !record.dateService) continue;

    const year = record.dateService.getFullYear();
    const key = `${record.patient}_${year}`;

    if (!patientYearMap.has(key)) {
      patientYearMap.set(key, { followups: [], annuals: [] });
    }

    const patientData = patientYearMap.get(key)!;

    if (followupCodes.includes(record.code)) {
      patientData.followups.push(record);
    } else if (annualCodes.includes(record.code)) {
      patientData.annuals.push(record);
    }
  }

  // Check for patients with followups but no annual visit
  for (const [key, patientData] of patientYearMap.entries()) {
    if (patientData.followups.length > 0 && patientData.annuals.length === 0) {
      results.push({
        validationRunId,
        ruleId: rule.id,
        billingRecordId: patientData.followups[0]?.id || null,
        idRamq: patientData.followups[0]?.idRamq || null,
        severity: "optimization",
        category: "revenue_opportunity",
        message: `Patient a des visites de suivi mais aucune visite annuelle complète. Opportunité: ${revenueOpportunity.toFixed(2)}$`,
        affectedRecords: patientData.followups.map(r => r.id),
        ruleData: {
          patientYear: key,
          followupCount: patientData.followups.length,
          missingAnnual: true,
          revenueOpportunity
        }
      });
    }
  }

  return results;
}

/**
 * ANNUAL LIMIT RULES
 * Once-per-year codes
 */
export async function validateAnnualLimit(
  rule: DatabaseRule,
  records: BillingRecord[],
  validationRunId: string
): Promise<InsertValidationResult[]> {
  const results: InsertValidationResult[] = [];
  const condition = rule.condition;
  const annualCodes = condition.codes || [];

  // Group by patient and year
  const patientYearMap = new Map<string, BillingRecord[]>();

  for (const record of records) {
    if (!annualCodes.includes(record.code)) continue;
    if (!record.patient || !record.dateService) continue;

    const year = record.dateService.getFullYear();
    const key = `${record.patient}_${year}`;

    if (!patientYearMap.has(key)) {
      patientYearMap.set(key, []);
    }

    patientYearMap.get(key)!.push(record);
  }

  // Check for multiple annual codes per patient per year
  for (const [key, patientRecords] of patientYearMap.entries()) {
    if (patientRecords.length > 1) {
      results.push({
        validationRunId,
        ruleId: rule.id,
        billingRecordId: patientRecords[0]?.id || null,
        idRamq: patientRecords[0]?.idRamq || null,
        severity: "error",
        category: "annual_limit",
        message: `Code annuel facturé ${patientRecords.length} fois (maximum: 1 par an). ${condition.description || ''}`,
        affectedRecords: patientRecords.map(r => r.id),
        ruleData: {
          patientYear: key,
          code: patientRecords[0].code,
          count: patientRecords.length
        }
      });
    }
  }

  return results;
}
