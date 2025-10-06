import { storage } from '../../core/storage';
import { InsertValidationLog } from '@shared/schema';

/**
 * Safe metadata type - only allows non-sensitive technical data
 * TypeScript enforces that no CSV row data can be passed
 */
export type SafeMetadata = {
  rowNumber?: number;
  rowCount?: number;
  totalRows?: number;
  duration?: number;
  encoding?: string;
  delimiter?: string;
  errorType?: string;
  errorCode?: string;
  fileName?: string;
  fileSize?: number;
  ruleCount?: number;
  violationCount?: number;
  errorCount?: number;
  warningCount?: number;
  categoryBreakdown?: Record<string, number>;
  affectedDateRange?: { start: string; end: string };
  ruleId?: string;
  jobId?: string;
  progress?: number;
  // CSV row data NOT ALLOWED - type system prevents it
};

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

class ValidationLogger {
  /**
   * Log a debug message (detailed technical information)
   */
  async debug(runId: string, source: string, message: string, metadata?: SafeMetadata): Promise<void> {
    await this.log('DEBUG', runId, source, message, metadata);
  }

  /**
   * Log an info message (general information)
   */
  async info(runId: string, source: string, message: string, metadata?: SafeMetadata): Promise<void> {
    await this.log('INFO', runId, source, message, metadata);
  }

  /**
   * Log a warning message (potential issues)
   */
  async warn(runId: string, source: string, message: string, metadata?: SafeMetadata): Promise<void> {
    await this.log('WARN', runId, source, message, metadata);
  }

  /**
   * Log an error message (critical failures)
   */
  async error(runId: string, source: string, message: string, metadata?: SafeMetadata): Promise<void> {
    await this.log('ERROR', runId, source, message, metadata);
  }

  /**
   * Internal log method - writes to both database and console
   */
  private async log(
    level: LogLevel,
    runId: string,
    source: string,
    message: string,
    metadata?: SafeMetadata
  ): Promise<void> {
    const timestamp = new Date();

    // Console output for development
    const consoleMessage = `[${level}] ${source} - ${message}`;
    if (level === 'ERROR') {
      console.error(consoleMessage, metadata || '');
    } else if (level === 'WARN') {
      console.warn(consoleMessage, metadata || '');
    } else {
      console.log(consoleMessage, metadata || '');
    }

    // Database persistence
    try {
      await storage.createValidationLog({
        validationRunId: runId,
        timestamp,
        level,
        source,
        message,
        metadata: metadata || null,
      });
    } catch (error: any) {
      // Fallback: if logging fails, at least log to console
      console.error(`[LOGGER ERROR] Failed to persist log to database:`, error);
    }
  }

  /**
   * Batch logging for performance (e.g., progress updates every 100 rows)
   */
  async logBatch(logs: Array<{
    level: LogLevel;
    runId: string;
    source: string;
    message: string;
    metadata?: SafeMetadata;
  }>): Promise<void> {
    const timestamp = new Date();

    try {
      const logEntries: InsertValidationLog[] = logs.map(log => ({
        validationRunId: log.runId,
        timestamp,
        level: log.level,
        source: log.source,
        message: log.message,
        metadata: log.metadata || null,
      }));

      await storage.createValidationLogsBatch(logEntries);

      // Also log to console
      logs.forEach(log => {
        console.log(`[${log.level}] ${log.source} - ${log.message}`);
      });
    } catch (error: any) {
      console.error(`[LOGGER ERROR] Failed to persist batch logs:`, error);
    }
  }
}

// Export singleton instance
export const logger = new ValidationLogger();
