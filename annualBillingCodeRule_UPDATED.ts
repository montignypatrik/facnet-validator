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
 * - Queries database for codes matching specific leaf patterns (e.g., "Visite de prise en charge", "Visite périodique")
 * - Groups billing by patient and calendar year
 * - Distinguishes between paid and unpaid duplicate billings
 * - Provides context-aware solutions based on payment status
 *
 * Business Rules:
 * - E1 - Multiple paid billings: ERROR → Verify both visits were paid, replace one if needed (monetaryImpact: 0)
 * - E2 - One paid + unpaid billings: ERROR → Replace unpaid billings (monetaryImpact: 0)
 * - E3 - All unpaid billings: ERROR → Validate rejection reason, correct remaining requests (monetaryImpact: +tariffValue)
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

    // Leaf patterns for annual billing codes
    // These are the categories of codes that can only be billed once per year
    const leafPatterns = [
      "Visite de prise en charge",
      "Visite périodique"
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

    // Create a map for quick tariff value lookup
    const codeTariffMap = new Map<string, number>();
    allCodes.data.forEach(code => {
      if (code.tariffValue) {
        codeTariffMap.set(code.code, Number(code.tariffValue));
      }
    });

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

      // Get tariff value for this code
      const tariffValue = codeTariffMap.get(code) || 0;

      // Get all affected RAMQ IDs for display
      const ramqIds = [...new Set(patientRecords.map(r => r.idRamq).filter(Boolean))];

      // Generate appropriate error message, solution, and monetary impact
      let message: string;
      let solution: string;
      let monetaryImpact: number;
      let severity: "error" | "warning" = "error";
      let ruleData: Record<string, any>;

      if (paidCount > 1) {
        // E1: Multiple paid billings for same annual code
        const dates = paidRecords.map(r => r.dateService?.toISOString().split('T')[0] || '');
        const amounts = paidRecords.map(r => Number(r.montantPaye || 0));
        const totalPaidAmount = amounts.reduce((sum, amt) => sum + amt, 0);

        message = `Code annuel ${code} facturé ${totalCount} fois et payé ${paidCount} fois pour le même patient en ${year}. Maximum: 1 par an.`;
        solution = `Veuillez vérifier si les deux visites ont bien été payées. Si oui, remplacez l'une d'entre elles par une visite conforme au besoin.`;
        monetaryImpact = 0; // Cannot calculate - depends on replacement code
        severity = "error";

        ruleData = {
          monetaryImpact: 0,
          code,
          patient,
          year,
          totalCount,
          paidCount,
          unpaidCount,
          dates,
          amounts,
          totalPaidAmount,
          patientYear: key,
          leafPattern: allCodes.data.find(c => c.code === code)?.leaf || null,
          ramqIds,
          paidRecordIds: paidRecords.map(r => r.id).filter(Boolean) as string[],
          unpaidRecordIds: unpaidRecords.map(r => r.id).filter(Boolean) as string[]
        };
      } else if (paidCount === 1 && unpaidCount > 0) {
        // E2: One paid, others unpaid
        const paidRecord = paidRecords[0];
        const paidIdRamq = paidRecord.idRamq || '';
        const paidDate = paidRecord.dateService?.toISOString().split('T')[0] || '';
        const paidAmount = Number(paidRecord.montantPaye || 0);

        const unpaidIdRamqs = unpaidRecords.map(r => r.idRamq).filter(Boolean) as string[];
        const unpaidDates = unpaidRecords.map(r => r.dateService?.toISOString().split('T')[0] || '');
        const unpaidAmounts = unpaidRecords.map(r => Number(r.montantPaye || 0));

        message = `Code annuel ${code} facturé ${totalCount} fois en ${year}. La facture ${paidIdRamq} est payée, mais les factures ${unpaidIdRamqs.join(', ')} restent non payées.`;
        solution = `Veuillez remplacer les factures suivantes ${unpaidIdRamqs.join(', ')} pour qu'elles soient conformes. Ce code ne peut être facturé qu'une fois par année civile.`;
        monetaryImpact = 0; // Unpaid billings can be removed before submission
        severity = "error";

        ruleData = {
          monetaryImpact: 0,
          code,
          patient,
          year,
          totalCount,
          paidCount,
          unpaidCount,
          paidIdRamq,
          paidDate,
          paidAmount,
          unpaidIdRamqs,
          unpaidDates,
          unpaidAmounts,
          patientYear: key,
          leafPattern: allCodes.data.find(c => c.code === code)?.leaf || null,
          ramqIds,
          paidRecordIds: paidRecords.map(r => r.id).filter(Boolean) as string[],
          unpaidRecordIds: unpaidRecords.map(r => r.id).filter(Boolean) as string[]
        };
      } else {
        // E3: All unpaid billings
        const dates = unpaidRecords.map(r => r.dateService?.toISOString().split('T')[0] || '');
        const amounts = unpaidRecords.map(r => Number(r.montantPaye || 0));
        const totalUnpaidAmount = totalCount * tariffValue; // Total potential value if all were paid

        message = `Le code annuel ${code} a été facturé ${totalCount} fois en ${year}, toutes les factures sont impayées.`;
        solution = `Veuillez valider la raison du refus et corriger les demandes restantes pour que le tout soit conforme.`;
        monetaryImpact = tariffValue; // Minimum revenue gain - at least 1 billing will be paid
        severity = "error";

        ruleData = {
          monetaryImpact: tariffValue,
          code,
          patient,
          year,
          totalCount,
          paidCount,
          unpaidCount,
          dates,
          amounts,
          totalUnpaidAmount,
          tariffValue,
          patientYear: key,
          leafPattern: allCodes.data.find(c => c.code === code)?.leaf || null,
          ramqIds,
          paidRecordIds: paidRecords.map(r => r.id).filter(Boolean) as string[],
          unpaidRecordIds: unpaidRecords.map(r => r.id).filter(Boolean) as string[]
        };
      }

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
        ruleData
      });
    }

    return results;
  }
};
