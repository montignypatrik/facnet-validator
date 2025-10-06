/**
 * Observability Module - Production Error Tracking & Performance Monitoring
 *
 * This module provides comprehensive observability for the Quebec healthcare
 * billing validation system with PHI compliance as the top priority.
 *
 * Features:
 * - Sentry error tracking with automatic PHI sanitization
 * - OpenTelemetry distributed tracing for performance monitoring
 * - Auto-instrumentation for HTTP, Express, and PostgreSQL
 * - Integration with existing validation logger
 *
 * Usage:
 * ```typescript
 * import { initializeSentry, initializeTracing } from './observability';
 *
 * // CRITICAL: Initialize FIRST in server/index.ts
 * initializeSentry();
 * initializeTracing();
 * ```
 */

// Sentry error tracking
export {
  initializeSentry,
  isSentryInitialized,
  getSentryConfig,
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser,
  setTag,
  setTags,
  startTransaction,
  flush,
  close,
  Sentry,
} from './sentry';

// OpenTelemetry tracing
export {
  initializeTracing,
  isTracingInitialized,
  getTracingConfig,
  getTracer,
  startSpan,
  withSpan,
  withSpanSync,
  addSpanEvent,
  setSpanAttributes,
  recordException,
  getCurrentTraceContext,
  shutdownTracing,
  trace,
  Span,
  SpanStatusCode,
  context,
  Context,
} from './tracing';

// PHI sanitization (for testing and verification)
export {
  isAllowedMetadataKey,
  sanitizeErrorContext,
  sanitizeBreadcrumb,
  sanitizeEventContext,
  sanitizeEventData,
  detectPHIFields,
} from './sanitizer';

// TypeScript types
export type {
  SpanAttributes,
  ObservabilityConfig,
  ObservabilityHealth,
  TracingContext,
  ErrorCaptureOptions,
  BreadcrumbData,
} from './types';
