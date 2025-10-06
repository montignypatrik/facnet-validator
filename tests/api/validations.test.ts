/**
 * API Integration Tests: Validation Endpoints
 *
 * Tests the validation API endpoints with RBAC enforcement:
 * - POST /api/validations - Start validation run
 * - GET /api/validations - List validation runs
 * - GET /api/validations/:id - Get validation details
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  seedTestData,
  clearTestData,
} from '../utils/testDb';
import { authHeader, MOCK_USERS } from '../utils/mockAuth';

// Mock validation run response type
interface ValidationRun {
  id: string;
  userId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRecords: number;
  processedRecords: number;
  errorCount: number;
  warningCount: number;
  createdAt: string;
  completedAt?: string;
}

/**
 * Mock API client for validation endpoints
 * (In real tests, this would use supertest or similar)
 */
class MockValidationAPI {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async createValidation(
    auth: { Authorization: string },
    data: { fileName: string; fileId: string }
  ): Promise<{ status: number; data?: any; error?: string }> {
    // Mock RBAC check
    const role = this.extractRoleFromAuth(auth);
    if (!['admin', 'editor'].includes(role)) {
      return {
        status: 403,
        error: 'Insufficient permissions. Editor or Admin role required.',
      };
    }

    // Create validation run
    const result = await this.db.public.one(`
      INSERT INTO validation_runs (user_id, file_name, status, total_records)
      VALUES (
        (SELECT id FROM users WHERE auth0_id = $1),
        $2,
        'pending',
        0
      )
      RETURNING *
    `, [MOCK_USERS[role as 'admin' | 'editor'].sub, data.fileName]);

    return {
      status: 201,
      data: this.formatValidationRun(result),
    };
  }

  async listValidations(
    auth: { Authorization: string },
    query: { page?: number; limit?: number; status?: string } = {}
  ): Promise<{ status: number; data?: any; error?: string }> {
    const role = this.extractRoleFromAuth(auth);
    if (!role) {
      return { status: 401, error: 'Unauthorized' };
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    let statusFilter = '';
    if (query.status) {
      statusFilter = `AND status = '${query.status}'`;
    }

    const results = await this.db.public.many(`
      SELECT vr.*, u.email as user_email
      FROM validation_runs vr
      LEFT JOIN users u ON vr.user_id = u.id
      WHERE 1=1 ${statusFilter}
      ORDER BY vr.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const total = await this.db.public.one(`
      SELECT COUNT(*) as count
      FROM validation_runs
      WHERE 1=1 ${statusFilter}
    `);

    return {
      status: 200,
      data: {
        runs: results.map(this.formatValidationRun),
        pagination: {
          page,
          limit,
          total: parseInt(total.count),
          pages: Math.ceil(parseInt(total.count) / limit),
        },
      },
    };
  }

  async getValidationById(
    auth: { Authorization: string },
    id: string
  ): Promise<{ status: number; data?: any; error?: string }> {
    const role = this.extractRoleFromAuth(auth);
    if (!role) {
      return { status: 401, error: 'Unauthorized' };
    }

    try {
      const run = await this.db.public.one(`
        SELECT vr.*, u.email as user_email
        FROM validation_runs vr
        LEFT JOIN users u ON vr.user_id = u.id
        WHERE vr.id = $1
      `, [id]);

      // Get validation results (errors/warnings)
      const results = await this.db.public.many(`
        SELECT * FROM validation_results
        WHERE validation_run_id = $1
        ORDER BY created_at DESC
      `, [id]);

      return {
        status: 200,
        data: {
          ...this.formatValidationRun(run),
          results: results.map((r: any) => ({
            id: r.id,
            ruleId: r.rule_id,
            severity: r.severity,
            category: r.category,
            message: r.message,
            solution: r.solution,
            ruleData: r.rule_data,
            createdAt: r.created_at,
          })),
        },
      };
    } catch (error) {
      return { status: 404, error: 'Validation run not found' };
    }
  }

  private extractRoleFromAuth(auth: { Authorization: string }): string | null {
    // Simple mock extraction (in real code, decode JWT)
    if (auth.Authorization.includes('admin')) return 'admin';
    if (auth.Authorization.includes('editor')) return 'editor';
    if (auth.Authorization.includes('viewer')) return 'viewer';
    if (auth.Authorization.includes('pending')) return 'pending';
    return null;
  }

  private formatValidationRun(row: any): ValidationRun {
    return {
      id: row.id,
      userId: row.user_id,
      fileName: row.file_name,
      status: row.status,
      totalRecords: row.total_records,
      processedRecords: row.processed_records,
      errorCount: row.error_count,
      warningCount: row.warning_count,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  }
}

describe('Validation API Endpoints', () => {
  let db: any;
  let api: MockValidationAPI;

  beforeEach(async () => {
    const setup = await setupTestDatabase();
    db = setup.db;
    api = new MockValidationAPI(db);
    await seedTestData();
  });

  afterEach(async () => {
    await clearTestData();
    await teardownTestDatabase();
  });

  describe('POST /api/validations - Create Validation Run', () => {
    it('should allow Admin to create validation run', async () => {
      const response = await api.createValidation(authHeader('admin'), {
        fileName: 'test-billing-data.csv',
        fileId: 'file-123',
      });

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        fileName: 'test-billing-data.csv',
        status: 'pending',
        totalRecords: 0,
      });
      expect(response.data.id).toBeDefined();
    });

    it('should allow Editor to create validation run', async () => {
      const response = await api.createValidation(authHeader('editor'), {
        fileName: 'editor-test.csv',
        fileId: 'file-456',
      });

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        fileName: 'editor-test.csv',
        status: 'pending',
      });
    });

    it('should DENY Viewer from creating validation run', async () => {
      const response = await api.createValidation(authHeader('viewer'), {
        fileName: 'viewer-test.csv',
        fileId: 'file-789',
      });

      expect(response.status).toBe(403);
      expect(response.error).toContain('Insufficient permissions');
    });

    it('should DENY Pending user from creating validation run', async () => {
      const response = await api.createValidation(authHeader('pending'), {
        fileName: 'pending-test.csv',
        fileId: 'file-000',
      });

      expect(response.status).toBe(403);
      expect(response.error).toContain('Insufficient permissions');
    });
  });

  describe('GET /api/validations - List Validation Runs', () => {
    beforeEach(async () => {
      // Create test validation runs
      await db.public.none(`
        INSERT INTO validation_runs (user_id, file_name, status, total_records, error_count)
        VALUES
        ((SELECT id FROM users WHERE email = 'admin@test.com'), 'run1.csv', 'completed', 100, 5),
        ((SELECT id FROM users WHERE email = 'editor@test.com'), 'run2.csv', 'processing', 50, 0),
        ((SELECT id FROM users WHERE email = 'admin@test.com'), 'run3.csv', 'failed', 0, 10)
      `);
    });

    it('should allow Admin to list all validation runs', async () => {
      const response = await api.listValidations(authHeader('admin'));

      expect(response.status).toBe(200);
      expect(response.data.runs).toHaveLength(3);
      expect(response.data.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 3,
        pages: 1,
      });
    });

    it('should allow Editor to list validation runs', async () => {
      const response = await api.listValidations(authHeader('editor'));

      expect(response.status).toBe(200);
      expect(response.data.runs).toHaveLength(3);
    });

    it('should allow Viewer to list validation runs (read-only)', async () => {
      const response = await api.listValidations(authHeader('viewer'));

      expect(response.status).toBe(200);
      expect(response.data.runs).toHaveLength(3);
    });

    it('should filter by status', async () => {
      const response = await api.listValidations(authHeader('admin'), {
        status: 'completed',
      });

      expect(response.status).toBe(200);
      expect(response.data.runs).toHaveLength(1);
      expect(response.data.runs[0].status).toBe('completed');
    });

    it('should support pagination', async () => {
      const response = await api.listValidations(authHeader('admin'), {
        page: 1,
        limit: 2,
      });

      expect(response.status).toBe(200);
      expect(response.data.runs).toHaveLength(2);
      expect(response.data.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        pages: 2,
      });
    });
  });

  describe('GET /api/validations/:id - Get Validation Details', () => {
    let validationRunId: string;

    beforeEach(async () => {
      // Create test validation run with results
      const run = await db.public.one(`
        INSERT INTO validation_runs (user_id, file_name, status, total_records, error_count)
        VALUES (
          (SELECT id FROM users WHERE email = 'admin@test.com'),
          'detailed-run.csv',
          'completed',
          100,
          2
        )
        RETURNING id
      `);
      validationRunId = run.id;

      // Create test billing records
      const record1 = await db.public.one(`
        INSERT INTO billing_records (validation_run_id, code, date_service, patient, doctor_info)
        VALUES ($1, '19928', NOW(), 'PATIENT-001', 'Dr. Test')
        RETURNING id
      `, [validationRunId]);

      // Create test validation results
      await db.public.none(`
        INSERT INTO validation_results (validation_run_id, rule_id, billing_record_id, severity, category, message, solution)
        VALUES
        ($1, 'office-fee-validation', $2, 'error', 'billing_compliance', 'Frais de bureau insuffisants', 'Ajouter plus de patients'),
        ($1, 'office-fee-validation', $2, 'warning', 'billing_compliance', 'Montant proche du maximum', NULL)
      `, [validationRunId, record1.id]);
    });

    it('should allow Admin to get validation details', async () => {
      const response = await api.getValidationById(authHeader('admin'), validationRunId);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        id: validationRunId,
        fileName: 'detailed-run.csv',
        status: 'completed',
        totalRecords: 100,
        errorCount: 2,
      });
      expect(response.data.results).toHaveLength(2);
      expect(response.data.results[0]).toMatchObject({
        ruleId: 'office-fee-validation',
        severity: 'error',
        category: 'billing_compliance',
        message: 'Frais de bureau insuffisants',
      });
    });

    it('should allow Viewer to get validation details', async () => {
      const response = await api.getValidationById(authHeader('viewer'), validationRunId);

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(validationRunId);
      expect(response.data.results).toHaveLength(2);
    });

    it('should return 404 for non-existent validation run', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await api.getValidationById(authHeader('admin'), fakeId);

      expect(response.status).toBe(404);
      expect(response.error).toContain('not found');
    });
  });
});
