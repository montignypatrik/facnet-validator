/**
 * Document Processing Worker
 *
 * Background worker that processes document jobs:
 * - Scans knowledge/ directory
 * - Parses HTML/PDF files
 * - Chunks text
 * - Generates embeddings
 * - Stores in database
 */

import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../../../queue/redis';
import { log } from '../../../vite';
import type { DocumentJobData } from './documentQueue';
import { scanKnowledgeDirectory, getFileInfo } from '../services/fileScanner';
import { parseDocument } from '../services/documentProcessor';
import { chunkDocument } from '../services/chunkingService';
import { generateEmbedding } from '../services/embeddingService';
import * as docStorage from '../storage-documents';

// ==================== Worker Instance ====================

let documentWorker: Worker<DocumentJobData> | null = null;

/**
 * Start document processing worker
 */
export function startDocumentWorker(): void {
  if (documentWorker) {
    log('[DocumentWorker] Worker already running');
    return;
  }

  const connection = getRedisClient();

  documentWorker = new Worker<DocumentJobData>(
    'document-processing',
    async (job: Job<DocumentJobData>) => {
      log(`[DocumentWorker] Processing job ${job.id}: ${job.data.type}`);

      try {
        switch (job.data.type) {
          case 'scan-directory':
            await handleScanDirectory(job);
            break;
          case 'process-document':
            await handleProcessDocument(job);
            break;
          case 'reprocess-document':
            await handleReprocessDocument(job);
            break;
          case 'bulk-import':
            await handleBulkImport(job);
            break;
          default:
            throw new Error(`Unknown job type: ${(job.data as any).type}`);
        }

        log(`[DocumentWorker] Job ${job.id} completed successfully`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log(`[DocumentWorker] Job ${job.id} failed: ${errorMessage}`);
        throw error;
      }
    },
    {
      connection,
      concurrency: 2, // Process 2 documents at a time
    }
  );

  documentWorker.on('completed', (job) => {
    log(`[DocumentWorker] ✓ Job ${job.id} completed`);
  });

  documentWorker.on('failed', (job, error) => {
    log(`[DocumentWorker] ✗ Job ${job?.id} failed: ${error.message}`);
  });

  log('[DocumentWorker] Document processing worker started');
}

/**
 * Stop document processing worker
 */
export async function stopDocumentWorker(): Promise<void> {
  if (documentWorker) {
    await documentWorker.close();
    documentWorker = null;
    log('[DocumentWorker] Document processing worker stopped');
  }
}

// ==================== Job Handlers ====================

/**
 * Handle scan directory job
 */
async function handleScanDirectory(job: Job<DocumentJobData>): Promise<void> {
  await job.updateProgress({ stage: 'scanning', progress: 0 });

  // Scan knowledge/ directory
  const scanResult = await scanKnowledgeDirectory();

  await job.updateProgress({ stage: 'processing_files', progress: 0, totalFiles: scanResult.totalFiles });

  // Create or update document records
  let processed = 0;
  for (const file of scanResult.files) {
    // Check if document already exists
    const existing = await docStorage.getDocumentByFilePath(file.filePath);

    if (existing) {
      // Check if file has changed
      if (existing.fileHash !== file.fileHash) {
        // File changed, update and mark for reprocessing
        await docStorage.updateDocument(existing.id, {
          fileHash: file.fileHash,
          fileSizeBytes: file.fileSizeBytes.toString(),
          status: 'pending',
        });
        log(`[DocumentWorker] File changed: ${file.filePath}`);
      }
    } else {
      // New file, create document record
      await docStorage.createDocument({
        filename: file.filename,
        filePath: file.filePath,
        fileType: file.fileType,
        category: file.category,
        fileHash: file.fileHash,
        fileSizeBytes: file.fileSizeBytes.toString(),
        status: 'pending',
        metadata: {},
      });
      log(`[DocumentWorker] New file found: ${file.filePath}`);
    }

    processed++;
    await job.updateProgress({
      stage: 'processing_files',
      progress: (processed / scanResult.totalFiles) * 100,
      processedFiles: processed,
      totalFiles: scanResult.totalFiles,
    });
  }
}

/**
 * Handle process document job
 */
async function handleProcessDocument(job: Job<DocumentJobData>): Promise<void> {
  const { documentId, filePath } = job.data as { documentId: string; filePath: string };

  await docStorage.updateDocumentStatus(documentId, 'processing');

  // Helper for safe progress updates
  const updateProgress = async (data: any) => {
    if (typeof job.updateProgress === 'function') {
      await job.updateProgress(data);
    }
  };

  try {
    // Step 1: Parse document
    await updateProgress({ stage: 'parsing', progress: 10 });
    const fileInfo = await getFileInfo(filePath);
    if (!fileInfo) {
      throw new Error(`File not found: ${filePath}`);
    }

    const parsed = await parseDocument(fileInfo.absolutePath);

    // Step 2: Chunk document
    await updateProgress({ stage: 'chunking', progress: 30 });
    const chunks = chunkDocument(parsed);

    if (chunks.length === 0) {
      throw new Error('No chunks created - document may be too small');
    }

    // Step 3: Delete old chunks
    await updateProgress({ stage: 'cleaning', progress: 40 });
    await docStorage.deleteDocumentChunks(documentId);

    // Step 4: Generate embeddings and store chunks
    await updateProgress({ stage: 'embedding', progress: 50, totalChunks: chunks.length });

    const chunkRecords = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Generate embedding (will be stored when pgvector is installed)
      // For now, just store the chunk without embedding
      const embedding = await generateEmbedding({ text: chunk.content });

      chunkRecords.push({
        documentId,
        chunkIndex: chunk.chunkIndex.toString(),
        content: chunk.content,
        tokenCount: chunk.tokenCount.toString(),
        metadata: chunk.metadata,
      });

      await updateProgress({
        stage: 'embedding',
        progress: 50 + ((i + 1) / chunks.length) * 40,
        processedChunks: i + 1,
        totalChunks: chunks.length,
      });
    }

    // Batch insert chunks
    await updateProgress({ stage: 'saving', progress: 90 });
    await docStorage.createChunksBatch(chunkRecords);

    // Update document status
    await docStorage.updateDocumentStatus(documentId, 'completed');
    await docStorage.updateDocument(documentId, {
      metadata: {
        ...parsed.metadata,
        chunksCreated: chunks.length,
      },
    });

    await updateProgress({ stage: 'completed', progress: 100 });

    log(`[DocumentWorker] Document processed: ${filePath} (${chunks.length} chunks)`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await docStorage.updateDocumentStatus(documentId, 'error', errorMessage);
    throw error;
  }
}

/**
 * Handle reprocess document job
 */
async function handleReprocessDocument(job: Job<DocumentJobData>): Promise<void> {
  const { documentId } = job.data as { documentId: string };

  const doc = await docStorage.getDocumentById(documentId);
  if (!doc) {
    throw new Error(`Document not found: ${documentId}`);
  }

  // Re-use process document logic
  await handleProcessDocument({
    ...job,
    data: {
      type: 'process-document',
      documentId: doc.id,
      filePath: doc.filePath,
    },
  } as Job<DocumentJobData>);
}

/**
 * Handle bulk import job
 */
async function handleBulkImport(job: Job<DocumentJobData>): Promise<void> {
  // First scan directory
  await handleScanDirectory(job);

  // Get all pending documents
  const pendingDocs = await docStorage.getDocumentsByStatus('pending');

  await job.updateProgress({
    stage: 'processing_documents',
    progress: 0,
    totalDocuments: pendingDocs.length,
  });

  // Process each document
  for (let i = 0; i < pendingDocs.length; i++) {
    const doc = pendingDocs[i];

    try {
      await handleProcessDocument({
        ...job,
        data: {
          type: 'process-document',
          documentId: doc.id,
          filePath: doc.filePath,
        },
      } as Job<DocumentJobData>);

      await job.updateProgress({
        stage: 'processing_documents',
        progress: ((i + 1) / pendingDocs.length) * 100,
        processedDocuments: i + 1,
        totalDocuments: pendingDocs.length,
      });
    } catch (error) {
      log(`[DocumentWorker] Failed to process ${doc.filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Continue with next document
    }
  }
}
