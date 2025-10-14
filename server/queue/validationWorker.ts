import { Worker, Job } from 'bullmq';
import path from 'path';
import fs from 'fs';
import { getRedisClient } from './redis';
import { ValidationJobData, moveToDeadLetter } from './validationQueue';
import { BillingCSVProcessor } from '../modules/validateur/validation/csvProcessor';
import { storage } from '../core/storage';
import { logger } from '../modules/validateur/logger';
import { withSpan } from '../observability';

/**
 * Validation Worker
 *
 * Processes CSV validation jobs from the queue.
 * Handles progress updates, error handling, intelligent retry logic, and cleanup.
 */

let worker: Worker<ValidationJobData> | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

const uploadDir = path.join(process.cwd(), 'uploads');

const HEARTBEAT_KEY = 'worker:validation:heartbeat';
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const HEARTBEAT_TTL_SECONDS = 120; // 2 minutes

/**
 * Start heartbeat monitoring
 *
 * Stores a timestamp in Redis every 30 seconds to indicate the worker is alive.
 * The heartbeat expires after 2 minutes if not refreshed.
 */
function startHeartbeat(): void {
  if (heartbeatInterval) {
    return; // Already started
  }

  const updateHeartbeat = async () => {
    try {
      const redis = getRedisClient();
      await redis.set(HEARTBEAT_KEY, Date.now().toString(), 'EX', HEARTBEAT_TTL_SECONDS);
      console.log('[WORKER] Heartbeat updated');
    } catch (error) {
      console.error('[WORKER] Error updating heartbeat:', error);
    }
  };

  // Update immediately on start
  updateHeartbeat();

  // Update every 30 seconds
  heartbeatInterval = setInterval(updateHeartbeat, HEARTBEAT_INTERVAL_MS);
  console.log('[WORKER] Heartbeat monitoring started');
}

/**
 * Stop heartbeat monitoring
 */
function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('[WORKER] Heartbeat monitoring stopped');
  }
}

/**
 * Get worker status from heartbeat
 *
 * @returns Worker status information
 */
export async function getWorkerStatus(): Promise<{
  status: 'running' | 'stopped' | 'unknown';
  lastHeartbeat: number | null;
  timeSinceHeartbeat: number | null;
}> {
  try {
    const redis = getRedisClient();
    const heartbeat = await redis.get(HEARTBEAT_KEY);

    if (!heartbeat) {
      return {
        status: 'stopped',
        lastHeartbeat: null,
        timeSinceHeartbeat: null,
      };
    }

    const lastHeartbeat = parseInt(heartbeat, 10);
    const now = Date.now();
    const timeSinceHeartbeat = now - lastHeartbeat;

    // Consider worker stopped if heartbeat is older than 2 minutes
    const status = timeSinceHeartbeat > HEARTBEAT_TTL_SECONDS * 1000 ? 'stopped' : 'running';

    return {
      status,
      lastHeartbeat,
      timeSinceHeartbeat,
    };
  } catch (error) {
    console.error('[WORKER] Error getting worker status:', error);
    return {
      status: 'unknown',
      lastHeartbeat: null,
      timeSinceHeartbeat: null,
    };
  }
}

/**
 * Process a validation job
 */
async function processValidationJob(job: Job<ValidationJobData>): Promise<void> {
  const { validationRunId, fileName } = job.data;

  console.log(`[WORKER] Processing validation job ${job.id} for run ${validationRunId}`);

  // Wrap entire job processing in a span for end-to-end tracing
  return withSpan('job.validation.process', {
    jobId: job.id,
    validationRunId,
    fileName,
  }, async () => {
    try {
      const filePath = path.join(uploadDir, fileName);

      // Verify file exists
      if (!fs.existsSync(filePath)) {
        await logger.error(validationRunId, 'worker', `File not found: ${fileName}`);
        throw new Error(`File not found: ${filePath}`);
      }

      const stats = fs.statSync(filePath);
      await logger.info(validationRunId, 'worker', 'Starting validation processing', {
        fileName,
        fileSize: stats.size,
        jobId: job.id,
      });

    // Update status to processing and store job ID
    await storage.updateValidationRun(validationRunId, {
      status: 'processing',
      jobId: job.id,
    });

    // Create CSV processor
    const processor = new BillingCSVProcessor();

    // Process CSV with progress callback
    const { records, errors } = await processor.processBillingCSV(
      filePath,
      validationRunId,
      async (progress: number) => {
        // Update job progress
        await job.updateProgress(progress);

        // Update database progress
        await storage.updateValidationRun(validationRunId, {
          progress: progress.toString(),
        });

        await logger.debug(validationRunId, 'worker', `Progress: ${progress}%`, {
          progress,
        });
      }
    );

    // Save billing records to database
    if (records.length > 0) {
      await logger.info(validationRunId, 'worker', `Saving ${records.length} billing records`, {
        rowCount: records.length,
      });
      await storage.createBillingRecords(records);
      await logger.info(validationRunId, 'worker', 'Billing records saved successfully', {
        rowCount: records.length,
      });
    }

    // Update progress to 75% (CSV processed and saved)
    await job.updateProgress(75);
    await storage.updateValidationRun(validationRunId, {
      progress: '75',
    });

    // Fetch saved billing records with their database IDs
    const savedRecords = await storage.getBillingRecords(validationRunId);

    // Run validation with records that have database IDs
    const validationResults = await processor.validateBillingRecords(savedRecords, validationRunId);

    // Update progress to 90% (validation complete)
    await job.updateProgress(90);
    await storage.updateValidationRun(validationRunId, {
      progress: '90',
    });

    // Save validation results
    if (validationResults.length > 0) {
      await logger.info(validationRunId, 'worker', `Saving ${validationResults.length} validation results`, {
        violationCount: validationResults.length,
      });
      await storage.createValidationResults(validationResults);
    }

    // Store first 10 issues in Redis for live preview
    if (validationResults.length > 0) {
      const preview = validationResults.slice(0, 10);
      const redis = getRedisClient();
      await redis.set(
        `validation:preview:${validationRunId}`,
        JSON.stringify(preview),
        'EX',
        600 // Expire after 10 minutes
      );
      console.log(`[WORKER] Stored preview of ${preview.length} validation issues in Redis`);
    }

    // Clean up uploaded file after processing
    try {
      fs.unlinkSync(filePath);
      await logger.info(validationRunId, 'worker', 'Deleted CSV file after processing', {
        fileName,
      });
    } catch (err: any) {
      await logger.warn(validationRunId, 'worker', `Could not delete CSV file: ${err.message}`, {
        fileName,
      });
    }

    // Update to completed status with 100% progress
    await storage.updateValidationRun(validationRunId, {
      status: 'completed',
      progress: '100',
    });

      await logger.info(validationRunId, 'worker', 'Validation processing completed successfully');

      // Update final job progress
      await job.updateProgress(100);

      console.log(`[WORKER] Validation job ${job.id} completed successfully`);

    } catch (error: any) {
      console.error(`[WORKER] Validation job ${job.id} failed:`, error);

      await logger.error(validationRunId, 'worker', `Validation processing failed: ${error.message}`, {
        errorType: error.name,
        jobId: job.id,
      });

      const errorMessage = error.message || 'Unknown error during validation processing';

      await storage.updateValidationRun(validationRunId, {
        status: 'failed',
        errorMessage: errorMessage,
      });

      // Re-throw to mark job as failed in BullMQ
      throw error;
    }
  }); // End of withSpan wrapper
}

/**
 * Start the validation worker
 */
export function startWorker(): Worker<ValidationJobData> {
  if (worker) {
    console.log('[WORKER] Worker already running');
    return worker;
  }

  const connection = getRedisClient();

  worker = new Worker<ValidationJobData>(
    'validation',
    async (job: Job<ValidationJobData>) => {
      await processValidationJob(job);
    },
    {
      connection,
      concurrency: 2, // Process 2 jobs concurrently
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 1000 },
    }
  );

  // Worker event handlers
  worker.on('ready', () => {
    console.log('[WORKER] Validation worker ready and waiting for jobs');
  });

  worker.on('active', (job: Job<ValidationJobData>) => {
    console.log(`[WORKER] Started processing job ${job.id}`);
  });

  worker.on('completed', (job: Job<ValidationJobData>) => {
    console.log(`[WORKER] Job ${job.id} completed`);
  });

  worker.on('failed', async (job: Job<ValidationJobData> | undefined, error: Error) => {
    if (!job) return;

    const attemptsMade = job.attemptsMade || 0;
    const maxAttempts = job.opts.attempts || 3;

    console.error(`[WORKER] Job ${job.id} failed (attempt ${attemptsMade}/${maxAttempts}):`, error.message);

    // If all retries exhausted, move to dead letter queue
    if (attemptsMade >= maxAttempts) {
      console.log(`[WORKER] Moving job ${job.id} to dead letter queue after ${attemptsMade} attempts`);
      await moveToDeadLetter(job.id!, error.message);
    }
  });

  worker.on('error', (error: Error) => {
    console.error('[WORKER] Worker error:', error);
  });

  worker.on('stalled', (jobId: string) => {
    console.warn(`[WORKER] Job ${jobId} stalled`);
  });

  console.log('[WORKER] Validation worker started with concurrency 2');

  // Start heartbeat monitoring
  startHeartbeat();

  return worker;
}

/**
 * Stop the worker gracefully
 */
export async function stopWorker(): Promise<void> {
  if (worker) {
    console.log('[WORKER] Stopping validation worker...');

    // Stop heartbeat
    stopHeartbeat();

    await worker.close();
    worker = null;
    console.log('[WORKER] Validation worker stopped');
  }
}

/**
 * Get worker instance (for monitoring)
 */
export function getWorker(): Worker<ValidationJobData> | null {
  return worker;
}
