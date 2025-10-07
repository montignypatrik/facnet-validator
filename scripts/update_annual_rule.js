/**
 * Update Annual Billing Code Rule with Proper UTF-8 Encoding
 * Run with: node scripts/update_annual_rule.js
 */

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator',
  ssl: false
});

async function updateRule() {
  const client = await pool.connect();
  try {
    const condition = {
      category: 'annual_limit',
      leafPatterns: [
        'Visite de prise en charge',
        'Visite périodique',
        "Visite de prise en charge d'un problème musculo squelettique"
      ]
    };

    const result = await client.query(
      `UPDATE rules
       SET condition = $1::jsonb
       WHERE rule_id = 'ANNUAL_BILLING_CODE'
       RETURNING rule_id, name, condition`,
      [JSON.stringify(condition)]
    );

    if (result.rowCount > 0) {
      console.log('✓ Rule updated successfully:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('✗ No rule found with ID: ANNUAL_BILLING_CODE');
    }
  } catch (error) {
    console.error('✗ Failed to update rule:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updateRule();
