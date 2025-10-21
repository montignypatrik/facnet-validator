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
 * Generate SSV file content with header and data rows.
 *
 * @param nams - List of NAM strings to include in the SSV file
 * @returns Complete SSV file content as string with CRLF line endings
 *
 * SSV Structure:
 * - Row 1: Header row with 26 field names
 * - Row 2+: Data rows with NAM in column 5 (HIN field)
 *
 * Data Row Format (26 fields, NAM in position 5):
 *   ;;;;{NAM};;;;;;;;;;;;;;;;;;;;;
 *
 * Example Output:
 *   doctorLicenceID;doctorGroupNumber;ClaimDate;ProcedureTime;HIN;PatientGender;...
 *   ;;;;ABCD12345678;;;;;;;;;;;;;;;;;;;;;
 *   ;;;;WXYZ98765432;;;;;;;;;;;;;;;;;;;;;
 */
export function generateSSVContent(nams: string[]): string {
  if (!nams || nams.length === 0) {
    throw new Error("Cannot generate SSV file with empty NAM list");
  }

  // Start with header row
  const rows: string[] = [SSV_HEADER];

  // Generate data row for each NAM
  // Format: 4 empty fields, NAM in position 5, then 21 more empty fields
  for (const nam of nams) {
    // Create row with NAM in column 5 (HIN field)
    // Total 26 fields: 4 empty + 1 NAM + 21 empty
    const row = `;;;;${nam};;;;;;;;;;;;;;;;;;;;;`;
    rows.push(row);
  }

  // Join with Windows CRLF line endings
  const ssvContent = rows.join("\r\n") + "\r\n";

  return ssvContent;
}

/**
 * Generate a timestamped filename for SSV export.
 *
 * Format: nam-extraction-YYYY-MM-DD-HHMMSS.ssv
 * Example: nam-extraction-2025-10-15-143022.ssv
 *
 * @returns Filename string with .ssv extension
 */
export function generateSSVFilename(): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/T/, "-")
    .replace(/:/g, "")
    .replace(/\..+/, "")
    .slice(0, 17); // YYYY-MM-DD-HHMMSS

  return `nam-extraction-${timestamp}.ssv`;
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
