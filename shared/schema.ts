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

// Billing records table - stores the CSV billing data
export const billingRecords = pgTable("billing_records", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  validationRunId: uuid("validation_run_id").notNull(),

  // CSV Fields
  recordNumber: numeric("record_number"),
  facture: text("facture"), // Internal invoice number
  idRamq: text("id_ramq"), // RAMQ invoice number
  dateService: timestamp("date_service"), // Service date
  debut: text("debut"), // Start time
  fin: text("fin"), // End time
  periode: text("periode"), // Period
  lieuPratique: text("lieu_pratique"), // Establishment number
  secteurActivite: text("secteur_activite"), // Establishment sector
  diagnostic: text("diagnostic"), // Diagnostic code
  code: text("code"), // Billing code
  unites: numeric("unites"), // Units
  role: text("role"), // Role (1=primary, 2=assistant)
  elementContexte: text("element_contexte"), // Context element
  montantPreliminaire: numeric("montant_preliminaire", { precision: 10, scale: 2 }),
  montantPaye: numeric("montant_paye", { precision: 10, scale: 2 }),
  doctorInfo: text("doctor_info"), // Doctor information
  patient: text("patient"), // Patient identifier

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Validation results table - stores individual validation errors/warnings
export const validationResults = pgTable("validation_results", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  validationRunId: uuid("validation_run_id").notNull(),
  ruleId: text("rule_id"), // References the rule that was violated
  billingRecordId: uuid("billing_record_id"), // References the specific record

  // Validation details
  severity: text("severity").notNull(), // error, warning, info
  category: text("category").notNull(), // office_fees, context_missing, etc.
  message: text("message").notNull(), // Human-readable error message
  affectedRecords: jsonb("affected_records"), // Array of record IDs involved
  ruleData: jsonb("rule_data"), // Additional data about the rule violation

  createdAt: timestamp("created_at").defaultNow().notNull(),
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
export const insertBillingRecordSchema = createInsertSchema(billingRecords).omit({ id: true, createdAt: true });
export const insertValidationResultSchema = createInsertSchema(validationResults).omit({ id: true, createdAt: true });

// Select schemas
export const selectUserSchema = createSelectSchema(users);
export const selectCodeSchema = createSelectSchema(codes);
export const selectContextSchema = createSelectSchema(contexts);
export const selectEstablishmentSchema = createSelectSchema(establishments);
export const selectRuleSchema = createSelectSchema(rules);
export const selectFieldCatalogSchema = createSelectSchema(fieldCatalog);
export const selectValidationRunSchema = createSelectSchema(validationRuns);
export const selectFileSchema = createSelectSchema(files);
export const selectBillingRecordSchema = createSelectSchema(billingRecords);
export const selectValidationResultSchema = createSelectSchema(validationResults);

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
export type InsertBillingRecord = z.infer<typeof insertBillingRecordSchema>;
export type BillingRecord = typeof billingRecords.$inferSelect;
export type InsertValidationResult = z.infer<typeof insertValidationResultSchema>;
export type ValidationResult = typeof validationResults.$inferSelect;
