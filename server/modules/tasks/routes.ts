import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { storage } from "../../core/storage.js";
import { authenticateToken, type AuthenticatedRequest } from "../../core/auth.js";
import {
  apiLimiter,
  boardCreationLimiter,
  taskCreationLimiter,
  commentLimiter,
  uploadLimiter,
} from "../../middleware/rateLimiter.js";
import {
  requireBoardOwnership,
  requireTaskOwnership,
  requireCommentOwnership,
} from "./middleware.js";
import {
  sanitizeHtml,
  sanitizeTaskBoardData,
  sanitizeTaskData,
  sanitizeCommentData,
  sanitizeLabelData,
} from "./sanitization.js";
import { taskAttachmentUpload } from "./fileUpload.js";
import type {
  InsertTaskBoard,
  InsertTaskList,
  InsertTask,
  InsertTaskLabel,
  InsertTaskComment,
  InsertTaskAttachment,
} from "../../../shared/schema.js";

const router = Router();

// Apply API rate limiter to all task routes
router.use(apiLimiter);

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createBoardSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

const updateBoardSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

const createListSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1).max(100),
  position: z.string().optional(), // Numeric type in DB maps to string in TypeScript
});

const updateListSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  position: z.string().optional(), // Numeric type in DB maps to string in TypeScript
});

const createTaskSchema = z.object({
  boardId: z.string().uuid(),
  listId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  position: z.string().optional(), // Numeric type in DB maps to string in TypeScript
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

const updateTaskSchema = z.object({
  listId: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  position: z.string().optional(), // Numeric type in DB maps to string in TypeScript
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().datetime().optional().nullable(),
});

const createLabelSchema = z.object({
  boardId: z.string().uuid(),
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

const updateLabelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

const assignLabelSchema = z.object({
  taskId: z.string().uuid(),
  labelId: z.string().uuid(),
});

const createCommentSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().min(1).max(5000),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(5000),
});

// ============================================================================
// TASK BOARDS
// ============================================================================

// GET /api/tasks/boards - Get all boards for authenticated user
router.get("/boards", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const boards = await storage.getTaskBoards(userId);
    return res.status(200).json(boards);
  } catch (error) {
    console.error("Error fetching task boards:", error);
    return res.status(500).json({
      error: "Erreur lors de la récupération des tableaux de tâches",
    });
  }
});

// GET /api/tasks/boards/:id - Get single board
router.get("/boards/:id", authenticateToken, requireBoardOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const board = await storage.getTaskBoard(id);

    if (!board) {
      return res.status(404).json({ error: "Tableau de tâches introuvable" });
    }

    return res.status(200).json(board);
  } catch (error) {
    console.error("Error fetching task board:", error);
    return res.status(500).json({
      error: "Erreur lors de la récupération du tableau de tâches",
    });
  }
});

// POST /api/tasks/boards - Create new board
router.post("/boards", authenticateToken, boardCreationLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = createBoardSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Données invalides",
        details: validation.error.errors,
      });
    }

    const userId = req.user!.uid;

    const boardData: InsertTaskBoard = {
      name: validation.data.name,
      description: validation.data.description,
      createdBy: userId,
    };

    const board = await storage.createTaskBoard(boardData);
    return res.status(201).json(board);
  } catch (error) {
    console.error("Error creating task board:", error);
    return res.status(500).json({
      error: "Erreur lors de la création du tableau de tâches",
    });
  }
});

// PATCH /api/tasks/boards/:id - Update board
router.patch("/boards/:id", authenticateToken, requireBoardOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateBoardSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Données invalides",
        details: validation.error.errors,
      });
    }

    const sanitizedData = sanitizeTaskBoardData(validation.data);
    const board = await storage.updateTaskBoard(id, sanitizedData);
    return res.status(200).json(board);
  } catch (error) {
    console.error("Error updating task board:", error);
    return res.status(500).json({
      error: "Erreur lors de la mise à jour du tableau de tâches",
    });
  }
});

// DELETE /api/tasks/boards/:id - Delete board (soft delete)
router.delete("/boards/:id", authenticateToken, requireBoardOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await storage.deleteTaskBoard(id);
    return res.status(200).json({ message: "Tableau de tâches supprimé avec succès" });
  } catch (error) {
    console.error("Error deleting task board:", error);
    return res.status(500).json({
      error: "Erreur lors de la suppression du tableau de tâches",
    });
  }
});

// ============================================================================
// TASK LISTS
// ============================================================================

// GET /api/tasks/lists/:id - Get all lists for a board
router.get("/lists/:id", authenticateToken, requireBoardOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: boardId } = req.params;
    const lists = await storage.getTaskLists(boardId);
    return res.status(200).json(lists);
  } catch (error) {
    console.error("Error fetching task lists:", error);
    return res.status(500).json({
      error: "Erreur lors de la récupération des listes de tâches",
    });
  }
});

// GET /api/tasks/lists/single/:id - Get single list
router.get("/lists/single/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const list = await storage.getTaskList(id);

    if (!list) {
      return res.status(404).json({ error: "Liste de tâches introuvable" });
    }

    // Verify board ownership
    const board = await storage.getTaskBoard(list.boardId);
    if (!board || board.createdBy !== req.user!.uid) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    return res.status(200).json(list);
  } catch (error) {
    console.error("Error fetching task list:", error);
    return res.status(500).json({
      error: "Erreur lors de la récupération de la liste de tâches",
    });
  }
});

// POST /api/tasks/lists - Create new list
router.post("/lists", authenticateToken, taskCreationLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = createListSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Données invalides",
        details: validation.error.errors,
      });
    }

    const { boardId } = validation.data;

    // Verify board ownership
    const board = await storage.getTaskBoard(boardId);
    console.log("List creation ownership check:", {
      boardId,
      boardExists: !!board,
      boardCreatedBy: board?.createdBy,
      currentUserId: req.user!.uid,
      match: board?.createdBy === req.user!.uid
    });

    if (!board || board.createdBy !== req.user!.uid) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    const listData: InsertTaskList = {
      boardId: validation.data.boardId,
      name: validation.data.name,
      position: validation.data.position || "0", // Default to position 0 if not provided
    };

    const list = await storage.createTaskList(listData);
    return res.status(201).json(list);
  } catch (error) {
    console.error("Error creating task list:", error);
    return res.status(500).json({
      error: "Erreur lors de la création de la liste de tâches",
    });
  }
});

// PATCH /api/tasks/lists/:id - Update list
router.patch("/lists/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateListSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Données invalides",
        details: validation.error.errors,
      });
    }

    // Verify list exists and board ownership
    const list = await storage.getTaskList(id);
    if (!list) {
      return res.status(404).json({ error: "Liste de tâches introuvable" });
    }

    const board = await storage.getTaskBoard(list.boardId);
    if (!board || board.createdBy !== req.user!.uid) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    const updatedList = await storage.updateTaskList(id, validation.data);
    return res.status(200).json(updatedList);
  } catch (error) {
    console.error("Error updating task list:", error);
    return res.status(500).json({
      error: "Erreur lors de la mise à jour de la liste de tâches",
    });
  }
});

// DELETE /api/tasks/lists/:id - Delete list (soft delete)
router.delete("/lists/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify list exists and board ownership
    const list = await storage.getTaskList(id);
    if (!list) {
      return res.status(404).json({ error: "Liste de tâches introuvable" });
    }

    const board = await storage.getTaskBoard(list.boardId);
    if (!board || board.createdBy !== req.user!.uid) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    await storage.deleteTaskList(id);
    return res.status(200).json({ message: "Liste de tâches supprimée avec succès" });
  } catch (error) {
    console.error("Error deleting task list:", error);
    return res.status(500).json({
      error: "Erreur lors de la suppression de la liste de tâches",
    });
  }
});

// ============================================================================
// TASKS
// ============================================================================

// GET /api/tasks/board/:id - Get all tasks for a board
router.get("/board/:id", authenticateToken, requireBoardOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: boardId } = req.params;
    const tasks = await storage.getTasksByBoard(boardId);
    return res.status(200).json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return res.status(500).json({
      error: "Erreur lors de la récupération des tâches",
    });
  }
});

// GET /api/tasks/single/:id - Get single task
router.get("/single/:id", authenticateToken, requireTaskOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const task = await storage.getTask(id);

    if (!task) {
      return res.status(404).json({ error: "Tâche introuvable" });
    }

    return res.status(200).json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    return res.status(500).json({
      error: "Erreur lors de la récupération de la tâche",
    });
  }
});

// POST /api/tasks - Create new task
router.post("/", authenticateToken, taskCreationLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = createTaskSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Données invalides",
        details: validation.error.errors,
      });
    }

    const { boardId } = validation.data;

    // Verify board ownership
    const board = await storage.getTaskBoard(boardId);
    if (!board || board.createdBy !== req.user!.uid) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    const userId = req.user!.uid;

    // Sanitize HTML description
    const description = validation.data.description
      ? sanitizeHtml(validation.data.description)
      : undefined;

    const taskData: InsertTask = {
      boardId: validation.data.boardId,
      listId: validation.data.listId,
      title: validation.data.title,
      description,
      position: validation.data.position || "0", // Default to position 0 if not provided
      status: validation.data.status,
      priority: validation.data.priority,
      assignedTo: validation.data.assignedTo,
      createdBy: userId,
      dueDate: validation.data.dueDate ? new Date(validation.data.dueDate) : undefined,
    };

    const task = await storage.createTask(taskData);
    return res.status(201).json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    return res.status(500).json({
      error: "Erreur lors de la création de la tâche",
    });
  }
});

// PATCH /api/tasks/:id - Update task
router.patch("/:id", authenticateToken, requireTaskOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateTaskSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Données invalides",
        details: validation.error.errors,
      });
    }

    // Sanitize HTML description if present
    const description = validation.data.description !== undefined
      ? (validation.data.description ? sanitizeHtml(validation.data.description) : null)
      : undefined;

    // Handle dueDate conversion
    const updateData: Partial<InsertTask> = {
      listId: validation.data.listId,
      title: validation.data.title,
      description,
      position: validation.data.position,
      status: validation.data.status,
      priority: validation.data.priority,
      assignedTo: validation.data.assignedTo,
      dueDate: validation.data.dueDate === null
        ? null
        : validation.data.dueDate
          ? new Date(validation.data.dueDate)
          : undefined,
    };

    const task = await storage.updateTask(id, updateData);
    return res.status(200).json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    return res.status(500).json({
      error: "Erreur lors de la mise à jour de la tâche",
    });
  }
});

// DELETE /api/tasks/:id - Delete task (soft delete)
router.delete("/:id", authenticateToken, requireTaskOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await storage.deleteTask(id);
    return res.status(200).json({ message: "Tâche supprimée avec succès" });
  } catch (error) {
    console.error("Error deleting task:", error);
    return res.status(500).json({
      error: "Erreur lors de la suppression de la tâche",
    });
  }
});

// ============================================================================
// TASK LABELS
// ============================================================================

// GET /api/tasks/labels/:boardId - Get all labels for a board
router.get("/labels/:boardId", authenticateToken, requireBoardOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { boardId } = req.params;
    const labels = await storage.getTaskLabels(boardId);
    return res.status(200).json(labels);
  } catch (error) {
    console.error("Error fetching task labels:", error);
    return res.status(500).json({
      error: "Erreur lors de la récupération des étiquettes",
    });
  }
});

// POST /api/tasks/labels - Create new label
router.post("/labels", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = createLabelSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Données invalides",
        details: validation.error.errors,
      });
    }

    const { boardId } = validation.data;

    // Verify board ownership
    const board = await storage.getTaskBoard(boardId);
    if (!board || board.createdBy !== req.user!.uid) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    const labelData: InsertTaskLabel = {
      boardId,
      name: validation.data.name,
      color: validation.data.color,
    };

    const label = await storage.createTaskLabel(labelData);
    return res.status(201).json(label);
  } catch (error) {
    console.error("Error creating task label:", error);
    return res.status(500).json({
      error: "Erreur lors de la création de l'étiquette",
    });
  }
});

// PATCH /api/tasks/labels/:id - Update label
router.patch("/labels/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateLabelSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Données invalides",
        details: validation.error.errors,
      });
    }

    // Verify label exists and board ownership
    const label = await storage.getTaskLabel(id);
    if (!label) {
      return res.status(404).json({ error: "Étiquette introuvable" });
    }

    const board = await storage.getTaskBoard(label.boardId);
    if (!board || board.createdBy !== req.user!.uid) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    const sanitizedData = sanitizeLabelData(validation.data);
    const updatedLabel = await storage.updateTaskLabel(id, sanitizedData);
    return res.status(200).json(updatedLabel);
  } catch (error) {
    console.error("Error updating task label:", error);
    return res.status(500).json({
      error: "Erreur lors de la mise à jour de l'étiquette",
    });
  }
});

// DELETE /api/tasks/labels/:id - Delete label
router.delete("/labels/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify label exists and board ownership
    const label = await storage.getTaskLabel(id);
    if (!label) {
      return res.status(404).json({ error: "Étiquette introuvable" });
    }

    const board = await storage.getTaskBoard(label.boardId);
    if (!board || board.createdBy !== req.user!.uid) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    await storage.deleteTaskLabel(id);
    return res.status(200).json({ message: "Étiquette supprimée avec succès" });
  } catch (error) {
    console.error("Error deleting task label:", error);
    return res.status(500).json({
      error: "Erreur lors de la suppression de l'étiquette",
    });
  }
});

// POST /api/tasks/labels/assign - Assign label to task
router.post("/labels/assign", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = assignLabelSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Données invalides",
        details: validation.error.errors,
      });
    }

    const { taskId, labelId } = validation.data;

    // Verify task ownership
    const task = await storage.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: "Tâche introuvable" });
    }

    const board = await storage.getTaskBoard(task.boardId);
    if (!board || board.createdBy !== req.user!.uid) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    // Verify label exists and belongs to same board
    const label = await storage.getTaskLabel(labelId);
    if (!label || label.boardId !== task.boardId) {
      return res.status(400).json({ error: "Étiquette invalide pour cette tâche" });
    }

    const assignment = await storage.assignLabel(taskId, labelId);
    return res.status(201).json(assignment);
  } catch (error) {
    console.error("Error assigning label:", error);
    return res.status(500).json({
      error: "Erreur lors de l'attribution de l'étiquette",
    });
  }
});

// DELETE /api/tasks/labels/assign/:taskId/:labelId - Unassign label from task
router.delete("/labels/assign/:taskId/:labelId", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId, labelId } = req.params;

    // Verify task ownership
    const task = await storage.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: "Tâche introuvable" });
    }

    const board = await storage.getTaskBoard(task.boardId);
    if (!board || board.createdBy !== req.user!.uid) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    await storage.unassignLabel(taskId, labelId);
    return res.status(200).json({ message: "Étiquette retirée avec succès" });
  } catch (error) {
    console.error("Error unassigning label:", error);
    return res.status(500).json({
      error: "Erreur lors du retrait de l'étiquette",
    });
  }
});

// GET /api/tasks/labels/assignments/:taskId - Get all labels assigned to a task
router.get("/labels/assignments/:taskId", authenticateToken, requireTaskOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const assignments = await storage.getTaskLabelAssignments(taskId);
    return res.status(200).json(assignments);
  } catch (error) {
    console.error("Error fetching task label assignments:", error);
    return res.status(500).json({
      error: "Erreur lors de la récupération des étiquettes de la tâche",
    });
  }
});

// ============================================================================
// TASK COMMENTS
// ============================================================================

// GET /api/tasks/comments/:taskId - Get all comments for a task
router.get("/comments/:taskId", authenticateToken, requireTaskOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const comments = await storage.getTaskComments(taskId);
    return res.status(200).json(comments);
  } catch (error) {
    console.error("Error fetching task comments:", error);
    return res.status(500).json({
      error: "Erreur lors de la récupération des commentaires",
    });
  }
});

// POST /api/tasks/comments - Create new comment
router.post("/comments", authenticateToken, commentLimiter, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = createCommentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Données invalides",
        details: validation.error.errors,
      });
    }

    const { taskId } = validation.data;

    // Verify task exists and ownership
    const task = await storage.getTask(taskId);
    if (!task) {
      return res.status(404).json({ error: "Tâche introuvable" });
    }

    const board = await storage.getTaskBoard(task.boardId);
    if (!board || board.createdBy !== req.user!.uid) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    const userId = req.user!.uid;
    const sanitizedContent = sanitizeHtml(validation.data.content);

    const commentData: InsertTaskComment = {
      taskId,
      content: sanitizedContent,
      authorId: userId,
    };

    const comment = await storage.createTaskComment(commentData);
    return res.status(201).json(comment);
  } catch (error) {
    console.error("Error creating task comment:", error);
    return res.status(500).json({
      error: "Erreur lors de la création du commentaire",
    });
  }
});

// PATCH /api/tasks/comments/:id - Update comment
router.patch("/comments/:id", authenticateToken, requireCommentOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateCommentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        error: "Données invalides",
        details: validation.error.errors,
      });
    }

    const sanitizedContent = sanitizeHtml(validation.data.content);
    const comment = await storage.updateTaskComment(id, { content: sanitizedContent });
    return res.status(200).json(comment);
  } catch (error) {
    console.error("Error updating task comment:", error);
    return res.status(500).json({
      error: "Erreur lors de la mise à jour du commentaire",
    });
  }
});

// DELETE /api/tasks/comments/:id - Delete comment (soft delete)
router.delete("/comments/:id", authenticateToken, requireCommentOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await storage.deleteTaskComment(id);
    return res.status(200).json({ message: "Commentaire supprimé avec succès" });
  } catch (error) {
    console.error("Error deleting task comment:", error);
    return res.status(500).json({
      error: "Erreur lors de la suppression du commentaire",
    });
  }
});

// ============================================================================
// TASK ATTACHMENTS
// ============================================================================

// GET /api/tasks/attachments/:taskId - Get all attachments for a task
router.get("/attachments/:taskId", authenticateToken, requireTaskOwnership, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const attachments = await storage.getTaskAttachments(taskId);
    return res.status(200).json(attachments);
  } catch (error) {
    console.error("Error fetching task attachments:", error);
    return res.status(500).json({
      error: "Erreur lors de la récupération des pièces jointes",
    });
  }
});

// POST /api/tasks/attachments - Upload new attachment
router.post(
  "/attachments",
  authenticateToken,
  uploadLimiter,
  taskAttachmentUpload.single("file"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { taskId } = req.body;

      if (!taskId) {
        return res.status(400).json({ error: "ID de tâche requis" });
      }

      // Verify task exists and ownership
      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Tâche introuvable" });
      }

      const board = await storage.getTaskBoard(task.boardId);
      if (!board || board.createdBy !== req.user!.uid) {
        return res.status(403).json({ error: "Accès interdit" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier téléchargé" });
      }

      const userId = req.user!.uid;

      const attachmentData: InsertTaskAttachment = {
        taskId,
        fileName: req.file.filename, // Secure filename generated by multer
        originalName: req.file.originalname,
        storagePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedBy: userId,
      };

      const attachment = await storage.createTaskAttachment(attachmentData);
      return res.status(201).json(attachment);
    } catch (error) {
      console.error("Error uploading task attachment:", error);
      return res.status(500).json({
        error: "Erreur lors du téléchargement de la pièce jointe",
      });
    }
  }
);

// DELETE /api/tasks/attachments/:id - Delete attachment
router.delete("/attachments/:id", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify attachment exists
    const attachment = await storage.getTaskAttachment(id);
    if (!attachment) {
      return res.status(404).json({ error: "Pièce jointe introuvable" });
    }

    // Verify task ownership
    const task = await storage.getTask(attachment.taskId);
    if (!task) {
      return res.status(404).json({ error: "Tâche introuvable" });
    }

    const board = await storage.getTaskBoard(task.boardId);
    if (!board || board.createdBy !== req.user!.uid) {
      return res.status(403).json({ error: "Accès interdit" });
    }

    await storage.deleteTaskAttachment(id);
    return res.status(200).json({ message: "Pièce jointe supprimée avec succès" });
  } catch (error) {
    console.error("Error deleting task attachment:", error);
    return res.status(500).json({
      error: "Erreur lors de la suppression de la pièce jointe",
    });
  }
});

export default router;
