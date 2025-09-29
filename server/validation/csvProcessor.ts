import csv from 'csv-parser';
import fs from 'fs';
import { BillingRecord, InsertBillingRecord } from "../../shared/schema";
import { validationEngine } from './engine';
import { loadDatabaseRules } from './databaseRuleLoader';

// Database rules will be loaded dynamically

export interface CSVRow {
  '#': string;
  'Facture': string;
  'ID RAMQ': string;
  'Date de Service': string;
  'Début': string;
  'Fin': string;
  'Periode': string;
  'Lieu de pratique': string;
  "Secteur d'activité": string;
  'Diagnostic': string;
  'Code': string;
  'Unités': string;
  'Rôle': string;
  'Élement de contexte': string;
  'Montant Preliminaire': string;
  'Montant payé': string;
  'Doctor Info': string;
  'Patient': string;
  [key: string]: string; // For other columns we don't care about
}

export class BillingCSVProcessor {

  async processBillingCSV(filePath: string, validationRunId: string): Promise<{
    records: BillingRecord[];
    errors: string[];
  }> {
    const records: InsertBillingRecord[] = [];
    const errors: string[] = [];
    let rowNumber = 0;

    console.log(`[DEBUG] Starting CSV processing for file: ${filePath}`);

    // Detect delimiter by reading first line
    const firstLine = fs.readFileSync(filePath, 'utf8').split('\n')[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';
    console.log(`[DEBUG] Detected CSV delimiter: "${delimiter}"`);

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv({ separator: delimiter }))
        .on('data', (row: CSVRow) => {
          rowNumber++;
          console.log(`[DEBUG] Processing row ${rowNumber}:`, Object.keys(row));
          console.log(`[DEBUG] Row data sample:`, {
            facture: row['Facture'],
            code: row['Code'],
            idRamq: row['ID RAMQ'],
            hasKeys: Object.keys(row).length
          });

          try {
            const billingRecord = this.parseCSVRow(row, validationRunId, rowNumber);
            if (billingRecord) {
              records.push(billingRecord);
              console.log(`[DEBUG] Successfully parsed row ${rowNumber}`);
            } else {
              console.log(`[DEBUG] Row ${rowNumber} was skipped (empty)`);
            }
          } catch (error) {
            console.log(`[DEBUG] Error parsing row ${rowNumber}:`, error.message);
            errors.push(`Row ${rowNumber}: ${error.message}`);
          }
        })
        .on('end', () => {
          resolve({
            records: records as BillingRecord[], // Type assertion for now
            errors
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  private parseCSVRow(row: CSVRow, validationRunId: string, rowNumber: number): InsertBillingRecord | null {
    // Skip empty rows
    console.log(`[DEBUG] parseCSVRow - checking row ${rowNumber}:`, {
      facture: row['Facture'],
      code: row['Code'],
      isEmpty: !row['Facture'] && !row['Code']
    });

    if (!row['Facture'] && !row['Code']) {
      console.log(`[DEBUG] Row ${rowNumber} skipped - no Facture or Code`);
      return null;
    }

    // Parse date
    let dateService: Date | null = null;
    if (row['Date de Service']) {
      dateService = new Date(row['Date de Service']);
      if (isNaN(dateService.getTime())) {
        throw new Error(`Invalid date format: ${row['Date de Service']}`);
      }
    }

    // Parse amounts - handle Quebec format with comma as decimal separator
    const parseAmount = (value: string): number | null => {
      if (!value) return null;
      // Remove currency symbols and spaces, then replace comma with dot for decimal
      const cleaned = value.replace(/[$\s]/g, '').replace(',', '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    };

    // Parse units
    const parseUnits = (value: string): number | null => {
      if (!value) return null;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };

    return {
      validationRunId,
      recordNumber: rowNumber,
      facture: row['Facture'] || null,
      idRamq: row['ID RAMQ'] || null,
      dateService,
      debut: row['Début'] || null,
      fin: row['Fin'] || null,
      periode: row['Periode'] || null,
      lieuPratique: row['Lieu de pratique'] || null,
      secteurActivite: row["Secteur d'activité"] || null,
      diagnostic: row['Diagnostic'] || null,
      code: row['Code'] || null,
      unites: parseUnits(row['Unités']),
      role: row['Rôle'] || null,
      elementContexte: row['Élement de contexte'] || null,
      montantPreliminaire: parseAmount(row['Montant Preliminaire']),
      montantPaye: parseAmount(row['Montant payé']),
      doctorInfo: row['Doctor Info'] || null,
      patient: row['Patient'] || null,
    };
  }

  async validateBillingRecords(records: BillingRecord[], validationRunId: string) {
    // Load rules from database and register them
    console.log('[RULES] Loading validation rules from database...');
    const databaseRules = await loadDatabaseRules();

    // Clear existing rules
    validationEngine.clearRules();

    // If no database rules exist, fall back to hardcoded rule for compatibility
    if (databaseRules.length === 0) {
      console.log('[RULES] No database rules found, falling back to hardcoded office fee rule');
      const { officeFeeValidationRule } = await import('./rules/officeFeeRule');
      validationEngine.registerRule(officeFeeValidationRule);
      console.log(`[RULES] Registered 1 fallback rule`);
    } else {
      // Register database rules
      for (const rule of databaseRules) {
        validationEngine.registerRule(rule);
      }
      console.log(`[RULES] Registered ${databaseRules.length} database rules`);
    }

    return await validationEngine.validateRecords(records, validationRunId);
  }

  // Clean up CSV file after processing
  async cleanupCSVFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[SECURITY] CSV file deleted: ${filePath}`);
      }
    } catch (error) {
      console.error(`[SECURITY] Failed to delete CSV file ${filePath}:`, error);
    }
  }
}