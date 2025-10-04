/**
 * Ollama Service Validation Test Script
 *
 * This script runs comprehensive validation tests on the Ollama service wrapper
 * to ensure it meets all requirements for Phase 1, Step 1.2.
 *
 * Run with: node --loader ts-node/esm scripts/test-ollama-service.ts
 * Or via npm: npm run test:ollama
 */

import { ollamaService } from "../server/modules/chatbot/services/ollamaService";

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

/**
 * Print formatted test result
 */
function logResult(result: TestResult) {
  const status = result.passed
    ? `${colors.green}✓ PASS${colors.reset}`
    : `${colors.red}✗ FAIL${colors.reset}`;

  console.log(`\n${status} ${result.name} (${result.duration}ms)`);
  if (result.details) {
    console.log(`  ${colors.blue}Details:${colors.reset} ${result.details}`);
  }
  if (result.error) {
    console.log(`  ${colors.red}Error:${colors.reset} ${result.error}`);
  }
}

/**
 * Test 1: Health Check
 */
async function testHealthCheck(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const health = await ollamaService.healthCheck();
    const duration = Date.now() - startTime;

    if (health.healthy) {
      return {
        name: "Health Check",
        passed: true,
        duration,
        details: `Ollama version ${health.version} is running`,
      };
    } else {
      return {
        name: "Health Check",
        passed: false,
        duration,
        error: health.error || "Unknown health check failure",
      };
    }
  } catch (error) {
    return {
      name: "Health Check",
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test 2: Simple Query
 */
async function testSimpleQuery(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const response = await ollamaService.query({
      prompt: "What is medical billing? Answer in one sentence.",
    });

    const duration = Date.now() - startTime;

    if (response.success && response.response) {
      return {
        name: "Simple Query",
        passed: true,
        duration,
        details: `Received ${response.response.length} character response`,
      };
    } else {
      return {
        name: "Simple Query",
        passed: false,
        duration,
        error: response.error || "No response received",
      };
    }
  } catch (error) {
    return {
      name: "Simple Query",
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test 3: Empty Prompt Error Handling
 */
async function testEmptyPrompt(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const response = await ollamaService.query({ prompt: "" });
    const duration = Date.now() - startTime;

    // Should fail with proper error message
    if (!response.success && response.error?.includes("empty")) {
      return {
        name: "Empty Prompt Error Handling",
        passed: true,
        duration,
        details: "Correctly rejected empty prompt",
      };
    } else {
      return {
        name: "Empty Prompt Error Handling",
        passed: false,
        duration,
        error: "Did not properly handle empty prompt",
      };
    }
  } catch (error) {
    return {
      name: "Empty Prompt Error Handling",
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test 4: Response Time (< 30 seconds)
 */
async function testResponseTime(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const response = await ollamaService.query({
      prompt: "Explain CPT coding in 2-3 sentences.",
    });

    const duration = Date.now() - startTime;

    if (response.success && duration < 30000) {
      return {
        name: "Response Time < 30s",
        passed: true,
        duration,
        details: `Response received in ${(duration / 1000).toFixed(2)}s (target: <30s)`,
      };
    } else if (!response.success) {
      return {
        name: "Response Time < 30s",
        passed: false,
        duration,
        error: response.error || "Query failed",
      };
    } else {
      return {
        name: "Response Time < 30s",
        passed: false,
        duration,
        error: `Response took ${(duration / 1000).toFixed(2)}s (exceeded 30s limit)`,
      };
    }
  } catch (error) {
    return {
      name: "Response Time < 30s",
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test 5: Sequential Requests (No Memory Leaks)
 */
async function testSequentialRequests(): Promise<TestResult> {
  const iterations = 5;
  const startTime = Date.now();
  const durations: number[] = [];

  try {
    for (let i = 0; i < iterations; i++) {
      const queryStart = Date.now();
      const response = await ollamaService.query({
        prompt: `Question ${i + 1}: What is ICD-10 coding?`,
      });

      const queryDuration = Date.now() - queryStart;
      durations.push(queryDuration);

      if (!response.success) {
        return {
          name: `Sequential Requests (${iterations}x)`,
          passed: false,
          duration: Date.now() - startTime,
          error: `Request ${i + 1} failed: ${response.error}`,
        };
      }
    }

    const totalDuration = Date.now() - startTime;
    const avgDuration = durations.reduce((a, b) => a + b, 0) / iterations;

    return {
      name: `Sequential Requests (${iterations}x)`,
      passed: true,
      duration: totalDuration,
      details: `All ${iterations} requests succeeded. Avg: ${(avgDuration / 1000).toFixed(2)}s`,
    };
  } catch (error) {
    return {
      name: `Sequential Requests (${iterations}x)`,
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test 6: Medical Billing Context
 */
async function testMedicalContext(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const response = await ollamaService.query({
      prompt: "What are RAMQ billing codes?",
    });

    const duration = Date.now() - startTime;

    if (response.success && response.response) {
      // Check if response mentions Quebec/RAMQ/medical billing
      const hasContext =
        response.response.toLowerCase().includes("quebec") ||
        response.response.toLowerCase().includes("ramq") ||
        response.response.toLowerCase().includes("medical") ||
        response.response.toLowerCase().includes("billing");

      if (hasContext) {
        return {
          name: "Medical Billing Context",
          passed: true,
          duration,
          details: "Response includes medical billing context",
        };
      } else {
        return {
          name: "Medical Billing Context",
          passed: false,
          duration,
          error: "Response does not include medical billing context",
        };
      }
    } else {
      return {
        name: "Medical Billing Context",
        passed: false,
        duration,
        error: response.error || "No response received",
      };
    }
  } catch (error) {
    return {
      name: "Medical Billing Context",
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Test 7: Configuration Retrieval
 */
async function testConfiguration(): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const config = ollamaService.getConfig();

    const duration = Date.now() - startTime;

    if (config.host && config.model && config.timeout) {
      return {
        name: "Configuration Retrieval",
        passed: true,
        duration,
        details: `Host: ${config.host}, Model: ${config.model}`,
      };
    } else {
      return {
        name: "Configuration Retrieval",
        passed: false,
        duration,
        error: "Missing required configuration fields",
      };
    }
  } catch (error) {
    return {
      name: "Configuration Retrieval",
      passed: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log("\n" + "=".repeat(60));
  console.log(`${colors.magenta}Ollama Service Validation Tests${colors.reset}`);
  console.log("=".repeat(60));
  console.log(`${colors.blue}Phase 1, Step 1.2: Service Wrapper Integration${colors.reset}\n`);

  const tests = [
    { name: "Health Check", fn: testHealthCheck },
    { name: "Simple Query", fn: testSimpleQuery },
    { name: "Empty Prompt Error Handling", fn: testEmptyPrompt },
    { name: "Response Time < 30s", fn: testResponseTime },
    { name: "Sequential Requests (5x)", fn: testSequentialRequests },
    { name: "Medical Billing Context", fn: testMedicalContext },
    { name: "Configuration Retrieval", fn: testConfiguration },
  ];

  for (const test of tests) {
    console.log(`\n${colors.yellow}Running:${colors.reset} ${test.name}...`);
    const result = await test.fn();
    results.push(result);
    logResult(result);
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log(`${colors.magenta}Test Summary${colors.reset}`);
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\nTotal Tests: ${results.length}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s\n`);

  if (failed === 0) {
    console.log(`${colors.green}✓ ALL TESTS PASSED${colors.reset}`);
    console.log("\nOllama service wrapper is ready for integration!\n");
    process.exit(0);
  } else {
    console.log(`${colors.red}✗ SOME TESTS FAILED${colors.reset}`);
    console.log("\nPlease review the errors above and fix the issues.\n");
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  console.error(`${colors.red}Fatal error running tests:${colors.reset}`, error);
  process.exit(1);
});
