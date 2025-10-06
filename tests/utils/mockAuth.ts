/**
 * Mock Auth0 JWT Token Generation for Testing
 *
 * Provides utilities to generate mock JWT tokens with different user roles
 * for testing RBAC (Role-Based Access Control) in API endpoints.
 */

import jwt from 'jsonwebtoken';

const MOCK_SECRET = 'test-secret-key-for-auth0-mocking';
const MOCK_ISSUER = 'https://dev-x63i3b6hf5kch7ab.ca.auth0.com/';
const MOCK_AUDIENCE = 'facnet-validator-api';

export interface MockUser {
  sub: string; // Auth0 user ID
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer' | 'pending';
}

/**
 * Pre-defined test users for different roles
 */
export const MOCK_USERS = {
  admin: {
    sub: 'auth0|admin123',
    email: 'admin@test.com',
    name: 'Admin Test User',
    role: 'admin' as const,
  },
  editor: {
    sub: 'auth0|editor123',
    email: 'editor@test.com',
    name: 'Editor Test User',
    role: 'editor' as const,
  },
  viewer: {
    sub: 'auth0|viewer123',
    email: 'viewer@test.com',
    name: 'Viewer Test User',
    role: 'viewer' as const,
  },
  pending: {
    sub: 'auth0|pending123',
    email: 'pending@test.com',
    name: 'Pending Test User',
    role: 'pending' as const,
  },
};

/**
 * Generate a mock JWT token for testing
 *
 * @param user - User object with role and identity information
 * @param expiresIn - Token expiration time (default: 1 hour)
 * @returns JWT token string
 */
export function generateMockToken(
  user: MockUser,
  expiresIn: string = '1h'
): string {
  const payload = {
    sub: user.sub,
    email: user.email,
    name: user.name,
    'https://dash.facnet.ca/roles': [user.role], // Custom claim for role
    iss: MOCK_ISSUER,
    aud: MOCK_AUDIENCE,
  };

  return jwt.sign(payload, MOCK_SECRET, {
    expiresIn,
    algorithm: 'HS256',
  });
}

/**
 * Generate Authorization header with Bearer token
 *
 * @param user - User object or role string
 * @returns Authorization header object
 */
export function authHeader(
  user: MockUser | 'admin' | 'editor' | 'viewer' | 'pending'
): { Authorization: string } {
  const userObj = typeof user === 'string' ? MOCK_USERS[user] : user;
  const token = generateMockToken(userObj);
  return { Authorization: `Bearer ${token}` };
}

/**
 * Decode a JWT token without verification (for testing)
 *
 * @param token - JWT token string
 * @returns Decoded token payload
 */
export function decodeToken(token: string): any {
  return jwt.decode(token);
}

/**
 * Verify a JWT token with the mock secret
 *
 * @param token - JWT token string
 * @returns Verified token payload
 */
export function verifyToken(token: string): any {
  return jwt.verify(token, MOCK_SECRET);
}

/**
 * Mock Auth0 middleware for testing
 * Replaces the real Auth0 middleware with a mock version
 */
export function mockAuth0Middleware() {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);

      // Attach user info to request (matching Auth0 format)
      req.auth = {
        sub: decoded.sub,
        payload: decoded,
      };

      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

/**
 * Extract role from decoded token
 *
 * @param decoded - Decoded JWT payload
 * @returns User role
 */
export function extractRole(decoded: any): string {
  const roles = decoded['https://dash.facnet.ca/roles'];
  return roles && roles.length > 0 ? roles[0] : 'viewer';
}
