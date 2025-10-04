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

async function importEstablishments() {
  console.log('Starting RAMQ establishments import...');

  await client.connect();

  try {
    const csvText = fs.readFileSync('data/imports/etablissement.csv', 'utf8');
    const records = parseCSV(csvText);

    console.log(`Parsed ${records.length} establishment records`);

    let imported = 0;
    const batchSize = 50;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const values = [];

      for (const record of batch) {
        const numero = record.numero;
        const nom = record.nom;

        if (!numero) continue;

        // Store all sector info and codes in custom_fields
        const customFields = {
          numero: numero,
          secteur_0: record.secteur_0 === 'True',
          secteur_1: record.secteur_1 === 'True',
          secteur_2: record.secteur_2 === 'True',
          secteur_3: record.secteur_3 === 'True',
          secteur_4: record.secteur_4 === 'True',
          secteur_5: record.secteur_5 === 'True',
          secteur_6: record.secteur_6 === 'True',
          secteur_7: record.secteur_7 === 'True',
          secteur_8: record.secteur_8 === 'True',
          EP_29: record.EP_29 === 'True',
          LE_327: record.LE_327 === 'True',
          EP_33: record.EP_33 === 'True',
          EP_54: record.EP_54 === 'True',
          EP_42_GMFU: record.EP_42_GMFU || '',
          EP_42_List: record.EP_42_List || ''
        };

        // Use numero and nom to create unique name
        const name = nom ? `${numero} - ${nom}` : numero;

        values.push({
          name: name,
          type: 'Healthcare Facility',
          region: record.region || '',
          custom_fields: JSON.stringify(customFields)
        });
      }

      if (values.length === 0) continue;

      // Build bulk insert query
      const placeholders = values.map((_, index) => {
        const base = index * 4;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::jsonb, NOW(), 'system_import')`;
      }).join(', ');

      const queryParams = values.flatMap(v => [
        v.name, v.type, v.region, v.custom_fields
      ]);

      const query = `
        INSERT INTO establishments (name, type, region, custom_fields, updated_at, updated_by)
        VALUES ${placeholders}
        ON CONFLICT (name) DO UPDATE SET
          type = EXCLUDED.type,
          region = EXCLUDED.region,
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

    console.log(`✅ Import completed! Total imported: ${imported} establishments`);

  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await client.end();
  }
}

importEstablishments();
