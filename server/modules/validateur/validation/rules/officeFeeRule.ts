import { BillingRecord, InsertValidationResult } from "../../../shared/schema";
import { ValidationRule } from "../engine";

export interface DoctorDayData {
  doctor: string;
  date: string;
  registeredPatients: Set<string>;
  walkInPatients: Set<string>;
  officeFees: BillingRecord[];
  totalAmount: number;
}

/**
 * Redact doctor name for PHI compliance
 * Input: "1901594-22114 | Morin, Caroline - Omnipraticien"
 * Output: "Dr. M***"
 */
function redactDoctorName(fullName: string): string {
  const parts = fullName.split('|');
  if (parts.length < 2) return "Dr. ***";

  const namePart = parts[1].trim(); // "Morin, Caroline - Omnipraticien"
  const lastName = namePart.split(',')[0].trim(); // "Morin"
  const initial = lastName.charAt(0).toUpperCase(); // "M"

  return `Dr. ${initial}***`;
}

/**
 * Format currency in Quebec French format (XX,XX$)
 */
function formatCurrency(amount: number): string {
  return amount.toFixed(2).replace('.', ',') + '$';
}

export const officeFeeValidationRule: ValidationRule = {
  id: "office-fee-validation",
  name: "Office Fee Validation (19928/19929)",
  category: "office_fees",
  enabled: true,

  async validate(records: BillingRecord[], validationRunId: string): Promise<InsertValidationResult[]> {
    const results: InsertValidationResult[] = [];

    // Group data by doctor and date
    const doctorDayMap = new Map<string, DoctorDayData>();

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

      const dayData = doctorDayMap.get(key)!;

      // Track office fee codes
      if (record.code === "19928" || record.code === "19929") {
        dayData.officeFees.push(record);
        dayData.totalAmount += Number(record.montantPreliminaire || 0);
      } else if (record.patient) {
        // Track patient visits
        if (record.elementContexte?.includes("#G160") || record.elementContexte?.includes("#AR")) {
          // Walk-in patient
          dayData.walkInPatients.add(record.patient);
        } else {
          // Registered patient
          dayData.registeredPatients.add(record.patient);
        }
      }
    }

    // Second pass: validate each doctor-day
    for (const [key, dayData] of doctorDayMap.entries()) {
      results.push(...validateDoctorDay(dayData, records, validationRunId));
    }

    // P-SUMMARY: Validation Complete Summary
    const passCount = results.filter(r => r.severity === 'info').length;
    const errorCount = results.filter(r => r.severity === 'error').length;
    const optimizationCount = results.filter(r => r.severity === 'optimization').length;
    const totalPotentialGain = results
      .filter(r => r.severity === 'optimization')
      .reduce((sum, r) => sum + (typeof r.ruleData?.monetaryImpact === 'number' ? r.ruleData.monetaryImpact : 0), 0);

    const officeFeeRecords = records.filter(r => r.code === "19928" || r.code === "19929");
    const totalAmount = officeFeeRecords.reduce((sum, r) => sum + Number(r.montantPreliminaire || 0), 0);

    results.push({
      validationRunId,
      ruleId: "office-fee-validation",
      billingRecordId: null,
      severity: "info",
      category: "office_fees",
      message: `Validation frais de bureau complétée: ${officeFeeRecords.length} enregistrement(s) traité(s), ${passCount} réussi(s), ${errorCount} erreur(s), ${optimizationCount} opportunité(s)`,
      affectedRecords: [],
      ruleData: {
        scenarioId: "P-SUMMARY",
        monetaryImpact: 0,
        totalRecords: officeFeeRecords.length,
        passCount,
        errorCount,
        optimizationCount,
        totalAmount,
        totalPotentialGain
      }
    });

    return results;
  }
};

function validateDoctorDay(dayData: DoctorDayData, records: BillingRecord[], validationRunId: string): InsertValidationResult[] {
  const results: InsertValidationResult[] = [];

  const registeredCount = dayData.registeredPatients.size;
  const walkInCount = dayData.walkInPatients.size;

  // Calculate visit statistics for display (used by all error types)
  // Count visits with payment status by examining patient records
  const registeredPaidCount = [...dayData.registeredPatients].filter(patientId => {
    // A patient is "paid" if ANY of their records for this day has montantPaye > 0
    return records.some(r =>
      r.patient === patientId &&
      r.dateService?.toISOString().split('T')[0] === dayData.date &&
      r.montantPaye && parseFloat(r.montantPaye.toString()) > 0
    );
  }).length;

  const registeredUnpaidCount = dayData.registeredPatients.size - registeredPaidCount;

  const walkInPaidCount = [...dayData.walkInPatients].filter(patientId => {
    return records.some(r =>
      r.patient === patientId &&
      r.dateService?.toISOString().split('T')[0] === dayData.date &&
      r.montantPaye && parseFloat(r.montantPaye.toString()) > 0
    );
  }).length;

  const walkInUnpaidCount = dayData.walkInPatients.size - walkInPaidCount;

  // Determine eligibility (using PAID counts only per spec)
  const registeredEligible = determineEligibility(registeredPaidCount, 'registered');
  const walkInEligible = determineEligibility(walkInPaidCount, 'walkIn');

  // Separate office fees by type
  const registeredOfficeFees = dayData.officeFees.filter(fee =>
    !fee.elementContexte?.includes("#G160") && !fee.elementContexte?.includes("#AR")
  );
  const walkInOfficeFees = dayData.officeFees.filter(fee =>
    fee.elementContexte?.includes("#G160") || fee.elementContexte?.includes("#AR")
  );

  // Track what was billed
  const billed19928Registered = registeredOfficeFees.some(f => f.code === "19928");
  const billed19929Registered = registeredOfficeFees.some(f => f.code === "19929");
  const billed19928WalkIn = walkInOfficeFees.some(f => f.code === "19928");
  const billed19929WalkIn = walkInOfficeFees.some(f => f.code === "19929");

  // ===== ERROR VALIDATION (all have Impact = $0) =====

  // Check each office fee claim for errors
  for (const officeFee of dayData.officeFees) {
    const hasContext = officeFee.elementContexte?.includes("#G160") ||
                      officeFee.elementContexte?.includes("#AR");

    // E6: Check if billed in hospital/établissement instead of cabinet
    const isCabinet = officeFee.lieuPratique?.toString().startsWith('5');
    if (!isCabinet && officeFee.lieuPratique) {
      const establishmentType = officeFee.lieuPratique.toString().startsWith('2') ? 'hôpital' : 'établissement';
      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: officeFee.id,
        severity: "error",
        category: "office_fees",
        message: `Les codes 19928 et 19929 peuvent seulement être facturés en cabinet. Établissement actuel: ${officeFee.lieuPratique} (${establishmentType})`,
        solution: `Veuillez annuler la demande`,
        affectedRecords: [officeFee.id],
        ruleData: {
          scenarioId: "ESTABLISHMENT_ERROR",
          code: officeFee.code || "19928",
          establishment: officeFee.lieuPratique?.toString() || "Unknown",
          establishmentType,
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount,
          totalAmount: Number(officeFee.montantPreliminaire || 0),
          doctor: redactDoctorName(dayData.doctor),
          date: dayData.date,
          monetaryImpact: 0
        }
      });
      continue; // Skip other validations for this fee
    }

    if (officeFee.code === "19928") {
      if (hasContext) {
        // E2: Walk-in 19928 with insufficient patients
        if (walkInPaidCount < 10) {
          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code 19928 exige minimum 10 patients sans rendez-vous mais seulement ${walkInPaidCount} trouvé(s) pour ${redactDoctorName(dayData.doctor)} le ${dayData.date}`,
            solution: `Veuillez annuler la demande ou corriger les visites non payées`,
            affectedRecords: [officeFee.id],
            ruleData: {
              scenarioId: "E2",
              code: "19928",
              billedCode: officeFee.code || "19928",
              billedAmount: officeFee.montantPreliminaire?.toString() || "32.40",
              hasContext: true,
              type: "walk_in",
              required: 10,
              actual: walkInPaidCount,
              doctor: redactDoctorName(dayData.doctor),
              date: dayData.date,
              monetaryImpact: 0,
              // Visit statistics for display
              registeredPaidCount,
              registeredUnpaidCount,
              walkInPaidCount,
              walkInUnpaidCount
            }
          });
        }
      } else {
        // E1: Registered 19928 with insufficient patients (if not eligible for walk-in either)
        if (registeredCount < 6) {
          // Check if this is a cross-category optimization opportunity (O7)
          if (walkInCount >= 10) {
            // This will be handled in optimization section (O7)
            continue;
          }

          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code 19928 exige minimum 6 patients inscrits mais seulement ${registeredPaidCount} trouvé(s) pour ${redactDoctorName(dayData.doctor)} le ${dayData.date}`,
            solution: registeredUnpaidCount > 0
              ? `Veuillez annuler la demande ou corriger les ${registeredUnpaidCount} visite(s) non payée(s)`
              : `Veuillez annuler la demande`,
            affectedRecords: [officeFee.id],
            ruleData: {
              scenarioId: "E1",
              code: "19928",
              billedCode: officeFee.code || "19928",
              billedAmount: officeFee.montantPreliminaire?.toString() || "32.40",
              hasContext: false,
              type: "registered",
              required: 6,
              actual: registeredPaidCount,
              doctor: redactDoctorName(dayData.doctor),
              date: dayData.date,
              monetaryImpact: 0,
              // Visit statistics for display
              registeredPaidCount,
              registeredUnpaidCount,
              walkInPaidCount,
              walkInUnpaidCount
            }
          });
        }
      }
    } else if (officeFee.code === "19929") {
      if (hasContext) {
        // E4: Walk-in 19929 with insufficient patients
        if (walkInPaidCount < 20) {
          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code 19929 exige minimum 20 patients sans rendez-vous mais seulement ${walkInPaidCount} trouvé(s) pour ${redactDoctorName(dayData.doctor)} le ${dayData.date}`,
            solution: `Changez le code 19929 pour 19928 ou corrigez les visites non payées`,
            affectedRecords: [officeFee.id],
            ruleData: {
              scenarioId: "E4",
              code: "19929",
              billedCode: officeFee.code || "19929",
              billedAmount: officeFee.montantPreliminaire?.toString() || "64.80",
              hasContext: true,
              type: "walk_in",
              required: 20,
              actual: walkInPaidCount,
              doctor: redactDoctorName(dayData.doctor),
              date: dayData.date,
              monetaryImpact: 0,
              // Visit statistics for display
              registeredPaidCount,
              registeredUnpaidCount,
              walkInPaidCount,
              walkInUnpaidCount
            }
          });
        }
      } else {
        // E3: Registered 19929 with insufficient patients (if not eligible for walk-in either)
        if (registeredPaidCount < 12) {
          // Check if this is a cross-category optimization opportunity (O8)
          if (walkInPaidCount >= 20) {
            // This will be handled in optimization section (O8)
            continue;
          }

          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code 19929 exige minimum 12 patients inscrits mais seulement ${registeredPaidCount} trouvé(s) pour ${redactDoctorName(dayData.doctor)} le ${dayData.date}`,
            solution: `Changez le code 19929 pour 19928 ou corrigez les visites non payées`,
            affectedRecords: [officeFee.id],
            ruleData: {
              scenarioId: "E3",
              code: "19929",
              billedCode: officeFee.code || "19929",
              billedAmount: officeFee.montantPreliminaire?.toString() || "64.80",
              hasContext: false,
              type: "registered",
              required: 12,
              actual: registeredPaidCount,
              doctor: redactDoctorName(dayData.doctor),
              date: dayData.date,
              monetaryImpact: 0,
              // Visit statistics for display
              registeredPaidCount,
              registeredUnpaidCount,
              walkInPaidCount,
              walkInUnpaidCount
            }
          });
        }
      }
    }
  }

  // E5, E6, E8: Check daily maximum ($64.80) with strategic recommendations
  if (dayData.totalAmount > 64.80) {
    const affectedIds = dayData.officeFees.map(fee => fee.id).filter(id => id !== null) as string[];
    const excessAmount = dayData.totalAmount - 64.80;
    const redactedDoctor = redactDoctorName(dayData.doctor);

    // E6: Strategic Maximum Exceeded - Should Keep 19929 Walk-In
    if (billed19928Registered && billed19929WalkIn) {
      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: null,
        idRamq: null,
        severity: "error",
        category: "office_fees",
        message: `Le maximum quotidien de 64,80$ pour les frais de bureau a été dépassé pour ${redactedDoctor} le ${dayData.date}. Total facturé: ${formatCurrency(dayData.totalAmount)} (19928 inscrits + 19929 sans RDV)`,
        solution: `Annulez le 19928 inscrits et gardez seulement le 19929 sans RDV pour maximiser le remboursement`,
        affectedRecords: affectedIds,
        ruleData: {
          scenarioId: "E6",
          doctor: redactedDoctor,
          date: dayData.date,
          totalAmount: dayData.totalAmount,
          dailyMaximum: 64.80,
          excessAmount: excessAmount,
          billingCount: dayData.officeFees.length,
          codes: ["19928", "19929"],
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount,
          monetaryImpact: -32.40
        }
      });
    }
    // E8: Strategic Maximum Exceeded - Should Keep 19929 Registered
    else if (billed19929Registered && billed19928WalkIn) {
      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: null,
        idRamq: null,
        severity: "error",
        category: "office_fees",
        message: `Le maximum quotidien de 64,80$ pour les frais de bureau a été dépassé pour ${redactedDoctor} le ${dayData.date}. Total facturé: ${formatCurrency(dayData.totalAmount)} (19929 inscrits + 19928 sans RDV)`,
        solution: `Annulez le 19928 sans RDV et gardez seulement le 19929 inscrits pour maximiser le remboursement`,
        affectedRecords: affectedIds,
        ruleData: {
          scenarioId: "E8",
          doctor: redactedDoctor,
          date: dayData.date,
          totalAmount: dayData.totalAmount,
          dailyMaximum: 64.80,
          excessAmount: excessAmount,
          billingCount: dayData.officeFees.length,
          codes: ["19929", "19928"],
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount,
          monetaryImpact: -32.40
        }
      });
    }
    // E5: Generic daily maximum exceeded
    else {
      const affectedRamqIds = dayData.officeFees
        .map(fee => fee.idRamq)
        .filter((id, index, self) => id && self.indexOf(id) === index) as string[];

      const feeBreakdownWithPatients = dayData.officeFees.map(fee => ({
        code: fee.code || 'Unknown',
        amount: parseFloat(fee.montantPreliminaire || '0'),
        idRamq: fee.idRamq || 'Unknown',
        paid: fee.montantPaye ? parseFloat(fee.montantPaye.toString()) : 0
      }));

      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: null,
        idRamq: null,
        severity: "error",
        category: "office_fees",
        message: `Le maximum quotidien de 64,80$ pour les frais de bureau a été dépassé pour ${redactedDoctor} le ${dayData.date}. Total facturé: ${formatCurrency(dayData.totalAmount)}`,
        solution: `Veuillez annuler un des frais de bureau pour respecter le maximum quotidien`,
        affectedRecords: affectedIds,
        ruleData: {
          scenarioId: "E5",
          doctor: redactedDoctor,
          date: dayData.date,
          totalAmount: dayData.totalAmount,
          dailyMaximum: 64.80,
          excessAmount: excessAmount,
          billingCount: dayData.officeFees.length,
          affectedRamqIds,
          feeBreakdownWithPatients,
          monetaryImpact: 0,
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount
        }
      });
    }
  }

  // E7: Mixed Double Billing - Both Insufficient
  if (billed19928Registered && billed19928WalkIn) {
    const registeredFailed = registeredPaidCount < 6;
    const walkInFailed = walkInPaidCount < 10;

    if (registeredFailed && walkInFailed) {
      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: null,
        severity: "error",
        category: "office_fees",
        message: `Le code 19928 inscrits requiert un minimum de 6 patients alors qu'on en trouve ${registeredPaidCount} et le code 19928 sans RDV requiert un minimum de 10 patients alors qu'on en trouve ${walkInPaidCount}`,
        solution: `Veuillez annuler les deux demandes ou corriger les visites non payées`,
        affectedRecords: dayData.officeFees.map(f => f.id).filter((id): id is string => id !== null),
        ruleData: {
          scenarioId: "E7",
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount,
          registeredRequired: 6,
          walkInRequired: 10,
          totalAmount: dayData.totalAmount,
          doctor: redactDoctorName(dayData.doctor),
          date: dayData.date,
          monetaryImpact: 0
        }
      });
    }
  }

  // ===== OPTIMIZATION DETECTION (missed revenue opportunities) =====

  // O1, O2: Registered patient optimizations
  if (registeredEligible !== 'none') {
    if (registeredEligible === '19929') {
      // Eligible for 19929
      if (billed19928Registered && !billed19929Registered) {
        // O1: Could Use Higher Code (19928 → 19929) - Registered
        const billedFee = registeredOfficeFees.find(f => f.code === "19928");
        const affected19928Records = registeredOfficeFees.filter(f => f.code === "19928");

        // Build detailed breakdown with RAMQ IDs for user to identify records
        // Group by RAMQ + date + code to detect duplicates
        const recordsMap = new Map<string, {
          ids: string[];
          idRamq: string;
          date: string;
          code: string;
          amount: number;
          paid: number;
          count: number;
        }>();

        affected19928Records.forEach(fee => {
          const key = `${fee.idRamq || 'unknown'}_${fee.dateService || dayData.date}_${fee.code}`;
          const existing = recordsMap.get(key);

          if (existing) {
            existing.ids.push(fee.id);
            existing.count++;
          } else {
            recordsMap.set(key, {
              ids: [fee.id],
              idRamq: fee.idRamq || 'Non spécifié',
              date: fee.dateService || dayData.date,
              code: fee.code || '19928',
              amount: parseFloat(fee.montantPreliminaire || '0'),
              paid: fee.montantPaye ? parseFloat(fee.montantPaye.toString()) : 0,
              count: 1
            });
          }
        });

        const affectedRecordsDetails = Array.from(recordsMap.values()).map(record => ({
          id: record.ids[0], // Use first ID as primary
          ids: record.ids, // Keep all IDs for reference
          idRamq: record.idRamq,
          date: record.date,
          code: record.code,
          amount: record.amount,
          paid: record.paid,
          count: record.count,
          isDuplicate: record.count > 1,
          totalAmount: record.amount * record.count
        }));

        results.push({
          validationRunId,
          ruleId: "office-fee-validation",
          billingRecordId: billedFee?.id || null,
          severity: "optimization",
          category: "office_fees",
          message: `${registeredPaidCount} patients inscrits ont été vus, vous avez donc droit au code 19929`,
          solution: `Remplacez le code 19928 par 19929 pour maximiser le remboursement (gain: 32,40$)`,
          affectedRecords: affected19928Records.map(f => f.id),
          ruleData: {
            scenarioId: "O1",
            monetaryImpact: 32.40,
            currentCode: "19928",
            suggestedCode: "19929",
            currentAmount: 32.40,
            expectedAmount: 64.80,
            registeredPaidCount,
            registeredUnpaidCount,
            walkInPaidCount,
            walkInUnpaidCount,
            doctor: redactDoctorName(dayData.doctor),
            date: dayData.date,
            affectedRecordsDetails
          }
        });
      }
    }
  }

  // Walk-in patient optimizations
  if (walkInEligible !== 'none') {
    if (walkInEligible === '19929') {
      // Eligible for 19929#G160
      if (billed19928WalkIn && !billed19929WalkIn) {
        // O2: Could Use Higher Code (19928 → 19929) - Walk-In
        const billedFee = walkInOfficeFees.find(f => f.code === "19928");
        const affected19928Records = walkInOfficeFees.filter(f => f.code === "19928");

        // Build detailed breakdown with RAMQ IDs for user to identify records
        // Group by RAMQ + date + code to detect duplicates
        const recordsMap = new Map<string, {
          ids: string[];
          idRamq: string;
          date: string;
          code: string;
          amount: number;
          paid: number;
          count: number;
        }>();

        affected19928Records.forEach(fee => {
          const key = `${fee.idRamq || 'unknown'}_${fee.dateService || dayData.date}_${fee.code}`;
          const existing = recordsMap.get(key);

          if (existing) {
            existing.ids.push(fee.id);
            existing.count++;
          } else {
            recordsMap.set(key, {
              ids: [fee.id],
              idRamq: fee.idRamq || 'Non spécifié',
              date: fee.dateService || dayData.date,
              code: fee.code || '19928',
              amount: parseFloat(fee.montantPreliminaire || '0'),
              paid: fee.montantPaye ? parseFloat(fee.montantPaye.toString()) : 0,
              count: 1
            });
          }
        });

        const affectedRecordsDetails = Array.from(recordsMap.values()).map(record => ({
          id: record.ids[0], // Use first ID as primary
          ids: record.ids, // Keep all IDs for reference
          idRamq: record.idRamq,
          date: record.date,
          code: record.code,
          amount: record.amount,
          paid: record.paid,
          count: record.count,
          isDuplicate: record.count > 1,
          totalAmount: record.amount * record.count
        }));

        results.push({
          validationRunId,
          ruleId: "office-fee-validation",
          billingRecordId: billedFee?.id || null,
          severity: "optimization",
          category: "office_fees",
          message: `${walkInPaidCount} patients sans rendez-vous ont été vus, vous avez donc droit au code 19929`,
          solution: `Remplacez le code 19928 par 19929 pour maximiser le remboursement (gain: 32,40$)`,
          affectedRecords: affected19928Records.map(f => f.id),
          ruleData: {
            scenarioId: "O2",
            monetaryImpact: 32.40,
            currentCode: "19928",
            suggestedCode: "19929",
            currentAmount: 32.40,
            expectedAmount: 64.80,
            registeredPaidCount,
            registeredUnpaidCount,
            walkInPaidCount,
            walkInUnpaidCount,
            doctor: redactDoctorName(dayData.doctor),
            date: dayData.date,
            affectedRecordsDetails
          }
        });
      }
    }
  }

  // O3, O4: Additional billing opportunities (add second 19928)
  if (billed19928Registered && !billed19928WalkIn && !billed19929Registered && !billed19929WalkIn) {
    // O3: One 19928 registered billed, walk-in patients available for second 19928
    if (walkInPaidCount >= 10 && dayData.totalAmount + 32.40 <= 64.80) {
      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: null,
        severity: "optimization",
        category: "office_fees",
        message: `Vous avez aussi vu ${walkInPaidCount} patients sans RDV et vous pourriez facturer un autre 19928 pour atteindre le maximum quotidien de 64,80$`,
        solution: `Ajoutez un deuxième 19928 pour les patients sans RDV (gain: 32,40$)`,
        affectedRecords: [],
        ruleData: {
          scenarioId: "O3",
          monetaryImpact: 32.40,
          currentAmount: dayData.totalAmount,
          expectedAmount: 64.80,
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount,
          doctor: redactDoctorName(dayData.doctor),
          date: dayData.date
        }
      });
    }
  } else if (billed19928WalkIn && !billed19928Registered && !billed19929Registered && !billed19929WalkIn) {
    // O4: One 19928 walk-in billed, registered patients available for second 19928
    if (registeredPaidCount >= 6 && dayData.totalAmount + 32.40 <= 64.80) {
      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: null,
        severity: "optimization",
        category: "office_fees",
        message: `Vous avez aussi vu ${registeredPaidCount} patients inscrits et vous pourriez facturer un autre 19928 pour atteindre le maximum quotidien de 64,80$`,
        solution: `Ajoutez un deuxième 19928 pour les patients inscrits (gain: 32,40$)`,
        affectedRecords: [],
        ruleData: {
          scenarioId: "O4",
          monetaryImpact: 32.40,
          currentAmount: dayData.totalAmount,
          expectedAmount: 64.80,
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount,
          doctor: redactDoctorName(dayData.doctor),
          date: dayData.date
        }
      });
    }
  }

  // O5: Mixed double billing - upgrade possible but would exceed maximum
  if (billed19928Registered && billed19928WalkIn && dayData.totalAmount === 64.80) {
    const qualifyingForUpgrade = registeredPaidCount >= 12 || walkInPaidCount >= 20;
    if (qualifyingForUpgrade) {
      const qualifyingPaidCount = registeredPaidCount >= 12 ? registeredPaidCount : walkInPaidCount;
      const patientType = registeredPaidCount >= 12 ? "inscrits" : "sans rendez-vous";
      const otherPatientType = registeredPaidCount >= 12 ? "sans rendez-vous" : "inscrits";

      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: null,
        severity: "optimization",
        category: "office_fees",
        message: `${qualifyingPaidCount} patients ${patientType} ont été vus, vous avez donc droit au code 19929 mais cela dépasserait le maximum quotidien`,
        solution: `Changez le 19928 ${patientType} pour 19929 et annulez le 19928 ${otherPatientType} (gain net: 0,00$)`,
        affectedRecords: dayData.officeFees.map(f => f.id).filter((id): id is string => id !== null),
        ruleData: {
          scenarioId: "O5",
          monetaryImpact: 0,
          currentTotal: 64.80,
          suggestedTotal: 64.80,
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount,
          qualifyingPaidCount,
          patientType,
          otherPatientType,
          doctor: redactDoctorName(dayData.doctor),
          date: dayData.date
        }
      });
    }
  }

  // O6: Could Add Second Billing - Registered Available (Strategic)
  if (dayData.totalAmount === 32.40 && dayData.officeFees.length === 1) {
    if (billed19928WalkIn && registeredPaidCount >= 6 && registeredPaidCount < 12) {
      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: null,
        severity: "optimization",
        category: "office_fees",
        message: `Vous avez aussi vu ${registeredPaidCount} patients inscrits et vous pourriez facturer un autre 19928 pour atteindre le maximum quotidien de 64,80$`,
        solution: `Ajoutez un deuxième 19928 pour les patients inscrits (gain: 32,40$)`,
        affectedRecords: [],
        ruleData: {
          scenarioId: "O6",
          monetaryImpact: 32.40,
          currentCode: "19928",
          currentAmount: 32.40,
          expectedAmount: 64.80,
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount,
          doctor: redactDoctorName(dayData.doctor),
          date: dayData.date
        }
      });
    }
  }

  // ===== PASS SCENARIOS (successful validations) =====

  // Generate PASS scenarios for successful office fee billings
  for (const officeFee of dayData.officeFees) {
    const hasContext = officeFee.elementContexte?.includes("#G160") ||
                      officeFee.elementContexte?.includes("#AR");

    // P6: Valid Cabinet Location
    const isCabinet = officeFee.lieuPratique?.toString().startsWith('5');
    if (isCabinet && officeFee.lieuPratique) {
      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: officeFee.id,
        severity: "info",
        category: "office_fees",
        message: `Validation réussie: Code ${officeFee.code} facturé dans un cabinet (établissement valide: ${officeFee.lieuPratique})`,
        affectedRecords: [officeFee.id],
        ruleData: {
          scenarioId: "P6",
          monetaryImpact: 0,
          code: officeFee.code || "19928",
          establishment: officeFee.lieuPratique.toString(),
          establishmentType: "cabinet",
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount,
          totalAmount: Number(officeFee.montantPreliminaire || 0),
          doctor: redactDoctorName(dayData.doctor),
          date: dayData.date
        }
      });
    }

    if (officeFee.code === "19928") {
      if (hasContext && walkInPaidCount >= 10 && walkInPaidCount < 20) {
        // P2: Valid 19928 - Walk-In Patients
        results.push({
          validationRunId,
          ruleId: "office-fee-validation",
          billingRecordId: officeFee.id,
          severity: "info",
          category: "office_fees",
          message: `Validation réussie: Code 19928 facturé correctement avec ${walkInPaidCount} patients sans rendez-vous (minimum: 10). Montant: ${formatCurrency(dayData.totalAmount)}`,
          affectedRecords: [officeFee.id],
          ruleData: {
            scenarioId: "P2",
            monetaryImpact: 0,
            code: "19928",
            registeredPaidCount,
            registeredUnpaidCount,
            walkInPaidCount,
            walkInUnpaidCount,
            totalAmount: dayData.totalAmount,
            doctor: redactDoctorName(dayData.doctor),
            date: dayData.date
          }
        });
      } else if (!hasContext && registeredPaidCount >= 6 && registeredPaidCount < 12) {
        // P1: Valid 19928 - Registered Patients
        results.push({
          validationRunId,
          ruleId: "office-fee-validation",
          billingRecordId: officeFee.id,
          severity: "info",
          category: "office_fees",
          message: `Validation réussie: Code 19928 facturé correctement avec ${registeredPaidCount} patients inscrits (minimum: 6). Montant: ${formatCurrency(dayData.totalAmount)}`,
          affectedRecords: [officeFee.id],
          ruleData: {
            scenarioId: "P1",
            monetaryImpact: 0,
            code: "19928",
            registeredPaidCount,
            registeredUnpaidCount,
            walkInPaidCount,
            walkInUnpaidCount,
            totalAmount: dayData.totalAmount,
            doctor: redactDoctorName(dayData.doctor),
            date: dayData.date
          }
        });
      }
    } else if (officeFee.code === "19929") {
      if (hasContext && walkInPaidCount >= 20) {
        // P4: Valid 19929 - Walk-In Patients
        results.push({
          validationRunId,
          ruleId: "office-fee-validation",
          billingRecordId: officeFee.id,
          severity: "info",
          category: "office_fees",
          message: `Validation réussie: Code 19929 facturé correctement avec ${walkInPaidCount} patients sans rendez-vous (minimum: 20). Montant: ${formatCurrency(dayData.totalAmount)}`,
          affectedRecords: [officeFee.id],
          ruleData: {
            scenarioId: "P4",
            monetaryImpact: 0,
            code: "19929",
            registeredPaidCount,
            registeredUnpaidCount,
            walkInPaidCount,
            walkInUnpaidCount,
            totalAmount: dayData.totalAmount,
            doctor: redactDoctorName(dayData.doctor),
            date: dayData.date
          }
        });
      } else if (!hasContext && registeredPaidCount >= 12) {
        // Check for strategic scenarios first
        if (registeredPaidCount >= 12 && walkInPaidCount >= 20) {
          // P7, P8, P9: Optimal Mixed Billing - Both Groups Qualify
          if (billed19929Registered && !billed19929WalkIn) {
            // P7: Optimal Mixed Billing - Code 19929 (Registered)
            results.push({
              validationRunId,
              ruleId: "office-fee-validation",
              billingRecordId: officeFee.id,
              severity: "info",
              category: "office_fees",
              message: `Facturation optimale: Code 19929 facturé avec ${registeredPaidCount} patients inscrits. Maximum quotidien atteint: ${formatCurrency(dayData.totalAmount)}`,
              affectedRecords: [officeFee.id].filter((id): id is string => id !== null),
              ruleData: {
                scenarioId: "P7",
                monetaryImpact: 0,
                code: "19929",
                registeredPaidCount,
                walkInPaidCount,
                totalAmount: dayData.totalAmount,
                doctor: redactDoctorName(dayData.doctor),
                date: dayData.date,
                registeredUnpaidCount,
                walkInUnpaidCount
              }
            });
          } else if (billed19929WalkIn && !billed19929Registered) {
            // P8: Optimal Mixed Billing - Code 19929 (Walk-In)
            results.push({
              validationRunId,
              ruleId: "office-fee-validation",
              billingRecordId: officeFee.id,
              severity: "info",
              category: "office_fees",
              message: `Facturation optimale: Code 19929 facturé avec ${walkInPaidCount} patients sans rendez-vous. Maximum quotidien atteint: ${formatCurrency(dayData.totalAmount)}`,
              affectedRecords: [officeFee.id].filter((id): id is string => id !== null),
              ruleData: {
                scenarioId: "P8",
                monetaryImpact: 0,
                code: "19929",
                walkInPaidCount,
                registeredPaidCount,
                totalAmount: dayData.totalAmount,
                doctor: redactDoctorName(dayData.doctor),
                date: dayData.date,
                registeredUnpaidCount,
                walkInUnpaidCount
              }
            });
          } else {
            // P9: Strategic Choice - Both Groups Qualify
            results.push({
              validationRunId,
              ruleId: "office-fee-validation",
              billingRecordId: officeFee.id,
              severity: "info",
              category: "office_fees",
              message: `Facturation optimale: Code 19929 facturé (groupe choisi). Les deux groupes qualifient mais vous ne pouvez choisir qu'un seul. Maximum quotidien atteint: ${formatCurrency(dayData.totalAmount)}`,
              affectedRecords: [officeFee.id].filter((id): id is string => id !== null),
              ruleData: {
                scenarioId: "P9",
                monetaryImpact: 0,
                code: "19929",
                registeredPaidCount,
                walkInPaidCount,
                totalAmount: dayData.totalAmount,
                doctor: redactDoctorName(dayData.doctor),
                date: dayData.date,
                registeredUnpaidCount,
                walkInUnpaidCount
              }
            });
          }
        } else if (walkInPaidCount >= 20 && registeredPaidCount < 12) {
          // P10: Strategic Billing - 19929 Walk-In Only
          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "info",
            category: "office_fees",
            message: `Facturation optimale: Code 19929 facturé avec ${walkInPaidCount} patients sans rendez-vous. Maximum quotidien atteint: ${formatCurrency(dayData.totalAmount)}`,
            affectedRecords: [officeFee.id].filter((id): id is string => id !== null),
            ruleData: {
              scenarioId: "P10",
              monetaryImpact: 0,
              code: "19929",
              walkInPaidCount,
              registeredPaidCount,
              totalAmount: dayData.totalAmount,
              doctor: redactDoctorName(dayData.doctor),
              date: dayData.date,
              registeredUnpaidCount,
              walkInUnpaidCount
            }
          });
        } else if (registeredPaidCount >= 12 && walkInPaidCount < 20) {
          // P11: Strategic Billing - 19929 Registered Only (also covers P3)
          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "info",
            category: "office_fees",
            message: `Facturation optimale: Code 19929 facturé avec ${registeredPaidCount} patients inscrits. Maximum quotidien atteint: ${formatCurrency(dayData.totalAmount)}`,
            affectedRecords: [officeFee.id].filter((id): id is string => id !== null),
            ruleData: {
              scenarioId: dayData.totalAmount >= 64.80 ? "P11" : "P3",
              monetaryImpact: 0,
              code: "19929",
              registeredPaidCount,
              walkInPaidCount,
              totalAmount: dayData.totalAmount,
              doctor: redactDoctorName(dayData.doctor),
              date: dayData.date,
              registeredUnpaidCount,
              walkInUnpaidCount
            }
          });
        } else {
          // P3: Valid 19929 - Registered Patients (basic case)
          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "info",
            category: "office_fees",
            message: `Validation réussie: Code 19929 facturé correctement avec ${registeredPaidCount} patients inscrits (minimum: 12). Montant: ${formatCurrency(Number(officeFee.montantPreliminaire || 0))}`,
            affectedRecords: [officeFee.id].filter((id): id is string => id !== null),
            ruleData: {
              scenarioId: "P3",
              monetaryImpact: 0,
              code: "19929",
              registeredPaidCount,
              totalAmount: Number(officeFee.montantPreliminaire || 0),
              doctor: redactDoctorName(dayData.doctor),
              date: dayData.date,
              registeredUnpaidCount,
              walkInPaidCount,
              walkInUnpaidCount
            }
          });
        }
      }
    }
  }

  // P5: Valid Double Billing Within Maximum
  if (dayData.officeFees.length === 2 && dayData.totalAmount <= 64.80) {
    results.push({
      validationRunId,
      ruleId: "office-fee-validation",
      billingRecordId: null,
      severity: "info",
      category: "office_fees",
      message: `Validation réussie: Frais de bureau facturés correctement avec ${dayData.officeFees.length} code(s) totalisant ${formatCurrency(dayData.totalAmount)} (maximum quotidien: 64,80$)`,
      affectedRecords: dayData.officeFees.map(f => f.id).filter((id): id is string => id !== null),
      ruleData: {
        scenarioId: "P5",
        monetaryImpact: 0,
        billingCount: dayData.officeFees.length,
        totalAmount: dayData.totalAmount,
        dailyMaximum: 64.80,
        registeredPaidCount,
        registeredUnpaidCount,
        walkInPaidCount,
        walkInUnpaidCount,
        doctor: redactDoctorName(dayData.doctor),
        date: dayData.date
      }
    });
  }

  // If no office fees were billed this day, create a "no office fees" result
  // so the day appears in the calendar as blue (no activity)
  if (dayData.officeFees.length === 0 && (registeredCount > 0 || walkInCount > 0)) {
    results.push({
      validationRunId,
      ruleId: "office-fee-validation",
      billingRecordId: null,
      severity: "info",
      category: "office_fees",
      message: `Aucun frais de bureau facturé pour ${redactDoctorName(dayData.doctor)} le ${dayData.date}`,
      solution: null,
      affectedRecords: [],
      ruleData: {
        scenarioId: "NO_OFFICE_FEE",
        registeredPaidCount,
        registeredUnpaidCount,
        walkInPaidCount,
        walkInUnpaidCount,
        totalAmount: 0,
        doctor: redactDoctorName(dayData.doctor),
        date: dayData.date,
        monetaryImpact: 0
      }
    });
  }

  return results;
}

// Helper function to determine eligibility based on patient count
function determineEligibility(count: number, type: 'registered' | 'walkIn'): 'none' | '19928' | '19929' {
  if (type === 'registered') {
    if (count >= 12) return '19929';
    if (count >= 6) return '19928';
    return 'none';
  } else { // walkIn
    if (count >= 20) return '19929';
    if (count >= 10) return '19928';
    return 'none';
  }
}