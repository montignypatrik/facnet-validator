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
 *
 * IMPORTANT: Uses lazy imports to avoid loading @sentry/node when disabled
 */

let isInitialized = false;
let SentryModule: typeof import('@sentry/node') | null = null;

/**
 * Lazy load Sentry modules
 * Only imports @sentry/node if Sentry is enabled
 */
async function loadSentry() {
  if (SentryModule) {
    return SentryModule;
  }

  try {
    SentryModule = await import('@sentry/node');
    return SentryModule;
  } catch (error) {
    console.error('[SENTRY] Failed to load @sentry/node:', error);
    throw error;
  }
}

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
 * @returns Promise<boolean> - true if initialized successfully, false otherwise
 */
export async function initializeSentry(): Promise<boolean> {
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
    // Lazy load Sentry module
    const Sentry = await loadSentry();
    const { ProfilingIntegration } = await import('@sentry/profiling-node');

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
    level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
    tags?: Record<string, string>;
    extra?: Record<string, any>; // Will be sanitized
    user?: { id?: string };
    contexts?: Record<string, Record<string, any>>;
  }
): string | undefined {
  if (!isInitialized || !SentryModule) {
    console.warn('[SENTRY] Cannot capture exception: not initialized');
    return undefined;
  }

  return SentryModule.captureException(error, {
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
    level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
    tags?: Record<string, string>;
    extra?: Record<string, any>; // Will be sanitized
  }
): string | undefined {
  if (!isInitialized || !SentryModule) {
    console.warn('[SENTRY] Cannot capture message: not initialized');
    return undefined;
  }

  return SentryModule.captureMessage(message, {
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
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
  data?: Record<string, any>; // Will be sanitized
  timestamp?: number;
}): void {
  if (!isInitialized || !SentryModule) {
    return;
  }

  SentryModule.addBreadcrumb({
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
  if (!isInitialized || !SentryModule) {
    return;
  }

  if (userId) {
    SentryModule.setUser({ id: userId });
  } else {
    SentryModule.setUser(null);
  }
}

/**
 * Set tags for error tracking
 */
export function setTags(tags: Record<string, string>): void {
  if (!isInitialized || !SentryModule) {
    return;
  }

  SentryModule.setTags(tags);
}

/**
 * Set a single tag for error tracking
 */
export function setTag(key: string, value: string): void {
  if (!isInitialized || !SentryModule) {
    return;
  }

  SentryModule.setTag(key, value);
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
): any | undefined {
  if (!isInitialized || !SentryModule) {
    return undefined;
  }

  return SentryModule.startTransaction({
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
  if (!isInitialized || !SentryModule) {
    return true;
  }

  return SentryModule.flush(timeout);
}

/**
 * Close Sentry connection
 *
 * Should be called during application shutdown
 */
export async function close(timeout: number = 2000): Promise<boolean> {
  if (!isInitialized || !SentryModule) {
    return true;
  }

  const result = await SentryModule.close(timeout);
  isInitialized = false;
  SentryModule = null;
  return result;
}

/**
 * Get Sentry module (for advanced usage)
 * Returns null if not initialized
 */
export function getSentry() {
  return SentryModule;
}

// Export type-only for compatibility
export type { Sentry } from '@sentry/node';
