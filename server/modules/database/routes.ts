import { Router, type Request } from "express";
import multer from "multer";
import { z } from "zod";
import fs from "fs";
import csv from "csv-parser";
import { storage } from "../../core/storage";
import { authenticateToken, requireRole, type AuthenticatedRequest } from "../../core/auth";
import {
  insertCodeSchema,
  insertContextSchema,
  insertEstablishmentSchema,
  insertRuleSchema,
  insertFieldCatalogSchema,
} from "@shared/schema";

const router = Router();

// Configure multer for CSV imports
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

/**
 * Database Module Routes
 *
 * Handles CRUD operations for:
 * - /api/codes
 * - /api/contexts
 * - /api/establishments
 * - /api/rules
 * - /api/field-catalog
 */

// ==================== HELPER FUNCTIONS ====================

const normalizeHeader = (header: string): string => {
  return header.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
};

const mapSynonyms = (header: string): string => {
  const synonymMap: Record<string, string> = {
    'code_acte': 'code',
    'description': 'description',
    'nom': 'name',
    'type': 'type',
    'region': 'region',
    'actif': 'active',
  };
  return synonymMap[header] || header;
};

const parseCSV = (filePath: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

// ==================== CRUD FACTORY ====================

const createTableRoutes = (
  tableName: string,
  schema: any,
  getMethod: string,
  createMethod: string,
  updateMethod: string,
  deleteMethod: string,
  upsertMethod?: string
) => {
  // List
  router.get(`/api/${tableName}`, authenticateToken, async (req, res) => {
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
  router.post(`/api/${tableName}`, authenticateToken, requireRole(["editor", "admin"]), async (req: AuthenticatedRequest, res) => {
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
  router.patch(`/api/${tableName}/:id`, authenticateToken, requireRole(["editor", "admin"]), async (req: AuthenticatedRequest, res) => {
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
  router.delete(`/api/${tableName}/:id`, authenticateToken, requireRole(["admin"]), async (req, res) => {
    try {
      await (storage as any)[deleteMethod](req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error(`Delete ${tableName} error:`, error);
      res.status(500).json({ error: `Failed to delete ${tableName.slice(0, -1)}` });
    }
  });

  // Import endpoint
  router.post(`/api/${tableName}/import`, authenticateToken, requireRole(["editor", "admin"]), upload.single("file"), async (req: AuthenticatedRequest, res) => {
    try {
      const dryRun = req.query.dryRun === "true";
      const conflictStrategy = (req.query.conflictStrategy as string) || "update";
      const autoCreateFields = req.query.autoCreateFields === "true";

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const csvData = await parseCSV(req.file.path);

      if (csvData.length === 0) {
        return res.status(400).json({ error: "CSV file is empty" });
      }

      const fieldCatalog = await storage.getFieldCatalog(tableName);
      const catalogMap = new Map(fieldCatalog.map((f: any) => [f.fieldKey, f]));

      const headers = Object.keys(csvData[0]);
      const normalizedHeaders = headers.map(h => mapSynonyms(normalizeHeader(h)));

      const newFieldsCreated: string[] = [];
      if (autoCreateFields) {
        for (const header of normalizedHeaders) {
          if (!catalogMap.has(header) && !['id', 'created_at', 'updated_at', 'updated_by'].includes(header)) {
            const field = await storage.createFieldCatalogItem({
              tableName: tableName as any,
              fieldKey: header,
              label: header.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
              type: 'text' as any,
              required: false,
            });
            catalogMap.set(header, field);
            newFieldsCreated.push(header);
          }
        }
      }

      const imported: any[] = [];
      const skipped: any[] = [];
      const errors: Array<{ row: number; error: string }> = [];

      for (let i = 0; i < csvData.length; i++) {
        try {
          const row = csvData[i];
          const processedRow: any = { customFields: {} };

          for (let j = 0; j < headers.length; j++) {
            const originalHeader = headers[j];
            const normalizedHeader = normalizedHeaders[j];
            const value = row[originalHeader];

            if (['name', 'code', 'description', 'type', 'region', 'category', 'place'].includes(normalizedHeader)) {
              processedRow[normalizedHeader] = value;
            } else if (catalogMap.has(normalizedHeader)) {
              const field = catalogMap.get(normalizedHeader);
              processedRow.customFields[normalizedHeader] = value;
            }
          }

          if (req.user?.uid) {
            processedRow.updatedBy = req.user.uid;
          }

          if (dryRun) {
            imported.push(processedRow);
            continue;
          }

          if (upsertMethod && conflictStrategy === "update") {
            const upserted = await (storage as any)[upsertMethod](processedRow);
            imported.push(upserted);
          } else if (upsertMethod && conflictStrategy === "skip") {
            try {
              const created = await (storage as any)[createMethod](processedRow);
              imported.push(created);
            } catch {
              skipped.push(processedRow);
            }
          } else {
            const created = await (storage as any)[createMethod](processedRow);
            imported.push(created);
          }
        } catch (error: any) {
          errors.push({ row: i + 1, error: error.message });
        }
      }

      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        imported: imported.length,
        skipped: skipped.length,
        errors: errors.length,
        errorDetails: errors.slice(0, 10),
        newFieldsCreated,
        dryRun,
      });
    } catch (error) {
      console.error(`Import ${tableName} error:`, error);
      res.status(500).json({ error: `Failed to import ${tableName}` });
    }
  });

  // Export endpoint
  router.get(`/api/${tableName}/export`, authenticateToken, async (req, res) => {
    try {
      const items = await (storage as any)[getMethod]({
        page: 1,
        pageSize: 10000,
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${tableName}-export.csv"`);

      if (!items.data || items.data.length === 0) {
        return res.send('');
      }

      const headers = Object.keys(items.data[0]);
      res.write(headers.join(',') + '\n');

      for (const item of items.data) {
        const row = headers.map(h => {
          const val = item[h];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object') return JSON.stringify(val);
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        res.write(row.join(',') + '\n');
      }

      res.end();
    } catch (error) {
      console.error(`Export ${tableName} error:`, error);
      res.status(500).json({ error: `Failed to export ${tableName}` });
    }
  });
};

// ==================== CREATE ROUTES FOR EACH TABLE ====================

createTableRoutes("codes", insertCodeSchema, "getCodes", "createCode", "updateCode", "deleteCode", "upsertCode");
createTableRoutes("contexts", insertContextSchema, "getContexts", "createContext", "updateContext", "deleteContext", "upsertContext");
createTableRoutes("establishments", insertEstablishmentSchema, "getEstablishments", "createEstablishment", "updateEstablishment", "deleteEstablishment", "upsertEstablishment");
createTableRoutes("rules", insertRuleSchema, "getRules", "createRule", "updateRule", "deleteRule");

// ==================== FIELD CATALOG ROUTES ====================

router.get("/api/field-catalog", authenticateToken, async (req, res) => {
  try {
    const { table } = req.query;
    const catalog = await storage.getFieldCatalog(table as string);
    res.json(catalog);
  } catch (error) {
    console.error("Get field catalog error:", error);
    res.status(500).json({ error: "Failed to get field catalog" });
  }
});

router.post("/api/field-catalog", authenticateToken, requireRole(["editor", "admin"]), async (req: AuthenticatedRequest, res) => {
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

router.patch("/api/field-catalog/:id", authenticateToken, requireRole(["editor", "admin"]), async (req: AuthenticatedRequest, res) => {
  try {
    const item = await storage.updateFieldCatalogItem(req.params.id, req.body);
    res.json(item);
  } catch (error) {
    console.error("Update field catalog error:", error);
    res.status(500).json({ error: "Failed to update field catalog item" });
  }
});

router.delete("/api/field-catalog/:id", authenticateToken, requireRole(["admin"]), async (req, res) => {
  try {
    await storage.deleteFieldCatalogItem(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Delete field catalog error:", error);
    res.status(500).json({ error: "Failed to delete field catalog item" });
  }
});

// Special route for creating default rules (if needed)
router.post("/api/rules/create-default", async (req, res) => {
  try {
    // Import migrate-rules functionality if needed
    res.json({ message: "Default rules creation not implemented in module yet" });
  } catch (error) {
    console.error("Create default rules error:", error);
    res.status(500).json({ error: "Failed to create default rules" });
  }
});

export default router;
