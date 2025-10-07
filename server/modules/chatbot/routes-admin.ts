/**
 * Chatbot Admin Routes
 *
 * Administrative API endpoints for document management.
 * Requires authentication and admin/editor role.
 */

import { Router, type Response } from 'express';
import { authenticateToken, requireRole, type AuthenticatedRequest } from '../../core/auth';
import { log } from '../../vite';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import * as docStorage from './storage-documents';
import * as docQueue from './queue/documentQueue';
import { scanKnowledgeDirectory, getKnowledgeBasePath } from './services/fileScanner';

const router = Router();

// ==================== File Upload Configuration ====================

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Get category from request body or default to 'ramq-official'
    const category = req.body.category || 'ramq-official';
    const uploadDir = path.join(getKnowledgeBasePath(), category);

    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename (remove dangerous characters)
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, sanitized);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.html', '.htm', '.pdf'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Only HTML and PDF files are allowed.`));
    }
  },
});

// ==================== Documents Endpoints ====================

/**
 * GET /api/chatbot/admin/documents
 *
 * Get all documents with optional filtering
 */
router.get(
  '/api/chatbot/admin/documents',
  authenticateToken,
  requireRole(['admin', 'editor']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status, category } = req.query;

      let documents;

      if (status) {
        documents = await docStorage.getDocumentsByStatus(status as any);
      } else if (category) {
        documents = await docStorage.getDocumentsByCategory(category as any);
      } else {
        documents = await docStorage.getAllDocuments();
      }

      res.json({ documents });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`[AdminRoutes] Error fetching documents: ${errorMessage}`);
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  }
);

/**
 * GET /api/chatbot/admin/documents/:id
 *
 * Get document details including chunks
 */
router.get(
  '/api/chatbot/admin/documents/:id',
  authenticateToken,
  requireRole(['admin', 'editor']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const document = await docStorage.getDocumentById(id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const chunks = await docStorage.getDocumentChunks(id);
      const chunkCount = chunks.length;

      res.json({
        document,
        chunkCount,
        chunks: chunks.slice(0, 5), // Return first 5 chunks as preview
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`[AdminRoutes] Error fetching document: ${errorMessage}`);
      res.status(500).json({ error: 'Failed to fetch document details' });
    }
  }
);

/**
 * POST /api/chatbot/admin/documents/upload
 *
 * Upload new document to knowledge base
 */
router.post(
  '/api/chatbot/admin/documents/upload',
  authenticateToken,
  requireRole(['admin', 'editor']),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { category = 'ramq-official' } = req.body;

      log(`[AdminRoutes] File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);

      // Trigger directory scan to pick up new file
      await docQueue.enqueueScanDirectory();

      res.json({
        success: true,
        file: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          category,
          path: path.relative(getKnowledgeBasePath(), req.file.path).replace(/\\/g, '/'),
        },
        message: 'File uploaded successfully. Processing will begin shortly.',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`[AdminRoutes] Upload error: ${errorMessage}`);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  }
);

/**
 * POST /api/chatbot/admin/documents/:id/reprocess
 *
 * Trigger reprocessing of a document
 */
router.post(
  '/api/chatbot/admin/documents/:id/reprocess',
  authenticateToken,
  requireRole(['admin', 'editor']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const document = await docStorage.getDocumentById(id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Enqueue reprocessing job
      const jobId = await docQueue.enqueueReprocessDocument(id);

      log(`[AdminRoutes] Reprocessing document ${id}: ${document.filename}`);

      res.json({
        success: true,
        jobId,
        message: 'Document reprocessing started',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`[AdminRoutes] Reprocess error: ${errorMessage}`);
      res.status(500).json({ error: 'Failed to trigger reprocessing' });
    }
  }
);

/**
 * DELETE /api/chatbot/admin/documents/:id
 *
 * Delete document and its chunks
 */
router.delete(
  '/api/chatbot/admin/documents/:id',
  authenticateToken,
  requireRole(['admin']), // Only admins can delete
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const document = await docStorage.getDocumentById(id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Delete from database (cascade deletes chunks)
      await docStorage.deleteDocument(id);

      // Optionally delete file from disk
      const { deleteFile } = req.query;
      if (deleteFile === 'true') {
        const filePath = path.join(getKnowledgeBasePath(), document.filePath);
        try {
          await fs.unlink(filePath);
          log(`[AdminRoutes] Deleted file: ${document.filePath}`);
        } catch (error) {
          log(`[AdminRoutes] Could not delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      log(`[AdminRoutes] Document deleted: ${document.filename}`);

      res.json({
        success: true,
        message: 'Document deleted successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`[AdminRoutes] Delete error: ${errorMessage}`);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  }
);

// ==================== Statistics Endpoints ====================

/**
 * GET /api/chatbot/admin/stats
 *
 * Get document statistics
 */
router.get(
  '/api/chatbot/admin/stats',
  authenticateToken,
  requireRole(['admin', 'editor']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await docStorage.getDocumentStats();
      const queueStats = await docQueue.getQueueStats();

      res.json({
        documents: stats,
        queue: queueStats,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`[AdminRoutes] Stats error: ${errorMessage}`);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }
);

// ==================== Processing Jobs Endpoints ====================

/**
 * POST /api/chatbot/admin/scan
 *
 * Trigger directory scan
 */
router.post(
  '/api/chatbot/admin/scan',
  authenticateToken,
  requireRole(['admin', 'editor']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = await docQueue.enqueueScanDirectory();

      log('[AdminRoutes] Directory scan triggered');

      res.json({
        success: true,
        jobId,
        message: 'Directory scan started',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`[AdminRoutes] Scan error: ${errorMessage}`);
      res.status(500).json({ error: 'Failed to trigger directory scan' });
    }
  }
);

/**
 * POST /api/chatbot/admin/bulk-import
 *
 * Trigger bulk import of all pending documents
 */
router.post(
  '/api/chatbot/admin/bulk-import',
  authenticateToken,
  requireRole(['admin', 'editor']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const jobId = await docQueue.enqueueBulkImport();

      log('[AdminRoutes] Bulk import triggered');

      res.json({
        success: true,
        jobId,
        message: 'Bulk import started',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`[AdminRoutes] Bulk import error: ${errorMessage}`);
      res.status(500).json({ error: 'Failed to trigger bulk import' });
    }
  }
);

/**
 * GET /api/chatbot/admin/jobs
 *
 * Get recent processing jobs
 */
router.get(
  '/api/chatbot/admin/jobs',
  authenticateToken,
  requireRole(['admin', 'editor']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const jobs = await docQueue.getRecentJobs(limit);

      res.json({ jobs });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`[AdminRoutes] Jobs error: ${errorMessage}`);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  }
);

// ==================== File System Endpoints ====================

/**
 * GET /api/chatbot/admin/files
 *
 * Scan knowledge directory and return file list
 */
router.get(
  '/api/chatbot/admin/files',
  authenticateToken,
  requireRole(['admin', 'editor']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const scanResult = await scanKnowledgeDirectory();

      res.json({
        files: scanResult.files,
        totalFiles: scanResult.totalFiles,
        byCategory: scanResult.byCategory,
        byType: scanResult.byType,
        errors: scanResult.errors,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log(`[AdminRoutes] File scan error: ${errorMessage}`);
      res.status(500).json({ error: 'Failed to scan files' });
    }
  }
);

export default router;
