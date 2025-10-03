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
    let user = await storage.getUserByEmail(req.user!.email!);

    if (!user) {
      // Determine role based on email
      let role = "pending"; // Default for new users
      if (req.user!.email === "patrik.montigny@facturation.net") {
        role = "admin";
      }

      // Create user if doesn't exist
      user = await storage.createUser({
        id: req.user!.uid,
        email: req.user!.email!,
        name: req.user!.claims.name || req.user!.email!.split("@")[0],
        role: role,
      });
    }

    res.json({ user });
  } catch (error) {
    console.error("Auth verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
