import type { Express, Router } from "express";

/**
 * Dash Module Registry
 *
 * This file defines the modular architecture where each business function
 * is a self-contained module with its own routes, logic, and resources.
 *
 * Each module is loaded dynamically and registered with the Express app.
 */

export interface DashModule {
  name: string;
  version: string;
  description: string;
  router: Router;
  enabled: boolean;
  requiredRole?: string; // Optional: module requires specific role to access
}

/**
 * Register all active modules with the Express application
 */
export async function registerModules(app: Express): Promise<void> {
  console.log("[MODULE REGISTRY] Loading Dash modules...");

  // Import module routes
  const authRoutes = (await import("./core/authRoutes")).default;
  const observabilityRoutes = (await import("./observability/routes")).default;
  const validateurRoutes = (await import("./modules/validateur/routes")).default;
  const namExtractionRoutes = (await import("./modules/nam-extraction/routes")).default;
  const databaseRoutes = (await import("./modules/database/routes")).default;
  const administrationRoutes = (await import("./modules/administration/routes")).default;
  const chatbotRoutes = (await import("./modules/chatbot/routes")).default;
  const chatbotChatRoutes = (await import("./modules/chatbot/routes-chat")).default;
  const chatbotAdminRoutes = (await import("./modules/chatbot/routes-admin")).default;
  const formationRoutes = (await import("./modules/formation-ressourcement/routes")).default;
  const taskRoutes = (await import("./modules/tasks/routes")).default;

  // Define modules
  const modules: DashModule[] = [
    {
      name: "core-auth",
      version: "1.0.0",
      description: "Core authentication and user management",
      router: authRoutes,
      enabled: true,
    },
    {
      name: "observability",
      version: "1.0.0",
      description: "Production observability (Sentry + OpenTelemetry)",
      router: observabilityRoutes,
      enabled: true,
    },
    {
      name: "validateur",
      version: "1.0.0",
      description: "Quebec healthcare billing validation (RAMQ)",
      router: validateurRoutes,
      enabled: true,
    },
    {
      name: "nam-extraction",
      version: "1.0.0",
      description: "NAM extraction from PDF documents using AWS Textract and OpenAI",
      router: namExtractionRoutes,
      enabled: true,
    },
    {
      name: "database",
      version: "1.0.0",
      description: "Database management for codes, contexts, establishments, and rules",
      router: databaseRoutes,
      enabled: true,
    },
    {
      name: "administration",
      version: "1.0.0",
      description: "User management and role assignment",
      router: administrationRoutes,
      enabled: true,
      requiredRole: "admin",
    },
    {
      name: "chatbot",
      version: "1.0.0",
      description: "AI-powered medical billing assistant (Ollama)",
      router: chatbotRoutes,
      enabled: false, // Disabled
    },
    {
      name: "chatbot-chat",
      version: "1.0.0",
      description: "Chatbot conversation and message management",
      router: chatbotChatRoutes,
      enabled: false, // Disabled
    },
    {
      name: "chatbot-admin",
      version: "1.0.0",
      description: "Chatbot knowledge base administration (document management)",
      router: chatbotAdminRoutes,
      enabled: false, // Disabled
      requiredRole: "editor", // Admin or editor required
    },
    {
      name: "formation-ressourcement",
      version: "1.0.0",
      description: "Training and resources for healthcare billing professionals",
      router: formationRoutes,
      enabled: false, // Disabled
    },
    {
      name: "tasks",
      version: "1.0.0",
      description: "Task and workflow management with kanban boards",
      router: taskRoutes,
      enabled: false, // Disabled
    },
  ];

  // Register enabled modules
  for (const module of modules) {
    if (module.enabled) {
      // Mount modules with appropriate prefixes
      if (module.name === "tasks") {
        app.use("/api/tasks", module.router);
      } else if (module.name === "observability") {
        app.use("/api/observability", module.router);
      } else {
        app.use(module.router);
      }
      console.log(`[MODULE REGISTRY] ✓ Loaded module: ${module.name} (${module.version})`);
      console.log(`[MODULE REGISTRY]   Description: ${module.description}`);
    } else {
      console.log(`[MODULE REGISTRY] ⊗ Skipped module: ${module.name} (disabled)`);
    }
  }

  console.log(`[MODULE REGISTRY] Loaded ${modules.filter(m => m.enabled).length}/${modules.length} modules`);
}

/**
 * Get list of available modules (for API introspection)
 */
export async function getModuleList(): Promise<Array<{ name: string; version: string; description: string; enabled: boolean }>> {
  return [
    {
      name: "validateur",
      version: "1.0.0",
      description: "Quebec healthcare billing validation (RAMQ)",
      enabled: true,
    },
    {
      name: "nam-extraction",
      version: "1.0.0",
      description: "NAM extraction from PDF documents",
      enabled: true,
    },
    {
      name: "database",
      version: "1.0.0",
      description: "Database management",
      enabled: true,
    },
    {
      name: "administration",
      version: "1.0.0",
      description: "User management",
      enabled: true,
    },
    {
      name: "chatbot",
      version: "1.0.0",
      description: "AI-powered medical billing assistant",
      enabled: false,
    },
    {
      name: "tasks",
      version: "1.0.0",
      description: "Task and workflow management with kanban boards",
      enabled: false,
    },
    {
      name: "formation-ressourcement",
      version: "1.0.0",
      description: "Training and resources for healthcare billing professionals",
      enabled: false,
    },
    {
      name: "hors-ramq",
      version: "1.0.0",
      description: "Extended billing features beyond RAMQ",
      enabled: false, // Coming soon
    },
  ];
}
