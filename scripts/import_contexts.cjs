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

async function importContexts() {
  console.log('Starting BD element de contexte import...');
  
  try {
    const csvText = fs.readFileSync('../attached_assets/BD element de contexte - ramq_elements_contexte_1758943164184.csv', 'utf8');
    const records = parseCSV(csvText);
    
    console.log(`Parsed ${records.length} records`);
    
    let imported = 0;
    const batchSize = 25;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const values = [];
      
      for (const record of batch) {
        // Map CSV fields to contexts table schema
        const customFields = {
          element_code: record.element_code,
          element_description: record.element_description,
          top_level: record.top_level,
          level1_group: record.level1_group,
          level2_group: record.level2_group,
          level3_group: record.level3_group,
          source_file: record.source_file,
          indicators: record.indicators,
          anchor_id: record.anchor_id
        };
        
        // Use element_code or element_description as name
        const name = record.element_code || record.element_description || `context_${imported + values.length + 1}`;
        
        values.push({
          name: name,
          description: record.element_description || record.element_code || '',
          tags: record.level1_group ? [record.level1_group, record.level2_group, record.level3_group].filter(Boolean) : null,
          custom_fields: JSON.stringify(customFields),
          updated_by: 'system_import'
        });
      }
      
      // Build bulk insert query
      const placeholders = values.map((_, index) => {
        const base = index * 5;
        return `($${base + 1}, $${base + 2}, $${base + 3}::text[], $${base + 4}::jsonb, NOW(), $${base + 5})`;
      }).join(', ');
      
      const queryParams = values.flatMap(v => [
        v.name, v.description, v.tags, v.custom_fields, v.updated_by
      ]);
      
      const query = `
        INSERT INTO contexts (name, description, tags, custom_fields, updated_at, updated_by) 
        VALUES ${placeholders}
        ON CONFLICT (name) DO UPDATE SET
          description = EXCLUDED.description,
          tags = EXCLUDED.tags,
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
    
    console.log(`✅ Import completed! Total imported: ${imported} contexts`);
    
  } catch (error) {
    console.error('Import failed:', error);
  }
}

importContexts();