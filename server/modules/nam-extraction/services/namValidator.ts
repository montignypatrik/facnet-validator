/**
 * NAM validation service for Quebec health insurance numbers.
 *
 * NAM Format: Exactly 4 letters followed by 8 digits (12 characters total)
 * Example: ABCD12345678
 */

import { NAM_VALIDATION_RULES } from "../types";

/**
 * Validate NAM format against Quebec health insurance number rules.
 *
 * @param nam - The NAM string to validate
 * @returns A tuple of [is_valid, error_reason]
 *          - If valid: [true, ""]
 *          - If invalid: [false, "reason in French"]
 *
 * NAM Rules:
 * - Exactly 12 characters total
 * - First 4 characters must be letters (A-Z, case-insensitive)
 * - Last 8 characters must be digits (0-9)
 * - No spaces, hyphens, or other separators allowed
 */
export function validateNAMFormat(nam: string): [boolean, string] {
  // Check if nam is a string
  if (typeof nam !== "string") {
    return [false, "Le NAM doit être une chaîne de caractères"];
  }

  // Remove leading/trailing whitespace for validation
  const trimmedNam = nam.trim();

  // Check length first (fast check)
  if (trimmedNam.length !== NAM_VALIDATION_RULES.TOTAL_LENGTH) {
    return [
      false,
      `Le NAM doit contenir exactement ${NAM_VALIDATION_RULES.TOTAL_LENGTH} caractères`,
    ];
  }

  // Check format with regex
  if (!NAM_VALIDATION_RULES.PATTERN.test(trimmedNam)) {
    // Provide more specific error message
    const letters = trimmedNam.slice(0, NAM_VALIDATION_RULES.LETTER_COUNT);
    const digits = trimmedNam.slice(NAM_VALIDATION_RULES.LETTER_COUNT);

    if (!/^[A-Za-z]+$/.test(letters)) {
      return [false, "Les 4 premiers caractères doivent être des lettres"];
    }
    if (!/^\d+$/.test(digits)) {
      return [false, "Les 8 derniers caractères doivent être des chiffres"];
    }

    return [false, "Le NAM doit être composé de 4 lettres suivies de 8 chiffres"];
  }

  // All checks passed
  return [true, ""];
}

/**
 * Quick check if a NAM is valid.
 *
 * @param nam - The NAM string to validate
 * @returns True if valid, False otherwise
 *
 * This is a convenience function that wraps validateNAMFormat()
 * for cases where you only need a boolean result.
 */
export function isValidNAM(nam: string): boolean {
  const [isValid] = validateNAMFormat(nam);
  return isValid;
}

/**
 * Normalize a NAM to uppercase format.
 *
 * @param nam - The NAM string to normalize
 * @returns The NAM in uppercase
 *
 * This function only normalizes case, it does not validate format.
 * Use validateNAMFormat() to check validity.
 */
export function normalizeNAM(nam: string): string {
  return nam.toUpperCase().trim();
}
