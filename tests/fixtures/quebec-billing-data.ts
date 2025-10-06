/**
 * Quebec Healthcare Billing Test Data Fixtures
 *
 * Provides realistic RAMQ billing records for comprehensive test coverage.
 * Based on 23-column CSV structure defined in CLAUDE.md
 */

export interface BillingRecordFixture {
  recordNumber: string;
  facture: string;
  idRamq: string;
  dateService: string;
  debut: string;
  fin: string;
  periode: string;
  lieuPratique: string;
  secteurActivite: string;
  diagnostic: string;
  code: string;
  unites: string | null;
  role: string;
  elementContexte: string | null;
  montantPreliminaire: string;
  montantPaye: string;
  doctorInfo: string;
  devNote1?: string;
  devNote2?: string;
  devNote3?: string;
  agence?: string;
  patient: string;
  grandTotal?: string;
}

/**
 * Valid baseline billing record (all fields properly formatted)
 */
export const validBillingRecord: BillingRecordFixture = {
  recordNumber: "1",
  facture: "2024-INV-001",
  idRamq: "RAMQ-2024-001",
  dateService: "2024-10-01",
  debut: "09:00",
  fin: "09:15",
  periode: "AM",
  lieuPratique: "12345",
  secteurActivite: "CABINET",
  diagnostic: "A001",
  code: "15804",
  unites: "1",
  role: "1",
  elementContexte: "11",
  montantPreliminaire: "49,15",
  montantPaye: "49,15",
  doctorInfo: "Dr. Jean Tremblay",
  patient: "PATIENT-001",
  grandTotal: "49,15"
};

/**
 * Office Fee (Code 19928) Test Data
 *
 * Code 19928: Maximum 6 registered patients per day, $64.80 daily cap
 * Registered patients use contexts: 11, 12 (not G160/AR)
 */
export function createOfficeFeeRecords19928(
  count: number,
  date: string = "2024-10-01",
  doctor: string = "Dr. Jean Tremblay"
): BillingRecordFixture[] {
  return Array.from({ length: count }, (_, i) => ({
    recordNumber: String(i + 1),
    facture: `2024-INV-${String(i + 1).padStart(3, '0')}`,
    idRamq: `RAMQ-2024-${String(i + 1).padStart(3, '0')}`,
    dateService: date,
    debut: `${String(9 + i).padStart(2, '0')}:00`,
    fin: `${String(9 + i).padStart(2, '0')}:15`,
    periode: "AM",
    lieuPratique: "12345",
    secteurActivite: "CABINET",
    diagnostic: "A001",
    code: "19928",
    unites: "1",
    role: "1",
    elementContexte: "11", // Registered patient context
    montantPreliminaire: "10,80",
    montantPaye: "10,80",
    doctorInfo: doctor,
    patient: `PATIENT-${String(i + 1).padStart(3, '0')}`,
    grandTotal: "10,80"
  }));
}

/**
 * Office Fee (Code 19929) Test Data
 *
 * Code 19929: Maximum 12 registered patients per day, $64.80 daily cap
 * Registered patients use contexts: 11, 12 (not G160/AR)
 */
export function createOfficeFeeRecords19929(
  count: number,
  date: string = "2024-10-01",
  doctor: string = "Dr. Jean Tremblay"
): BillingRecordFixture[] {
  return Array.from({ length: count }, (_, i) => ({
    recordNumber: String(i + 1),
    facture: `2024-INV-${String(i + 1).padStart(3, '0')}`,
    idRamq: `RAMQ-2024-${String(i + 1).padStart(3, '0')}`,
    dateService: date,
    debut: `${String(9 + i).padStart(2, '0')}:00`,
    fin: `${String(9 + i).padStart(2, '0')}:15`,
    periode: "AM",
    lieuPratique: "12345",
    secteurActivite: "CABINET",
    diagnostic: "A001",
    code: "19929",
    unites: "1",
    role: "1",
    elementContexte: "12", // Registered patient context
    montantPreliminaire: "5,40",
    montantPaye: "5,40",
    doctorInfo: doctor,
    patient: `PATIENT-${String(i + 1).padStart(3, '0')}`,
    grandTotal: "5,40"
  }));
}

/**
 * Walk-in Patient Office Fee Records
 *
 * Walk-in patients use contexts: G160 or AR
 * Code 19928: Maximum 10 walk-in patients per day
 * Code 19929: Maximum 20 walk-in patients per day
 */
export function createWalkInOfficeFeeRecords(
  code: "19928" | "19929",
  count: number,
  date: string = "2024-10-01",
  doctor: string = "Dr. Jean Tremblay"
): BillingRecordFixture[] {
  const amount = code === "19928" ? "10,80" : "5,40";

  return Array.from({ length: count }, (_, i) => ({
    recordNumber: String(i + 1),
    facture: `2024-INV-${String(i + 1).padStart(3, '0')}`,
    idRamq: `RAMQ-2024-${String(i + 1).padStart(3, '0')}`,
    dateService: date,
    debut: `${String(14 + i).padStart(2, '0')}:00`,
    fin: `${String(14 + i).padStart(2, '0')}:15`,
    periode: "PM",
    lieuPratique: "12345",
    secteurActivite: "CABINET",
    diagnostic: "A001",
    code,
    unites: "1",
    role: "1",
    elementContexte: i % 2 === 0 ? "G160" : "AR", // Alternate between walk-in contexts
    montantPreliminaire: amount,
    montantPaye: amount,
    doctorInfo: doctor,
    patient: `PATIENT-WALKIN-${String(i + 1).padStart(3, '0')}`,
    grandTotal: amount
  }));
}

/**
 * Mixed office fee scenario (exceeds $64.80 daily cap)
 */
export function createMixedOfficeFeeScenario(
  date: string = "2024-10-01",
  doctor: string = "Dr. Jean Tremblay"
): BillingRecordFixture[] {
  return [
    // 6 x 19928 registered = $64.80 (at daily cap)
    ...createOfficeFeeRecords19928(6, date, doctor),
    // 1 additional 19928 registered = SHOULD FAIL
    ...createOfficeFeeRecords19928(1, date, doctor).map(r => ({
      ...r,
      recordNumber: "7",
      facture: "2024-INV-007",
      patient: "PATIENT-007"
    }))
  ];
}

/**
 * Records requiring units validation
 */
export const recordRequiringUnits: BillingRecordFixture = {
  recordNumber: "1",
  facture: "2024-INV-001",
  idRamq: "RAMQ-2024-001",
  dateService: "2024-10-01",
  debut: "09:00",
  fin: "09:30",
  periode: "AM",
  lieuPratique: "12345",
  secteurActivite: "CABINET",
  diagnostic: "A001",
  code: "TIME-BASED-CODE", // Placeholder for time-based code
  unites: null, // MISSING UNITS - SHOULD FAIL
  role: "1",
  elementContexte: "11",
  montantPreliminaire: "100,00",
  montantPaye: "100,00",
  doctorInfo: "Dr. Jean Tremblay",
  patient: "PATIENT-001"
};

export const recordWithValidUnits: BillingRecordFixture = {
  ...recordRequiringUnits,
  unites: "30" // Valid units
};

/**
 * Records for role restriction testing
 */
export const primaryPhysicianRecord: BillingRecordFixture = {
  recordNumber: "1",
  facture: "2024-INV-001",
  idRamq: "RAMQ-2024-001",
  dateService: "2024-10-01",
  debut: "09:00",
  fin: "09:30",
  periode: "AM",
  lieuPratique: "12345",
  secteurActivite: "CABINET",
  diagnostic: "A001",
  code: "PRIMARY-ONLY-CODE", // Code restricted to primary physicians
  unites: "1",
  role: "1", // Primary physician
  elementContexte: "11",
  montantPreliminaire: "150,00",
  montantPaye: "150,00",
  doctorInfo: "Dr. Jean Tremblay",
  patient: "PATIENT-001"
};

export const assistantPhysicianRecord: BillingRecordFixture = {
  ...primaryPhysicianRecord,
  recordNumber: "2",
  facture: "2024-INV-002",
  role: "2", // Assistant physician - SHOULD FAIL for primary-only codes
  doctorInfo: "Dr. Marie Leblanc (Assistant)"
};

/**
 * Records for context validation testing
 */
export const recordMissingRequiredContext: BillingRecordFixture = {
  recordNumber: "1",
  facture: "2024-INV-001",
  idRamq: "RAMQ-2024-001",
  dateService: "2024-10-01",
  debut: "09:00",
  fin: "09:15",
  periode: "AM",
  lieuPratique: "12345",
  secteurActivite: "CABINET",
  diagnostic: "A001",
  code: "CONTEXT-REQUIRED-CODE",
  unites: "1",
  role: "1",
  elementContexte: null, // MISSING REQUIRED CONTEXT - SHOULD FAIL
  montantPreliminaire: "75,00",
  montantPaye: "75,00",
  doctorInfo: "Dr. Jean Tremblay",
  patient: "PATIENT-001"
};

/**
 * Multiple visits same patient same day (requires context 85 for subsequent visits)
 */
export function createMultipleVisitsSamePatient(
  patient: string = "PATIENT-001",
  visitCount: number = 3,
  date: string = "2024-10-01"
): BillingRecordFixture[] {
  return Array.from({ length: visitCount }, (_, i) => ({
    recordNumber: String(i + 1),
    facture: `2024-INV-${String(i + 1).padStart(3, '0')}`,
    idRamq: `RAMQ-2024-${String(i + 1).padStart(3, '0')}`,
    dateService: date,
    debut: `${String(9 + i).padStart(2, '0')}:00`,
    fin: `${String(9 + i).padStart(2, '0')}:15`,
    periode: "AM",
    lieuPratique: "12345",
    secteurActivite: "CABINET",
    diagnostic: "A001",
    code: "15804",
    unites: "1",
    role: "1",
    // First visit: no context 85 (OK)
    // Subsequent visits: should have context 85
    elementContexte: i === 0 ? "11" : null, // Missing context 85 on 2nd+ visits - SHOULD FAIL
    montantPreliminaire: "49,15",
    montantPaye: "49,15",
    doctorInfo: "Dr. Jean Tremblay",
    patient,
    grandTotal: "49,15"
  }));
}

/**
 * Records for sector compliance testing
 */
export const hospitalUrgentCareRecord: BillingRecordFixture = {
  recordNumber: "1",
  facture: "2024-INV-001",
  idRamq: "RAMQ-2024-001",
  dateService: "2024-10-01",
  debut: "22:00",
  fin: "22:30",
  periode: "PM",
  lieuPratique: "54321",
  secteurActivite: "URGENCE", // Hospital urgent care sector
  diagnostic: "T001",
  code: "15804",
  unites: "1",
  role: "1",
  elementContexte: "11",
  montantPreliminaire: "49,15",
  montantPaye: "49,15",
  doctorInfo: "Dr. Jean Tremblay",
  patient: "PATIENT-001"
};

export const externalClinicRecord: BillingRecordFixture = {
  recordNumber: "1",
  facture: "2024-INV-001",
  idRamq: "RAMQ-2024-001",
  dateService: "2024-10-01",
  debut: "14:00",
  fin: "14:15",
  periode: "PM",
  lieuPratique: "98765",
  secteurActivite: "CLINIQUE_EXTERNE", // External clinic sector
  diagnostic: "B002",
  code: "15804",
  unites: "1",
  role: "1",
  elementContexte: "12",
  montantPreliminaire: "36,95",
  montantPaye: "36,95",
  doctorInfo: "Dr. Marie Leblanc",
  patient: "PATIENT-002"
};

/**
 * Amount validation records (expected vs actual)
 */
export const amountMismatchRecord: BillingRecordFixture = {
  recordNumber: "1",
  facture: "2024-INV-001",
  idRamq: "RAMQ-2024-001",
  dateService: "2024-10-01",
  debut: "09:00",
  fin: "09:15",
  periode: "AM",
  lieuPratique: "12345",
  secteurActivite: "CABINET",
  diagnostic: "A001",
  code: "15804",
  unites: "1",
  role: "1",
  elementContexte: "11",
  montantPreliminaire: "49,15", // Expected
  montantPaye: "30,00", // MISMATCH - SHOULD TRIGGER WARNING
  doctorInfo: "Dr. Jean Tremblay",
  patient: "PATIENT-001"
};

/**
 * Large dataset for performance testing
 */
export function createLargeBillingDataset(
  recordCount: number,
  date: string = "2024-10-01"
): BillingRecordFixture[] {
  return Array.from({ length: recordCount }, (_, i) => ({
    recordNumber: String(i + 1),
    facture: `2024-INV-${String(i + 1).padStart(6, '0')}`,
    idRamq: `RAMQ-2024-${String(i + 1).padStart(6, '0')}`,
    dateService: date,
    debut: `${String(9 + (i % 8)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`,
    fin: `${String(9 + (i % 8)).padStart(2, '0')}:${String((i % 4) * 15 + 15).padStart(2, '0')}`,
    periode: i % 2 === 0 ? "AM" : "PM",
    lieuPratique: String(12345 + (i % 10)),
    secteurActivite: "CABINET",
    diagnostic: `A${String((i % 100) + 1).padStart(3, '0')}`,
    code: i % 10 === 0 ? "19928" : i % 10 === 1 ? "19929" : "15804",
    unites: "1",
    role: i % 20 === 0 ? "2" : "1", // 5% assistants
    elementContexte: i % 5 === 0 ? "G160" : "11",
    montantPreliminaire: "49,15",
    montantPaye: "49,15",
    doctorInfo: `Dr. Doctor-${String((i % 50) + 1).padStart(2, '0')}`,
    patient: `PATIENT-${String((i % 500) + 1).padStart(4, '0')}`,
    grandTotal: "49,15"
  }));
}
