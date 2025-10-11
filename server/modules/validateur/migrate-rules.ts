// Migration script to populate rules table with validation rules
import { storage } from '../../core/storage';

async function migrateOfficeFeeRule() {
  try {
    console.log('🔄 Starting rule migration...');

    const existingRules = await storage.getAllRules();

    // 1. Office Fee Validation Rule
    const hasOfficeRule = existingRules.some(rule =>
      rule.name.includes('Office Fee Validation')
    );

    if (!hasOfficeRule) {
      const officeFeeRule = {
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
      const created = await storage.createRule(officeFeeRule);
      console.log('✅ Office fee rule created successfully:', created.id);
    } else {
      console.log('✅ Office fee rule already exists in database');
    }

    // 2. GMF Annual Forfait 8875 Rule
    const hasGmfRule = existingRules.some(rule =>
      rule.name.includes('Forfait de prise en charge GMF')
    );

    if (!hasGmfRule) {
      const gmfRule = {
        name: 'Forfait de prise en charge GMF (8875)',
        condition: {
          type: 'gmf_annual_forfait',
          category: 'gmf_forfait',
          codes: ['8875']
        },
        threshold: 0, // Not used for this rule type
        enabled: true
      };
      const created = await storage.createRule(gmfRule);
      console.log('✅ GMF forfait rule created successfully:', created.id);
    } else {
      console.log('✅ GMF forfait rule already exists in database');
    }

    // 3. Intervention Clinique Daily Limit Rule
    const hasInterventionCliniqueRule = existingRules.some(rule =>
      rule.name.includes('Limite quotidienne interventions cliniques')
    );

    if (!hasInterventionCliniqueRule) {
      const interventionCliniqueRule = {
        name: 'Limite quotidienne interventions cliniques (180 min)',
        condition: {
          type: 'intervention_clinique_daily_limit',
          category: 'intervention_clinique',
          codes: ['8857', '8859'],
          excludedContexts: ['ICEP', 'ICSM', 'ICTOX'],
          durations: {
            '8857': 30, // Fixed 30 minutes for first period
            '8859': 'unites' // Variable from unites column
          }
        },
        threshold: 180, // Maximum 180 minutes per doctor per day
        enabled: true
      };
      const created = await storage.createRule(interventionCliniqueRule);
      console.log('✅ Intervention clinique rule created successfully:', created.id);
    } else {
      console.log('✅ Intervention clinique rule already exists in database');
    }

    // 4. Visit Duration Optimization Rule
    const hasVisitDurationRule = existingRules.some(rule =>
      rule.name.includes('Optimisation intervention clinique vs visite')
    );

    if (!hasVisitDurationRule) {
      const visitDurationRule = {
        name: 'Optimisation intervention clinique vs visite régulière',
        condition: {
          type: 'visit_duration_optimization',
          category: 'revenue_optimization',
          codes: [], // Dynamically loaded from database (474 consultation/visit codes)
          topLevel: 'B - CONSULTATION, EXAMEN ET VISITE',
          excludedCodes: ['8857', '8859'], // Already intervention clinique
          minimumDuration: 30, // Minimum 30 minutes to suggest optimization
          pricing: {
            '8857': 59.70, // Base 30 minutes
            '8859': 29.85  // Per 15-minute period
          }
        },
        threshold: 0, // No threshold - revenue optimization
        enabled: true
      };
      const created = await storage.createRule(visitDurationRule);
      console.log('✅ Visit duration optimization rule created successfully:', created.id);
    } else {
      console.log('✅ Visit duration optimization rule already exists in database');
    }

    console.log('🎯 Database rules are now active - future validations will use database');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

// Export for use in server startup
export { migrateOfficeFeeRule };