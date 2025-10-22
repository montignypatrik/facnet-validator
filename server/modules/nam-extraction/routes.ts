import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { db } from "../../core/db";
import { namExtractionRuns, namExtractionResults } from "@shared/schema";
import { authenticateToken, type AuthenticatedRequest } from "../../core/auth";
import { enqueueNAMExtraction, getNAMJobStatus } from "../../queue/namExtractionQueue";
import { createNAMExtractionSSEConnection } from "../../api/sse";
import { generateSSVContent, generateSSVFilename } from "./services/ssvGenerator";
import { eq, desc } from "drizzle-orm";

/**
 * NAM Extraction Module Routes
 *
 * Handles:
 * - PDF file uploads (/api/nam/upload)
 * - NAM extraction runs (/api/nam/runs)
 * - SSV file generation (/api/nam/generate-ssv)
 */

// Configure multer for PDF uploads
const uploadDir = "./uploads/nam";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for PDFs
  fileFilter: (req, file, cb) => {
    // Validate file extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.pdf'];

    if (!allowedExtensions.includes(ext)) {
      return cb(new Error('Seuls les fichiers PDF sont acceptés'));
    }

    // Validate MIME type
    const allowedMimeTypes = ['application/pdf'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error('Type de fichier invalide. Seuls les PDF sont acceptés.'));
    }

    cb(null, true);
  }
});

const router = Router();

/**
 * Helper function to get NAM extraction run owner for access control
 */
async function getNAMRunOwner(runId: string): Promise<string | null> {
  const run = await db.query.namExtractionRuns.findFirst({
    where: eq(namExtractionRuns.id, runId),
  });
  return run?.createdBy || null;
}

// ==================== PDF UPLOAD ROUTE ====================

/**
 * POST /api/nam/upload
 *
 * Upload a PDF file for NAM extraction
 */
router.post("/api/nam/upload", authenticateToken, upload.single("file"), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Aucun fichier téléchargé" });
    }

    const fileName = req.file.originalname;
    const filePath = path.resolve(req.file.path); // Convert to absolute path
    const fileId = req.file.filename; // Use multer's generated filename as fileId

    // Extract CSV fields from request body
    const { doctorLicenceID, doctorGroupNumber, sector } = req.body;

    // Validate doctor license ID (7 digits required)
    if (!doctorLicenceID || !/^\d{7}$/.test(doctorLicenceID)) {
      return res.status(400).json({ error: "Le numéro de permis du médecin doit contenir exactement 7 chiffres" });
    }

    // Validate doctor group number (5 digits optional, default to "0")
    const groupNumber = doctorGroupNumber && /^\d{5}$/.test(doctorGroupNumber) ? doctorGroupNumber : "0";

    // Validate sector (0-7 required)
    if (!sector || !/^[0-7]$/.test(sector)) {
      return res.status(400).json({ error: "Le secteur doit être un chiffre entre 0 et 7" });
    }

    console.log(`[NAM] PDF uploaded for NAM extraction: ${fileName} (${req.file.size} bytes)`);
    console.log(`[NAM] CSV fields: License=${doctorLicenceID}, Group=${groupNumber}, Sector=${sector}`);

    // Create NAM extraction run in database
    const [run] = await db.insert(namExtractionRuns).values({
      fileId,
      fileName,
      status: "queued",
      progress: "0",
      doctorLicenceID,
      doctorGroupNumber: groupNumber,
      sector,
      createdBy: req.user!.uid,
    }).returning();

    // Enqueue NAM extraction job for background processing
    console.log(`[NAM] Enqueueing NAM extraction job for run ${run.id}, fileName: ${fileName}`);
    const jobId = await enqueueNAMExtraction(run.id, filePath, fileName);

    // Update the run with the job ID
    await db.update(namExtractionRuns)
      .set({ jobId })
      .where(eq(namExtractionRuns.id, run.id));

    console.log(`[NAM] NAM extraction job ${jobId} enqueued for run ${run.id}`);

    // Return 202 Accepted to indicate the request has been accepted for processing
    res.status(202).json({
      runId: run.id,
      status: run.status,
      jobId,
      fileName,
    });
  } catch (error: any) {
    console.error("[NAM] NAM extraction upload error:", error);
    res.status(500).json({ error: "Échec du téléchargement du fichier" });
  }
});

// ==================== NAM EXTRACTION RUN ROUTES ====================

/**
 * GET /api/nam/runs
 *
 * Get all NAM extraction runs for the current user
 */
router.get("/api/nam/runs", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { limit = "50", status } = req.query;

    const runs = await db.query.namExtractionRuns.findMany({
      where: status
        ? eq(namExtractionRuns.status, status as string)
        : undefined,
      orderBy: [desc(namExtractionRuns.createdAt)],
      limit: parseInt(limit as string),
    });

    res.json({ runs, count: runs.length });
  } catch (error: any) {
    console.error("[NAM] Get NAM extraction runs error:", error);
    res.status(500).json({ error: "Échec de la récupération des extractions" });
  }
});

/**
 * GET /api/nam/runs/:id
 *
 * Get a specific NAM extraction run
 */
router.get("/api/nam/runs/:id", authenticateToken, async (req, res) => {
  try {
    const run = await db.query.namExtractionRuns.findFirst({
      where: eq(namExtractionRuns.id, req.params.id),
    });

    if (!run) {
      return res.status(404).json({ error: "Extraction non trouvée" });
    }

    res.json(run);
  } catch (error: any) {
    console.error("[NAM] Get NAM extraction run error:", error);
    res.status(500).json({ error: "Échec de la récupération de l'extraction" });
  }
});

/**
 * GET /api/nam/runs/:id/stream
 *
 * Establish a Server-Sent Events (SSE) connection for real-time extraction updates.
 * Streams progress updates every 2 seconds until the extraction completes or fails.
 */
router.get("/api/nam/runs/:id/stream", authenticateToken, async (req, res) => {
  createNAMExtractionSSEConnection(req, res, req.params.id);
});

/**
 * GET /api/nam/runs/:id/job-status
 *
 * Get detailed job status including queue position and error information
 */
router.get("/api/nam/runs/:id/job-status", authenticateToken, async (req, res) => {
  try {
    const runId = req.params.id;

    // Get the extraction run from database
    const run = await db.query.namExtractionRuns.findFirst({
      where: eq(namExtractionRuns.id, runId),
    });

    if (!run) {
      return res.status(404).json({ error: "Extraction non trouvée" });
    }

    // Get job status from BullMQ if jobId exists
    let jobState: string | null = null;

    if (run.jobId) {
      try {
        const jobStatus = await getNAMJobStatus(run.jobId);

        if (jobStatus) {
          jobState = jobStatus.state;
        } else {
          console.warn(`[NAM] Job ${run.jobId} not found in BullMQ for run ${runId}`);
        }
      } catch (queueError) {
        console.error(`[NAM] Error querying BullMQ for job ${run.jobId}:`, queueError);
      }
    }

    // Build response merging database and queue status
    const response = {
      runId: run.id,
      jobId: run.jobId || null,
      status: run.status,
      stage: run.stage || null,
      jobState,
      progress: Number(run.progress || 0),
      pageCount: run.pageCount || null,
      namsFound: run.namsFound || null,
      namsValid: run.namsValid || null,
      errorMessage: run.errorMessage || null,
      errorCode: run.errorCode || null,
    };

    res.json(response);
  } catch (error: any) {
    console.error("[NAM] Get NAM extraction job status error:", error);
    res.status(500).json({ error: "Échec de la récupération du statut" });
  }
});

/**
 * GET /api/nam/runs/:id/results
 *
 * Get extracted NAM results for a specific run
 */
router.get("/api/nam/runs/:id/results", authenticateToken, async (req, res) => {
  try {
    const results = await db.query.namExtractionResults.findMany({
      where: eq(namExtractionResults.runId, req.params.id),
      orderBy: [namExtractionResults.page], // Ascending order - first page first
    });

    res.json({ results, count: results.length });
  } catch (error: any) {
    console.error("[NAM] Get NAM extraction results error:", error);
    res.status(500).json({ error: "Échec de la récupération des résultats" });
  }
});

/**
 * POST /api/nam/runs/:id/results/:resultId/toggle
 *
 * Toggle a NAM result's inclusion in SSV export
 */
router.post("/api/nam/runs/:id/results/:resultId/toggle", authenticateToken, async (req, res) => {
  try {
    const { resultId } = req.params;

    // Get current state
    const result = await db.query.namExtractionResults.findFirst({
      where: eq(namExtractionResults.id, resultId),
    });

    if (!result) {
      return res.status(404).json({ error: "Résultat non trouvé" });
    }

    // Toggle removedByUser flag
    await db.update(namExtractionResults)
      .set({ removedByUser: !result.removedByUser })
      .where(eq(namExtractionResults.id, resultId));

    res.json({ success: true, removedByUser: !result.removedByUser });
  } catch (error: any) {
    console.error("[NAM] Toggle NAM result error:", error);
    res.status(500).json({ error: "Échec de la mise à jour du résultat" });
  }
});

/**
 * PATCH /api/nam/runs/:id/results/:resultId/edit-datetime
 *
 * Manually edit the visit date and/or time for a NAM result
 */
router.patch("/api/nam/runs/:id/results/:resultId/edit-datetime", authenticateToken, async (req, res) => {
  try {
    const { resultId } = req.params;
    const { visitDate, visitTime } = req.body;

    // Import validators
    const { validateDateFormat, normalizeDate } = await import("./services/dateValidator");
    const { validateTimeFormat, normalizeTime } = await import("./services/timeValidator");

    // Get current result
    const result = await db.query.namExtractionResults.findFirst({
      where: eq(namExtractionResults.id, resultId),
    });

    if (!result) {
      return res.status(404).json({ error: "Résultat non trouvé" });
    }

    // Prepare update data
    const updateData: any = {};

    // Validate and update date if provided
    if (visitDate !== undefined) {
      const normalizedDate = normalizeDate(visitDate);
      const [dateValid, dateValidationError] = validateDateFormat(normalizedDate);

      updateData.visitDate = normalizedDate || null;
      updateData.dateValid = dateValid;
      updateData.dateValidationError = dateValid ? null : dateValidationError;
      updateData.dateManuallyEdited = true;
    }

    // Validate and update time if provided
    if (visitTime !== undefined) {
      const normalizedTime = normalizeTime(visitTime);
      const [timeValid, timeValidationError] = validateTimeFormat(normalizedTime);

      updateData.visitTime = normalizedTime;
      updateData.timeValid = timeValid;
      updateData.timeValidationError = timeValid ? null : timeValidationError;
      updateData.timeManuallyEdited = true;
    }

    // Update the result
    await db.update(namExtractionResults)
      .set(updateData)
      .where(eq(namExtractionResults.id, resultId));

    // Fetch updated result
    const updatedResult = await db.query.namExtractionResults.findFirst({
      where: eq(namExtractionResults.id, resultId),
    });

    res.json({ success: true, result: updatedResult });
  } catch (error: any) {
    console.error("[NAM] Edit date/time error:", error);
    res.status(500).json({ error: "Échec de la mise à jour de la date/heure" });
  }
});

// ==================== SSV GENERATION ROUTE ====================

/**
 * POST /api/nam/generate-ssv
 *
 * Generate and download SSV file from extracted NAMs
 */
router.post("/api/nam/generate-ssv", authenticateToken, async (req, res) => {
  try {
    const { runId, includeInvalid = false } = req.body;

    if (!runId) {
      return res.status(400).json({ error: "runId est requis" });
    }

    // Get the extraction run
    const run = await db.query.namExtractionRuns.findFirst({
      where: eq(namExtractionRuns.id, runId),
    });

    if (!run) {
      return res.status(404).json({ error: "Extraction non trouvée" });
    }

    if (run.status !== "completed") {
      return res.status(400).json({ error: "L'extraction doit être complétée avant de générer le SSV" });
    }

    // Get NAM results (filter by valid flag and removedByUser flag)
    const results = await db.query.namExtractionResults.findMany({
      where: eq(namExtractionResults.runId, runId),
    });

    // Filter NAMs: exclude removed by user, optionally exclude invalid NAMs
    // ALWAYS exclude NAMs with invalid/missing dates (required field)
    const filteredResults = results.filter((result) => {
      if (result.removedByUser) return false;
      if (!includeInvalid && !result.valid) return false;
      // Block export if date is invalid or missing (date is required)
      if (!result.dateValid || !result.visitDate) return false;
      return true;
    });

    if (filteredResults.length === 0) {
      // Check if there are results with missing/invalid dates
      const hasInvalidDates = results.some((r) => !r.removedByUser && (!r.dateValid || !r.visitDate));
      if (hasInvalidDates) {
        return res.status(400).json({
          error: "Toutes les dates de visite doivent être valides avant l'exportation. Veuillez corriger les dates manquantes ou invalides."
        });
      }
      return res.status(400).json({ error: "Aucun NAM valide à exporter" });
    }

    // Prepare NAM data with dates and times
    const namData = filteredResults.map((result) => ({
      nam: result.nam,
      visitDate: result.visitDate!,
      visitTime: result.visitTime!,
    }));

    // Prepare doctor info from the run
    const doctorInfo = {
      doctorLicenceID: run.doctorLicenceID || "",
      doctorGroupNumber: run.doctorGroupNumber || "0",
      sector: run.sector || "0",
    };

    // Generate SSV content with dates, times, and doctor info
    const ssvContent = generateSSVContent(namData, doctorInfo);
    const ssvFilename = generateSSVFilename();

    console.log(`[NAM] Generated SSV file with ${namData.length} NAMs for run ${runId}`);

    // Mark NAMs as included in SSV
    for (const result of filteredResults) {
      await db.update(namExtractionResults)
        .set({ includedInSsv: true })
        .where(eq(namExtractionResults.id, result.id));
    }

    // Send SSV file as download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${ssvFilename}"`);
    res.send(ssvContent);
  } catch (error: any) {
    console.error("[NAM] Generate SSV error:", error);
    res.status(500).json({ error: "Échec de la génération du fichier SSV" });
  }
});

export default router;
