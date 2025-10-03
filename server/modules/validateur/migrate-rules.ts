// Migration script to populate rules table with office fee validation
import { storage } from '../../core/storage';

async function migrateOfficeFeeRule() {
  try {
    console.log('🔄 Starting rule migration...');

    const defaultRule = {
      name: 'Office Fee Validation (19928/19929)',
      condition: {
        type: 'office_fee_validation',
        category: 'office_fees',
        codes: ['19928', '19929'],
        walkInContexts: ['#G160', '#AR'],
        thresholds: {
          '19928': { registered: 6, walkIn: 10 },
          '19929': { registered: 12, walkIn: 20 }
        }
      },
      threshold: 64.80,
      enabled: true
    };

    // Check if rule already exists
    const existingRules = await storage.getAllRules();
    const hasOfficeRule = existingRules.some(rule =>
      rule.name.includes('Office Fee Validation')
    );

    if (hasOfficeRule) {
      console.log('✅ Office fee rule already exists in database');
      return;
    }

    // Create the rule
    const created = await storage.createRule(defaultRule);
    console.log('✅ Office fee rule created successfully:', created.id);
    console.log('🎯 Database rules are now active - future validations will use database instead of fallback');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// Export for use in server startup
export { migrateOfficeFeeRule };