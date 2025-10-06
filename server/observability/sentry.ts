import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { sanitizeEventData } from './sanitizer';
import type { ObservabilityConfig } from './types';

/**
 * Sentry Error Tracking & Performance Monitoring
 *
 * Initializes Sentry for production observability with:
 * - Error tracking and aggregation
 * - Performance monitoring (APM)
 * - Profiling for bottleneck detection
 * - PHI sanitization via beforeSend hook
 */

let isInitialized = false;

/**
 * Get Sentry configuration from environment variables
 */
export function getSentryConfig(): ObservabilityConfig['sentry'] {
  return {
    enabled: process.env.SENTRY_ENABLED === 'true',
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE || '0.1'),
    debug: process.env.SENTRY_DEBUG === 'true',
  };
}

/**
 * Initialize Sentry error tracking and performance monitoring
 *
 * CRITICAL: This MUST be called FIRST in server/index.ts, before any other imports
 * to ensure all errors are captured.
 *
 * @returns true if initialized successfully, false otherwise
 */
export function initializeSentry(): boolean {
  const config = getSentryConfig();

  // Skip if already initialized
  if (isInitialized) {
    console.log('[SENTRY] Already initialized');
    return true;
  }

  // Skip if disabled or no DSN
  if (!config.enabled) {
    console.log('[SENTRY] Disabled (SENTRY_ENABLED=false)');
    return false;
  }

  if (!config.dsn) {
    console.log('[SENTRY] Disabled (no SENTRY_DSN configured)');
    return false;
  }

  try {
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,

      // Performance Monitoring
      tracesSampleRate: config.tracesSampleRate,
      profilesSampleRate: config.profilesSampleRate,

      // Debug mode (only in development)
      debug: config.debug,

      // Integrations
      integrations: [
        // HTTP request tracing
        new Sentry.Integrations.Http({
          tracing: true,
          breadcrumbs: true,
        }),

        // Performance profiling
        new ProfilingIntegration(),

        // Express instrumentation (will be added when Express is initialized)
        // This is added automatically by Sentry when it detects Express
      ],

      // PHI SANITIZATION - CRITICAL FOR QUEBEC HEALTHCARE COMPLIANCE
      // This hook runs before EVERY event is sent to Sentry
      beforeSend: (event, hint) => {
        try {
          return sanitizeEventData(event, hint);
        } catch (error) {
          console.error('[SENTRY] beforeSend hook failed:', error);
          // Fail-safe: don't send event if sanitization fails
          return null;
        }
      },

      // Ignore common non-critical errors
      ignoreErrors: [
        // Network errors
        'Network request failed',
        'NetworkError',
        'AbortError',

        // Client-side errors that shouldn't crash server
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',

        // Auth errors (expected failures)
        'Unauthorized',
        'Invalid token',
      ],

      // Don't capture console.log as breadcrumbs (we have our own logger)
      beforeBreadcrumb: (breadcrumb, hint) => {
        // Ignore console breadcrumbs
        if (breadcrumb.category === 'console') {
          return null;
        }
        return breadcrumb;
      },

      // Sample rate for session replays (disabled by default)
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    });

    isInitialized = true;
    console.log(`[SENTRY] Initialized successfully (environment: ${config.environment}, traces sample rate: ${config.tracesSampleRate})`);
    return true;

  } catch (error) {
    console.error('[SENTRY] Failed to initialize:', error);
    return false;
  }
}

/**
 * Check if Sentry is initialized
 */
export function isSentryInitialized(): boolean {
  return isInitialized;
}

/**
 * Capture an exception in Sentry
 *
 * This is a wrapper around Sentry.captureException with TypeScript types
 */
export function captureException(
  error: Error,
  options?: {
    level?: Sentry.SeverityLevel;
    tags?: Record<string, string>;
    extra?: Record<string, any>; // Will be sanitized
    user?: { id?: string };
    contexts?: Record<string, Record<string, any>>;
  }
): string | undefined {
  if (!isInitialized) {
    console.warn('[SENTRY] Cannot capture exception: not initialized');
    return undefined;
  }

  return Sentry.captureException(error, {
    level: options?.level || 'error',
    tags: options?.tags,
    extra: options?.extra,
    user: options?.user,
    contexts: options?.contexts,
  });
}

/**
 * Capture a message in Sentry
 */
export function captureMessage(
  message: string,
  options?: {
    level?: Sentry.SeverityLevel;
    tags?: Record<string, string>;
    extra?: Record<string, any>; // Will be sanitized
  }
): string | undefined {
  if (!isInitialized) {
    console.warn('[SENTRY] Cannot capture message: not initialized');
    return undefined;
  }

  return Sentry.captureMessage(message, {
    level: options?.level || 'info',
    tags: options?.tags,
    extra: options?.extra,
  });
}

/**
 * Add a breadcrumb for debugging context
 *
 * Breadcrumbs provide a trail of events leading up to an error
 */
export function addBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  level?: Sentry.SeverityLevel;
  data?: Record<string, any>; // Will be sanitized
  timestamp?: number;
}): void {
  if (!isInitialized) {
    return;
  }

  Sentry.addBreadcrumb({
    category: breadcrumb.category,
    message: breadcrumb.message,
    level: breadcrumb.level || 'info',
    data: breadcrumb.data,
    timestamp: breadcrumb.timestamp,
  });
}

/**
 * Set user context for error tracking
 *
 * IMPORTANT: Only set user ID (Auth0 ID), never email or other PII
 */
export function setUser(userId: string | null): void {
  if (!isInitialized) {
    return;
  }

  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Set tags for error tracking
 */
export function setTags(tags: Record<string, string>): void {
  if (!isInitialized) {
    return;
  }

  Sentry.setTags(tags);
}

/**
 * Set a single tag for error tracking
 */
export function setTag(key: string, value: string): void {
  if (!isInitialized) {
    return;
  }

  Sentry.setTag(key, value);
}

/**
 * Start a new Sentry transaction for performance monitoring
 *
 * @param name - Transaction name (e.g., "POST /api/validations")
 * @param op - Operation type (e.g., "http.server", "job.process")
 * @returns Transaction object or undefined if not initialized
 */
export function startTransaction(
  name: string,
  op: string,
  data?: Record<string, any>
): Sentry.Transaction | undefined {
  if (!isInitialized) {
    return undefined;
  }

  return Sentry.startTransaction({
    name,
    op,
    data,
  });
}

/**
 * Flush all pending Sentry events
 *
 * Useful during graceful shutdown to ensure all events are sent
 *
 * @param timeout - Timeout in milliseconds (default: 2000)
 * @returns Promise that resolves when flushed or timeout
 */
export async function flush(timeout: number = 2000): Promise<boolean> {
  if (!isInitialized) {
    return true;
  }

  return Sentry.flush(timeout);
}

/**
 * Close Sentry connection
 *
 * Should be called during application shutdown
 */
export async function close(timeout: number = 2000): Promise<boolean> {
  if (!isInitialized) {
    return true;
  }

  const result = await Sentry.close(timeout);
  isInitialized = false;
  return result;
}

// Re-export Sentry for direct access when needed
export { Sentry };
