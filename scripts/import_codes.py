#!/usr/bin/env python3

import csv
import json
import psycopg2
import os
from urllib.parse import urlparse

# Parse DATABASE_URL
DATABASE_URL = os.environ['DATABASE_URL']
url = urlparse(DATABASE_URL)

# Connect to database
conn = psycopg2.connect(
    host=url.hostname,
    port=url.port,
    user=url.username,
    password=url.password,
    database=url.path[1:]  # Remove leading slash
)
cur = conn.cursor()

print("Starting BD Code RAMQ import...")

# Read and process CSV
with open('attached_assets/BD Code RAMQ - ramq_all (1)_1758943164183.csv', 'r', encoding='utf-8') as file:
    reader = csv.DictReader(file)
    
    batch = []
    count = 0
    
    for row in reader:
        # Create composite code: billing_code + place (for uniqueness)
        billing_code = row['billing_code']
        place = row['place'] or 'all'
        
        # Use the billing_code with place suffix for uniqueness
        if place == 'all':
            code = billing_code
        else:
            code = f"{billing_code}-{place}"
        
        # Map CSV fields to database schema
        record = {
            'code': code,
            'description': row['description'] or '',
            'category': place,
            'active': row['unit_require'] == 'FALSE',  # FALSE in CSV = active
            'custom_fields': json.dumps({
                'billing_code': billing_code,
                'place': place,
                'tariff_value': row['tariff_value'],
                'extra_unit_value': row['extra_unit_value'],
                'source_file': row['source_file'],
                'top_level': row['top_level'],
                'level1_group': row['level1_group'],
                'level2_group': row['level2_group'],
                'leaf': row['leaf'],
                'indicators': row['indicators'],
                'anchor_id': row['anchor_id']
            }),
            'updated_by': 'system_import'
        }
        
        batch.append(record)
        
        # Insert in batches of 100
        if len(batch) >= 100:
            try:
                # Use execute_values for efficient batch insert
                from psycopg2.extras import execute_values
                
                execute_values(
                    cur,
                    """
                    INSERT INTO codes (code, description, category, active, custom_fields, updated_at, updated_by)
                    VALUES %s
                    ON CONFLICT (code) DO UPDATE SET
                        description = EXCLUDED.description,
                        category = EXCLUDED.category,
                        active = EXCLUDED.active,
                        custom_fields = EXCLUDED.custom_fields,
                        updated_at = EXCLUDED.updated_at,
                        updated_by = EXCLUDED.updated_by
                    """,
                    [(r['code'], r['description'], r['category'], r['active'], 
                      r['custom_fields'], 'NOW()', r['updated_by']) for r in batch],
                    template=None
                )
                
                count += len(batch)
                print(f"Inserted batch: {count} records")
                conn.commit()
                
            except Exception as e:
                print(f"Error inserting batch: {e}")
                conn.rollback()
            
            batch = []
    
    # Insert remaining records
    if batch:
        try:
            from psycopg2.extras import execute_values
            
            execute_values(
                cur,
                """
                INSERT INTO codes (code, description, category, active, custom_fields, updated_at, updated_by)
                VALUES %s
                ON CONFLICT (code) DO UPDATE SET
                    description = EXCLUDED.description,
                    category = EXCLUDED.category,
                    active = EXCLUDED.active,
                    custom_fields = EXCLUDED.custom_fields,
                    updated_at = EXCLUDED.updated_at,
                    updated_by = EXCLUDED.updated_by
                """,
                [(r['code'], r['description'], r['category'], r['active'], 
                  r['custom_fields'], 'NOW()', r['updated_by']) for r in batch],
                template=None
            )
            
            count += len(batch)
            conn.commit()
            
        except Exception as e:
            print(f"Error inserting final batch: {e}")
            conn.rollback()

print(f"✅ Import completed! Inserted {count} code records")

# Close connection
cur.close()
conn.close()