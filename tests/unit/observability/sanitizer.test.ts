import { describe, it, expect, beforeEach } from 'vitest';
import * as Sentry from '@sentry/node';
import {
  isAllowedMetadataKey,
  sanitizeErrorContext,
  sanitizeBreadcrumb,
  sanitizeEventContext,
  sanitizeEventData,
  detectPHIFields,
} from '../../../server/observability/sanitizer';

/**
 * PHI Sanitization Tests
 *
 * CRITICAL: 100% test coverage required for healthcare compliance
 *
 * These tests verify that NO Protected Health Information (PHI) can
 * ever be sent to Sentry or external services.
 */

describe('PHI Sanitizer - isAllowedMetadataKey', () => {
  it('should allow whitelisted technical metadata keys', () => {
    const allowedKeys = [
      'rowNumber',
      'rowCount',
      'totalRows',
      'duration',
      'encoding',
      'delimiter',
      'errorType',
      'fileName',
      'fileSize',
      'ruleCount',
      'violationCount',
      'validationRunId',
      'userId',
      'severity',
      'category',
      'timestamp',
    ];

    allowedKeys.forEach(key => {
      expect(isAllowedMetadataKey(key)).toBe(true);
    });
  });

  it('should block PHI fields (case-insensitive)', () => {
    const phiFields = [
      'patient',
      'Patient',
      'PATIENT',
      'patientId',
      'patient_id',
      'doctorInfo',
      'doctor_info',
      'doctor',
      'physician',
      'facture',
      'idRamq',
      'id_ramq',
      'diagnostic',
      'montantPreliminaire',
      'montant_paye',
      'lieuPratique',
      'secteurActivite',
      'elementContexte',
    ];

    phiFields.forEach(field => {
      expect(isAllowedMetadataKey(field)).toBe(false);
    });
  });

  it('should block unknown/non-whitelisted keys', () => {
    const unknownKeys = [
      'unknownField',
      'customData',
      'arbitraryKey',
      'healthCardNumber',
      'billingCode',
    ];

    unknownKeys.forEach(key => {
      expect(isAllowedMetadataKey(key)).toBe(false);
    });
  });
});

describe('PHI Sanitizer - sanitizeErrorContext', () => {
  it('should keep only whitelisted fields from context', () => {
    const context = {
      // Allowed fields
      rowNumber: 42,
      errorType: 'ValidationError',
      duration: 150,

      // PHI fields that should be removed
      patient: '123456',
      doctorInfo: 'Dr. Smith',
      facture: 'INV-001',
    };

    const sanitized = sanitizeErrorContext(context);

    // Allowed fields should remain
    expect(sanitized.rowNumber).toBe(42);
    expect(sanitized.errorType).toBe('ValidationError');
    expect(sanitized.duration).toBe(150);

    // PHI fields should be removed
    expect(sanitized.patient).toBeUndefined();
    expect(sanitized.doctorInfo).toBeUndefined();
    expect(sanitized.facture).toBeUndefined();
  });

  it('should recursively sanitize nested objects', () => {
    const context = {
      validationRunId: 'run-123',
      metadata: {
        rowCount: 100,
        patient: '999999', // Should be removed even when nested
        nested: {
          errorType: 'SystemError',
          doctorInfo: 'Dr. Jones', // Should be removed deeply nested
        },
      },
    };

    const sanitized = sanitizeErrorContext(context);

    expect(sanitized.validationRunId).toBe('run-123');
    expect(sanitized.metadata).toBeDefined();
    expect(sanitized.metadata.rowCount).toBe(100);
    expect(sanitized.metadata.patient).toBeUndefined();
    expect(sanitized.metadata.nested.errorType).toBe('SystemError');
    expect(sanitized.metadata.nested.doctorInfo).toBeUndefined();
  });

  it('should handle arrays without modification', () => {
    const context = {
      errorType: 'BatchError',
      items: [1, 2, 3, 4, 5],
    };

    const sanitized = sanitizeErrorContext(context);

    expect(sanitized.errorType).toBe('BatchError');
    expect(sanitized.items).toEqual([1, 2, 3, 4, 5]);
  });

  it('should handle empty context', () => {
    const sanitized = sanitizeErrorContext({});
    expect(sanitized).toEqual({});
  });

  it('should handle null and undefined values', () => {
    const context = {
      errorType: 'NullError',
      nullValue: null,
      undefinedValue: undefined,
    };

    const sanitized = sanitizeErrorContext(context);

    expect(sanitized.errorType).toBe('NullError');
    expect(sanitized.nullValue).toBeNull();
    expect(sanitized.undefinedValue).toBeUndefined();
  });
});

describe('PHI Sanitizer - sanitizeBreadcrumb', () => {
  it('should sanitize breadcrumb data while preserving metadata', () => {
    const breadcrumb: Sentry.Breadcrumb = {
      type: 'default',
      level: 'info',
      message: 'Processing validation',
      category: 'validation',
      data: {
        rowNumber: 10,
        patient: '123456', // Should be removed
        errorType: 'ValidationError',
      },
    };

    const sanitized = sanitizeBreadcrumb(breadcrumb);

    expect(sanitized.type).toBe('default');
    expect(sanitized.level).toBe('info');
    expect(sanitized.message).toBe('Processing validation');
    expect(sanitized.category).toBe('validation');
    expect(sanitized.data?.rowNumber).toBe(10);
    expect(sanitized.data?.errorType).toBe('ValidationError');
    expect(sanitized.data?.patient).toBeUndefined();
  });

  it('should handle breadcrumbs without data', () => {
    const breadcrumb: Sentry.Breadcrumb = {
      type: 'default',
      level: 'info',
      message: 'Simple message',
    };

    const sanitized = sanitizeBreadcrumb(breadcrumb);

    expect(sanitized).toEqual(breadcrumb);
  });
});

describe('PHI Sanitizer - sanitizeEventContext', () => {
  it('should sanitize event extra data', () => {
    const event: Sentry.Event = {
      extra: {
        rowNumber: 5,
        duration: 200,
        patient: '999999', // Should be removed
        doctorInfo: 'Dr. Brown',
      },
    };

    const sanitized = sanitizeEventContext(event);

    expect(sanitized.extra?.rowNumber).toBe(5);
    expect(sanitized.extra?.duration).toBe(200);
    expect(sanitized.extra?.patient).toBeUndefined();
    expect(sanitized.extra?.doctorInfo).toBeUndefined();
  });

  it('should sanitize event tags', () => {
    const event: Sentry.Event = {
      tags: {
        severity: 'error',
        category: 'validation',
        patient: '123456', // Should be removed
      },
    };

    const sanitized = sanitizeEventContext(event);

    expect(sanitized.tags?.severity).toBe('error');
    expect(sanitized.tags?.category).toBe('validation');
    expect(sanitized.tags?.patient).toBeUndefined();
  });

  it('should keep only user ID and remove other user data', () => {
    const event: Sentry.Event = {
      user: {
        id: 'auth0|user123',
        email: 'doctor@hospital.com', // Should be removed
        username: 'dr.smith', // Should be removed
        ip_address: '192.168.1.1', // Should be removed
      },
    };

    const sanitized = sanitizeEventContext(event);

    expect(sanitized.user?.id).toBe('auth0|user123');
    expect(sanitized.user?.email).toBeUndefined();
    expect(sanitized.user?.username).toBeUndefined();
    expect(sanitized.user?.ip_address).toBeUndefined();
  });

  it('should handle events with no extra, tags, or user', () => {
    const event: Sentry.Event = {
      message: 'Test error',
    };

    const sanitized = sanitizeEventContext(event);

    expect(sanitized.message).toBe('Test error');
    expect(sanitized.extra).toBeUndefined();
    expect(sanitized.tags).toBeUndefined();
    expect(sanitized.user).toBeUndefined();
  });
});

describe('PHI Sanitizer - sanitizeEventData (main hook)', () => {
  it('should sanitize complete Sentry event before transmission', () => {
    const event: Sentry.Event = {
      message: 'Validation failed for patient 12345',
      level: 'error',
      extra: {
        rowNumber: 10,
        patient: '999999', // Should be removed
        errorType: 'ValidationError',
      },
      tags: {
        severity: 'error',
        doctorInfo: 'Dr. Smith', // Should be removed
      },
      user: {
        id: 'auth0|user123',
        email: 'test@example.com', // Should be removed
      },
      breadcrumbs: [
        {
          type: 'default',
          level: 'info',
          message: 'Processing record',
          data: {
            rowNumber: 5,
            patient: '123456', // Should be removed
          },
        },
      ],
    };

    const sanitized = sanitizeEventData(event);

    // Event should be returned (not null)
    expect(sanitized).not.toBeNull();

    // Error message should be sanitized
    expect(sanitized?.message).toBe('Validation failed for patient [REDACTED]');

    // Extra data sanitized
    expect(sanitized?.extra?.rowNumber).toBe(10);
    expect(sanitized?.extra?.errorType).toBe('ValidationError');
    expect(sanitized?.extra?.patient).toBeUndefined();

    // Tags sanitized
    expect(sanitized?.tags?.severity).toBe('error');
    expect(sanitized?.tags?.doctorInfo).toBeUndefined();

    // User data sanitized
    expect(sanitized?.user?.id).toBe('auth0|user123');
    expect(sanitized?.user?.email).toBeUndefined();

    // Breadcrumbs sanitized
    expect(sanitized?.breadcrumbs?.[0].data?.rowNumber).toBe(5);
    expect(sanitized?.breadcrumbs?.[0].data?.patient).toBeUndefined();
  });

  it('should sanitize exception values with PHI in messages', () => {
    const event: Sentry.Event = {
      exception: {
        values: [
          {
            type: 'ValidationError',
            value: 'Error processing patient 999888777666',
            stacktrace: {
              frames: [
                {
                  filename: 'engine.ts',
                  function: 'validateRecords',
                  lineno: 42,
                },
              ],
            },
          },
        ],
      },
    };

    const sanitized = sanitizeEventData(event);

    expect(sanitized).not.toBeNull();
    expect(sanitized?.exception?.values?.[0].value).toBe(
      'Error processing patient [HEALTH-CARD-REDACTED]'
    );
    // Stack trace should be preserved
    expect(sanitized?.exception?.values?.[0].stacktrace?.frames[0].filename).toBe('engine.ts');
  });

  it('should return null if sanitization fails (fail-safe)', () => {
    // Create an event that will cause sanitization to throw
    const event: any = {
      extra: {
        // Getter that throws will cause sanitization to fail
        get errorThrowing() {
          throw new Error('Intentional error during sanitization');
        },
      },
    };

    const sanitized = sanitizeEventData(event);

    // Event should be dropped (null) if sanitization fails
    expect(sanitized).toBeNull();
  });

  it('should handle events with no exception or breadcrumbs', () => {
    const event: Sentry.Event = {
      message: 'Simple error message',
      level: 'error',
    };

    const sanitized = sanitizeEventData(event);

    expect(sanitized).not.toBeNull();
    expect(sanitized?.message).toBe('Simple error message');
  });
});

describe('PHI Sanitizer - Error Message Sanitization', () => {
  it('should redact patient identifiers in error messages', () => {
    const event: Sentry.Event = {
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Validation failed for patient 12345 and patient 67890',
          },
        ],
      },
    };

    const sanitized = sanitizeEventData(event);

    expect(sanitized?.exception?.values?.[0].value).toBe(
      'Validation failed for patient [REDACTED] and patient [REDACTED]'
    );
  });

  it('should redact doctor information in error messages', () => {
    const event: Sentry.Event = {
      exception: {
        values: [
          {
            type: 'Error',
            value: 'doctor: Dr. Smith failed to submit',
          },
        ],
      },
    };

    const sanitized = sanitizeEventData(event);

    expect(sanitized?.exception?.values?.[0].value).toBe(
      'doctor: [REDACTED] failed to submit'
    );
  });

  it('should redact Quebec health card numbers (12 digits)', () => {
    const event: Sentry.Event = {
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Invalid health card: 123456789012',
          },
        ],
      },
    };

    const sanitized = sanitizeEventData(event);

    expect(sanitized?.exception?.values?.[0].value).toBe(
      'Invalid health card: [HEALTH-CARD-REDACTED]'
    );
  });

  it('should handle multiple PHI patterns in same message', () => {
    const event: Sentry.Event = {
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Error for patient 123 with health card 999888777666 and doctor: Dr. Jones',
          },
        ],
      },
    };

    const sanitized = sanitizeEventData(event);

    expect(sanitized?.exception?.values?.[0].value).toBe(
      'Error for patient [REDACTED] with health card [HEALTH-CARD-REDACTED] and doctor: [REDACTED]'
    );
  });
});

describe('PHI Sanitizer - detectPHIFields (test helper)', () => {
  it('should detect PHI fields in flat object', () => {
    const obj = {
      rowNumber: 10,
      patient: '123456',
      errorType: 'ValidationError',
      doctorInfo: 'Dr. Smith',
    };

    const phiFields = detectPHIFields(obj);

    expect(phiFields).toContain('patient');
    expect(phiFields).toContain('doctorInfo');
    expect(phiFields).not.toContain('rowNumber');
    expect(phiFields).not.toContain('errorType');
  });

  it('should detect PHI fields in nested objects', () => {
    const obj = {
      metadata: {
        rowCount: 100,
        patient: '999999',
        details: {
          doctorInfo: 'Dr. Brown',
          errorType: 'SystemError',
        },
      },
    };

    const phiFields = detectPHIFields(obj);

    expect(phiFields).toContain('metadata.patient');
    expect(phiFields).toContain('metadata.details.doctorInfo');
    expect(phiFields).not.toContain('metadata.rowCount');
    expect(phiFields).not.toContain('metadata.details.errorType');
  });

  it('should return empty array for clean objects', () => {
    const obj = {
      rowNumber: 42,
      errorType: 'ValidationError',
      duration: 150,
      severity: 'error',
    };

    const phiFields = detectPHIFields(obj);

    expect(phiFields).toEqual([]);
  });

  it('should handle empty objects', () => {
    const phiFields = detectPHIFields({});
    expect(phiFields).toEqual([]);
  });

  it('should be case-insensitive for PHI detection', () => {
    const obj = {
      Patient: '123',
      DOCTORINFO: 'Dr. Test',
      Facture: 'INV-001',
    };

    const phiFields = detectPHIFields(obj);

    expect(phiFields.length).toBe(3);
    expect(phiFields).toContain('Patient');
    expect(phiFields).toContain('DOCTORINFO');
    expect(phiFields).toContain('Facture');
  });
});

describe('PHI Sanitizer - Edge Cases', () => {
  it('should handle events with undefined exception values', () => {
    const event: Sentry.Event = {
      exception: {
        values: [
          {
            type: 'Error',
            value: undefined,
          },
        ],
      },
    };

    const sanitized = sanitizeEventData(event);

    expect(sanitized).not.toBeNull();
    expect(sanitized?.exception?.values?.[0].value).toBeUndefined();
  });

  it('should handle deeply nested PHI in extra data', () => {
    const event: Sentry.Event = {
      extra: {
        level1: {
          level2: {
            level3: {
              level4: {
                patient: '999999', // Deep PHI
                rowNumber: 42, // Deep allowed field
              },
            },
          },
        },
      },
    };

    const sanitized = sanitizeEventData(event);

    expect(sanitized?.extra?.level1?.level2?.level3?.level4?.rowNumber).toBe(42);
    expect(sanitized?.extra?.level1?.level2?.level3?.level4?.patient).toBeUndefined();
  });

  it('should handle breadcrumbs array edge cases', () => {
    const event: Sentry.Event = {
      breadcrumbs: [],
    };

    const sanitized = sanitizeEventData(event);

    expect(sanitized).not.toBeNull();
    expect(sanitized?.breadcrumbs).toEqual([]);
  });

  it('should preserve boolean, number, and string primitive values', () => {
    const event: Sentry.Event = {
      extra: {
        rowNumber: 42,
        duration: 150.5,
        errorType: 'ValidationError',
        hasError: true,
        isComplete: false,
      },
    };

    const sanitized = sanitizeEventData(event);

    expect(sanitized?.extra?.rowNumber).toBe(42);
    expect(sanitized?.extra?.duration).toBe(150.5);
    expect(sanitized?.extra?.errorType).toBe('ValidationError');
    expect(sanitized?.extra?.hasError).toBe(true);
    expect(sanitized?.extra?.isComplete).toBe(false);
  });
});
