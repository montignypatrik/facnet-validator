/**
 * Ollama Service Wrapper
 *
 * This service provides a type-safe, async wrapper around the Ollama API
 * for generating AI-powered responses in the medical billing chatbot.
 *
 * Features:
 * - Async/await API calls to Ollama
 * - Configurable timeouts (default 30s)
 * - Comprehensive error handling
 * - Request/response logging
 * - Health check functionality
 * - Medical billing context injection
 */

import { log } from "../../../vite";

// ==================== Types ====================

export interface OllamaRequest {
  prompt: string;
  model?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
}

export interface OllamaResponse {
  success: boolean;
  response?: string;
  model?: string;
  error?: string;
  metadata?: {
    duration_ms: number;
    prompt_length: number;
    response_length: number;
    model: string;
    timestamp: string;
  };
}

export interface OllamaHealthCheck {
  healthy: boolean;
  version?: string;
  error?: string;
  timestamp: string;
}

// ==================== Configuration ====================

const OLLAMA_CONFIG = {
  host: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
  model: process.env.OLLAMA_MODEL || "llama3.2:3b",
  timeout: parseInt(process.env.OLLAMA_TIMEOUT || "30000"), // 30 seconds default
  temperature: parseFloat(process.env.OLLAMA_TEMPERATURE || "0.7"),
  max_tokens: parseInt(process.env.OLLAMA_MAX_TOKENS || "500"),
};

// Medical billing context that gets prepended to user prompts
const MEDICAL_BILLING_CONTEXT = `You are a medical billing assistant specialized in Quebec healthcare billing (RAMQ system).
You help healthcare professionals understand:
- RAMQ billing codes and procedures
- CPT and ICD-10 coding standards
- Medical claim submission requirements
- Billing validation rules and compliance
- Quebec-specific healthcare regulations

Provide clear, accurate, and professional answers. If you're unsure about Quebec-specific details, acknowledge it.`;

// ==================== Ollama Service Class ====================

export class OllamaService {
  private baseUrl: string;
  private defaultModel: string;
  private timeout: number;

  constructor() {
    this.baseUrl = OLLAMA_CONFIG.host;
    this.defaultModel = OLLAMA_CONFIG.model;
    this.timeout = OLLAMA_CONFIG.timeout;

    log(`[OllamaService] Initialized with host: ${this.baseUrl}, model: ${this.defaultModel}`);
  }

  /**
   * Check if Ollama service is healthy and responding
   */
  async healthCheck(): Promise<OllamaHealthCheck> {
    const timestamp = new Date().toISOString();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout for health check

      const response = await fetch(`${this.baseUrl}/api/version`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          healthy: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          timestamp,
        };
      }

      const data = await response.json();

      return {
        healthy: true,
        version: data.version,
        timestamp,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      log(`[OllamaService] Health check failed: ${errorMessage}`);

      return {
        healthy: false,
        error: errorMessage,
        timestamp,
      };
    }
  }

  /**
   * Send a prompt to Ollama and get a response
   *
   * @param request - The request containing the prompt and optional parameters
   * @returns Response containing the generated text or error information
   */
  async query(request: OllamaRequest): Promise<OllamaResponse> {
    const startTime = Date.now();
    const model = request.model || this.defaultModel;

    // Validate prompt
    if (!request.prompt || request.prompt.trim().length === 0) {
      return {
        success: false,
        error: "Prompt cannot be empty",
        metadata: {
          duration_ms: Date.now() - startTime,
          prompt_length: 0,
          response_length: 0,
          model,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Add medical billing context to user prompt
    const contextualPrompt = `${MEDICAL_BILLING_CONTEXT}\n\nUser Question: ${request.prompt}\n\nAssistant:`;

    log(`[OllamaService] Sending query to model ${model} (prompt length: ${request.prompt.length})`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: contextualPrompt,
          stream: false, // Non-streaming for simplicity
          options: {
            temperature: request.options?.temperature ?? OLLAMA_CONFIG.temperature,
            top_p: request.options?.top_p ?? 0.9,
            num_predict: request.options?.max_tokens ?? OLLAMA_CONFIG.max_tokens,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      log(`[OllamaService] Query completed in ${duration}ms (response length: ${data.response?.length || 0})`);

      return {
        success: true,
        response: data.response,
        model,
        metadata: {
          duration_ms: duration,
          prompt_length: request.prompt.length,
          response_length: data.response?.length || 0,
          model,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = this.handleError(error);

      log(`[OllamaService] Query failed after ${duration}ms: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        metadata: {
          duration_ms: duration,
          prompt_length: request.prompt.length,
          response_length: 0,
          model,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Handle errors and provide user-friendly messages
   */
  private handleError(error: unknown): string {
    if (error instanceof Error) {
      // Timeout error
      if (error.name === "AbortError") {
        return `Request timed out after ${this.timeout}ms. The AI model may be busy or overloaded.`;
      }

      // Network errors
      if (error.message.includes("ECONNREFUSED")) {
        return "Cannot connect to Ollama service. Please ensure Ollama is running.";
      }

      if (error.message.includes("ETIMEDOUT")) {
        return "Connection to Ollama service timed out. Please try again.";
      }

      // HTTP errors
      if (error.message.startsWith("HTTP")) {
        return `Ollama service error: ${error.message}`;
      }

      return error.message;
    }

    return "An unknown error occurred while processing your request.";
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      host: this.baseUrl,
      model: this.defaultModel,
      timeout: this.timeout,
      temperature: OLLAMA_CONFIG.temperature,
      max_tokens: OLLAMA_CONFIG.max_tokens,
    };
  }
}

// ==================== Singleton Instance ====================

export const ollamaService = new OllamaService();
