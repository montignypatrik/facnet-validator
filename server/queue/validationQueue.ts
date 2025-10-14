import { Queue, QueueEvents, Job } from 'bullmq';
import { getRedisClient } from './redis';

/**
 * Validation Queue Infrastructure
 *
 * Manages the BullMQ queue for CSV validation jobs.
 * Handles job enqueueing, event listeners, queue monitoring, and dead letter queue management.
 */

export interface ValidationJobData {
  validationRunId: string;
  fileName: string;
}

export interface CategorizedError {
  code: 'QUEUE_ERROR' | 'FILE_ERROR' | 'VALIDATION_ERROR' | 'WORKER_ERROR';
  message: string;
  details?: string;
}

export interface QueueMetrics {
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  averages: {
    processingTime: number | null;
    waitTime: number | null;
  };
}

// Create the validation queue and dead letter queue
let validationQueue: Queue<ValidationJobData> | null = null;
let queueEvents: QueueEvents | null = null;
let deadLetterQueue: Queue | null = null;

/**
 * Get or create the validation queue
 */
export function getValidationQueue(): Queue<ValidationJobData> {
  if (!validationQueue) {
    const connection = getRedisClient();

    validationQueue = new Queue<ValidationJobData>('validation', {
      connection,
      defaultJobOptions: {
        attempts: 5, // Increased from 3 for better resilience
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 seconds
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: false, // Keep failed jobs for analysis (DLQ will handle cleanup)
      },
    });

    // Setup queue events for logging
    queueEvents = new QueueEvents('validation', {
      connection,
    });

    queueEvents.on('waiting', ({ jobId }) => {
      console.log(`[QUEUE] Job ${jobId} is waiting`);
    });

    queueEvents.on('active', ({ jobId }) => {
      console.log(`[QUEUE] Job ${jobId} started processing`);
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`[QUEUE] Job ${jobId} completed successfully`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`[QUEUE] Job ${jobId} failed:`, failedReason);
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      console.log(`[QUEUE] Job ${jobId} progress:`, data);
    });

    console.log('[QUEUE] Validation queue initialized');
  }

  return validationQueue;
}

/**
 * Get or create the dead letter queue
 *
 * Dead letter queue stores jobs that have exhausted all retry attempts.
 * These jobs can be inspected for debugging and optionally replayed.
 *
 * @returns Dead letter queue instance
 */
export function getDeadLetterQueue(): Queue {
  if (!deadLetterQueue) {
    const connection = getRedisClient();
    deadLetterQueue = new Queue('validation-dlq', { connection });
    console.log('[QUEUE] Dead letter queue initialized');
  }
  return deadLetterQueue;
}

/**
 * Move a failed job to the dead letter queue
 *
 * This function is called when a job has exhausted all retry attempts.
 * It preserves the original job data and failure information for later analysis.
 *
 * @param jobId - The ID of the failed job
 * @param reason - The reason for failure
 */
export async function moveToDeadLetter(jobId: string, reason: string): Promise<void> {
  try {
    const queue = getValidationQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      console.log(`[QUEUE] Job ${jobId} not found for DLQ transfer`);
      return;
    }

    const dlq = getDeadLetterQueue();
    await dlq.add('failed-validation', {
      originalJobId: jobId,
      data: job.data,
      failedReason: reason,
      attempts: job.attemptsMade,
      timestamp: Date.now()
    }, {
      removeOnComplete: { age: 86400 * 30 } // Keep for 30 days
    });

    console.log(`[QUEUE] Job ${jobId} moved to dead letter queue`);
  } catch (error) {
    console.error(`[QUEUE] Error moving job ${jobId} to DLQ:`, error);
  }
}

/**
 * Cancel a validation job
 *
 * Attempts to cancel a job that is currently waiting or active.
 * Completed or failed jobs cannot be cancelled.
 *
 * @param jobId - The job ID to cancel
 * @returns True if job was cancelled, false otherwise
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  try {
    const queue = getValidationQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      console.log(`[QUEUE] Job ${jobId} not found for cancellation`);
      return false;
    }

    const state = await job.getState();

    // Can only cancel waiting or active jobs
    if (state === 'waiting' || state === 'active') {
      await job.remove();
      console.log(`[QUEUE] Job ${jobId} cancelled (state: ${state})`);
      return true;
    }

    console.log(`[QUEUE] Cannot cancel job ${jobId} in state: ${state}`);
    return false;
  } catch (error) {
    console.error(`[QUEUE] Error cancelling job ${jobId}:`, error);
    return false;
  }
}

/**
 * Enqueue a new validation job
 *
 * @param validationRunId - The ID of the validation run
 * @param fileName - The name of the file to process
 * @returns The job ID
 */
export async function enqueueValidation(
  validationRunId: string,
  fileName: string
): Promise<string> {
  const queue = getValidationQueue();

  const job = await queue.add(
    'process-csv',
    {
      validationRunId,
      fileName,
    },
    {
      jobId: `validation-${validationRunId}`,
    }
  );

  console.log(`[QUEUE] Enqueued validation job ${job.id} for run ${validationRunId}`);

  return job.id!;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string) {
  const queue = getValidationQueue();
  const job = await queue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
  };
}

/**
 * Get comprehensive queue metrics
 *
 * Retrieves job counts across all states and calculates average processing/wait times
 * from the last 100 completed jobs.
 *
 * @returns Queue metrics including counts and averages
 */
export async function getQueueMetrics(): Promise<QueueMetrics> {
  try {
    const queue = getValidationQueue();

    // Get job counts for all states
    const counts = await queue.getJobCounts();

    // Get last 100 completed jobs for calculating averages
    const completedJobs = await queue.getCompleted(0, 99);

    let totalProcessingTime = 0;
    let totalWaitTime = 0;
    let validJobCount = 0;

    // Calculate average processing and wait times
    for (const job of completedJobs) {
      const processedOn = job.processedOn;
      const finishedOn = job.finishedOn;
      const timestamp = job.timestamp;

      if (processedOn && finishedOn && timestamp) {
        // Processing time = finishedOn - processedOn
        const processingTime = finishedOn - processedOn;
        totalProcessingTime += processingTime;

        // Wait time = processedOn - timestamp (when job was added)
        const waitTime = processedOn - timestamp;
        totalWaitTime += waitTime;

        validJobCount++;
      }
    }

    return {
      counts: {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
        paused: counts.paused || 0,
      },
      averages: {
        processingTime: validJobCount > 0 ? Math.round(totalProcessingTime / validJobCount) : null,
        waitTime: validJobCount > 0 ? Math.round(totalWaitTime / validJobCount) : null,
      },
    };
  } catch (error) {
    console.error('[QUEUE] Error getting queue metrics:', error);
    throw error;
  }
}

/**
 * Estimate processing time for a validation job based on file size
 *
 * Uses historical data from completed jobs to estimate how long a new job will take.
 * Falls back to a simple calculation based on file size if no historical data is available.
 *
 * @param fileSize - File size in bytes
 * @returns Estimated processing time in milliseconds
 */
export async function getEstimatedTime(fileSize: number): Promise<number> {
  try {
    const queue = getValidationQueue();

    // Get last 50 completed jobs for analysis
    const completedJobs = await queue.getCompleted(0, 49);

    if (completedJobs.length === 0) {
      // No historical data - use simple estimation
      // Assume ~1 second per 50KB of CSV data
      return Math.max(5000, (fileSize / 50000) * 1000);
    }

    // Calculate average processing rate (bytes per millisecond)
    let totalBytes = 0;
    let totalTime = 0;
    let validJobCount = 0;

    for (const job of completedJobs) {
      const processedOn = job.processedOn;
      const finishedOn = job.finishedOn;

      // Try to get file size from job data (if stored)
      const jobFileSize = (job.data as any)?.fileSize;

      if (processedOn && finishedOn && jobFileSize) {
        const processingTime = finishedOn - processedOn;
        totalBytes += jobFileSize;
        totalTime += processingTime;
        validJobCount++;
      }
    }

    if (validJobCount === 0) {
      // No valid historical data with file sizes
      return Math.max(5000, (fileSize / 50000) * 1000);
    }

    // Calculate average processing rate
    const avgBytesPerMs = totalBytes / totalTime;

    // Estimate time for this file
    const estimatedTime = fileSize / avgBytesPerMs;

    // Add 20% buffer and ensure minimum of 5 seconds
    return Math.max(5000, Math.round(estimatedTime * 1.2));
  } catch (error) {
    console.error('[QUEUE] Error estimating processing time:', error);
    // Fallback to simple estimation
    return Math.max(5000, (fileSize / 50000) * 1000);
  }
}

/**
 * Categorize error from failed job reason
 *
 * Analyzes the error message and categorizes it into one of the predefined error types
 * with a user-friendly message in French.
 *
 * @param failedReason - The error message from the failed job
 * @returns Categorized error object
 */
export function categorizeError(failedReason: string): CategorizedError {
  const errorLower = failedReason.toLowerCase();

  // Redis/connection errors → QUEUE_ERROR
  if (
    errorLower.includes('redis') ||
    errorLower.includes('connection') ||
    errorLower.includes('econnrefused') ||
    errorLower.includes('timeout') ||
    errorLower.includes('network')
  ) {
    return {
      code: 'QUEUE_ERROR',
      message: 'Erreur de connexion à la file d\'attente. Veuillez réessayer.',
      details: failedReason,
    };
  }

  // File errors → FILE_ERROR
  if (
    errorLower.includes('file not found') ||
    errorLower.includes('enoent') ||
    errorLower.includes('no such file') ||
    errorLower.includes('encoding') ||
    errorLower.includes('cannot read') ||
    errorLower.includes('fichier')
  ) {
    return {
      code: 'FILE_ERROR',
      message: 'Erreur lors de la lecture du fichier. Vérifiez que le fichier est valide.',
      details: failedReason,
    };
  }

  // CSV parsing errors → FILE_ERROR
  if (
    errorLower.includes('csv') ||
    errorLower.includes('parse') ||
    errorLower.includes('invalid format') ||
    errorLower.includes('malformed') ||
    errorLower.includes('colonnes')
  ) {
    return {
      code: 'FILE_ERROR',
      message: 'Erreur de format CSV. Vérifiez la structure du fichier.',
      details: failedReason,
    };
  }

  // Validation rule failures → VALIDATION_ERROR
  if (
    errorLower.includes('validation') ||
    errorLower.includes('règle') ||
    errorLower.includes('invalid data') ||
    errorLower.includes('constraint')
  ) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Erreur lors de la validation des données. Consultez les logs pour plus de détails.',
      details: failedReason,
    };
  }

  // Worker crashes → WORKER_ERROR
  if (
    errorLower.includes('worker') ||
    errorLower.includes('crash') ||
    errorLower.includes('out of memory') ||
    errorLower.includes('killed') ||
    errorLower.includes('sigterm') ||
    errorLower.includes('sigkill')
  ) {
    return {
      code: 'WORKER_ERROR',
      message: 'Erreur interne du système de traitement. Veuillez réessayer.',
      details: failedReason,
    };
  }

  // Default to WORKER_ERROR for unknown errors
  return {
    code: 'WORKER_ERROR',
    message: 'Une erreur inattendue s\'est produite. Veuillez contacter le support.',
    details: failedReason,
  };
}

/**
 * Get queue position for a job
 *
 * Calculates the position of a job in the waiting queue (1-indexed).
 * Returns null if the job is not in the waiting state.
 *
 * @param jobId - The job ID to check
 * @returns The position in the queue (1-indexed) or null if not in queue
 */
export async function getQueuePosition(jobId: string): Promise<number | null> {
  try {
    const queue = getValidationQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      console.log(`[QUEUE] Job ${jobId} not found in queue`);
      return null;
    }

    const state = await job.getState();

    // Only return position for waiting jobs
    if (state !== 'waiting') {
      return null;
    }

    // Get all waiting jobs in order
    const waitingJobs = await queue.getWaiting();

    // Find the position of our job (1-indexed)
    const position = waitingJobs.findIndex((waitingJob) => waitingJob.id === jobId);

    if (position === -1) {
      console.log(`[QUEUE] Job ${jobId} not found in waiting queue`);
      return null;
    }

    return position + 1; // Convert to 1-indexed
  } catch (error) {
    console.error(`[QUEUE] Error getting queue position for job ${jobId}:`, error);
    return null;
  }
}

/**
 * Close the queue and cleanup
 */
export async function closeQueue(): Promise<void> {
  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
    console.log('[QUEUE] Queue events closed');
  }

  if (deadLetterQueue) {
    await deadLetterQueue.close();
    deadLetterQueue = null;
    console.log('[QUEUE] Dead letter queue closed');
  }

  if (validationQueue) {
    await validationQueue.close();
    validationQueue = null;
    console.log('[QUEUE] Validation queue closed');
  }
}
