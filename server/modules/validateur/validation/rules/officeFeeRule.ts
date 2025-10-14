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

  // Determine eligibility
  const registeredEligible = determineEligibility(registeredCount, 'registered');
  const walkInEligible = determineEligibility(walkInCount, 'walkIn');

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

    if (officeFee.code === "19928") {
      if (hasContext) {
        // E3: Walk-in 19928 with insufficient patients
        if (walkInCount < 10) {
          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code 19928 (sans rendez-vous) nécessite minimum 10 patients sans rendez-vous mais seulement ${walkInCount} trouvé(s) pour ${dayData.doctor} le ${dayData.date}`,
            affectedRecords: [officeFee.id],
            ruleData: {
              code: "19928",
              billedCode: officeFee.code || "19928",
              billedAmount: officeFee.montantPreliminaire?.toString() || "32.10",
              hasContext: true,
              type: "walk_in",
              required: 10,
              actual: walkInCount,
              doctor: dayData.doctor,
              date: dayData.date,
              monetaryImpact: "0.00",
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
            message: `Code 19928 (avec rendez-vous) nécessite minimum 6 patients avec rendez-vous mais seulement ${registeredCount} trouvé(s) pour ${dayData.doctor} le ${dayData.date}`,
            affectedRecords: [officeFee.id],
            ruleData: {
              code: "19928",
              billedCode: officeFee.code || "19928",
              billedAmount: officeFee.montantPreliminaire?.toString() || "32.10",
              hasContext: false,
              type: "registered",
              required: 6,
              actual: registeredCount,
              doctor: dayData.doctor,
              date: dayData.date,
              monetaryImpact: "0.00",
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
        if (walkInCount < 20) {
          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code 19929 (sans rendez-vous) nécessite minimum 20 patients sans rendez-vous mais seulement ${walkInCount} trouvé(s) pour ${dayData.doctor} le ${dayData.date}`,
            affectedRecords: [officeFee.id],
            ruleData: {
              code: "19929",
              billedCode: officeFee.code || "19929",
              billedAmount: officeFee.montantPreliminaire?.toString() || "64.20",
              hasContext: true,
              type: "walk_in",
              required: 20,
              actual: walkInCount,
              doctor: dayData.doctor,
              date: dayData.date,
              monetaryImpact: "0.00",
              // Visit statistics for display
              registeredPaidCount,
              registeredUnpaidCount,
              walkInPaidCount,
              walkInUnpaidCount
            }
          });
        }
      } else {
        // E2: Registered 19929 with insufficient patients (if not eligible for walk-in either)
        if (registeredCount < 12) {
          // Check if this is a cross-category optimization opportunity (O8)
          if (walkInCount >= 20) {
            // This will be handled in optimization section (O8)
            continue;
          }

          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code 19929 (avec rendez-vous) nécessite minimum 12 patients avec rendez-vous mais seulement ${registeredCount} trouvé(s) pour ${dayData.doctor} le ${dayData.date}`,
            affectedRecords: [officeFee.id],
            ruleData: {
              code: "19929",
              billedCode: officeFee.code || "19929",
              billedAmount: officeFee.montantPreliminaire?.toString() || "64.20",
              hasContext: false,
              type: "registered",
              required: 12,
              actual: registeredCount,
              doctor: dayData.doctor,
              date: dayData.date,
              monetaryImpact: "0.00",
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

  // E5: Check daily maximum ($64.80)
  if (dayData.totalAmount > 64.80) {
    const affectedIds = dayData.officeFees.map(fee => fee.id).filter(id => id !== null) as string[];

    // Extract unique RAMQ IDs from all affected fees
    const affectedRamqIds = dayData.officeFees
      .map(fee => fee.idRamq)
      .filter((id, index, self) => id && self.indexOf(id) === index) as string[];

    // Build fee breakdown with patient association (including payment status)
    const feeBreakdownWithPatients = dayData.officeFees.map(fee => ({
      code: fee.code || 'Unknown',
      amount: parseFloat(fee.montantPreliminaire || '0'),
      idRamq: fee.idRamq || 'Unknown',
      paid: fee.montantPaye ? parseFloat(fee.montantPaye.toString()) : 0
    }));

    // Calculate overage
    const overage = dayData.totalAmount - 64.80;

    // Redact doctor name
    const redactedDoctor = redactDoctorName(dayData.doctor);

    // Check if all office fees are paid (indicates likely data error in CSV)
    // When RAMQ has already paid the fees, they validated before payment, so errors are rare
    const allFeesPaid = dayData.officeFees.every(fee =>
      fee.montantPaye && parseFloat(fee.montantPaye.toString()) > 0
    );

    // Determine severity and messages based on payment status
    const severity = allFeesPaid ? "warning" : "error";

    let message, solution;
    if (allFeesPaid) {
      // All fees are paid - likely a data error in the CSV file
      message = `Anomalie de données: Maximum quotidien de frais de bureau de 64,80$ dépassé pour ${redactedDoctor} le ${dayData.date} (${affectedRamqIds.length} patient${affectedRamqIds.length > 1 ? 's' : ''}, total: ${formatCurrency(dayData.totalAmount)}, excédent: ${formatCurrency(overage)}). Toutes les facturations sont PAYÉES - vérifier l'exactitude du fichier CSV.`;

      solution = `⚠️ PROBABLE ERREUR DE DONNÉES: Ces facturations ont déjà été payées par la RAMQ, qui valide avant de payer. Vérifier que le fichier CSV ne contient pas de données erronées ou dupliquées. Si les données sont exactes, contacter la RAMQ pour clarification.`;
    } else {
      // Some or all fees are unpaid - standard billing error
      message = `Maximum quotidien de frais de bureau de 64,80$ dépassé pour ${redactedDoctor} le ${dayData.date} (${affectedRamqIds.length} patient${affectedRamqIds.length > 1 ? 's' : ''}, total: ${formatCurrency(dayData.totalAmount)}, excédent: ${formatCurrency(overage)})`;

      // Identify unpaid fees to recommend for cancellation
      const unpaidFees = feeBreakdownWithPatients.filter(fee => fee.paid === 0);

      if (unpaidFees.length > 0) {
        // Recommend canceling specific unpaid fees
        if (unpaidFees.length === 1) {
          solution = `Le médecin doit annuler la facture ${unpaidFees[0].idRamq} pour respecter le maximum quotidien de 64,80$ par médecin.`;
        } else {
          const unpaidIds = unpaidFees.map(f => f.idRamq).join(', ');
          solution = `Le médecin doit annuler les factures non payées (${unpaidIds}) pour respecter le maximum quotidien de 64,80$ par médecin.`;
        }
      } else {
        // All fees are paid but still exceeding (shouldn't happen due to allFeesPaid check, but safety)
        solution = `Le médecin doit retirer 1 ou plusieurs facturations de frais de bureau (19928 ou 19929) pour respecter le maximum quotidien de 64,80$ par médecin.`;
      }
    }

    results.push({
      validationRunId,
      ruleId: "office-fee-validation",
      billingRecordId: null,
      idRamq: null,  // Leave null for multi-patient errors
      severity,
      category: "office_fees",
      message,
      solution,
      affectedRecords: affectedIds,
      ruleData: {
        doctor: redactedDoctor,
        date: dayData.date,
        totalAmount: formatCurrency(dayData.totalAmount),
        maximum: "64,80",
        overage: formatCurrency(overage),
        affectedRamqIds,
        feeBreakdownWithPatients,
        patientCount: affectedRamqIds.length,
        monetaryImpact: formatCurrency(overage),
        likelyDataError: allFeesPaid,
        allFeesPaid,
        // Visit statistics for display
        registeredPaidCount,
        registeredUnpaidCount,
        walkInPaidCount,
        walkInUnpaidCount
      }
    });
  }

  // ===== OPTIMIZATION DETECTION (missed revenue opportunities) =====

  // O1, O2, O3: Registered patient optimizations
  if (registeredEligible !== 'none') {
    if (registeredEligible === '19929') {
      // Eligible for 19929
      if (!billed19929Registered && !billed19928Registered) {
        // O2: Could bill 19929, no office fee billed
        results.push({
          validationRunId,
          ruleId: "office-fee-validation",
          billingRecordId: null,
          severity: "optimization",
          category: "office_fees",
          message: `Opportunité de revenus: ${dayData.doctor} a vu ${registeredCount} patients avec rendez-vous le ${dayData.date} et pourrait facturer le code 19929 (64,20$)`,
          solution: `Facturer le code 19929 pour maximiser les revenus (64,20$)`,
          affectedRecords: [],
          ruleData: {
            code: "19929",
            billedCode: null,
            billedAmount: null,
            hasContext: false,
            type: "registered",
            eligibleCount: registeredCount,
            potentialRevenue: "64.20",
            monetaryImpact: "64.20",
            doctor: dayData.doctor,
            date: dayData.date,
            // Visit statistics for display
            registeredPaidCount,
            registeredUnpaidCount,
            walkInPaidCount,
            walkInUnpaidCount
          }
        });
      } else if (billed19928Registered && !billed19929Registered) {
        // O3: Billed 19928 but eligible for 19929
        const billedFee = registeredOfficeFees.find(f => f.code === "19928");
        results.push({
          validationRunId,
          ruleId: "office-fee-validation",
          billingRecordId: billedFee?.id || null,
          severity: "optimization",
          category: "office_fees",
          message: `Optimisation de revenus: ${dayData.doctor} a vu ${registeredCount} patients avec rendez-vous le ${dayData.date} et a facturé 19928 (32,10$), mais pourrait facturer 19929 (64,20$)`,
          solution: `Facturer 19929 au lieu de 19928 pour un gain de 32,10$`,
          affectedRecords: registeredOfficeFees.filter(f => f.code === "19928").map(f => f.id),
          ruleData: {
            code: "19929",
            billedCode: billedFee?.code || "19928",
            billedAmount: billedFee?.montantPreliminaire?.toString() || "32.10",
            hasContext: false,
            type: "registered",
            currentCode: "19928",
            eligibleCount: registeredCount,
            potentialRevenue: "64.20",
            currentRevenue: "32.10",
            monetaryImpact: "32.10",
            doctor: dayData.doctor,
            date: dayData.date,
            // Visit statistics for display
            registeredPaidCount,
            registeredUnpaidCount,
            walkInPaidCount,
            walkInUnpaidCount
          }
        });
      }
    } else if (registeredEligible === '19928') {
      // Eligible for 19928 only
      if (!billed19928Registered && !billed19929Registered) {
        // O1: Could bill 19928, no office fee billed
        results.push({
          validationRunId,
          ruleId: "office-fee-validation",
          billingRecordId: null,
          severity: "optimization",
          category: "office_fees",
          message: `Opportunité de revenus: ${dayData.doctor} a vu ${registeredCount} patients avec rendez-vous le ${dayData.date} et pourrait facturer le code 19928 (32,10$)`,
          solution: `Facturer le code 19928 pour maximiser les revenus (32,10$)`,
          affectedRecords: [],
          ruleData: {
            code: "19928",
            billedCode: null,
            billedAmount: null,
            hasContext: false,
            type: "registered",
            eligibleCount: registeredCount,
            potentialRevenue: "32.10",
            monetaryImpact: "32.10",
            doctor: dayData.doctor,
            date: dayData.date,
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

  // O4, O5, O6: Walk-in patient optimizations
  if (walkInEligible !== 'none') {
    if (walkInEligible === '19929') {
      // Eligible for 19929#G160
      if (!billed19929WalkIn && !billed19928WalkIn) {
        // O5: Could bill 19929 with context, no walk-in office fee billed
        results.push({
          validationRunId,
          ruleId: "office-fee-validation",
          billingRecordId: null,
          severity: "optimization",
          category: "office_fees",
          message: `Opportunité de revenus: ${dayData.doctor} a vu ${walkInCount} patients sans rendez-vous le ${dayData.date} et pourrait facturer le code 19929 avec contexte #G160 (64,20$)`,
          solution: `Facturer le code 19929 avec élément de contexte #G160 pour maximiser les revenus (64,20$)`,
          affectedRecords: [],
          ruleData: {
            code: "19929",
            billedCode: null,
            billedAmount: null,
            hasContext: true,
            type: "walk_in",
            eligibleCount: walkInCount,
            potentialRevenue: "64.20",
            monetaryImpact: "64.20",
            doctor: dayData.doctor,
            date: dayData.date,
            requiredContext: "#G160 ou #AR",
            // Visit statistics for display
            registeredPaidCount,
            registeredUnpaidCount,
            walkInPaidCount,
            walkInUnpaidCount
          }
        });
      } else if (billed19928WalkIn && !billed19929WalkIn) {
        // O6: Billed 19928#G160 but eligible for 19929#G160
        const billedFee = walkInOfficeFees.find(f => f.code === "19928");
        results.push({
          validationRunId,
          ruleId: "office-fee-validation",
          billingRecordId: billedFee?.id || null,
          severity: "optimization",
          category: "office_fees",
          message: `Optimisation de revenus: ${dayData.doctor} a vu ${walkInCount} patients sans rendez-vous le ${dayData.date} et a facturé 19928 (32,10$), mais pourrait facturer 19929 (64,20$)`,
          solution: `Facturer 19929 avec contexte #G160 au lieu de 19928 pour un gain de 32,10$`,
          affectedRecords: walkInOfficeFees.filter(f => f.code === "19928").map(f => f.id),
          ruleData: {
            code: "19929",
            billedCode: billedFee?.code || "19928",
            billedAmount: billedFee?.montantPreliminaire?.toString() || "32.10",
            hasContext: true,
            type: "walk_in",
            currentCode: "19928",
            eligibleCount: walkInCount,
            potentialRevenue: "64.20",
            currentRevenue: "32.10",
            monetaryImpact: "32.10",
            doctor: dayData.doctor,
            date: dayData.date,
            requiredContext: "#G160 ou #AR",
            // Visit statistics for display
            registeredPaidCount,
            registeredUnpaidCount,
            walkInPaidCount,
            walkInUnpaidCount
          }
        });
      }
    } else if (walkInEligible === '19928') {
      // Eligible for 19928#G160 only
      if (!billed19928WalkIn && !billed19929WalkIn) {
        // O4: Could bill 19928 with context, no walk-in office fee billed
        results.push({
          validationRunId,
          ruleId: "office-fee-validation",
          billingRecordId: null,
          severity: "optimization",
          category: "office_fees",
          message: `Opportunité de revenus: ${dayData.doctor} a vu ${walkInCount} patients sans rendez-vous le ${dayData.date} et pourrait facturer le code 19928 avec contexte #G160 (32,10$)`,
          solution: `Facturer le code 19928 avec élément de contexte #G160 pour maximiser les revenus (32,10$)`,
          affectedRecords: [],
          ruleData: {
            code: "19928",
            billedCode: null,
            billedAmount: null,
            hasContext: true,
            type: "walk_in",
            eligibleCount: walkInCount,
            potentialRevenue: "32.10",
            monetaryImpact: "32.10",
            doctor: dayData.doctor,
            date: dayData.date,
            requiredContext: "#G160 ou #AR",
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

  // O7, O8: Cross-category context optimizations (billed without context but eligible for walk-in)
  for (const officeFee of registeredOfficeFees) {
    if (officeFee.code === "19928" && walkInEligible !== 'none' && registeredCount < 6) {
      // O7: Billed 19928 without context, but eligible for walk-in
      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: officeFee.id,
        severity: "optimization",
        category: "office_fees",
        message: `Optimisation de contexte: ${dayData.doctor} a vu ${walkInCount} patients sans rendez-vous le ${dayData.date} et a facturé 19928 sans contexte. Ajouter #G160 pour que cette réclamation soit payée (32,10$)`,
        solution: `Ajouter l'élément de contexte #G160 ou #AR pour facturer comme frais de bureau sans rendez-vous (32,10$)`,
        affectedRecords: [officeFee.id],
        ruleData: {
          code: "19928",
          billedCode: officeFee.code || "19928",
          billedAmount: officeFee.montantPreliminaire?.toString() || "32.10",
          hasContext: false,
          type: "context_missing",
          walkInCount,
          registeredCount,
          monetaryImpact: "32.10",
          doctor: dayData.doctor,
          date: dayData.date,
          requiredContext: "#G160 ou #AR",
          // Visit statistics for display
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount
        }
      });
    } else if (officeFee.code === "19929" && walkInEligible === '19929' && registeredCount < 12) {
      // O8: Billed 19929 without context, but eligible for walk-in 19929
      results.push({
        validationRunId,
        ruleId: "office-fee-validation",
        billingRecordId: officeFee.id,
        severity: "optimization",
        category: "office_fees",
        message: `Optimisation de contexte: ${dayData.doctor} a vu ${walkInCount} patients sans rendez-vous le ${dayData.date} et a facturé 19929 sans contexte. Ajouter #G160 pour que cette réclamation soit payée (64,20$)`,
        solution: `Ajouter l'élément de contexte #G160 ou #AR pour facturer comme frais de bureau sans rendez-vous (64,20$)`,
        affectedRecords: [officeFee.id],
        ruleData: {
          code: "19929",
          billedCode: officeFee.code || "19929",
          billedAmount: officeFee.montantPreliminaire?.toString() || "64.20",
          hasContext: false,
          type: "context_missing",
          walkInCount,
          registeredCount,
          monetaryImpact: "64.20",
          doctor: dayData.doctor,
          date: dayData.date,
          requiredContext: "#G160 ou #AR",
          // Visit statistics for display
          registeredPaidCount,
          registeredUnpaidCount,
          walkInPaidCount,
          walkInUnpaidCount
        }
      });
    }
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