import { BillingRecord, InsertValidationResult, codes as codesTable } from "@shared/schema";
import { ValidationRule } from "../engine";
import { sql } from "drizzle-orm";
import { db } from "../../../../core/db";

export interface OptimizationOpportunity {
  record: BillingRecord;
  duration: number;
  currentAmount: number;
  interventionAmount: number;
  gain: number;
  suggestedCodes: string[];
}

// Cache consultation codes to avoid repeated database queries
let consultationCodeSetCache: Set<string> | null = null;

/**
 * Reset the consultation code cache (for testing purposes)
 */
export function resetConsultationCodeCache(): void {
  consultationCodeSetCache = null;
}

/**
 * Visit Duration Optimization Rule
 *
 * Identifies regular consultation/visit codes that could be billed as intervention clinique
 * (codes 8857/8859) for increased revenue, based on documented visit duration.
 *
 * Key Features:
 * - Filters for codes with top_level = "B - CONSULTATION, EXAMEN ET VISITE" (474 codes)
 * - Requires both "debut" (start time) and "fin" (end time) to be populated
 * - Calculates if intervention clinique billing would yield higher revenue
 * - Suggests code 8857 (30 min base) + 8859 (15 min increments) when advantageous
 * - Only triggers when duration ≥ 30 minutes and financial gain > 0
 */
export const visitDurationOptimizationRule: ValidationRule = {
  id: "VISIT_DURATION_OPTIMIZATION",
  name: "Optimisation intervention clinique vs visite régulière",
  category: "revenue_optimization",
  enabled: true,

  async validate(records: BillingRecord[], validationRunId: string): Promise<InsertValidationResult[]> {
    const results: InsertValidationResult[] = [];

    // Track all records analyzed for summary statistics
    const analyzedRecords: BillingRecord[] = [];
    const optimizationOpportunities: OptimizationOpportunity[] = [];

    // Step 1: Load consultation/visit codes from database (cached for performance)
    if (!consultationCodeSetCache) {
      const consultationCodes = await db.select({
        code: codesTable.code,
        topLevel: codesTable.topLevel
      })
      .from(codesTable)
      .where(sql`${codesTable.topLevel} = 'B - CONSULTATION, EXAMEN ET VISITE'`);

      consultationCodeSetCache = new Set(consultationCodes.map(c => c.code));
      console.log(`[VISIT_DURATION_OPT] Loaded ${consultationCodeSetCache.size} consultation/visit codes from database`);
    }

    const consultationCodeSet = consultationCodeSetCache;

    // Step 2: Analyze each billing record
    for (const record of records) {
      // Skip if missing required fields
      if (!record.code || !record.debut || !record.fin || !record.montantPreliminaire) {
        continue;
      }

      // Skip if not a consultation/visit code
      if (!consultationCodeSet.has(record.code)) {
        continue;
      }

      // Skip if already intervention clinique
      if (record.code === '8857' || record.code === '8859') {
        continue;
      }

      analyzedRecords.push(record);

      // Calculate visit duration
      const duration = calculateDuration(record.debut, record.fin);

      // Skip if duration < 30 minutes (minimum for intervention clinique)
      if (duration < 30) {
        continue;
      }

      // Skip if duration is invalid (negative or zero)
      if (duration <= 0) {
        continue;
      }

      // Calculate intervention clinique amount
      const interventionAmount = calculateInterventionAmount(duration);

      // Get current billing amount
      const currentAmount = Number(record.montantPreliminaire);

      // Calculate potential gain
      const gain = interventionAmount - currentAmount;

      // Only suggest if there's a financial advantage
      if (gain > 0) {
        // Determine suggested codes
        const suggestedCodes = getSuggestedCodes(duration);

        optimizationOpportunities.push({
          record,
          duration,
          currentAmount,
          interventionAmount,
          gain,
          suggestedCodes
        });

        // Create optimization result
        results.push({
          validationRunId,
          ruleId: "VISIT_DURATION_OPTIMIZATION",
          billingRecordId: record.id,
          idRamq: record.idRamq || null,
          severity: "optimization",
          category: "revenue_optimization",
          message: `Selon notre analyse, l'intervention clinique est plus avantageuse que la visite ${record.code} facturée.`,
          solution: `Veuillez valider que l'intervention clinique est plus avantageuse et facturer si le seuil de 180 minutes quotidien n'est pas atteint. N'oubliez pas d'ajouter les contextes ICEP, ICSM et ICTOX au besoin.`,
          affectedRecords: [record.id].filter(Boolean) as string[],
          ruleData: {
            currentCode: record.code,
            duration,
            currentAmount: currentAmount.toFixed(2),
            interventionAmount: interventionAmount.toFixed(2),
            gain: gain.toFixed(2),
            potentialRevenue: gain.toFixed(2),
            monetaryImpact: gain.toFixed(2),
            suggestedCodes,
            debut: record.debut,
            fin: record.fin
          }
        });
      }
    }

    // Step 3: Add informational summary (always, even when no optimizations)
    if (analyzedRecords.length > 0 || optimizationOpportunities.length > 0) {
      const totalAnalyzed = analyzedRecords.length;
      const totalOptimizations = optimizationOpportunities.length;
      const totalPotentialRevenue = optimizationOpportunities.reduce((sum, opp) => sum + opp.gain, 0);

      // Calculate statistics
      const uniqueCodes = new Set(analyzedRecords.map(r => r.code)).size;
      const avgDuration = analyzedRecords.length > 0
        ? analyzedRecords.reduce((sum, r) => {
            const dur = calculateDuration(r.debut || '', r.fin || '');
            return sum + dur;
          }, 0) / analyzedRecords.length
        : 0;

      const optimizationRate = totalAnalyzed > 0
        ? ((totalOptimizations / totalAnalyzed) * 100).toFixed(1)
        : '0.0';

      results.push({
        validationRunId,
        ruleId: "VISIT_DURATION_OPTIMIZATION",
        billingRecordId: analyzedRecords[0]?.id || optimizationOpportunities[0]?.record.id || null,
        idRamq: analyzedRecords[0]?.idRamq || optimizationOpportunities[0]?.record.idRamq || null,
        severity: "info",
        category: "revenue_optimization",
        message: `Validation optimisation intervention clinique complétée: ${totalAnalyzed} visite(s) analysée(s), ${totalOptimizations} opportunité(s) d'optimisation détectée(s). Revenu potentiel: ${totalPotentialRevenue.toFixed(2)}$.`,
        solution: null,
        affectedRecords: optimizationOpportunities.slice(0, 10).map(opp => opp.record.id).filter(Boolean) as string[],
        ruleData: {
          totalAnalyzed,
          totalOptimizations,
          totalPotentialRevenue: totalPotentialRevenue.toFixed(2),
          potentialRevenue: totalPotentialRevenue.toFixed(2),
          monetaryImpact: totalPotentialRevenue.toFixed(2),
          optimizationRate: `${optimizationRate}%`,
          uniqueCodes,
          avgDuration: avgDuration.toFixed(1),
          consultationCodesInDatabase: consultationCodeSet.size
        }
      });
    }

    console.log(`[VISIT_DURATION_OPT] Analysis complete: ${optimizationOpportunities.length} opportunities found`);

    return results;
  }
};

/**
 * Calculate duration in minutes between start and end times
 * Handles time format HH:MM
 * Returns 0 if invalid format or negative duration
 */
function calculateDuration(debut: string, fin: string): number {
  if (!debut || !fin) return 0;

  try {
    const [startHour, startMin] = debut.split(':').map(s => parseInt(s.trim(), 10));
    const [endHour, endMin] = fin.split(':').map(s => parseInt(s.trim(), 10));

    // Validate parsed values
    if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
      return 0;
    }

    // Convert to total minutes
    const startMinutes = startHour * 60 + startMin;
    let endMinutes = endHour * 60 + endMin;

    // Handle time crossing midnight (e.g., 23:30 to 00:15)
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60; // Add 24 hours
    }

    const duration = endMinutes - startMinutes;

    // Return 0 for invalid durations
    return duration > 0 ? duration : 0;
  } catch (error) {
    console.error('[VISIT_DURATION_OPT] Error calculating duration:', error);
    return 0;
  }
}

/**
 * Calculate intervention clinique amount based on duration
 *
 * Pricing:
 * - Code 8857 (first 30 minutes): $59.70
 * - Code 8859 (additional 15-minute periods): $29.85 each
 *
 * Examples:
 * - 30-44 min: 8857 alone = $59.70
 * - 45-59 min: 8857 + 8859 (15 min) = $89.55
 * - 60-74 min: 8857 + 8859 (30 min) = $119.40
 */
function calculateInterventionAmount(durationMinutes: number): number {
  if (durationMinutes < 30) return 0;

  // Base amount for first 30 minutes (code 8857)
  let amount = 59.70;

  // Calculate additional periods (code 8859)
  const remainingMinutes = durationMinutes - 30;

  if (remainingMinutes > 0) {
    // Round UP to nearest 15-minute period
    const additionalPeriods = Math.ceil(remainingMinutes / 15);
    amount += additionalPeriods * 29.85;
  }

  return amount;
}

/**
 * Determine which intervention clinique codes to suggest
 * Returns array like ["8857"] or ["8857", "8859"]
 */
function getSuggestedCodes(durationMinutes: number): string[] {
  if (durationMinutes < 30) return [];

  const codes: string[] = ['8857']; // Always include base code

  const remainingMinutes = durationMinutes - 30;
  if (remainingMinutes > 0) {
    codes.push('8859'); // Add additional period code
  }

  return codes;
}
