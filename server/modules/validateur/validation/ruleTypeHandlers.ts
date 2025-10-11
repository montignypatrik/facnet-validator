/**
 * Rule Type Handlers
 * Implements validation logic for each RAMQ rule type
 */

import { BillingRecord, InsertValidationResult } from "@shared/schema";
import { DatabaseRule } from "./databaseRuleLoader";
import { storage } from "../../../core/storage";

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

/**
 * ANNUAL BILLING CODE RULES
 * Codes identified by leaf field that can only be billed once per calendar year
 * Provides smart guidance based on paid/unpaid status
 */
export async function validateAnnualBillingCode(
  rule: DatabaseRule,
  records: BillingRecord[],
  validationRunId: string
): Promise<InsertValidationResult[]> {
  const results: InsertValidationResult[] = [];
  const condition = rule.condition;
  const leafPatterns = condition.leafPatterns || [];

  if (leafPatterns.length === 0) {
    console.warn(`[RULES] Annual billing code rule has no leaf patterns defined`);
    return results;
  }

  // Step 1: Query database to get all billing codes matching the leaf patterns
  const allCodes = await storage.getCodes({ pageSize: 10000 }); // Get all codes
  const targetCodes = allCodes.data
    .filter(code => leafPatterns.includes(code.leaf))
    .map(code => code.code);

  if (targetCodes.length === 0) {
    console.warn(`[RULES] No codes found matching leaf patterns: ${leafPatterns.join(', ')}`);
    return results;
  }

  console.log(`[RULES] Found ${targetCodes.length} annual billing codes from leaf patterns`);

  // Step 2: Filter billing records to only include target codes
  const annualRecords = records.filter(r => targetCodes.includes(r.code));

  // Step 3: Group by patient and calendar year
  const patientYearMap = new Map<string, BillingRecord[]>();

  for (const record of annualRecords) {
    if (!record.patient || !record.dateService) continue;

    const year = record.dateService.getFullYear();
    const key = `${record.patient}_${year}`;

    if (!patientYearMap.has(key)) {
      patientYearMap.set(key, []);
    }

    patientYearMap.get(key)!.push(record);
  }

  // Step 4: Check for violations (> 1 billing per patient per year)
  for (const [key, patientRecords] of patientYearMap.entries()) {
    if (patientRecords.length <= 1) continue; // No violation

    // Separate paid vs unpaid records
    const paidRecords = patientRecords.filter(r => {
      const amount = Number(r.montantPaye || 0);
      return amount > 0;
    });
    const unpaidRecords = patientRecords.filter(r => {
      const amount = Number(r.montantPaye || 0);
      return amount === 0;
    });

    const paidCount = paidRecords.length;
    const unpaidCount = unpaidRecords.length;
    const totalCount = patientRecords.length;
    const year = patientRecords[0].dateService!.getFullYear();
    const code = patientRecords[0].code;
    const [patient] = key.split('_');

    // Generate appropriate error message and solution
    let message: string;
    let solution: string;
    let severity: "error" | "warning" = "error";

    if (paidCount > 1) {
      // CRITICAL: Multiple paid billings for same annual code
      message = `Code annuel ${code} facturé ${totalCount} fois et payé ${paidCount} fois pour le même patient en ${year}. Maximum: 1 par an.`;
      solution = `Contactez la RAMQ pour corriger les paiements multiples. Ce code ne peut être payé qu'une fois par année civile.`;
      severity = "error";
    } else if (paidCount === 1 && unpaidCount > 0) {
      // One paid, others unpaid - suggest deleting unpaid
      message = `Code annuel ${code} facturé ${totalCount} fois en ${year}. Un est payé, ${unpaidCount} ${unpaidCount === 1 ? 'reste' : 'restent'} non ${unpaidCount === 1 ? 'payé' : 'payés'}.`;
      solution = `Veuillez supprimer ${unpaidCount === 1 ? 'la facture non payée' : `les ${unpaidCount} factures non payées`}. Ce code ne peut être facturé qu'une fois par année civile.`;
      severity = "warning";
    } else {
      // All unpaid - suggest keeping only one
      message = `Code annuel ${code} facturé ${totalCount} fois en ${year}, tous non payés.`;
      solution = `Veuillez supprimer ${totalCount - 1} des factures et n'en garder qu'une seule. Ce code ne peut être facturé qu'une fois par année civile.`;
      severity = "warning";
    }

    // Get all affected RAMQ IDs for display
    const ramqIds = [...new Set(patientRecords.map(r => r.idRamq).filter(Boolean))];

    results.push({
      validationRunId,
      ruleId: rule.id,
      billingRecordId: patientRecords[0]?.id || null,
      idRamq: ramqIds.join(', ') || null,
      severity,
      category: "annual_limit",
      message,
      solution,
      affectedRecords: patientRecords.map(r => r.id),
      ruleData: {
        patientYear: key,
        patient,
        year,
        code,
        totalCount,
        paidCount,
        unpaidCount,
        leafPattern: allCodes.data.find(c => c.code === code)?.leaf || null,
        ramqIds,
        paidRecordIds: paidRecords.map(r => r.id),
        unpaidRecordIds: unpaidRecords.map(r => r.id)
      }
    });
  }

  return results;
}

/**
 * GMF FORFAIT 8875 VALIDATION
 * Validates GMF annual forfait billing according to RAMQ regulations
 *
 * This rule validates two distinct scenarios:
 * 1. DUPLICATE DETECTION (Error): Code 8875 can only be billed ONCE per patient per calendar year
 * 2. MISSED OPPORTUNITY (Optimization): Detects patients with GMF visits but no 8875 billed
 *
 * References:
 * - Rule spec: docs/modules/validateur/rules-future/gmf_8875_validation.md
 * - Code 8875: Forfait de prise en charge GMF (9.35$)
 * - GMF establishments: ep_33 = true in establishments table
 */
export async function validateGmfForfait8875(
  rule: DatabaseRule,
  records: BillingRecord[],
  validationRunId: string
): Promise<InsertValidationResult[]> {
  const results: InsertValidationResult[] = [];

  // Load required database tables at startup (cached in memory for performance)
  const { db } = await import("../../../core/db");
  const { codes: codesTable, establishments: establishmentsTable } = await import("@shared/schema");
  const { sql } = await import("drizzle-orm");

  // Load codes table: code → level1_group mapping
  const allCodes = await db.select({
    code: codesTable.code,
    level1Group: codesTable.level1Group
  }).from(codesTable);

  const codesMap = new Map<string, { level1Group: string | null }>();
  for (const codeRow of allCodes) {
    codesMap.set(codeRow.code, { level1Group: codeRow.level1Group });
  }

  console.log(`[GMF 8875] Loaded ${codesMap.size} codes from database`);

  // Load GMF establishments: establishments where ep_33 = true
  const gmfEstablishmentsData = await db.select({
    numero: establishmentsTable.numero,
    ep33: establishmentsTable.ep33
  }).from(establishmentsTable).where(sql`${establishmentsTable.ep33} = true`);

  const gmfEstablishments = new Set<string>();
  for (const est of gmfEstablishmentsData) {
    if (est.numero) {
      gmfEstablishments.add(est.numero);
    }
  }

  console.log(`[GMF 8875] Loaded ${gmfEstablishments.size} GMF establishments (ep_33 = true)`);

  // ==================== SCENARIO 1: DUPLICATE DETECTION ====================
  // Validate that code 8875 is not billed more than once per patient per calendar year
  // Flag all 8875 billings AFTER the first paid occurrence

  const code8875Records = records.filter(r => r.code === '8875');

  // Group by patient and calendar year
  const patientYearMap8875 = new Map<string, BillingRecord[]>();

  for (const record of code8875Records) {
    if (!record.patient || !record.dateService) continue;

    const year = record.dateService.getFullYear();
    const key = `${record.patient}_${year}`;

    if (!patientYearMap8875.has(key)) {
      patientYearMap8875.set(key, []);
    }

    patientYearMap8875.get(key)!.push(record);
  }

  // Check for duplicates (> 1 billing per patient per year) - convert to array to avoid downlevelIteration issues
  const patientYearEntries8875 = Array.from(patientYearMap8875.entries());
  for (const [key, billings] of patientYearEntries8875) {
    if (billings.length <= 1) continue; // No violation

    // Count paid vs unpaid billings
    const totalCount = billings.length;
    const paidCount = billings.filter((b: BillingRecord) => Number(b.montantPaye || 0) > 0).length;

    // Only trigger error if at least one billing is paid
    if (paidCount === 0) continue;

    // Sort billings by dateService ascending to find first paid
    const sortedBillings = [...billings].sort((a: BillingRecord, b: BillingRecord) => {
      const dateA = new Date(a.dateService!);
      const dateB = new Date(b.dateService!);
      return dateA.getTime() - dateB.getTime();
    });

    // Find first paid billing
    const firstPaidIndex = sortedBillings.findIndex((b: BillingRecord) => Number(b.montantPaye || 0) > 0);
    const firstPaidBilling = sortedBillings[firstPaidIndex];
    const firstPaidDate = firstPaidBilling.dateService!.toISOString().split('T')[0];
    const year = firstPaidBilling.dateService!.getFullYear();
    const [patient] = key.split('_');

    // Flag all billings AFTER first paid (whether paid or unpaid)
    for (let i = firstPaidIndex + 1; i < sortedBillings.length; i++) {
      const duplicateBilling = sortedBillings[i];

      results.push({
        validationRunId,
        ruleId: rule.id,
        billingRecordId: duplicateBilling.id,
        idRamq: duplicateBilling.idRamq || null,
        severity: "error",
        category: "gmf_forfait",
        message: `Le code 8875 (forfait GMF) ne peut être facturé qu'une seule fois par année civile par patient. Déjà facturé ${totalCount} fois et payé ${paidCount} fois en ${year}.`,
        solution: `Veuillez annuler cette facturation. Le forfait 8875 a déjà été payé pour ce patient le ${firstPaidDate}.`,
        affectedRecords: sortedBillings.map((b: BillingRecord) => b.id),
        ruleData: {
          patient,
          year,
          totalCount,
          paidCount,
          firstPaidDate,
          affectedInvoices: sortedBillings.map((b: BillingRecord) => b.facture || b.idRamq).filter(Boolean)
        }
      });
    }
  }

  // ==================== SCENARIO 2: MISSED OPPORTUNITY DETECTION ====================
  // Detect patients with qualifying GMF visits but no 8875 billed in the year
  // Flag the FIRST qualifying visit of the calendar year

  /**
   * Helper: Check if record has excluded context (MTA13, GMFU, GAP, G160, AR)
   * Uses exact match after comma-splitting to prevent false positives
   */
  function hasExcludedContext(elementContexte: string | null): boolean {
    if (!elementContexte) return false;

    const excludedContexts = ["MTA13", "GMFU", "GAP", "G160", "AR"];

    // Split by comma and trim whitespace to get individual context codes
    const codes = elementContexte.toUpperCase().split(',').map(c => c.trim());

    // Check if ANY excluded context matches exactly (not substring)
    return codes.some(code => excludedContexts.includes(code));
  }

  /**
   * Helper: Check if billing code qualifies as a visit
   * A visit qualifies if:
   * 1. Code is 8857 or 8859 (specific visit codes), OR
   * 2. Code belongs to visit level1_group from codes table
   */
  function isQualifyingVisit(billingCode: string): boolean {
    // Check specific visit codes first
    const specificVisitCodes = ["8857", "8859"];
    if (specificVisitCodes.includes(billingCode)) {
      return true;
    }

    // Check level1_group from codes table
    const codeData = codesMap.get(billingCode);
    if (!codeData || !codeData.level1Group) return false;

    const visitLevel1Groups = [
      "Visites sur rendez-vous (patient de 80 ans ou plus)",
      "Visites sur rendez-vous (patient de moins de 80 ans)"
    ];

    return visitLevel1Groups.includes(codeData.level1Group);
  }

  // Filter for qualifying GMF visits (excluding 8875 codes themselves)
  const gmfVisitRecords = records.filter(r => {
    if (r.code === '8875') return false; // Exclude 8875 codes from visit counting
    if (!r.lieuPratique) return false;
    if (!isQualifyingVisit(r.code || '')) return false;
    if (!gmfEstablishments.has(r.lieuPratique)) return false;
    if (hasExcludedContext(r.elementContexte)) return false;
    return true;
  });

  // Group GMF visits by patient and calendar year
  const patientYearVisitsMap = new Map<string, BillingRecord[]>();

  for (const record of gmfVisitRecords) {
    if (!record.patient || !record.dateService) continue;

    const year = record.dateService.getFullYear();
    const key = `${record.patient}_${year}`;

    if (!patientYearVisitsMap.has(key)) {
      patientYearVisitsMap.set(key, []);
    }

    patientYearVisitsMap.get(key)!.push(record);
  }

  // Check for missed 8875 opportunities - convert to array to avoid downlevelIteration issues
  const patientYearEntries = Array.from(patientYearVisitsMap.entries());
  for (const [key, visits] of patientYearEntries) {
    const [patient, yearStr] = key.split('_');
    const year = parseInt(yearStr);

    // Check if this patient has any 8875 billed in this year
    const has8875 = code8875Records.some(r =>
      r.patient === patient &&
      r.dateService &&
      r.dateService.getFullYear() === year
    );

    // If 8875 already billed, no optimization needed
    if (has8875) continue;

    // Sort visits by date to find first visit of the year
    const sortedVisits = [...visits].sort((a: BillingRecord, b: BillingRecord) => {
      const dateA = new Date(a.dateService!);
      const dateB = new Date(b.dateService!);
      return dateA.getTime() - dateB.getTime();
    });

    const firstVisit = sortedVisits[0];
    const firstVisitDate = firstVisit.dateService!.toISOString().split('T')[0];
    const visitCount = visits.length;

    // Get unique GMF establishments from all visits
    const gmfEstablishmentsList = Array.from(new Set(visits.map((v: BillingRecord) => v.lieuPratique).filter(Boolean)));

    // Flag the FIRST visit as the optimization opportunity
    results.push({
      validationRunId,
      ruleId: rule.id,
      billingRecordId: firstVisit.id,
      idRamq: firstVisit.idRamq || null,
      severity: "optimization",
      category: "gmf_forfait",
      message: `Patient inscrit GMF avec ${visitCount} visite(s) en ${year} mais sans forfait 8875 facturé. Perte de revenu : 9,35$.`,
      solution: `Veuillez facturer le code 8875 (9,35$) lors de la première visite de l'année. Date de première visite GMF : ${firstVisitDate}.`,
      affectedRecords: sortedVisits.map((v: BillingRecord) => v.id),
      ruleData: {
        patient,
        year,
        visitCount,
        firstVisitDate,
        potentialRevenue: 9.35,
        gmfEstablishments: gmfEstablishmentsList
      }
    });
  }

  console.log(`[GMF 8875] Validation complete: ${results.length} results (duplicates + opportunities)`);

  // ==================== INFORMATIONAL SUMMARY ====================
  // Always add an informational result showing GMF 8875 statistics
  // This helps users verify the rule is working even when there are no errors

  const total8875Count = code8875Records.length;
  const paid8875Count = code8875Records.filter(r => Number(r.montantPaye || 0) > 0).length;
  const unique8875Patients = new Set(code8875Records.map(r => r.patient).filter(Boolean)).size;
  const totalGmfVisits = gmfVisitRecords.length;
  const uniqueGmfVisitPatients = new Set(gmfVisitRecords.map(r => r.patient).filter(Boolean)).size;

  // Only add summary if there are relevant records
  if (total8875Count > 0 || totalGmfVisits > 0) {
    results.push({
      validationRunId,
      ruleId: rule.id,
      billingRecordId: code8875Records[0]?.id || gmfVisitRecords[0]?.id || null,
      idRamq: code8875Records[0]?.idRamq || gmfVisitRecords[0]?.idRamq || null,
      severity: "info",
      category: "gmf_forfait",
      message: `Validation GMF 8875 complétée: ${total8875Count} forfait(s) facturé(s) (${paid8875Count} payé(s)) pour ${unique8875Patients} patient(s). ${totalGmfVisits} visite(s) GMF pour ${uniqueGmfVisitPatients} patient(s) unique(s).`,
      solution: null,
      affectedRecords: [...code8875Records.map(r => r.id), ...gmfVisitRecords.slice(0, 10).map(r => r.id)].filter(Boolean),
      ruleData: {
        total8875Count,
        paid8875Count,
        unique8875Patients,
        totalGmfVisits,
        uniqueGmfVisitPatients,
        gmfEstablishmentsCount: gmfEstablishments.size,
        duplicateErrors: results.filter(r => r.severity === 'error').length,
        opportunityOptimizations: results.filter(r => r.severity === 'optimization').length
      }
    });
  }

  return results;
}
