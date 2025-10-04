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
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

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

      // Validate @facturation.net email domain
      if (!email || !email.endsWith("@facturation.net")) {
        console.error("Invalid email domain:", email);
        return res.status(403).json({ error: "Access restricted to @facturation.net email addresses" });
      }

      // Fetch user role from database
      let role = "admin"; // Default role (admin for local development)
      try {
        const dbUser = await storage.getUserByEmail(email);
        if (dbUser) {
          role = dbUser.role;
        }
      } catch (dbError) {
        console.warn("Database unavailable, using default role:", dbError.message);
        // Continue with default role instead of failing
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
