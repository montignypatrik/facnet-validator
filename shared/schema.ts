import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, uuid, timestamp, boolean, jsonb, numeric, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// User schema for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role").notNull().default("pending"), // pending, viewer, editor, admin
  phiRedactionEnabled: boolean("phi_redaction_enabled").default(true).notNull(), // PHI redaction preference
  redactionLevel: text("redaction_level").default("full").notNull(), // 'full' or 'none'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Codes table
export const codes = pgTable("codes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull(),
  description: text("description").notNull(),
  category: text("category"),
  place: text("place"),
  tariffValue: numeric("tariff_value"),
  extraUnitValue: numeric("extra_unit_value"),
  unitRequire: boolean("unit_require"),
  sourceFile: text("source_file"),
  topLevel: text("top_level"),
  level1Group: text("level1_group"),
  level2Group: text("level2_group"),
  leaf: text("leaf"),
  indicators: text("indicators"),
  anchorId: text("anchor_id"),
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
  numero: text("numero"),
  nom: text("nom"),
  type: text("type"),
  region: text("region"),
  secteur0: boolean("secteur_0"),
  secteur1: boolean("secteur_1"),
  secteur2: boolean("secteur_2"),
  secteur3: boolean("secteur_3"),
  secteur4: boolean("secteur_4"),
  secteur5: boolean("secteur_5"),
  secteur6: boolean("secteur_6"),
  secteur7: boolean("secteur_7"),
  secteur8: boolean("secteur_8"),
  ep29: boolean("ep_29"),
  le327: boolean("le_327"),
  ep33: boolean("ep_33"),
  ep54: boolean("ep_54"),
  ep42Gmfu: text("ep_42_gmfu"),
  ep42List: text("ep_42_list"),
  active: boolean("active").default(true).notNull(),
  notes: text("notes"),
  customFields: jsonb("custom_fields").default({}).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by"),
});

/**
 * Rules table - DEPRECATED
 *
 * ⚠️ This table is no longer used for validation rules.
 * All validation rules are now hardcoded in TypeScript files.
 *
 * Location: server/modules/validateur/validation/rules/
 * Registry: server/modules/validateur/validation/ruleRegistry.ts
 *
 * This table is kept for:
 * - Historical data and audit trail
 * - Database management UI (viewing/editing legacy rules)
 * - Future administrative features
 *
 * Do NOT add new validation logic here. Create a new TypeScript rule file instead.
 */
export const rules = pgTable("rules", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: text("rule_id").unique(), // Human-readable unique identifier (e.g., "OFFICE_FEE_19928")
  name: text("name").unique().notNull(),
  description: text("description"),
  ruleType: varchar("rule_type", { length: 100 }),
  condition: jsonb("condition").notNull(),
  threshold: numeric("threshold"),
  severity: varchar("severity", { length: 20 }).default("error").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  customFields: jsonb("custom_fields").default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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
  errorMessage: text("error_message"), // Error details when status is "failed"
  progress: numeric("progress").default("0").notNull(), // Progress percentage (0-100)
  jobId: text("job_id"), // BullMQ job ID for tracking background jobs
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
  solution: text("solution"), // Human-readable solution message
  affectedRecords: jsonb("affected_records"), // Array of record IDs involved
  ruleData: jsonb("rule_data"), // Additional data about the rule violation
  idRamq: text("id_ramq"), // RAMQ ID(s) for grouping validation results

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Validation logs table - stores detailed execution logs for debugging
export const validationLogs = pgTable("validation_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  validationRunId: uuid("validation_run_id").notNull().references(() => validationRuns.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  level: text("level").notNull(), // DEBUG, INFO, WARN, ERROR
  source: text("source").notNull(), // routes, csvProcessor, engine, rule:officeFee
  message: text("message").notNull(),
  metadata: jsonb("metadata"), // Safe metadata only (counts, stats, technical info - NO CSV data)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==================== CHATBOT MODULE ====================

// Conversations table - stores chat conversation metadata
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // Auto-generated from first message or user-defined
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Messages table - stores individual messages in conversations
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: messageRoleEnum("role").notNull(), // user or assistant
  content: text("content").notNull(), // Message text
  metadata: jsonb("metadata").default({}).notNull(), // Store response time, model used, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const conversationsRelations = relations(conversations, ({ many, one }) => ({
  messages: many(messages),
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

// ==================== TASK MANAGEMENT MODULE ====================

/**
 * Task Management System for Dash Platform
 *
 * Purpose: General business task tracking (NOT healthcare/PHI related)
 * Features: Kanban boards, task lists, cards, labels, comments, attachments
 * Security: NO foreign keys to PHI tables (validation_runs, billing_records, etc.)
 * User References: Auth0 user IDs (text) for flexibility
 */

// Task status enum
export const taskStatusEnum = pgEnum("task_status", ["todo", "in_progress", "done"]);

// Task priority enum
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);

// Task boards table - Project/workspace level organization
export const taskBoards = pgTable("task_boards", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Max 100 chars enforced at validation layer
  description: text("description"), // Max 500 chars enforced at validation layer
  createdBy: text("created_by").notNull(), // Auth0 user ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  active: boolean("active").default(true).notNull(), // Soft delete flag
});

// Task lists table - Columns in kanban board (e.g., "To Do", "In Progress", "Done")
export const taskLists = pgTable("task_lists", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: uuid("board_id").notNull().references(() => taskBoards.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Max 50 chars enforced at validation layer
  position: numeric("position").notNull(), // Fractional positioning for drag-and-drop (e.g., 1.0, 1.5, 2.0)
  color: text("color"), // Hex color code (e.g., "#3B82F6")
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tasks table - Individual task cards
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: uuid("board_id").notNull().references(() => taskBoards.id, { onDelete: "cascade" }), // DENORMALIZED for query performance
  listId: uuid("list_id").notNull().references(() => taskLists.id, { onDelete: "cascade" }),
  title: text("title").notNull(), // Max 200 chars enforced at validation layer
  description: text("description"), // Max 5000 chars, supports sanitized HTML
  position: numeric("position").notNull(), // Fractional positioning within list
  status: taskStatusEnum("status").default("todo").notNull(),
  priority: taskPriorityEnum("priority").default("medium").notNull(),
  assignedTo: text("assigned_to"), // Auth0 user ID (optional)
  createdBy: text("created_by").notNull(), // Auth0 user ID
  dueDate: timestamp("due_date"), // Optional deadline
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete (NULL = active, timestamp = deleted)
});

// Task labels table - Tags/categories for tasks
export const taskLabels = pgTable("task_labels", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  boardId: uuid("board_id").notNull().references(() => taskBoards.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Max 30 chars enforced at validation layer
  color: text("color").notNull(), // Hex color code (e.g., "#10B981")
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Task label assignments table - Many-to-many join table
export const taskLabelAssignments = pgTable("task_label_assignments", {
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  labelId: uuid("label_id").notNull().references(() => taskLabels.id, { onDelete: "cascade" }),
}, (table) => ({
  // Composite primary key
  pk: {
    name: "task_label_assignments_pkey",
    columns: [table.taskId, table.labelId],
  },
}));

// Task comments table - Discussion threads on tasks
export const taskComments = pgTable("task_comments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  content: text("content").notNull(), // Max 2000 chars, supports sanitized HTML
  authorId: text("author_id").notNull(), // Auth0 user ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete
});

// Task attachments table - File uploads linked to tasks
export const taskAttachments = pgTable("task_attachments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(), // Secure random filename on server
  originalName: text("original_name").notNull(), // User's original filename
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(), // Size in bytes
  storagePath: text("storage_path").notNull(), // Absolute path to file on server
  uploadedBy: text("uploaded_by").notNull(), // Auth0 user ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete
});

// Task module relations
export const taskBoardsRelations = relations(taskBoards, ({ many }) => ({
  lists: many(taskLists),
  tasks: many(tasks),
  labels: many(taskLabels),
}));

export const taskListsRelations = relations(taskLists, ({ one, many }) => ({
  board: one(taskBoards, {
    fields: [taskLists.boardId],
    references: [taskBoards.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  board: one(taskBoards, {
    fields: [tasks.boardId],
    references: [taskBoards.id],
  }),
  list: one(taskLists, {
    fields: [tasks.listId],
    references: [taskLists.id],
  }),
  comments: many(taskComments),
  attachments: many(taskAttachments),
  labelAssignments: many(taskLabelAssignments),
}));

export const taskLabelsRelations = relations(taskLabels, ({ one, many }) => ({
  board: one(taskBoards, {
    fields: [taskLabels.boardId],
    references: [taskBoards.id],
  }),
  assignments: many(taskLabelAssignments),
}));

export const taskLabelAssignmentsRelations = relations(taskLabelAssignments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskLabelAssignments.taskId],
    references: [tasks.id],
  }),
  label: one(taskLabels, {
    fields: [taskLabelAssignments.labelId],
    references: [taskLabels.id],
  }),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
}));

export const taskAttachmentsRelations = relations(taskAttachments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskAttachments.taskId],
    references: [tasks.id],
  }),
}));

// ==================== NAM EXTRACTION MODULE ====================

/**
 * NAM (Quebec Health Insurance Number) Extraction Module
 *
 * Purpose: Extract Quebec health insurance numbers (NAM) from medical billing PDF documents
 * Features: AWS Textract OCR, OpenAI GPT-4 extraction, format validation, SSV file generation
 * Pattern: Follows same structure as validation_runs/validation_results
 */

// NAM extraction runs table - tracks PDF upload and extraction jobs
export const namExtractionRuns = pgTable("nam_extraction_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  fileId: uuid("file_id").notNull(),
  fileName: text("file_name").notNull(),
  status: text("status").notNull().default("queued"), // queued, running, completed, failed
  stage: text("stage"), // ocr, ai_extraction, validation (for progress tracking)
  pageCount: integer("page_count"),
  namsFound: integer("nams_found"), // Total NAMs extracted
  namsValid: integer("nams_valid"), // NAMs that passed format validation
  errorMessage: text("error_message"), // Error details when status is "failed"
  errorCode: text("error_code"), // OCR_FAILED, AI_EXTRACTION_FAILED, etc.
  progress: numeric("progress").default("0").notNull(), // Progress percentage (0-100)
  processingTimeMs: integer("processing_time_ms"), // Total processing time
  jobId: text("job_id"), // BullMQ job ID for tracking background jobs

  // CSV export fields (populated by user before upload)
  doctorLicenceID: text("doctor_licence_id"), // 7-digit doctor license number
  doctorGroupNumber: text("doctor_group_number"), // 5-digit group number (optional, defaults to "0")
  sector: text("sector"), // Sector value 0-7

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: text("created_by").notNull(), // Auth0 user ID
});

// NAM extraction results table - stores individual extracted NAMs
export const namExtractionResults = pgTable("nam_extraction_results", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: uuid("run_id").notNull().references(() => namExtractionRuns.id, { onDelete: "cascade" }),
  nam: text("nam").notNull(), // The extracted NAM (normalized to uppercase)
  page: integer("page").notNull(), // Page number where NAM was found
  valid: boolean("valid").notNull(), // Whether NAM passes format validation (4 letters + 8 digits)
  validationError: text("validation_error"), // Reason why NAM is invalid (if valid=false)
  removedByUser: boolean("removed_by_user").default(false).notNull(), // User curation flag
  includedInSsv: boolean("included_in_ssv").default(false).notNull(), // Whether NAM was included in generated SSV file

  // Visit date and time fields
  visitDate: text("visit_date"), // Visit date in YYYY-MM-DD format (extracted or manually entered)
  visitTime: text("visit_time"), // Visit time in HH:MM 24h format (extracted or manually entered, default "08:00")
  dateValid: boolean("date_valid").default(false).notNull(), // Whether visit date is valid
  timeValid: boolean("time_valid").default(true).notNull(), // Whether visit time is valid
  dateValidationError: text("date_validation_error"), // Reason why date is invalid
  timeValidationError: text("time_validation_error"), // Reason why time is invalid
  dateManuallyEdited: boolean("date_manually_edited").default(false).notNull(), // User manually edited date
  timeManuallyEdited: boolean("time_manually_edited").default(false).notNull(), // User manually edited time

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const namExtractionRunsRelations = relations(namExtractionRuns, ({ many }) => ({
  results: many(namExtractionResults),
}));

export const namExtractionResultsRelations = relations(namExtractionResults, ({ one }) => ({
  run: one(namExtractionRuns, {
    fields: [namExtractionResults.runId],
    references: [namExtractionRuns.id],
  }),
}));

// ==================== RAG DOCUMENT PROCESSING MODULE ====================

// Document status enum
export const documentStatusEnum = pgEnum("document_status", ["pending", "processing", "completed", "error"]);

// Document file type enum
export const documentFileTypeEnum = pgEnum("document_file_type", ["html", "pdf"]);

// Document category enum
export const documentCategoryEnum = pgEnum("document_category", [
  "ramq-official",
  "billing-guides",
  "code-references",
  "regulations",
  "faq",
]);

// Documents table - tracks source files in knowledge/ directory
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  filePath: text("file_path").notNull().unique(), // Relative path from knowledge/
  fileType: documentFileTypeEnum("file_type").notNull(),
  category: documentCategoryEnum("category").notNull(),
  fileHash: text("file_hash").notNull(), // SHA256 hash for change detection
  fileSizeBytes: numeric("file_size_bytes"),
  status: documentStatusEnum("status").notNull().default("pending"),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").default({}).notNull(), // title, language, page_count, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Document chunks table - stores text chunks with embeddings for RAG
export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(), // Order within document (0-indexed)
  content: text("content").notNull(), // Actual chunk text
  tokenCount: integer("token_count").notNull(),
  sectionTitle: text("section_title"), // Section heading if applicable
  pageNumber: integer("page_number"), // Page number in PDF
  isOverlap: boolean("is_overlap").default(false), // Whether chunk is from overlap region
  embeddingPending: boolean("embedding_pending").default(true), // Placeholder until pgvector installed
  metadata: jsonb("metadata").default({}).notNull(), // Additional metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const documentsRelations = relations(documents, ({ many }) => ({
  chunks: many(documentChunks),
}));

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}));

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
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertValidationLogSchema = createInsertSchema(validationLogs).omit({ id: true, createdAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDocumentChunkSchema = createInsertSchema(documentChunks).omit({ id: true, createdAt: true });
export const insertTaskBoardSchema = createInsertSchema(taskBoards).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskListSchema = createInsertSchema(taskLists).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskLabelSchema = createInsertSchema(taskLabels).omit({ id: true, createdAt: true });
export const insertTaskLabelAssignmentSchema = createInsertSchema(taskLabelAssignments);
export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskAttachmentSchema = createInsertSchema(taskAttachments).omit({ id: true, createdAt: true });
export const insertNamExtractionRunSchema = createInsertSchema(namExtractionRuns).omit({ id: true, createdAt: true, updatedAt: true });
export const insertNamExtractionResultSchema = createInsertSchema(namExtractionResults).omit({ id: true, createdAt: true });

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
export const selectConversationSchema = createSelectSchema(conversations);
export const selectMessageSchema = createSelectSchema(messages);
export const selectValidationLogSchema = createSelectSchema(validationLogs);
export const selectDocumentSchema = createSelectSchema(documents);
export const selectDocumentChunkSchema = createSelectSchema(documentChunks);
export const selectTaskBoardSchema = createSelectSchema(taskBoards);
export const selectTaskListSchema = createSelectSchema(taskLists);
export const selectTaskSchema = createSelectSchema(tasks);
export const selectTaskLabelSchema = createSelectSchema(taskLabels);
export const selectTaskLabelAssignmentSchema = createSelectSchema(taskLabelAssignments);
export const selectTaskCommentSchema = createSelectSchema(taskComments);
export const selectTaskAttachmentSchema = createSelectSchema(taskAttachments);
export const selectNamExtractionRunSchema = createSelectSchema(namExtractionRuns);
export const selectNamExtractionResultSchema = createSelectSchema(namExtractionResults);

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
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertValidationLog = z.infer<typeof insertValidationLogSchema>;
export type ValidationLog = typeof validationLogs.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type InsertTaskBoard = z.infer<typeof insertTaskBoardSchema>;
export type TaskBoard = typeof taskBoards.$inferSelect;
export type InsertTaskList = z.infer<typeof insertTaskListSchema>;
export type TaskList = typeof taskLists.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTaskLabel = z.infer<typeof insertTaskLabelSchema>;
export type TaskLabel = typeof taskLabels.$inferSelect;
export type InsertTaskLabelAssignment = z.infer<typeof insertTaskLabelAssignmentSchema>;
export type TaskLabelAssignment = typeof taskLabelAssignments.$inferSelect;
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof taskComments.$inferSelect;
export type InsertTaskAttachment = z.infer<typeof insertTaskAttachmentSchema>;
export type TaskAttachment = typeof taskAttachments.$inferSelect;
export type InsertNamExtractionRun = z.infer<typeof insertNamExtractionRunSchema>;
export type NamExtractionRun = typeof namExtractionRuns.$inferSelect;
export type InsertNamExtractionResult = z.infer<typeof insertNamExtractionResultSchema>;
export type NamExtractionResult = typeof namExtractionResults.$inferSelect;
