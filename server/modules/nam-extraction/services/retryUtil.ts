/**
 * Retry utility for handling transient errors with exponential backoff.
 *
 * Used for AWS Textract and OpenAI API calls that may fail temporarily
 * due to rate limits, network issues, or service unavailability.
 */

/**
 * Retry configuration options
 */
interface RetryOptions {
  maxAttempts?: number; // Maximum number of retry attempts (default: 3)
  backoffSeconds?: number[]; // Backoff delays between retries (default: [1, 2, 4])
  retryableErrors?: string[]; // Error names/codes that should trigger retry
}

/**
 * Default retryable error patterns
 */
const DEFAULT_RETRYABLE_ERRORS = [
  "ThrottlingException",
  "ProvisionedThroughputExceededException",
  "RateLimitError",
  "APIConnectionError",
  "ServiceUnavailable",
  "InternalServerError",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
];

/**
 * Retry an async function with exponential backoff.
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @param args - Arguments to pass to the function
 * @returns The result of the function call
 * @throws The last error if all retry attempts fail
 *
 * Example usage:
 * ```typescript
 * const result = await retryWithBackoff(
 *   extractTextFromPDF,
 *   { maxAttempts: 3, backoffSeconds: [1, 2, 4] },
 *   pdfPath
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: (...args: any[]) => Promise<T>,
  options: RetryOptions = {},
  ...args: any[]
): Promise<T> {
  const maxAttempts = options.maxAttempts || 3;
  const backoffSeconds = options.backoffSeconds || [1, 2, 4];
  const retryableErrors = options.retryableErrors || DEFAULT_RETRYABLE_ERRORS;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Attempt to execute the function
      return await fn(...args);
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      const isRetryable = isRetryableError(error, retryableErrors);

      if (!isRetryable || attempt >= maxAttempts) {
        // Don't retry if error is permanent or we've exhausted attempts
        console.error(
          `[RETRY] Function failed after ${attempt} attempt(s): ${error.message}`
        );
        throw error;
      }

      // Calculate backoff delay
      const backoffIndex = Math.min(attempt - 1, backoffSeconds.length - 1);
      const delaySec = backoffSeconds[backoffIndex];

      console.warn(
        `[RETRY] Attempt ${attempt}/${maxAttempts} failed: ${error.message}. ` +
          `Retrying in ${delaySec}s...`
      );

      // Wait before retrying
      await sleep(delaySec * 1000);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error("Retry failed");
}

/**
 * Check if an error is retryable based on error name/code.
 *
 * @param error - The error object
 * @param retryableErrors - List of retryable error patterns
 * @returns True if the error should be retried
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
  if (!error) {
    return false;
  }

  const errorName = error.name || error.constructor?.name || "";
  const errorCode = error.code || "";
  const errorMessage = error.message || "";

  // Check if error matches any retryable pattern
  return retryableErrors.some(
    (pattern) =>
      errorName.includes(pattern) ||
      errorCode.includes(pattern) ||
      errorMessage.includes(pattern)
  );
}

/**
 * Sleep for specified milliseconds.
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
