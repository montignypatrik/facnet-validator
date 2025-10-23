import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { BillingRecord, InsertBillingRecord } from "@shared/schema";
import { validationEngine } from './engine';
import { getAllValidationRules } from './ruleRegistry';
import { logger } from '../logger';
import { withSpan, withSpanSync } from '../../../observability';

// All validation rules are now hardcoded in TypeScript

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

  /**
   * Remove accents and corrupted characters from a string for normalized column matching
   * Example: "Montant payé" → "Montant paye"
   * Example: "Montant pay�" → "Montant paye"
   */
  private removeAccents(str: string): string {
    // First normalize and remove combining marks
    let normalized = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Handle UTF-8 replacement character read as Latin1: ï¿½ (bytes: ef bf bd)
    // This is the most common corruption when UTF-8 � is read as Latin1
    // Use explicit Unicode code points: ï=U+00EF, ¿=U+00BF, ½=U+00BD
    normalized = normalized.replace(/\u00EF\u00BF\u00BD/g, 'e');
    normalized = normalized.replace(/\uFFFD/g, 'e');  // Also handle actual � character

    // Replace common corrupted/accented characters with ASCII equivalents
    const replacements: { [key: string]: string } = {
      'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
      'à': 'a', 'â': 'a', 'ä': 'a',
      'ô': 'o', 'ö': 'o',
      'ù': 'u', 'û': 'u', 'ü': 'u',
      'î': 'i', 'ï': 'i',
      'ç': 'c',
    };

    for (const [accented, plain] of Object.entries(replacements)) {
      normalized = normalized.replace(new RegExp(accented, 'g'), plain);
    }

    return normalized;
  }

  /**
   * Detects the encoding of a CSV file by checking for BOM and analyzing byte patterns
   * Returns 'utf8' or 'latin1' (ISO-8859-1/Windows-1252)
   */
  private detectEncoding(filePath: string): BufferEncoding {
    const buffer = fs.readFileSync(filePath);

    // Check for UTF-8 BOM
    if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      console.log('[ENCODING] UTF-8 BOM detected');
      return 'utf8';
    }

    // Check for UTF-16 BOM
    if ((buffer[0] === 0xFF && buffer[1] === 0xFE) || (buffer[0] === 0xFE && buffer[1] === 0xFF)) {
      console.log('[ENCODING] UTF-16 BOM detected - using utf8 as fallback');
      return 'utf8';
    }

    // Look for high bytes (0x80-0xFF) in first 1000 bytes
    // These indicate extended characters (French accents in Quebec files)
    let highByteCount = 0;
    const checkLength = Math.min(1000, buffer.length);

    for (let i = 0; i < checkLength; i++) {
      if (buffer[i] >= 0x80 && buffer[i] <= 0xFF) {
        highByteCount++;
      }
    }

    // If we have extended characters and no UTF-8 BOM,
    // it's likely Latin1/Windows-1252 (common in Quebec)
    if (highByteCount > 0) {
      console.log(`[ENCODING] ${highByteCount} extended characters found - using Latin1 (ISO-8859-1)`);
      return 'latin1';
    }

    // Default to UTF-8 for ASCII-only files
    console.log('[ENCODING] No extended characters found - using UTF-8');
    return 'utf8';
  }

  async processBillingCSV(
    filePath: string,
    validationRunId: string,
    progressCallback?: (progress: number) => Promise<void>
  ): Promise<{
    records: BillingRecord[];
    errors: string[];
  }> {
    // Wrap entire CSV processing in a span for performance tracking
    return withSpan('csv.parse', {
      validationRunId,
      fileName: path.basename(filePath),
      fileSize: fs.statSync(filePath).size,
    }, async () => {
      const records: InsertBillingRecord[] = [];
      const errors: string[] = [];
      let rowNumber = 0;
      let totalRows = 0;

      const stats = fs.statSync(filePath);
      await logger.info(validationRunId, 'csvProcessor', 'Starting CSV processing', {
        fileName: path.basename(filePath),
        fileSize: stats.size,
      });

      // FORCE latin1 encoding for Quebec CSV files
      // Auto-detection was unreliable - UTF-8 detection breaks column parsing
      const encoding: BufferEncoding = 'latin1';
      await logger.debug(validationRunId, 'csvProcessor', `Using forced encoding: ${encoding}`, {
        encoding,
      });

      // Detect delimiter by reading first line with correct encoding
      const firstLine = fs.readFileSync(filePath, encoding).split('\n')[0];
      const delimiter = firstLine.includes(';') ? ';' : ',';
      await logger.debug(validationRunId, 'csvProcessor', `Detected CSV delimiter: "${delimiter}"`, {
        delimiter,
      });

    // Count total rows for progress calculation (quick pass)
    if (progressCallback) {
      const content = fs.readFileSync(filePath, encoding);
      totalRows = content.split('\n').filter(line => line.trim()).length - 1; // Exclude header
      await logger.debug(validationRunId, 'csvProcessor', `Total rows detected: ${totalRows}`, {
        totalRows,
      });
    }

      return new Promise((resolve, reject) => {
        fs.createReadStream(filePath, { encoding })
          .pipe(csv({ separator: delimiter }))
          .on('data', async (row: CSVRow) => {
            rowNumber++;

            // Calculate and report progress
            if (progressCallback && totalRows > 0 && rowNumber % 100 === 0) {
              // CSV parsing represents 0-50% of total progress
              const percentage = Math.min(Math.floor((rowNumber / totalRows) * 50), 50);
              try {
                await progressCallback(percentage);
              } catch (err) {
                console.error('Progress callback error:', err);
              }
            }

            // Privacy-safe: only log progress, no sensitive data
            if (rowNumber % 100 === 0) {
              logger.debug(validationRunId, 'csvProcessor', `Processing progress: ${rowNumber} rows`, {
                rowNumber,
                rowCount: records.length,
              }).catch(err => console.error('Logging error:', err));
            }

            try {
              const billingRecord = this.parseCSVRow(row, validationRunId, rowNumber);
              if (billingRecord) {
                records.push(billingRecord);
              } else {
                logger.debug(validationRunId, 'csvProcessor', `Skipped empty row ${rowNumber}`, {
                  rowNumber,
                }).catch(err => console.error('Logging error:', err));
              }
            } catch (error: any) {
              logger.warn(validationRunId, 'csvProcessor', `Parse error at row ${rowNumber}: ${error.message}`, {
                rowNumber,
                errorType: error.name,
              }).catch(err => console.error('Logging error:', err));
              errors.push(`Row ${rowNumber}: ${error.message}`);
            }
          })
          .on('end', async () => {
            await logger.info(validationRunId, 'csvProcessor', 'CSV parsing completed', {
              totalRows: rowNumber,
              rowCount: records.length,
              errorCount: errors.length,
            });

            // Report 50% progress when parsing is complete
            if (progressCallback) {
              try {
                await progressCallback(50);
              } catch (err) {
                console.error('Progress callback error:', err);
              }
            }

            resolve({
              records: records as BillingRecord[],
              errors
            });
          })
          .on('error', async (error: any) => {
            await logger.error(validationRunId, 'csvProcessor', `CSV parsing failed: ${error.message}`, {
              errorType: error.name,
            });
            reject(error);
          });
      });
    }); // End of withSpan wrapper
  }

  /**
   * Find a column value by fuzzy matching (case-insensitive, handles accents/corruption)
   */
  private getColumnValue(row: CSVRow, searchTerms: string[]): string | null {
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = this.removeAccents(key).toLowerCase();
      for (const term of searchTerms) {
        if (normalizedKey.includes(term.toLowerCase())) {
          return value;
        }
      }
    }
    return null;
  }

  private parseCSVRow(row: CSVRow, validationRunId: string, rowNumber: number): InsertBillingRecord | null {
    // Create normalized version of row with accent-free keys
    const normalizedRow: { [key: string]: string } = {};
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = this.removeAccents(key);
      normalizedRow[normalizedKey] = value;
    }

    // Debug: Log column names on first row using logger (async but fire-and-forget)
    if (rowNumber === 2) {
      const columns = Object.keys(row);
      const normalizedColumns = Object.keys(normalizedRow);

      // Find columns containing "Montant" or "paye"
      const montantColumns = normalizedColumns.filter(col => col.toLowerCase().includes('montant'));
      const payeColumns = normalizedColumns.filter(col => col.toLowerCase().includes('pay'));

      logger.info(validationRunId, 'csvProcessor', '[DEBUG CSV] Column inspection', {
        totalColumns: columns.length,
        originalColumns: columns,
        normalizedColumns: normalizedColumns,
        montantColumns,
        payeColumns,
        'Montant paye': normalizedRow['Montant paye'],
        'Montant Preliminaire': normalizedRow['Montant Preliminaire'],
        allNormalizedData: normalizedRow,
      }).catch(err => console.error('Logger error:', err));

      // Also console.log for immediate visibility
      console.log(`[DEBUG CSV] Original columns:`, columns);
      console.log(`[DEBUG CSV] Normalized columns:`, normalizedColumns);
      console.log(`[DEBUG CSV] Columns with 'montant':`, montantColumns);
      console.log(`[DEBUG CSV] Columns with 'pay':`, payeColumns);
      console.log(`[DEBUG CSV] Montant paye value:`, normalizedRow['Montant paye']);
      console.log(`[DEBUG CSV] Montant Preliminaire value:`, normalizedRow['Montant Preliminaire']);
    }

    // Skip empty rows (privacy-safe: no sensitive data logged)
    if (!normalizedRow['Facture'] && !normalizedRow['Code']) {
      console.log(`[DEBUG] Row ${rowNumber} skipped - no Facture or Code`);
      return null;
    }

    // Parse date
    let dateService: Date | null = null;
    if (normalizedRow['Date de Service']) {
      dateService = new Date(normalizedRow['Date de Service']);
      if (isNaN(dateService.getTime())) {
        throw new Error(`Invalid date format: ${normalizedRow['Date de Service']}`);
      }
    }

    // Parse amounts - handle Quebec format with comma or semicolon as decimal separator
    const parseAmount = (value: string): number | null => {
      if (!value) return null;
      // Remove currency symbols and spaces, then replace comma or semicolon with dot for decimal
      const cleaned = value.replace(/[$\s]/g, '').replace(/[,;]/, '.');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? null : parsed;
    };

    // Parse units
    const parseUnits = (value: string): number | null => {
      if (!value) return null;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? null : parsed;
    };

    // POSITION-BASED APPROACH: Use column index to get montant_paye
    // This bypasses ALL column name matching issues (encoding, spaces, etc.)
    // CSV structure: #, Facture, ID RAMQ, ..., Montant Preliminaire (pos 14), Montant paye (pos 15)
    let montantPayeValue: string | null = null;

    const columnValues = Object.values(row);
    const columnKeys = Object.keys(row);

    // Position 15 should be Montant paye (0-indexed)
    if (columnValues.length > 15) {
      montantPayeValue = columnValues[15] as string;
      console.log(`[POSITION-BASED] Row ${rowNumber}: Using position 15 for montant_paye = "${montantPayeValue}"`);
      console.log(`[POSITION-BASED] Column name at position 15: "${columnKeys[15]}"`);
    } else {
      console.log(`[ERROR] Row ${rowNumber}: Not enough columns (${columnValues.length}), expected at least 16`);
    }

    const debutValue = this.getColumnValue(row, ['debut']);

    return {
      validationRunId,
      recordNumber: rowNumber,
      facture: normalizedRow['Facture'] || null,
      idRamq: normalizedRow['ID RAMQ'] || null,
      dateService,
      debut: debutValue || normalizedRow['Debut'] || null,
      fin: normalizedRow['Fin'] || null,
      periode: normalizedRow['Periode'] || null,
      lieuPratique: normalizedRow['Lieu de pratique'] || null,
      secteurActivite: normalizedRow["Secteur d'activite"] || null,
      diagnostic: normalizedRow['Diagnostic'] || null,
      code: normalizedRow['Code'] || null,
      unites: parseUnits(normalizedRow['Unites']),
      role: normalizedRow['Role'] || null,
      elementContexte: normalizedRow['Element de contexte'] || null,
      montantPreliminaire: parseAmount(normalizedRow['Montant Preliminaire']),
      montantPaye: parseAmount(montantPayeValue),
      doctorInfo: normalizedRow['Doctor Info'] || null,
      patient: normalizedRow['Patient'] || null,
    };
  }

  async validateBillingRecords(records: BillingRecord[], validationRunId: string) {
    // Register all hardcoded validation rules
    await logger.debug(validationRunId, 'csvProcessor', 'Registering validation rules');

    validationEngine.clearRules();

    const rules = getAllValidationRules();
    for (const rule of rules) {
      validationEngine.registerRule(rule);
    }

    await logger.info(validationRunId, 'csvProcessor', `Registered ${rules.length} validation rules`, {
      ruleCount: rules.length,
    });

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