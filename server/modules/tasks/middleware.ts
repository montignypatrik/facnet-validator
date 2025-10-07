/**
 * Task Ownership Middleware
 *
 * Enforces resource ownership for task boards, tasks, and comments.
 * Follows the same pattern as PHI access control (requireOwnership).
 *
 * Security Priority: HIGH
 *
 * Access Rules:
 * - Regular users: Can only access their own resources
 * - Admin users: Can access any resource (with audit logging)
 * - Unauthorized access: Returns 403 Forbidden
 */

import { storage } from "../../core/storage";
import { requireOwnership } from "../../core/auth";

/**
 * Get task board owner for ownership verification
 *
 * @param boardId - Task board UUID
 * @returns Auth0 user ID of board owner, or null if not found
 */
export async function getTaskBoardOwner(boardId: string): Promise<string | null> {
  try {
    const board = await storage.getTaskBoard(boardId);
    return board?.createdBy || null;
  } catch (error) {
    console.error("Error getting task board owner:", error);
    return null;
  }
}

/**
 * Get task owner through board ownership
 * Tasks inherit board permissions (users who own the board can access all tasks)
 *
 * @param taskId - Task UUID
 * @returns Auth0 user ID of board owner, or null if not found
 */
export async function getTaskOwner(taskId: string): Promise<string | null> {
  try {
    const task = await storage.getTask(taskId);
    if (!task) return null;

    // Get board owner (tasks inherit board permissions)
    const board = await storage.getTaskBoard(task.boardId);
    return board?.createdBy || null;
  } catch (error) {
    console.error("Error getting task owner:", error);
    return null;
  }
}

/**
 * Get comment owner through task -> board chain
 *
 * @param commentId - Comment UUID
 * @returns Auth0 user ID of board owner, or null if not found
 */
export async function getCommentOwner(commentId: string): Promise<string | null> {
  try {
    const comment = await storage.getTaskComment(commentId);
    if (!comment) return null;

    // Get task, then board owner
    const task = await storage.getTask(comment.taskId);
    if (!task) return null;

    const board = await storage.getTaskBoard(task.boardId);
    return board?.createdBy || null;
  } catch (error) {
    console.error("Error getting comment owner:", error);
    return null;
  }
}

/**
 * Get attachment owner through task -> board chain
 *
 * @param attachmentId - Attachment UUID
 * @returns Auth0 user ID of board owner, or null if not found
 */
export async function getAttachmentOwner(attachmentId: string): Promise<string | null> {
  try {
    const attachment = await storage.getTaskAttachment(attachmentId);
    if (!attachment) return null;

    // Get task, then board owner
    const task = await storage.getTask(attachment.taskId);
    if (!task) return null;

    const board = await storage.getTaskBoard(task.boardId);
    return board?.createdBy || null;
  } catch (error) {
    console.error("Error getting attachment owner:", error);
    return null;
  }
}

/**
 * Get label owner through board ownership
 *
 * @param labelId - Label UUID
 * @returns Auth0 user ID of board owner, or null if not found
 */
export async function getLabelOwner(labelId: string): Promise<string | null> {
  try {
    const label = await storage.getTaskLabel(labelId);
    if (!label) return null;

    const board = await storage.getTaskBoard(label.boardId);
    return board?.createdBy || null;
  } catch (error) {
    console.error("Error getting label owner:", error);
    return null;
  }
}

/**
 * Get list owner through board ownership
 *
 * @param listId - List UUID
 * @returns Auth0 user ID of board owner, or null if not found
 */
export async function getListOwner(listId: string): Promise<string | null> {
  try {
    const list = await storage.getTaskList(listId);
    if (!list) return null;

    const board = await storage.getTaskBoard(list.boardId);
    return board?.createdBy || null;
  } catch (error) {
    console.error("Error getting list owner:", error);
    return null;
  }
}

// ==================== MIDDLEWARE EXPORTS ====================

/**
 * Require board ownership
 * Use on routes that access a specific board
 *
 * Example:
 * ```typescript
 * router.get("/api/tasks/boards/:id",
 *   authenticateToken,
 *   requireBoardOwnership, // ✅ Checks board ownership
 *   async (req, res) => { ... }
 * );
 * ```
 */
export const requireBoardOwnership = requireOwnership(getTaskBoardOwner);

/**
 * Require task ownership (via board)
 * Use on routes that access a specific task
 *
 * Example:
 * ```typescript
 * router.patch("/api/tasks/:id",
 *   authenticateToken,
 *   requireTaskOwnership, // ✅ Checks task ownership
 *   async (req, res) => { ... }
 * );
 * ```
 */
export const requireTaskOwnership = requireOwnership(getTaskOwner);

/**
 * Require comment ownership (via task -> board)
 * Use on routes that access a specific comment
 *
 * Example:
 * ```typescript
 * router.delete("/api/tasks/comments/:id",
 *   authenticateToken,
 *   requireCommentOwnership, // ✅ Checks comment ownership
 *   async (req, res) => { ... }
 * );
 * ```
 */
export const requireCommentOwnership = requireOwnership(getCommentOwner);

/**
 * Require attachment ownership (via task -> board)
 * Use on routes that access a specific attachment
 *
 * Example:
 * ```typescript
 * router.get("/api/tasks/attachments/:id/download",
 *   authenticateToken,
 *   requireAttachmentOwnership, // ✅ Checks attachment ownership
 *   async (req, res) => { ... }
 * );
 * ```
 */
export const requireAttachmentOwnership = requireOwnership(getAttachmentOwner);

/**
 * Require label ownership (via board)
 * Use on routes that access a specific label
 *
 * Example:
 * ```typescript
 * router.delete("/api/tasks/labels/:id",
 *   authenticateToken,
 *   requireLabelOwnership, // ✅ Checks label ownership
 *   async (req, res) => { ... }
 * );
 * ```
 */
export const requireLabelOwnership = requireOwnership(getLabelOwner);

/**
 * Require list ownership (via board)
 * Use on routes that access a specific list
 *
 * Example:
 * ```typescript
 * router.delete("/api/tasks/lists/:id",
 *   authenticateToken,
 *   requireListOwnership, // ✅ Checks list ownership
 *   async (req, res) => { ... }
 * );
 * ```
 */
export const requireListOwnership = requireOwnership(getListOwner);
