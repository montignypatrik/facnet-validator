/**
 * Extraction pipeline orchestrator for NAM extraction from PDF documents.
 *
 * Coordinates the full extraction workflow:
 * 1. Extract text with AWS Textract (with retry)
 * 2. Extract NAMs with OpenAI GPT-4 (with retry)
 * 3. Validate NAM formats
 * 4. Track processing time
 * 5. Save to database
 * 6. Clean up files
 */

import fs from "fs/promises";
import path from "path";
import { db } from "../../../core/db";
import { namExtractionRuns, namExtractionResults } from "@shared/schema";
import { extractTextFromPDF, getPageCount } from "./textractService";
import { extractNAMsWithGPT4 } from "./openaiService";
import { validateNAMFormat, normalizeNAM } from "./namValidator";
import { retryWithBackoff } from "./retryUtil";
import { ExtractionResult, NAMResult, NAMExtractionErrorCode } from "../types";
import { eq } from "drizzle-orm";

/**
 * Process a PDF document through the complete extraction pipeline.
 *
 * Pipeline stages:
 * 1. Extract text from PDF using AWS Textract (with retry)
 * 2. Extract NAMs from text using OpenAI GPT-4 (with retry)
 * 3. Validate each extracted NAM format
 * 4. Save results to database
 * 5. Track total processing time
 * 6. Clean up uploaded PDF file
 *
 * @param runId - The NAM extraction run ID from database
 * @param pdfPath - Path to the uploaded PDF file
 * @param fileName - Original filename (for logging)
 * @returns ExtractionResult with status, NAMs, page count, and processing time
 *
 * The function handles errors at each stage gracefully and updates
 * the database with appropriate status and error information.
 */
export async function processDocument(
  runId: string,
  pdfPath: string,
  fileName: string
): Promise<ExtractionResult> {
  const startTime = Date.now();
  let pageCount = 0;
  const extractedNAMs: NAMResult[] = [];
  let errorMessage: string | null = null;
  let errorCode: string | null = null;

  try {
    console.log(`[NAM PIPELINE] Starting extraction pipeline for: ${fileName} (runId: ${runId})`);

    // Update status to running
    await db
      .update(namExtractionRuns)
      .set({
        status: "running",
        stage: "ocr",
        progress: "10",
        updatedAt: new Date(),
      })
      .where(eq(namExtractionRuns.id, runId));

    // Stage 1: Extract text with AWS Textract (with retry)
    console.log("[NAM PIPELINE] Stage 1: Extracting text with AWS Textract...");
    let textByPage;
    try {
      textByPage = await retryWithBackoff(
        extractTextFromPDF,
        {
          maxAttempts: 3,
          backoffSeconds: [1, 2, 4],
        },
        pdfPath
      );
      pageCount = getPageCount(textByPage);
      console.log(`[NAM PIPELINE] Text extraction completed: ${pageCount} pages`);

      // Update progress
      await db
        .update(namExtractionRuns)
        .set({
          pageCount,
          progress: "40",
          updatedAt: new Date(),
        })
        .where(eq(namExtractionRuns.id, runId));
    } catch (error: any) {
      // Check if this is an UnsupportedDocumentException - try PDF-to-image fallback
      // Check both error.name and error.message since retry wrapper might modify the error
      const isUnsupportedDoc = error.name === "UnsupportedDocumentException" ||
                                (error.message && error.message.includes("UnsupportedDocumentException"));

      if (isUnsupportedDoc) {
        console.log("[NAM PIPELINE] UnsupportedDocumentException detected, attempting PDF-to-image fallback...");

        try {
          // Import the fallback function dynamically to avoid circular deps
          const { extractTextFromPDFViaImages } = await import("./textractService");

          textByPage = await extractTextFromPDFViaImages(pdfPath);
          pageCount = getPageCount(textByPage);
          console.log(`[NAM PIPELINE] Fallback succeeded: ${pageCount} pages extracted`);

          // Update progress and continue to Stage 2
          await db
            .update(namExtractionRuns)
            .set({
              pageCount,
              progress: "40",
              updatedAt: new Date(),
            })
            .where(eq(namExtractionRuns.id, runId));
        } catch (fallbackError: any) {
          errorMessage = `OCR extraction failed (including fallback): ${error.name}: ${error.message}`;
          errorCode = NAMExtractionErrorCode.OCR_FAILED;
          console.error(`[NAM PIPELINE] ${errorMessage}`);
          console.error(`[NAM PIPELINE] Fallback also failed:`, fallbackError.message);

          // Update database with failure
          const processingTimeMs = Date.now() - startTime;
          await db
            .update(namExtractionRuns)
            .set({
              status: "failed",
              errorMessage,
              errorCode,
              processingTimeMs,
              updatedAt: new Date(),
            })
            .where(eq(namExtractionRuns.id, runId));

          // Clean up file
          await cleanupFile(pdfPath);

          return {
            status: "failed",
            errorMessage,
            errorCode,
            processingTimeMs,
          };
        }
      } else {
        // For other errors, fail immediately
        errorMessage = `OCR extraction failed: ${error.name}: ${error.message}`;
        errorCode = NAMExtractionErrorCode.OCR_FAILED;
        console.error(`[NAM PIPELINE] ${errorMessage}`);

        // Update database with failure
        const processingTimeMs = Date.now() - startTime;
        await db
          .update(namExtractionRuns)
          .set({
            status: "failed",
            errorMessage,
            errorCode,
            processingTimeMs,
            updatedAt: new Date(),
          })
          .where(eq(namExtractionRuns.id, runId));

        // Clean up file
        await cleanupFile(pdfPath);

        return {
          status: "failed",
          errorMessage,
          errorCode,
          processingTimeMs,
        };
      }
    }

    // Stage 2: Extract NAMs with OpenAI GPT-4 (with retry)
    console.log("[NAM PIPELINE] Stage 2: Extracting NAMs with OpenAI GPT-4...");

    // Update progress
    await db
      .update(namExtractionRuns)
      .set({
        stage: "ai_extraction",
        progress: "60",
        updatedAt: new Date(),
      })
      .where(eq(namExtractionRuns.id, runId));

    let rawNAMs;
    try {
      rawNAMs = await retryWithBackoff(
        extractNAMsWithGPT4,
        {
          maxAttempts: 3,
          backoffSeconds: [1, 2, 4],
        },
        textByPage
      );
      console.log(`[NAM PIPELINE] NAM extraction completed: ${rawNAMs.length} NAMs found`);
    } catch (error: any) {
      errorMessage = `AI extraction failed: ${error.name}: ${error.message}`;
      errorCode = NAMExtractionErrorCode.AI_EXTRACTION_FAILED;
      console.error(`[NAM PIPELINE] ${errorMessage}`);

      // Update database with failure
      const processingTimeMs = Date.now() - startTime;
      await db
        .update(namExtractionRuns)
        .set({
          status: "failed",
          errorMessage,
          errorCode,
          pageCount,
          processingTimeMs,
          updatedAt: new Date(),
        })
        .where(eq(namExtractionRuns.id, runId));

      // Clean up file
      await cleanupFile(pdfPath);

      return {
        status: "failed",
        errorMessage,
        errorCode,
        pageCount,
        processingTimeMs,
      };
    }

    // Stage 3: Validate each NAM format
    console.log("[NAM PIPELINE] Stage 3: Validating NAM formats...");

    // Update progress
    await db
      .update(namExtractionRuns)
      .set({
        stage: "validation",
        progress: "80",
        updatedAt: new Date(),
      })
      .where(eq(namExtractionRuns.id, runId));

    for (const rawNAM of rawNAMs) {
      const namString = rawNAM.nam || "";
      const page = rawNAM.page || 1;

      // Normalize NAM to uppercase
      const normalizedNAM = normalizeNAM(namString);

      // Validate format
      const [isValid, validationError] = validateNAMFormat(normalizedNAM);

      // Create NAM result
      const namResult: NAMResult = {
        nam: normalizedNAM,
        page,
        valid: isValid,
        validationError: isValid ? undefined : validationError,
      };

      extractedNAMs.push(namResult);

      if (!isValid) {
        console.warn(`[NAM PIPELINE] Invalid NAM format: ${normalizedNAM} - ${validationError}`);
      }
    }

    // Calculate processing time
    const processingTimeMs = Date.now() - startTime;
    const validNAMs = extractedNAMs.filter((n) => n.valid);

    console.log(
      `[NAM PIPELINE] Extraction pipeline completed: ${extractedNAMs.length} NAMs ` +
        `(${validNAMs.length} valid) in ${processingTimeMs}ms`
    );

    // Stage 4: Save results to database
    await db
      .update(namExtractionRuns)
      .set({
        status: "completed",
        namsFound: extractedNAMs.length,
        namsValid: validNAMs.length,
        processingTimeMs,
        progress: "100",
        updatedAt: new Date(),
      })
      .where(eq(namExtractionRuns.id, runId));

    // Insert NAM results
    for (const namResult of extractedNAMs) {
      await db.insert(namExtractionResults).values({
        runId,
        nam: namResult.nam,
        page: namResult.page,
        valid: namResult.valid,
        validationError: namResult.validationError || null,
      });
    }

    // Clean up file
    await cleanupFile(pdfPath);

    // Return success result
    return {
      status: "completed",
      nams: extractedNAMs,
      pageCount,
      processingTimeMs,
    };
  } catch (error: any) {
    // Catch any unexpected errors
    errorMessage = `Unexpected error: ${error.name}: ${error.message}`;
    errorCode = NAMExtractionErrorCode.INTERNAL_ERROR;
    console.error(`[NAM PIPELINE] ${errorMessage}`, error);

    const processingTimeMs = Date.now() - startTime;

    // Update database with failure
    await db
      .update(namExtractionRuns)
      .set({
        status: "failed",
        errorMessage,
        errorCode,
        pageCount,
        processingTimeMs,
        updatedAt: new Date(),
      })
      .where(eq(namExtractionRuns.id, runId));

    // Clean up file
    await cleanupFile(pdfPath);

    return {
      status: "failed",
      errorMessage,
      errorCode,
      pageCount,
      processingTimeMs,
    };
  }
}

/**
 * Clean up uploaded PDF file.
 *
 * @param filePath - Path to the file to delete
 */
async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
    console.log(`[NAM PIPELINE] Cleaned up file: ${path.basename(filePath)}`);
  } catch (error: any) {
    // Log error but don't throw - cleanup failure shouldn't break the pipeline
    console.warn(`[NAM PIPELINE] Failed to cleanup file ${filePath}: ${error.message}`);
  }
}
