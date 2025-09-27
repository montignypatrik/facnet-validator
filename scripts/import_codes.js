import { readFileSync } from 'fs';
import { parse } from 'csv-parser';
import { Readable } from 'stream';
import { db } from '../server/db.js';
import { codes } from '../shared/schema.js';

async function importCodes() {
  console.log('Starting BD Code RAMQ import...');
  
  // Read CSV file
  const csvData = readFileSync('attached_assets/BD Code RAMQ - ramq_all (1)_1758943164183.csv', 'utf8');
  
  const records = [];
  
  // Parse CSV
  const readable = Readable.from([csvData]);
  
  return new Promise((resolve, reject) => {
    readable
      .pipe(parse({ headers: true }))
      .on('data', (row) => {
        // Map CSV fields to database schema
        const codeRecord = {
          code: row.billing_code,
          description: row.description || '',
          category: row.place || '',
          active: row.unit_require === 'FALSE', // Inverted logic: FALSE in CSV means active=true
          customFields: {
            tariff_value: row.tariff_value,
            extra_unit_value: row.extra_unit_value,
            source_file: row.source_file,
            top_level: row.top_level,
            level1_group: row.level1_group,
            level2_group: row.level2_group,
            leaf: row.leaf,
            indicators: row.indicators,
            anchor_id: row.anchor_id
          },
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