# Task Management Module - Current Status & Next Steps

**Date:** 2025-10-07
**Branch:** `feature/task-management-module`
**Status:** Phase 3 (Backend) - 70% Complete

---

## ✅ What's Been Completed

### Phase 1: Research & Analysis (100% Complete)

**Ultrathink Decision Analysis**
- Evaluated 3 integration approaches (fork, selective import, ground-up)
- **Selected**: Ground-up build using Planka patterns
- **Rationale**: Best architectural fit, minimal tech debt, full control

**Planka Architecture Research**
- 30+ page technical analysis of database schema, API patterns, real-time features
- Identified reusable patterns for Dash platform
- Document: `migrations/TASK_MODULE_SUMMARY.md`

**Security Audit**
- 23 security recommendations (6 critical, 9 high priority)
- PHI isolation requirements verified
- Document: Security audit in integration strategy

**Integration Strategy**
- 240-hour development roadmap (12 weeks)
- Complete feature scope and technology decisions
- Document: `docs/TASK_MODULE_INTEGRATION_STRATEGY.md`

### Phase 2: Database Schema (100% Complete)

**Created 7 Database Tables:**
```sql
task_boards             -- Workspaces/projects
task_lists              -- Kanban columns
tasks                   -- Individual cards
task_labels             -- Tags/categories
task_label_assignments  -- Many-to-many join
task_comments           -- Discussions
task_attachments        -- File uploads
```

**Performance Optimization:**
- 24+ indexes for kanban queries
- Fractional positioning (double precision)
- Denormalized board_id on tasks
- Full-text search ready (pg_trgm)

**Security:**
- ✅ PHI isolation verified (NO FK to validation_runs/billing_records)
- ✅ Soft deletes for tasks/comments/attachments
- ✅ CASCADE deletes for referential integrity

**Files:**
- `shared/schema.ts` - Drizzle ORM table definitions
- `migrations/add_task_module.sql` - PostgreSQL migration (ready to apply)
- `migrations/TASK_MODULE_TESTING.md` - Comprehensive testing guide
- `migrations/TASK_STORAGE_IMPLEMENTATION.md` - Storage layer code examples

### Phase 3: Backend Security & API (70% Complete)

#### ✅ Completed: Security Infrastructure

**1. Rate Limiting** (`server/middleware/rateLimiter.ts`)
- apiLimiter: 100 req/15min (general)
- authLimiter: 5 req/15min (authentication)
- uploadLimiter: 10 uploads/hour (files)
- taskCreationLimiter: 50 tasks/hour
- commentLimiter: 30 comments/15min
- boardCreationLimiter: 10 boards/day

**2. XSS Sanitization** (`server/modules/tasks/sanitization.ts`)
- DOMPurify integration for HTML sanitization
- Whitelist approach (only safe tags)
- Blocks scripts, event handlers, iframes
- Functions: sanitizeHtml(), sanitizePlainText(), sanitizeTaskData()

**3. Secure File Uploads** (`server/modules/tasks/fileUpload.ts`)
- MIME validation (whitelist: PDF, DOC, XLS, images, ZIP)
- Extension validation (prevent MIME spoofing)
- 10MB file size limit
- Secure random filenames (crypto.randomBytes)
- Storage outside app root (`/uploads/tasks`)
- Virus scanning placeholder (TODO for production)

**4. Ownership Middleware** (`server/modules/tasks/middleware.ts`)
- 6 ownership checkers (board, task, comment, attachment, label, list)
- Reuses existing requireOwnership pattern
- Admin access with audit logging
- Middleware exports: requireBoardOwnership, requireTaskOwnership, etc.

**Security Packages Installed:**
```bash
✅ express-rate-limit
✅ dompurify + isomorphic-dompurify
✅ helmet
✅ @types/dompurify
```

#### ⏳ In Progress: Storage & Routes

**Storage Methods** (document created, needs implementation)
- File: `server/modules/tasks/STORAGE_METHODS.md`
- Contains complete Drizzle ORM methods for all tables
- Ready to copy into `server/core/storage.ts`
- Includes interface updates and implementation code

**API Routes** (TODO)
- File to create: `server/modules/tasks/routes.ts`
- RESTful endpoints for boards, lists, tasks, labels, comments, attachments
- Integrated with Auth0 authentication
- Protected with rate limiting and ownership middleware

---

## 🚧 What's Remaining

### Phase 3: Backend (Remaining 30%)

**Priority 1: Add Storage Methods to server/core/storage.ts**
1. Open `server/core/storage.ts`
2. Follow instructions in `server/modules/tasks/STORAGE_METHODS.md`
3. Add imports (task tables and types)
4. Update IStorage interface (method signatures)
5. Add implementation methods to DatabaseStorage class
6. Test with sample data

**Priority 2: Create API Routes** (`server/modules/tasks/routes.ts`)

Structure:
```typescript
import { Router } from "express";
import { authenticateToken, requireRole } from "../../core/auth";
import { z } from "zod";
import {
  requireBoardOwnership,
  requireTaskOwnership,
  requireCommentOwnership,
  requireAttachmentOwnership,
  requireLabelOwnership,
  requireListOwnership,
} from "./middleware";
import {
  boardCreationLimiter,
  taskCreationLimiter,
  commentLimiter,
  uploadLimiter,
} from "../../middleware/rateLimiter";
import {
  sanitizeTaskBoardData,
  sanitizeTaskData,
  sanitizeCommentData,
  sanitizeLabelData,
} from "./sanitization";
import { taskAttachmentUpload, deleteUploadedFile, scanFileForVirus } from "./fileUpload";
import { storage } from "../../core/storage";

const router = Router();

// ==================== BOARD ROUTES ====================
// GET    /api/tasks/boards            - List user's boards
// POST   /api/tasks/boards            - Create board
// GET    /api/tasks/boards/:id        - Get board details
// PATCH  /api/tasks/boards/:id        - Update board
// DELETE /api/tasks/boards/:id        - Delete board (admin only)

// ==================== LIST ROUTES ====================
// GET    /api/tasks/boards/:boardId/lists     - List board's lists
// POST   /api/tasks/boards/:boardId/lists     - Create list
// PATCH  /api/tasks/lists/:id                 - Update list
// DELETE /api/tasks/lists/:id                 - Delete list

// ==================== TASK ROUTES ====================
// GET    /api/tasks/lists/:listId/tasks       - List tasks in list
// GET    /api/tasks/boards/:boardId/tasks     - List all tasks in board
// GET    /api/tasks/:id                       - Get task details
// POST   /api/tasks/lists/:listId/tasks       - Create task
// PATCH  /api/tasks/:id                       - Update task
// DELETE /api/tasks/:id                       - Delete task (soft)

// ==================== LABEL ROUTES ====================
// GET    /api/tasks/boards/:boardId/labels    - List board labels
// POST   /api/tasks/boards/:boardId/labels    - Create label
// PATCH  /api/tasks/labels/:id                - Update label
// DELETE /api/tasks/labels/:id                - Delete label
// POST   /api/tasks/:taskId/labels/:labelId   - Assign label
// DELETE /api/tasks/:taskId/labels/:labelId   - Unassign label

// ==================== COMMENT ROUTES ====================
// GET    /api/tasks/:taskId/comments          - List comments
// POST   /api/tasks/:taskId/comments          - Create comment
// PATCH  /api/tasks/comments/:id              - Update comment
// DELETE /api/tasks/comments/:id              - Delete comment (soft)

// ==================== ATTACHMENT ROUTES ====================
// GET    /api/tasks/:taskId/attachments               - List attachments
// POST   /api/tasks/:taskId/attachments               - Upload attachment
// GET    /api/tasks/attachments/:id/download          - Download file
// DELETE /api/tasks/attachments/:id                   - Delete attachment (soft)

export default router;
```

**Priority 3: Update server/index.ts**

Add Helmet CSP and integrate task routes:
```typescript
import helmet from 'helmet';
import { apiLimiter } from './middleware/rateLimiter';
import taskRoutes from './modules/tasks/routes';

// Add Helmet CSP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // For Vite
      styleSrc: ["'self'", "'unsafe-inline'"], // For Tailwind
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://dev-x63i3b6hf5kch7ab.ca.auth0.com"],
    }
  }
}));

// Add rate limiting
app.use('/api/', apiLimiter);

// Add task routes
app.use('/api/tasks', taskRoutes);
```

**Priority 4: Apply Database Migration**

```bash
# Connect to staging database
PGPASSWORD=DashValidator2024 psql -h localhost -U dashvalidator_user -d dashvalidator_staging

# Apply migration
\i migrations/add_task_module.sql

# Verify tables created
\dt task*

# Test with sample data (see TASK_MODULE_TESTING.md)
```

### Phase 4: React Frontend (100% TODO)

**Priority 1: Install Dependencies**
```bash
cd client
npm install @hello-pangea/dnd @tiptap/react @tiptap/starter-kit
```

**Priority 2: Create Task Pages** (`client/src/pages/Tasks.tsx`)
- Board list view (grid of boards)
- Kanban board view (lists + tasks)
- Task detail modal (Radix Dialog)

**Priority 3: Create Task Components** (`client/src/components/tasks/`)
- Board.tsx - Main kanban board
- List.tsx - Kanban column
- Card.tsx - Task card
- TaskModal.tsx - Task details modal
- CommentList.tsx - Comments section
- AttachmentList.tsx - File attachments

**Priority 4: Integrate Sidebar Navigation**

Update `client/src/components/AppLayout.tsx`:
```typescript
const navigationItems = [
  { href: "/", icon: Home, label: "Tableau de Bord" },
  { href: "/validator", icon: FileCheck, label: "Validateur" },
  { href: "/tasks", icon: CheckSquare, label: "Tâches" }, // ← Add this
  { href: "/codes", icon: Code, label: "Codes" },
  // ... rest
];
```

**Priority 5: French Translations**

All UI text in French:
- "Tableaux" (Boards)
- "Liste" (List)
- "Tâche" (Task)
- "Étiquette" (Label)
- "Date d'échéance" (Due Date)
- "Pièces jointes" (Attachments)
- "Commentaires" (Comments)

### Phase 5: Testing & Deployment (100% TODO)

**Priority 1: Unit Tests**
```bash
# Create test files
tests/unit/tasks/boards.test.ts
tests/unit/tasks/tasks.test.ts
tests/security/xss.test.ts
tests/security/fileUpload.test.ts
```

**Priority 2: Integration Tests**
- Full workflow testing (create board → list → task → comment → attachment)
- Security tests (XSS, file upload, rate limiting)
- Ownership tests (unauthorized access attempts)

**Priority 3: Staging Deployment**
```bash
ssh ubuntu@148.113.196.245
cd /var/www/facnet/staging
sudo -u facnet git checkout feature/task-management-module
sudo -u facnet npm install
sudo -u facnet npm run build
sudo -u facnet npm run db:push
sudo -u facnet pm2 restart facnet-validator-staging
```

**Priority 4: Production Deployment**
```bash
git checkout main
git merge feature/task-management-module
git push origin main
# GitHub Actions automatically deploys
```

---

## 📂 Project Structure

```
c:\Users\monti\Projects\facnet-validator\
├── docs/
│   ├── TASK_MODULE_INTEGRATION_STRATEGY.md ✅
│   └── TASK_MODULE_STATUS.md               ✅ (this file)
├── migrations/
│   ├── add_task_module.sql                 ✅
│   ├── TASK_MODULE_SUMMARY.md              ✅
│   ├── TASK_MODULE_TESTING.md              ✅
│   ├── TASK_QUICK_START.md                 ✅
│   └── TASK_STORAGE_IMPLEMENTATION.md      ✅
├── server/
│   ├── middleware/
│   │   └── rateLimiter.ts                  ✅
│   ├── modules/
│   │   └── tasks/
│   │       ├── fileUpload.ts               ✅
│   │       ├── middleware.ts               ✅
│   │       ├── sanitization.ts             ✅
│   │       ├── STORAGE_METHODS.md          ✅
│   │       └── routes.ts                   ⏳ TODO
│   ├── core/
│   │   └── storage.ts                      ⏳ TODO (add methods)
│   └── index.ts                            ⏳ TODO (add Helmet + routes)
├── client/
│   └── src/
│       ├── pages/
│       │   └── Tasks.tsx                   ⏳ TODO
│       └── components/
│           └── tasks/                      ⏳ TODO
├── shared/
│   └── schema.ts                           ✅
└── tests/
    ├── unit/tasks/                         ⏳ TODO
    └── security/                           ⏳ TODO
```

---

## 🎯 Immediate Next Steps (For You)

### Step 1: Add Storage Methods (15 minutes)

1. Open `server/core/storage.ts`
2. Follow instructions in `server/modules/tasks/STORAGE_METHODS.md`
3. Copy and paste the code sections

### Step 2: Create API Routes (2-3 hours)

Create `server/modules/tasks/routes.ts` with all CRUD endpoints. Reference:
- Existing routes in `server/routes.ts` for validation module
- Security middleware from `server/modules/tasks/middleware.ts`
- Rate limiters from `server/middleware/rateLimiter.ts`

### Step 3: Update server/index.ts (10 minutes)

Add Helmet CSP and integrate task routes.

### Step 4: Test Backend (30 minutes)

Apply migration and test with curl/Postman:
```bash
# Create board
curl -X POST http://localhost:5000/api/tasks/boards \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Board","description":"Test"}'

# Create list
curl -X POST http://localhost:5000/api/tasks/boards/$BOARD_ID/lists \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"To Do","position":65536}'

# Create task
curl -X POST http://localhost:5000/api/tasks/lists/$LIST_ID/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"My Task","description":"<p>Hello</p>"}'
```

### Step 5: Build Frontend (8-10 hours)

Once backend is working, create React components following the structure above.

---

## 📊 Progress Tracker

### Overall Progress: 65% Complete

- [x] Phase 1: Research & Analysis (100%)
- [x] Phase 2: Database Schema (100%)
- [ ] Phase 3: Backend API (70%)
  - [x] Security infrastructure (100%)
  - [ ] Storage methods (0% - document ready)
  - [ ] API routes (0%)
  - [ ] Server integration (0%)
- [ ] Phase 4: React Frontend (0%)
- [ ] Phase 5: Testing & Deployment (0%)

**Estimated Remaining Time:**
- Backend completion: 8-10 hours
- Frontend development: 20-30 hours
- Testing & deployment: 10-15 hours
- **Total remaining: 40-55 hours**

---

## 🔗 Key Resources

**Documentation:**
- Integration Strategy: `docs/TASK_MODULE_INTEGRATION_STRATEGY.md`
- Database Summary: `migrations/TASK_MODULE_SUMMARY.md`
- Testing Guide: `migrations/TASK_MODULE_TESTING.md`
- Storage Methods: `server/modules/tasks/STORAGE_METHODS.md`

**External References:**
- Planka GitHub: https://github.com/plankanban/planka
- @hello-pangea/dnd: https://github.com/hello-pangea/dnd
- Drizzle ORM: https://orm.drizzle.team/
- Radix UI: https://www.radix-ui.com/

**Dash Platform:**
- CLAUDE.md: Project guidelines
- PHI Access Control: `docs/PHI_ACCESS_CONTROL.md`
- Server Setup: `docs/SERVER_SETUP.md`

---

**Last Updated:** 2025-10-07
**Branch:** `feature/task-management-module`
**Next Milestone:** Complete Backend API (Step 1-4 above)
