/**
 * Unit Tests for requireOwnership Middleware
 * Tests PHI access control for Quebec healthcare billing validation system
 *
 * Security Requirements:
 * - Users can only access their own validation runs
 * - Admins can access any validation run (with audit logging)
 * - Unauthorized access attempts are logged for security monitoring
 * - 403 Forbidden returned for unauthorized access
 * - 404 Not Found returned for non-existent resources
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireOwnership, type AuthenticatedRequest } from '@/server/core/auth';

// Mock logger module
vi.mock('@/server/modules/validateur/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('requireOwnership middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks before each test
    jsonMock = vi.fn();
    statusMock = vi.fn(() => ({ json: jsonMock }));

    mockReq = {
      params: { id: 'test-validation-run-id' },
      path: '/api/validations/test-validation-run-id',
      method: 'GET',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'vitest-test-client',
      },
      user: undefined,
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('User owns resource', () => {
    it('should allow access when user owns the validation run', async () => {
      const userId = 'user-123';
      mockReq.user = {
        uid: userId,
        email: 'user@facturation.net',
        role: 'editor',
        claims: {},
      };

      const getResourceOwner = vi.fn().mockResolvedValue(userId);
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(getResourceOwner).toHaveBeenCalledWith('test-validation-run-id');
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow access for viewer role when they own the resource', async () => {
      const userId = 'viewer-456';
      mockReq.user = {
        uid: userId,
        email: 'viewer@facturation.net',
        role: 'viewer',
        claims: {},
      };

      const getResourceOwner = vi.fn().mockResolvedValue(userId);
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });
  });

  describe('User does not own resource', () => {
    it('should return 403 when user tries to access another users validation run', async () => {
      mockReq.user = {
        uid: 'user-123',
        email: 'user@facturation.net',
        role: 'editor',
        claims: {},
      };

      const getResourceOwner = vi.fn().mockResolvedValue('user-456'); // Different owner
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(getResourceOwner).toHaveBeenCalledWith('test-validation-run-id');
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Access denied: You do not have permission to access this resource',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should log unauthorized access attempt for security monitoring', async () => {
      const { logger } = await import('@/server/modules/validateur/logger');

      mockReq.user = {
        uid: 'user-123',
        email: 'hacker@facturation.net',
        role: 'editor',
        claims: {},
      };

      const getResourceOwner = vi.fn().mockResolvedValue('user-456');
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(logger.warn).toHaveBeenCalledWith(
        'test-validation-run-id',
        'SECURITY',
        expect.stringContaining('Unauthorized access attempt'),
        expect.objectContaining({
          userId: 'user-123',
          resourceId: 'test-validation-run-id',
          resourceOwnerId: 'user-456',
          endpoint: '/api/validations/test-validation-run-id',
          method: 'GET',
          ipAddress: '127.0.0.1',
          userAgent: 'vitest-test-client',
        })
      );
    });

    it('should prevent viewer from accessing other users data', async () => {
      mockReq.user = {
        uid: 'viewer-789',
        email: 'viewer@facturation.net',
        role: 'viewer',
        claims: {},
      };

      const getResourceOwner = vi.fn().mockResolvedValue('user-456');
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Admin access', () => {
    it('should allow admin to access any validation run', async () => {
      mockReq.user = {
        uid: 'admin-999',
        email: 'admin@facturation.net',
        role: 'admin',
        claims: {},
      };

      const getResourceOwner = vi.fn().mockResolvedValue('user-123'); // Different owner
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(getResourceOwner).toHaveBeenCalledWith('test-validation-run-id');
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should create audit log when admin accesses other users data', async () => {
      const { logger } = await import('@/server/modules/validateur/logger');

      mockReq.user = {
        uid: 'admin-999',
        email: 'admin@facturation.net',
        role: 'admin',
        claims: {},
      };

      const getResourceOwner = vi.fn().mockResolvedValue('user-123');
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(logger.info).toHaveBeenCalledWith(
        'test-validation-run-id',
        'SECURITY',
        expect.stringContaining('Admin admin@facturation.net (admin-999) accessed resource owned by user-123'),
        expect.objectContaining({
          userId: 'admin-999',
          resourceId: 'test-validation-run-id',
          resourceOwnerId: 'user-123',
          endpoint: '/api/validations/test-validation-run-id',
          method: 'GET',
          ipAddress: '127.0.0.1',
          userAgent: 'vitest-test-client',
        })
      );
    });

    it('should NOT create audit log when admin accesses their own data', async () => {
      const { logger } = await import('@/server/modules/validateur/logger');
      vi.clearAllMocks(); // Clear previous mock calls

      const adminId = 'admin-999';
      mockReq.user = {
        uid: adminId,
        email: 'admin@facturation.net',
        role: 'admin',
        claims: {},
      };

      const getResourceOwner = vi.fn().mockResolvedValue(adminId); // Same owner
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(logger.info).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Resource not found', () => {
    it('should return 404 when validation run does not exist', async () => {
      mockReq.user = {
        uid: 'user-123',
        email: 'user@facturation.net',
        role: 'editor',
        claims: {},
      };

      const getResourceOwner = vi.fn().mockResolvedValue(null); // Resource not found
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Resource not found' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 404 for admin when resource does not exist', async () => {
      mockReq.user = {
        uid: 'admin-999',
        email: 'admin@facturation.net',
        role: 'admin',
        claims: {},
      };

      const getResourceOwner = vi.fn().mockResolvedValue(null);
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should return 401 when user is not authenticated', async () => {
      mockReq.user = undefined; // No authenticated user

      const getResourceOwner = vi.fn();
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'User not authenticated' });
      expect(getResourceOwner).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when resource ID is missing', async () => {
      mockReq.user = {
        uid: 'user-123',
        email: 'user@facturation.net',
        role: 'editor',
        claims: {},
      };
      mockReq.params = {}; // No ID in params

      const getResourceOwner = vi.fn();
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Resource ID is required' });
      expect(getResourceOwner).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 500 when database query fails', async () => {
      mockReq.user = {
        uid: 'user-123',
        email: 'user@facturation.net',
        role: 'editor',
        claims: {},
      };

      const getResourceOwner = vi.fn().mockRejectedValue(new Error('Database connection failed'));
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Failed to verify resource ownership' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle validation run with null createdBy (legacy data)', async () => {
      mockReq.user = {
        uid: 'user-123',
        email: 'user@facturation.net',
        role: 'editor',
        claims: {},
      };

      // Legacy validation run with no owner (createdBy is null)
      const getResourceOwner = vi.fn().mockResolvedValue(null);
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      // Should return 404 (resource not found) to prevent access to orphaned data
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle empty string as owner ID', async () => {
      mockReq.user = {
        uid: 'user-123',
        email: 'user@facturation.net',
        role: 'editor',
        claims: {},
      };

      const getResourceOwner = vi.fn().mockResolvedValue(''); // Empty string
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      // Empty string is falsy, but not null, so it should deny access
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Audit logging metadata', () => {
    it('should capture IP address in audit logs', async () => {
      const { logger } = await import('@/server/modules/validateur/logger');

      mockReq.user = {
        uid: 'admin-999',
        email: 'admin@facturation.net',
        role: 'admin',
        claims: {},
      };
      mockReq.ip = '192.168.1.100'; // Custom IP

      const getResourceOwner = vi.fn().mockResolvedValue('user-123');
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        'SECURITY',
        expect.any(String),
        expect.objectContaining({
          ipAddress: '192.168.1.100',
        })
      );
    });

    it('should capture user agent in audit logs', async () => {
      const { logger } = await import('@/server/modules/validateur/logger');

      mockReq.user = {
        uid: 'admin-999',
        email: 'admin@facturation.net',
        role: 'admin',
        claims: {},
      };
      mockReq.headers = {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      };

      const getResourceOwner = vi.fn().mockResolvedValue('user-123');
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        'SECURITY',
        expect.any(String),
        expect.objectContaining({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        })
      );
    });

    it('should capture HTTP method in audit logs', async () => {
      const { logger } = await import('@/server/modules/validateur/logger');

      mockReq.user = {
        uid: 'user-123',
        email: 'user@facturation.net',
        role: 'editor',
        claims: {},
      };
      mockReq.method = 'DELETE'; // Sensitive operation

      const getResourceOwner = vi.fn().mockResolvedValue('user-456');
      const middleware = requireOwnership(getResourceOwner);

      await middleware(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(logger.warn).toHaveBeenCalledWith(
        expect.any(String),
        'SECURITY',
        expect.any(String),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });

  describe('Multiple role scenarios', () => {
    const roles = ['viewer', 'editor', 'pending'];

    roles.forEach((role) => {
      it(`should deny ${role} access to other users validation runs`, async () => {
        mockReq.user = {
          uid: 'user-123',
          email: `${role}@facturation.net`,
          role,
          claims: {},
        };

        const getResourceOwner = vi.fn().mockResolvedValue('user-456');
        const middleware = requireOwnership(getResourceOwner);

        await middleware(
          mockReq as AuthenticatedRequest,
          mockRes as Response,
          mockNext
        );

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(mockNext).not.toHaveBeenCalled();
      });

      it(`should allow ${role} to access their own validation runs`, async () => {
        const userId = `${role}-user-123`;
        mockReq.user = {
          uid: userId,
          email: `${role}@facturation.net`,
          role,
          claims: {},
        };

        const getResourceOwner = vi.fn().mockResolvedValue(userId);
        const middleware = requireOwnership(getResourceOwner);

        await middleware(
          mockReq as AuthenticatedRequest,
          mockRes as Response,
          mockNext
        );

        expect(mockNext).toHaveBeenCalled();
        expect(statusMock).not.toHaveBeenCalled();
      });
    });
  });
});
