import { Queue, QueueEvents } from 'bullmq';
import { getRedisClient } from './redis';

/**
 * NAM Extraction Queue Infrastructure
 *
 * Manages the BullMQ queue for NAM extraction jobs from PDF documents.
 * Handles job enqueueing, event listeners, and queue monitoring.
 */

export interface NAMExtractionJobData {
  runId: string;
  pdfPath: string;
  fileName: string;
}

export interface NAMQueueMetrics {
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

// Create the NAM extraction queue
let namExtractionQueue: Queue<NAMExtractionJobData> | null = null;
let queueEvents: QueueEvents | null = null;

/**
 * Get or create the NAM extraction queue
 */
export function getNAMExtractionQueue(): Queue<NAMExtractionJobData> {
  if (!namExtractionQueue) {
    const connection = getRedisClient();

    namExtractionQueue = new Queue<NAMExtractionJobData>('nam-extraction', {
      connection,
      defaultJobOptions: {
        attempts: 3, // Retry up to 3 times
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 seconds
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100, // Keep last 100 completed jobs
        },
        removeOnFail: false, // Keep failed jobs for analysis
      },
    });

    // Setup queue events for logging
    queueEvents = new QueueEvents('nam-extraction', {
      connection,
    });

    queueEvents.on('waiting', ({ jobId }) => {
      console.log(`[NAM QUEUE] Job ${jobId} is waiting`);
    });

    queueEvents.on('active', ({ jobId }) => {
      console.log(`[NAM QUEUE] Job ${jobId} started processing`);
    });

    queueEvents.on('completed', ({ jobId }) => {
      console.log(`[NAM QUEUE] Job ${jobId} completed successfully`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`[NAM QUEUE] Job ${jobId} failed:`, failedReason);
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      console.log(`[NAM QUEUE] Job ${jobId} progress:`, data);
    });

    console.log('[NAM QUEUE] NAM extraction queue initialized');
  }

  return namExtractionQueue;
}

/**
 * Enqueue a new NAM extraction job
 *
 * @param runId - The ID of the NAM extraction run
 * @param pdfPath - Path to the uploaded PDF file
 * @param fileName - Original filename
 * @returns The job ID
 */
export async function enqueueNAMExtraction(
  runId: string,
  pdfPath: string,
  fileName: string
): Promise<string> {
  const queue = getNAMExtractionQueue();

  const job = await queue.add(
    'extract-nam',
    {
      runId,
      pdfPath,
      fileName,
    },
    {
      jobId: `nam-extraction-${runId}`,
    }
  );

  console.log(`[NAM QUEUE] Enqueued NAM extraction job ${job.id} for run ${runId}`);

  return job.id!;
}

/**
 * Get job status
 */
export async function getNAMJobStatus(jobId: string) {
  const queue = getNAMExtractionQueue();
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
 * Cancel a NAM extraction job
 *
 * @param jobId - The job ID to cancel
 * @returns True if job was cancelled, false otherwise
 */
export async function cancelNAMJob(jobId: string): Promise<boolean> {
  try {
    const queue = getNAMExtractionQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      console.log(`[NAM QUEUE] Job ${jobId} not found for cancellation`);
      return false;
    }

    const state = await job.getState();

    // Can only cancel waiting or active jobs
    if (state === 'waiting' || state === 'active') {
      await job.remove();
      console.log(`[NAM QUEUE] Job ${jobId} cancelled (state: ${state})`);
      return true;
    }

    console.log(`[NAM QUEUE] Cannot cancel job ${jobId} in state: ${state}`);
    return false;
  } catch (error) {
    console.error(`[NAM QUEUE] Error cancelling job ${jobId}:`, error);
    return false;
  }
}

/**
 * Get comprehensive queue metrics
 *
 * @returns Queue metrics including counts and averages
 */
export async function getNAMQueueMetrics(): Promise<NAMQueueMetrics> {
  try {
    const queue = getNAMExtractionQueue();

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
        const processingTime = finishedOn - processedOn;
        totalProcessingTime += processingTime;

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
    console.error('[NAM QUEUE] Error getting queue metrics:', error);
    throw error;
  }
}

/**
 * Get queue position for a job
 *
 * @param jobId - The job ID to check
 * @returns The position in the queue (1-indexed) or null if not in queue
 */
export async function getNAMQueuePosition(jobId: string): Promise<number | null> {
  try {
    const queue = getNAMExtractionQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      console.log(`[NAM QUEUE] Job ${jobId} not found in queue`);
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
      console.log(`[NAM QUEUE] Job ${jobId} not found in waiting queue`);
      return null;
    }

    return position + 1; // Convert to 1-indexed
  } catch (error) {
    console.error(`[NAM QUEUE] Error getting queue position for job ${jobId}:`, error);
    return null;
  }
}

/**
 * Close the queue and cleanup
 */
export async function closeNAMQueue(): Promise<void> {
  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
    console.log('[NAM QUEUE] Queue events closed');
  }

  if (namExtractionQueue) {
    await namExtractionQueue.close();
    namExtractionQueue = null;
    console.log('[NAM QUEUE] NAM extraction queue closed');
  }
}
