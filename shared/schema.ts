import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, uuid, timestamp, boolean, jsonb, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// User schema for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role").notNull().default("viewer"), // viewer, editor, admin
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Codes table
export const codes = pgTable("codes", {
  code: text("code").primaryKey(),
  description: text("description").notNull(),
  category: text("category"),
  active: boolean("active").default(true).notNull(),
  customFields: jsonb("custom_fields").default({}).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by"),
});

// Contexts table
export const contexts = pgTable("contexts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").unique().notNull(),
  description: text("description"),
  tags: text("tags").array(),
  customFields: jsonb("custom_fields").default({}).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by"),
});

// Establishments table
export const establishments = pgTable("establishments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").unique().notNull(),
  type: text("type"),
  region: text("region"),
  active: boolean("active").default(true).notNull(),
  notes: text("notes"),
  customFields: jsonb("custom_fields").default({}).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by"),
});

// Rules table
export const rules = pgTable("rules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").unique().notNull(),
  condition: jsonb("condition").notNull(),
  threshold: numeric("threshold"),
  enabled: boolean("enabled").default(true).notNull(),
  customFields: jsonb("custom_fields").default({}).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by"),
});

// Field catalog table
export const fieldCatalogTableEnum = pgEnum("field_catalog_table", ["codes", "contexts", "establishments", "rules"]);
export const fieldTypeEnum = pgEnum("field_type", ["text", "number", "boolean", "date", "select", "multiselect"]);

export const fieldCatalog = pgTable("field_catalog", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tableName: fieldCatalogTableEnum("table_name").notNull(),
  fieldKey: text("field_key").notNull(),
  label: text("label").notNull(),
  type: fieldTypeEnum("type").notNull(),
  required: boolean("required").default(false).notNull(),
  options: text("options").array(),
  uniqueField: boolean("unique_field").default(false).notNull(),
  defaultValue: text("default_value"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Validation runs table
export const validationRuns = pgTable("validation_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  fileId: uuid("file_id").notNull(),
  fileName: text("file_name").notNull(),
  status: text("status").notNull().default("queued"), // queued, running, completed, failed
  totalRows: numeric("total_rows"),
  processedRows: numeric("processed_rows"),
  errorCount: numeric("error_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by"),
});

// Files table
export const files = pgTable("files", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  originalName: text("original_name").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: numeric("size").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  uploadedBy: text("uploaded_by"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCodeSchema = createInsertSchema(codes).omit({ updatedAt: true });
export const insertContextSchema = createInsertSchema(contexts).omit({ id: true, updatedAt: true });
export const insertEstablishmentSchema = createInsertSchema(establishments).omit({ id: true, updatedAt: true });
export const insertRuleSchema = createInsertSchema(rules).omit({ id: true, updatedAt: true });
export const insertFieldCatalogSchema = createInsertSchema(fieldCatalog).omit({ id: true, createdAt: true, updatedAt: true });
export const insertValidationRunSchema = createInsertSchema(validationRuns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFileSchema = createInsertSchema(files).omit({ id: true, uploadedAt: true });

// Select schemas
export const selectUserSchema = createSelectSchema(users);
export const selectCodeSchema = createSelectSchema(codes);
export const selectContextSchema = createSelectSchema(contexts);
export const selectEstablishmentSchema = createSelectSchema(establishments);
export const selectRuleSchema = createSelectSchema(rules);
export const selectFieldCatalogSchema = createSelectSchema(fieldCatalog);
export const selectValidationRunSchema = createSelectSchema(validationRuns);
export const selectFileSchema = createSelectSchema(files);

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCode = z.infer<typeof insertCodeSchema>;
export type Code = typeof codes.$inferSelect;
export type InsertContext = z.infer<typeof insertContextSchema>;
export type Context = typeof contexts.$inferSelect;
export type InsertEstablishment = z.infer<typeof insertEstablishmentSchema>;
export type Establishment = typeof establishments.$inferSelect;
export type InsertRule = z.infer<typeof insertRuleSchema>;
export type Rule = typeof rules.$inferSelect;
export type InsertFieldCatalog = z.infer<typeof insertFieldCatalogSchema>;
export type FieldCatalog = typeof fieldCatalog.$inferSelect;
export type InsertValidationRun = z.infer<typeof insertValidationRunSchema>;
export type ValidationRun = typeof validationRuns.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;
