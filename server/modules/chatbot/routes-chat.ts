/**
 * Chatbot Chat Routes
 *
 * Conversation and message management endpoints with authentication.
 * All endpoints require authenticated user.
 */

import { Router, type Response } from "express";
import { ollamaService } from "./services/ollamaService";
import { authenticateToken, type AuthenticatedRequest } from "../../core/auth";
import * as storage from "./storage";
import { log } from "../../vite";

const router = Router();

// Apply authentication to all chat routes
router.use(authenticateToken);

/**
 * GET /api/chat/conversations
 *
 * Get all conversations for the authenticated user
 *
 * Response:
 * {
 *   "conversations": [
 *     {
 *       "id": "uuid",
 *       "userId": "user_id",
 *       "title": "What is CPT coding?",
 *       "createdAt": "2025-10-03T12:34:56Z",
 *       "updatedAt": "2025-10-03T12:35:00Z"
 *     }
 *   ]
 * }
 */
router.get("/api/chat/conversations", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth!.id;
    const conversations = await storage.getUserConversations(userId);

    res.json({ conversations });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log(`[Chat] Error fetching conversations: ${errorMessage}`);

    res.status(500).json({
      error: "Failed to fetch conversations",
    });
  }
});

/**
 * POST /api/chat/conversation/new
 *
 * Create a new conversation
 *
 * Request body (optional):
 * {
 *   "title": "My Medical Billing Questions" // Optional, auto-generated if not provided
 * }
 *
 * Response:
 * {
 *   "conversation": {
 *     "id": "uuid",
 *     "userId": "user_id",
 *     "title": "Nouvelle conversation",
 *     "createdAt": "2025-10-03T12:34:56Z",
 *     "updatedAt": "2025-10-03T12:34:56Z"
 *   }
 * }
 */
router.post("/api/chat/conversation/new", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth!.id;
    const { title } = req.body;

    const conversation = await storage.createConversation({
      userId,
      title: title || "Nouvelle conversation",
    });

    log(`[Chat] Created new conversation ${conversation.id} for user ${userId}`);

    res.json({ conversation });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log(`[Chat] Error creating conversation: ${errorMessage}`);

    res.status(500).json({
      error: "Failed to create conversation",
    });
  }
});

/**
 * GET /api/chat/conversation/:id/messages
 *
 * Get all messages for a specific conversation
 *
 * Response:
 * {
 *   "messages": [
 *     {
 *       "id": "uuid",
 *       "conversationId": "uuid",
 *       "role": "user",
 *       "content": "What is CPT coding?",
 *       "metadata": {},
 *       "createdAt": "2025-10-03T12:34:56Z"
 *     },
 *     {
 *       "id": "uuid",
 *       "conversationId": "uuid",
 *       "role": "assistant",
 *       "content": "CPT coding is...",
 *       "metadata": { "duration_ms": 5234, "model": "llama3.2:3b" },
 *       "createdAt": "2025-10-03T12:35:01Z"
 *     }
 *   ]
 * }
 */
router.get("/api/chat/conversation/:id/messages", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth!.id;
    const conversationId = req.params.id;

    const messages = await storage.getConversationMessages(conversationId, userId);

    res.json({ messages });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log(`[Chat] Error fetching messages: ${errorMessage}`);

    if (errorMessage.includes("not found") || errorMessage.includes("access denied")) {
      res.status(404).json({
        error: "Conversation not found or access denied",
      });
    } else {
      res.status(500).json({
        error: "Failed to fetch messages",
      });
    }
  }
});

/**
 * POST /api/chat/message
 *
 * Send a message and get AI response
 *
 * Request body:
 * {
 *   "conversationId": "uuid",
 *   "message": "What is medical billing?"
 * }
 *
 * Response:
 * {
 *   "userMessage": {
 *     "id": "uuid",
 *     "conversationId": "uuid",
 *     "role": "user",
 *     "content": "What is medical billing?",
 *     "createdAt": "2025-10-03T12:34:56Z"
 *   },
 *   "assistantMessage": {
 *     "id": "uuid",
 *     "conversationId": "uuid",
 *     "role": "assistant",
 *     "content": "Medical billing is...",
 *     "metadata": { "duration_ms": 5234, "model": "llama3.2:3b" },
 *     "createdAt": "2025-10-03T12:35:01Z"
 *   },
 *   "conversation": {
 *     "id": "uuid",
 *     "title": "What is medical billing?..."
 *   }
 * }
 */
router.post("/api/chat/message", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth!.id;
    const { conversationId, message } = req.body;

    // Validate request
    if (!conversationId || !message) {
      return res.status(400).json({
        error: "Missing required fields: conversationId and message",
      });
    }

    if (typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({
        error: "Message must be a non-empty string",
      });
    }

    // Verify conversation ownership
    const conversation = await storage.getConversationById(conversationId, userId);
    if (!conversation) {
      return res.status(404).json({
        error: "Conversation not found or access denied",
      });
    }

    log(`[Chat] User ${userId} sending message in conversation ${conversationId}`);

    // Save user message
    const userMessage = await storage.addMessage({
      conversationId,
      role: "user",
      content: message,
      metadata: {},
    });

    // Get AI response
    const aiResponse = await ollamaService.query({ prompt: message });

    if (!aiResponse.success) {
      // AI failed, but user message is still saved
      return res.status(500).json({
        error: aiResponse.error || "Failed to get AI response",
        userMessage, // Return the saved user message
      });
    }

    // Save assistant message
    const assistantMessage = await storage.addMessage({
      conversationId,
      role: "assistant",
      content: aiResponse.response!,
      metadata: aiResponse.metadata || {},
    });

    // Auto-generate conversation title from first message if still default
    if (conversation.title === "Nouvelle conversation") {
      const generatedTitle = storage.generateConversationTitle(message);
      await storage.updateConversationTitle(conversationId, userId, generatedTitle);
      conversation.title = generatedTitle;
    }

    log(`[Chat] AI response generated in ${aiResponse.metadata?.duration_ms}ms`);

    res.json({
      userMessage,
      assistantMessage,
      conversation: {
        id: conversation.id,
        title: conversation.title,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log(`[Chat] Error processing message: ${errorMessage}`);

    res.status(500).json({
      error: "Failed to process message",
    });
  }
});

/**
 * DELETE /api/chat/conversation/:id
 *
 * Delete a conversation and all its messages
 *
 * Response:
 * {
 *   "success": true
 * }
 */
router.delete("/api/chat/conversation/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth!.id;
    const conversationId = req.params.id;

    await storage.deleteConversation(conversationId, userId);

    log(`[Chat] Deleted conversation ${conversationId} for user ${userId}`);

    res.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log(`[Chat] Error deleting conversation: ${errorMessage}`);

    res.status(500).json({
      error: "Failed to delete conversation",
    });
  }
});

/**
 * PATCH /api/chat/conversation/:id/title
 *
 * Update conversation title
 *
 * Request body:
 * {
 *   "title": "My Medical Billing Questions"
 * }
 *
 * Response:
 * {
 *   "success": true
 * }
 */
router.patch("/api/chat/conversation/:id/title", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.auth!.id;
    const conversationId = req.params.id;
    const { title } = req.body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return res.status(400).json({
        error: "Title must be a non-empty string",
      });
    }

    await storage.updateConversationTitle(conversationId, userId, title.trim());

    log(`[Chat] Updated conversation ${conversationId} title`);

    res.json({ success: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log(`[Chat] Error updating conversation title: ${errorMessage}`);

    res.status(500).json({
      error: "Failed to update conversation title",
    });
  }
});

export default router;
