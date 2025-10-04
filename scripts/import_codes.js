import { readFileSync } from 'fs';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { db } from '../server/db.ts';
import { codes } from '../shared/schema.ts';
import 'dotenv/config';

async function importCodes() {
  console.log('Starting BD Code RAMQ import...');
  
  // Read CSV file
  const csvData = readFileSync('data/imports/RAMQ-codes.csv', 'utf8');
  
  const records = [];
  
  // Parse CSV
  const readable = Readable.from([csvData]);
  
  return new Promise((resolve, reject) => {
    readable
      .pipe(csvParser())
      .on('data', (row) => {
        // Skip rows with empty billing_code
        if (!row.billing_code || row.billing_code.trim() === '') {
          console.log('Skipping row with empty billing_code:', Object.keys(row));
          return;
        }

        // Map CSV fields to database schema
        const codeRecord = {
          code: row.billing_code.trim(),
          description: row.description || '',
          category: row.level1_group || '',
          place: row.place || '',
          tariffValue: row.tariff_value ? parseFloat(row.tariff_value) : null,
          extraUnitValue: row.extra_unit_value ? parseFloat(row.extra_unit_value) : null,
          unitRequire: row.unit_require === 'TRUE',
          sourceFile: row.source_file || '',
          topLevel: row.top_level || '',
          level1Group: row.level1_group || '',
          level2Group: row.level2_group || '',
          leaf: row.leaf || '',
          indicators: row.indicators || '',
          anchorId: row.anchor_id || '',
          active: true,
          customFields: {},
          updatedAt: new Date(),
          updatedBy: 'system_import'
        };

        records.push(codeRecord);
      })
      .on('end', async () => {
        try {
          console.log(`Parsed ${records.length} code records`);
          
          // Insert records in batches to avoid memory issues
          const batchSize = 100;
          let inserted = 0;
          
          for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            
            try {
              await db.insert(codes).values(batch);
              inserted += batch.length;
              console.log(`Inserted batch ${Math.floor(i/batchSize) + 1}, total: ${inserted}`);
            } catch (error) {
              console.error(`Error inserting batch:`, error);
              // Continue with next batch
            }
          }
          
          console.log(`✅ Import completed! Inserted ${inserted} code records`);
          resolve();
        } catch (error) {
          console.error('Error during import:', error);
          reject(error);
        }
      })
      .on('error', reject);
  });
}

// Run the import
importCodes()
  .then(() => {
    console.log('Import finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  });