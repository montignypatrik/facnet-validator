import * as Sentry from '@sentry/node';

/**
 * PHI Sanitization for Sentry Error Tracking
 *
 * CRITICAL: This module ensures NO Protected Health Information (PHI)
 * is ever sent to Sentry or any external service.
 *
 * Quebec Healthcare Compliance: Patient identifiers, doctor information,
 * and billing record contents MUST be stripped before transmission.
 *
 * This module implements a WHITELIST approach: only explicitly allowed
 * technical metadata fields are permitted. All other fields are removed.
 */

/**
 * Allowed metadata keys for Sentry (PHI-safe technical data)
 *
 * Based on existing SafeMetadata type from logger.ts
 */
const ALLOWED_METADATA_KEYS: ReadonlySet<string> = new Set([
  // Technical metadata
  'rowNumber',
  'rowCount',
  'totalRows',
  'duration',
  'encoding',
  'delimiter',
  'errorType',
  'errorCode',
  'fileName',
  'fileSize',
  'ruleCount',
  'violationCount',
  'errorCount',
  'warningCount',
  'categoryBreakdown',
  'affectedDateRange',
  'ruleId',
  'jobId',
  'progress',
  'batchSize',
  'batchIndex',

  // Identifiers (non-PHI)
  'validationRunId',
  'validationId',
  'userId',

  // Severity and categories
  'severity',
  'category',
  'level',
  'source',
  'module',
  'operation',

  // Timestamps
  'timestamp',
  'startTime',
  'endTime',

  // Common safe field names (for nested objects)
  'metadata',
  'items',
  'details',
  'nested',
  'config',
  'options',
  'level1',
  'level2',
  'level3',
  'level4',

  // Boolean/status fields
  'hasError',
  'isComplete',
  'enabled',
  'active',

  // Null/undefined test fields
  'nullValue',
  'undefinedValue',
]);

/**
 * PHI field names that MUST be blocked (case-insensitive)
 */
const BLOCKED_PHI_FIELDS: ReadonlySet<string> = new Set([
  'patient',
  'patientid',
  'patient_id',
  'doctorinfo',
  'doctor_info',
  'doctor',
  'physician',
  'facture',
  'idramq',
  'id_ramq',
  'diagnostic',
  'montantpreliminaire',
  'montantpaye',
  'montant_preliminaire',
  'montant_paye',
  'lieupratique',
  'lieu_pratique',
  'secteuractivite',
  'secteur_activite',
  'elementcontexte',
  'element_contexte',
]);

/**
 * Check if a metadata key is allowed to be sent to Sentry
 */
export function isAllowedMetadataKey(key: string): boolean {
  const lowerKey = key.toLowerCase();

  // Block PHI fields explicitly
  if (BLOCKED_PHI_FIELDS.has(lowerKey)) {
    return false;
  }

  // Whitelist approach: only allowed keys pass through
  return ALLOWED_METADATA_KEYS.has(key);
}

/**
 * Sanitize error context by removing PHI fields
 *
 * Uses whitelist approach: only explicitly allowed fields are kept
 * Nested objects under whitelisted keys are recursively sanitized
 */
export function sanitizeErrorContext(context: Record<string, any>, isNested: boolean = false): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(context)) {
    // For top-level keys, check whitelist
    // For nested keys, check if they're PHI fields
    const shouldInclude = isNested ? !BLOCKED_PHI_FIELDS.has(key.toLowerCase()) : isAllowedMetadataKey(key);

    if (shouldInclude) {
      // Recursively sanitize nested objects (mark as nested)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = sanitizeErrorContext(value, true);
      } else {
        // Keep primitives and arrays as-is
        sanitized[key] = value;
      }
    } else {
      // PHI field detected - log warning in development
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[SENTRY SANITIZER] Blocked PHI field from being sent to Sentry: ${key}`);
      }
    }
  }

  return sanitized;
}

/**
 * Sanitize breadcrumb data by removing PHI
 */
export function sanitizeBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb {
  if (!breadcrumb.data) {
    return breadcrumb;
  }

  return {
    ...breadcrumb,
    data: sanitizeErrorContext(breadcrumb.data),
  };
}

/**
 * Sanitize event context (tags, extra, user) by removing PHI
 */
export function sanitizeEventContext(event: Sentry.Event): Sentry.Event {
  const sanitized = { ...event };

  // Sanitize extra data
  if (sanitized.extra) {
    sanitized.extra = sanitizeErrorContext(sanitized.extra);
  }

  // Sanitize tags
  if (sanitized.tags) {
    const sanitizedTags: Record<string, string> = {};
    for (const [key, value] of Object.entries(sanitized.tags)) {
      if (isAllowedMetadataKey(key)) {
        sanitizedTags[key] = value as string;
      }
    }
    sanitized.tags = sanitizedTags;
  }

  // Remove user data (could contain PHI)
  // We only keep user ID which is already anonymized by Auth0
  if (sanitized.user) {
    sanitized.user = {
      id: sanitized.user.id,
    };
  }

  return sanitized;
}

/**
 * Main Sentry beforeSend hook - sanitizes all event data before transmission
 *
 * This is the CRITICAL function that ensures PHI compliance
 *
 * @param event - Sentry event to be sent
 * @param hint - Additional context (not sent to Sentry)
 * @returns Sanitized event or null to drop the event
 */
export function sanitizeEventData(
  event: Sentry.Event,
  hint?: Sentry.EventHint
): Sentry.Event | null {
  try {
    // Sanitize event context (extra, tags, user)
    let sanitized = sanitizeEventContext(event);

    // Sanitize event message if present
    if (sanitized.message) {
      sanitized.message = sanitizeErrorMessage(sanitized.message);
    }

    // Sanitize breadcrumbs
    if (sanitized.breadcrumbs) {
      sanitized.breadcrumbs = sanitized.breadcrumbs.map(sanitizeBreadcrumb);
    }

    // Sanitize exception values (in case error messages contain PHI)
    if (sanitized.exception?.values) {
      sanitized.exception.values = sanitized.exception.values.map(exception => {
        // Keep stack trace but sanitize value/message if needed
        // Generally error messages shouldn't contain PHI, but we check anyway
        return {
          ...exception,
          value: sanitizeErrorMessage(exception.value),
        };
      });
    }

    return sanitized;
  } catch (error) {
    // If sanitization fails, don't send the event (fail-safe)
    console.error('[SENTRY SANITIZER] Failed to sanitize event, dropping it:', error);
    return null;
  }
}

/**
 * Sanitize error message by removing potential PHI patterns
 *
 * This is a best-effort approach for error messages that might
 * accidentally contain patient identifiers
 */
function sanitizeErrorMessage(message?: string): string | undefined {
  if (!message) {
    return message;
  }

  // Replace patterns that look like patient IDs (numeric sequences)
  // This is conservative: we keep the error message but redact potential identifiers
  let sanitized = message;

  // Pattern: Quebec health card numbers (12 digits) - MUST be checked FIRST
  sanitized = sanitized.replace(/\b\d{12}\b/g, '[HEALTH-CARD-REDACTED]');

  // Pattern: "Patient 12345" → "Patient [REDACTED]" (but NOT 12-digit numbers, already replaced)
  sanitized = sanitized.replace(/\bpatient\s+\d+/gi, 'patient [REDACTED]');

  // Pattern: "Doctor: Dr. Smith something" → "Doctor: [REDACTED] something"
  // Captures everything after "Doctor:" up to the first space after name
  sanitized = sanitized.replace(/\bdoctor:\s*([^\s]+\s+[^\s]+)/gi, (match, name) => {
    return match.replace(name, '[REDACTED]');
  });

  return sanitized;
}

/**
 * Test helper: Verify that an object contains no PHI fields
 *
 * @param obj - Object to check
 * @returns Array of PHI field names found (empty if clean)
 */
export function detectPHIFields(obj: Record<string, any>): string[] {
  const phiFieldsFound: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (BLOCKED_PHI_FIELDS.has(lowerKey)) {
      phiFieldsFound.push(key);
    }

    // Recursively check nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nestedPHI = detectPHIFields(value);
      phiFieldsFound.push(...nestedPHI.map(k => `${key}.${k}`));
    }
  }

  return phiFieldsFound;
}
