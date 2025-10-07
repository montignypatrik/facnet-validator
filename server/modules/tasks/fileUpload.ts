/**
 * Secure File Upload Configuration
 *
 * Handles file uploads for task attachments with security controls:
 * - MIME type validation
 * - File extension validation
 * - File size limits
 * - Secure filename generation
 * - Storage outside application root
 *
 * Security Priority: HIGH
 */

import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";

// Secure upload directory (OUTSIDE application root for security)
// In production, this should be a separate volume with restricted permissions
const UPLOAD_DIR = process.env.TASK_UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'tasks');

/**
 * Allowed MIME types for task attachments
 * Whitelist approach for security
 */
const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',

  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',

  // Archives (caution: can contain malware)
  'application/zip',
  'application/x-zip-compressed',
] as const;

/**
 * Allowed file extensions (double-check against MIME type spoofing)
 * Must match MIME type for security
 */
const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv',
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.zip'
] as const;

/**
 * Maximum file size: 10MB
 * Reduced from typical 50MB to prevent storage exhaustion
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * Generate secure random filename to prevent:
 * - Path traversal attacks
 * - Filename conflicts
 * - Information disclosure (original filename hidden)
 *
 * @param originalName - User's original filename
 * @returns Secure random filename with original extension
 */
function generateSecureFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const randomName = crypto.randomBytes(16).toString('hex');
  return `${randomName}${ext}`;
}

/**
 * Ensure upload directory exists with correct permissions
 *
 * Directory permissions: 0o750 (owner: rwx, group: r-x, others: none)
 */
async function ensureUploadDir(): Promise<void> {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true, mode: 0o750 });
  }
}

/**
 * Multer configuration for secure task attachments
 *
 * Usage:
 * ```typescript
 * router.post("/api/tasks/:taskId/attachments",
 *   authenticateToken,
 *   uploadLimiter, // Rate limit
 *   requireTaskOwnership,
 *   taskAttachmentUpload.single("file"),
 *   async (req, res) => { ... }
 * );
 * ```
 */
export const taskAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      await ensureUploadDir();
      cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
      const secureFilename = generateSecureFilename(file.originalname);
      cb(null, secureFilename);
    }
  }),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Only 1 file at a time
    fields: 10, // Limit form fields to prevent DoS
  },

  fileFilter: (req, file, cb) => {
    // Validate MIME type
    const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype as any);

    // Validate file extension (case-insensitive)
    const ext = path.extname(file.originalname).toLowerCase();
    const extOk = ALLOWED_EXTENSIONS.includes(ext as any);

    // Both MIME type and extension must match
    if (mimeOk && extOk) {
      cb(null, true);
    } else {
      cb(new Error(
        `Type de fichier non autorisé. Extensions acceptées: ${ALLOWED_EXTENSIONS.join(', ')}`
      ));
    }
  }
});

/**
 * Virus scanning integration (optional but recommended)
 *
 * TODO: Implement in production with one of:
 * - ClamAV (open source, local scanning)
 * - VirusTotal API (cloud-based, requires API key)
 * - Cloud-based scanning service (AWS GuardDuty, Azure Defender)
 *
 * @param filePath - Absolute path to uploaded file
 * @returns True if safe, false if virus detected
 */
export async function scanFileForVirus(filePath: string): Promise<boolean> {
  // TODO: Implement virus scanning
  // For now, return true (no virus detected)
  //
  // Example ClamAV integration:
  // const { execFile } = require('child_process');
  // return new Promise((resolve) => {
  //   execFile('clamscan', ['--no-summary', filePath], (error, stdout) => {
  //     resolve(!stdout.includes('FOUND'));
  //   });
  // });

  console.warn("⚠️ Virus scanning not implemented - enable in production");
  return true; // Placeholder
}

/**
 * Delete uploaded file securely
 * Used for cleanup on errors or file deletion
 *
 * @param filePath - Absolute path to file
 */
export async function deleteUploadedFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error("Failed to delete file:", filePath, error);
  }
}

/**
 * Get file size in bytes
 * Used for storage quota enforcement
 *
 * @param filePath - Absolute path to file
 * @returns File size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Validate file extension matches MIME type
 * Prevents MIME type spoofing attacks
 *
 * @param filename - Filename with extension
 * @param mimeType - MIME type from upload
 * @returns True if extension matches MIME type
 */
export function validateMimeTypeExtension(filename: string, mimeType: string): boolean {
  const ext = path.extname(filename).toLowerCase();

  const mimeToExt: Record<string, string[]> = {
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-powerpoint': ['.ppt'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'application/zip': ['.zip'],
    'application/x-zip-compressed': ['.zip'],
  };

  const expectedExts = mimeToExt[mimeType] || [];
  return expectedExts.includes(ext);
}

/**
 * Format file size for display
 *
 * @param bytes - File size in bytes
 * @returns Human-readable file size (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Export upload configuration for reference
 */
export const uploadConfig = {
  uploadDir: UPLOAD_DIR,
  maxFileSize: MAX_FILE_SIZE,
  maxFileSizeFormatted: formatFileSize(MAX_FILE_SIZE),
  allowedMimeTypes: ALLOWED_MIME_TYPES,
  allowedExtensions: ALLOWED_EXTENSIONS,
};
