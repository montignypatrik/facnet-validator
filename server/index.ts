import "dotenv/config";

// CRITICAL: Initialize observability FIRST (before all other imports)
// This ensures Sentry captures all errors including those during app initialization
import { initializeSentry, getSentry, flush as flushSentry, close as closeSentry } from "./observability";

// Initialize observability (async now due to lazy loading)
// NOTE: OpenTelemetry tracing disabled by default to avoid dependency issues
//       Set OTEL_ENABLED=true to enable (requires @opentelemetry dependencies)
await initializeSentry();

// Now import rest of application
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startWorker, stopWorker } from "./queue/validationWorker";
import { closeQueue } from "./queue/validationQueue";
import { closeRedisConnection } from "./queue/redis";
import { warmupCache } from "./cache/index.js";
import { startDocumentWorker, stopDocumentWorker } from "./modules/chatbot/queue/documentWorker";
import { closeDocumentQueue } from "./modules/chatbot/queue/documentQueue";

const app = express();

// Security headers with Helmet (CSP configured for file uploads and Auth0)
const isDevelopment = process.env.NODE_ENV !== "production";

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Only allow unsafe-inline/unsafe-eval in development (required for Vite HMR)
        scriptSrc: [
          "'self'",
          ...(isDevelopment ? ["'unsafe-inline'", "'unsafe-eval'"] : [])
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // Allow Google Fonts
        imgSrc: ["'self'", "data:", "blob:", "https:"], // Allow data URLs and external images
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"], // Allow Google Fonts
        connectSrc: [
          "'self'",
          "https://dev-x63i3b6hf5kch7ab.ca.auth0.com", // Auth0 domain
          ...(isDevelopment ? ["http://localhost:*"] : []), // Local API calls only in dev
        ],
        frameSrc: ["'self'", "https://dev-x63i3b6hf5kch7ab.ca.auth0.com"], // Auth0 login frame
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Allow file uploads
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow CORS
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Sentry error handler MUST be registered AFTER all routes but BEFORE custom error handler
  const Sentry = getSentry();
  if (Sentry) {
    app.use(Sentry.Handlers.errorHandler());
  }

  // Custom error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });

    // Error already captured by Sentry middleware above
    // Just log it to console as well
    if (status >= 500) {
      console.error('[ERROR]', message, err);
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Initialize background job workers
  console.log('[STARTUP] Starting validation worker...');
  startWorker();
  console.log('[STARTUP] Validation worker initialized');

  console.log('[STARTUP] Starting document processing worker...');
  startDocumentWorker();
  console.log('[STARTUP] Document processing worker initialized');

  // Warm up cache with reference data
  try {
    await warmupCache();
  } catch (error) {
    console.error('[STARTUP] Cache warm-up failed, continuing with cold cache:', error.message);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, "localhost", () => {
    log(`serving on port ${port}`);
  });

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n[SHUTDOWN] ${signal} received, shutting down gracefully...`);

    // Stop accepting new requests
    server.close(async () => {
      console.log('[SHUTDOWN] HTTP server closed');

      // Stop workers and close queues
      try {
        await stopWorker();
        await stopDocumentWorker();
        await closeQueue();
        await closeDocumentQueue();
        await closeRedisConnection();
        console.log('[SHUTDOWN] Background jobs and Redis connection closed');
      } catch (error) {
        console.error('[SHUTDOWN] Error during cleanup:', error);
      }

      // Flush Sentry events before shutdown (ensure all errors are sent)
      try {
        console.log('[SHUTDOWN] Flushing Sentry events...');
        await flushSentry(2000); // 2 second timeout
        await closeSentry(1000); // Close Sentry client
        console.log('[SHUTDOWN] Sentry events flushed');
      } catch (error) {
        console.error('[SHUTDOWN] Error flushing Sentry:', error);
      }

      // OpenTelemetry tracing disabled by default (uncomment to enable)
      // try {
      //   console.log('[SHUTDOWN] Shutting down tracing...');
      //   await shutdownTracing();
      //   console.log('[SHUTDOWN] Tracing shutdown complete');
      // } catch (error) {
      //   console.error('[SHUTDOWN] Error shutting down tracing:', error);
      // }

      console.log('[SHUTDOWN] Shutdown complete');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('[SHUTDOWN] Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
})();
