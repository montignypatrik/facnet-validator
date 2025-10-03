import { Router } from "express";
import { storage } from "../../core/storage";
import { authenticateToken, requireRole, type AuthenticatedRequest } from "../../core/auth";

const router = Router();

/**
 * Administration Module Routes
 *
 * Handles:
 * - User management (/api/users)
 * - Role assignment
 * - Admin-only operations
 */

// ==================== USER MANAGEMENT ROUTES ====================

router.get("/api/users", authenticateToken, requireRole(["admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const users = await storage.getUsers();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.patch("/api/users/:id", authenticateToken, requireRole(["admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !["admin", "editor", "viewer", "pending"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const user = await storage.updateUser(id, { role });
    res.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

export default router;
