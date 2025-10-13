import { BillingRecord, InsertValidationResult } from "../../../../shared/schema";
import { ValidationRule } from "../engine";

export interface DoctorDayInterventionData {
  doctor: string;
  date: string;
  interventions: BillingRecord[];
  totalMinutes: number;
  code8857Minutes: number;
  code8859Minutes: number;
}

/**
 * Intervention Clinique Daily Limit Validation Rule
 *
 * Validates that doctors do not bill more than 180 minutes of clinical interventions
 * per day, according to article 2.2.6 B of the RAMQ agreement.
 *
 * Key Features:
 * - Filters for codes 8857 (30 min) and 8859 (variable duration from unites)
 * - Excludes interventions with ICEP, ICSM, or ICTOX contexts (exact match after comma split)
 * - Groups by doctor + date (date only, no time)
 * - Flags violations when totalMinutes > 180 (strictly greater than)
 */
export const interventionCliniqueRule: ValidationRule = {
  id: "INTERVENTION_CLINIQUE_DAILY_LIMIT",
  name: "Limite quotidienne interventions cliniques (180 min)",
  category: "intervention_clinique",
  enabled: true,

  async validate(records: BillingRecord[], validationRunId: string): Promise<InsertValidationResult[]> {
    const results: InsertValidationResult[] = [];

    // Track all intervention records for summary statistics
    const interventionRecords: BillingRecord[] = [];

    // Group data by doctor and date
    const doctorDayMap = new Map<string, DoctorDayInterventionData>();

    // First pass: collect all intervention clinique records
    for (const record of records) {
      // Skip records without required fields for grouping
      if (!record.doctorInfo || !record.dateService) continue;

      // Filter for intervention clinique codes only
      if (record.code !== "8857" && record.code !== "8859") continue;

      // Exclude records with special contexts (ICEP, ICSM, ICTOX)
      if (isExcludedContext(record.elementContexte)) continue;

      // Add to tracked records for summary
      interventionRecords.push(record);

      // Create grouping key (doctor + date without time)
      const key = `${record.doctorInfo}_${record.dateService.toISOString().split('T')[0]}`;

      if (!doctorDayMap.has(key)) {
        doctorDayMap.set(key, {
          doctor: record.doctorInfo,
          date: record.dateService.toISOString().split('T')[0],
          interventions: [],
          totalMinutes: 0,
          code8857Minutes: 0,
          code8859Minutes: 0
        });
      }

      const dayData = doctorDayMap.get(key)!;
      dayData.interventions.push(record);

      // Calculate duration based on code
      const duration = calculateDuration(record.code, record.unites);
      dayData.totalMinutes += duration;

      // Track minutes by code type
      if (record.code === "8857") {
        dayData.code8857Minutes += duration;
      } else if (record.code === "8859") {
        dayData.code8859Minutes += duration;
      }
    }

    // Second pass: validate each doctor-day
    for (const [key, dayData] of doctorDayMap.entries()) {
      results.push(...validateDoctorDay(dayData, validationRunId));
    }

    // Add informational summary result (always, even when no errors)
    if (interventionRecords.length > 0) {
      const totalMinutes = interventionRecords.reduce((sum, r) =>
        sum + calculateDuration(r.code, r.unites), 0
      );
      const totalAmount = interventionRecords.reduce((sum, r) =>
        sum + Number(r.montantPreliminaire || 0), 0
      );
      const paidCount = interventionRecords.filter(r =>
        Number(r.montantPaye || 0) > 0
      ).length;
      const uniqueDoctors = new Set(interventionRecords.map(r => r.doctorInfo)).size;
      const uniqueDays = new Set(
        interventionRecords.map(r => r.dateService?.toISOString().split('T')[0])
      ).size;

      const code8857Count = interventionRecords.filter(r => r.code === '8857').length;
      const code8859Count = interventionRecords.filter(r => r.code === '8859').length;
      const code8857Minutes = interventionRecords
        .filter(r => r.code === '8857')
        .reduce((sum, r) => sum + calculateDuration(r.code, r.unites), 0);
      const code8859Minutes = interventionRecords
        .filter(r => r.code === '8859')
        .reduce((sum, r) => sum + calculateDuration(r.code, r.unites), 0);

      results.push({
        validationRunId,
        ruleId: "INTERVENTION_CLINIQUE_DAILY_LIMIT",
        billingRecordId: interventionRecords[0]?.id || null,
        idRamq: interventionRecords[0]?.idRamq || null,
        severity: "info",
        category: "intervention_clinique",
        message: `Validation interventions cliniques complétée: ${interventionRecords.length} intervention(s) facturée(s) (${paidCount} payée(s)) pour ${totalMinutes} minutes totales. Montant: ${totalAmount.toFixed(2)}$.`,
        solution: null,
        affectedRecords: interventionRecords.slice(0, 10).map(r => r.id).filter(Boolean) as string[],
        ruleData: {
          totalInterventions: interventionRecords.length,
          paidInterventions: paidCount,
          totalMinutesAll: totalMinutes,
          totalAmount: totalAmount.toFixed(2),
          monetaryImpact: totalAmount.toFixed(2),
          uniqueDoctors,
          uniqueDays,
          code8857Count,
          code8859Count,
          code8857Minutes,
          code8859Minutes,
          limitViolations: results.filter(r => r.severity === 'error').length,
          dailyLimit: 180
        }
      });
    }

    return results;
  }
};

/**
 * Check if a context element contains any excluded contexts
 * Uses exact match after splitting on comma to avoid false positives
 * (e.g., "EPICENE" contains "ICEP" but is NOT an excluded context)
 */
function isExcludedContext(elementContexte: string | null): boolean {
  if (!elementContexte) return false;

  const excludedContexts = ["ICEP", "ICSM", "ICTOX"];

  // Split by comma and trim whitespace, then check for exact matches
  const contextCodes = elementContexte.toUpperCase().split(',').map(c => c.trim());

  // Return true if ANY context code matches exactly
  return contextCodes.some(code => excludedContexts.includes(code));
}

/**
 * Calculate duration in minutes for an intervention record
 */
function calculateDuration(code: string, unites: string | number | null): number {
  if (code === "8857") {
    return 30; // Fixed 30 minutes for first period
  }

  if (code === "8859") {
    // Variable duration from unites column (additional periods)
    const unitesValue = typeof unites === 'string' ? parseInt(unites, 10) : Number(unites);
    return unitesValue || 0;
  }

  return 0;
}

/**
 * Validate a single doctor-day for daily limit compliance
 */
function validateDoctorDay(dayData: DoctorDayInterventionData, validationRunId: string): InsertValidationResult[] {
  const results: InsertValidationResult[] = [];
  const DAILY_LIMIT = 180;

  // Check if daily limit is exceeded (strictly greater than 180)
  if (dayData.totalMinutes > DAILY_LIMIT) {
    const excessMinutes = dayData.totalMinutes - DAILY_LIMIT;

    // Sort interventions by date/time to get the first record chronologically
    const sortedInterventions = [...dayData.interventions].sort((a, b) => {
      const dateA = a.dateService?.getTime() || 0;
      const dateB = b.dateService?.getTime() || 0;
      if (dateA !== dateB) return dateA - dateB;

      // If same date, sort by debut time
      const timeA = a.debut || "";
      const timeB = b.debut || "";
      return timeA.localeCompare(timeB);
    });

    const firstRecord = sortedInterventions[0];
    const affectedRecordIds = dayData.interventions
      .map(intervention => intervention.id)
      .filter(id => id !== null) as string[];

    // Calculate total amount (all interventions)
    const totalAmount = dayData.interventions.reduce((sum, r) =>
      sum + Number(r.montantPreliminaire || 0), 0
    );

    // Calculate monetary impact: value of UNPAID visits over the 180-minute limit
    // Filter for interventions that were NOT paid (montantPaye = 0 or null)
    const unpaidInterventions = dayData.interventions.filter(r =>
      Number(r.montantPaye || 0) === 0
    );

    // Calculate total unpaid amount for interventions over the limit
    const unpaidAmount = unpaidInterventions.reduce((sum, r) =>
      sum + Number(r.montantPreliminaire || 0), 0
    );

    // Determine severity: ERROR if unpaid interventions exist, INFO if all paid
    const severity: "error" | "info" = unpaidAmount > 0 ? "error" : "info";

    // Build message based on paid status
    const message = unpaidAmount > 0
      ? `Limite quotidienne d'interventions cliniques dépassée : ${dayData.totalMinutes} minutes facturées le ${dayData.date} (maximum : 180 minutes par jour). ${unpaidInterventions.length} intervention(s) non payée(s).`
      : `Limite quotidienne d'interventions cliniques dépassée : ${dayData.totalMinutes} minutes facturées le ${dayData.date} (maximum : 180 minutes par jour), mais toutes les interventions ont été payées par la RAMQ.`;

    // Solution: only provide if there are unpaid interventions to fix
    const solution = unpaidAmount > 0
      ? `Veuillez vérifier si les éléments de contexte ICEP, ICSM ou ICTOX sont manquants. Autrement, annuler ${excessMinutes} minutes d'interventions non payées pour respecter la limite de 180 minutes par jour.`
      : null;

    results.push({
      validationRunId,
      ruleId: "INTERVENTION_CLINIQUE_DAILY_LIMIT",
      billingRecordId: firstRecord.id,
      idRamq: firstRecord.idRamq,
      severity,
      category: "intervention_clinique",
      message,
      solution,
      affectedRecords: affectedRecordIds,
      ruleData: {
        doctor: dayData.doctor,
        date: dayData.date,
        totalMinutes: dayData.totalMinutes,
        limit: DAILY_LIMIT,
        excessMinutes,
        code8857Minutes: dayData.code8857Minutes,
        code8859Minutes: dayData.code8859Minutes,
        recordCount: dayData.interventions.length,
        unpaidCount: unpaidInterventions.length,
        totalAmount: totalAmount.toFixed(2),
        unpaidAmount: unpaidAmount.toFixed(2),
        monetaryImpact: unpaidAmount.toFixed(2)
      }
    });
  }

  return results;
}