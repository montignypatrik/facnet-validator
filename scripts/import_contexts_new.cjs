const fs = require('fs');
const { Client } = require('pg');
require('dotenv/config');

const client = new Client({ connectionString: process.env.DATABASE_URL });

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = parseCSVLine(lines[i]);
      if (values.length >= headers.length) {
        const record = {};
        headers.forEach((header, index) => {
          record[header] = values[index] ? values[index].trim() : '';
        });
        records.push(record);
      }
    }
  }
  return records;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

async function importContexts() {
  console.log('Starting RAMQ contexts import...');

  await client.connect();

  try {
    const csvText = fs.readFileSync('data/imports/contexte.csv', 'utf8');
    const records = parseCSV(csvText);

    console.log(`Parsed ${records.length} context records`);

    let imported = 0;
    const batchSize = 50;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const values = [];

      for (const record of batch) {
        // Use 'codes' column as the context code/name
        const contextCode = record.codes || record['#'];
        if (!contextCode) continue;

        // Store additional info in custom_fields
        const customFields = {
          code: contextCode,
          hash: record['#'] || '',
          end_date: record['date de fin'] || ''
        };

        values.push({
          name: contextCode,
          description: record['elements de contexte'] || '',
          custom_fields: JSON.stringify(customFields)
        });
      }

      if (values.length === 0) continue;

      // Build bulk insert query
      const placeholders = values.map((_, index) => {
        const base = index * 3;
        return `($${base + 1}, $${base + 2}, $${base + 3}::jsonb, NOW(), 'system_import')`;
      }).join(', ');

      const queryParams = values.flatMap(v => [
        v.name, v.description, v.custom_fields
      ]);

      const query = `
        INSERT INTO contexts (name, description, custom_fields, updated_at, updated_by)
        VALUES ${placeholders}
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          custom_fields = EXCLUDED.custom_fields,
          updated_at = EXCLUDED.updated_at,
          updated_by = EXCLUDED.updated_by
      `;

      try {
        await client.query(query, queryParams);
        imported += values.length;
        console.log(`Imported batch ${Math.floor(i/batchSize) + 1}: ${imported} total`);
      } catch (error) {
        console.error(`Error with batch ${Math.floor(i/batchSize) + 1}:`, error.message);
      }
    }

    console.log(`✅ Import completed! Total imported: ${imported} contexts`);

  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await client.end();
  }
}

importContexts();
