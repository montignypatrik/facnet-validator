/**
 * Chunking Service
 *
 * Splits documents into overlapping chunks for RAG retrieval.
 * Maintains context between chunks and preserves document structure.
 */

import { encoding_for_model } from '@dqbd/tiktoken';
import { log } from '../../../vite';
import type { ParsedDocument, DocumentSection } from './documentProcessor';

// ==================== Types ====================

export interface TextChunk {
  content: string;
  tokenCount: number;
  chunkIndex: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  sectionHeading?: string;
  pageNumber?: number;
  hasOverlap: boolean;
  [key: string]: any;
}

export interface ChunkingOptions {
  minTokens?: number; // Minimum chunk size
  maxTokens?: number; // Maximum chunk size
  overlapTokens?: number; // Overlap between chunks
}

// ==================== Constants ====================

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  minTokens: 500,
  maxTokens: 1000,
  overlapTokens: 150, // Middle of 100-200 range
};

// Initialize tiktoken encoder (cl100k_base for GPT-3.5/4)
const encoder = encoding_for_model('gpt-3.5-turbo');

// ==================== Token Counting ====================

/**
 * Count tokens in text using tiktoken
 *
 * @param text - Text to count tokens for
 * @returns Number of tokens
 */
export function countTokens(text: string): number {
  try {
    const tokens = encoder.encode(text);
    return tokens.length;
  } catch (error) {
    // Fallback: approximate 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}

/**
 * Get last N tokens from text
 *
 * @param text - Text to extract from
 * @param tokenCount - Number of tokens to extract
 * @returns Text containing last N tokens
 */
function getLastNTokens(text: string, tokenCount: number): string {
  try {
    const tokens = encoder.encode(text);
    if (tokens.length <= tokenCount) {
      return text;
    }

    const lastTokens = tokens.slice(-tokenCount);
    const decoded = encoder.decode(lastTokens);
    return Buffer.from(decoded).toString('utf-8');
  } catch (error) {
    // Fallback: approximate by characters
    const charCount = tokenCount * 4;
    return text.slice(-charCount);
  }
}

// ==================== Sentence Splitting ====================

/**
 * Split text into sentences (handles French punctuation)
 *
 * @param text - Text to split
 * @returns Array of sentences
 */
function splitIntoSentences(text: string): string[] {
  // French sentence endings: . ! ? ... « » closing
  // Handle abbreviations like "M.", "Dr.", "etc."
  const sentenceRegex = /([^.!?«»]+[.!?»]+|[^.!?«»]+$)/g;
  const sentences = text.match(sentenceRegex) || [text];

  return sentences
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// ==================== Chunking Logic ====================

/**
 * Create chunks from a section with overlap
 *
 * @param section - Document section to chunk
 * @param options - Chunking options
 * @param previousOverlap - Overlap text from previous chunk
 * @returns Array of chunks and remaining overlap
 */
function chunkSection(
  section: DocumentSection,
  options: Required<ChunkingOptions>,
  previousOverlap: string = ''
): { chunks: TextChunk[]; overlap: string } {
  const sentences = splitIntoSentences(section.content);
  const chunks: TextChunk[] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;

  // Add previous overlap if exists
  if (previousOverlap) {
    currentChunk.push(previousOverlap);
    currentTokens = countTokens(previousOverlap);
  }

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);

    // Check if adding sentence would exceed max
    if (currentTokens + sentenceTokens > options.maxTokens && currentChunk.length > 0) {
      // Create chunk
      const chunkText = currentChunk.join(' ');
      chunks.push({
        content: chunkText,
        tokenCount: currentTokens,
        chunkIndex: chunks.length,
        metadata: {
          sectionHeading: section.heading,
          pageNumber: section.pageNumber,
          hasOverlap: previousOverlap !== '',
        },
      });

      // Prepare overlap for next chunk
      const overlap = getLastNTokens(chunkText, options.overlapTokens);
      currentChunk = [overlap, sentence];
      currentTokens = countTokens(overlap) + sentenceTokens;
      previousOverlap = overlap;
    } else {
      // Add sentence to current chunk
      currentChunk.push(sentence);
      currentTokens += sentenceTokens;
    }
  }

  // Add remaining chunk if it meets minimum size
  if (currentChunk.length > 0 && currentTokens >= options.minTokens) {
    chunks.push({
      content: currentChunk.join(' '),
      tokenCount: currentTokens,
      chunkIndex: chunks.length,
      metadata: {
        sectionHeading: section.heading,
        pageNumber: section.pageNumber,
        hasOverlap: previousOverlap !== '',
      },
    });

    // Get overlap for next section
    const lastChunkText = currentChunk.join(' ');
    previousOverlap = getLastNTokens(lastChunkText, options.overlapTokens);
  } else if (currentChunk.length > 0) {
    // Chunk too small, carry over to next section as overlap
    previousOverlap = currentChunk.join(' ');
  }

  return { chunks, overlap: previousOverlap };
}

// ==================== Main Chunking Function ====================

/**
 * Chunk parsed document into overlapping text chunks
 *
 * @param document - Parsed document
 * @param options - Chunking options (optional)
 * @returns Array of text chunks
 */
export function chunkDocument(document: ParsedDocument, options: ChunkingOptions = {}): TextChunk[] {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  log(`[ChunkingService] Chunking document: ${document.metadata.title} (${document.text.length} chars)`);

  const allChunks: TextChunk[] = [];
  let overlap = '';

  // Chunk each section
  for (const section of document.sections) {
    const { chunks, overlap: nextOverlap } = chunkSection(section, opts, overlap);
    allChunks.push(...chunks);
    overlap = nextOverlap;
  }

  // Re-index chunks sequentially
  allChunks.forEach((chunk, index) => {
    chunk.chunkIndex = index;
  });

  const duration = Date.now() - startTime;
  const totalTokens = allChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
  const avgTokens = Math.round(totalTokens / allChunks.length);

  log(`[ChunkingService] Created ${allChunks.length} chunks in ${duration}ms (avg ${avgTokens} tokens/chunk)`);

  return allChunks;
}

/**
 * Validate chunk meets requirements
 *
 * @param chunk - Chunk to validate
 * @param options - Chunking options
 * @returns true if valid
 */
export function validateChunk(chunk: TextChunk, options: ChunkingOptions = {}): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Check token count is within range
  if (chunk.tokenCount < opts.minTokens || chunk.tokenCount > opts.maxTokens) {
    return false;
  }

  // Check content is not empty
  if (!chunk.content || chunk.content.trim().length === 0) {
    return false;
  }

  // Check doesn't end mid-sentence (basic check)
  const lastChar = chunk.content.trim().slice(-1);
  if (!['.', '!', '?', '»'].includes(lastChar)) {
    // Allow if chunk is at max size (might be cut)
    return chunk.tokenCount >= opts.maxTokens * 0.9;
  }

  return true;
}

/**
 * Free tiktoken resources
 */
export function cleanup(): void {
  encoder.free();
}
