/**
 * File Scanner Service
 *
 * Scans knowledge/ directory for documents and tracks changes.
 * Uses SHA256 hashing to detect when files are updated.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { log } from '../../../vite';

// ==================== Types ====================

export interface ScannedFile {
  filename: string;
  filePath: string; // Relative path from knowledge/
  absolutePath: string;
  fileType: 'html' | 'pdf';
  category: 'ramq-official' | 'billing-guides' | 'code-references' | 'regulations' | 'faq';
  fileHash: string; // SHA256 hash
  fileSizeBytes: number;
}

export interface ScanResult {
  files: ScannedFile[];
  totalFiles: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  errors: Array<{ file: string; error: string }>;
}

// ==================== Constants ====================

const KNOWLEDGE_BASE_PATH = path.join(process.cwd(), 'server', 'modules', 'chatbot', 'knowledge');

const SUPPORTED_EXTENSIONS = ['.html', '.htm', '.pdf'];

const CATEGORIES = [
  'ramq-official',
  'billing-guides',
  'code-references',
  'regulations',
  'faq',
] as const;

// ==================== File Scanning ====================

/**
 * Scan knowledge/ directory for documents
 *
 * @param baseDir - Base directory to scan (defaults to knowledge/)
 * @returns Scan result with all files found
 */
export async function scanKnowledgeDirectory(baseDir?: string): Promise<ScanResult> {
  const startTime = Date.now();
  const scanDir = baseDir || KNOWLEDGE_BASE_PATH;

  log(`[FileScanner] Scanning directory: ${scanDir}`);

  const result: ScanResult = {
    files: [],
    totalFiles: 0,
    byCategory: {},
    byType: {},
    errors: [],
  };

  try {
    // Scan each category folder
    for (const category of CATEGORIES) {
      const categoryPath = path.join(scanDir, category);

      try {
        await fs.access(categoryPath);
        const files = await scanDirectory(categoryPath, category, scanDir);
        result.files.push(...files);
      } catch (error) {
        // Category folder doesn't exist, skip it
        log(`[FileScanner] Category folder not found: ${category}`);
      }
    }

    // Calculate statistics
    result.totalFiles = result.files.length;

    result.files.forEach(file => {
      result.byCategory[file.category] = (result.byCategory[file.category] || 0) + 1;
      result.byType[file.fileType] = (result.byType[file.fileType] || 0) + 1;
    });

    const duration = Date.now() - startTime;
    log(`[FileScanner] Scan complete: ${result.totalFiles} files found in ${duration}ms`);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`[FileScanner] Scan failed: ${errorMessage}`);
    throw new Error(`Failed to scan knowledge directory: ${errorMessage}`);
  }
}

/**
 * Recursively scan directory for supported files
 */
async function scanDirectory(
  dirPath: string,
  category: typeof CATEGORIES[number],
  baseDir: string
): Promise<ScannedFile[]> {
  const files: ScannedFile[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subFiles = await scanDirectory(fullPath, category, baseDir);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();

        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          try {
            const scannedFile = await processFile(fullPath, category, baseDir);
            files.push(scannedFile);
          } catch (error) {
            log(`[FileScanner] Error processing file ${entry.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }
    }
  } catch (error) {
    log(`[FileScanner] Error scanning directory ${dirPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return files;
}

/**
 * Process individual file and extract metadata
 */
async function processFile(
  absolutePath: string,
  category: typeof CATEGORIES[number],
  baseDir: string
): Promise<ScannedFile> {
  const filename = path.basename(absolutePath);
  const relativePath = path.relative(baseDir, absolutePath);
  const ext = path.extname(filename).toLowerCase();

  // Get file stats
  const stats = await fs.stat(absolutePath);

  // Calculate SHA256 hash
  const fileHash = await calculateFileHash(absolutePath);

  // Determine file type
  const fileType = ext === '.pdf' ? 'pdf' : 'html';

  return {
    filename,
    filePath: relativePath.replace(/\\/g, '/'), // Normalize path separators
    absolutePath,
    fileType,
    category,
    fileHash,
    fileSizeBytes: stats.size,
  };
}

/**
 * Calculate SHA256 hash of file
 */
async function calculateFileHash(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Check if file has changed by comparing hash
 *
 * @param filePath - Path to file
 * @param previousHash - Previously stored hash
 * @returns true if file has changed
 */
export async function hasFileChanged(filePath: string, previousHash: string): Promise<boolean> {
  try {
    const currentHash = await calculateFileHash(filePath);
    return currentHash !== previousHash;
  } catch (error) {
    // File might not exist anymore
    return true;
  }
}

/**
 * Get file info without full directory scan
 */
export async function getFileInfo(filePath: string): Promise<ScannedFile | null> {
  try {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(KNOWLEDGE_BASE_PATH, filePath);

    // Determine category from path
    const relativePath = path.relative(KNOWLEDGE_BASE_PATH, absolutePath);
    const parts = relativePath.split(path.sep);
    const category = parts[0] as typeof CATEGORIES[number];

    if (!CATEGORIES.includes(category)) {
      throw new Error(`Invalid category: ${category}`);
    }

    const ext = path.extname(absolutePath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    return await processFile(absolutePath, category, KNOWLEDGE_BASE_PATH);
  } catch (error) {
    log(`[FileScanner] Error getting file info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

/**
 * Get knowledge base path
 */
export function getKnowledgeBasePath(): string {
  return KNOWLEDGE_BASE_PATH;
}
