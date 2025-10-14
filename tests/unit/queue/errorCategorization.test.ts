import { describe, it, expect } from 'vitest';
import { categorizeError } from '../../../server/queue/validationQueue';

describe('Error Categorization', () => {
  describe('categorizeError', () => {
    it('should categorize Redis connection errors as QUEUE_ERROR', () => {
      const error1 = categorizeError('Redis connection failed');
      expect(error1.code).toBe('QUEUE_ERROR');
      expect(error1.message).toContain('file d\'attente');

      const error2 = categorizeError('ECONNREFUSED - connection refused');
      expect(error2.code).toBe('QUEUE_ERROR');

      const error3 = categorizeError('Network timeout occurred');
      expect(error3.code).toBe('QUEUE_ERROR');
    });

    it('should categorize file not found errors as FILE_ERROR', () => {
      const error1 = categorizeError('File not found: /path/to/file.csv');
      expect(error1.code).toBe('FILE_ERROR');
      expect(error1.message).toContain('fichier');

      const error2 = categorizeError('ENOENT: no such file or directory');
      expect(error2.code).toBe('FILE_ERROR');

      const error3 = categorizeError('Cannot read file due to encoding issues');
      expect(error3.code).toBe('FILE_ERROR');
    });

    it('should categorize CSV parsing errors as FILE_ERROR', () => {
      const error1 = categorizeError('CSV parsing error: invalid format');
      expect(error1.code).toBe('FILE_ERROR');
      expect(error1.message).toContain('format CSV');

      const error2 = categorizeError('Malformed CSV data on line 45');
      expect(error2.code).toBe('FILE_ERROR');

      const error3 = categorizeError('Erreur: colonnes manquantes dans le CSV');
      expect(error3.code).toBe('FILE_ERROR');
    });

    it('should categorize validation rule failures as VALIDATION_ERROR', () => {
      const error1 = categorizeError('Validation failed: invalid data');
      expect(error1.code).toBe('VALIDATION_ERROR');
      expect(error1.message).toContain('validation');

      const error2 = categorizeError('Constraint violation: règle not satisfied');
      expect(error2.code).toBe('VALIDATION_ERROR');
    });

    it('should categorize worker crashes as WORKER_ERROR', () => {
      const error1 = categorizeError('Worker crashed unexpectedly');
      expect(error1.code).toBe('WORKER_ERROR');
      expect(error1.message).toContain('système de traitement');

      const error2 = categorizeError('Process killed: out of memory');
      expect(error2.code).toBe('WORKER_ERROR');

      const error3 = categorizeError('SIGTERM received');
      expect(error3.code).toBe('WORKER_ERROR');
    });

    it('should default to WORKER_ERROR for unknown errors', () => {
      const error = categorizeError('Some unexpected error occurred');
      expect(error.code).toBe('WORKER_ERROR');
      expect(error.message).toContain('inattendue');
    });

    it('should include original error details', () => {
      const originalError = 'Redis connection failed at port 6379';
      const categorized = categorizeError(originalError);
      expect(categorized.details).toBe(originalError);
    });

    it('should handle case-insensitive error matching', () => {
      const error1 = categorizeError('REDIS CONNECTION FAILED');
      expect(error1.code).toBe('QUEUE_ERROR');

      const error2 = categorizeError('File Not Found');
      expect(error2.code).toBe('FILE_ERROR');
    });
  });
});
