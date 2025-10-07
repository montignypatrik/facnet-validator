# Task Module Storage Methods

## Instructions

Add these methods to `server/core/storage.ts`:

### 1. Update Imports (line 3-17)

Add to the imports:
```typescript
import {
  // ... existing imports
  taskBoards, taskLists, tasks, taskLabels, taskLabelAssignments, taskComments, taskAttachments,
  type TaskBoard, type InsertTaskBoard,
  type TaskList, type InsertTaskList,
  type Task, type InsertTask,
  type TaskLabel, type InsertTaskLabel,
  type TaskComment, type InsertTaskComment,
  type TaskAttachment, type InsertTaskAttachment,
} from "../../shared/schema.js";
```

### 2. Update IStorage Interface (line 20-100)

Add these method signatures:
```typescript
export interface IStorage {
  // ... existing methods

  // Task Boards
  getTaskBoards(userId: string): Promise<TaskBoard[]>;
  getTaskBoard(id: string): Promise<TaskBoard | undefined>;
  createTaskBoard(board: InsertTaskBoard): Promise<TaskBoard>;
  updateTaskBoard(id: string, data: Partial<InsertTaskBoard>): Promise<TaskBoard>;
  deleteTaskBoard(id: string): Promise<void>;

  // Task Lists
  getTaskLists(boardId: string): Promise<TaskList[]>;
  getTaskList(id: string): Promise<TaskList | undefined>;
  createTaskList(list: InsertTaskList): Promise<TaskList>;
  updateTaskList(id: string, data: Partial<InsertTaskList>): Promise<TaskList>;
  deleteTaskList(id: string): Promise<void>;

  // Tasks
  getTasks(listId: string): Promise<Task[]>;
  getTasksByBoard(boardId: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: string): Promise<void>; // Soft delete

  // Task Labels
  getTaskLabels(boardId: string): Promise<TaskLabel[]>;
  getTaskLabel(id: string): Promise<TaskLabel | undefined>;
  createTaskLabel(label: InsertTaskLabel): Promise<TaskLabel>;
  updateTaskLabel(id: string, data: Partial<InsertTaskLabel>): Promise<TaskLabel>;
  deleteTaskLabel(id: string): Promise<void>;

  // Task Label Assignments
  assignLabel(taskId: string, labelId: string): Promise<void>;
  unassignLabel(taskId: string, labelId: string): Promise<void>;
  getTaskLabelAssignments(taskId: string): Promise<TaskLabel[]>;

  // Task Comments
  getTaskComments(taskId: string): Promise<TaskComment[]>;
  getTaskComment(id: string): Promise<TaskComment | undefined>;
  createTaskComment(comment: InsertTaskComment): Promise<TaskComment>;
  updateTaskComment(id: string, data: Partial<InsertTaskComment>): Promise<TaskComment>;
  deleteTaskComment(id: string): Promise<void>; // Soft delete

  // Task Attachments
  getTaskAttachments(taskId: string): Promise<TaskAttachment[]>;
  getTaskAttachment(id: string): Promise<TaskAttachment | undefined>;
  createTaskAttachment(attachment: InsertTaskAttachment): Promise<TaskAttachment>;
  deleteTaskAttachment(id: string): Promise<void>; // Soft delete
}
```

### 3. Add Implementation Methods (add to DatabaseStorage class)

```typescript
export class DatabaseStorage implements IStorage {
  // ... existing methods

  // ==================== TASK BOARDS ====================

  async getTaskBoards(userId: string): Promise<TaskBoard[]> {
    return await db
      .select()
      .from(taskBoards)
      .where(and(
        eq(taskBoards.createdBy, userId),
        eq(taskBoards.active, true)
      ))
      .orderBy(desc(taskBoards.createdAt));
  }

  async getTaskBoard(id: string): Promise<TaskBoard | undefined> {
    const [board] = await db
      .select()
      .from(taskBoards)
      .where(and(
        eq(taskBoards.id, id),
        eq(taskBoards.active, true)
      ));
    return board || undefined;
  }

  async createTaskBoard(board: InsertTaskBoard): Promise<TaskBoard> {
    const [created] = await db
      .insert(taskBoards)
      .values(board)
      .returning();
    return created;
  }

  async updateTaskBoard(id: string, data: Partial<InsertTaskBoard>): Promise<TaskBoard> {
    const [updated] = await db
      .update(taskBoards)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(taskBoards.id, id))
      .returning();
    return updated;
  }

  async deleteTaskBoard(id: string): Promise<void> {
    // Soft delete - set active = false
    await db
      .update(taskBoards)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(taskBoards.id, id));
  }

  // ==================== TASK LISTS ====================

  async getTaskLists(boardId: string): Promise<TaskList[]> {
    return await db
      .select()
      .from(taskLists)
      .where(eq(taskLists.boardId, boardId))
      .orderBy(asc(taskLists.position));
  }

  async getTaskList(id: string): Promise<TaskList | undefined> {
    const [list] = await db
      .select()
      .from(taskLists)
      .where(eq(taskLists.id, id));
    return list || undefined;
  }

  async createTaskList(list: InsertTaskList): Promise<TaskList> {
    const [created] = await db
      .insert(taskLists)
      .values(list)
      .returning();
    return created;
  }

  async updateTaskList(id: string, data: Partial<InsertTaskList>): Promise<TaskList> {
    const [updated] = await db
      .update(taskLists)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(taskLists.id, id))
      .returning();
    return updated;
  }

  async deleteTaskList(id: string): Promise<void> {
    // Hard delete (CASCADE will delete related tasks)
    await db
      .delete(taskLists)
      .where(eq(taskLists.id, id));
  }

  // ==================== TASKS ====================

  async getTasks(listId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.listId, listId),
        sql`${tasks.deletedAt} IS NULL`
      ))
      .orderBy(asc(tasks.position));
  }

  async getTasksByBoard(boardId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.boardId, boardId),
        sql`${tasks.deletedAt} IS NULL`
      ))
      .orderBy(asc(tasks.position));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.id, id),
        sql`${tasks.deletedAt} IS NULL`
      ));
    return task || undefined;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [created] = await db
      .insert(tasks)
      .values(task)
      .returning();
    return created;
  }

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task> {
    const [updated] = await db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    // Soft delete
    await db
      .update(tasks)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(tasks.id, id));
  }

  // ==================== TASK LABELS ====================

  async getTaskLabels(boardId: string): Promise<TaskLabel[]> {
    return await db
      .select()
      .from(taskLabels)
      .where(eq(taskLabels.boardId, boardId))
      .orderBy(asc(taskLabels.name));
  }

  async getTaskLabel(id: string): Promise<TaskLabel | undefined> {
    const [label] = await db
      .select()
      .from(taskLabels)
      .where(eq(taskLabels.id, id));
    return label || undefined;
  }

  async createTaskLabel(label: InsertTaskLabel): Promise<TaskLabel> {
    const [created] = await db
      .insert(taskLabels)
      .values(label)
      .returning();
    return created;
  }

  async updateTaskLabel(id: string, data: Partial<InsertTaskLabel>): Promise<TaskLabel> {
    const [updated] = await db
      .update(taskLabels)
      .set(data)
      .where(eq(taskLabels.id, id))
      .returning();
    return updated;
  }

  async deleteTaskLabel(id: string): Promise<void> {
    // Hard delete (CASCADE will delete assignments)
    await db
      .delete(taskLabels)
      .where(eq(taskLabels.id, id));
  }

  // ==================== TASK LABEL ASSIGNMENTS ====================

  async assignLabel(taskId: string, labelId: string): Promise<void> {
    await db
      .insert(taskLabelAssignments)
      .values({ taskId, labelId })
      .onConflictDoNothing(); // Prevent duplicate assignments
  }

  async unassignLabel(taskId: string, labelId: string): Promise<void> {
    await db
      .delete(taskLabelAssignments)
      .where(and(
        eq(taskLabelAssignments.taskId, taskId),
        eq(taskLabelAssignments.labelId, labelId)
      ));
  }

  async getTaskLabelAssignments(taskId: string): Promise<TaskLabel[]> {
    // Join to get full label details
    const assignments = await db
      .select({
        id: taskLabels.id,
        boardId: taskLabels.boardId,
        name: taskLabels.name,
        color: taskLabels.color,
        createdAt: taskLabels.createdAt,
      })
      .from(taskLabelAssignments)
      .innerJoin(taskLabels, eq(taskLabelAssignments.labelId, taskLabels.id))
      .where(eq(taskLabelAssignments.taskId, taskId));

    return assignments;
  }

  // ==================== TASK COMMENTS ====================

  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    return await db
      .select()
      .from(taskComments)
      .where(and(
        eq(taskComments.taskId, taskId),
        sql`${taskComments.deletedAt} IS NULL`
      ))
      .orderBy(asc(taskComments.createdAt));
  }

  async getTaskComment(id: string): Promise<TaskComment | undefined> {
    const [comment] = await db
      .select()
      .from(taskComments)
      .where(and(
        eq(taskComments.id, id),
        sql`${taskComments.deletedAt} IS NULL`
      ));
    return comment || undefined;
  }

  async createTaskComment(comment: InsertTaskComment): Promise<TaskComment> {
    const [created] = await db
      .insert(taskComments)
      .values(comment)
      .returning();
    return created;
  }

  async updateTaskComment(id: string, data: Partial<InsertTaskComment>): Promise<TaskComment> {
    const [updated] = await db
      .update(taskComments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(taskComments.id, id))
      .returning();
    return updated;
  }

  async deleteTaskComment(id: string): Promise<void> {
    // Soft delete
    await db
      .update(taskComments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(taskComments.id, id));
  }

  // ==================== TASK ATTACHMENTS ====================

  async getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
    return await db
      .select()
      .from(taskAttachments)
      .where(and(
        eq(taskAttachments.taskId, taskId),
        sql`${taskAttachments.deletedAt} IS NULL`
      ))
      .orderBy(desc(taskAttachments.createdAt));
  }

  async getTaskAttachment(id: string): Promise<TaskAttachment | undefined> {
    const [attachment] = await db
      .select()
      .from(taskAttachments)
      .where(and(
        eq(taskAttachments.id, id),
        sql`${taskAttachments.deletedAt} IS NULL`
      ));
    return attachment || undefined;
  }

  async createTaskAttachment(attachment: InsertTaskAttachment): Promise<TaskAttachment> {
    const [created] = await db
      .insert(taskAttachments)
      .values(attachment)
      .returning();
    return created;
  }

  async deleteTaskAttachment(id: string): Promise<void> {
    // Soft delete
    await db
      .update(taskAttachments)
      .set({ deletedAt: new Date() })
      .where(eq(taskAttachments.id, id));
  }
}
```

### 4. Export storage instance (already exists, no changes needed)

The existing `storage` export will automatically include these new methods.

## Testing

After adding these methods, test with:

```typescript
// Test board creation
const board = await storage.createTaskBoard({
  name: "My First Board",
  description: "Test board",
  createdBy: "auth0|test123"
});

// Test list creation
const list = await storage.createTaskList({
  boardId: board.id,
  name: "To Do",
  position: 65536
});

// Test task creation
const task = await storage.createTask({
  boardId: board.id,
  listId: list.id,
  title: "My first task",
  description: "<p>Hello world</p>",
  createdBy: "auth0|test123",
  status: "todo",
  priority: "medium"
});

console.log("Task created:", task);
```
