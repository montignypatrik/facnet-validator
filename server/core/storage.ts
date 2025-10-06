import { eq, and, or, like, desc, asc, count, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users, codes, contexts, establishments, rules, fieldCatalog, validationRuns, files,
  billingRecords, validationResults, validationLogs,
  type User, type InsertUser,
  type Code, type InsertCode,
  type Context, type InsertContext,
  type Establishment, type InsertEstablishment,
  type Rule, type InsertRule,
  type FieldCatalog, type InsertFieldCatalog,
  type ValidationRun, type InsertValidationRun,
  type File, type InsertFile,
  type BillingRecord, type InsertBillingRecord,
  type ValidationResult, type InsertValidationResult,
  type ValidationLog, type InsertValidationLog
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;

  // Codes
  getCodes(params: { search?: string; page?: number; pageSize?: number }): Promise<{ data: Code[]; total: number }>;
  getCode(id: string): Promise<Code | undefined>;
  createCode(code: InsertCode): Promise<Code>;
  updateCode(id: string, data: Partial<InsertCode>): Promise<Code>;
  deleteCode(id: string): Promise<void>;
  upsertCodes(codes: InsertCode[]): Promise<void>;

  // Contexts
  getContexts(params: { search?: string; page?: number; pageSize?: number }): Promise<{ data: Context[]; total: number }>;
  getContext(id: string): Promise<Context | undefined>;
  getContextByName(name: string): Promise<Context | undefined>;
  createContext(context: InsertContext): Promise<Context>;
  updateContext(id: string, data: Partial<InsertContext>): Promise<Context>;
  deleteContext(id: string): Promise<void>;
  upsertContexts(contexts: InsertContext[]): Promise<void>;

  // Establishments
  getEstablishments(params: { search?: string; page?: number; pageSize?: number }): Promise<{ data: Establishment[]; total: number }>;
  getEstablishment(id: string): Promise<Establishment | undefined>;
  getEstablishmentByName(name: string): Promise<Establishment | undefined>;
  createEstablishment(establishment: InsertEstablishment): Promise<Establishment>;
  updateEstablishment(id: string, data: Partial<InsertEstablishment>): Promise<Establishment>;
  deleteEstablishment(id: string): Promise<void>;
  upsertEstablishments(establishments: InsertEstablishment[]): Promise<void>;

  // Rules
  getRules(params: { search?: string; page?: number; pageSize?: number }): Promise<{ data: Rule[]; total: number }>;
  getRule(id: string): Promise<Rule | undefined>;
  getRuleByName(name: string): Promise<Rule | undefined>;
  createRule(rule: InsertRule): Promise<Rule>;
  updateRule(id: string, data: Partial<InsertRule>): Promise<Rule>;
  deleteRule(id: string): Promise<void>;
  upsertRules(rules: InsertRule[]): Promise<void>;

  // Field Catalog
  getFieldCatalog(tableName?: string): Promise<FieldCatalog[]>;
  getFieldCatalogItem(id: string): Promise<FieldCatalog | undefined>;
  createFieldCatalogItem(item: InsertFieldCatalog): Promise<FieldCatalog>;
  updateFieldCatalogItem(id: string, data: Partial<InsertFieldCatalog>): Promise<FieldCatalog>;
  deleteFieldCatalogItem(id: string): Promise<void>;

  // Validation Runs
  getValidationRuns(params: { limit?: number; status?: string; page?: number; pageSize?: number }): Promise<{ data: ValidationRun[]; total: number }>;
  getValidationRun(id: string): Promise<ValidationRun | undefined>;
  createValidationRun(run: InsertValidationRun): Promise<ValidationRun>;
  updateValidationRun(id: string, data: Partial<InsertValidationRun>): Promise<ValidationRun>;

  // Files
  createFile(file: InsertFile): Promise<File>;
  getFile(id: string): Promise<File | undefined>;

  // Billing Records
  createBillingRecords(records: InsertBillingRecord[]): Promise<BillingRecord[]>;
  getBillingRecords(validationRunId: string): Promise<BillingRecord[]>;

  // Validation Results
  createValidationResults(results: InsertValidationResult[]): Promise<ValidationResult[]>;
  getValidationResults(validationRunId: string): Promise<ValidationResult[]>;

  // Validation Logs
  createValidationLog(log: InsertValidationLog): Promise<ValidationLog>;
  createValidationLogsBatch(logs: InsertValidationLog[]): Promise<ValidationLog[]>;
  getValidationLogs(
    validationRunId: string,
    filters?: {
      level?: string;
      source?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ data: ValidationLog[]; total: number }>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: string, user: Partial<InsertUser>): Promise<User> {
    const [updated] = await db.update(users).set(user).where(eq(users.id, id)).returning();
    return updated;
  }

  // Codes
  async getCodes(params: { search?: string; page?: number; pageSize?: number }): Promise<{ data: Code[]; total: number }> {
    const { search, page = 1, pageSize = 50 } = params;
    const offset = (page - 1) * pageSize;

    let query = db.select().from(codes);
    let countQuery = db.select({ count: count() }).from(codes);

    if (search) {
      // Support comma-separated search values
      const searchTerms = search.split(',').map(term => term.trim()).filter(term => term.length > 0);

      if (searchTerms.length > 0) {
        // Build OR conditions for multiple search terms
        const searchConditions = searchTerms.map(term => like(codes.code, `%${term}%`));
        const combinedCondition = searchConditions.length === 1
          ? searchConditions[0]
          : or(...searchConditions);

        query = query.where(combinedCondition);
        countQuery = countQuery.where(combinedCondition);
      }
    }

    const [data, totalResult] = await Promise.all([
      query.limit(pageSize).offset(offset).orderBy(asc(codes.code)),
      countQuery
    ]);

    return { data, total: totalResult[0].count };
  }

  async getCode(id: string): Promise<Code | undefined> {
    const [result] = await db.select().from(codes).where(eq(codes.id, id));
    return result || undefined;
  }

  async createCode(code: InsertCode): Promise<Code> {
    const [created] = await db.insert(codes).values(code).returning();
    return created;
  }

  async updateCode(id: string, data: Partial<InsertCode>): Promise<Code> {
    const [updated] = await db.update(codes).set({ ...data, updatedAt: new Date() }).where(eq(codes.id, id)).returning();
    return updated;
  }

  async deleteCode(id: string): Promise<void> {
    await db.delete(codes).where(eq(codes.id, id));
  }

  async upsertCodes(codeList: InsertCode[]): Promise<void> {
    if (codeList.length === 0) return;
    
    // Insert codes individually to avoid primary key conflicts
    for (const code of codeList) {
      try {
        await db.insert(codes).values(code);
      } catch (error) {
        // Skip if code already exists (duplicate primary key)
        if (error.code !== '23505') { // 23505 is unique_violation
          throw error;
        }
      }
    }
  }

  // Contexts
  async getContexts(params: { search?: string; page?: number; pageSize?: number }): Promise<{ data: Context[]; total: number }> {
    const { search, page = 1, pageSize = 50 } = params;
    const offset = (page - 1) * pageSize;

    let query = db.select().from(contexts);
    let countQuery = db.select({ count: count() }).from(contexts);

    if (search) {
      // Support comma-separated search values
      const searchTerms = search.split(',').map(term => term.trim()).filter(term => term.length > 0);

      if (searchTerms.length > 0) {
        const searchConditions = searchTerms.map(term => like(contexts.name, `%${term}%`));
        const combinedCondition = searchConditions.length === 1
          ? searchConditions[0]
          : or(...searchConditions);

        query = query.where(combinedCondition);
        countQuery = countQuery.where(combinedCondition);
      }
    }

    const [data, totalResult] = await Promise.all([
      query.limit(pageSize).offset(offset).orderBy(asc(contexts.name)),
      countQuery
    ]);

    return { data, total: totalResult[0].count };
  }

  async getContext(id: string): Promise<Context | undefined> {
    const [result] = await db.select().from(contexts).where(eq(contexts.id, id));
    return result || undefined;
  }

  async getContextByName(name: string): Promise<Context | undefined> {
    const [result] = await db.select().from(contexts).where(eq(contexts.name, name));
    return result || undefined;
  }

  async createContext(context: InsertContext): Promise<Context> {
    const [created] = await db.insert(contexts).values(context).returning();
    return created;
  }

  async updateContext(id: string, data: Partial<InsertContext>): Promise<Context> {
    const [updated] = await db.update(contexts).set({ ...data, updatedAt: new Date() }).where(eq(contexts.id, id)).returning();
    return updated;
  }

  async deleteContext(id: string): Promise<void> {
    await db.delete(contexts).where(eq(contexts.id, id));
  }

  async upsertContexts(contextList: InsertContext[]): Promise<void> {
    if (contextList.length === 0) return;
    
    await db.insert(contexts).values(contextList).onConflictDoUpdate({
      target: contexts.name,
      set: {
        description: sql`EXCLUDED.description`,
        tags: sql`EXCLUDED.tags`,
        customFields: sql`EXCLUDED.custom_fields`,
        updatedAt: sql`EXCLUDED.updated_at`,
        updatedBy: sql`EXCLUDED.updated_by`
      }
    });
  }

  // Establishments
  async getEstablishments(params: { search?: string; page?: number; pageSize?: number }): Promise<{ data: Establishment[]; total: number }> {
    const { search, page = 1, pageSize = 50 } = params;
    const offset = (page - 1) * pageSize;

    let query = db.select().from(establishments);
    let countQuery = db.select({ count: count() }).from(establishments);

    if (search) {
      // Support comma-separated search values
      const searchTerms = search.split(',').map(term => term.trim()).filter(term => term.length > 0);

      if (searchTerms.length > 0) {
        const searchConditions = searchTerms.map(term => like(establishments.name, `%${term}%`));
        const combinedCondition = searchConditions.length === 1
          ? searchConditions[0]
          : or(...searchConditions);

        query = query.where(combinedCondition);
        countQuery = countQuery.where(combinedCondition);
      }
    }

    const [data, totalResult] = await Promise.all([
      query.limit(pageSize).offset(offset).orderBy(asc(establishments.name)),
      countQuery
    ]);

    return { data, total: totalResult[0].count };
  }

  async getEstablishment(id: string): Promise<Establishment | undefined> {
    const [result] = await db.select().from(establishments).where(eq(establishments.id, id));
    return result || undefined;
  }

  async getEstablishmentByName(name: string): Promise<Establishment | undefined> {
    const [result] = await db.select().from(establishments).where(eq(establishments.name, name));
    return result || undefined;
  }

  async createEstablishment(establishment: InsertEstablishment): Promise<Establishment> {
    const [created] = await db.insert(establishments).values(establishment).returning();
    return created;
  }

  async updateEstablishment(id: string, data: Partial<InsertEstablishment>): Promise<Establishment> {
    const [updated] = await db.update(establishments).set({ ...data, updatedAt: new Date() }).where(eq(establishments.id, id)).returning();
    return updated;
  }

  async deleteEstablishment(id: string): Promise<void> {
    await db.delete(establishments).where(eq(establishments.id, id));
  }

  async upsertEstablishments(establishmentList: InsertEstablishment[]): Promise<void> {
    if (establishmentList.length === 0) return;
    
    await db.insert(establishments).values(establishmentList).onConflictDoUpdate({
      target: establishments.name,
      set: {
        type: sql`EXCLUDED.type`,
        region: sql`EXCLUDED.region`,
        active: sql`EXCLUDED.active`,
        notes: sql`EXCLUDED.notes`,
        customFields: sql`EXCLUDED.custom_fields`,
        updatedAt: sql`EXCLUDED.updated_at`,
        updatedBy: sql`EXCLUDED.updated_by`
      }
    });
  }

  // Rules
  async getRules(params: { search?: string; page?: number; pageSize?: number }): Promise<{ data: Rule[]; total: number }> {
    const { search, page = 1, pageSize = 50 } = params;
    const offset = (page - 1) * pageSize;

    let query = db.select().from(rules);
    let countQuery = db.select({ count: count() }).from(rules);

    if (search) {
      // Support comma-separated search values
      const searchTerms = search.split(',').map(term => term.trim()).filter(term => term.length > 0);

      if (searchTerms.length > 0) {
        const searchConditions = searchTerms.map(term => like(rules.name, `%${term}%`));
        const combinedCondition = searchConditions.length === 1
          ? searchConditions[0]
          : or(...searchConditions);

        query = query.where(combinedCondition);
        countQuery = countQuery.where(combinedCondition);
      }
    }

    const [data, totalResult] = await Promise.all([
      query.limit(pageSize).offset(offset).orderBy(asc(rules.name)),
      countQuery
    ]);

    return { data, total: totalResult[0].count };
  }

  async getRule(id: string): Promise<Rule | undefined> {
    const [result] = await db.select().from(rules).where(eq(rules.id, id));
    return result || undefined;
  }

  async getRuleByName(name: string): Promise<Rule | undefined> {
    const [result] = await db.select().from(rules).where(eq(rules.name, name));
    return result || undefined;
  }

  async createRule(rule: InsertRule): Promise<Rule> {
    const [created] = await db.insert(rules).values(rule).returning();
    return created;
  }

  async updateRule(id: string, data: Partial<InsertRule>): Promise<Rule> {
    const [updated] = await db.update(rules).set({ ...data, updatedAt: new Date() }).where(eq(rules.id, id)).returning();
    return updated;
  }

  async deleteRule(id: string): Promise<void> {
    await db.delete(rules).where(eq(rules.id, id));
  }

  async upsertRules(ruleList: InsertRule[]): Promise<void> {
    if (ruleList.length === 0) return;
    
    await db.insert(rules).values(ruleList).onConflictDoUpdate({
      target: rules.name,
      set: {
        condition: sql`EXCLUDED.condition`,
        threshold: sql`EXCLUDED.threshold`,
        enabled: sql`EXCLUDED.enabled`,
        customFields: sql`EXCLUDED.custom_fields`,
        updatedAt: sql`EXCLUDED.updated_at`,
        updatedBy: sql`EXCLUDED.updated_by`
      }
    });
  }

  // Field Catalog
  async getFieldCatalog(tableName?: string): Promise<FieldCatalog[]> {
    const conditions = [eq(fieldCatalog.active, true)];
    
    if (tableName) {
      conditions.push(eq(fieldCatalog.tableName, tableName));
    }
    
    return await db.select().from(fieldCatalog)
      .where(and(...conditions))
      .orderBy(asc(fieldCatalog.label));
  }

  async getFieldCatalogItem(id: string): Promise<FieldCatalog | undefined> {
    const [result] = await db.select().from(fieldCatalog).where(eq(fieldCatalog.id, id));
    return result || undefined;
  }

  async createFieldCatalogItem(item: InsertFieldCatalog): Promise<FieldCatalog> {
    const [created] = await db.insert(fieldCatalog).values(item).returning();
    return created;
  }

  async updateFieldCatalogItem(id: string, data: Partial<InsertFieldCatalog>): Promise<FieldCatalog> {
    const [updated] = await db.update(fieldCatalog).set({ ...data, updatedAt: new Date() }).where(eq(fieldCatalog.id, id)).returning();
    return updated;
  }

  async deleteFieldCatalogItem(id: string): Promise<void> {
    await db.delete(fieldCatalog).where(eq(fieldCatalog.id, id));
  }

  // Validation Runs
  async getValidationRuns(params: { limit?: number; status?: string; page?: number; pageSize?: number }): Promise<{ data: ValidationRun[]; total: number }> {
    const { limit, status, page = 1, pageSize = 50 } = params;
    const offset = (page - 1) * pageSize;

    let query = db.select().from(validationRuns);
    let countQuery = db.select({ count: count() }).from(validationRuns);

    if (status) {
      query = query.where(eq(validationRuns.status, status));
      countQuery = countQuery.where(eq(validationRuns.status, status));
    }

    if (limit) {
      query = query.limit(limit);
    } else {
      query = query.limit(pageSize).offset(offset);
    }

    const [data, totalResult] = await Promise.all([
      query.orderBy(desc(validationRuns.createdAt)),
      countQuery
    ]);

    return { data, total: totalResult[0].count };
  }

  async getValidationRun(id: string): Promise<ValidationRun | undefined> {
    const [result] = await db.select().from(validationRuns).where(eq(validationRuns.id, id));
    return result || undefined;
  }

  async createValidationRun(run: InsertValidationRun): Promise<ValidationRun> {
    const [created] = await db.insert(validationRuns).values(run).returning();
    return created;
  }

  async updateValidationRun(id: string, data: Partial<InsertValidationRun>): Promise<ValidationRun> {
    const [updated] = await db.update(validationRuns).set({ ...data, updatedAt: new Date() }).where(eq(validationRuns.id, id)).returning();
    return updated;
  }

  // Files
  async createFile(file: InsertFile): Promise<File> {
    const [created] = await db.insert(files).values(file).returning();
    return created;
  }

  async getFile(id: string): Promise<File | undefined> {
    const [result] = await db.select().from(files).where(eq(files.id, id));
    return result || undefined;
  }

  // Billing Records
  async createBillingRecords(records: InsertBillingRecord[]): Promise<BillingRecord[]> {
    if (records.length === 0) return [];

    // Batch insert to avoid PostgreSQL parameter limit (65535 params)
    // Each record has ~20 fields, so batch size of 500 = ~10,000 parameters (safe)
    const BATCH_SIZE = 500;
    const allCreated: BillingRecord[] = [];

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const created = await db.insert(billingRecords).values(batch).returning();
      allCreated.push(...created);
      console.log(`[DB] Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(records.length / BATCH_SIZE)} (${batch.length} records)`);
    }

    return allCreated;
  }

  async getBillingRecords(validationRunId: string): Promise<BillingRecord[]> {
    return await db.select().from(billingRecords)
      .where(eq(billingRecords.validationRunId, validationRunId))
      .orderBy(asc(billingRecords.recordNumber));
  }

  // Validation Results
  async createValidationResults(results: InsertValidationResult[]): Promise<ValidationResult[]> {
    if (results.length === 0) return [];

    // Batch insert to avoid PostgreSQL parameter limit (65535 params)
    // Each validation result has ~10 fields, so batch size of 1000 = ~10,000 parameters (safe)
    const BATCH_SIZE = 1000;
    const allCreated: ValidationResult[] = [];

    for (let i = 0; i < results.length; i += BATCH_SIZE) {
      const batch = results.slice(i, i + BATCH_SIZE);
      const created = await db.insert(validationResults).values(batch).returning();
      allCreated.push(...created);
      console.log(`[DB] Inserted validation batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(results.length / BATCH_SIZE)} (${batch.length} results)`);
    }

    return allCreated;
  }

  async getValidationResults(validationRunId: string): Promise<ValidationResult[]> {
    const results = await db
      .select({
        id: validationResults.id,
        validationRunId: validationResults.validationRunId,
        ruleId: validationResults.ruleId,
        billingRecordId: validationResults.billingRecordId,
        severity: validationResults.severity,
        category: validationResults.category,
        message: validationResults.message,
        solution: validationResults.solution,
        affectedRecords: validationResults.affectedRecords,
        ruleData: validationResults.ruleData,
        createdAt: validationResults.createdAt,
        ruleName: rules.name,
        idRamq: validationResults.idRamq, // Fixed: read from validation_results table, not billing_records
      })
      .from(validationResults)
      .leftJoin(rules, sql`${validationResults.ruleId}::uuid = ${rules.id}`)
      .leftJoin(billingRecords, eq(validationResults.billingRecordId, billingRecords.id))
      .where(eq(validationResults.validationRunId, validationRunId))
      .orderBy(asc(validationResults.createdAt));

    return results as any;
  }

  // Validation Logs
  async createValidationLog(log: InsertValidationLog): Promise<ValidationLog> {
    const [created] = await db.insert(validationLogs).values(log).returning();
    return created;
  }

  async createValidationLogsBatch(logs: InsertValidationLog[]): Promise<ValidationLog[]> {
    if (logs.length === 0) return [];
    return await db.insert(validationLogs).values(logs).returning();
  }

  async getValidationLogs(
    validationRunId: string,
    filters?: {
      level?: string;
      source?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ data: ValidationLog[]; total: number }> {
    const conditions = [eq(validationLogs.validationRunId, validationRunId)];

    if (filters?.level) {
      conditions.push(eq(validationLogs.level, filters.level));
    }

    if (filters?.source) {
      conditions.push(eq(validationLogs.source, filters.source));
    }

    const [totalResult] = await db
      .select({ count: count() })
      .from(validationLogs)
      .where(and(...conditions));

    const data = await db
      .select()
      .from(validationLogs)
      .where(and(...conditions))
      .orderBy(asc(validationLogs.timestamp))
      .limit(filters?.limit || 1000)
      .offset(filters?.offset || 0);

    return {
      data,
      total: Number(totalResult.count),
    };
  }

  // Rules
  async getAllRules(): Promise<Rule[]> {
    return await db.select().from(rules).where(eq(rules.enabled, true));
  }

  async createRule(rule: InsertRule): Promise<Rule> {
    const [created] = await db.insert(rules).values(rule).returning();
    return created;
  }

  async updateRule(id: string, data: Partial<InsertRule>): Promise<Rule> {
    const [updated] = await db.update(rules).set({ ...data, updatedAt: new Date() }).where(eq(rules.id, id)).returning();
    return updated;
  }

  async deleteRule(id: string): Promise<void> {
    await db.delete(rules).where(eq(rules.id, id));
  }

  // SECURITY: Data cleanup methods for sensitive information
  async deleteValidationRun(validationRunId: string): Promise<void> {
    console.log(`[SECURITY] Deleting validation run: ${validationRunId}`);

    // Delete in order due to foreign key constraints
    await db.delete(validationResults).where(eq(validationResults.validationRunId, validationRunId));
    await db.delete(billingRecords).where(eq(billingRecords.validationRunId, validationRunId));
    await db.delete(validationRuns).where(eq(validationRuns.id, validationRunId));

    console.log(`[SECURITY] Validation run ${validationRunId} completely deleted`);
  }

  async deleteOldValidationRuns(olderThanHours: number = 24): Promise<number> {
    console.log(`[SECURITY] Cleaning up validation runs older than ${olderThanHours} hours`);

    const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

    // Get old validation runs to delete
    const oldRuns = await db.select({ id: validationRuns.id })
      .from(validationRuns)
      .where(sql`${validationRuns.createdAt} < ${cutoffDate}`);

    // Delete each run and its related data
    for (const run of oldRuns) {
      await this.deleteValidationRun(run.id);
    }

    console.log(`[SECURITY] Deleted ${oldRuns.length} old validation runs`);
    return oldRuns.length;
  }
}

export const storage = new DatabaseStorage();
