import { Queue, QueueEvents } from 'bullmq';
import { getRedisClient } from './redis';

/**
 * Validation Queue Infrastructure
 *
 * Manages the BullMQ queue for CSV validation jobs.
 * Handles job enqueueing, event listeners, and queue monitoring.
 */

export interface ValidationJobData {
  validationRunId: string;
  fileName: string;
}

// Create the validation queue
let validationQueue: Queue<ValidationJobData> | null = null;
let queueEvents: QueueEvents | null = null;

/**
 * Get or create the validation queue
 */
export function getValidationQueue(): Queue<ValidationJobData> {
  if (!validationQueue) {
    const connection = getRedisClient();

    validationQueue = new Queue<ValidationJobData>('validation', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
          count: 1000, // Keep last 1000 failed jobs
        },
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
 * Close the queue and cleanup
 */
export async function closeQueue(): Promise<void> {
  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
    console.log('[QUEUE] Queue events closed');
  }

  if (validationQueue) {
    await validationQueue.close();
    validationQueue = null;
    console.log('[QUEUE] Validation queue closed');
  }
}
