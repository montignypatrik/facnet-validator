import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { trace, Span, SpanStatusCode, context, Context } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import type { SpanAttributes, ObservabilityConfig } from './types';

/**
 * OpenTelemetry Distributed Tracing
 *
 * Provides distributed tracing for performance monitoring and debugging:
 * - Auto-instrumentation for HTTP, Express, PostgreSQL
 * - Manual span creation for custom operations
 * - Trace context propagation across async boundaries
 * - Integration with Sentry for unified observability
 */

let sdk: NodeSDK | null = null;
let isInitialized = false;

/**
 * Get OpenTelemetry configuration from environment variables
 */
export function getTracingConfig(): ObservabilityConfig['tracing'] {
  return {
    enabled: process.env.OTEL_ENABLED !== 'false', // Enabled by default
    serviceName: process.env.OTEL_SERVICE_NAME || 'dash-validateur',
    exporterEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    sampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  };
}

/**
 * Initialize OpenTelemetry SDK with auto-instrumentation
 *
 * Auto-instruments:
 * - HTTP requests and responses
 * - Express routes
 * - PostgreSQL queries (via pg driver under Drizzle)
 *
 * @returns true if initialized successfully, false otherwise
 */
export function initializeTracing(): boolean {
  const config = getTracingConfig();

  // Skip if already initialized
  if (isInitialized) {
    console.log('[TRACING] Already initialized');
    return true;
  }

  // Skip if disabled
  if (!config.enabled) {
    console.log('[TRACING] Disabled (OTEL_ENABLED=false)');
    return false;
  }

  try {
    // Configure resource (service metadata)
    const resource = new Resource({
      [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
    });

    // Configure exporter based on environment
    let traceExporter;

    if (process.env.NODE_ENV === 'production' && config.exporterEndpoint) {
      // Production: Send to OTLP collector or Sentry
      traceExporter = new OTLPTraceExporter({
        url: config.exporterEndpoint,
      });
      console.log(`[TRACING] Using OTLP exporter: ${config.exporterEndpoint}`);
    } else if (process.env.NODE_ENV === 'development') {
      // Development: Console output for debugging
      traceExporter = new ConsoleSpanExporter();
      console.log('[TRACING] Using console exporter (development mode)');
    } else {
      // Staging/other: Use OTLP if configured, otherwise console
      traceExporter = config.exporterEndpoint
        ? new OTLPTraceExporter({ url: config.exporterEndpoint })
        : new ConsoleSpanExporter();
    }

    // Initialize OpenTelemetry SDK
    sdk = new NodeSDK({
      resource,
      traceExporter,

      // Auto-instrumentations
      instrumentations: [
        getNodeAutoInstrumentations({
          // Enable/disable specific instrumentations
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // Disable file system tracing (too noisy)
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-express': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-pg': {
            enabled: true, // PostgreSQL via Drizzle
          },
        }),
      ],
    });

    // Start the SDK
    sdk.start();

    isInitialized = true;
    console.log(`[TRACING] Initialized successfully (service: ${config.serviceName}, sample rate: ${config.sampleRate})`);
    return true;

  } catch (error) {
    console.error('[TRACING] Failed to initialize:', error);
    return false;
  }
}

/**
 * Check if tracing is initialized
 */
export function isTracingInitialized(): boolean {
  return isInitialized;
}

/**
 * Get the tracer instance
 */
export function getTracer(name: string = 'dash-validateur') {
  return trace.getTracer(name);
}

/**
 * Start a new span for tracing an operation
 *
 * @param name - Span name (e.g., "csv.parse", "validation.run")
 * @param attributes - Span attributes (PHI-safe metadata)
 * @returns Span object or undefined if tracing not initialized
 *
 * @example
 * const span = startSpan('csv.parse', { fileName: 'data.csv', fileSize: 1024 });
 * try {
 *   // ... operation ...
 *   span.end();
 * } catch (error) {
 *   span.recordException(error);
 *   span.setStatus({ code: SpanStatusCode.ERROR });
 *   span.end();
 *   throw error;
 * }
 */
export function startSpan(name: string, attributes?: SpanAttributes): Span | undefined {
  if (!isInitialized) {
    return undefined;
  }

  const tracer = getTracer();
  const span = tracer.startSpan(name, {
    attributes: attributes as Record<string, string | number | boolean>,
  });

  return span;
}

/**
 * Execute a function within a span (automatic span lifecycle management)
 *
 * This is the recommended way to create spans as it automatically handles:
 * - Span start/end
 * - Exception recording
 * - Status code setting
 * - Context propagation
 *
 * @param name - Span name
 * @param attributes - Span attributes (PHI-safe metadata)
 * @param fn - Function to execute within the span
 * @returns Result of the function
 *
 * @example
 * const result = await withSpan('csv.parse', { fileName: 'data.csv' }, async () => {
 *   return await parseCSV(filePath);
 * });
 */
export async function withSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: () => Promise<T>
): Promise<T> {
  if (!isInitialized) {
    // If tracing disabled, just execute the function
    return fn();
  }

  const tracer = getTracer();
  return tracer.startActiveSpan(name, { attributes: attributes as any }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      span.end();
      throw error;
    }
  });
}

/**
 * Execute a synchronous function within a span
 */
export function withSpanSync<T>(
  name: string,
  attributes: SpanAttributes,
  fn: () => T
): T {
  if (!isInitialized) {
    return fn();
  }

  const tracer = getTracer();
  return tracer.startActiveSpan(name, { attributes: attributes as any }, (span) => {
    try {
      const result = fn();
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (error as Error).message,
      });
      span.end();
      throw error;
    }
  });
}

/**
 * Add an event to the current span
 *
 * Events are timestamped logs attached to spans
 *
 * @param name - Event name
 * @param attributes - Event attributes (PHI-safe)
 */
export function addSpanEvent(name: string, attributes?: Record<string, any>): void {
  if (!isInitialized) {
    return;
  }

  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.addEvent(name, attributes);
  }
}

/**
 * Set attributes on the current active span
 *
 * @param attributes - Attributes to add (PHI-safe)
 */
export function setSpanAttributes(attributes: SpanAttributes): void {
  if (!isInitialized) {
    return;
  }

  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.setAttributes(attributes as Record<string, string | number | boolean>);
  }
}

/**
 * Record an exception in the current active span
 *
 * @param error - Error to record
 */
export function recordException(error: Error): void {
  if (!isInitialized) {
    return;
  }

  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.recordException(error);
    activeSpan.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    });
  }
}

/**
 * Get the current trace context
 *
 * Useful for logging trace IDs with errors
 */
export function getCurrentTraceContext(): { traceId?: string; spanId?: string } | undefined {
  if (!isInitialized) {
    return undefined;
  }

  const activeSpan = trace.getActiveSpan();
  if (!activeSpan) {
    return undefined;
  }

  const spanContext = activeSpan.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

/**
 * Shutdown OpenTelemetry SDK
 *
 * Should be called during application shutdown to flush pending spans
 */
export async function shutdownTracing(): Promise<void> {
  if (!isInitialized || !sdk) {
    return;
  }

  console.log('[TRACING] Shutting down...');
  try {
    await sdk.shutdown();
    isInitialized = false;
    console.log('[TRACING] Shutdown complete');
  } catch (error) {
    console.error('[TRACING] Error during shutdown:', error);
  }
}

// Export OpenTelemetry API for direct access when needed
export { trace, Span, SpanStatusCode, context, Context };
