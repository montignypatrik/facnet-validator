/**
 * Chatbot Storage Layer
 *
 * Database operations for conversations and messages.
 */

import { db } from "../../core/db";
import { conversations, messages, type Conversation, type Message, type InsertConversation, type InsertMessage } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

/**
 * Get all conversations for a user
 */
export async function getUserConversations(userId: string): Promise<Conversation[]> {
  return await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt));
}

/**
 * Get a specific conversation by ID (with ownership check)
 */
export async function getConversationById(conversationId: string, userId: string): Promise<Conversation | null> {
  const results = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    )
    .limit(1);

  return results[0] || null;
}

/**
 * Create a new conversation
 */
export async function createConversation(data: InsertConversation): Promise<Conversation> {
  const results = await db
    .insert(conversations)
    .values(data)
    .returning();

  return results[0];
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(conversationId: string, userId: string, title: string): Promise<void> {
  await db
    .update(conversations)
    .set({
      title,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    );
}

/**
 * Update conversation timestamp (marks as recently active)
 */
export async function touchConversation(conversationId: string): Promise<void> {
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}

/**
 * Delete a conversation and all its messages (cascade delete)
 */
export async function deleteConversation(conversationId: string, userId: string): Promise<void> {
  await db
    .delete(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    );
}

/**
 * Get all messages for a conversation (with ownership check via conversation)
 */
export async function getConversationMessages(conversationId: string, userId: string): Promise<Message[]> {
  // First verify ownership
  const conversation = await getConversationById(conversationId, userId);
  if (!conversation) {
    throw new Error("Conversation not found or access denied");
  }

  // Get messages
  return await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt); // Chronological order
}

/**
 * Add a message to a conversation
 */
export async function addMessage(data: InsertMessage): Promise<Message> {
  const results = await db
    .insert(messages)
    .values(data)
    .returning();

  // Update conversation timestamp
  await touchConversation(data.conversationId);

  return results[0];
}

/**
 * Get the first user message from a conversation (for title generation)
 */
export async function getFirstUserMessage(conversationId: string): Promise<Message | null> {
  const results = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.role, "user")
      )
    )
    .orderBy(messages.createdAt)
    .limit(1);

  return results[0] || null;
}

/**
 * Generate a conversation title from the first message
 * Truncates to first 50 characters and adds ellipsis if needed
 */
export function generateConversationTitle(firstMessage: string): string {
  const maxLength = 50;
  const trimmed = firstMessage.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return trimmed.substring(0, maxLength).trim() + "...";
}
