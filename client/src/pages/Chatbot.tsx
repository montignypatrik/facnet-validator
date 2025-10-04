/**
 * Chatbot Page
 *
 * Medical billing AI chatbot with conversation management
 */

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Plus, Trash2, MessageSquare, Bot, User } from "lucide-react";
import * as chatbot from "@/api/chatbot";
import { useToast } from "@/hooks/use-toast";

export default function Chatbot() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ["/chat/conversations"],
    queryFn: chatbot.getConversations,
  });

  // Fetch messages for selected conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["/chat/messages", selectedConversationId],
    queryFn: () => chatbot.getConversationMessages(selectedConversationId!),
    enabled: !!selectedConversationId,
  });

  // Create new conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: chatbot.createConversation,
    onSuccess: (newConversation) => {
      queryClient.invalidateQueries({ queryKey: ["/chat/conversations"] });
      setSelectedConversationId(newConversation.id);
      toast({
        title: "Nouvelle conversation créée",
        description: "Vous pouvez maintenant commencer à poser vos questions.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer une nouvelle conversation.",
        variant: "destructive",
      });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({ conversationId, message }: { conversationId: string; message: string }) =>
      chatbot.sendMessage(conversationId, message),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/chat/messages", selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ["/chat/conversations"] });
      setMessageInput("");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.response?.data?.error || "Impossible d'envoyer le message.",
        variant: "destructive",
      });
    },
  });

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: chatbot.deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/chat/conversations"] });
      setSelectedConversationId(null);
      toast({
        title: "Conversation supprimée",
        description: "La conversation a été supprimée avec succès.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la conversation.",
        variant: "destructive",
      });
    },
  });

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle send message
  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedConversationId) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversationId,
      message: messageInput.trim(),
    });
  };

  // Handle key press (Enter to send, Shift+Enter for newline)
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle delete conversation
  const handleDeleteConversation = (conversationId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette conversation ?")) {
      deleteConversationMutation.mutate(conversationId);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold text-foreground">Assistant Facturation Médicale</h1>
              <p className="text-sm text-muted-foreground">Propulsé par IA - Système RAMQ du Québec</p>
            </div>
          </div>
          <Button onClick={() => createConversationMutation.mutate()} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Nouvelle conversation
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Conversations List */}
        <aside className="w-64 bg-card border-r border-border flex flex-col">
          <div className="p-3 border-b border-border">
            <h2 className="font-medium text-sm text-muted-foreground">Conversations</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversationsLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                Chargement...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Aucune conversation
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-3 border-b border-border cursor-pointer hover:bg-accent/50 transition-colors group ${
                    selectedConversationId === conv.id ? "bg-accent" : ""
                  }`}
                  onClick={() => setSelectedConversationId(conv.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(conv.updatedAt).toLocaleDateString("fr-CA")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(conv.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col">
          {!selectedConversationId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Bot className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg mb-2">Bienvenue dans votre assistant de facturation médicale</p>
                <p className="text-sm mb-4">Créez une nouvelle conversation pour commencer</p>
                <Button onClick={() => createConversationMutation.mutate()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle conversation
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    Chargement des messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>Aucun message dans cette conversation</p>
                      <p className="text-sm">Commencez à poser vos questions ci-dessous</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                      )}

                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-border"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {message.role === "assistant" && message.metadata?.duration_ms && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Réponse générée en {(message.metadata.duration_ms / 1000).toFixed(1)}s
                          </p>
                        )}
                      </div>

                      {message.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-border p-4">
                <div className="flex gap-2">
                  <Textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Posez une question sur la facturation médicale..."
                    className="min-h-[60px] max-h-[200px] resize-none"
                    disabled={sendMessageMutation.isPending}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sendMessageMutation.isPending}
                    size="icon"
                    className="h-[60px] w-[60px]"
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Appuyez sur Entrée pour envoyer, Maj+Entrée pour une nouvelle ligne
                </p>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
