import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { storage } from "../../core/storage";
import { authenticateToken, requireRole, type AuthenticatedRequest } from "../../core/auth";
import { BillingCSVProcessor } from "./validation/csvProcessor";

// Configure multer for file uploads
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
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

    // Process billing validation asynchronously
    console.log(`[DEBUG] About to call processBillingValidation with runId: ${run.id}, fileName: ${file.fileName}`);
    processBillingValidation(run.id, file.fileName).catch(error => {
      console.error(`Background validation processing failed for run ${run.id}:`, error);
    });

    res.json({ validationId: run.id, status: run.status });
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

router.get("/api/validations/:id", authenticateToken, async (req, res) => {
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

router.get("/api/validations/:id/results", authenticateToken, async (req, res) => {
  try {
    const results = await storage.getValidationResults(req.params.id);
    res.json(results);
  } catch (error) {
    console.error("Get validation results error:", error);
    res.status(500).json({ error: "Failed to get validation results" });
  }
});

router.get("/api/validations/:id/records", authenticateToken, async (req, res) => {
  try {
    const { page = "1", pageSize = "50", sortBy, sortOrder } = req.query;

    const result = await storage.getBillingRecords(req.params.id, {
      page: parseInt(page as string),
      pageSize: parseInt(pageSize as string),
      sortBy: sortBy as string,
      sortOrder: sortOrder as "asc" | "desc",
    });

    res.json(result);
  } catch (error) {
    console.error("Get billing records error:", error);
    res.status(500).json({ error: "Failed to get billing records" });
  }
});

router.post("/api/validations/:id/cleanup", authenticateToken, async (req, res) => {
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

// ==================== HELPER FUNCTIONS ====================

async function processBillingValidation(runId: string, fileName: string) {
  try {
    const filePath = path.join(uploadDir, fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    await storage.updateValidationRun(runId, { status: "processing" });

    const processor = new BillingCSVProcessor();
    const { records, errors } = await processor.processBillingCSV(filePath, runId);

    // Save billing records to database
    if (records.length > 0) {
      await storage.createBillingRecords(records);
    }

    // Fetch saved billing records with their database IDs
    const savedRecords = await storage.getBillingRecords(runId);

    // Run validation with records that have database IDs
    const validationResults = await processor.validateBillingRecords(savedRecords, runId);

    // Save validation results
    if (validationResults.length > 0) {
      await storage.createValidationResults(validationResults);
    }

    // Clean up uploaded file after processing
    try {
      fs.unlinkSync(filePath);
      console.log(`[DEBUG] Deleted file after processing: ${filePath}`);
    } catch (err) {
      console.error(`[WARN] Could not delete file ${filePath}:`, err);
    }

    await storage.updateValidationRun(runId, { status: "completed" });
    console.log(`[DEBUG] Validation run ${runId} completed successfully`);
  } catch (error) {
    console.error(`[ERROR] Processing failed for run ${runId}:`, error);
    await storage.updateValidationRun(runId, { status: "failed" });
    throw error;
  }
}

export default router;
