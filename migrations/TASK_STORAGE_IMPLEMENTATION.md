# Task Module Storage Layer Implementation Guide

This document provides the complete storage layer implementation for the task management module. Add these methods to `server/core/storage.ts`.

---

## Step 1: Update Imports

Add task module imports to the import statement at the top of `server/core/storage.ts`:

```typescript
import {
  users, codes, contexts, establishments, rules, fieldCatalog, validationRuns, files,
  billingRecords, validationResults, validationLogs,
  // ADD THESE TASK MODULE IMPORTS:
  taskBoards, taskLists, tasks, taskLabels, taskLabelAssignments,
  taskComments, taskAttachments,
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
  type ValidationLog, type InsertValidationLog,
  // ADD THESE TASK MODULE TYPES:
  type TaskBoard, type InsertTaskBoard,
  type TaskList, type InsertTaskList,
  type Task, type InsertTask,
  type TaskLabel, type InsertTaskLabel,
  type TaskLabelAssignment, type InsertTaskLabelAssignment,
  type TaskComment, type InsertTaskComment,
  type TaskAttachment, type InsertTaskAttachment
} from "../../shared/schema.js";
```

---

## Step 2: Update IStorage Interface

Add task module method signatures to the `IStorage` interface (around line 23):

```typescript
export interface IStorage {
  // ... existing methods ...

  // ==================== TASK MANAGEMENT MODULE ====================

  // Task Boards
  getTaskBoards(params: {
    userId?: string; // Filter by creator (optional)
    search?: string;
    page?: number;
    pageSize?: number;
    activeOnly?: boolean;
  }): Promise<{ data: TaskBoard[]; total: number }>;
  getTaskBoard(id: string): Promise<TaskBoard | undefined>;
  createTaskBoard(board: InsertTaskBoard): Promise<TaskBoard>;
  updateTaskBoard(id: string, data: Partial<InsertTaskBoard>): Promise<TaskBoard>;
  deleteTaskBoard(id: string): Promise<void>; // Hard delete (CASCADE handles children)
  softDeleteTaskBoard(id: string): Promise<TaskBoard>; // Soft delete (set active = false)

  // Task Lists
  getTaskLists(boardId: string): Promise<TaskList[]>;
  getTaskList(id: string): Promise<TaskList | undefined>;
  createTaskList(list: InsertTaskList): Promise<TaskList>;
  updateTaskList(id: string, data: Partial<InsertTaskList>): Promise<TaskList>;
  deleteTaskList(id: string): Promise<void>; // Hard delete
  reorderTaskLists(updates: { id: string; position: number }[]): Promise<void>;

  // Tasks
  getTasks(params: {
    boardId?: string;
    listId?: string;
    assignedTo?: string;
    createdBy?: string;
    status?: string;
    priority?: string;
    search?: string;
    includeDeleted?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: Task[]; total: number }>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: string): Promise<void>; // Hard delete
  softDeleteTask(id: string): Promise<Task>; // Soft delete (set deleted_at)
  restoreTask(id: string): Promise<Task>; // Restore soft-deleted task
  reorderTasks(updates: { id: string; listId: string; position: number }[]): Promise<void>;

  // Task Labels
  getTaskLabels(boardId: string): Promise<TaskLabel[]>;
  getTaskLabel(id: string): Promise<TaskLabel | undefined>;
  createTaskLabel(label: InsertTaskLabel): Promise<TaskLabel>;
  updateTaskLabel(id: string, data: Partial<InsertTaskLabel>): Promise<TaskLabel>;
  deleteTaskLabel(id: string): Promise<void>; // Hard delete

  // Task Label Assignments
  assignLabelToTask(assignment: InsertTaskLabelAssignment): Promise<TaskLabelAssignment>;
  removeLabelFromTask(taskId: string, labelId: string): Promise<void>;
  getTaskLabelsForTask(taskId: string): Promise<TaskLabel[]>;

  // Task Comments
  getTaskComments(taskId: string, includeDeleted?: boolean): Promise<TaskComment[]>;
  getTaskComment(id: string): Promise<TaskComment | undefined>;
  createTaskComment(comment: InsertTaskComment): Promise<TaskComment>;
  updateTaskComment(id: string, data: Partial<InsertTaskComment>): Promise<TaskComment>;
  deleteTaskComment(id: string): Promise<void>; // Hard delete
  softDeleteTaskComment(id: string): Promise<TaskComment>; // Soft delete

  // Task Attachments
  getTaskAttachments(taskId: string, includeDeleted?: boolean): Promise<TaskAttachment[]>;
  getTaskAttachment(id: string): Promise<TaskAttachment | undefined>;
  createTaskAttachment(attachment: InsertTaskAttachment): Promise<TaskAttachment>;
  deleteTaskAttachment(id: string): Promise<void>; // Hard delete
  softDeleteTaskAttachment(id: string): Promise<TaskAttachment>; // Soft delete
}
```

---

## Step 3: Implement Storage Methods

Add these implementations to the `Storage` class (after existing methods):

```typescript
// ==================== TASK MANAGEMENT MODULE ====================

// Task Boards
async getTaskBoards(params: {
  userId?: string;
  search?: string;
  page = 1;
  pageSize = 50;
  activeOnly = true;
}): Promise<{ data: TaskBoard[]; total: number }> {
  const { userId, search, page, pageSize, activeOnly } = params;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (userId) {
    conditions.push(eq(taskBoards.createdBy, userId));
  }
  if (search) {
    conditions.push(
      or(
        like(taskBoards.name, `%${search}%`),
        like(taskBoards.description, `%${search}%`)
      )
    );
  }
  if (activeOnly) {
    conditions.push(eq(taskBoards.active, true));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, totalResult] = await Promise.all([
    db.select()
      .from(taskBoards)
      .where(whereClause)
      .orderBy(desc(taskBoards.updatedAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() })
      .from(taskBoards)
      .where(whereClause)
  ]);

  return {
    data,
    total: totalResult[0]?.count || 0
  };
}

async getTaskBoard(id: string): Promise<TaskBoard | undefined> {
  const result = await db.select()
    .from(taskBoards)
    .where(eq(taskBoards.id, id))
    .limit(1);
  return result[0];
}

async createTaskBoard(board: InsertTaskBoard): Promise<TaskBoard> {
  const result = await db.insert(taskBoards).values(board).returning();
  return result[0];
}

async updateTaskBoard(id: string, data: Partial<InsertTaskBoard>): Promise<TaskBoard> {
  const result = await db.update(taskBoards)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(taskBoards.id, id))
    .returning();
  return result[0];
}

async deleteTaskBoard(id: string): Promise<void> {
  await db.delete(taskBoards).where(eq(taskBoards.id, id));
}

async softDeleteTaskBoard(id: string): Promise<TaskBoard> {
  return this.updateTaskBoard(id, { active: false });
}

// Task Lists
async getTaskLists(boardId: string): Promise<TaskList[]> {
  return db.select()
    .from(taskLists)
    .where(eq(taskLists.boardId, boardId))
    .orderBy(asc(taskLists.position));
}

async getTaskList(id: string): Promise<TaskList | undefined> {
  const result = await db.select()
    .from(taskLists)
    .where(eq(taskLists.id, id))
    .limit(1);
  return result[0];
}

async createTaskList(list: InsertTaskList): Promise<TaskList> {
  const result = await db.insert(taskLists).values(list).returning();
  return result[0];
}

async updateTaskList(id: string, data: Partial<InsertTaskList>): Promise<TaskList> {
  const result = await db.update(taskLists)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(taskLists.id, id))
    .returning();
  return result[0];
}

async deleteTaskList(id: string): Promise<void> {
  await db.delete(taskLists).where(eq(taskLists.id, id));
}

async reorderTaskLists(updates: { id: string; position: number }[]): Promise<void> {
  // Execute all updates in parallel for performance
  await Promise.all(
    updates.map(({ id, position }) =>
      this.updateTaskList(id, { position })
    )
  );
}

// Tasks
async getTasks(params: {
  boardId?: string;
  listId?: string;
  assignedTo?: string;
  createdBy?: string;
  status?: string;
  priority?: string;
  search?: string;
  includeDeleted = false;
  page = 1;
  pageSize = 100;
}): Promise<{ data: Task[]; total: number }> {
  const {
    boardId, listId, assignedTo, createdBy, status, priority,
    search, includeDeleted, page, pageSize
  } = params;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (boardId) conditions.push(eq(tasks.boardId, boardId));
  if (listId) conditions.push(eq(tasks.listId, listId));
  if (assignedTo) conditions.push(eq(tasks.assignedTo, assignedTo));
  if (createdBy) conditions.push(eq(tasks.createdBy, createdBy));
  if (status) conditions.push(eq(tasks.status, status));
  if (priority) conditions.push(eq(tasks.priority, priority));
  if (search) {
    conditions.push(
      or(
        like(tasks.title, `%${search}%`),
        like(tasks.description, `%${search}%`)
      )
    );
  }
  if (!includeDeleted) {
    conditions.push(sql`${tasks.deletedAt} IS NULL`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, totalResult] = await Promise.all([
    db.select()
      .from(tasks)
      .where(whereClause)
      .orderBy(asc(tasks.position))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() })
      .from(tasks)
      .where(whereClause)
  ]);

  return {
    data,
    total: totalResult[0]?.count || 0
  };
}

async getTask(id: string): Promise<Task | undefined> {
  const result = await db.select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);
  return result[0];
}

async createTask(task: InsertTask): Promise<Task> {
  const result = await db.insert(tasks).values(task).returning();
  return result[0];
}

async updateTask(id: string, data: Partial<InsertTask>): Promise<Task> {
  const result = await db.update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return result[0];
}

async deleteTask(id: string): Promise<void> {
  await db.delete(tasks).where(eq(tasks.id, id));
}

async softDeleteTask(id: string): Promise<Task> {
  return this.updateTask(id, { deletedAt: new Date() });
}

async restoreTask(id: string): Promise<Task> {
  return this.updateTask(id, { deletedAt: null });
}

async reorderTasks(updates: { id: string; listId: string; position: number }[]): Promise<void> {
  // Execute all updates in parallel for performance
  await Promise.all(
    updates.map(({ id, listId, position }) =>
      this.updateTask(id, { listId, position })
    )
  );
}

// Task Labels
async getTaskLabels(boardId: string): Promise<TaskLabel[]> {
  return db.select()
    .from(taskLabels)
    .where(eq(taskLabels.boardId, boardId))
    .orderBy(asc(taskLabels.name));
}

async getTaskLabel(id: string): Promise<TaskLabel | undefined> {
  const result = await db.select()
    .from(taskLabels)
    .where(eq(taskLabels.id, id))
    .limit(1);
  return result[0];
}

async createTaskLabel(label: InsertTaskLabel): Promise<TaskLabel> {
  const result = await db.insert(taskLabels).values(label).returning();
  return result[0];
}

async updateTaskLabel(id: string, data: Partial<InsertTaskLabel>): Promise<TaskLabel> {
  const result = await db.update(taskLabels)
    .set(data)
    .where(eq(taskLabels.id, id))
    .returning();
  return result[0];
}

async deleteTaskLabel(id: string): Promise<void> {
  await db.delete(taskLabels).where(eq(taskLabels.id, id));
}

// Task Label Assignments
async assignLabelToTask(assignment: InsertTaskLabelAssignment): Promise<TaskLabelAssignment> {
  const result = await db.insert(taskLabelAssignments)
    .values(assignment)
    .onConflictDoNothing() // Prevent duplicate assignments
    .returning();
  return result[0];
}

async removeLabelFromTask(taskId: string, labelId: string): Promise<void> {
  await db.delete(taskLabelAssignments)
    .where(
      and(
        eq(taskLabelAssignments.taskId, taskId),
        eq(taskLabelAssignments.labelId, labelId)
      )
    );
}

async getTaskLabelsForTask(taskId: string): Promise<TaskLabel[]> {
  const result = await db.select({
    id: taskLabels.id,
    boardId: taskLabels.boardId,
    name: taskLabels.name,
    color: taskLabels.color,
    createdAt: taskLabels.createdAt
  })
    .from(taskLabels)
    .innerJoin(taskLabelAssignments, eq(taskLabels.id, taskLabelAssignments.labelId))
    .where(eq(taskLabelAssignments.taskId, taskId));

  return result;
}

// Task Comments
async getTaskComments(taskId: string, includeDeleted = false): Promise<TaskComment[]> {
  const conditions = [eq(taskComments.taskId, taskId)];
  if (!includeDeleted) {
    conditions.push(sql`${taskComments.deletedAt} IS NULL`);
  }

  return db.select()
    .from(taskComments)
    .where(and(...conditions))
    .orderBy(asc(taskComments.createdAt));
}

async getTaskComment(id: string): Promise<TaskComment | undefined> {
  const result = await db.select()
    .from(taskComments)
    .where(eq(taskComments.id, id))
    .limit(1);
  return result[0];
}

async createTaskComment(comment: InsertTaskComment): Promise<TaskComment> {
  const result = await db.insert(taskComments).values(comment).returning();
  return result[0];
}

async updateTaskComment(id: string, data: Partial<InsertTaskComment>): Promise<TaskComment> {
  const result = await db.update(taskComments)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(taskComments.id, id))
    .returning();
  return result[0];
}

async deleteTaskComment(id: string): Promise<void> {
  await db.delete(taskComments).where(eq(taskComments.id, id));
}

async softDeleteTaskComment(id: string): Promise<TaskComment> {
  return this.updateTaskComment(id, { deletedAt: new Date() });
}

// Task Attachments
async getTaskAttachments(taskId: string, includeDeleted = false): Promise<TaskAttachment[]> {
  const conditions = [eq(taskAttachments.taskId, taskId)];
  if (!includeDeleted) {
    conditions.push(sql`${taskAttachments.deletedAt} IS NULL`);
  }

  return db.select()
    .from(taskAttachments)
    .where(and(...conditions))
    .orderBy(desc(taskAttachments.createdAt));
}

async getTaskAttachment(id: string): Promise<TaskAttachment | undefined> {
  const result = await db.select()
    .from(taskAttachments)
    .where(eq(taskAttachments.id, id))
    .limit(1);
  return result[0];
}

async createTaskAttachment(attachment: InsertTaskAttachment): Promise<TaskAttachment> {
  const result = await db.insert(taskAttachments).values(attachment).returning();
  return result[0];
}

async deleteTaskAttachment(id: string): Promise<void> {
  await db.delete(taskAttachments).where(eq(taskAttachments.id, id));
}

async softDeleteTaskAttachment(id: string): Promise<TaskAttachment> {
  const result = await db.update(taskAttachments)
    .set({ deletedAt: new Date() })
    .where(eq(taskAttachments.id, id))
    .returning();
  return result[0];
}
```

---

## Step 4: Export Storage Instance

The existing storage instance export at the bottom of the file will automatically include the new methods:

```typescript
export const storage = new Storage();
```

---

## Usage Examples

### Creating a Kanban Board

```typescript
import { storage } from './server/core/storage';

// Create board
const board = await storage.createTaskBoard({
  name: 'Product Launch Q4 2025',
  description: 'Coordinating product launch activities',
  createdBy: 'auth0|user-123'
});

// Create lists
const todoList = await storage.createTaskList({
  boardId: board.id,
  name: 'À faire',
  position: 1.0,
  color: '#3B82F6'
});

const inProgressList = await storage.createTaskList({
  boardId: board.id,
  name: 'En cours',
  position: 2.0,
  color: '#F59E0B'
});

// Create task
const task = await storage.createTask({
  boardId: board.id,
  listId: todoList.id,
  title: 'Préparer le matériel marketing',
  description: '<p>Créer les <strong>affiches</strong></p>',
  position: 1.0,
  priority: 'high',
  assignedTo: 'auth0|designer-456',
  createdBy: 'auth0|user-123',
  dueDate: new Date('2025-10-15')
});
```

### Querying Tasks

```typescript
// Get all tasks for a user
const myTasks = await storage.getTasks({
  assignedTo: 'auth0|user-123',
  includeDeleted: false,
  page: 1,
  pageSize: 50
});

// Get tasks by status
const inProgressTasks = await storage.getTasks({
  boardId: board.id,
  status: 'in_progress'
});

// Search tasks
const searchResults = await storage.getTasks({
  boardId: board.id,
  search: 'marketing',
  page: 1,
  pageSize: 20
});
```

### Managing Labels

```typescript
// Create labels
const marketingLabel = await storage.createTaskLabel({
  boardId: board.id,
  name: 'Marketing',
  color: '#EC4899'
});

// Assign label to task
await storage.assignLabelToTask({
  taskId: task.id,
  labelId: marketingLabel.id
});

// Get all labels for a task
const taskLabels = await storage.getTaskLabelsForTask(task.id);
```

### Comments and Attachments

```typescript
// Add comment
const comment = await storage.createTaskComment({
  taskId: task.id,
  content: '<p>Excellent travail!</p>',
  authorId: 'auth0|user-123'
});

// Add attachment
const attachment = await storage.createTaskAttachment({
  taskId: task.id,
  fileName: 'a3f7d2e9.pdf',
  originalName: 'Report.pdf',
  mimeType: 'application/pdf',
  fileSize: 2048576,
  storagePath: '/var/www/facnet/app/uploads/tasks/a3f7d2e9.pdf',
  uploadedBy: 'auth0|user-123'
});
```

### Drag-and-Drop Reordering

```typescript
// Reorder lists (change kanban column order)
await storage.reorderTaskLists([
  { id: todoList.id, position: 1.0 },
  { id: doneList.id, position: 2.0 },
  { id: inProgressList.id, position: 3.0 }
]);

// Move task between lists (drag-and-drop)
await storage.reorderTasks([
  {
    id: task.id,
    listId: inProgressList.id, // Move to "En cours"
    position: 1.5 // Position between tasks 1.0 and 2.0
  }
]);
```

---

## Testing the Implementation

```typescript
// Test file: tests/integration/task-storage.test.ts
import { storage } from '../../server/core/storage';

describe('Task Storage', () => {
  let boardId: string;

  beforeAll(async () => {
    const board = await storage.createTaskBoard({
      name: 'Test Board',
      createdBy: 'auth0|test-user'
    });
    boardId = board.id;
  });

  afterAll(async () => {
    await storage.deleteTaskBoard(boardId);
  });

  it('should create and retrieve board', async () => {
    const board = await storage.getTaskBoard(boardId);
    expect(board).toBeDefined();
    expect(board?.name).toBe('Test Board');
  });

  it('should create task list', async () => {
    const list = await storage.createTaskList({
      boardId,
      name: 'To Do',
      position: 1.0
    });
    expect(list.boardId).toBe(boardId);
  });

  // Add more tests...
});
```

---

## Performance Optimization Tips

1. **Use Batch Operations**: For bulk operations, use Promise.all()
2. **Index Usage**: Queries automatically use indexes created in migration
3. **Pagination**: Always paginate task lists to avoid loading thousands of tasks
4. **Soft Deletes**: Use soft deletes for tasks/comments to maintain audit trail
5. **Fractional Positioning**: Use fractional positions (1.0, 1.5, 2.0) to avoid reordering entire lists

---

## Next Steps

1. Apply migration: `psql -U dashvalidator_user -d dashvalidator < migrations/add_task_module.sql`
2. Add storage methods to `server/core/storage.ts`
3. Run TypeScript compiler: `npm run check`
4. Create API routes in `server/routes.ts`
5. Build frontend components for task management
6. Test in staging environment
7. Deploy to production

---

**Implementation Status**: Ready for integration
**Files Modified**:
- `server/core/storage.ts` (add methods shown above)
- `shared/schema.ts` (already updated)

**Files Created**:
- `migrations/add_task_module.sql` (migration script)
- `migrations/TASK_MODULE_TESTING.md` (testing guide)
- `migrations/TASK_STORAGE_IMPLEMENTATION.md` (this file)
