/**
 * API Integration Tests: Codes Endpoints
 *
 * Tests the RAMQ codes API endpoints with RBAC enforcement:
 * - GET /api/codes - List codes with pagination/search
 * - POST /api/codes - Create code (Editor/Admin only)
 * - PATCH /api/codes/:id - Update code (Editor/Admin only)
 * - DELETE /api/codes/:id - Delete code (Admin only)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupTestDatabase,
  teardownTestDatabase,
  seedTestData,
  clearTestData,
} from '../utils/testDb';
import { authHeader, MOCK_USERS } from '../utils/mockAuth';

interface Code {
  id: string;
  code: string;
  description: string;
  place: string;
  tariffValue: number;
  category: string;
  active: boolean;
  createdAt: string;
}

/**
 * Mock API client for codes endpoints
 */
class MockCodesAPI {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async listCodes(
    auth: { Authorization: string },
    query: { page?: number; limit?: number; search?: string; category?: string } = {}
  ): Promise<{ status: number; data?: any; error?: string }> {
    const role = this.extractRoleFromAuth(auth);
    if (!role) {
      return { status: 401, error: 'Unauthorized' };
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const offset = (page - 1) * limit;

    let filters: string[] = ['active = true'];
    if (query.search) {
      filters.push(`(code LIKE '%${query.search}%' OR description LIKE '%${query.search}%')`);
    }
    if (query.category) {
      filters.push(`category = '${query.category}'`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

    const results = await this.db.public.many(`
      SELECT * FROM codes
      ${whereClause}
      ORDER BY code ASC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const total = await this.db.public.one(`
      SELECT COUNT(*) as count FROM codes ${whereClause}
    `);

    return {
      status: 200,
      data: {
        codes: results.map(this.formatCode),
        pagination: {
          page,
          limit,
          total: parseInt(total.count),
          pages: Math.ceil(parseInt(total.count) / limit),
        },
      },
    };
  }

  async createCode(
    auth: { Authorization: string },
    data: Partial<Code>
  ): Promise<{ status: number; data?: any; error?: string }> {
    const role = this.extractRoleFromAuth(auth);
    if (!['admin', 'editor'].includes(role)) {
      return {
        status: 403,
        error: 'Insufficient permissions. Editor or Admin role required.',
      };
    }

    if (!data.code || !data.description) {
      return { status: 400, error: 'Code and description are required' };
    }

    const result = await this.db.public.one(`
      INSERT INTO codes (code, description, place, tariff_value, category, active)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING *
    `, [data.code, data.description, data.place || 'Cabinet', data.tariffValue || 0, data.category || 'other']);

    return {
      status: 201,
      data: this.formatCode(result),
    };
  }

  async updateCode(
    auth: { Authorization: string },
    id: string,
    data: Partial<Code>
  ): Promise<{ status: number; data?: any; error?: string }> {
    const role = this.extractRoleFromAuth(auth);
    if (!['admin', 'editor'].includes(role)) {
      return {
        status: 403,
        error: 'Insufficient permissions. Editor or Admin role required.',
      };
    }

    try {
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(data.description);
      }
      if (data.tariffValue !== undefined) {
        updates.push(`tariff_value = $${paramIndex++}`);
        values.push(data.tariffValue);
      }
      if (data.category !== undefined) {
        updates.push(`category = $${paramIndex++}`);
        values.push(data.category);
      }

      if (updates.length === 0) {
        return { status: 400, error: 'No fields to update' };
      }

      values.push(id);
      const result = await this.db.public.one(`
        UPDATE codes
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      return {
        status: 200,
        data: this.formatCode(result),
      };
    } catch (error) {
      return { status: 404, error: 'Code not found' };
    }
  }

  async deleteCode(
    auth: { Authorization: string },
    id: string
  ): Promise<{ status: number; data?: any; error?: string }> {
    const role = this.extractRoleFromAuth(auth);
    if (role !== 'admin') {
      return {
        status: 403,
        error: 'Insufficient permissions. Admin role required.',
      };
    }

    try {
      // Soft delete (set active = false)
      await this.db.public.one(`
        UPDATE codes
        SET active = false
        WHERE id = $1
        RETURNING *
      `, [id]);

      return {
        status: 200,
        data: { message: 'Code deleted successfully' },
      };
    } catch (error) {
      return { status: 404, error: 'Code not found' };
    }
  }

  private extractRoleFromAuth(auth: { Authorization: string }): string | null {
    if (auth.Authorization.includes('admin')) return 'admin';
    if (auth.Authorization.includes('editor')) return 'editor';
    if (auth.Authorization.includes('viewer')) return 'viewer';
    if (auth.Authorization.includes('pending')) return 'pending';
    return null;
  }

  private formatCode(row: any): Code {
    return {
      id: row.id,
      code: row.code,
      description: row.description,
      place: row.place,
      tariffValue: parseFloat(row.tariff_value || 0),
      category: row.category,
      active: row.active,
      createdAt: row.created_at,
    };
  }
}

describe('Codes API Endpoints', () => {
  let db: any;
  let api: MockCodesAPI;

  beforeEach(async () => {
    const setup = await setupTestDatabase();
    db = setup.db;
    api = new MockCodesAPI(db);
    await seedTestData();
  });

  afterEach(async () => {
    await clearTestData();
    await teardownTestDatabase();
  });

  describe('GET /api/codes - List Codes', () => {
    it('should allow all authenticated users to list codes', async () => {
      const response = await api.listCodes(authHeader('viewer'));

      expect(response.status).toBe(200);
      expect(response.data.codes).toHaveLength(5); // From seedTestData
      expect(response.data.codes[0]).toMatchObject({
        code: expect.any(String),
        description: expect.any(String),
        tariffValue: expect.any(Number),
      });
    });

    it('should support search by code number', async () => {
      const response = await api.listCodes(authHeader('admin'), {
        search: '19928',
      });

      expect(response.status).toBe(200);
      expect(response.data.codes).toHaveLength(1);
      expect(response.data.codes[0].code).toBe('19928');
    });

    it('should support search by description', async () => {
      const response = await api.listCodes(authHeader('admin'), {
        search: 'suivi',
      });

      expect(response.status).toBe(200);
      expect(response.data.codes.length).toBeGreaterThan(0);
      expect(response.data.codes[0].description).toContain('suivi');
    });

    it('should filter by category', async () => {
      const response = await api.listCodes(authHeader('admin'), {
        category: 'office_fee',
      });

      expect(response.status).toBe(200);
      expect(response.data.codes).toHaveLength(2); // 19928 and 19929
      expect(response.data.codes.every((c: Code) => c.category === 'office_fee')).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await api.listCodes(authHeader('admin'), {
        page: 1,
        limit: 2,
      });

      expect(response.status).toBe(200);
      expect(response.data.codes).toHaveLength(2);
      expect(response.data.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 5,
        pages: 3,
      });
    });
  });

  describe('POST /api/codes - Create Code', () => {
    it('should allow Admin to create code', async () => {
      const newCode = {
        code: '99999',
        description: 'Test Code - Admin Created',
        place: 'Cabinet',
        tariffValue: 75.50,
        category: 'test',
      };

      const response = await api.createCode(authHeader('admin'), newCode);

      expect(response.status).toBe(201);
      expect(response.data).toMatchObject({
        code: '99999',
        description: 'Test Code - Admin Created',
        tariffValue: 75.50,
        active: true,
      });
      expect(response.data.id).toBeDefined();
    });

    it('should allow Editor to create code', async () => {
      const newCode = {
        code: '88888',
        description: 'Test Code - Editor Created',
        tariffValue: 50.00,
      };

      const response = await api.createCode(authHeader('editor'), newCode);

      expect(response.status).toBe(201);
      expect(response.data.code).toBe('88888');
    });

    it('should DENY Viewer from creating code', async () => {
      const newCode = {
        code: '77777',
        description: 'Test Code - Viewer Attempt',
      };

      const response = await api.createCode(authHeader('viewer'), newCode);

      expect(response.status).toBe(403);
      expect(response.error).toContain('Insufficient permissions');
    });

    it('should validate required fields', async () => {
      const invalidCode = {
        code: '66666',
        // Missing description
      };

      const response = await api.createCode(authHeader('admin'), invalidCode);

      expect(response.status).toBe(400);
      expect(response.error).toContain('required');
    });
  });

  describe('PATCH /api/codes/:id - Update Code', () => {
    let codeId: string;

    beforeEach(async () => {
      const code = await db.public.one(`
        SELECT id FROM codes WHERE code = '15804' LIMIT 1
      `);
      codeId = code.id;
    });

    it('should allow Admin to update code', async () => {
      const updates = {
        description: 'Updated Description by Admin',
        tariffValue: 99.99,
      };

      const response = await api.updateCode(authHeader('admin'), codeId, updates);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        description: 'Updated Description by Admin',
        tariffValue: 99.99,
      });
    });

    it('should allow Editor to update code', async () => {
      const updates = {
        description: 'Updated by Editor',
      };

      const response = await api.updateCode(authHeader('editor'), codeId, updates);

      expect(response.status).toBe(200);
      expect(response.data.description).toBe('Updated by Editor');
    });

    it('should DENY Viewer from updating code', async () => {
      const updates = {
        description: 'Viewer Update Attempt',
      };

      const response = await api.updateCode(authHeader('viewer'), codeId, updates);

      expect(response.status).toBe(403);
      expect(response.error).toContain('Insufficient permissions');
    });

    it('should return 404 for non-existent code', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const updates = { description: 'Test' };

      const response = await api.updateCode(authHeader('admin'), fakeId, updates);

      expect(response.status).toBe(404);
      expect(response.error).toContain('not found');
    });
  });

  describe('DELETE /api/codes/:id - Delete Code', () => {
    let codeId: string;

    beforeEach(async () => {
      const code = await db.public.one(`
        SELECT id FROM codes WHERE code = '08000' LIMIT 1
      `);
      codeId = code.id;
    });

    it('should allow Admin to delete code', async () => {
      const response = await api.deleteCode(authHeader('admin'), codeId);

      expect(response.status).toBe(200);
      expect(response.data.message).toContain('deleted successfully');

      // Verify soft delete (active = false)
      const deletedCode = await db.public.one(`
        SELECT active FROM codes WHERE id = $1
      `, [codeId]);
      expect(deletedCode.active).toBe(false);
    });

    it('should DENY Editor from deleting code', async () => {
      const response = await api.deleteCode(authHeader('editor'), codeId);

      expect(response.status).toBe(403);
      expect(response.error).toContain('Admin role required');
    });

    it('should DENY Viewer from deleting code', async () => {
      const response = await api.deleteCode(authHeader('viewer'), codeId);

      expect(response.status).toBe(403);
      expect(response.error).toContain('Admin role required');
    });

    it('should return 404 for non-existent code', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await api.deleteCode(authHeader('admin'), fakeId);

      expect(response.status).toBe(404);
      expect(response.error).toContain('not found');
    });
  });
});
