# Task Management Module - Testing & Verification Guide

**Migration Date**: October 7, 2025
**Database**: PostgreSQL 16
**Migration File**: `migrations/add_task_module.sql`
**Schema File**: `shared/schema.ts` (lines 244-407, 486-492, 510-516, 549-562)

---

## Pre-Migration Checklist

- [ ] Backup production database: `pg_dump -h localhost -U dashvalidator_user dashvalidator > backup_$(date +%Y%m%d_%H%M%S).sql`
- [ ] Test in staging environment first
- [ ] Review migration SQL for any environment-specific changes
- [ ] Ensure no active connections that might block DDL operations

---

## Migration Execution

### 1. Apply Migration

```bash
# Connect to database
PGPASSWORD=DashValidator2024 psql -h localhost -U dashvalidator_user -d dashvalidator

# Apply migration
\i migrations/add_task_module.sql

# Check for errors
\echo :LASTOID
```

### 2. Verify Schema

```sql
-- Verify all 7 tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'task_%'
ORDER BY table_name;

-- Expected output:
-- task_attachments
-- task_boards
-- task_comments
-- task_label_assignments
-- task_labels
-- task_lists
-- tasks

-- Verify enums created
SELECT typname FROM pg_type WHERE typname LIKE 'task_%';

-- Expected output:
-- task_priority
-- task_status
```

### 3. Verify Indexes

```sql
-- Count indexes created (should be 24+)
SELECT COUNT(*)
FROM pg_indexes
WHERE indexname LIKE 'idx_task_%'
   OR indexname LIKE '%task_label_assignments%';

-- List all task indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE indexname LIKE 'idx_task_%'
   OR indexname LIKE '%task_label_assignments%'
ORDER BY tablename, indexname;
```

### 4. Verify Triggers

```sql
-- Check auto-update triggers (should have 4)
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%task_%'
ORDER BY event_object_table;

-- Expected output:
-- trigger_update_task_boards_updated_at | task_boards
-- trigger_update_task_comments_updated_at | task_comments
-- trigger_update_task_lists_updated_at | task_lists
-- trigger_update_tasks_updated_at | tasks
```

### 5. Verify Foreign Key Constraints

```sql
-- Check CASCADE delete relationships
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name LIKE 'task_%'
ORDER BY tc.table_name, kcu.column_name;

-- All delete_rule should be 'CASCADE'
```

---

## Test Data Insertion

### Test 1: Basic Workflow - Create Board, Lists, and Tasks

```sql
-- 1. Create a test board
INSERT INTO task_boards (name, description, created_by)
VALUES ('Product Launch Q4 2025', 'Coordinating product launch activities', 'auth0|test-user-123')
RETURNING id, name, created_at;

-- Copy the board ID from output (example: '550e8400-e29b-41d4-a716-446655440000')

-- 2. Create task lists (kanban columns)
INSERT INTO task_lists (board_id, name, position, color)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'À faire', 1.0, '#3B82F6'),
  ('550e8400-e29b-41d4-a716-446655440000', 'En cours', 2.0, '#F59E0B'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Terminé', 3.0, '#10B981')
RETURNING id, name, position;

-- Copy the "À faire" list ID (example: '660e8400-e29b-41d4-a716-446655440000')

-- 3. Create tasks
INSERT INTO tasks (board_id, list_id, title, description, position, priority, assigned_to, created_by, due_date)
VALUES
  (
    '550e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440000',
    'Préparer le matériel marketing',
    '<p>Créer les <strong>affiches</strong>, brochures, et contenu social media.</p>',
    1.0,
    'high',
    'auth0|designer-user-456',
    'auth0|test-user-123',
    NOW() + INTERVAL '7 days'
  ),
  (
    '550e8400-e29b-41d4-a716-446655440000',
    '660e8400-e29b-41d4-a716-446655440000',
    'Finaliser la documentation technique',
    'Compléter les guides utilisateur et documentation API',
    2.0,
    'urgent',
    'auth0|dev-user-789',
    'auth0|test-user-123',
    NOW() + INTERVAL '3 days'
  )
RETURNING id, title, status, priority;

-- Copy a task ID (example: '770e8400-e29b-41d4-a716-446655440000')
```

### Test 2: Labels and Assignments

```sql
-- 1. Create labels
INSERT INTO task_labels (board_id, name, color)
VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Marketing', '#EC4899'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Technique', '#8B5CF6'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Urgent', '#EF4444')
RETURNING id, name, color;

-- Copy label IDs

-- 2. Assign labels to tasks
INSERT INTO task_label_assignments (task_id, label_id)
VALUES
  ('770e8400-e29b-41d4-a716-446655440000', '880e8400-e29b-41d4-a716-446655440000'),
  ('770e8400-e29b-41d4-a716-446655440000', '990e8400-e29b-41d4-a716-446655440000');

-- Verify assignment
SELECT t.title, tl.name AS label_name, tl.color
FROM tasks t
JOIN task_label_assignments tla ON t.id = tla.task_id
JOIN task_labels tl ON tla.label_id = tl.id
WHERE t.id = '770e8400-e29b-41d4-a716-446655440000';
```

### Test 3: Comments and Attachments

```sql
-- 1. Add comments
INSERT INTO task_comments (task_id, content, author_id)
VALUES
  ('770e8400-e29b-41d4-a716-446655440000',
   '<p>J''ai terminé la première version des affiches. <strong>Veuillez réviser.</strong></p>',
   'auth0|designer-user-456'),
  ('770e8400-e29b-41d4-a716-446655440000',
   'Excellent travail! Quelques ajustements mineurs nécessaires sur les couleurs.',
   'auth0|test-user-123')
RETURNING id, content, author_id, created_at;

-- 2. Add attachments
INSERT INTO task_attachments (task_id, file_name, original_name, mime_type, file_size, storage_path, uploaded_by)
VALUES
  ('770e8400-e29b-41d4-a716-446655440000',
   'a3f7d2e9-4b8c-1234-5678-9abcdef01234.pdf',
   'Affiches_Version1.pdf',
   'application/pdf',
   2048576,
   '/var/www/facnet/app/uploads/tasks/a3f7d2e9-4b8c-1234-5678-9abcdef01234.pdf',
   'auth0|designer-user-456')
RETURNING id, original_name, file_size, created_at;

-- Verify comments count
SELECT t.title, COUNT(tc.id) AS comment_count
FROM tasks t
LEFT JOIN task_comments tc ON t.id = tc.task_id AND tc.deleted_at IS NULL
WHERE t.id = '770e8400-e29b-41d4-a716-446655440000'
GROUP BY t.id, t.title;

-- Verify attachments
SELECT t.title, ta.original_name, ta.file_size
FROM tasks t
JOIN task_attachments ta ON t.id = ta.task_id
WHERE t.id = '770e8400-e29b-41d4-a716-446655440000'
  AND ta.deleted_at IS NULL;
```

### Test 4: Soft Deletes

```sql
-- Soft delete a task
UPDATE tasks
SET deleted_at = NOW()
WHERE id = '770e8400-e29b-41d4-a716-446655440000';

-- Verify task hidden from active queries
SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL;
SELECT COUNT(*) FROM tasks WHERE deleted_at IS NOT NULL;

-- Restore task
UPDATE tasks
SET deleted_at = NULL
WHERE id = '770e8400-e29b-41d4-a716-446655440000';
```

### Test 5: CASCADE Deletes

```sql
-- Delete a board (should cascade to all related data)
DELETE FROM task_boards WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- Verify cascade worked (all should return 0)
SELECT COUNT(*) FROM task_lists WHERE board_id = '550e8400-e29b-41d4-a716-446655440000';
SELECT COUNT(*) FROM tasks WHERE board_id = '550e8400-e29b-41d4-a716-446655440000';
SELECT COUNT(*) FROM task_labels WHERE board_id = '550e8400-e29b-41d4-a716-446655440000';
```

---

## Performance Testing

### Test Query Performance

```sql
-- Explain analyze for common queries
EXPLAIN ANALYZE
SELECT t.*, tl.name AS list_name
FROM tasks t
JOIN task_lists tl ON t.list_id = tl.id
WHERE t.board_id = '550e8400-e29b-41d4-a716-446655440000'
  AND t.deleted_at IS NULL
ORDER BY tl.position, t.position;

-- Should use idx_tasks_board_id and idx_tasks_list_position

EXPLAIN ANALYZE
SELECT t.*, COUNT(tc.id) AS comment_count
FROM tasks t
LEFT JOIN task_comments tc ON t.id = tc.task_id AND tc.deleted_at IS NULL
WHERE t.assigned_to = 'auth0|test-user-123'
  AND t.deleted_at IS NULL
GROUP BY t.id
ORDER BY t.due_date ASC NULLS LAST;

-- Should use idx_tasks_assigned_to and idx_tasks_due_date
```

### Index Usage Statistics

```sql
-- Monitor index usage after running application
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
WHERE indexname LIKE 'idx_task_%'
ORDER BY idx_scan DESC;

-- Low idx_scan values indicate unused indexes (monitor over time)
```

---

## Security Verification

### Test User Isolation

```sql
-- Verify NO foreign keys to users table (prevents tight coupling)
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name LIKE 'task_%'
  AND ccu.table_name = 'users';

-- Should return NO ROWS (user IDs are text, not FKs)
```

### Test PHI Isolation

```sql
-- Verify NO foreign keys to PHI tables
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name LIKE 'task_%'
  AND ccu.table_name IN ('validation_runs', 'billing_records', 'validation_results');

-- Should return NO ROWS (critical security requirement)
```

---

## Rollback Procedure

If migration needs to be rolled back:

```sql
-- Drop all task module tables (CASCADE will handle dependencies)
DROP TABLE IF EXISTS task_attachments CASCADE;
DROP TABLE IF EXISTS task_comments CASCADE;
DROP TABLE IF EXISTS task_label_assignments CASCADE;
DROP TABLE IF EXISTS task_labels CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS task_lists CASCADE;
DROP TABLE IF EXISTS task_boards CASCADE;

-- Drop enums
DROP TYPE IF EXISTS task_status CASCADE;
DROP TYPE IF EXISTS task_priority CASCADE;

-- Drop trigger functions
DROP FUNCTION IF EXISTS update_task_boards_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_task_lists_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_tasks_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_task_comments_updated_at() CASCADE;

-- Verify cleanup
SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'task_%';
-- Should return NO ROWS
```

---

## Integration Testing Checklist

After migration in staging:

- [ ] Verify TypeScript types compile: `npm run check`
- [ ] Test Drizzle ORM queries work correctly
- [ ] Verify frontend can create/read/update/delete boards
- [ ] Test task drag-and-drop position updates
- [ ] Verify file upload to task attachments
- [ ] Test comment creation and display
- [ ] Verify label assignment UI
- [ ] Test soft delete and restore functionality
- [ ] Verify user filtering (only see own boards)
- [ ] Test admin can see all boards
- [ ] Performance test with 1000+ tasks

---

## Production Deployment Steps

1. **Schedule Maintenance Window**: Brief downtime for migration
2. **Backup Database**: `pg_dump` before migration
3. **Apply Migration**: Run `add_task_module.sql`
4. **Verify Schema**: Run all verification queries above
5. **Test Critical Paths**: Create test board, list, task
6. **Monitor Performance**: Check index usage and query times
7. **Update Documentation**: Record migration in CLAUDE.md
8. **Deploy Application Code**: Push Drizzle schema changes
9. **Smoke Test**: Verify task module loads in production UI
10. **Monitor Logs**: Watch for errors in first 24 hours

---

## Troubleshooting

### Issue: Migration fails with "relation already exists"

```sql
-- Check if tables already exist
SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'task_%';

-- If partial migration, manually clean up and retry
```

### Issue: Index creation timeout

```sql
-- Create indexes concurrently (non-blocking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_board_id ON tasks(board_id);
-- Repeat for each index
```

### Issue: Trigger not firing

```sql
-- Check trigger exists
SELECT trigger_name FROM information_schema.triggers WHERE trigger_name LIKE '%task_%';

-- Test manually
UPDATE tasks SET title = 'Test' WHERE id = '...';
SELECT updated_at FROM tasks WHERE id = '...';
-- updated_at should be NOW()
```

---

## Post-Migration Monitoring

```sql
-- Daily health check query
SELECT
  'task_boards' AS table_name, COUNT(*) AS row_count FROM task_boards
UNION ALL
SELECT 'task_lists', COUNT(*) FROM task_lists
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'task_labels', COUNT(*) FROM task_labels
UNION ALL
SELECT 'task_comments', COUNT(*) FROM task_comments
UNION ALL
SELECT 'task_attachments', COUNT(*) FROM task_attachments;

-- Monitor table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'task_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Success Criteria

- [ ] All 7 tables created successfully
- [ ] All 24+ indexes created and verified
- [ ] All 4 triggers working correctly
- [ ] Foreign key constraints enforcing CASCADE deletes
- [ ] NO foreign keys to PHI tables (security verified)
- [ ] Test data inserts/updates/deletes working
- [ ] Soft deletes functioning correctly
- [ ] Query performance acceptable (<50ms for typical queries)
- [ ] TypeScript compilation successful
- [ ] Staging environment fully tested
- [ ] Production smoke test passed

---

**Migration Status**: Ready for staging deployment
**Next Steps**: Test in staging → Production deployment → Monitor performance
**Contact**: Database migration specialist (migration-expert)
