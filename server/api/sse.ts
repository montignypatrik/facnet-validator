import { Request, Response } from 'express';
import { storage } from '../core/storage';
import { getJobStatus } from '../queue/validationQueue';
import { getNAMJobStatus } from '../queue/namExtractionQueue';
import { db } from '../core/db';
import { namExtractionRuns } from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Server-Sent Events (SSE) Support
 *
 * Provides real-time updates for validation and NAM extraction jobs using SSE protocol.
 * Clients can subscribe to updates and receive progress notifications.
 */

/**
 * Create an SSE connection for real-time validation updates
 *
 * Establishes a long-lived HTTP connection that streams validation status
 * updates to the client every 2 seconds until the validation completes or fails.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param validationId - The ID of the validation run to monitor
 */
export function createSSEConnection(req: Request, res: Response, validationId: string): void {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Enable CORS for SSE if needed
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  console.log(`[SSE] Client connected for validation ${validationId}`);

  // Send initial connection message
  sendSSEMessage(res, {
    type: 'connected',
    validationId,
    timestamp: Date.now(),
  });

  let pollCount = 0;
  const MAX_POLL_COUNT = 1800; // 1 hour at 2-second intervals

  // Poll validation status every 2 seconds
  const interval = setInterval(async () => {
    try {
      pollCount++;

      // Safety timeout - disconnect after 1 hour
      if (pollCount > MAX_POLL_COUNT) {
        console.log(`[SSE] Max poll count reached for validation ${validationId}`);
        sendSSEMessage(res, {
          type: 'timeout',
          message: 'Connection timed out after 1 hour',
        });
        clearInterval(interval);
        res.end();
        return;
      }

      // Get validation run from database
      const run = await storage.getValidationRun(validationId);

      if (!run) {
        console.log(`[SSE] Validation ${validationId} not found`);
        sendSSEMessage(res, {
          type: 'error',
          message: 'Validation not found',
        });
        clearInterval(interval);
        res.end();
        return;
      }

      // Get job status from BullMQ if jobId exists
      let jobState: string | null = null;
      let jobProgress: number | null = null;

      if (run.jobId) {
        try {
          const jobStatus = await getJobStatus(run.jobId);
          if (jobStatus) {
            jobState = jobStatus.state;
            jobProgress = typeof jobStatus.progress === 'number' ? jobStatus.progress : null;
          }
        } catch (jobError) {
          console.error(`[SSE] Error getting job status for ${run.jobId}:`, jobError);
          // Continue with database status only
        }
      }

      // Send progress update
      sendSSEMessage(res, {
        type: 'progress',
        status: run.status,
        progress: Number(run.progress || 0),
        jobState: jobState || undefined,
        jobProgress: jobProgress || undefined,
        timestamp: Date.now(),
      });

      // End stream if completed or failed
      if (run.status === 'completed' || run.status === 'failed') {
        console.log(`[SSE] Validation ${validationId} finished with status: ${run.status}`);
        sendSSEMessage(res, {
          type: 'completed',
          status: run.status,
          errorMessage: run.errorMessage || undefined,
          timestamp: Date.now(),
        });
        clearInterval(interval);
        res.end();
      }
    } catch (error) {
      console.error(`[SSE] Error sending update for validation ${validationId}:`, error);
      sendSSEMessage(res, {
        type: 'error',
        message: 'Internal server error',
      });
      clearInterval(interval);
      res.end();
    }
  }, 2000);

  // Cleanup on client disconnect
  req.on('close', () => {
    console.log(`[SSE] Client disconnected from validation ${validationId}`);
    clearInterval(interval);
    res.end();
  });

  // Handle errors
  req.on('error', (error) => {
    console.error(`[SSE] Request error for validation ${validationId}:`, error);
    clearInterval(interval);
    res.end();
  });

  res.on('error', (error) => {
    console.error(`[SSE] Response error for validation ${validationId}:`, error);
    clearInterval(interval);
    res.end();
  });
}

/**
 * Create an SSE connection for real-time NAM extraction updates
 *
 * Establishes a long-lived HTTP connection that streams NAM extraction status
 * updates to the client every 2 seconds until the extraction completes or fails.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param runId - The ID of the NAM extraction run to monitor
 */
export function createNAMExtractionSSEConnection(req: Request, res: Response, runId: string): void {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Enable CORS for SSE if needed
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  console.log(`[SSE] Client connected for NAM extraction ${runId}`);

  // Send initial connection message
  sendSSEMessage(res, {
    type: 'connected',
    runId,
    timestamp: Date.now(),
  });

  let pollCount = 0;
  const MAX_POLL_COUNT = 1800; // 1 hour at 2-second intervals

  // Poll NAM extraction status every 2 seconds
  const interval = setInterval(async () => {
    try {
      pollCount++;

      // Safety timeout - disconnect after 1 hour
      if (pollCount > MAX_POLL_COUNT) {
        console.log(`[SSE] Max poll count reached for NAM extraction ${runId}`);
        sendSSEMessage(res, {
          type: 'timeout',
          message: 'Connection timed out after 1 hour',
        });
        clearInterval(interval);
        res.end();
        return;
      }

      // Get NAM extraction run from database
      const run = await db.query.namExtractionRuns.findFirst({
        where: eq(namExtractionRuns.id, runId),
      });

      if (!run) {
        console.log(`[SSE] NAM extraction ${runId} not found`);
        sendSSEMessage(res, {
          type: 'error',
          message: 'NAM extraction not found',
        });
        clearInterval(interval);
        res.end();
        return;
      }

      // Get job status from BullMQ if jobId exists
      let jobState: string | null = null;
      let jobProgress: number | null = null;

      if (run.jobId) {
        try {
          const jobStatus = await getNAMJobStatus(run.jobId);
          if (jobStatus) {
            jobState = jobStatus.state;
            jobProgress = typeof jobStatus.progress === 'number' ? jobStatus.progress : null;
          }
        } catch (jobError) {
          console.error(`[SSE] Error getting job status for ${run.jobId}:`, jobError);
          // Continue with database status only
        }
      }

      // Send progress update with stage information
      sendSSEMessage(res, {
        type: 'progress',
        status: run.status,
        stage: run.stage || undefined,
        progress: Number(run.progress || 0),
        pageCount: run.pageCount || undefined,
        namsFound: run.namsFound || undefined,
        namsValid: run.namsValid || undefined,
        jobState: jobState || undefined,
        jobProgress: jobProgress || undefined,
        timestamp: Date.now(),
      });

      // End stream if completed or failed
      if (run.status === 'completed' || run.status === 'failed') {
        console.log(`[SSE] NAM extraction ${runId} finished with status: ${run.status}`);
        sendSSEMessage(res, {
          type: 'completed',
          status: run.status,
          errorMessage: run.errorMessage || undefined,
          errorCode: run.errorCode || undefined,
          namsFound: run.namsFound || undefined,
          namsValid: run.namsValid || undefined,
          timestamp: Date.now(),
        });
        clearInterval(interval);
        res.end();
      }
    } catch (error) {
      console.error(`[SSE] Error sending update for NAM extraction ${runId}:`, error);
      sendSSEMessage(res, {
        type: 'error',
        message: 'Internal server error',
      });
      clearInterval(interval);
      res.end();
    }
  }, 2000);

  // Cleanup on client disconnect
  req.on('close', () => {
    console.log(`[SSE] Client disconnected from NAM extraction ${runId}`);
    clearInterval(interval);
    res.end();
  });

  // Handle errors
  req.on('error', (error) => {
    console.error(`[SSE] Request error for NAM extraction ${runId}:`, error);
    clearInterval(interval);
    res.end();
  });

  res.on('error', (error) => {
    console.error(`[SSE] Response error for NAM extraction ${runId}:`, error);
    clearInterval(interval);
    res.end();
  });
}

/**
 * Send an SSE message to the client
 *
 * Formats the data as SSE protocol requires (data: prefix, double newline)
 *
 * @param res - Express response object
 * @param data - Data object to send (will be JSON stringified)
 */
function sendSSEMessage(res: Response, data: any): void {
  try {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    res.write(message);
  } catch (error) {
    console.error('[SSE] Error writing SSE message:', error);
  }
}
