/**
 * Sample validation rules for testing
 * Matches database structure from rules table
 */

export const sampleValidationRules = [
  {
    id: 'test-rule-prohibition-001',
    name: 'prohibition_08129_08135',
    ruleType: 'prohibition',
    condition: {
      type: 'prohibition',
      category: 'prohibited_combinations',
      codes: ['08129', '08135'],
      message: 'Les codes 08129 et 08135 sont prohibés sur la même facture',
    },
    threshold: null,
    enabled: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'test-rule-office-fee-001',
    name: 'office_fee_19929_threshold',
    ruleType: 'amount_limit',
    condition: {
      type: 'office_fee_validation',
      category: 'office_fees',
      codes: ['19929'],
      walkInContexts: ['G160', 'AR'],
      thresholds: {
        '19929': {
          registered: 12,
          walkIn: 20,
        },
      },
      dailyMax: 64.80,
    },
    threshold: 64.80,
    enabled: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'test-rule-office-fee-002',
    name: 'office_fee_19928_threshold',
    ruleType: 'amount_limit',
    condition: {
      type: 'office_fee_validation',
      category: 'office_fees',
      codes: ['19928'],
      walkInContexts: ['G160', 'AR'],
      thresholds: {
        '19928': {
          registered: 6,
          walkIn: 10,
        },
      },
      dailyMax: 32.40,
    },
    threshold: 32.40,
    enabled: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'test-rule-time-restriction-001',
    name: 'time_restriction_same_code',
    ruleType: 'time_restriction',
    condition: {
      type: 'time_restriction',
      category: 'minimum_interval',
      codes: ['00103'],
      minimumIntervalHours: 24,
      message: 'Le code 00103 ne peut être facturé qu\'une fois par 24 heures pour le même patient',
    },
    threshold: 24,
    enabled: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
  {
    id: 'test-rule-requirement-001',
    name: 'requirement_multiple_visits',
    ruleType: 'requirement',
    condition: {
      type: 'requirement',
      category: 'context_required',
      requiredContext: '85',
      condition: 'multiple_visits_same_patient_same_day',
      message: 'Les visites multiples du même patient le même jour nécessitent le contexte #85',
    },
    threshold: null,
    enabled: true,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  },
];
