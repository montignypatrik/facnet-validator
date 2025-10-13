import crypto from 'crypto';
import { BillingRecord, ValidationResult } from '@shared/schema';

/**
 * Default salt for PHI hashing (can be overridden via PHI_REDACTION_SALT env variable)
 * In production, use a strong random salt stored securely
 */
const DEFAULT_SALT = 'facnet-validator-phi-salt-2025';

/**
 * Get the salt for PHI redaction hashing
 * Uses environment variable PHI_REDACTION_SALT if set, otherwise uses default
 */
function getSalt(): string {
  return process.env.PHI_REDACTION_SALT || DEFAULT_SALT;
}

/**
 * Redact a patient ID using deterministic hashing
 *
 * This function uses SHA-256 with a salt to create a consistent hash for each patient ID.
 * The same patient ID will always produce the same redacted value, which enables:
 * - Grouping patients in analytics
 * - Tracking same patient across multiple records
 * - Privacy protection (original ID cannot be reversed)
 *
 * @param patientId - The original patient identifier
 * @returns Redacted patient ID in format: [PATIENT-XXXXXXXX]
 *
 * @example
 * redactPatientId("12345") // Returns: "[PATIENT-A1B2C3D4]"
 * redactPatientId("12345") // Returns: "[PATIENT-A1B2C3D4]" (same hash)
 */
export function redactPatientId(patientId: string | null): string | null {
  if (!patientId) return null;

  // Create deterministic hash using SHA-256 with salt
  const hash = crypto
    .createHash('sha256')
    .update(patientId + getSalt())
    .digest('hex');

  // Use first 8 characters of hash for readability
  const shortHash = hash.substring(0, 8).toUpperCase();

  return `[PATIENT-${shortHash}]`;
}

/**
 * Redact doctor information
 *
 * Fully redacts doctor information to protect physician identity.
 * Unlike patient IDs, doctor info doesn't need deterministic hashing
 * since we don't need to track individual doctors in analytics.
 *
 * @param doctorInfo - The original doctor information
 * @returns Redacted string: "[REDACTED]"
 *
 * @example
 * redactDoctorInfo("Dr. Jean Tremblay") // Returns: "[REDACTED]"
 */
export function redactDoctorInfo(doctorInfo: string | null): string | null {
  if (!doctorInfo) return null;
  return '[REDACTED]';
}

/**
 * Redact PHI fields in a billing record
 *
 * Applies redaction to sensitive patient and doctor fields.
 * IMPORTANT: RAMQ ID is NOT redacted - it's a billing invoice number, not PHI.
 *
 * @param record - The billing record to redact
 * @param enabled - Whether redaction is enabled (default: true)
 * @returns Billing record with PHI fields redacted
 *
 * @example
 * const redacted = redactBillingRecord(record, true);
 * // record.patient: "12345" → "[PATIENT-A1B2C3D4]"
 * // record.doctorInfo: "Dr. Smith" → "[REDACTED]"
 * // record.idRamq: "2024-INV-001" → "2024-INV-001" (unchanged)
 */
export function redactBillingRecord(
  record: BillingRecord,
  enabled: boolean = true
): BillingRecord {
  if (!enabled) {
    return record;
  }

  return {
    ...record,
    patient: redactPatientId(record.patient),
    doctorInfo: redactDoctorInfo(record.doctorInfo),
    // IMPORTANT: idRamq is NOT redacted - it's billing data, not PHI
  };
}

/**
 * Redact PHI fields in a validation result
 *
 * Applies redaction to validation results that may contain PHI.
 * Handles both direct fields and nested data in ruleData.
 * IMPORTANT: RAMQ ID fields are NOT redacted - they're billing data, not PHI.
 *
 * @param result - The validation result to redact
 * @param enabled - Whether redaction is enabled (default: true)
 * @returns Validation result with PHI fields redacted
 *
 * @example
 * const redacted = redactValidationResult(result, true);
 * // Redacts patient identifiers in ruleData
 * // Does NOT redact idRamq field
 */
export function redactValidationResult(
  result: ValidationResult & { monetaryImpact?: number },
  enabled: boolean = true
): ValidationResult & { monetaryImpact?: number } {
  if (!enabled) {
    return result;
  }

  // Create a copy to avoid mutating the original
  // IMPORTANT: Use spread to preserve all fields, including dynamically added ones like monetaryImpact
  const redactedResult = { ...result } as ValidationResult & { monetaryImpact?: number };

  // Redact ruleData if it contains patient information
  if (result.ruleData && typeof result.ruleData === 'object') {
    const ruleData = result.ruleData as Record<string, any>;
    const redactedRuleData: Record<string, any> = {};

    for (const [key, value] of Object.entries(ruleData)) {
      // Redact fields that might contain patient IDs
      if (key === 'patient' || key === 'patientId') {
        redactedRuleData[key] = typeof value === 'string' ? redactPatientId(value) : value;
      }
      // Redact fields that might contain doctor info
      else if (key === 'doctor' || key === 'doctorInfo') {
        redactedRuleData[key] = typeof value === 'string' ? redactDoctorInfo(value) : value;
      }
      // Keep all other fields unchanged (including RAMQ IDs)
      else {
        redactedRuleData[key] = value;
      }
    }

    redactedResult.ruleData = redactedRuleData;
  }

  // IMPORTANT: idRamq field is NOT redacted - it's billing data, not PHI
  // The idRamq field is used for grouping validation results by invoice
  // IMPORTANT: monetaryImpact field is preserved (added dynamically in storage.getValidationResults())

  return redactedResult;
}

/**
 * Check if a user should have PHI redaction enabled
 *
 * Helper function to determine redaction status based on user preferences.
 * Defaults to true (privacy-first approach).
 *
 * @param phiRedactionEnabled - User's PHI redaction preference
 * @returns Whether redaction should be applied
 */
export function shouldRedactPhi(phiRedactionEnabled: boolean | null | undefined): boolean {
  // Default to true if not explicitly set (privacy-first)
  return phiRedactionEnabled !== false;
}
