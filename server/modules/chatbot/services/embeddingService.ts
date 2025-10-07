/**
 * Embedding Service
 *
 * Generates vector embeddings using Ollama API for semantic search.
 * Uses nomic-embed-text model (768 dimensions) optimized for RAG.
 */

import { log } from '../../../vite';

// ==================== Types ====================

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingResponse {
  success: boolean;
  embedding?: number[];
  error?: string;
  metadata?: {
    model: string;
    duration_ms: number;
    dimensions: number;
  };
}

// ==================== Configuration ====================

const OLLAMA_CONFIG = {
  host: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text',
  timeout: parseInt(process.env.OLLAMA_TIMEOUT || '30000'),
  dimensions: 768, // nomic-embed-text uses 768 dimensions
};

// ==================== Embedding Service ====================

/**
 * Generate embedding for text using Ollama
 *
 * @param request - Text to embed and optional model
 * @returns Embedding vector and metadata
 */
export async function generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
  const startTime = Date.now();
  const model = request.model || OLLAMA_CONFIG.embeddingModel;

  // Validate input
  if (!request.text || request.text.trim().length === 0) {
    return {
      success: false,
      error: 'Text cannot be empty',
    };
  }

  log(`[EmbeddingService] Generating embedding for text (${request.text.length} chars) with model ${model}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_CONFIG.timeout);

    const response = await fetch(`${OLLAMA_CONFIG.host}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: request.text,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const duration = Date.now() - startTime;

    // Validate embedding
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error('Invalid embedding response from Ollama');
    }

    log(`[EmbeddingService] Embedding generated in ${duration}ms (${data.embedding.length} dimensions)`);

    return {
      success: true,
      embedding: data.embedding,
      metadata: {
        model,
        duration_ms: duration,
        dimensions: data.embedding.length,
      },
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = handleError(error);

    log(`[EmbeddingService] Embedding generation failed after ${duration}ms: ${errorMessage}`);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Generate embeddings for multiple texts in batch
 *
 * @param texts - Array of texts to embed
 * @param options - Optional model and rate limiting
 * @returns Array of embedding responses
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  options: {
    model?: string;
    delayMs?: number; // Delay between requests to avoid overwhelming Ollama
  } = {}
): Promise<EmbeddingResponse[]> {
  const startTime = Date.now();
  const delayMs = options.delayMs || 100; // Default 100ms between requests

  log(`[EmbeddingService] Generating ${texts.length} embeddings in batch`);

  const embeddings: EmbeddingResponse[] = [];

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const embedding = await generateEmbedding({ text, model: options.model });
    embeddings.push(embedding);

    // Rate limiting delay (except for last item)
    if (i < texts.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  const duration = Date.now() - startTime;
  const successCount = embeddings.filter(e => e.success).length;

  log(`[EmbeddingService] Batch complete: ${successCount}/${texts.length} successful in ${duration}ms`);

  return embeddings;
}

/**
 * Check if Ollama embedding service is available
 *
 * @returns Health check result
 */
export async function checkEmbeddingService(): Promise<{
  available: boolean;
  model: string;
  error?: string;
}> {
  try {
    // Try to generate a small test embedding
    const result = await generateEmbedding({ text: 'test' });

    return {
      available: result.success,
      model: OLLAMA_CONFIG.embeddingModel,
      error: result.error,
    };
  } catch (error) {
    return {
      available: false,
      model: OLLAMA_CONFIG.embeddingModel,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get embedding service configuration
 */
export function getEmbeddingConfig() {
  return {
    host: OLLAMA_CONFIG.host,
    model: OLLAMA_CONFIG.embeddingModel,
    dimensions: OLLAMA_CONFIG.dimensions,
    timeout: OLLAMA_CONFIG.timeout,
  };
}

// ==================== Helper Functions ====================

/**
 * Handle errors and provide user-friendly messages
 */
function handleError(error: unknown): string {
  if (error instanceof Error) {
    // Timeout error
    if (error.name === 'AbortError') {
      return `Request timed out after ${OLLAMA_CONFIG.timeout}ms. The embedding model may be busy.`;
    }

    // Network errors
    if (error.message.includes('ECONNREFUSED')) {
      return 'Cannot connect to Ollama service. Please ensure Ollama is running.';
    }

    if (error.message.includes('ETIMEDOUT')) {
      return 'Connection to Ollama service timed out.';
    }

    // HTTP errors
    if (error.message.startsWith('HTTP')) {
      return `Ollama service error: ${error.message}`;
    }

    return error.message;
  }

  return 'An unknown error occurred while generating embeddings.';
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate cosine similarity between two embeddings
 *
 * @param embedding1 - First embedding vector
 * @param embedding2 - Second embedding vector
 * @returns Cosine similarity (0-1, higher is more similar)
 */
export function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have same dimensions');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);

  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}
