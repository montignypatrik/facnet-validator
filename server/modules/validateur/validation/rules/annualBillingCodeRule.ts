import { BillingRecord, InsertValidationResult } from "@shared/schema";
import { ValidationRule } from "../engine";
import { storage } from "../../../../core/storage";

/**
 * Annual Billing Code Validation Rule
 *
 * Codes identified by leaf field that can only be billed once per calendar year.
 * Provides smart guidance based on paid/unpaid status.
 *
 * Key Features:
 * - Queries database for codes matching specific leaf patterns (e.g., "04 - Examen annuel complet")
 * - Groups billing by patient and calendar year
 * - Distinguishes between paid and unpaid duplicate billings
 * - Provides context-aware solutions based on payment status
 *
 * Business Rules:
 * - If multiple paid billings: CRITICAL ERROR → Contact RAMQ
 * - If 1 paid + unpaid billings: WARNING → Delete unpaid billings
 * - If all unpaid billings: WARNING → Keep only one, delete others
 *
 * References:
 * - Rule spec: docs/modules/validateur/rules-implemented/ANNUAL_BILLING_CODE.md
 * - Leaf patterns: Defined in codes table
 */
export const annualBillingCodeRule: ValidationRule = {
  id: "ANNUAL_BILLING_CODE",
  name: "Code à facturation annuelle",
  category: "annual_limit",
  enabled: true,

  async validate(records: BillingRecord[], validationRunId: string): Promise<InsertValidationResult[]> {
    const results: InsertValidationResult[] = [];

    // Hardcoded leaf patterns for annual billing codes
    // These are the categories of codes that can only be billed once per year
    const leafPatterns = [
      "04 - Examen annuel complet",
      // Add more leaf patterns as needed based on RAMQ regulations
    ];

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
        ruleId: "ANNUAL_BILLING_CODE",
        billingRecordId: patientRecords[0]?.id || null,
        idRamq: ramqIds.join(', ') || null,
        severity,
        category: "annual_limit",
        message,
        solution,
        affectedRecords: patientRecords.map(r => r.id).filter(Boolean) as string[],
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
          paidRecordIds: paidRecords.map(r => r.id).filter(Boolean) as string[],
          unpaidRecordIds: unpaidRecords.map(r => r.id).filter(Boolean) as string[]
        }
      });
    }

    return results;
  }
};
