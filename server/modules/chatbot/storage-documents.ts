/**
 * Document Storage Layer
 *
 * Database operations for documents and chunks in RAG system.
 */

import { db } from '../../core/db';
import {
  documents,
  documentChunks,
  type Document,
  type DocumentChunk,
  type InsertDocument,
  type InsertDocumentChunk,
} from '@shared/schema';
import { eq, desc, and, or, sql, count } from 'drizzle-orm';

// ==================== Document Operations ====================

/**
 * Get all documents
 */
export async function getAllDocuments(): Promise<Document[]> {
  return await db
    .select()
    .from(documents)
    .orderBy(desc(documents.createdAt));
}

/**
 * Get document by ID
 */
export async function getDocumentById(id: string): Promise<Document | null> {
  const results = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  return results[0] || null;
}

/**
 * Get document by file path
 */
export async function getDocumentByFilePath(filePath: string): Promise<Document | null> {
  const results = await db
    .select()
    .from(documents)
    .where(eq(documents.filePath, filePath))
    .limit(1);

  return results[0] || null;
}

/**
 * Get documents by status
 */
export async function getDocumentsByStatus(status: 'pending' | 'processing' | 'completed' | 'error'): Promise<Document[]> {
  return await db
    .select()
    .from(documents)
    .where(eq(documents.status, status))
    .orderBy(desc(documents.createdAt));
}

/**
 * Get documents by category
 */
export async function getDocumentsByCategory(
  category: 'ramq-official' | 'billing-guides' | 'code-references' | 'regulations' | 'faq'
): Promise<Document[]> {
  return await db
    .select()
    .from(documents)
    .where(eq(documents.category, category))
    .orderBy(desc(documents.createdAt));
}

/**
 * Create document
 */
export async function createDocument(data: InsertDocument): Promise<Document> {
  const results = await db
    .insert(documents)
    .values(data)
    .returning();

  return results[0];
}

/**
 * Update document status
 */
export async function updateDocumentStatus(
  id: string,
  status: 'pending' | 'processing' | 'completed' | 'error',
  errorMessage?: string
): Promise<void> {
  await db
    .update(documents)
    .set({
      status,
      errorMessage: errorMessage || null,
      processedAt: status === 'completed' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id));
}

/**
 * Update document
 */
export async function updateDocument(id: string, data: Partial<InsertDocument>): Promise<void> {
  await db
    .update(documents)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, id));
}

/**
 * Delete document (cascade deletes chunks)
 */
export async function deleteDocument(id: string): Promise<void> {
  await db
    .delete(documents)
    .where(eq(documents.id, id));
}

/**
 * Check if document exists by file hash
 */
export async function documentExistsByHash(fileHash: string): Promise<Document | null> {
  const results = await db
    .select()
    .from(documents)
    .where(eq(documents.fileHash, fileHash))
    .limit(1);

  return results[0] || null;
}

// ==================== Chunk Operations ====================

/**
 * Get chunks for document
 */
export async function getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
  return await db
    .select()
    .from(documentChunks)
    .where(eq(documentChunks.documentId, documentId))
    .orderBy(documentChunks.chunkIndex);
}

/**
 * Create chunk
 */
export async function createChunk(data: InsertDocumentChunk): Promise<DocumentChunk> {
  const results = await db
    .insert(documentChunks)
    .values(data)
    .returning();

  return results[0];
}

/**
 * Create multiple chunks (batch insert)
 */
export async function createChunksBatch(chunks: InsertDocumentChunk[]): Promise<DocumentChunk[]> {
  if (chunks.length === 0) {
    return [];
  }

  return await db
    .insert(documentChunks)
    .values(chunks)
    .returning();
}

/**
 * Delete all chunks for document
 */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  await db
    .delete(documentChunks)
    .where(eq(documentChunks.documentId, documentId));
}

/**
 * Get chunk count for document
 */
export async function getChunkCount(documentId: string): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(documentChunks)
    .where(eq(documentChunks.documentId, documentId));

  return result[0]?.count || 0;
}

// ==================== Statistics ====================

/**
 * Get document statistics
 */
export async function getDocumentStats(): Promise<{
  totalDocuments: number;
  totalChunks: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
}> {
  // Total documents
  const totalDocsResult = await db
    .select({ count: count() })
    .from(documents);
  const totalDocuments = totalDocsResult[0]?.count || 0;

  // Total chunks
  const totalChunksResult = await db
    .select({ count: count() })
    .from(documentChunks);
  const totalChunks = totalChunksResult[0]?.count || 0;

  // By status
  const byStatusResult = await db
    .select({
      status: documents.status,
      count: count(),
    })
    .from(documents)
    .groupBy(documents.status);

  const byStatus: Record<string, number> = {};
  byStatusResult.forEach(row => {
    byStatus[row.status] = row.count;
  });

  // By category
  const byCategoryResult = await db
    .select({
      category: documents.category,
      count: count(),
    })
    .from(documents)
    .groupBy(documents.category);

  const byCategory: Record<string, number> = {};
  byCategoryResult.forEach(row => {
    byCategory[row.category] = row.count;
  });

  // By type
  const byTypeResult = await db
    .select({
      fileType: documents.fileType,
      count: count(),
    })
    .from(documents)
    .groupBy(documents.fileType);

  const byType: Record<string, number> = {};
  byTypeResult.forEach(row => {
    byType[row.fileType] = row.count;
  });

  return {
    totalDocuments,
    totalChunks,
    byStatus,
    byCategory,
    byType,
  };
}

// ==================== Vector Search (placeholder for when pgvector is installed) ====================

/**
 * Search chunks by semantic similarity (placeholder)
 *
 * Note: Requires pgvector extension to be installed
 * Will return empty array until embedding column is added
 */
export async function searchChunksBySimilarity(
  queryEmbedding: number[],
  limit: number = 5,
  minSimilarity: number = 0.7
): Promise<Array<DocumentChunk & { similarity: number }>> {
  // TODO: Implement when pgvector is installed
  // Example query:
  // SELECT *, (embedding <=> $queryEmbedding) as similarity
  // FROM document_chunks
  // WHERE (embedding <=> $queryEmbedding) < $minSimilarity
  // ORDER BY similarity
  // LIMIT $limit

  console.warn('[DocumentStorage] Vector search not yet implemented - pgvector extension required');
  return [];
}

/**
 * Search chunks by keyword (fallback until pgvector is installed)
 *
 * Performs full-text search on chunk content for keywords
 */
export async function searchChunksByKeywords(
  query: string,
  limit: number = 5
): Promise<Array<DocumentChunk & { document: { filename: string; category: string } }>> {
  const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);

  if (keywords.length === 0) {
    return [];
  }

  // Build LIKE conditions for each keyword
  const conditions = keywords.map(keyword =>
    sql`LOWER(${documentChunks.content}) LIKE ${`%${keyword}%`}`
  );

  const results = await db
    .select({
      id: documentChunks.id,
      documentId: documentChunks.documentId,
      chunkIndex: documentChunks.chunkIndex,
      content: documentChunks.content,
      tokenCount: documentChunks.tokenCount,
      sectionTitle: documentChunks.sectionTitle,
      pageNumber: documentChunks.pageNumber,
      isOverlap: documentChunks.isOverlap,
      embeddingPending: documentChunks.embeddingPending,
      metadata: documentChunks.metadata,
      createdAt: documentChunks.createdAt,
      document: {
        filename: documents.filename,
        category: documents.category,
      },
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(
      and(
        eq(documents.status, 'completed'),
        or(...conditions)
      )
    )
    .orderBy(desc(documentChunks.tokenCount)) // Prefer longer, more detailed chunks
    .limit(limit);

  return results;
}
