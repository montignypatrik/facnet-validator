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
      "Visite de prise en charge",
      "Visite périodique",
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

    // Step 4: Validate billing patterns (both pass and error scenarios)
    for (const [key, patientRecords] of patientYearMap.entries()) {
      const year = patientRecords[0].dateService!.getFullYear();
      const code = patientRecords[0].code;
      const [patient] = key.split('_');

      // Get code metadata for tariff value
      const codeMetadata = allCodes.data.find(c => c.code === code);
      const tariffValue = codeMetadata?.tariffValue ? Number(codeMetadata.tariffValue) : 0;

      // P1: Single billing per year (PASS scenario)
      if (patientRecords.length === 1) {
        const record = patientRecords[0];
        const amount = Number(record.montantPaye || 0);
        const isPaid = amount > 0;

        results.push({
          validationRunId,
          ruleId: "ANNUAL_BILLING_CODE",
          billingRecordId: record.id || null,
          idRamq: record.idRamq || null,
          severity: "info",
          category: "annual_limit",
          message: `Code annuel ${code} facturé correctement 1 fois en ${year}.`,
          solution: `Aucune action requise. Ce code est conforme aux exigences de facturation annuelle.`,
          affectedRecords: [record.id].filter(Boolean) as string[],
          ruleData: {
            monetaryImpact: 0,
            code,
            patient,
            year,
            totalCount: 1,
            paidCount: isPaid ? 1 : 0,
            unpaidCount: isPaid ? 0 : 1,
            date: record.dateService?.toISOString().split('T')[0] || '',
            amount: amount,
            leafPattern: codeMetadata?.leaf || null,
          }
        });
        continue;
      }

      // Multiple billings detected - categorize by payment status
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

      // Generate appropriate error message and solution
      let message: string;
      let solution: string;
      let severity: "error" | "warning" = "error";
      let monetaryImpact = 0;
      let ruleData: any = {
        patientYear: key,
        patient,
        year,
        code,
        totalCount,
        paidCount,
        unpaidCount,
        leafPattern: codeMetadata?.leaf || null,
      };

      if (paidCount > 1) {
        // E1: Multiple paid billings for same annual code
        message = `Code annuel ${code} facturé ${totalCount} fois et payé ${paidCount} fois pour le même patient en ${year}. Maximum: 1 par an.`;
        solution = `Veuillez vérifier si les deux visites ont bien été payées. Si oui, remplacez l'une d'entre elles par une visite conforme au besoin.`;
        severity = "error";
        monetaryImpact = 0;
        ruleData.dates = patientRecords.map(r => r.dateService?.toISOString().split('T')[0] || '');
        ruleData.amounts = patientRecords.map(r => Number(r.montantPaye || 0));
        ruleData.totalPaidAmount = paidRecords.reduce((sum, r) => sum + Number(r.montantPaye || 0), 0);
      } else if (paidCount === 1 && unpaidCount > 0) {
        // E2: One paid, others unpaid
        const paidRecord = paidRecords[0];
        const paidIdRamq = paidRecord.idRamq || '';
        const unpaidIdRamqs = unpaidRecords.map(r => r.idRamq || '').filter(Boolean);

        message = `Code annuel ${code} facturé ${totalCount} fois en ${year}. La facture ${paidIdRamq} est payée, mais les factures ${unpaidIdRamqs.join(', ')} restent non payées.`;
        solution = `Veuillez remplacer les factures suivantes ${unpaidIdRamqs.join(', ')} pour qu'elles soient conformes. Ce code ne peut être facturé qu'une fois par année civile.`;
        severity = "error";
        monetaryImpact = 0;
        ruleData.paidIdRamq = paidIdRamq;
        ruleData.paidDate = paidRecord.dateService?.toISOString().split('T')[0] || '';
        ruleData.paidAmount = Number(paidRecord.montantPaye || 0);
        ruleData.unpaidIdRamqs = unpaidIdRamqs;
        ruleData.unpaidDates = unpaidRecords.map(r => r.dateService?.toISOString().split('T')[0] || '');
        ruleData.unpaidAmounts = unpaidRecords.map(r => Number(r.montantPaye || 0));
      } else {
        // E3: All unpaid - potential revenue gain
        message = `Le code annuel ${code} a été facturé ${totalCount} fois en ${year}, toutes les factures sont impayées.`;
        solution = `Veuillez valider la raison du refus et corriger les demandes restantes pour que le tout soit conforme.`;
        severity = "error";
        monetaryImpact = tariffValue; // Positive impact = potential gain
        ruleData.dates = patientRecords.map(r => r.dateService?.toISOString().split('T')[0] || '');
        ruleData.amounts = patientRecords.map(r => Number(r.montantPaye || 0));
        ruleData.totalUnpaidAmount = tariffValue * totalCount;
        ruleData.tariffValue = tariffValue;
      }

      // Add common ruleData fields
      ruleData.monetaryImpact = monetaryImpact;

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
        ruleData
      });
    }

    return results;
  }
};
