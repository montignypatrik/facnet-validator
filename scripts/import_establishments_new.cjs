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

        // Use numero and nom to create unique name
        const name = nom ? `${numero} - ${nom}` : numero;

        values.push({
          name: name,
          numero: numero,
          nom: nom || '',
          type: 'Healthcare Facility',
          region: record.region || '',
          secteur_0: record.secteur_0 === 'True',
          secteur_1: record.secteur_1 === 'True',
          secteur_2: record.secteur_2 === 'True',
          secteur_3: record.secteur_3 === 'True',
          secteur_4: record.secteur_4 === 'True',
          secteur_5: record.secteur_5 === 'True',
          secteur_6: record.secteur_6 === 'True',
          secteur_7: record.secteur_7 === 'True',
          secteur_8: record.secteur_8 === 'True',
          ep_29: record.EP_29 === 'True',
          le_327: record.LE_327 === 'True',
          ep_33: record.EP_33 === 'True',
          ep_54: record.EP_54 === 'True',
          ep_42_gmfu: record.EP_42_GMFU || '',
          ep_42_list: record.EP_42_List || ''
        });
      }

      if (values.length === 0) continue;

      // Build bulk insert query with all establishment fields
      const placeholders = values.map((_, index) => {
        const base = index * 20;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17}, $${base + 18}, $${base + 19}, $${base + 20}, NOW(), 'system_import')`;
      }).join(', ');

      const queryParams = values.flatMap(v => [
        v.name, v.numero, v.nom, v.type, v.region,
        v.secteur_0, v.secteur_1, v.secteur_2, v.secteur_3, v.secteur_4,
        v.secteur_5, v.secteur_6, v.secteur_7, v.secteur_8,
        v.ep_29, v.le_327, v.ep_33, v.ep_54, v.ep_42_gmfu, v.ep_42_list
      ]);

      const query = `
        INSERT INTO establishments (
          name, numero, nom, type, region,
          secteur_0, secteur_1, secteur_2, secteur_3, secteur_4,
          secteur_5, secteur_6, secteur_7, secteur_8,
          ep_29, le_327, ep_33, ep_54, ep_42_gmfu, ep_42_list,
          updated_at, updated_by
        )
        VALUES ${placeholders}
        ON CONFLICT (name) DO UPDATE SET
          numero = EXCLUDED.numero,
          nom = EXCLUDED.nom,
          type = EXCLUDED.type,
          region = EXCLUDED.region,
          secteur_0 = EXCLUDED.secteur_0,
          secteur_1 = EXCLUDED.secteur_1,
          secteur_2 = EXCLUDED.secteur_2,
          secteur_3 = EXCLUDED.secteur_3,
          secteur_4 = EXCLUDED.secteur_4,
          secteur_5 = EXCLUDED.secteur_5,
          secteur_6 = EXCLUDED.secteur_6,
          secteur_7 = EXCLUDED.secteur_7,
          secteur_8 = EXCLUDED.secteur_8,
          ep_29 = EXCLUDED.ep_29,
          le_327 = EXCLUDED.le_327,
          ep_33 = EXCLUDED.ep_33,
          ep_54 = EXCLUDED.ep_54,
          ep_42_gmfu = EXCLUDED.ep_42_gmfu,
          ep_42_list = EXCLUDED.ep_42_list,
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
