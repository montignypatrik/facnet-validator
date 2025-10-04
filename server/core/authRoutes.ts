import { Router } from "express";
import { storage } from "./storage";
import { authenticateToken, type AuthenticatedRequest } from "./auth";

const router = Router();

/**
 * Core Authentication Routes
 *
 * Handles:
 * - Auth verification (/api/auth/verify)
 * - User creation/management during auth
 */

router.post("/api/auth/verify", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    let user;

    try {
      user = await storage.getUserByEmail(req.user!.email!);
    } catch (dbError) {
      console.warn("Database unavailable, creating temporary user:", dbError.message);
      // Database unavailable - create temporary user object
      user = null;
    }

    if (!user) {
      // Determine role based on email
      let role = "pending"; // Default for new users
      if (req.user!.email === "patrik.montigny@facturation.net") {
        role = "admin";
      }

      try {
        // Try to create user in database
        user = await storage.createUser({
          id: req.user!.uid,
          email: req.user!.email!,
          name: req.user!.claims.name || req.user!.email!.split("@")[0],
          role: role,
        });
      } catch (dbError) {
        console.warn("Cannot create user in database, using temporary user:", dbError.message);
        // Create temporary user object for local development
        user = {
          id: req.user!.uid,
          email: req.user!.email!,
          name: req.user!.claims.name || req.user!.email!.split("@")[0],
          role: role,
          createdAt: new Date(),
        };
      }
    }

    console.log("[AUTH DEBUG] Returning user:", JSON.stringify(user, null, 2));
    res.json({ user });
  } catch (error) {
    console.error("Auth verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
