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
      results.push(...validateDoctorDay(dayData, validationRunId));
    }

    return results;
  }
};

function validateDoctorDay(dayData: DoctorDayData, validationRunId: string): InsertValidationResult[] {
  const results: InsertValidationResult[] = [];

  const registeredCount = dayData.registeredPatients.size;
  const walkInCount = dayData.walkInPatients.size;

  // Check each office fee claim
  for (const officeFee of dayData.officeFees) {
    const hasContext = officeFee.elementContexte?.includes("#G160") ||
                      officeFee.elementContexte?.includes("#AR");

    if (officeFee.code === "19928") {
      // Code 19928 validation
      if (hasContext) {
        // Walk-in 19928: needs ≥10 walk-in patients
        if (walkInCount < 10) {
          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code 19928 (walk-in) requires minimum 10 walk-in patients but only ${walkInCount} found for ${dayData.doctor} on ${dayData.date}`,
            affectedRecords: [officeFee.id],
            ruleData: {
              code: "19928",
              type: "walk_in",
              required: 10,
              actual: walkInCount,
              doctor: dayData.doctor,
              date: dayData.date
            }
          });
        }

        // Check for required context element
        if (!officeFee.elementContexte?.includes("#G160") && !officeFee.elementContexte?.includes("#AR")) {
          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code 19928 for walk-in services requires context element #G160 or #AR`,
            affectedRecords: [officeFee.id],
            ruleData: {
              code: "19928",
              type: "walk_in",
              missingContext: true
            }
          });
        }
      } else {
        // Registered 19928: needs ≥6 registered patients
        if (registeredCount < 6) {
          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code 19928 (registered) requires minimum 6 registered patients but only ${registeredCount} found for ${dayData.doctor} on ${dayData.date}`,
            affectedRecords: [officeFee.id],
            ruleData: {
              code: "19928",
              type: "registered",
              required: 6,
              actual: registeredCount,
              doctor: dayData.doctor,
              date: dayData.date
            }
          });
        }
      }
    } else if (officeFee.code === "19929") {
      // Code 19929 validation
      if (hasContext) {
        // Walk-in 19929: needs ≥20 walk-in patients
        if (walkInCount < 20) {
          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code 19929 (walk-in) requires minimum 20 walk-in patients but only ${walkInCount} found for ${dayData.doctor} on ${dayData.date}`,
            affectedRecords: [officeFee.id],
            ruleData: {
              code: "19929",
              type: "walk_in",
              required: 20,
              actual: walkInCount,
              doctor: dayData.doctor,
              date: dayData.date
            }
          });
        }

        // Check for required context element
        if (!officeFee.elementContexte?.includes("#G160") && !officeFee.elementContexte?.includes("#AR")) {
          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code 19929 for walk-in services requires context element #G160 or #AR`,
            affectedRecords: [officeFee.id],
            ruleData: {
              code: "19929",
              type: "walk_in",
              missingContext: true
            }
          });
        }
      } else {
        // Registered 19929: needs ≥12 registered patients
        if (registeredCount < 12) {
          results.push({
            validationRunId,
            ruleId: "office-fee-validation",
            billingRecordId: officeFee.id,
            severity: "error",
            category: "office_fees",
            message: `Code 19929 (registered) requires minimum 12 registered patients but only ${registeredCount} found for ${dayData.doctor} on ${dayData.date}`,
            affectedRecords: [officeFee.id],
            ruleData: {
              code: "19929",
              type: "registered",
              required: 12,
              actual: registeredCount,
              doctor: dayData.doctor,
              date: dayData.date
            }
          });
        }
      }
    }
  }

  // Check daily maximum ($64.80)
  if (dayData.totalAmount > 64.80) {
    const affectedIds = dayData.officeFees.map(fee => fee.id).filter(id => id !== null) as string[];
    results.push({
      validationRunId,
      ruleId: "office-fee-validation",
      billingRecordId: null,
      severity: "error",
      category: "office_fees",
      message: `Daily office fee maximum of $64.80 exceeded for ${dayData.doctor} on ${dayData.date} (total: $${dayData.totalAmount.toFixed(2)})`,
      affectedRecords: affectedIds,
      ruleData: {
        doctor: dayData.doctor,
        date: dayData.date,
        totalAmount: dayData.totalAmount,
        maximum: 64.80
      }
    });
  }

  return results;
}