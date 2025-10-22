import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-client";
import { storage } from "./storage";

// Auth0 JWKS client
const client = jwksClient({
  jwksUri: `${process.env.AUTH0_ISSUER_BASE_URL}/.well-known/jwks.json`
});

// Function to get signing key
function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    // Use the correct method based on the key type
    const signingKey = key?.getPublicKey?.() || key?.publicKey || key?.rsaPublicKey;
    callback(null, signingKey);
  });
}

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role: string;
    claims: any;
  };
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // DEVELOPMENT MODE BYPASS - Skip authentication if DISABLE_AUTH is set
  if (process.env.DISABLE_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    console.log('[DEV] Authentication bypassed - DISABLE_AUTH=true');
    req.user = {
      uid: 'dev-user-123',
      email: 'dev@test.com',
      role: 'admin',
      claims: {}
    };
    return next();
  }

  // Support both Authorization header and query parameter (for SSE/EventSource)
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.split(' ')[1];

  // Fallback to query parameter for SSE connections (EventSource can't set headers)
  if (!token && req.query.token) {
    token = req.query.token as string;
  }

  console.log("Auth Debug:", { authHeader, token, path: req.path });

  if (!token) {
    console.log("No token provided");
    return res.status(401).json({ error: "No token provided" });
  }

  // Verify Auth0 JWT token
  try {
    // Auth0 always adds trailing slash to issuer claim in JWTs
    const issuerUrl = process.env.AUTH0_ISSUER_BASE_URL?.endsWith('/')
      ? process.env.AUTH0_ISSUER_BASE_URL
      : `${process.env.AUTH0_ISSUER_BASE_URL}/`;

    console.log("Expected issuer:", issuerUrl);

    jwt.verify(token, getKey, {
      issuer: issuerUrl,
      algorithms: ['RS256']
    }, async (err, decoded: any) => {
      if (err) {
        console.error("JWT verification error:", err);
        return res.status(401).json({ error: "Invalid token" });
      }

      // Get user email from Auth0 userinfo endpoint if not in token
      let email = decoded.email;

      if (!email) {
        try {
          const userInfoResponse = await fetch(`${process.env.AUTH0_ISSUER_BASE_URL}/userinfo`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json();
            email = userInfo.email;
          }
        } catch (fetchError) {
          console.error("Error fetching user info:", fetchError);
        }
      }

      // Validate @facturation.net email domain in production
      // TEMPORARILY DISABLED - email not always in token, needs Auth0 config fix
      // const isProd = process.env.NODE_ENV === 'production';
      // if (isProd && (!email || !email.endsWith("@facturation.net"))) {
      //   console.error("Invalid email domain:", email);
      //   return res.status(403).json({
      //     error: "Accès restreint aux adresses email @facturation.net"
      //   });
      // }

      // Fetch user role from database
      // Default to viewer for security (least privilege principle)
      let role = "viewer";

      try {
        const dbUser = await storage.getUserByEmail(email);
        if (dbUser) {
          role = dbUser.role;
        } else if (process.env.NODE_ENV !== 'production') {
          // Only grant admin in development with explicit flag
          role = process.env.DEV_DEFAULT_ADMIN === 'true' ? 'admin' : 'viewer';
          console.log(`[DEV] New user ${email}, assigned role: ${role}`);
        }
      } catch (dbError) {
        console.warn("Database unavailable, using default role:", dbError.message);
        // Fail securely - use viewer role even on database errors
      }

      req.user = {
        uid: decoded.sub,
        email: email,
        role: role, // Use role from database
        claims: decoded
      };

      console.log("Auth0 user authenticated:", req.user);
      next();
    });
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ error: "Authentication failed" });
  }
}

export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
}

/**
 * Ownership middleware for PHI access control
 *
 * Protects resources by ensuring users can only access their own data,
 * unless they are admins. Critical for Quebec healthcare RAMQ validator
 * to prevent unauthorized PHI (Protected Health Information) access.
 *
 * @param getResourceOwner - Async function to fetch the resource owner ID
 * @returns Express middleware that checks ownership before allowing access
 *
 * @example
 * router.get("/api/validations/:id",
 *   authenticateToken,
 *   requireOwnership(async (id) => {
 *     const run = await storage.getValidationRun(id);
 *     return run?.createdBy || null;
 *   }),
 *   handler
 * );
 */
export function requireOwnership(
  getResourceOwner: (resourceId: string) => Promise<string | null>
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const resourceId = req.params.id;
      if (!resourceId) {
        return res.status(400).json({ error: "Resource ID is required" });
      }

      // Fetch resource owner
      const ownerId = await getResourceOwner(resourceId);

      // Resource not found
      if (ownerId === null) {
        return res.status(404).json({ error: "Resource not found" });
      }

      // Admins can access any resource
      const isAdmin = req.user.role === "admin";

      // User owns the resource
      const isOwner = ownerId === req.user.uid;

      if (isAdmin) {
        // Audit log: Admin accessing another user's data
        if (!isOwner && ownerId) {
          // Import logger dynamically to avoid circular dependencies
          const { logger } = await import("../modules/validateur/logger.js");
          await logger.info(
            resourceId,
            "SECURITY",
            `Admin ${req.user.email} (${req.user.uid}) accessed resource owned by ${ownerId}`,
            {
              userId: req.user.uid,
              resourceId: resourceId,
              resourceOwnerId: ownerId,
              endpoint: req.path,
              method: req.method,
              ipAddress: req.ip,
              userAgent: req.headers["user-agent"],
            }
          );
        }
        return next();
      }

      // Check ownership
      if (isOwner) {
        return next();
      }

      // Unauthorized access attempt - log for security monitoring
      const { logger } = await import("../modules/validateur/logger.js");
      await logger.warn(
        resourceId,
        "SECURITY",
        `Unauthorized access attempt: User ${req.user.email} (${req.user.uid}) tried to access resource owned by ${ownerId}`,
        {
          userId: req.user.uid,
          resourceId: resourceId,
          resourceOwnerId: ownerId,
          endpoint: req.path,
          method: req.method,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        }
      );

      return res.status(403).json({
        error: "Access denied: You do not have permission to access this resource"
      });
    } catch (error) {
      console.error("Ownership check error:", error);
      return res.status(500).json({ error: "Failed to verify resource ownership" });
    }
  };
}
