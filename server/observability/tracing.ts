import type { SpanAttributes, ObservabilityConfig } from './types';

/**
 * OpenTelemetry Distributed Tracing (Lazy Loading)
 *
 * Provides distributed tracing for performance monitoring and debugging:
 * - Auto-instrumentation for HTTP, Express, PostgreSQL
 * - Manual span creation for custom operations
 * - Trace context propagation across async boundaries
 * - Integration with Sentry for unified observability
 *
 * IMPORTANT: All OpenTelemetry imports are lazy-loaded to avoid requiring
 * @opentelemetry/* dependencies when tracing is disabled.
 */

// Lazy-loaded modules
let OtelAPI: typeof import('@opentelemetry/api') | null = null;
let NodeSDKModule: typeof import('@opentelemetry/sdk-node') | null = null;
let ResourceModule: typeof import('@opentelemetry/resources') | null = null;
let SemanticConventions: typeof import('@opentelemetry/semantic-conventions') | null = null;
let AutoInstrumentations: typeof import('@opentelemetry/auto-instrumentations-node') | null = null;
let OTLPExporter: typeof import('@opentelemetry/exporter-trace-otlp-http') | null = null;
let ConsoleExporter: typeof import('@opentelemetry/sdk-trace-node') | null = null;

let sdk: any | null = null;
let isInitialized = false;

/**
 * Lazy load OpenTelemetry modules
 */
async function loadOpenTelemetry() {
  if (OtelAPI) {
    return; // Already loaded
  }

  try {
    console.log('[TRACING] Lazy loading OpenTelemetry modules...');

    OtelAPI = await import('@opentelemetry/api');
    NodeSDKModule = await import('@opentelemetry/sdk-node');
    ResourceModule = await import('@opentelemetry/resources');
    SemanticConventions = await import('@opentelemetry/semantic-conventions');
    AutoInstrumentations = await import('@opentelemetry/auto-instrumentations-node');
    OTLPExporter = await import('@opentelemetry/exporter-trace-otlp-http');
    ConsoleExporter = await import('@opentelemetry/sdk-trace-node');

    console.log('[TRACING] OpenTelemetry modules loaded successfully');
  } catch (error) {
    console.error('[TRACING] Failed to load OpenTelemetry modules:', error);
    throw error;
  }
}

/**
 * Get OpenTelemetry configuration from environment variables
 */
export function getTracingConfig(): ObservabilityConfig['tracing'] {
  return {
    enabled: process.env.OTEL_ENABLED === 'true', // Disabled by default to avoid dependency issues
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
export async function initializeTracing(): Promise<boolean> {
  const config = getTracingConfig();

  // Skip if already initialized
  if (isInitialized) {
    console.log('[TRACING] Already initialized');
    return true;
  }

  // Skip if disabled
  if (!config.enabled) {
    console.log('[TRACING] Disabled (OTEL_ENABLED=false or not set)');
    return false;
  }

  try {
    // Lazy load OpenTelemetry modules
    await loadOpenTelemetry();

    if (!NodeSDKModule || !ResourceModule || !SemanticConventions || !AutoInstrumentations || !OTLPExporter || !ConsoleExporter) {
      throw new Error('Failed to load required OpenTelemetry modules');
    }

    // Configure resource (service metadata)
    const resource = new ResourceModule.Resource({
      [SemanticConventions.SEMRESATTRS_SERVICE_NAME]: config.serviceName,
      [SemanticConventions.SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
    });

    // Configure exporter based on environment
    let traceExporter;

    if (process.env.NODE_ENV === 'production' && config.exporterEndpoint) {
      // Production: Send to OTLP collector or Sentry
      traceExporter = new OTLPExporter.OTLPTraceExporter({
        url: config.exporterEndpoint,
      });
      console.log(`[TRACING] Using OTLP exporter: ${config.exporterEndpoint}`);
    } else if (process.env.NODE_ENV === 'development') {
      // Development: Console output for debugging
      traceExporter = new ConsoleExporter.ConsoleSpanExporter();
      console.log('[TRACING] Using console exporter (development mode)');
    } else {
      // Staging/other: Use OTLP if configured, otherwise console
      traceExporter = config.exporterEndpoint
        ? new OTLPExporter.OTLPTraceExporter({ url: config.exporterEndpoint })
        : new ConsoleExporter.ConsoleSpanExporter();
    }

    // Initialize OpenTelemetry SDK
    sdk = new NodeSDKModule.NodeSDK({
      resource,
      traceExporter,

      // Auto-instrumentations
      instrumentations: [
        AutoInstrumentations.getNodeAutoInstrumentations({
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
  if (!isInitialized || !OtelAPI) {
    return undefined;
  }
  return OtelAPI.trace.getTracer(name);
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
export function startSpan(name: string, attributes?: SpanAttributes): any | undefined {
  if (!isInitialized || !OtelAPI) {
    return undefined;
  }

  const tracer = getTracer();
  if (!tracer) {
    return undefined;
  }

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
  if (!isInitialized || !OtelAPI) {
    // If tracing disabled, just execute the function
    return fn();
  }

  const tracer = getTracer();
  if (!tracer) {
    return fn();
  }

  return tracer.startActiveSpan(name, { attributes: attributes as any }, async (span: any) => {
    try {
      const result = await fn();
      span.setStatus({ code: OtelAPI!.SpanStatusCode.OK });
      span.end();
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: OtelAPI!.SpanStatusCode.ERROR,
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
  if (!isInitialized || !OtelAPI) {
    return fn();
  }

  const tracer = getTracer();
  if (!tracer) {
    return fn();
  }

  return tracer.startActiveSpan(name, { attributes: attributes as any }, (span: any) => {
    try {
      const result = fn();
      span.setStatus({ code: OtelAPI!.SpanStatusCode.OK });
      span.end();
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: OtelAPI!.SpanStatusCode.ERROR,
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
  if (!isInitialized || !OtelAPI) {
    return;
  }

  const activeSpan = OtelAPI.trace.getActiveSpan();
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
  if (!isInitialized || !OtelAPI) {
    return;
  }

  const activeSpan = OtelAPI.trace.getActiveSpan();
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
  if (!isInitialized || !OtelAPI) {
    return;
  }

  const activeSpan = OtelAPI.trace.getActiveSpan();
  if (activeSpan) {
    activeSpan.recordException(error);
    activeSpan.setStatus({
      code: OtelAPI.SpanStatusCode.ERROR,
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
  if (!isInitialized || !OtelAPI) {
    return undefined;
  }

  const activeSpan = OtelAPI.trace.getActiveSpan();
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

// Export type-only references (no runtime imports)
export type { SpanAttributes };
