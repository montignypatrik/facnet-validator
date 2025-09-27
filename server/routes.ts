import type { Express } from "express";
import { createServer, type Server } from "http";
import cors from "cors";
import multer from "multer";
import { z } from "zod";
import { storage } from "./storage";
import { authenticateToken, requireRole, type AuthenticatedRequest } from "./firebase";
import { 
  insertCodeSchema, insertContextSchema, insertEstablishmentSchema, 
  insertRuleSchema, insertFieldCatalogSchema, insertValidationRunSchema,
  insertFileSchema
} from "@shared/schema";
import fs from "fs";
import path from "path";
import csv from "csv-parser";

// Configure CORS
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5000",
    ...(process.env.REPLIT_DOMAINS ? process.env.REPLIT_DOMAINS.split(",") : [])
  ],
  credentials: true,
};

// Configure multer for file uploads
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

export async function registerRoutes(app: Express): Promise<Server> {
  app.use(cors(corsOptions));

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  // Authentication routes
  app.post("/api/auth/verify", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      let user = await storage.getUserByEmail(req.user!.email!);
      
      if (!user) {
        // Create user if doesn't exist
        user = await storage.createUser({
          id: req.user!.uid,
          email: req.user!.email!,
          name: req.user!.claims.name || req.user!.email!.split("@")[0],
          role: req.user!.role,
        });
      }

      res.json({ user });
    } catch (error) {
      console.error("Auth verification error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Analytics stub endpoints
  app.get("/api/analytics/kpis", authenticateToken, (req, res) => {
    res.json({
      invoicesPerDay: 1247,
      avgInvoiceValue: 342.80,
      avgDailyTotal: 427530
    });
  });

  app.get("/api/analytics/unique-patients-by-day", authenticateToken, (req, res) => {
    res.json([]);
  });

  app.get("/api/analytics/codes", authenticateToken, (req, res) => {
    res.json([]);
  });

  // File upload
  app.post("/api/files", authenticateToken, upload.single("file"), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = await storage.createFile({
        originalName: req.file.originalname,
        fileName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size.toString(),
        uploadedBy: req.user!.uid,
      });

      res.json({ fileId: file.id });
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "File upload failed" });
    }
  });

  // Validation runs
  app.post("/api/validations", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fileId } = req.body;
      
      if (!fileId) {
        return res.status(400).json({ error: "fileId is required" });
      }

      const file = await storage.getFile(fileId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      const run = await storage.createValidationRun({
        fileId: fileId,
        fileName: file.originalName,
        status: "queued",
        createdBy: req.user!.uid,
      });

      // TODO: Queue actual validation job
      
      res.json({ validationId: run.id, status: run.status });
    } catch (error) {
      console.error("Validation creation error:", error);
      res.status(500).json({ error: "Validation creation failed" });
    }
  });

  app.get("/api/validations", authenticateToken, async (req, res) => {
    try {
      const { limit, status, page, pageSize } = req.query;
      
      const result = await storage.getValidationRuns({
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as string,
        page: page ? parseInt(page as string) : 1,
        pageSize: pageSize ? parseInt(pageSize as string) : 50,
      });

      res.json(result);
    } catch (error) {
      console.error("Get validations error:", error);
      res.status(500).json({ error: "Failed to get validations" });
    }
  });

  app.get("/api/validations/:id", authenticateToken, async (req, res) => {
    try {
      const run = await storage.getValidationRun(req.params.id);
      
      if (!run) {
        return res.status(404).json({ error: "Validation run not found" });
      }

      res.json(run);
    } catch (error) {
      console.error("Get validation error:", error);
      res.status(500).json({ error: "Failed to get validation" });
    }
  });

  // Field catalog routes
  app.get("/api/field-catalog", authenticateToken, async (req, res) => {
    try {
      const { table } = req.query;
      const catalog = await storage.getFieldCatalog(table as string);
      res.json(catalog);
    } catch (error) {
      console.error("Get field catalog error:", error);
      res.status(500).json({ error: "Failed to get field catalog" });
    }
  });

  app.post("/api/field-catalog", authenticateToken, requireRole(["editor", "admin"]), async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertFieldCatalogSchema.parse(req.body);
      const item = await storage.createFieldCatalogItem(validatedData);
      res.json(item);
    } catch (error) {
      console.error("Create field catalog error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create field catalog item" });
    }
  });

  app.patch("/api/field-catalog/:id", authenticateToken, requireRole(["editor", "admin"]), async (req: AuthenticatedRequest, res) => {
    try {
      const item = await storage.updateFieldCatalogItem(req.params.id, req.body);
      res.json(item);
    } catch (error) {
      console.error("Update field catalog error:", error);
      res.status(500).json({ error: "Failed to update field catalog item" });
    }
  });

  app.delete("/api/field-catalog/:id", authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      await storage.deleteFieldCatalogItem(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete field catalog error:", error);
      res.status(500).json({ error: "Failed to delete field catalog item" });
    }
  });

  // CSV processing helpers
  const normalizeHeader = (header: string): string => {
    return header
      .toLowerCase()
      .trim()
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  };

  const mapSynonyms = (header: string): string => {
    const synonymMap: Record<string, string> = {
      'desc': 'description',
      'cat': 'category',
      'est': 'establishment',
      'ctx': 'context',
    };
    return synonymMap[header] || header;
  };

  const parseCSV = (filePath: string): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      fs.createReadStream(filePath)
        .pipe(csv({ separator: [',', ';'] }))
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  };

  // Generic CRUD endpoints for each table
  const createTableRoutes = (tableName: string, schema: any, getMethod: string, createMethod: string, updateMethod: string, deleteMethod: string, upsertMethod?: string) => {
    // List
    app.get(`/api/${tableName}`, authenticateToken, async (req, res) => {
      try {
        const { search, page, pageSize } = req.query;
        const result = await (storage as any)[getMethod]({
          search: search as string,
          page: page ? parseInt(page as string) : 1,
          pageSize: pageSize ? parseInt(pageSize as string) : 50,
        });
        res.json(result);
      } catch (error) {
        console.error(`Get ${tableName} error:`, error);
        res.status(500).json({ error: `Failed to get ${tableName}` });
      }
    });

    // Create
    app.post(`/api/${tableName}`, authenticateToken, requireRole(["editor", "admin"]), async (req: AuthenticatedRequest, res) => {
      try {
        const validatedData = schema.parse({
          ...req.body,
          updatedBy: req.user!.uid,
        });
        const item = await (storage as any)[createMethod](validatedData);
        res.json(item);
      } catch (error) {
        console.error(`Create ${tableName} error:`, error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "Validation error", details: error.errors });
        }
        res.status(500).json({ error: `Failed to create ${tableName.slice(0, -1)}` });
      }
    });

    // Update
    app.patch(`/api/${tableName}/:id`, authenticateToken, requireRole(["editor", "admin"]), async (req: AuthenticatedRequest, res) => {
      try {
        const item = await (storage as any)[updateMethod](req.params.id, {
          ...req.body,
          updatedBy: req.user!.uid,
        });
        res.json(item);
      } catch (error) {
        console.error(`Update ${tableName} error:`, error);
        res.status(500).json({ error: `Failed to update ${tableName.slice(0, -1)}` });
      }
    });

    // Delete
    app.delete(`/api/${tableName}/:id`, authenticateToken, requireRole(["admin"]), async (req, res) => {
      try {
        await (storage as any)[deleteMethod](req.params.id);
        res.json({ success: true });
      } catch (error) {
        console.error(`Delete ${tableName} error:`, error);
        res.status(500).json({ error: `Failed to delete ${tableName.slice(0, -1)}` });
      }
    });

    // Import endpoint
    app.post(`/api/${tableName}:import`, authenticateToken, requireRole(["editor", "admin"]), upload.single("file"), async (req: AuthenticatedRequest, res) => {
      try {
        const dryRun = req.query.dryRun === "true";
        const conflictStrategy = (req.query.conflictStrategy as string) || "update";
        const autoCreateFields = req.query.autoCreateFields === "true";

        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        // Parse CSV
        const csvData = await parseCSV(req.file.path);
        
        if (csvData.length === 0) {
          return res.status(400).json({ error: "CSV file is empty" });
        }

        // Get field catalog for this table
        const fieldCatalog = await storage.getFieldCatalog(tableName);
        const catalogMap = new Map(fieldCatalog.map(f => [f.fieldKey, f]));

        // Normalize headers
        const headers = Object.keys(csvData[0]);
        const normalizedHeaders = headers.map(h => mapSynonyms(normalizeHeader(h)));
        
        // Core fields mapping based on table
        const coreFields = new Set();
        switch (tableName) {
          case "codes":
            coreFields.add("code");
            coreFields.add("description");
            coreFields.add("category");
            coreFields.add("active");
            break;
          case "contexts":
            coreFields.add("name");
            coreFields.add("description");
            coreFields.add("tags");
            break;
          case "establishments":
            coreFields.add("name");
            coreFields.add("type");
            coreFields.add("region");
            coreFields.add("active");
            coreFields.add("notes");
            break;
          case "rules":
            coreFields.add("name");
            coreFields.add("condition");
            coreFields.add("threshold");
            coreFields.add("enabled");
            break;
        }

        // Map headers to fields
        const headerMapping: Record<string, string> = {};
        const unknownHeaders: string[] = [];
        const customFieldHeaders: string[] = [];

        normalizedHeaders.forEach((header, index) => {
          const originalHeader = headers[index];
          
          if (coreFields.has(header)) {
            headerMapping[originalHeader] = header;
          } else if (catalogMap.has(header)) {
            headerMapping[originalHeader] = header;
            customFieldHeaders.push(header);
          } else {
            unknownHeaders.push(originalHeader);
          }
        });

        // Auto-create fields if enabled
        if (autoCreateFields && unknownHeaders.length > 0 && ["editor", "admin"].includes(req.user!.role)) {
          for (const header of unknownHeaders) {
            const fieldKey = normalizeHeader(header);
            try {
              await storage.createFieldCatalogItem({
                tableName: tableName as any,
                fieldKey,
                label: header,
                type: "text",
                required: false,
                uniqueField: false,
                active: true,
              });
              headerMapping[header] = fieldKey;
              customFieldHeaders.push(fieldKey);
            } catch (error) {
              console.error(`Failed to create field ${fieldKey}:`, error);
            }
          }
          // Clear unknown headers since they were auto-created
          unknownHeaders.length = 0;
        }

        // Process rows
        const processedRows = csvData.map((row, index) => {
          const processedRow: any = { customFields: {} };
          
          for (const [originalHeader, mappedField] of Object.entries(headerMapping)) {
            const value = row[originalHeader];
            
            if (coreFields.has(mappedField)) {
              // Handle core field type conversion
              if (mappedField === "active" || mappedField === "enabled") {
                processedRow[mappedField] = value === "true" || value === "1" || value === "yes";
              } else if (mappedField === "tags" && typeof value === "string") {
                processedRow[mappedField] = value.split(",").map(t => t.trim()).filter(t => t);
              } else if (mappedField === "condition" && typeof value === "string") {
                try {
                  processedRow[mappedField] = JSON.parse(value);
                } catch {
                  processedRow[mappedField] = { rule: value };
                }
              } else {
                processedRow[mappedField] = value;
              }
            } else {
              // Custom field
              const catalogField = catalogMap.get(mappedField);
              if (catalogField) {
                // Type coercion based on catalog
                let typedValue = value;
                switch (catalogField.type) {
                  case "number":
                    typedValue = isNaN(Number(value)) ? value : Number(value);
                    break;
                  case "boolean":
                    typedValue = value === "true" || value === "1" || value === "yes";
                    break;
                  case "multiselect":
                    typedValue = typeof value === "string" 
                      ? value.split(",").map(v => v.trim()).filter(v => v)
                      : value;
                    break;
                }
                processedRow.customFields[mappedField] = typedValue;
              }
            }
          }

          // Add metadata
          processedRow.updatedBy = req.user!.uid;
          
          return { row: processedRow, index };
        });

        if (dryRun) {
          // Return preview without actually importing
          const previewResult = {
            create: processedRows.length, // Simplified for preview
            update: 0,
            skip: 0,
            errors: [],
            unknownHeaders,
            sampleDiffs: processedRows.slice(0, 5).map(p => p.row),
          };
          
          res.json(previewResult);
        } else {
          // Validate required fields before import
          const validRows: any[] = [];
          const skippedRows: { row: number; reason: string; data: any }[] = [];
          const errors: string[] = [];

          // Define required fields per table
          const requiredFields: Record<string, string[]> = {
            codes: ["code"],
            contexts: ["name"],
            establishments: ["name"],
            rules: ["name"]
          };

          const tableRequiredFields = requiredFields[tableName] || [];

          processedRows.forEach(({ row, index }) => {
            let isValid = true;
            const missingFields: string[] = [];

            // Check required fields
            for (const field of tableRequiredFields) {
              if (!row[field] || (typeof row[field] === 'string' && row[field].trim() === '')) {
                isValid = false;
                missingFields.push(field);
              }
            }

            if (isValid) {
              validRows.push(row);
            } else {
              skippedRows.push({
                row: index + 2, // +2 because CSV rows start at 1 and we skip header
                reason: `Missing required field(s): ${missingFields.join(', ')}`,
                data: row
              });
            }
          });

          let createCount = 0;
          let updateCount = 0;

          try {
            // Perform actual import with valid rows only
            if (upsertMethod && (storage as any)[upsertMethod] && validRows.length > 0) {
              await (storage as any)[upsertMethod](validRows);
              createCount = validRows.length; // Simplified - in reality would be mixed
            } else if (validRows.length > 0) {
              // Fallback to individual creates/updates
              for (const row of validRows) {
                try {
                  await (storage as any)[createMethod](row);
                  createCount++;
                } catch (error) {
                  console.error(`Failed to import row:`, error);
                  errors.push(`Failed to import row: ${error.message}`);
                }
              }
            }

            res.json({
              success: true,
              create: createCount,
              update: updateCount,
              skip: skippedRows.length,
              errors: errors.length > 0 ? errors.slice(0, 10) : [], // Limit errors shown
              skippedRows: skippedRows.slice(0, 10), // Show first 10 skipped rows
              unknownHeaders,
            });
          } catch (error) {
            console.error(`Import ${tableName} error:`, error);
            res.status(500).json({ 
              error: `Failed to import ${tableName}`,
              create: createCount,
              update: updateCount,
              skip: skippedRows.length,
              skippedRows: skippedRows.slice(0, 10)
            });
          }
        }

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

      } catch (error) {
        console.error(`Import ${tableName} error:`, error);
        res.status(500).json({ error: `Failed to import ${tableName}` });
      }
    });

    // Export endpoint
    app.get(`/api/${tableName}:export`, authenticateToken, async (req, res) => {
      try {
        const useKeys = req.query.useKeys === "true";
        
        // Get data
        const result = await (storage as any)[getMethod]({
          search: req.query.search as string,
          page: 1,
          pageSize: 10000, // Export all
        });

        // Get field catalog for custom fields
        const fieldCatalog = await storage.getFieldCatalog(tableName);
        
        if (result.data.length === 0) {
          res.setHeader("Content-Type", "text/csv");
          res.setHeader("Content-Disposition", `attachment; filename="${tableName}_export.csv"`);
          res.send("");
          return;
        }

        // Build CSV headers
        const coreHeaders: string[] = [];
        switch (tableName) {
          case "codes":
            coreHeaders.push("code", "description", "category", "active");
            break;
          case "contexts":
            coreHeaders.push("name", "description", "tags");
            break;
          case "establishments":
            coreHeaders.push("name", "type", "region", "active", "notes");
            break;
          case "rules":
            coreHeaders.push("name", "condition", "threshold", "enabled");
            break;
        }

        const customHeaders = fieldCatalog
          .filter(f => f.active)
          .map(f => useKeys ? f.fieldKey : f.label);

        const allHeaders = [...coreHeaders, ...customHeaders, "updated_at"];

        // Build CSV rows
        const csvRows = result.data.map((item: any) => {
          const row: string[] = [];
          
          // Core fields
          coreHeaders.forEach(header => {
            let value = item[header];
            if (Array.isArray(value)) {
              value = value.join(", ");
            } else if (typeof value === "object" && value !== null) {
              value = JSON.stringify(value);
            } else if (typeof value === "boolean") {
              value = value ? "true" : "false";
            }
            row.push(`"${(value || "").toString().replace(/"/g, '""')}"`);
          });
          
          // Custom fields
          fieldCatalog.filter(f => f.active).forEach(field => {
            const value = item.customFields?.[field.fieldKey] || "";
            let stringValue = value;
            if (Array.isArray(value)) {
              stringValue = value.join(", ");
            } else if (typeof value === "object" && value !== null) {
              stringValue = JSON.stringify(value);
            } else if (typeof value === "boolean") {
              stringValue = value ? "true" : "false";
            }
            row.push(`"${stringValue.toString().replace(/"/g, '""')}"`);
          });
          
          // Updated at
          row.push(`"${new Date(item.updatedAt).toISOString()}"`);
          
          return row.join(",");
        });

        // Combine headers and rows
        const csv = [allHeaders.map(h => `"${h}"`).join(","), ...csvRows].join("\n");
        
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="${tableName}_export.csv"`);
        res.send(csv);
      } catch (error) {
        console.error(`Export ${tableName} error:`, error);
        res.status(500).json({ error: `Failed to export ${tableName}` });
      }
    });
  };

  // Create routes for each table
  createTableRoutes("codes", insertCodeSchema, "getCodes", "createCode", "updateCode", "deleteCode", "upsertCodes");
  createTableRoutes("contexts", insertContextSchema, "getContexts", "createContext", "updateContext", "deleteContext", "upsertContexts");
  createTableRoutes("establishments", insertEstablishmentSchema, "getEstablishments", "createEstablishment", "updateEstablishment", "deleteEstablishment", "upsertEstablishments");
  createTableRoutes("rules", insertRuleSchema, "getRules", "createRule", "updateRule", "deleteRule", "upsertRules");

  const httpServer = createServer(app);
  return httpServer;
}
