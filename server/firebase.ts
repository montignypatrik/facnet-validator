import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Request, Response, NextFunction } from "express";

// Initialize Firebase Admin
if (!getApps().length) {
  // For now, initialize with minimal config - will need proper service account for production
  try {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
    } else {
      // Initialize without admin SDK for now - authentication will use client-side
      console.warn("Firebase Admin not initialized - missing FIREBASE_SERVICE_ACCOUNT_KEY");
    }
  } catch (error) {
    console.warn("Firebase Admin initialization failed:", error);
  }
}

const auth = getApps().length > 0 ? getAuth() : null;

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role: string;
    claims: any;
  };
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // TEMPORARY: Handle mock token for development (auth bypass)
    if (token === "mock-token") {
      console.log("Authentication bypassed - accepting mock token");
      req.user = {
        uid: "temp-admin-user",
        email: "admin@dashvalidator.local",
        role: "admin",
        claims: { name: "Admin User" }
      };
      return next();
    }

    // Original Firebase token verification (for production)
    if (!auth) {
      return res.status(500).json({ error: "Firebase Admin not configured" });
    }

    const decodedToken = await auth.verifyIdToken(token);
    
    // Get user role from custom claims or default to viewer
    const role = decodedToken.role || "viewer";
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role,
      claims: decodedToken
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ error: "Invalid token" });
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

export { auth };
