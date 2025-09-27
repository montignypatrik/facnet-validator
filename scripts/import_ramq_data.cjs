const fs = require('fs');
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',');
  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim()) {
      const values = parseCSVLine(lines[i]);
      if (values.length === headers.length) {
        const record = {};
        headers.forEach((header, index) => {
          record[header.trim()] = values[index] ? values[index].trim() : '';
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
        i++; // Skip next quote
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
  result.push(current); // Push the last field
  return result;
}

async function importCodes() {
  console.log('Starting BD Code RAMQ import...');
  
  try {
    const csvText = fs.readFileSync('../attached_assets/BD Code RAMQ - ramq_all (1)_1758943164183.csv', 'utf8');
    const records = parseCSV(csvText);
    
    console.log(`Parsed ${records.length} records`);
    
    let imported = 0;
    const batchSize = 50;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const values = [];
      
      for (const record of batch) {
        const billingCode = record.billing_code;
        const place = record.place || 'all';
        
        // Create composite code for uniqueness
        const code = place === 'all' ? billingCode : `${billingCode}-${place}`;
        
        const customFields = {
          billing_code: billingCode,
          place: place,
          tariff_value: record.tariff_value,
          extra_unit_value: record.extra_unit_value,
          source_file: record.source_file,
          top_level: record.top_level,
          level1_group: record.level1_group,
          level2_group: record.level2_group,
          leaf: record.leaf,
          indicators: record.indicators,
          anchor_id: record.anchor_id
        };
        
        values.push({
          code: code,
          description: record.description || '',
          category: place,
          active: record.unit_require === 'FALSE',
          custom_fields: JSON.stringify(customFields),
          updated_by: 'system_import'
        });
      }
      
      // Build bulk insert query
      const placeholders = values.map((_, index) => {
        const base = index * 6;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::jsonb, NOW(), $${base + 6})`;
      }).join(', ');
      
      const queryParams = values.flatMap(v => [
        v.code, v.description, v.category, v.active, v.custom_fields, v.updated_by
      ]);
      
      const query = `
        INSERT INTO codes (code, description, category, active, custom_fields, updated_at, updated_by) 
        VALUES ${placeholders}
        ON CONFLICT (code) DO UPDATE SET
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          active = EXCLUDED.active,
          custom_fields = EXCLUDED.custom_fields,
          updated_at = EXCLUDED.updated_at,
          updated_by = EXCLUDED.updated_by
      `;
      
      try {
        await sql(query, queryParams);
        imported += batch.length;
        console.log(`Imported batch ${Math.floor(i/batchSize) + 1}: ${imported} total`);
      } catch (error) {
        console.error(`Error with batch ${Math.floor(i/batchSize) + 1}:`, error.message);
      }
    }
    
    console.log(`✅ Import completed! Total imported: ${imported} codes`);
    
  } catch (error) {
    console.error('Import failed:', error);
  }
}

importCodes();