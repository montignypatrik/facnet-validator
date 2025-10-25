/**
 * Database Migration Script
 * Adds visit date and time fields to nam_extraction_results table
 *
 * Run with: npx tsx db/migrate-add-datetime-fields.ts
 *
 * This migration:
 * 1. Adds visitDate, visitTime, dateValid, timeValid fields
 * 2. Adds dateValidationError, timeValidationError fields
 * 3. Adds dateManuallyEdited, timeManuallyEdited fields
 * 4. Sets default values for existing records
 */

import { db } from "../server/core/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("[MIGRATION] Starting migration: add date/time fields to nam_extraction_results");

  try {
    // Add new columns to nam_extraction_results table
    console.log("[MIGRATION] Adding visitDate column...");
    await db.execute(sql`
      ALTER TABLE nam_extraction_results
      ADD COLUMN IF NOT EXISTS visit_date TEXT;
    `);

    console.log("[MIGRATION] Adding visitTime column...");
    await db.execute(sql`
      ALTER TABLE nam_extraction_results
      ADD COLUMN IF NOT EXISTS visit_time TEXT;
    `);

    console.log("[MIGRATION] Adding dateValid column...");
    await db.execute(sql`
      ALTER TABLE nam_extraction_results
      ADD COLUMN IF NOT EXISTS date_valid BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    console.log("[MIGRATION] Adding timeValid column...");
    await db.execute(sql`
      ALTER TABLE nam_extraction_results
      ADD COLUMN IF NOT EXISTS time_valid BOOLEAN NOT NULL DEFAULT TRUE;
    `);

    console.log("[MIGRATION] Adding dateValidationError column...");
    await db.execute(sql`
      ALTER TABLE nam_extraction_results
      ADD COLUMN IF NOT EXISTS date_validation_error TEXT;
    `);

    console.log("[MIGRATION] Adding timeValidationError column...");
    await db.execute(sql`
      ALTER TABLE nam_extraction_results
      ADD COLUMN IF NOT EXISTS time_validation_error TEXT;
    `);

    console.log("[MIGRATION] Adding dateManuallyEdited column...");
    await db.execute(sql`
      ALTER TABLE nam_extraction_results
      ADD COLUMN IF NOT EXISTS date_manually_edited BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    console.log("[MIGRATION] Adding timeManuallyEdited column...");
    await db.execute(sql`
      ALTER TABLE nam_extraction_results
      ADD COLUMN IF NOT EXISTS time_manually_edited BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    // Set default values for existing records
    console.log("[MIGRATION] Setting default values for existing records...");

    // Set default time to "08:00" for all existing records
    await db.execute(sql`
      UPDATE nam_extraction_results
      SET visit_time = '08:00', time_valid = TRUE
      WHERE visit_time IS NULL;
    `);

    // Set date validation error for records without dates
    await db.execute(sql`
      UPDATE nam_extraction_results
      SET date_validation_error = 'La date de visite est requise'
      WHERE visit_date IS NULL AND date_valid = FALSE;
    `);

    console.log("[MIGRATION] Migration completed successfully!");
    console.log("[MIGRATION] Summary:");
    console.log("  - Added visit_date column (TEXT, nullable)");
    console.log("  - Added visit_time column (TEXT, nullable)");
    console.log("  - Added date_valid column (BOOLEAN, default FALSE)");
    console.log("  - Added time_valid column (BOOLEAN, default TRUE)");
    console.log("  - Added date_validation_error column (TEXT, nullable)");
    console.log("  - Added time_validation_error column (TEXT, nullable)");
    console.log("  - Added date_manually_edited column (BOOLEAN, default FALSE)");
    console.log("  - Added time_manually_edited column (BOOLEAN, default FALSE)");
    console.log("  - Set default time '08:00' for existing records");

    process.exit(0);
  } catch (error: any) {
    console.error("[MIGRATION] Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrate();
