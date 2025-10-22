/**
 * Date Validator Service
 *
 * Validates visit dates for NAM extraction.
 * Expected format: YYYY-MM-DD (ISO 8601)
 *
 * Examples:
 * - Valid: "2025-01-21", "2024-12-31"
 * - Invalid: "21/01/2025", "2025-1-21", "invalid"
 */

/**
 * Validates a visit date string against the expected format (YYYY-MM-DD)
 *
 * @param date - The date string to validate
 * @returns Tuple: [isValid, errorMessage]
 *   - isValid: true if date is valid, false otherwise
 *   - errorMessage: Empty string if valid, French error message if invalid
 */
export function validateDateFormat(date: string | null | undefined): [boolean, string] {
  // Check if date is provided
  if (!date || typeof date !== "string") {
    return [false, "La date de visite est requise"];
  }

  // Normalize: trim whitespace
  const normalized = date.trim();

  if (normalized.length === 0) {
    return [false, "La date de visite ne peut pas être vide"];
  }

  // Check format: YYYY-MM-DD (10 characters)
  if (normalized.length !== 10) {
    return [false, "La date doit être au format YYYY-MM-DD (ex: 2025-01-21)"];
  }

  // Regex pattern for YYYY-MM-DD
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(normalized)) {
    return [false, "La date doit être au format YYYY-MM-DD (ex: 2025-01-21)"];
  }

  // Parse components
  const parts = normalized.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  // Validate month range (1-12)
  if (month < 1 || month > 12) {
    return [false, "Le mois doit être entre 01 et 12"];
  }

  // Validate day range based on month
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return [false, `Le jour doit être entre 01 et ${daysInMonth} pour ce mois`];
  }

  // Validate year is reasonable (between 1900 and 2100)
  if (year < 1900 || year > 2100) {
    return [false, "L'année doit être entre 1900 et 2100"];
  }

  // Additional check: ensure it's a valid date object
  const dateObj = new Date(normalized);
  if (isNaN(dateObj.getTime())) {
    return [false, "Date invalide"];
  }

  // All checks passed
  return [true, ""];
}

/**
 * Quick boolean check for date validity
 *
 * @param date - The date string to validate
 * @returns true if valid, false otherwise
 */
export function isValidDate(date: string | null | undefined): boolean {
  const [isValid] = validateDateFormat(date);
  return isValid;
}

/**
 * Normalizes a date string to the standard format
 * Attempts to parse various formats and convert to YYYY-MM-DD
 *
 * @param date - The date string to normalize
 * @returns Normalized date string in YYYY-MM-DD format, or original if cannot parse
 */
export function normalizeDate(date: string | null | undefined): string {
  if (!date || typeof date !== "string") {
    return "";
  }

  const trimmed = date.trim();
  if (trimmed.length === 0) {
    return "";
  }

  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Try to parse various formats
  // Format: DD/MM/YYYY or D/M/YYYY
  const ddmmyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const ddmmyyyyMatch = trimmed.match(ddmmyyyyPattern);
  if (ddmmyyyyMatch) {
    const day = ddmmyyyyMatch[1].padStart(2, "0");
    const month = ddmmyyyyMatch[2].padStart(2, "0");
    const year = ddmmyyyyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Format: YYYY/MM/DD
  const yyyymmddPattern = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
  const yyyymmddMatch = trimmed.match(yyyymmddPattern);
  if (yyyymmddMatch) {
    const year = yyyymmddMatch[1];
    const month = yyyymmddMatch[2].padStart(2, "0");
    const day = yyyymmddMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Format: YYYYMMDD (compact)
  const compactPattern = /^(\d{4})(\d{2})(\d{2})$/;
  const compactMatch = trimmed.match(compactPattern);
  if (compactMatch) {
    const year = compactMatch[1];
    const month = compactMatch[2];
    const day = compactMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Try native Date parsing as last resort
  try {
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, "0");
      const day = String(parsed.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch (error) {
    // Parsing failed, return original
  }

  // Cannot normalize, return original
  return trimmed;
}
