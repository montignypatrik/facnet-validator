/**
 * Import RAMQ Validation Rules into Database
 * Imports 122 RAMQ billing rules from ramq_complete_rules_final.json
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Database connection
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator';

// Path to rules JSON file
const RULES_JSON_PATH = path.join(__dirname, '..', '..', 'RAMQ_Extract', 'FOR_VALIDATOR_PROJECT', 'ramq_complete_rules_final.json');

async function importRules() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    console.log('🔗 Connecting to database...');
    await client.connect();

    // Check if rules JSON file exists
    if (!fs.existsSync(RULES_JSON_PATH)) {
      throw new Error(`Rules file not found: ${RULES_JSON_PATH}`);
    }

    console.log('📖 Reading rules file...');
    const rulesData = JSON.parse(fs.readFileSync(RULES_JSON_PATH, 'utf8'));

    // Extract rules array (handle different JSON structures)
    let rules = [];

    // Handle rules_by_type structure
    if (rulesData.rules_by_type) {
      Object.values(rulesData.rules_by_type).forEach(typeRules => {
        if (Array.isArray(typeRules)) {
          rules = rules.concat(typeRules);
        }
      });
    } else {
      rules = rulesData.all_rules || rulesData.rules || rulesData;
    }

    if (!Array.isArray(rules) || rules.length === 0) {
      throw new Error('Invalid rules format - expected array of rules');
    }

    console.log(`📊 Found ${rules.length} rules to import`);

    // Group rules by type for reporting
    const rulesByType = {};
    rules.forEach(rule => {
      const type = rule.rule_type || 'unknown';
      if (!rulesByType[type]) {
        rulesByType[type] = [];
      }
      rulesByType[type].push(rule);
    });

    console.log('\n📋 Rules breakdown by type:');
    Object.entries(rulesByType).sort((a, b) => b[1].length - a[1].length).forEach(([type, typeRules]) => {
      console.log(`  - ${type}: ${typeRules.length} rules`);
    });

    // Begin transaction
    await client.query('BEGIN');

    console.log('\n💾 Importing rules...');
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      try {
        // Generate a unique name for the rule if it doesn't have one
        let name = rule.name || rule.rule_id;

        if (!name) {
          // Generate name from rule type and codes
          const ruleType = rule.rule_type || 'unknown';
          const codes = Array.isArray(rule.codes) ? rule.codes.slice(0, 3).join('_') : 'nocodes';
          name = `${ruleType}_${codes}_${i}`;
        }

        const {
          description,
          rule_type,
          severity,
          enabled,
          threshold,
          amount
        } = rule;

        // Build condition JSON from rule data
        const condition = {
          codes: rule.codes || [],
          pattern: rule.pattern,
          ...rule
        };

        // Remove redundant fields from condition
        delete condition.name;
        delete condition.description;
        delete condition.rule_type;
        delete condition.severity;
        delete condition.enabled;
        delete condition.threshold;

        if (!condition || Object.keys(condition).length === 0) {
          console.warn(`⚠️  Skipping rule without condition: ${name}`);
          skipped++;
          continue;
        }

        // Check if rule already exists
        const existingRule = await client.query(
          'SELECT id FROM rules WHERE name = $1',
          [name]
        );

        if (existingRule.rows.length > 0) {
          // Update existing rule
          await client.query(
            `UPDATE rules
             SET description = $1,
                 rule_type = $2,
                 condition = $3,
                 threshold = $4,
                 severity = $5,
                 enabled = $6,
                 updated_at = NOW(),
                 updated_by = $7
             WHERE name = $8`,
            [
              description || null,
              rule_type || null,
              JSON.stringify(condition),
              threshold || amount || null,
              severity || 'error',
              enabled !== false, // Default to true if not specified
              'ramq_import_script',
              name
            ]
          );
          updated++;
        } else {
          // Insert new rule
          await client.query(
            `INSERT INTO rules (name, description, rule_type, condition, threshold, severity, enabled, created_at, updated_at, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), $8)`,
            [
              name,
              description || null,
              rule_type || null,
              JSON.stringify(condition),
              threshold || amount || null,
              severity || 'error',
              enabled !== false, // Default to true if not specified
              'ramq_import_script'
            ]
          );
          imported++;
        }
      } catch (error) {
        console.error(`❌ Error importing rule "${rule.name}":`, error.message);
        skipped++;
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    console.log('\n✅ Import completed!');
    console.log(`  - Imported: ${imported} new rules`);
    console.log(`  - Updated: ${updated} existing rules`);
    console.log(`  - Skipped: ${skipped} rules`);
    console.log(`  - Total: ${imported + updated} rules in database`);

    // Verify import
    console.log('\n🔍 Verifying import...');
    const countResult = await client.query('SELECT COUNT(*) FROM rules');
    const typeCountResult = await client.query(
      `SELECT rule_type, COUNT(*) as count
       FROM rules
       WHERE rule_type IS NOT NULL
       GROUP BY rule_type
       ORDER BY count DESC`
    );

    console.log(`\n📊 Database now contains ${countResult.rows[0].count} total rules`);
    console.log('\nRules by type in database:');
    typeCountResult.rows.forEach(row => {
      console.log(`  - ${row.rule_type}: ${row.count}`);
    });

  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);

    // Rollback transaction on error
    try {
      await client.query('ROLLBACK');
      console.log('Transaction rolled back');
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError.message);
    }

    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run import
console.log('🚀 RAMQ Rules Import Script');
console.log('============================\n');
importRules().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
