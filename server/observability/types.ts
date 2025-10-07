/**
 * TypeScript Types for Observability System
 *
 * Defines interfaces for Sentry error tracking and OpenTelemetry tracing
 */

/**
 * Span attributes for OpenTelemetry tracing
 *
 * PHI-SAFE: Only technical metadata, no patient or doctor information
 */
export interface SpanAttributes {
  // Identifiers (non-PHI)
  validationRunId?: string;
  jobId?: string;
  userId?: string;
  ruleId?: string;

  // File metadata
  fileName?: string;
  fileSize?: number;
  encoding?: string;
  delimiter?: string;

  // Processing metadata
  rowCount?: number;
  rowNumber?: number;
  totalRows?: number;
  batchSize?: number;
  batchIndex?: number;

  // Validation metadata
  ruleCount?: number;
  ruleName?: string;
  violationCount?: number;
  errorCount?: number;
  warningCount?: number;

  // Performance metadata
  duration?: number;
  progress?: number;

  // Operation metadata
  operation?: string;
  module?: string;
  source?: string;

  // Error metadata
  errorType?: string;
  errorCode?: string;
  errorMessage?: string;

  // Status
  status?: 'success' | 'error' | 'warning';

  // Extensible for future attributes
  [key: string]: string | number | boolean | undefined;
}

/**
 * Observability configuration
 */
export interface ObservabilityConfig {
  // Sentry configuration
  sentry: {
    enabled: boolean;
    dsn?: string;
    environment: string;
    tracesSampleRate: number;
    profilesSampleRate: number;
    debug?: boolean;
  };

  // OpenTelemetry configuration
  tracing: {
    enabled: boolean;
    serviceName: string;
    exporterEndpoint?: string;
    sampleRate: number;
  };
}

/**
 * Observability health status
 */
export interface ObservabilityHealth {
  sentry: {
    enabled: boolean;
    initialized: boolean;
    environment: string;
    dsn: string; // Masked (only show if configured)
  };

  tracing: {
    enabled: boolean;
    initialized: boolean;
    sampleRate: number;
    serviceName: string;
  };

  recentErrors?: Array<{
    timestamp: Date;
    level: string;
    source: string;
    message: string;
  }>;
}

/**
 * Tracing context for propagating trace information
 */
export interface TracingContext {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  sampled?: boolean;
}

/**
 * Error capture options for Sentry
 */
export interface ErrorCaptureOptions {
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
  tags?: Record<string, string>;
  extra?: Record<string, any>; // Will be sanitized before sending
  user?: {
    id?: string;
    // No email, username, or other PII
  };
  contexts?: Record<string, Record<string, any>>;
}

/**
 * Breadcrumb data for Sentry debugging
 */
export interface BreadcrumbData {
  category: string;
  message: string;
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
  data?: Record<string, any>; // Will be sanitized before sending
  timestamp?: number;
}
