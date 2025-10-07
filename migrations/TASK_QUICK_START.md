# Task Module - Quick Start Guide

**TL;DR**: Complete production-ready task management schema. Apply migration, add storage methods, build API routes, create frontend.

---

## 1. Apply Database Migration (5 minutes)

```bash
# Backup database first
pg_dump -h localhost -U dashvalidator_user dashvalidator > backup_$(date +%Y%m%d_%H%M%S).sql

# Apply migration
PGPASSWORD=DashValidator2024 psql -h localhost -U dashvalidator_user -d dashvalidator < migrations/add_task_module.sql

# Verify (should show 7 tables)
PGPASSWORD=DashValidator2024 psql -h localhost -U dashvalidator_user -d dashvalidator -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'task_%' ORDER BY table_name;"

# Expected output:
# task_attachments
# task_boards
# task_comments
# task_label_assignments
# task_labels
# task_lists
# tasks
```

---

## 2. Test Schema (5 minutes)

```bash
# Connect to database
PGPASSWORD=DashValidator2024 psql -h localhost -U dashvalidator_user -d dashvalidator

# Create test board
INSERT INTO task_boards (name, created_by) VALUES ('Test Board', 'auth0|test-user') RETURNING id;

# Create test list (replace BOARD_ID with ID from above)
INSERT INTO task_lists (board_id, name, position) VALUES ('BOARD_ID', 'To Do', 1.0) RETURNING id;

# Create test task (replace BOARD_ID and LIST_ID)
INSERT INTO tasks (board_id, list_id, title, position, created_by) VALUES ('BOARD_ID', 'LIST_ID', 'Test Task', 1.0, 'auth0|test-user') RETURNING id;

# Verify data
SELECT * FROM task_boards;
SELECT * FROM task_lists;
SELECT * FROM tasks;

# Cleanup
DELETE FROM task_boards WHERE name = 'Test Board';
```

---

## 3. Add TypeScript Types (Already Done)

Schema file `c:\Users\monti\Projects\facnet-validator\shared\schema.ts` already updated with:
- 7 table definitions (taskBoards, taskLists, tasks, etc.)
- 2 enums (task_status, task_priority)
- Insert/Select schemas
- TypeScript types

Verify: `npm run check` (schema compiles successfully)

---

## 4. Implement Storage Layer (30 minutes)

**File**: `c:\Users\monti\Projects\facnet-validator\server\core\storage.ts`

**See**: `migrations/TASK_STORAGE_IMPLEMENTATION.md` for complete code

**Quick Implementation**:
1. Add imports (line ~3):
   ```typescript
   taskBoards, taskLists, tasks, taskLabels, taskLabelAssignments,
   taskComments, taskAttachments,
   type TaskBoard, type InsertTaskBoard, // ... etc
   ```

2. Add interface methods (line ~23):
   ```typescript
   // Task Boards
   getTaskBoards(params: { ... }): Promise<{ data: TaskBoard[]; total: number }>;
   getTaskBoard(id: string): Promise<TaskBoard | undefined>;
   createTaskBoard(board: InsertTaskBoard): Promise<TaskBoard>;
   // ... etc (see TASK_STORAGE_IMPLEMENTATION.md for full list)
   ```

3. Add method implementations (after existing methods):
   - Copy all methods from TASK_STORAGE_IMPLEMENTATION.md
   - 30+ methods total (boards, lists, tasks, labels, comments, attachments)

4. Verify: `npm run check` (no errors)

---

## 5. Create API Routes (1 hour)

**File**: `c:\Users\monti\Projects\facnet-validator\server\routes.ts`

**Add these endpoints**:

```typescript
// Task Boards
app.get('/api/tasks/boards', authenticateJWT, requireEditor, async (req, res) => {
  const userId = req.user.role === 'admin' ? undefined : req.user.id;
  const boards = await storage.getTaskBoards({ userId, activeOnly: true });
  res.json(boards);
});

app.post('/api/tasks/boards', authenticateJWT, requireEditor, async (req, res) => {
  const board = await storage.createTaskBoard({
    ...req.body,
    createdBy: req.user.id
  });
  res.status(201).json(board);
});

app.get('/api/tasks/boards/:id', authenticateJWT, requireEditor, async (req, res) => {
  const board = await storage.getTaskBoard(req.params.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  // Check ownership (unless admin)
  if (req.user.role !== 'admin' && board.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.json(board);
});

// Task Lists
app.get('/api/tasks/boards/:boardId/lists', authenticateJWT, requireEditor, async (req, res) => {
  const lists = await storage.getTaskLists(req.params.boardId);
  res.json(lists);
});

app.post('/api/tasks/boards/:boardId/lists', authenticateJWT, requireEditor, async (req, res) => {
  const list = await storage.createTaskList({
    ...req.body,
    boardId: req.params.boardId
  });
  res.status(201).json(list);
});

// Tasks
app.get('/api/tasks/boards/:boardId/tasks', authenticateJWT, requireEditor, async (req, res) => {
  const tasks = await storage.getTasks({
    boardId: req.params.boardId,
    includeDeleted: false
  });
  res.json(tasks);
});

app.post('/api/tasks/boards/:boardId/tasks', authenticateJWT, requireEditor, async (req, res) => {
  const task = await storage.createTask({
    ...req.body,
    boardId: req.params.boardId,
    createdBy: req.user.id
  });
  res.status(201).json(task);
});

// Add more routes for comments, attachments, labels, etc.
// See full endpoint list in TASK_MODULE_SUMMARY.md
```

---

## 6. Build Frontend (4-8 hours)

**Pages**:
- `client/src/pages/Tasks.tsx` - Board list
- `client/src/pages/TaskBoard.tsx` - Kanban board

**Components**:
- `client/src/components/tasks/BoardCard.tsx`
- `client/src/components/tasks/TaskList.tsx`
- `client/src/components/tasks/TaskCard.tsx`
- `client/src/components/tasks/TaskModal.tsx`

**Libraries to add**:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities  # Drag-and-drop
npm install @tiptap/react @tiptap/starter-kit  # Rich text editor
npm install dompurify @types/dompurify  # HTML sanitization
```

**Example Kanban Board Component**:
```tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function TaskBoard({ boardId }: { boardId: string }) {
  const { data: lists } = useQuery({
    queryKey: ['task-lists', boardId],
    queryFn: () => api.get(`/api/tasks/boards/${boardId}/lists`)
  });

  const { data: tasks } = useQuery({
    queryKey: ['tasks', boardId],
    queryFn: () => api.get(`/api/tasks/boards/${boardId}/tasks`)
  });

  return (
    <div className="flex gap-4 p-4 overflow-x-auto">
      {lists?.map(list => (
        <TaskList key={list.id} list={list} tasks={tasks?.data.filter(t => t.listId === list.id)} />
      ))}
    </div>
  );
}
```

---

## 7. Deploy (15 minutes)

**Staging**:
```bash
# SSH to server
ssh ubuntu@148.113.196.245

# Navigate to staging
cd /var/www/facnet/staging

# Pull latest code
sudo -u facnet git pull origin feature/task-module

# Apply migration
PGPASSWORD=DashValidator2024 psql -h localhost -U dashvalidator_user -d dashvalidator_staging < migrations/add_task_module.sql

# Rebuild and restart
sudo -u facnet npm install
sudo -u facnet npm run build
sudo -u facnet pm2 restart facnet-validator-staging

# Test
curl -k https://148.113.196.245:3001/api/health
```

**Production**:
```bash
# Merge to main (triggers GitHub Actions)
git checkout main
git merge feature/task-module
git push origin main

# Monitor deployment
# https://github.com/montignypatrik/facnet-validator/actions

# Verify production
curl -k https://148.113.196.245/api/health
```

---

## Files Reference

| File | Purpose | Size |
|------|---------|------|
| `shared/schema.ts` | Drizzle ORM definitions (lines 244-407) | Modified |
| `migrations/add_task_module.sql` | SQL migration script | 13KB |
| `migrations/TASK_MODULE_TESTING.md` | Testing guide | 15KB |
| `migrations/TASK_STORAGE_IMPLEMENTATION.md` | Storage code | 21KB |
| `migrations/TASK_MODULE_SUMMARY.md` | Complete documentation | 14KB |
| `migrations/TASK_QUICK_START.md` | This file | 8KB |

---

## Database Schema Overview

```
task_boards (projects/workspaces)
  ├── task_lists (kanban columns)
  │     └── tasks (individual cards)
  │           ├── task_comments (discussions)
  │           ├── task_attachments (files)
  │           └── task_label_assignments
  │                 └── task_labels (tags)
```

**Key Features**:
- UUID primary keys
- Fractional positioning (1.0, 1.5, 2.0)
- Soft deletes (deleted_at timestamps)
- CASCADE deletes
- 24+ performance indexes
- NO foreign keys to PHI tables

---

## Quick Commands

```bash
# Check schema compiles
npm run check

# Apply migration
PGPASSWORD=DashValidator2024 psql -h localhost -U dashvalidator_user -d dashvalidator < migrations/add_task_module.sql

# Verify tables
PGPASSWORD=DashValidator2024 psql -h localhost -U dashvalidator_user -d dashvalidator -c "\dt task_*"

# Verify indexes
PGPASSWORD=DashValidator2024 psql -h localhost -U dashvalidator_user -d dashvalidator -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_task_%';"

# Rollback (if needed)
PGPASSWORD=DashValidator2024 psql -h localhost -U dashvalidator_user -d dashvalidator -c "DROP TABLE IF EXISTS task_attachments, task_comments, task_label_assignments, task_labels, tasks, task_lists, task_boards CASCADE;"
```

---

## Next Steps

1. **Now**: Apply migration to staging
2. **Today**: Implement storage methods
3. **This week**: Build API routes and frontend
4. **Next week**: Deploy to production

---

## Need Help?

- **Testing**: See `migrations/TASK_MODULE_TESTING.md`
- **Storage**: See `migrations/TASK_STORAGE_IMPLEMENTATION.md`
- **Overview**: See `migrations/TASK_MODULE_SUMMARY.md`

---

**Status**: Production-Ready Schema
**Total Time**: ~8-12 hours for full implementation
**Next Action**: Apply migration to staging database
