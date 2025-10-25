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

    // Calculate excess amount
    const excessAmount = dayData.totalAmount - 64.80;

    // Redact doctor name
    const redactedDoctor = redactDoctorName(dayData.doctor);

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
        // Visit statistics for display
        registeredPaidCount,
        registeredUnpaidCount,
        walkInPaidCount,
        walkInUnpaidCount
      }
    });
  }

  // ===== OPTIMIZATION DETECTION (missed revenue opportunities) =====

  // O1, O2: Registered patient optimizations
  if (registeredEligible !== 'none') {
    if (registeredEligible === '19929') {
      // Eligible for 19929
      if (billed19928Registered && !billed19929Registered) {
        // O1: Could Use Higher Code (19928 → 19929) - Registered
        const billedFee = registeredOfficeFees.find(f => f.code === "19928");
        results.push({
          validationRunId,
          ruleId: "office-fee-validation",
          billingRecordId: billedFee?.id || null,
          severity: "optimization",
          category: "office_fees",
          message: `${registeredPaidCount} patients inscrits ont été vus, vous avez donc droit au code 19929`,
          solution: `Remplacez le code 19928 par 19929 pour maximiser le remboursement (gain: 32,40$)`,
          affectedRecords: registeredOfficeFees.filter(f => f.code === "19928").map(f => f.id),
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
            date: dayData.date
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
        results.push({
          validationRunId,
          ruleId: "office-fee-validation",
          billingRecordId: billedFee?.id || null,
          severity: "optimization",
          category: "office_fees",
          message: `${walkInPaidCount} patients sans rendez-vous ont été vus, vous avez donc droit au code 19929`,
          solution: `Remplacez le code 19928 par 19929 pour maximiser le remboursement (gain: 32,40$)`,
          affectedRecords: walkInOfficeFees.filter(f => f.code === "19928").map(f => f.id),
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
            date: dayData.date
          }
        });
      }
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