/**
 * Chatbot Module Routes
 *
 * API endpoints for the medical billing AI chatbot powered by Ollama.
 */

import { Router, type Request, type Response } from "express";
import { ollamaService, type OllamaRequest } from "./services/ollamaService";
import { log } from "../../vite";

const router = Router();

/**
 * POST /api/chatbot/query
 *
 * Send a question to the medical billing chatbot and receive an AI-generated response.
 *
 * Request body:
 * {
 *   "prompt": "What is CPT coding?",
 *   "model": "llama3.2:3b" (optional),
 *   "options": {
 *     "temperature": 0.7 (optional),
 *     "max_tokens": 500 (optional)
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "response": "CPT coding is...",
 *   "model": "llama3.2:3b",
 *   "metadata": {
 *     "duration_ms": 5234,
 *     "prompt_length": 20,
 *     "response_length": 450,
 *     "model": "llama3.2:3b",
 *     "timestamp": "2025-10-03T12:34:56Z"
 *   }
 * }
 */
router.post("/api/chatbot/query", async (req: Request, res: Response) => {
  try {
    const { prompt, model, options } = req.body as OllamaRequest;

    // Validate request
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: prompt",
      });
    }

    if (typeof prompt !== "string") {
      return res.status(400).json({
        success: false,
        error: "Field 'prompt' must be a string",
      });
    }

    if (prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Prompt cannot be empty",
      });
    }

    // Log incoming request
    log(`[Chatbot] Received query: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);

    // Call Ollama service
    const result = await ollamaService.query({ prompt, model, options });

    // Return response
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log(`[Chatbot] Error processing query: ${errorMessage}`);

    res.status(500).json({
      success: false,
      error: "Internal server error while processing your request",
      metadata: {
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /api/chatbot/health
 *
 * Check if the Ollama service is healthy and responding.
 *
 * Response:
 * {
 *   "healthy": true,
 *   "version": "0.12.3",
 *   "timestamp": "2025-10-03T12:34:56Z"
 * }
 */
router.get("/api/chatbot/health", async (req: Request, res: Response) => {
  try {
    const healthStatus = await ollamaService.healthCheck();

    if (healthStatus.healthy) {
      res.json(healthStatus);
    } else {
      res.status(503).json(healthStatus); // 503 Service Unavailable
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log(`[Chatbot] Health check error: ${errorMessage}`);

    res.status(500).json({
      healthy: false,
      error: "Failed to check Ollama service health",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/chatbot/config
 *
 * Get current Ollama service configuration.
 *
 * Response:
 * {
 *   "host": "http://127.0.0.1:11434",
 *   "model": "llama3.2:3b",
 *   "timeout": 30000,
 *   "temperature": 0.7,
 *   "max_tokens": 500
 * }
 */
router.get("/api/chatbot/config", (req: Request, res: Response) => {
  try {
    const config = ollamaService.getConfig();
    res.json(config);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log(`[Chatbot] Config error: ${errorMessage}`);

    res.status(500).json({
      error: "Failed to retrieve configuration",
    });
  }
});

/**
 * POST /api/chatbot/test
 *
 * Run a series of validation tests on the Ollama service.
 * This endpoint is for development/debugging purposes.
 *
 * Request body:
 * {
 *   "iterations": 5 (optional, default: 5)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "tests": {
 *     "health_check": { ... },
 *     "simple_query": { ... },
 *     "medical_query": { ... },
 *     "sequential_requests": [ ... ]
 *   }
 * }
 */
router.post("/api/chatbot/test", async (req: Request, res: Response) => {
  try {
    const iterations = req.body.iterations || 5;
    const results: any = {
      success: true,
      tests: {},
    };

    // Test 1: Health Check
    log("[Chatbot] Running Test 1: Health Check");
    results.tests.health_check = await ollamaService.healthCheck();

    // Test 2: Simple Query
    log("[Chatbot] Running Test 2: Simple Query");
    results.tests.simple_query = await ollamaService.query({
      prompt: "What is 2+2?",
    });

    // Test 3: Medical Billing Query
    log("[Chatbot] Running Test 3: Medical Billing Query");
    results.tests.medical_query = await ollamaService.query({
      prompt: "What is CPT coding?",
    });

    // Test 4: Sequential Requests (check for memory leaks)
    log(`[Chatbot] Running Test 4: ${iterations} Sequential Requests`);
    results.tests.sequential_requests = [];

    for (let i = 0; i < iterations; i++) {
      const result = await ollamaService.query({
        prompt: `Test question ${i + 1}: Explain medical billing in one sentence.`,
      });

      results.tests.sequential_requests.push({
        iteration: i + 1,
        success: result.success,
        duration_ms: result.metadata?.duration_ms,
        response_length: result.metadata?.response_length,
      });
    }

    // Test 5: Timeout Test (very short timeout)
    log("[Chatbot] Running Test 5: Timeout Handling");
    const ollamaServiceTimeout = new (ollamaService.constructor as any)();
    ollamaServiceTimeout.timeout = 1; // 1ms timeout (will definitely timeout)

    results.tests.timeout_handling = await ollamaServiceTimeout.query({
      prompt: "This should timeout",
    });

    // Calculate summary statistics
    const successfulRequests = results.tests.sequential_requests.filter((r: any) => r.success).length;
    const avgDuration = results.tests.sequential_requests.reduce((sum: number, r: any) => sum + (r.duration_ms || 0), 0) / iterations;

    results.summary = {
      total_tests: 5,
      sequential_requests: iterations,
      successful_requests: successfulRequests,
      failed_requests: iterations - successfulRequests,
      average_duration_ms: Math.round(avgDuration),
    };

    res.json(results);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log(`[Chatbot] Test error: ${errorMessage}`);

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

export default router;
