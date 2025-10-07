-- ==================== TASK MANAGEMENT MODULE ====================
--
-- Purpose: Business task tracking system (NOT PHI-related)
-- Features: Kanban boards, task lists, cards, labels, comments, file attachments
-- Security: NO foreign keys to PHI tables (validation_runs, billing_records, etc.)
-- User References: Auth0 user IDs (text) for maximum flexibility
--
-- Tables: task_boards, task_lists, tasks, task_labels, task_label_assignments,
--         task_comments, task_attachments
--
-- Migration Date: October 7, 2025
-- ==================================================================================

-- ==================== ENUMS ====================

-- Task status enum (workflow states)
DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Task priority enum (urgency levels)
DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==================== TABLES ====================

-- Task boards table - Project/workspace level organization
CREATE TABLE IF NOT EXISTS task_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- Max 100 chars enforced at validation layer
  description TEXT, -- Max 500 chars enforced at validation layer
  created_by TEXT NOT NULL, -- Auth0 user ID (NOT foreign key for flexibility)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  active BOOLEAN NOT NULL DEFAULT true -- Soft delete flag
);

-- Task lists table - Columns in kanban board (e.g., "To Do", "In Progress", "Done")
CREATE TABLE IF NOT EXISTS task_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Max 50 chars enforced at validation layer
  position NUMERIC NOT NULL, -- Fractional positioning for drag-and-drop (e.g., 1.0, 1.5, 2.0)
  color TEXT, -- Hex color code (e.g., "#3B82F6")
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Tasks table - Individual task cards
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE, -- DENORMALIZED for query performance
  list_id UUID NOT NULL REFERENCES task_lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- Max 200 chars enforced at validation layer
  description TEXT, -- Max 5000 chars, supports sanitized HTML
  position NUMERIC NOT NULL, -- Fractional positioning within list
  status task_status NOT NULL DEFAULT 'todo',
  priority task_priority NOT NULL DEFAULT 'medium',
  assigned_to TEXT, -- Auth0 user ID (optional assignment)
  created_by TEXT NOT NULL, -- Auth0 user ID (creator)
  due_date TIMESTAMP WITH TIME ZONE, -- Optional deadline
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete (NULL = active, timestamp = deleted)
);

-- Task labels table - Tags/categories for tasks (scoped to board)
CREATE TABLE IF NOT EXISTS task_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Max 30 chars enforced at validation layer
  color TEXT NOT NULL, -- Hex color code (e.g., "#10B981")
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Task label assignments table - Many-to-many join table for task-label relationships
CREATE TABLE IF NOT EXISTS task_label_assignments (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES task_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id) -- Composite primary key prevents duplicate assignments
);

-- Task comments table - Discussion threads on tasks
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- Max 2000 chars, supports sanitized HTML
  author_id TEXT NOT NULL, -- Auth0 user ID (comment author)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete for comment history
);

-- Task attachments table - File uploads linked to tasks
CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL, -- Secure random filename on server (e.g., "a3f7d2e9.pdf")
  original_name TEXT NOT NULL, -- User's original filename (e.g., "Report Q3 2025.pdf")
  mime_type TEXT NOT NULL, -- MIME type (e.g., "application/pdf")
  file_size INTEGER NOT NULL, -- Size in bytes
  storage_path TEXT NOT NULL, -- Absolute path to file on server
  uploaded_by TEXT NOT NULL, -- Auth0 user ID (uploader)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE -- Soft delete (keep file metadata for audit trail)
);

-- ==================== PERFORMANCE INDEXES ====================

-- Board lookups
CREATE INDEX IF NOT EXISTS idx_task_boards_created_by ON task_boards(created_by);
CREATE INDEX IF NOT EXISTS idx_task_boards_active ON task_boards(active) WHERE active = true;

-- List queries
CREATE INDEX IF NOT EXISTS idx_task_lists_board_id ON task_lists(board_id);
CREATE INDEX IF NOT EXISTS idx_task_lists_position ON task_lists(position);
CREATE INDEX IF NOT EXISTS idx_task_lists_board_position ON task_lists(board_id, position); -- Composite for ordering

-- Task queries (most critical for performance)
CREATE INDEX IF NOT EXISTS idx_tasks_board_id ON tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_list_id ON tasks(list_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_position ON tasks(position);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at) WHERE deleted_at IS NULL; -- Active tasks only
CREATE INDEX IF NOT EXISTS idx_tasks_list_position ON tasks(list_id, position) WHERE deleted_at IS NULL; -- Composite for kanban ordering

-- Label queries
CREATE INDEX IF NOT EXISTS idx_task_labels_board_id ON task_labels(board_id);

-- Label assignment lookups
CREATE INDEX IF NOT EXISTS idx_task_label_assignments_task_id ON task_label_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_label_assignments_label_id ON task_label_assignments(label_id);

-- Comment lookups
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_author_id ON task_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_deleted_at ON task_comments(deleted_at) WHERE deleted_at IS NULL;

-- Attachment lookups
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_uploaded_by ON task_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_task_attachments_deleted_at ON task_attachments(deleted_at) WHERE deleted_at IS NULL;

-- ==================== TRIGGERS ====================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_task_boards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_task_lists_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_task_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS trigger_update_task_boards_updated_at ON task_boards;
CREATE TRIGGER trigger_update_task_boards_updated_at
  BEFORE UPDATE ON task_boards
  FOR EACH ROW
  EXECUTE FUNCTION update_task_boards_updated_at();

DROP TRIGGER IF EXISTS trigger_update_task_lists_updated_at ON task_lists;
CREATE TRIGGER trigger_update_task_lists_updated_at
  BEFORE UPDATE ON task_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_task_lists_updated_at();

DROP TRIGGER IF EXISTS trigger_update_tasks_updated_at ON tasks;
CREATE TRIGGER trigger_update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

DROP TRIGGER IF EXISTS trigger_update_task_comments_updated_at ON task_comments;
CREATE TRIGGER trigger_update_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_task_comments_updated_at();

-- ==================== DOCUMENTATION ====================

-- Table comments for documentation
COMMENT ON TABLE task_boards IS 'Project/workspace level organization for task management system';
COMMENT ON TABLE task_lists IS 'Columns in kanban board (e.g., To Do, In Progress, Done)';
COMMENT ON TABLE tasks IS 'Individual task cards with assignments, priorities, and deadlines';
COMMENT ON TABLE task_labels IS 'Tags/categories for tasks (scoped to board)';
COMMENT ON TABLE task_label_assignments IS 'Many-to-many join table for task-label relationships';
COMMENT ON TABLE task_comments IS 'Discussion threads on tasks';
COMMENT ON TABLE task_attachments IS 'File uploads linked to tasks';

-- Column comments for critical fields
COMMENT ON COLUMN tasks.board_id IS 'DENORMALIZED for query performance - allows direct board queries without joining lists';
COMMENT ON COLUMN tasks.position IS 'Fractional positioning for drag-and-drop (e.g., 1.0, 1.5, 2.0)';
COMMENT ON COLUMN tasks.deleted_at IS 'Soft delete timestamp (NULL = active, timestamp = deleted)';
COMMENT ON COLUMN task_attachments.file_name IS 'Secure random filename on server';
COMMENT ON COLUMN task_attachments.original_name IS 'User original filename (for display)';

-- Security notes
COMMENT ON COLUMN task_boards.created_by IS 'Auth0 user ID - NOT foreign key to users table for flexibility';
COMMENT ON COLUMN tasks.assigned_to IS 'Auth0 user ID - optional task assignment';
COMMENT ON COLUMN tasks.created_by IS 'Auth0 user ID - task creator';
COMMENT ON COLUMN task_comments.author_id IS 'Auth0 user ID - comment author';
COMMENT ON COLUMN task_attachments.uploaded_by IS 'Auth0 user ID - file uploader';

-- ==================== VERIFICATION QUERIES ====================

-- Verify all tables were created
DO $$
BEGIN
  RAISE NOTICE 'Task module tables created:';
  RAISE NOTICE '  - task_boards: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'task_boards');
  RAISE NOTICE '  - task_lists: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'task_lists');
  RAISE NOTICE '  - tasks: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'tasks');
  RAISE NOTICE '  - task_labels: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'task_labels');
  RAISE NOTICE '  - task_label_assignments: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'task_label_assignments');
  RAISE NOTICE '  - task_comments: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'task_comments');
  RAISE NOTICE '  - task_attachments: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'task_attachments');
END $$;

-- Verify indexes
DO $$
BEGIN
  RAISE NOTICE 'Task module indexes created: %', (
    SELECT COUNT(*) FROM pg_indexes
    WHERE indexname LIKE 'idx_task_%' OR indexname LIKE '%task_label_assignments%'
  );
END $$;

-- ==================== MIGRATION COMPLETE ====================
