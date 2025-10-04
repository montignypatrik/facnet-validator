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

async function importCodes() {
  console.log('Starting RAMQ codes import...');

  await client.connect();

  try {
    // Clear existing codes
    console.log('🗑️  Clearing existing codes...');
    await client.query('TRUNCATE TABLE codes CASCADE');
    console.log('✅ Table cleared');

    const csvText = fs.readFileSync('data/imports/ramq_codes.csv', 'utf8');
    const records = parseCSV(csvText);

    console.log(`Parsed ${records.length} code records`);

    let imported = 0;
    const batchSize = 100;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const values = [];

      for (const record of batch) {
        // Skip empty billing codes
        if (!record.billing_code || record.billing_code.trim() === '') {
          continue;
        }

        values.push({
          code: record.billing_code,
          description: record.description || '',
          category: record.level1_group || '',
          place: record.place || '',
          tariff_value: record.tariff_value || null,
          extra_unit_value: record.extra_unit_value || null,
          unit_require: record.unit_require === 'True' || record.unit_require === 'TRUE',
          source_file: record.source_file || '',
          top_level: record.top_level || '',
          level1_group: record.level1_group || '',
          level2_group: record.level2_group || '',
          leaf: record.leaf || '',
          indicators: record.indicators || '',
          anchor_id: record.anchor_id || ''
        });
      }

      if (values.length === 0) continue;

      // Build bulk insert query
      const placeholders = values.map((_, index) => {
        const base = index * 14;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, NOW(), 'system_import')`;
      }).join(', ');

      const queryParams = values.flatMap(v => [
        v.code, v.description, v.category, v.place, v.tariff_value, v.extra_unit_value,
        v.unit_require, v.source_file, v.top_level, v.level1_group, v.level2_group,
        v.leaf, v.indicators, v.anchor_id
      ]);

      const query = `
        INSERT INTO codes (
          code, description, category, place, tariff_value, extra_unit_value,
          unit_require, source_file, top_level, level1_group, level2_group,
          leaf, indicators, anchor_id, updated_at, updated_by
        )
        VALUES ${placeholders}
      `;

      try {
        await client.query(query, queryParams);
        imported += values.length;
        console.log(`Imported batch ${Math.floor(i/batchSize) + 1}: ${imported} total`);
      } catch (error) {
        console.error(`Error with batch ${Math.floor(i/batchSize) + 1}:`, error.message);
      }
    }

    console.log(`✅ Import completed! Total imported: ${imported} codes`);

  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await client.end();
  }
}

importCodes();
