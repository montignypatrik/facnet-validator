import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import { registerModules, getModuleList } from "./moduleRegistry";
import { cacheService } from "./cache/index.js";
import { apiLimiter } from "./middleware/rateLimiter";

/**
 * Dash Application Routes
 *
 * This file registers all routes using the modular architecture.
 * Individual module routes are defined in server/modules/
 */

// Configure CORS
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5178",  // Development client port
    "http://localhost:5179",  // Alternate development port
    "http://localhost:5000",
    "https://148.113.196.245",        // Production
    "https://148.113.196.245:3001",   // Staging
    ...(process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(",") : [])
  ],
  credentials: true,
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Apply CORS middleware
  app.use(cors(corsOptions));

  // Health check endpoint (exempt from rate limiting)
  app.get("/api/health", (req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      platform: "Dash - Modular SAAS Platform",
    });
  });

  // Apply rate limiting to all other /api routes
  app.use("/api", apiLimiter);

  // Module information endpoint
  app.get("/api/modules", async (req, res) => {
    try {
      const modules = await getModuleList();
      res.json({
        platform: "Dash",
        version: "1.0.0",
        modules,
      });
    } catch (error) {
      console.error("Error fetching modules:", error);
      res.status(500).json({ error: "Failed to fetch modules" });
    }
  });

  // Cache statistics endpoint
  app.get("/api/cache/stats", (req, res) => {
    try {
      const stats = cacheService.getStats();
      res.json({
        status: "success",
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error fetching cache stats:", error);
      res.status(500).json({ error: "Failed to fetch cache statistics" });
    }
  });

  // Register all module routes
  await registerModules(app);

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}

