/**
 * Document Processing Queue
 *
 * BullMQ queue for background document processing.
 * Handles scanning, parsing, chunking, and embedding generation.
 */

import { Queue, QueueEvents } from 'bullmq';
import { getRedisClient } from '../../../queue/redis';
import { log } from '../../../vite';

// ==================== Job Data Types ====================

export interface ScanDirectoryJobData {
  type: 'scan-directory';
}

export interface ProcessDocumentJobData {
  type: 'process-document';
  documentId: string;
  filePath: string;
}

export interface ReprocessDocumentJobData {
  type: 'reprocess-document';
  documentId: string;
}

export interface BulkImportJobData {
  type: 'bulk-import';
}

export type DocumentJobData =
  | ScanDirectoryJobData
  | ProcessDocumentJobData
  | ReprocessDocumentJobData
  | BulkImportJobData;

// ==================== Queue Management ====================

let documentQueue: Queue<DocumentJobData> | null = null;
let queueEvents: QueueEvents | null = null;

/**
 * Get or create the document processing queue
 */
export function getDocumentQueue(): Queue<DocumentJobData> {
  if (!documentQueue) {
    const connection = getRedisClient();

    documentQueue = new Queue<DocumentJobData>('document-processing', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100,
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
          count: 1000,
        },
      },
    });

    // Setup queue events for logging
    queueEvents = new QueueEvents('document-processing', {
      connection,
    });

    queueEvents.on('waiting', ({ jobId }) => {
      log(`[DocumentQueue] Job ${jobId} is waiting`);
    });

    queueEvents.on('active', ({ jobId }) => {
      log(`[DocumentQueue] Job ${jobId} started processing`);
    });

    queueEvents.on('completed', ({ jobId }) => {
      log(`[DocumentQueue] Job ${jobId} completed successfully`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      log(`[DocumentQueue] Job ${jobId} failed: ${failedReason}`);
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      log(`[DocumentQueue] Job ${jobId} progress: ${JSON.stringify(data)}`);
    });

    log('[DocumentQueue] Document processing queue initialized');
  }

  return documentQueue;
}

/**
 * Close queue connections
 */
export async function closeDocumentQueue(): Promise<void> {
  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
  }

  if (documentQueue) {
    await documentQueue.close();
    documentQueue = null;
  }

  log('[DocumentQueue] Document processing queue closed');
}

// ==================== Job Enqueueing ====================

/**
 * Enqueue directory scan job
 */
export async function enqueueScanDirectory(): Promise<string> {
  const queue = getDocumentQueue();

  const job = await queue.add(
    'scan-directory',
    { type: 'scan-directory' },
    {
      priority: 10, // Lower priority than individual document processing
    }
  );

  log(`[DocumentQueue] Enqueued scan directory job: ${job.id}`);
  return job.id!;
}

/**
 * Enqueue document processing job
 */
export async function enqueueProcessDocument(documentId: string, filePath: string): Promise<string> {
  const queue = getDocumentQueue();

  const job = await queue.add(
    'process-document',
    {
      type: 'process-document',
      documentId,
      filePath,
    },
    {
      priority: 5, // High priority for user-uploaded documents
      jobId: `process-${documentId}`, // Prevent duplicate jobs
    }
  );

  log(`[DocumentQueue] Enqueued process document job: ${job.id} (${filePath})`);
  return job.id!;
}

/**
 * Enqueue document reprocessing job
 */
export async function enqueueReprocessDocument(documentId: string): Promise<string> {
  const queue = getDocumentQueue();

  const job = await queue.add(
    'reprocess-document',
    {
      type: 'reprocess-document',
      documentId,
    },
    {
      priority: 5,
      jobId: `reprocess-${documentId}`,
    }
  );

  log(`[DocumentQueue] Enqueued reprocess document job: ${job.id}`);
  return job.id!;
}

/**
 * Enqueue bulk import job
 */
export async function enqueueBulkImport(): Promise<string> {
  const queue = getDocumentQueue();

  const job = await queue.add(
    'bulk-import',
    { type: 'bulk-import' },
    {
      priority: 10,
    }
  );

  log(`[DocumentQueue] Enqueued bulk import job: ${job.id}`);
  return job.id!;
}

// ==================== Queue Monitoring ====================

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const queue = getDocumentQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Get recent jobs
 */
export async function getRecentJobs(limit: number = 10) {
  const queue = getDocumentQueue();

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaiting(0, limit),
    queue.getActive(0, limit),
    queue.getCompleted(0, limit),
    queue.getFailed(0, limit),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
  };
}

/**
 * Clean old jobs
 */
export async function cleanOldJobs() {
  const queue = getDocumentQueue();

  const grace = 3600 * 1000; // 1 hour
  await queue.clean(grace, 1000, 'completed');
  await queue.clean(grace * 24, 1000, 'failed');

  log('[DocumentQueue] Cleaned old jobs');
}
