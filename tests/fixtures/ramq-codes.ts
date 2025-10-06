/**
 * Sample RAMQ billing codes for testing
 * Based on actual Quebec healthcare billing codes
 */

export const sampleRAMQCodes = [
  {
    id: 'test-code-19928',
    code: '19928',
    description: 'Frais de bureau - 6 patients inscrits',
    tariffValue: 32.40,
    place: 'Cabinet',
    category: 'office_fees',
    active: true,
  },
  {
    id: 'test-code-19929',
    code: '19929',
    description: 'Frais de bureau - 12 patients inscrits',
    tariffValue: 64.80,
    place: 'Cabinet',
    category: 'office_fees',
    active: true,
  },
  {
    id: 'test-code-08129',
    code: '08129',
    description: 'Consultation code (prohibited with 08135)',
    tariffValue: 85.00,
    place: 'Cabinet',
    category: 'consultation',
    active: true,
  },
  {
    id: 'test-code-08135',
    code: '08135',
    description: 'Extended consultation (prohibited with 08129)',
    tariffValue: 125.00,
    place: 'Cabinet',
    category: 'consultation',
    active: true,
  },
];

export const sampleContexts = [
  {
    id: 'test-context-g160',
    name: 'G160',
    description: 'Patients sans rendez-vous (walk-in)',
    active: true,
  },
  {
    id: 'test-context-ar',
    name: 'AR',
    description: 'Autre contexte de visite sans rendez-vous',
    active: true,
  },
  {
    id: 'test-context-85',
    name: '85',
    description: 'Multiple visits same patient',
    active: true,
  },
];
