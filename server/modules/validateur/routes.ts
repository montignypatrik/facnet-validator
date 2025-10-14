import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { storage } from "../../core/storage";
import { authenticateToken, requireRole, requireOwnership, type AuthenticatedRequest } from "../../core/auth";
import { BillingCSVProcessor } from "./validation/csvProcessor";
import { logger } from "./logger";
import { enqueueValidation } from "../../queue/validationQueue";
import { redactBillingRecord, redactValidationResult, shouldRedactPhi } from "./validation/phiRedaction";

// Configure multer for file uploads
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    // Validate file extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.csv'];

    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('Seuls les fichiers CSV sont acceptés'));
    }

    // Validate MIME type
    const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Type de fichier invalide'));
    }

    cb(null, true);
  }
});

const router = Router();

/**
 * Validateur Module Routes
 *
 * Handles:
 * - File uploads (/api/files)
 * - Validation runs (/api/validations)
 * - Analytics (/api/analytics)
 */

/**
 * Helper function to get validation run owner for PHI access control
 * @param validationRunId - The validation run ID
 * @returns The owner's user ID, or null if not found
 */
async function getValidationRunOwner(validationRunId: string): Promise<string | null> {
  const run = await storage.getValidationRun(validationRunId);
  return run?.createdBy || null;
}

// ==================== ANALYTICS ROUTES ====================

router.get("/api/analytics/kpis", authenticateToken, (req, res) => {
  res.json([]);
});

router.get("/api/analytics/unique-patients-by-day", authenticateToken, (req, res) => {
  res.json([]);
});

router.get("/api/analytics/codes", authenticateToken, (req, res) => {
  res.json([]);
});

// ==================== FILE UPLOAD ROUTES ====================

router.post("/api/files", authenticateToken, upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = await storage.createFile({
      originalName: req.file.originalname,
      fileName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size.toString(),
      uploadedBy: req.user!.uid,
    });

    res.json({ fileId: file.id });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ error: "File upload failed" });
  }
});

// ==================== VALIDATION ROUTES ====================

router.post("/api/validations", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { fileId } = req.body;

    if (!fileId) {
      return res.status(400).json({ error: "fileId is required" });
    }

    const file = await storage.getFile(fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    const run = await storage.createValidationRun({
      fileId: fileId,
      fileName: file.originalName,
      status: "queued",
      createdBy: req.user!.uid,
    });

    // Enqueue validation job for background processing
    console.log(`[API] Enqueueing validation job for run ${run.id}, fileName: ${file.fileName}`);
    const jobId = await enqueueValidation(run.id, file.fileName);

    // Update the run with the job ID
    await storage.updateValidationRun(run.id, { jobId });

    console.log(`[API] Validation job ${jobId} enqueued for run ${run.id}`);

    // Return 202 Accepted to indicate the request has been accepted for processing
    res.status(202).json({ validationId: run.id, status: run.status, jobId });
  } catch (error) {
    console.error("Validation creation error:", error);
    res.status(500).json({ error: "Validation creation failed" });
  }
});

router.get("/api/validations", authenticateToken, async (req, res) => {
  try {
    const { limit, status, page, pageSize } = req.query;

    const result = await storage.getValidationRuns({
      limit: limit ? parseInt(limit as string) : undefined,
      status: status as string,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 50,
    });

    res.json(result);
  } catch (error: any) {
    console.error("Get validations error:", error);

    // Provide more specific error messages
    if (error.code === '28P01') {
      console.error("Database authentication failed - check DATABASE_URL credentials");
      res.status(503).json({ error: "Database connection failed - authentication error" });
    } else if (error.code && error.code.startsWith('28')) {
      console.error("Database authentication/authorization error:", error.message);
      res.status(503).json({ error: "Database connection failed" });
    } else if (error.code === 'ECONNREFUSED') {
      console.error("Database connection refused - is PostgreSQL running?");
      res.status(503).json({ error: "Database service unavailable" });
    } else {
      res.status(500).json({ error: "Failed to get validations" });
    }
  }
});

router.get("/api/validations/:id", authenticateToken, requireOwnership(getValidationRunOwner), async (req, res) => {
  try {
    const run = await storage.getValidationRun(req.params.id);

    if (!run) {
      return res.status(404).json({ error: "Validation run not found" });
    }

    res.json(run);
  } catch (error) {
    console.error("Get validation error:", error);
    res.status(500).json({ error: "Failed to get validation" });
  }
});

router.get("/api/validations/:id/results", authenticateToken, requireOwnership(getValidationRunOwner), async (req: AuthenticatedRequest, res) => {
  try {
    // Get user preferences for PHI redaction
    const user = await storage.getUser(req.user!.uid);
    const phiRedactionEnabled = shouldRedactPhi(user?.phiRedactionEnabled);

    // Get validation results
    let results = await storage.getValidationResults(req.params.id);

    // Apply PHI redaction if enabled
    if (phiRedactionEnabled) {
      results = results.map(result => redactValidationResult(result, true));
    } else {
      // Audit log: PHI accessed without redaction (admin override)
      await logger.info(
        req.params.id,
        'PHI_ACCESS',
        `PHI accessed without redaction by user ${req.user!.uid}`,
        {
          userId: req.user!.uid,
          userEmail: user?.email,
          endpoint: '/api/validations/:id/results'
        }
      );
    }

    res.json(results);
  } catch (error) {
    console.error("Get validation results error:", error);
    res.status(500).json({ error: "Failed to get validation results" });
  }
});

router.get("/api/validations/:id/records", authenticateToken, requireOwnership(getValidationRunOwner), async (req: AuthenticatedRequest, res) => {
  try {
    const { page = "1", pageSize = "50", sortBy, sortOrder } = req.query;

    // Get user preferences for PHI redaction
    const user = await storage.getUser(req.user!.uid);
    const phiRedactionEnabled = shouldRedactPhi(user?.phiRedactionEnabled);

    let result = await storage.getBillingRecords(req.params.id, {
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string),
      sortBy: sortBy as string,
      sortOrder: sortOrder as "asc" | "desc",
    });

    // Apply PHI redaction to billing records if enabled
    if (phiRedactionEnabled) {
      result.data = result.data.map(record => redactBillingRecord(record, true));
    } else {
      // Audit log: PHI accessed without redaction (admin override)
      await logger.info(
        req.params.id,
        'PHI_ACCESS',
        `PHI accessed without redaction by user ${req.user!.uid}`,
        {
          userId: req.user!.uid,
          userEmail: user?.email,
          endpoint: '/api/validations/:id/records',
          recordCount: result.data.length
        }
      );
    }

    res.json(result);
  } catch (error) {
    console.error("Get billing records error:", error);
    res.status(500).json({ error: "Failed to get billing records" });
  }
});

router.get("/api/validations/:id/logs", authenticateToken, requireOwnership(getValidationRunOwner), async (req, res) => {
  try {
    const { level, source, limit, offset } = req.query;

    const result = await storage.getValidationLogs(req.params.id, {
      level: level as string,
      source: source as string,
      limit: limit ? parseInt(limit as string) : 1000,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json(result);
  } catch (error) {
    console.error("Get validation logs error:", error);
    res.status(500).json({ error: "Failed to get validation logs" });
  }
});

router.post("/api/validations/:id/cleanup", authenticateToken, requireOwnership(getValidationRunOwner), async (req, res) => {
  try {
    await storage.cleanupValidationData(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Cleanup error:", error);
    res.status(500).json({ error: "Failed to cleanup validation data" });
  }
});

router.post("/api/validations/cleanup-old", authenticateToken, async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;
    await storage.cleanupOldValidations(daysOld);
    res.json({ success: true });
  } catch (error) {
    console.error("Cleanup old validations error:", error);
    res.status(500).json({ error: "Failed to cleanup old validations" });
  }
});

export default router;
