/**
 * Chatbot API Client
 *
 * API functions for chatbot conversations and messages
 */

import apiClient from "./client";

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface SendMessageResponse {
  userMessage: Message;
  assistantMessage: Message;
  conversation: {
    id: string;
    title: string;
  };
}

/**
 * Get all conversations for the authenticated user
 */
export async function getConversations(): Promise<Conversation[]> {
  const response = await apiClient.get<{ conversations: Conversation[] }>("/chat/conversations");
  return response.data.conversations;
}

/**
 * Create a new conversation
 */
export async function createConversation(title?: string): Promise<Conversation> {
  const response = await apiClient.post<{ conversation: Conversation }>("/chat/conversation/new", {
    title,
  });
  return response.data.conversation;
}

/**
 * Get all messages for a conversation
 */
export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  const response = await apiClient.get<{ messages: Message[] }>(`/chat/conversation/${conversationId}/messages`);
  return response.data.messages;
}

/**
 * Send a message and get AI response
 */
export async function sendMessage(conversationId: string, message: string): Promise<SendMessageResponse> {
  const response = await apiClient.post<SendMessageResponse>("/chat/message", {
    conversationId,
    message,
  });
  return response.data;
}

/**
 * Delete a conversation
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  await apiClient.delete(`/chat/conversation/${conversationId}`);
}

/**
 * Update conversation title
 */
export async function updateConversationTitle(conversationId: string, title: string): Promise<void> {
  await apiClient.patch(`/chat/conversation/${conversationId}/title`, { title });
}
