import express, { type Router } from 'express';
import { isSentryInitialized } from './sentry';
import { isTracingInitialized } from './tracing';

/**
 * Observability Health Check Routes
 *
 * Provides endpoints for monitoring Sentry and OpenTelemetry status.
 * Used for debugging observability configuration and verifying setup.
 */

const router: Router = express.Router();

/**
 * GET /api/observability/health
 *
 * Returns the health status of observability systems (Sentry + OpenTelemetry)
 * Public endpoint for monitoring and health checks
 */
router.get('/health', async (req, res) => {
  const sentryEnabled = isSentryInitialized();
  const tracingEnabled = isTracingInitialized();

  const health = {
    sentry: {
      enabled: sentryEnabled,
      status: sentryEnabled ? 'operational' : 'disabled',
    },
    tracing: {
      enabled: tracingEnabled,
      status: tracingEnabled ? 'operational' : 'disabled',
    },
    overall: sentryEnabled && tracingEnabled ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
  };

  res.json(health);
});

/**
 * GET /api/observability/config
 *
 * Returns observability configuration (development only)
 * Shows sampling rates, environment, and enabled features
 *
 * SECURITY: Only accessible in development environment
 */
router.get('/config', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Configuration endpoint only available in development',
    });
  }

  const config = {
    environment: process.env.SENTRY_ENVIRONMENT || 'development',
    sentry: {
      enabled: isSentryInitialized(),
      dsn: process.env.SENTRY_DSN ? '***configured***' : 'not set',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '1.0'),
    },
    tracing: {
      enabled: isTracingInitialized(),
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'not set',
    },
    features: {
      phiSanitization: true,
      errorTracking: isSentryInitialized(),
      distributedTracing: isTracingInitialized(),
      breadcrumbs: isSentryInitialized(),
    },
  };

  res.json(config);
});

export default router;
