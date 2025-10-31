import { Router } from "express";
import { storage } from "../../core/storage";
import { authenticateToken, requireRole, type AuthenticatedRequest } from "../../core/auth";
import { insertDoctorSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

/**
 * Book de MD Module Routes
 *
 * User-scoped doctor directory management.
 * Each user can only view/edit their own doctors, except admins who can see all.
 *
 * Routes:
 * - GET /api/doctors - List user's doctors (with search/pagination)
 * - GET /api/doctors/:id - Get single doctor (ownership check)
 * - POST /api/doctors - Create new doctor
 * - PATCH /api/doctors/:id - Update doctor (ownership check)
 * - DELETE /api/doctors/:id - Delete doctor (ownership + admin check)
 */

// ==================== HELPER MIDDLEWARE ====================

/**
 * Middleware to check if user owns the resource or is an admin
 */
const requireOwnershipOrAdmin = async (req: AuthenticatedRequest, res: any, next: any) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;
    const userRole = req.user!.role;

    // Admins can access all resources
    if (userRole === "admin") {
      return next();
    }

    // Check if user owns the resource
    const doctor = await storage.getDoctor(id, userId);
    if (!doctor) {
      return res.status(404).json({ error: "Médecin non trouvé ou accès refusé" });
    }

    next();
  } catch (error) {
    console.error("Ownership check error:", error);
    res.status(500).json({ error: "Erreur lors de la vérification des permissions" });
  }
};

// ==================== DOCTOR MANAGEMENT ROUTES ====================

/**
 * GET /api/doctors
 * List user's doctors with search and pagination
 */
router.get("/api/doctors", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.uid;
    const { search, page, pageSize } = req.query;

    const result = await storage.getDoctors(userId, {
      search: search as string | undefined,
      page: page ? parseInt(page as string) : 1,
      pageSize: pageSize ? parseInt(pageSize as string) : 50,
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({ error: "Échec de la récupération des médecins" });
  }
});

/**
 * GET /api/doctors/:id
 * Get single doctor (ownership check)
 */
router.get("/api/doctors/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;
    const userRole = req.user!.role;

    // Admins can view any doctor
    let doctor;
    if (userRole === "admin") {
      // Admin: fetch without user filter
      const [result] = await storage.getDoctors(userId, { page: 1, pageSize: 1 });
      doctor = result.data.find(d => d.id === id);

      // If not found in user's list, search globally (admin privilege)
      if (!doctor) {
        doctor = await storage.getDoctor(id, userId);
      }
    } else {
      // Regular user: only fetch their own doctors
      doctor = await storage.getDoctor(id, userId);
    }

    if (!doctor) {
      return res.status(404).json({ error: "Médecin non trouvé" });
    }

    res.json(doctor);
  } catch (error) {
    console.error("Error fetching doctor:", error);
    res.status(500).json({ error: "Échec de la récupération du médecin" });
  }
});

/**
 * POST /api/doctors
 * Create new doctor (automatically scoped to current user)
 */
router.post("/api/doctors", authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.uid;

    // Validate request body
    const validatedData = insertDoctorSchema.parse({
      ...req.body,
      userId, // Force userId to current user
      createdBy: userId,
      updatedBy: userId,
    });

    const doctor = await storage.createDoctor(validatedData);
    res.json(doctor);
  } catch (error) {
    console.error("Error creating doctor:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Erreur de validation",
        details: error.errors
      });
    }
    res.status(500).json({ error: "Échec de la création du médecin" });
  }
});

/**
 * PATCH /api/doctors/:id
 * Update doctor (ownership check)
 */
router.patch("/api/doctors/:id", authenticateToken, requireOwnershipOrAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;

    const doctor = await storage.updateDoctor(id, userId, {
      ...req.body,
      updatedBy: userId,
    });

    if (!doctor) {
      return res.status(404).json({ error: "Médecin non trouvé" });
    }

    res.json(doctor);
  } catch (error) {
    console.error("Error updating doctor:", error);
    res.status(500).json({ error: "Échec de la mise à jour du médecin" });
  }
});

/**
 * DELETE /api/doctors/:id
 * Delete doctor (ownership + admin check)
 */
router.delete("/api/doctors/:id", authenticateToken, requireRole(["admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.uid;

    await storage.deleteDoctor(id, userId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting doctor:", error);
    res.status(500).json({ error: "Échec de la suppression du médecin" });
  }
});

export default router;
