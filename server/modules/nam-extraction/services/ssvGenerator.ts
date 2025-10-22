/**
 * SSV file generation service for Quebec medical billing format.
 *
 * SSV Format:
 * - Semicolon-delimited (;) values
 * - 26 fields total per row
 * - Header row with field names
 * - Data rows with NAM in column 5 (HIN field)
 * - Windows CRLF line endings (\r\n)
 * - UTF-8 encoding
 */

import { SSV_HEADER_FIELDS } from "../types";

/**
 * SSV header row with all 26 fields in exact order
 */
const SSV_HEADER = SSV_HEADER_FIELDS.join(";");

/**
 * NAM data for SSV generation with visit date and time
 */
export interface NAMDataForSSV {
  nam: string;
  visitDate: string; // YYYY-MM-DD format
  visitTime: string; // HH:MM 24h format
}

/**
 * Doctor information for CSV export (columns 1, 2, 11)
 */
export interface DoctorInfoForCSV {
  doctorLicenceID: string; // Column 1: 7-digit doctor license number
  doctorGroupNumber: string; // Column 2: 5-digit group number or "0"
  sector: string; // Column 11: Sector value 0-7
}

/**
 * Generate SSV file content with header and data rows.
 *
 * @param namData - List of NAM data objects (nam, visitDate, visitTime) to include in the SSV file
 * @returns Complete SSV file content as string with CRLF line endings
 *
 * SSV Structure:
 * - Row 1: Header row with 26 field names
 * - Row 2+: Data rows with date, time, and NAM in columns 3, 4, 5
 *
 * Data Row Format (26 fields):
 *   {doctorLicenceID};{doctorGroupNumber};{ClaimDate};{ProcedureTime};{NAM};;;;;{Sector};;;;;;;;;;;;;;;
 *
 * Example Output:
 *   doctorLicenceID;doctorGroupNumber;ClaimDate;ProcedureTime;HIN;PatientGender;...;Sector;...
 *   1234567;12345;2025-01-21;08:00;ABCD12345678;;;;;3;;;;;;;;;;;;;;;
 *   1234567;12345;2025-01-22;14:30;WXYZ98765432;;;;;3;;;;;;;;;;;;;;;
 */
export function generateSSVContent(namData: NAMDataForSSV[], doctorInfo: DoctorInfoForCSV): string {
  if (!namData || namData.length === 0) {
    throw new Error("Cannot generate SSV file with empty NAM list");
  }

  // Start with header row
  const rows: string[] = [SSV_HEADER];

  // Generate data row for each NAM with doctor info, date, time, and sector
  // Format: doctorLicenceID (col 1), doctorGroupNumber (col 2), date (col 3), time (col 4),
  //         NAM (col 5), 5 empty (cols 6-10), sector (col 11), 15 empty (cols 12-26)
  for (const data of namData) {
    // Create row with all populated fields in correct positions
    // Total 26 fields: license + group + date + time + NAM + 5 empty + sector + 15 empty
    const row = `${doctorInfo.doctorLicenceID};${doctorInfo.doctorGroupNumber};${data.visitDate};${data.visitTime};${data.nam};;;;;${doctorInfo.sector};;;;;;;;;;;;;;;`;
    rows.push(row);
  }

  // Join with Windows CRLF line endings
  const ssvContent = rows.join("\r\n") + "\r\n";

  return ssvContent;
}

/**
 * Generate a timestamped filename for SSV export.
 *
 * Format: nam-extraction-YYYY-MM-DD-HHMMSS.csv
 * Example: nam-extraction-2025-10-15-143022.csv
 *
 * @returns Filename string with .csv extension
 */
export function generateSSVFilename(): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/T/, "-")
    .replace(/:/g, "")
    .replace(/\..+/, "")
    .slice(0, 17); // YYYY-MM-DD-HHMMSS

  return `nam-extraction-${timestamp}.csv`;
}

/**
 * Count the number of semicolon-delimited fields in an SSV row.
 *
 * @param ssvRow - A single row from an SSV file
 * @returns Number of fields in the row
 *
 * This is useful for validation to ensure rows have exactly 26 fields.
 */
export function countSSVFields(ssvRow: string): number {
  // Split by semicolon - the count is splits + 1
  // But for empty trailing field, we count actual semicolons + 1
  return (ssvRow.match(/;/g) || []).length + 1;
}

/**
 * Validate that SSV content has correct format.
 *
 * Checks:
 * - At least 2 rows (header + 1 data row)
 * - Header matches expected format
 * - All rows have 26 fields
 * - Uses CRLF line endings
 *
 * @param ssvContent - The complete SSV file content
 * @returns True if valid, False otherwise
 */
export function validateSSVFormat(ssvContent: string): boolean {
  // Check for CRLF line endings
  if (!ssvContent.includes("\r\n")) {
    return false;
  }

  // Split into rows
  const rows = ssvContent.trim().split("\r\n");

  // Must have at least header + 1 data row
  if (rows.length < 2) {
    return false;
  }

  // Check header
  if (rows[0] !== SSV_HEADER) {
    return false;
  }

  // Check all rows have 26 fields
  for (const row of rows) {
    if (row && countSSVFields(row) !== 26) {
      return false;
    }
  }

  return true;
}
