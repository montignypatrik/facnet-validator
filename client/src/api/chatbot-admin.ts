/**
 * Chatbot Admin API Client
 *
 * API functions for managing RAG knowledge documents
 */

import axios from "axios";

const API_BASE = "/api/chatbot/admin";

export interface Document {
  id: string;
  filename: string;
  filePath: string;
  fileType: "html" | "pdf";
  category: "ramq-official" | "billing-guides" | "code-references" | "regulations" | "faq";
  fileHash: string;
  fileSizeBytes: string;
  status: "pending" | "processing" | "completed" | "error";
  processedAt?: string;
  errorMessage?: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  sectionTitle?: string;
  pageNumber?: number;
  isOverlap: boolean;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface DocumentStats {
  totalDocuments: number;
  totalChunks: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface ProcessingJob {
  id: string;
  name: string;
  data: any;
  progress: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  state: string;
}

export interface ScannedFile {
  filename: string;
  filePath: string;
  fileType: "html" | "pdf";
  category: string;
  fileHash: string;
  fileSizeBytes: number;
}

/**
 * Get list of all documents with optional filtering
 */
export async function getDocuments(params?: {
  status?: string;
  category?: string;
  fileType?: string;
}): Promise<Document[]> {
  const response = await axios.get(API_BASE + "/documents", { params });
  return response.data.data;
}

/**
 * Get single document details with chunks
 */
export async function getDocument(id: string): Promise<{
  document: Document;
  chunks: DocumentChunk[];
}> {
  const response = await axios.get(`${API_BASE}/documents/${id}`);
  return response.data.data;
}

/**
 * Upload a new document file
 */
export async function uploadDocument(file: File, category: string): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);

  const response = await axios.post(`${API_BASE}/documents/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data;
}

/**
 * Trigger reprocessing of a document
 */
export async function reprocessDocument(id: string): Promise<void> {
  await axios.post(`${API_BASE}/documents/${id}/reprocess`);
}

/**
 * Delete a document (admin only)
 */
export async function deleteDocument(id: string): Promise<void> {
  await axios.delete(`${API_BASE}/documents/${id}`);
}

/**
 * Get document and queue statistics
 */
export async function getStats(): Promise<{
  documents: DocumentStats;
  queue: QueueStats;
}> {
  const response = await axios.get(`${API_BASE}/stats`);
  return response.data.data;
}

/**
 * Trigger directory scan for new files
 */
export async function scanDirectory(): Promise<{ jobId: string }> {
  const response = await axios.post(`${API_BASE}/scan`);
  return response.data.data;
}

/**
 * Trigger bulk import of all pending documents
 */
export async function bulkImport(): Promise<{ jobId: string }> {
  const response = await axios.post(`${API_BASE}/bulk-import`);
  return response.data.data;
}

/**
 * Get recent processing jobs
 */
export async function getRecentJobs(limit?: number): Promise<ProcessingJob[]> {
  const response = await axios.get(`${API_BASE}/jobs`, { params: { limit } });
  return response.data.data;
}

/**
 * Scan knowledge directory for files
 */
export async function scanFiles(): Promise<{
  files: ScannedFile[];
  totalFiles: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
}> {
  const response = await axios.get(`${API_BASE}/files`);
  return response.data.data;
}
