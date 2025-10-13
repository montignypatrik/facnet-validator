import { BillingRecord, InsertValidationResult } from "@shared/schema";
import { ValidationRule } from "../engine";

/**
 * GMF Forfait 8875 Validation Rule
 *
 * Validates GMF annual forfait billing according to RAMQ regulations.
 *
 * This rule validates two distinct scenarios:
 * 1. DUPLICATE DETECTION (Error): Code 8875 can only be billed ONCE per patient per calendar year
 * 2. MISSED OPPORTUNITY (Optimization): Detects patients with GMF visits but no 8875 billed
 *
 * References:
 * - Rule spec: docs/modules/validateur/rules-implemented/gmf_8875_validation.md
 * - Code 8875: Forfait de prise en charge GMF (9.35$)
 * - GMF establishments: ep_33 = true in establishments table
 */
export const gmfForfait8875Rule: ValidationRule = {
  id: "GMF_FORFAIT_8875",
  name: "Forfait de prise en charge GMF (8875)",
  category: "gmf_forfait",
  enabled: true,

  async validate(records: BillingRecord[], validationRunId: string): Promise<InsertValidationResult[]> {
    const results: InsertValidationResult[] = [];

    // Load required database tables at startup (cached in memory for performance)
    const { db } = await import("../../../../core/db");
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
          ruleId: "GMF_FORFAIT_8875",
          billingRecordId: duplicateBilling.id,
          idRamq: duplicateBilling.idRamq || null,
          severity: "error",
          category: "gmf_forfait",
          message: `Le code 8875 (forfait GMF) ne peut être facturé qu'une seule fois par année civile par patient. Déjà facturé ${totalCount} fois et payé ${paidCount} fois en ${year}.`,
          solution: `Veuillez annuler cette facturation. Le forfait 8875 a déjà été payé pour ce patient le ${firstPaidDate}.`,
          affectedRecords: sortedBillings.map((b: BillingRecord) => b.id).filter(Boolean) as string[],
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
        ruleId: "GMF_FORFAIT_8875",
        billingRecordId: firstVisit.id,
        idRamq: firstVisit.idRamq || null,
        severity: "optimization",
        category: "gmf_forfait",
        message: `Patient inscrit GMF avec ${visitCount} visite(s) en ${year} mais sans forfait 8875 facturé. Perte de revenu : 9,35$.`,
        solution: `Veuillez facturer le code 8875 (9,35$) lors de la première visite de l'année. Date de première visite GMF : ${firstVisitDate}.`,
        affectedRecords: sortedVisits.map((v: BillingRecord) => v.id).filter(Boolean) as string[],
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
        ruleId: "GMF_FORFAIT_8875",
        billingRecordId: code8875Records[0]?.id || gmfVisitRecords[0]?.id || null,
        idRamq: code8875Records[0]?.idRamq || gmfVisitRecords[0]?.idRamq || null,
        severity: "info",
        category: "gmf_forfait",
        message: `Validation GMF 8875 complétée: ${total8875Count} forfait(s) facturé(s) (${paid8875Count} payé(s)) pour ${unique8875Patients} patient(s). ${totalGmfVisits} visite(s) GMF pour ${uniqueGmfVisitPatients} patient(s) unique(s).`,
        solution: null,
        affectedRecords: [...code8875Records.map(r => r.id), ...gmfVisitRecords.slice(0, 10).map(r => r.id)].filter(Boolean) as string[],
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
};
