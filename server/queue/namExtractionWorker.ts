import { Worker, Job } from 'bullmq';
import { getRedisClient } from './redis';
import { NAMExtractionJobData } from './namExtractionQueue';
import { processDocument } from '../modules/nam-extraction/services/extractionPipeline';

/**
 * NAM Extraction Worker
 *
 * Processes NAM extraction jobs from PDFs using AWS Textract and OpenAI GPT-4.
 * Handles progress updates, error handling, and cleanup.
 */

let worker: Worker<NAMExtractionJobData> | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

const HEARTBEAT_KEY = 'worker:nam-extraction:heartbeat';
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds
const HEARTBEAT_TTL_SECONDS = 120; // 2 minutes

/**
 * Start heartbeat monitoring
 *
 * Stores a timestamp in Redis every 30 seconds to indicate the worker is alive.
 */
function startHeartbeat(): void {
  if (heartbeatInterval) {
    return; // Already started
  }

  const updateHeartbeat = async () => {
    try {
      const redis = getRedisClient();
      await redis.set(HEARTBEAT_KEY, Date.now().toString(), 'EX', HEARTBEAT_TTL_SECONDS);
      console.log('[NAM WORKER] Heartbeat updated');
    } catch (error) {
      console.error('[NAM WORKER] Error updating heartbeat:', error);
    }
  };

  // Update immediately on start
  updateHeartbeat();

  // Update every 30 seconds
  heartbeatInterval = setInterval(updateHeartbeat, HEARTBEAT_INTERVAL_MS);
  console.log('[NAM WORKER] Heartbeat monitoring started');
}

/**
 * Stop heartbeat monitoring
 */
function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('[NAM WORKER] Heartbeat monitoring stopped');
  }
}

/**
 * Get worker status from heartbeat
 */
export async function getNAMWorkerStatus(): Promise<{
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
    console.error('[NAM WORKER] Error getting worker status:', error);
    return {
      status: 'unknown',
      lastHeartbeat: null,
      timeSinceHeartbeat: null,
    };
  }
}

/**
 * Process a NAM extraction job
 *
 * Calls the extraction pipeline to:
 * 1. Extract text from PDF with AWS Textract
 * 2. Extract NAMs with OpenAI GPT-4
 * 3. Validate NAM formats
 * 4. Save results to database
 * 5. Clean up uploaded PDF file
 */
async function processNAMExtractionJob(job: Job<NAMExtractionJobData>): Promise<void> {
  const { runId, pdfPath, fileName } = job.data;

  console.log(`[NAM WORKER] Processing NAM extraction job ${job.id} for run ${runId}`);

  try {
    console.log(`[NAM WORKER] Starting NAM extraction for: ${fileName} (runId: ${runId})`);

    // Update job progress to 5% (job started)
    await job.updateProgress(5);

    // Process the document through the extraction pipeline
    // The pipeline handles all stages and database updates internally
    const result = await processDocument(runId, pdfPath, fileName);

    // Update final job progress
    await job.updateProgress(100);

    console.log(
      `[NAM WORKER] NAM extraction completed for ${fileName}: ${result.nams?.length || 0} NAMs found ` +
      `in ${result.processingTimeMs}ms`
    );

    console.log(`[NAM WORKER] NAM extraction job ${job.id} completed successfully`);

  } catch (error: any) {
    console.error(`[NAM WORKER] NAM extraction job ${job.id} failed:`, error);
    console.error(`[NAM WORKER] NAM extraction failed for ${fileName}: ${error.message}`, error);

    // Re-throw to mark job as failed in BullMQ
    // The extraction pipeline already updated the database with failure status
    throw error;
  }
}

/**
 * Start the NAM extraction worker
 */
export function startNAMWorker(): Worker<NAMExtractionJobData> {
  if (worker) {
    console.log('[NAM WORKER] Worker already running');
    return worker;
  }

  const connection = getRedisClient();

  worker = new Worker<NAMExtractionJobData>(
    'nam-extraction',
    async (job: Job<NAMExtractionJobData>) => {
      await processNAMExtractionJob(job);
    },
    {
      connection,
      concurrency: 1, // Process 1 job at a time (due to AWS/OpenAI rate limits)
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 1000 },
    }
  );

  // Worker event handlers
  worker.on('ready', () => {
    console.log('[NAM WORKER] NAM extraction worker ready and waiting for jobs');
  });

  worker.on('active', (job: Job<NAMExtractionJobData>) => {
    console.log(`[NAM WORKER] Started processing job ${job.id}`);
  });

  worker.on('completed', (job: Job<NAMExtractionJobData>) => {
    console.log(`[NAM WORKER] Job ${job.id} completed`);
  });

  worker.on('failed', async (job: Job<NAMExtractionJobData> | undefined, error: Error) => {
    if (!job) return;

    const attemptsMade = job.attemptsMade || 0;
    const maxAttempts = job.opts.attempts || 3;

    console.error(
      `[NAM WORKER] Job ${job.id} failed (attempt ${attemptsMade}/${maxAttempts}):`,
      error.message
    );

    // Log final failure if all retries exhausted
    if (attemptsMade >= maxAttempts) {
      console.log(
        `[NAM WORKER] Job ${job.id} permanently failed after ${attemptsMade} attempts`
      );
    }
  });

  worker.on('error', (error: Error) => {
    console.error('[NAM WORKER] Worker error:', error);
  });

  worker.on('stalled', (jobId: string) => {
    console.warn(`[NAM WORKER] Job ${jobId} stalled`);
  });

  console.log('[NAM WORKER] NAM extraction worker started with concurrency 1');

  // Start heartbeat monitoring
  startHeartbeat();

  return worker;
}

/**
 * Stop the worker gracefully
 */
export async function stopNAMWorker(): Promise<void> {
  if (worker) {
    console.log('[NAM WORKER] Stopping NAM extraction worker...');

    // Stop heartbeat
    stopHeartbeat();

    await worker.close();
    worker = null;
    console.log('[NAM WORKER] NAM extraction worker stopped');
  }
}

/**
 * Get worker instance (for monitoring)
 */
export function getNAMWorker(): Worker<NAMExtractionJobData> | null {
  return worker;
}
