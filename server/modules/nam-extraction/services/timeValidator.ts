/**
 * Time Validator Service
 *
 * Validates visit times for NAM extraction.
 * Expected format: HH:MM (24-hour format)
 *
 * Examples:
 * - Valid: "08:00", "14:30", "23:59"
 * - Invalid: "8:00", "14:3", "2:30 PM", "25:00"
 *
 * Default time when not provided: 08:00 (8 AM)
 */

/**
 * Default visit time when time is not found in the document
 */
export const DEFAULT_TIME = "08:00";

/**
 * Validates a visit time string against the expected format (HH:MM in 24h)
 *
 * @param time - The time string to validate
 * @returns Tuple: [isValid, errorMessage]
 *   - isValid: true if time is valid, false otherwise
 *   - errorMessage: Empty string if valid, French error message if invalid
 */
export function validateTimeFormat(time: string | null | undefined): [boolean, string] {
  // Time is optional - if not provided, default will be used
  if (!time || typeof time !== "string") {
    return [true, ""]; // Will use default time
  }

  // Normalize: trim whitespace
  const normalized = time.trim();

  if (normalized.length === 0) {
    return [true, ""]; // Will use default time
  }

  // Check format: HH:MM (5 characters)
  if (normalized.length !== 5) {
    return [false, "L'heure doit être au format HH:MM (ex: 08:00, 14:30)"];
  }

  // Regex pattern for HH:MM (24-hour format)
  const timePattern = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timePattern.test(normalized)) {
    return [false, "L'heure doit être au format HH:MM en format 24h (ex: 08:00, 14:30)"];
  }

  // Parse components
  const parts = normalized.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  // Validate hour range (0-23)
  if (hours < 0 || hours > 23) {
    return [false, "L'heure doit être entre 00 et 23"];
  }

  // Validate minute range (0-59)
  if (minutes < 0 || minutes > 59) {
    return [false, "Les minutes doivent être entre 00 et 59"];
  }

  // All checks passed
  return [true, ""];
}

/**
 * Quick boolean check for time validity
 *
 * @param time - The time string to validate
 * @returns true if valid, false otherwise
 */
export function isValidTime(time: string | null | undefined): boolean {
  const [isValid] = validateTimeFormat(time);
  return isValid;
}

/**
 * Normalizes a time string to the standard format (HH:MM in 24h)
 * Attempts to parse various formats and convert to HH:MM
 * Returns default time if cannot parse
 *
 * @param time - The time string to normalize
 * @returns Normalized time string in HH:MM format, or DEFAULT_TIME if cannot parse
 */
export function normalizeTime(time: string | null | undefined): string {
  if (!time || typeof time !== "string") {
    return DEFAULT_TIME;
  }

  const trimmed = time.trim();
  if (trimmed.length === 0) {
    return DEFAULT_TIME;
  }

  // If already in HH:MM format, return as-is
  if (/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(trimmed)) {
    return trimmed;
  }

  // Format: H:MM or HH:M (missing leading zeros)
  const hmmPattern = /^(\d{1,2}):(\d{1,2})$/;
  const hmmMatch = trimmed.match(hmmPattern);
  if (hmmMatch) {
    const hours = parseInt(hmmMatch[1], 10);
    const minutes = parseInt(hmmMatch[2], 10);

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  // Format: HHMM (compact, no separator)
  const compactPattern = /^(\d{2})(\d{2})$/;
  const compactMatch = trimmed.match(compactPattern);
  if (compactMatch) {
    const hours = parseInt(compactMatch[1], 10);
    const minutes = parseInt(compactMatch[2], 10);

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${compactMatch[1]}:${compactMatch[2]}`;
    }
  }

  // Format: H:MM AM/PM or HH:MM AM/PM (12-hour format)
  const ampmPattern = /^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/i;
  const ampmMatch = trimmed.match(ampmPattern);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();

    // Convert to 24-hour format
    if (period === "PM" && hours !== 12) {
      hours += 12;
    } else if (period === "AM" && hours === 12) {
      hours = 0;
    }

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  // Format: HH h MM (French format like "14 h 30")
  const frenchPattern = /^(\d{1,2})\s*h\s*(\d{2})$/i;
  const frenchMatch = trimmed.match(frenchPattern);
  if (frenchMatch) {
    const hours = parseInt(frenchMatch[1], 10);
    const minutes = parseInt(frenchMatch[2], 10);

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  // Cannot normalize, return default time
  return DEFAULT_TIME;
}

/**
 * Gets the time value or default if not provided/invalid
 *
 * @param time - The time string
 * @returns The time if valid, or DEFAULT_TIME if not
 */
export function getTimeOrDefault(time: string | null | undefined): string {
  if (!time || typeof time !== "string" || time.trim().length === 0) {
    return DEFAULT_TIME;
  }

  const normalized = normalizeTime(time);
  const [isValid] = validateTimeFormat(normalized);

  return isValid ? normalized : DEFAULT_TIME;
}
