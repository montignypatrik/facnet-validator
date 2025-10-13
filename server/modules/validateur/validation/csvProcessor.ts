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

      // Auto-detect encoding (UTF-8 vs Latin1) with tracing
      const encoding = withSpanSync('csv.detect_encoding', {}, () => {
        return this.detectEncoding(filePath);
      });
      await logger.debug(validationRunId, 'csvProcessor', `Detected encoding: ${encoding}`, {
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

  private parseCSVRow(row: CSVRow, validationRunId: string, rowNumber: number): InsertBillingRecord | null {
    // Skip empty rows (privacy-safe: no sensitive data logged)
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