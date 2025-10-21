/**
 * AWS Textract integration service for OCR text extraction from PDF documents.
 *
 * Extracts text blocks from multi-page PDFs with page number tracking.
 * Uses AWS Textract AnalyzeDocument API which is more robust for handling
 * various PDF formats including HTML-to-PDF conversions.
 *
 * Fallback Strategy:
 * If direct PDF processing fails (UnsupportedDocumentException), the service
 * automatically converts the PDF to PNG images and processes those instead.
 */

import {
  TextractClient,
  AnalyzeDocumentCommand,
  Block,
} from "@aws-sdk/client-textract";
import fs from "fs/promises";
import path from "path";
import { pdfToPng } from "pdf-to-png-converter";
import { TextByPage } from "../types";

/**
 * Extract text from PDF using AWS Textract with page tracking.
 *
 * @param pdfPath - Path to the PDF file to process
 * @returns Dictionary mapping page number to list of text lines
 *          Example: {1: ['Line 1', 'Line 2'], 2: ['Line 3']}
 * @throws Error for AWS Textract errors (InvalidParameterException,
 *               ThrottlingException, ProvisionedThroughputExceededException)
 * @throws Error if PDF file does not exist
 *
 * This function:
 * - Reads the PDF file as bytes
 * - Sends it to AWS Textract for text detection
 * - Extracts only LINE blocks (ignores WORD and PAGE blocks)
 * - Tracks which page each text line was found on
 * - Returns organized text by page number
 */
export async function extractTextFromPDF(pdfPath: string): Promise<TextByPage> {
  const startTime = Date.now();

  // Verify file exists
  try {
    await fs.access(pdfPath);
  } catch {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  // Initialize Textract client
  const textractClient = new TextractClient({
    region: process.env.AWS_REGION || "ca-central-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  // Read PDF file as bytes
  const pdfBytes = await fs.readFile(pdfPath);

  console.log(`[TEXTRACT] Sending PDF to AWS Textract: ${pdfPath.split("/").pop()}`);

  try {
    // Call Textract AnalyzeDocument API
    // FeatureTypes: TABLES and FORMS provide robust text extraction
    // even for HTML-to-PDF conversions and complex document formats
    const command = new AnalyzeDocumentCommand({
      Document: { Bytes: pdfBytes },
      FeatureTypes: ["TABLES", "FORMS"],
    });

    const response = await textractClient.send(command);

    // Extract text blocks by page
    const textByPage: TextByPage = {};

    for (const block of response.Blocks || []) {
      // Only process LINE blocks (contains full line of text)
      if (block.BlockType === "LINE") {
        const page = block.Page || 1; // Default to page 1 if not specified
        const text = block.Text || "";

        if (!textByPage[page]) {
          textByPage[page] = [];
        }

        textByPage[page].push(text);
      }
    }

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalLines = Object.values(textByPage).reduce(
      (sum, lines) => sum + lines.length,
      0
    );

    console.log(
      `[TEXTRACT] AWS Textract completed in ${elapsedTime}s: ${Object.keys(textByPage).length} pages, ${totalLines} lines`
    );

    return textByPage;
  } catch (error: any) {
    const errorCode = error.name || "UnknownError";
    const errorMessage = error.message || "Unknown error";

    console.error(`[TEXTRACT] AWS Textract error [${errorCode}]: ${errorMessage}`);
    console.log(`[TEXTRACT DEBUG] Error object:`, JSON.stringify({ name: error.name, code: error.code, $metadata: error.$metadata?.httpStatusCode }));

    // If PDF format is unsupported, try converting to images as fallback
    if (errorCode === "UnsupportedDocumentException") {
      console.log("[TEXTRACT] Falling back to PDF-to-image conversion...");
      try {
        return await extractTextFromPDFAsImages(pdfPath, textractClient);
      } catch (fallbackError: any) {
        console.error("[TEXTRACT] Image fallback also failed:", fallbackError.message);
        throw error; // Re-throw original error
      }
    }

    // Re-raise the error - retry logic will handle transient errors
    throw error;
  }
}

/**
 * Fallback: Convert PDF to images and extract text from each image.
 *
 * This method is used when direct PDF processing fails due to unsupported
 * document formats (e.g., HTML-to-PDF conversions).
 *
 * @param pdfPath - Path to the PDF file to process
 * @param textractClient - Initialized AWS Textract client
 * @returns Dictionary mapping page number to list of text lines
 */
async function extractTextFromPDFAsImages(
  pdfPath: string,
  textractClient: TextractClient
): Promise<TextByPage> {
  const startTime = Date.now();

  console.log(`[TEXTRACT] Converting PDF to images: ${path.basename(pdfPath)}`);

  // Convert PDF to PNG images
  const pngPages = await pdfToPng(pdfPath, {
    outputFolder: path.dirname(pdfPath),
    outputFileMask: `temp_page`,
    viewportScale: 2.0, // Higher quality - processes all pages by default
  });

  console.log(`[TEXTRACT] Converted ${pngPages.length} pages to images`);

  const textByPage: TextByPage = {};

  try {
    // Process each page image with Textract
    for (let i = 0; i < pngPages.length; i++) {
      const pageNum = i + 1;
      const imagePath = pngPages[i].path;

      console.log(`[TEXTRACT] Processing image for page ${pageNum}...`);

      // Read image bytes
      const imageBytes = await fs.readFile(imagePath);

      // Send image to Textract
      const command = new AnalyzeDocumentCommand({
        Document: { Bytes: imageBytes },
        FeatureTypes: ["TABLES", "FORMS"],
      });

      const response = await textractClient.send(command);

      // Extract text blocks from this page
      textByPage[pageNum] = [];
      for (const block of response.Blocks || []) {
        if (block.BlockType === "LINE") {
          const text = block.Text || "";
          textByPage[pageNum].push(text);
        }
      }

      console.log(`[TEXTRACT] Page ${pageNum}: ${textByPage[pageNum].length} lines extracted`);

      // Clean up temporary image file
      try {
        await fs.unlink(imagePath);
      } catch (cleanupError) {
        console.warn(`[TEXTRACT] Failed to clean up temp image: ${imagePath}`);
      }
    }

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalLines = Object.values(textByPage).reduce(
      (sum, lines) => sum + lines.length,
      0
    );

    console.log(
      `[TEXTRACT] Image fallback completed in ${elapsedTime}s: ${pngPages.length} pages, ${totalLines} lines`
    );

    return textByPage;
  } catch (error) {
    // Clean up any remaining temp images on error
    for (const pngPage of pngPages) {
      try {
        await fs.unlink(pngPage.path);
      } catch {
        // Ignore cleanup errors
      }
    }
    throw error;
  }
}

/**
 * Public wrapper for PDF-to-image fallback extraction.
 * Can be called directly from the pipeline when UnsupportedDocumentException occurs.
 *
 * @param pdfPath - Path to the PDF file to process
 * @returns Dictionary mapping page number to list of text lines
 */
export async function extractTextFromPDFViaImages(pdfPath: string): Promise<TextByPage> {
  const textractClient = new TextractClient({
    region: process.env.AWS_REGION || "ca-central-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  return await extractTextFromPDFAsImages(pdfPath, textractClient);
}

/**
 * Get the total number of pages processed.
 *
 * @param textByPage - Dictionary mapping page number to text lines
 * @returns Number of pages (0 if empty)
 */
export function getPageCount(textByPage: TextByPage): number {
  return Object.keys(textByPage).length;
}

/**
 * Get the total number of text lines extracted.
 *
 * @param textByPage - Dictionary mapping page number to text lines
 * @returns Total number of text lines across all pages
 */
export function getTotalLines(textByPage: TextByPage): number {
  return Object.values(textByPage).reduce((sum, lines) => sum + lines.length, 0);
}
