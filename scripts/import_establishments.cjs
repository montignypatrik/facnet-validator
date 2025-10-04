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

async function importEstablishments() {
  console.log('Starting RAMQ establishments import...');
  
  try {
    const csvText = fs.readFileSync('data/imports/RAMQ-establishments.csv', 'utf8');
    const records = parseCSV(csvText);
    
    console.log(`Parsed ${records.length} records`);
    
    let imported = 0;
    const batchSize = 25;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const values = [];
      
      for (const record of batch) {
        // Map CSV fields to establishments table schema
        const customFields = {
          region_id: record.region_id,
          numero_raw: record.numero_raw,
          addr_line1: record.addr_line1,
          city: record.city,
          province: record.province,
          postal_code: record.postal_code,
          care_unit_categories_raw: record.care_unit_categories_raw,
          facility_type_guess: record.facility_type_guess
        };
        
        // Use name or create a unique identifier
        const establishmentName = record.name || `Establishment-${record.numero_raw}-${i + values.length}`;
        
        values.push({
          name: establishmentName,
          type: record.facility_type_guess || 'Healthcare Facility',
          region: record.region_name || '',
          active: true, // Assume all are active unless specified
          notes: `Located in ${record.city}, ${record.province}`,
          custom_fields: JSON.stringify(customFields),
          updated_by: 'system_import'
        });
      }
      
      // Build bulk insert query
      const placeholders = values.map((_, index) => {
        const base = index * 7;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::jsonb, NOW(), $${base + 7})`;
      }).join(', ');
      
      const queryParams = values.flatMap(v => [
        v.name, v.type, v.region, v.active, v.notes, v.custom_fields, v.updated_by
      ]);
      
      const query = `
        INSERT INTO establishments (name, type, region, active, notes, custom_fields, updated_at, updated_by) 
        VALUES ${placeholders}
        ON CONFLICT (name) DO UPDATE SET
          type = EXCLUDED.type,
          region = EXCLUDED.region,
          active = EXCLUDED.active,
          notes = EXCLUDED.notes,
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
    
    console.log(`✅ Import completed! Total imported: ${imported} establishments`);
    
  } catch (error) {
    console.error('Import failed:', error);
  }
}

importEstablishments();