# Task Management Module - Integration Strategy
**Date:** 2025-10-07
**Status:** Phase 1 Complete - Research & Analysis
**Branch:** `feature/task-management-module`

---

## Executive Summary

This document outlines the complete strategy for integrating a task management module into the Dash platform based on comprehensive architecture analysis and security audit.

**Decision: Ground-Up Build with Planka Patterns**
- ✅ Maintains Dash modular architecture
- ✅ Reuses existing infrastructure (Auth0, PostgreSQL, Redis, BullMQ)
- ✅ Minimizes security risks (PHI isolation)
- ✅ Allows iterative development (2-week MVP)

**Timeline:** 12 weeks (2-week MVP + 10 weeks full features)
**Effort:** ~300 hours total
**Risk Level:** LOW (no architectural breaking changes)

---

## 1. Architecture Decision: Ground-Up Build

### Three Approaches Evaluated

#### ❌ Option 1: Full Planka Fork
**Pros:** Production-ready, comprehensive features
**Cons:** Different architecture, auth conflicts, database schema collision
**Verdict:** Too risky, violates Dash modular principles

#### ⚠️ Option 2: Selective Component Import
**Pros:** Reuse battle-tested UI, build native backend
**Cons:** Component dependencies, AGPL-3.0 licensing, refactoring overhead
**Verdict:** Medium risk, better than fork but not optimal

#### ✅ Option 3: Ground-Up with Planka Patterns (SELECTED)
**Pros:**
- Full architectural control
- Perfect fit with Dash module pattern
- No licensing concerns
- Optimized for Dash Design System
- Minimal technical debt

**Cons:**
- Longer development time
- Need to rebuild proven features

**Mitigation:**
- Use open-source libraries for specific functionality (drag-drop, real-time)
- Follow Planka's proven database schema patterns
- 70% code reuse without architectural compromises

---

## 2. Technology Stack

### Backend (Existing Dash Infrastructure)

| Component | Technology | Status | Notes |
|-----------|-----------|--------|-------|
| **Runtime** | Node.js + TypeScript | ✅ Existing | - |
| **Framework** | Express.js | ✅ Existing | - |
| **Database** | PostgreSQL 16 | ✅ Existing | `dashvalidator` database |
| **ORM** | Drizzle ORM | ✅ Existing | Replace Planka's Waterline |
| **Auth** | Auth0 (JWT) | ✅ Existing | Replace Planka's internal auth |
| **Cache** | Redis | ✅ Existing | Reuse for task caching |
| **Queue** | BullMQ + Redis | ✅ Existing | Task notifications |
| **Validation** | Zod | ✅ Existing | Request validation |
| **Observability** | Sentry + OpenTelemetry | ✅ Existing | Error tracking |

### Frontend (Existing Dash Infrastructure)

| Component | Technology | Status | Notes |
|-----------|-----------|--------|-------|
| **Framework** | React 18 + TypeScript | ✅ Existing | - |
| **Build Tool** | Vite | ✅ Existing | - |
| **Routing** | Wouter | ✅ Existing | - |
| **State** | TanStack Query | ✅ Existing | Replace Redux-Saga |
| **UI** | Radix UI + Tailwind | ✅ Existing | Replace Semantic UI |
| **Drag-Drop** | @hello-pangea/dnd | ⚠️ Need Install | Maintained fork of react-beautiful-dnd |
| **Rich Text** | TipTap or Quill | ⚠️ Need Install | Markdown editor |
| **i18n** | Inline French | ✅ Existing | Follow Dashboard pattern |

### Real-Time Strategy

**Chosen Approach:** Redis Pub/Sub + Polling (MVP)
- ✅ No Nginx config changes needed
- ✅ Works with existing PM2 clustering
- ✅ Leverages existing Redis infrastructure
- ⚠️ Future upgrade path to Socket.io

**Implementation:**
- Client polls every 3 seconds for updates
- Server broadcasts changes via Redis pub/sub
- BullMQ jobs for background tasks (notifications, cleanup)

---

## 3. Database Schema Design

### Core Tables (Planka-Inspired)

```sql
-- Hierarchy: Projects → Boards → Lists → Tasks

-- 1. task_boards (project/workspace level)
CREATE TABLE task_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Owner (Auth0 user ID)
  created_by TEXT NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true
);

-- 2. task_lists (columns in kanban)
CREATE TABLE task_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  position DOUBLE PRECISION NOT NULL, -- Fractional positioning
  color TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. tasks (individual cards)
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE, -- Denormalized
  list_id UUID NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT, -- Rich text (HTML - sanitized)
  position DOUBLE PRECISION,

  -- Status & Priority
  status TEXT NOT NULL DEFAULT 'todo', -- todo, in_progress, done
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent

  -- Assignment
  assigned_to TEXT, -- Auth0 user ID
  created_by TEXT NOT NULL,

  -- Dates
  due_date TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- 4. task_labels (tags)
CREATE TABLE task_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  color TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. task_label_assignments (many-to-many)
CREATE TABLE task_label_assignments (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES task_labels(id) ON DELETE CASCADE,

  PRIMARY KEY (task_id, label_id)
);

-- 6. task_comments
CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  content TEXT NOT NULL, -- Rich text (HTML - sanitized)
  author_id TEXT NOT NULL, -- Auth0 user ID

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- 7. task_attachments
CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

  file_name TEXT NOT NULL, -- Secure random filename
  original_name TEXT NOT NULL, -- User's original filename
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,

  uploaded_by TEXT NOT NULL, -- Auth0 user ID

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ -- Soft delete
);
```

### Performance Indexes

```sql
-- Board lookups
CREATE INDEX idx_task_boards_created_by ON task_boards(created_by);
CREATE INDEX idx_task_boards_active ON task_boards(active);

-- List ordering
CREATE INDEX idx_task_lists_board_id ON task_lists(board_id);
CREATE INDEX idx_task_lists_position ON task_lists(position);

-- Task queries (CRITICAL for performance)
CREATE INDEX idx_tasks_board_id ON tasks(board_id);
CREATE INDEX idx_tasks_list_id ON tasks(list_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_position ON tasks(position);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_deleted_at ON tasks(deleted_at);

-- Comment lookups
CREATE INDEX idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX idx_task_comments_author_id ON task_comments(author_id);

-- Attachment lookups
CREATE INDEX idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);

-- Full-text search (optional - Phase 2)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_tasks_title_gin ON tasks USING GIN (title gin_trgm_ops);
CREATE INDEX idx_tasks_description_gin ON tasks USING GIN (description gin_trgm_ops);
```

### ❌ CRITICAL: PHI Isolation

**FORBIDDEN Foreign Keys:**
```sql
-- ❌ NEVER create these relationships:
-- tasks.validation_run_id → validation_runs.id
-- tasks.billing_record_id → billing_records.id
-- tasks.patient_id → (any PHI identifier)

-- Task module MUST be completely isolated from PHI tables
```

---

## 4. Security Implementation

### Critical Security Requirements (From Audit)

#### 1. Rate Limiting (CRITICAL)
```typescript
// Install: npm install express-rate-limit
import rateLimit from 'express-rate-limit';

export const taskCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 tasks per hour
  message: { error: "Limite de création de tâches atteinte." }
});
```

#### 2. XSS Sanitization (CRITICAL)
```typescript
// Install: npm install dompurify isomorphic-dompurify
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'title'],
  });
}
```

#### 3. File Upload Security (HIGH)
```typescript
// Secure multer configuration
export const taskAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: '/var/uploads/dash/tasks', // Outside app root
    filename: (req, file, cb) => {
      const randomName = crypto.randomBytes(16).toString('hex');
      const ext = path.extname(file.originalname);
      cb(null, `${randomName}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.png', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});
```

#### 4. Ownership Middleware (HIGH)
```typescript
// Reuse existing requireOwnership pattern
export async function getTaskBoardOwner(boardId: string) {
  const board = await storage.getTaskBoard(boardId);
  return board?.createdBy || null;
}

export const requireBoardOwnership = requireOwnership(getTaskBoardOwner);

// Apply to routes
router.get("/api/tasks/boards/:id",
  authenticateToken,
  requireBoardOwnership, // ✅ Ownership check
  async (req, res) => { /* ... */ }
);
```

#### 5. CSP Headers (HIGH)
```typescript
// Install: npm install helmet
import helmet from 'helmet';

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
```

### Security Checklist

- [ ] **CRITICAL**: Database PHI isolation (no FK to validation_runs, billing_records)
- [ ] **CRITICAL**: Rate limiting on all API endpoints
- [ ] **CRITICAL**: XSS sanitization for rich text (tasks, comments)
- [ ] **HIGH**: Task ownership middleware (requireBoardOwnership)
- [ ] **HIGH**: Secure file uploads (MIME validation, size limits)
- [ ] **HIGH**: CSP headers with Helmet
- [ ] **MEDIUM**: SQL injection testing (Drizzle ORM provides protection)
- [ ] **MEDIUM**: Audit logging for task operations
- [ ] **MEDIUM**: Input validation with Zod

**Total Security Effort:** 30 hours (Critical: 8h, High: 12h, Medium: 10h)

---

## 5. MVP Feature Scope (2 Weeks)

### Phase 1: Core Functionality

**Week 1:**
- [ ] Database schema + migrations
- [ ] CRUD API endpoints for boards, lists, tasks
- [ ] Auth0 integration + ownership middleware
- [ ] Basic React board view (no drag-drop yet)
- [ ] Security: Rate limiting, XSS sanitization, file uploads

**Week 2:**
- [ ] Drag-and-drop with @hello-pangea/dnd
- [ ] Task details modal (Radix Dialog)
- [ ] Basic labels/tags
- [ ] Comments
- [ ] French UI text
- [ ] Sidebar navigation integration

### MVP Deliverables

✅ **Create/view/edit/delete task boards**
✅ **Create/reorder task lists (columns)**
✅ **Create/edit/move/delete tasks (cards)**
✅ **Drag-and-drop for tasks and lists**
✅ **Task details** (title, description, due date, assignees)
✅ **Basic labels/tags**
✅ **Comments**
✅ **File attachments**
✅ **French UI**
✅ **Security** (rate limiting, XSS, CSP, ownership)

### Deferred to Phase 2 (Weeks 3-12)

- Real-time collaboration (Socket.io upgrade)
- Activity log
- Notifications (email, in-app)
- Advanced filters
- Search (full-text)
- Recurring tasks
- Custom fields
- Time tracking
- Board templates
- Export functionality

---

## 6. Project Structure

```
c:\Users\monti\Projects\facnet-validator\
├── server/
│   ├── modules/
│   │   └── tasks/                    # NEW MODULE
│   │       ├── routes.ts             # API endpoints
│   │       ├── middleware.ts         # Ownership verification
│   │       ├── sanitization.ts       # XSS prevention
│   │       ├── fileUpload.ts         # Secure file handling
│   │       ├── auditLog.ts           # Audit logging
│   │       ├── validation.ts         # Zod schemas
│   │       └── dataRetention.ts      # GDPR compliance
│   ├── middleware/
│   │   └── rateLimiter.ts            # NEW - Rate limiting
│   └── core/
│       └── storage.ts                # MODIFY - Add task storage methods
├── client/
│   └── src/
│       ├── pages/
│       │   └── Tasks.tsx             # NEW - Main task module page
│       ├── components/
│       │   └── tasks/                # NEW - Task components
│       │       ├── Board.tsx
│       │       ├── List.tsx
│       │       ├── Card.tsx
│       │       ├── TaskModal.tsx
│       │       └── CommentList.tsx
│       └── lib/
│           └── sanitization.ts       # NEW - Frontend XSS prevention
├── shared/
│   └── schema.ts                     # MODIFY - Add task tables
├── migrations/
│   └── add_task_module.sql           # NEW - Database migration
├── tests/
│   ├── unit/
│   │   └── tasks/                    # NEW - Task unit tests
│   └── security/
│       ├── sqlInjection.test.ts      # NEW - Security tests
│       └── xss.test.ts               # NEW - XSS tests
└── docs/
    ├── TASK_MODULE_INTEGRATION_STRATEGY.md  # THIS FILE
    ├── TASK_MODULE_ARCHITECTURE_ANALYSIS.md # Planka research
    └── TASK_MODULE_SECURITY_AUDIT.md        # Security audit report
```

---

## 7. Development Roadmap

### Week 1-2: MVP Core (40 hours)
**Database Schema**
- [ ] Create Drizzle schema for task tables (4h)
- [ ] Write migration script (2h)
- [ ] Add indexes for performance (2h)
- [ ] Test with sample data (2h)

**Backend API**
- [ ] Board CRUD endpoints (4h)
- [ ] List CRUD endpoints (4h)
- [ ] Task CRUD endpoints (6h)
- [ ] Auth0 + ownership middleware (4h)
- [ ] Rate limiting (2h)
- [ ] XSS sanitization (2h)
- [ ] File upload security (4h)
- [ ] Error handling (2h)

**Frontend Core**
- [ ] Board page layout (4h)
- [ ] List component (4h)
- [ ] Card component (4h)
- [ ] Basic styling with Tailwind (4h)

### Week 3-4: Drag-Drop + UI Polish (40 hours)
**Drag-Drop**
- [ ] Install @hello-pangea/dnd (1h)
- [ ] Implement list reordering (4h)
- [ ] Implement card dragging (6h)
- [ ] Position calculation logic (2h)
- [ ] Optimistic updates (4h)

**Task Details**
- [ ] Task modal (Radix Dialog) (6h)
- [ ] Description editor (rich text) (6h)
- [ ] Due date picker (2h)
- [ ] Assignee selector (2h)
- [ ] Labels/tags UI (4h)

**Comments & Attachments**
- [ ] Comment list component (3h)
- [ ] Comment editor (2h)
- [ ] File upload UI (4h)
- [ ] Attachment list (2h)

### Week 5-6: Integration + Testing (40 hours)
**Integration**
- [ ] Sidebar navigation (2h)
- [ ] French translations (4h)
- [ ] Breadcrumbs (2h)
- [ ] Loading states (2h)
- [ ] Error boundaries (2h)

**Testing**
- [ ] Unit tests for API endpoints (8h)
- [ ] Unit tests for React components (8h)
- [ ] Security tests (4h)
- [ ] Integration tests (4h)
- [ ] Manual QA testing (4h)

**Documentation**
- [ ] Update CLAUDE.md (2h)
- [ ] API documentation (2h)
- [ ] User guide (French) (4h)

### Week 7-12: Advanced Features (120 hours)
- Real-time collaboration (Socket.io)
- Activity feed
- Notifications system
- Advanced filtering
- Full-text search
- Board templates
- Export functionality
- Performance optimization
- Load testing
- Security audit

**Total MVP Effort:** 120 hours (3 weeks full-time)
**Total Project Effort:** 240 hours (6 weeks full-time)

---

## 8. Testing Strategy

### Unit Tests
```typescript
// tests/unit/tasks/boards.test.ts
describe('Task Boards API', () => {
  it('should create board', async () => {
    const board = await storage.createTaskBoard({
      name: 'Test Board',
      createdBy: 'auth0|123'
    });
    expect(board.id).toBeDefined();
  });

  it('should enforce ownership', async () => {
    const board = await storage.createTaskBoard({
      name: 'User A Board',
      createdBy: 'auth0|userA'
    });

    // User B should NOT be able to access
    const response = await request(app)
      .get(`/api/tasks/boards/${board.id}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(response.status).toBe(403);
  });
});
```

### Security Tests
```typescript
// tests/security/xss.test.ts
describe('XSS Prevention', () => {
  const XSS_PAYLOADS = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror="alert(1)">',
    '<iframe src="javascript:alert(1)"></iframe>',
  ];

  it('should sanitize task description', async () => {
    for (const payload of XSS_PAYLOADS) {
      const task = await storage.createTask({
        boardId: 'test-board',
        title: 'Test',
        description: payload,
        createdBy: 'auth0|123'
      });

      // Should NOT contain script tags
      expect(task.description).not.toContain('<script>');
      expect(task.description).not.toContain('onerror=');
    }
  });
});
```

### Integration Tests
```typescript
// tests/integration/taskWorkflow.test.ts
describe('Task Workflow', () => {
  it('should complete full task lifecycle', async () => {
    // Create board
    const board = await createBoard('My Board');

    // Create list
    const list = await createList(board.id, 'To Do');

    // Create task
    const task = await createTask(list.id, 'Write tests');

    // Add comment
    const comment = await createComment(task.id, 'Great idea!');

    // Upload attachment
    const attachment = await uploadFile(task.id, 'test.pdf');

    // Move task
    const doneList = await createList(board.id, 'Done');
    await moveTask(task.id, doneList.id);

    // Verify final state
    const updatedTask = await getTask(task.id);
    expect(updatedTask.listId).toBe(doneList.id);
    expect(updatedTask.comments).toHaveLength(1);
    expect(updatedTask.attachments).toHaveLength(1);
  });
});
```

---

## 9. Deployment Plan

### Staging Deployment (Week 3)
```bash
# SSH to server
ssh ubuntu@148.113.196.245

# Navigate to staging
cd /var/www/facnet/staging

# Checkout feature branch
sudo -u facnet git fetch origin
sudo -u facnet git checkout feature/task-management-module
sudo -u facnet git pull origin feature/task-management-module

# Install dependencies
sudo -u facnet npm install

# Run migrations
sudo -u facnet npm run db:push

# Build application
sudo -u facnet npm run build

# Restart staging
sudo -u facnet pm2 restart facnet-validator-staging

# Test at https://148.113.196.245:3001/tasks
```

### Production Deployment (Week 6)
```bash
# Merge to main (triggers GitHub Actions)
git checkout main
git merge feature/task-management-module
git push origin main

# GitHub Actions automatically:
# - Builds application
# - Runs database migrations
# - Deploys to production
# - Restarts PM2 processes

# Verify at https://148.113.196.245/tasks
```

---

## 10. Success Metrics

### MVP Success Criteria

✅ **Functional Requirements**
- [ ] Users can create/edit/delete task boards
- [ ] Users can create/reorder lists
- [ ] Users can create/edit/move/delete tasks
- [ ] Drag-and-drop works smoothly
- [ ] Task details modal works
- [ ] Comments and attachments work
- [ ] French UI is complete and correct

✅ **Security Requirements**
- [ ] PHI isolation verified (no FK to validation_runs)
- [ ] Rate limiting prevents API abuse
- [ ] XSS sanitization blocks script injection
- [ ] File uploads are secure (MIME validation, size limits)
- [ ] Ownership middleware enforces access control
- [ ] CSP headers are configured

✅ **Performance Requirements**
- [ ] Board loads in <2 seconds
- [ ] Drag-drop latency <100ms
- [ ] Task creation <500ms
- [ ] No memory leaks (tested 1000+ tasks)

✅ **Testing Requirements**
- [ ] 80%+ code coverage
- [ ] All security tests pass
- [ ] Zero console errors
- [ ] Manual QA checklist complete

---

## 11. Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **PHI Contamination** | LOW | CRITICAL | Database FK validation, code review, audit |
| **XSS Vulnerability** | MEDIUM | HIGH | DOMPurify sanitization, CSP headers, testing |
| **Performance Issues** | MEDIUM | MEDIUM | Database indexes, caching, load testing |
| **Drag-Drop Bugs** | MEDIUM | MEDIUM | Use mature library (@hello-pangea/dnd), testing |
| **Real-Time Sync Issues** | LOW | MEDIUM | Start with polling, upgrade to Socket.io later |

### Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Deployment Issues** | LOW | HIGH | Test in staging, automated CI/CD, rollback plan |
| **Data Loss** | LOW | CRITICAL | Database backups, soft deletes, audit logging |
| **Auth0 Integration** | LOW | HIGH | Reuse existing patterns, thorough testing |
| **File Storage Limits** | MEDIUM | MEDIUM | 10MB limit, monitoring, cleanup jobs |

---

## 12. Next Steps

### Immediate Actions (This Week)

1. ✅ **Complete Phase 1** - Research & analysis (DONE)
2. ⏳ **Start Phase 2** - Database schema design with db-migration agent
3. ⏳ **Security setup** - Install rate limiting, XSS sanitization, Helmet
4. ⏳ **Project structure** - Create `server/modules/tasks/` directory
5. ⏳ **Documentation** - Archive research reports to `docs/` folder

### Week 1 Tasks

- [ ] Design Drizzle schema for task tables
- [ ] Create migration script
- [ ] Implement storage methods in `server/core/storage.ts`
- [ ] Set up Express routes in `server/modules/tasks/routes.ts`
- [ ] Implement ownership middleware
- [ ] Install security packages (express-rate-limit, dompurify, helmet)

### Week 2 Tasks

- [ ] Build React board view
- [ ] Implement drag-and-drop
- [ ] Create task modal
- [ ] Add comments and attachments
- [ ] French translations
- [ ] Integration testing

---

## 13. References

### Research Documents
- **Architecture Analysis**: [Planka Technical Analysis Report](./TASK_MODULE_ARCHITECTURE_ANALYSIS.md)
- **Security Audit**: [Security Audit Report](./TASK_MODULE_SECURITY_AUDIT.md)
- **Ultrathink Analysis**: Completed 15-step architectural decision analysis

### Key Resources
- **Planka GitHub**: https://github.com/plankanban/planka
- **@hello-pangea/dnd**: https://github.com/hello-pangea/dnd
- **Drizzle ORM**: https://orm.drizzle.team/
- **Radix UI**: https://www.radix-ui.com/
- **DOMPurify**: https://github.com/cure53/DOMPurify

### Dash Platform Documentation
- **CLAUDE.md**: Project overview and guidelines
- **PHI Access Control**: [PHI_ACCESS_CONTROL.md](./PHI_ACCESS_CONTROL.md)
- **Server Setup**: [SERVER_SETUP.md](./SERVER_SETUP.md)
- **Performance**: [PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md)

---

**Status:** Phase 1 Complete ✅
**Next Phase:** Database Schema Design
**Branch:** `feature/task-management-module`
**Last Updated:** 2025-10-07
