/**
 * Sample Quebec healthcare billing records for testing
 * Represents realistic RAMQ CSV data
 */

import type { BillingRecord } from '@/shared/types';

export const sampleBillingRecords: Partial<BillingRecord>[] = [
  // Valid office fee scenario - 12 registered patients with code 19929
  {
    id: '1',
    facture: 'INV001',
    idRamq: 'R001',
    dateDeService: '2025-02-05',
    debut: '08:00',
    fin: '08:15',
    lieuPratique: '12345', // Fixed: was lieuDePratique
    secteurActivite: 'Cabinet', // Fixed: was secteurDActivite
    diagnostic: 'A09',
    code: '19929',
    unites: '1',
    role: '1',
    elementContexte: '', // Fixed: was elementDeContexte
    montantPreliminaire: '64.80',
    montantPaye: '64.80',
    doctorInfo: '1068303-00000',
    patient: 'P001',
  },
  // Walk-in patient with context G160
  {
    id: '2',
    facture: 'INV002',
    idRamq: 'R002',
    dateDeService: '2025-02-05',
    debut: '09:00',
    fin: '09:15',
    lieuPratique: '12345',
    secteurActivite: 'Cabinet',
    diagnostic: 'J06',
    code: '00103',
    unites: '1',
    role: '1',
    elementContexte: 'G160',
    montantPreliminaire: '42.00',
    montantPaye: '42.00',
    doctorInfo: '1068303-00000',
    patient: 'P002',
  },
  // Prohibited code combination - 08129 and 08135 on same invoice
  {
    id: '3',
    facture: 'INV003',
    idRamq: 'R003',
    dateDeService: '2025-02-05',
    debut: '10:00',
    fin: '10:30',
    lieuPratique: '12345',
    secteurActivite: 'Cabinet',
    diagnostic: 'M79',
    code: '08129',
    unites: '1',
    role: '1',
    elementContexte: '',
    montantPreliminaire: '85.00',
    montantPaye: '85.00',
    doctorInfo: '1068303-00000',
    patient: 'P003',
  },
  {
    id: '4',
    facture: 'INV003', // Same invoice as above - VIOLATION!
    idRamq: 'R003',
    dateDeService: '2025-02-05',
    debut: '10:30',
    fin: '11:00',
    lieuPratique: '12345',
    secteurActivite: 'Cabinet',
    diagnostic: 'M79',
    code: '08135',
    unites: '1',
    role: '1',
    elementContexte: '',
    montantPreliminaire: '125.00',
    montantPaye: '125.00',
    doctorInfo: '1068303-00000',
    patient: 'P003',
  },
];

/**
 * Generate multiple registered patients for office fee testing
 */
export function generateRegisteredPatients(count: number, code: string = '19929', date: string = '2025-02-05'): Partial<BillingRecord>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `gen-${i + 1}`,
    facture: `INV-GEN-${i + 1}`,
    idRamq: `R-GEN-${i + 1}`,
    dateDeService: date,
    debut: `${8 + Math.floor(i / 4)}:${(i % 4) * 15}`,
    fin: `${8 + Math.floor(i / 4)}:${(i % 4) * 15 + 15}`,
    lieuPratique: '12345',
    secteurActivite: 'Cabinet',
    diagnostic: 'A09',
    code,
    unites: '1',
    role: '1',
    elementContexte: '', // Registered patients have no walk-in context
    montantPreliminaire: code === '19929' ? '64.80' : '32.40',
    montantPaye: code === '19929' ? '64.80' : '32.40',
    doctorInfo: '1068303-00000',
    patient: `P-GEN-${i + 1}`,
  }));
}

/**
 * Generate walk-in patients with G160 context
 */
export function generateWalkInPatients(count: number, date: string = '2025-02-05'): Partial<BillingRecord>[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `walkin-${i + 1}`,
    facture: `INV-WALKIN-${i + 1}`,
    idRamq: `R-WALKIN-${i + 1}`,
    dateDeService: date,
    debut: `${14 + Math.floor(i / 4)}:${(i % 4) * 15}`,
    fin: `${14 + Math.floor(i / 4)}:${(i % 4) * 15 + 15}`,
    lieuPratique: '12345',
    secteurActivite: 'Cabinet',
    diagnostic: 'J06',
    code: '00103',
    unites: '1',
    role: '1',
    elementContexte: 'G160', // Walk-in context
    montantPreliminaire: '42.00',
    montantPaye: '42.00',
    doctorInfo: '1068303-00000',
    patient: `P-WALKIN-${i + 1}`,
  }));
}
