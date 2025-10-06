// Quick script to query validation logs directly
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator'
});

const runId = '16b460e8-b465-4881-b139-2b5dd79f8f99';

try {
  const result = await pool.query(
    `SELECT
      level,
      source,
      message,
      metadata,
      timestamp
    FROM validation_logs
    WHERE validation_run_id = $1
    ORDER BY timestamp
    LIMIT 30`,
    [runId]
  );

  console.log(`\n📊 Found ${result.rows.length} log entries for validation run ${runId}\n`);

  result.rows.forEach((row, i) => {
    console.log(`${i + 1}. [${row.level}] ${row.source} - ${row.message}`);
    if (row.metadata) {
      console.log(`   Metadata:`, JSON.stringify(row.metadata, null, 2));
    }
    console.log('');
  });

  await pool.end();
} catch (error) {
  console.error('Error querying logs:', error);
  process.exit(1);
}
