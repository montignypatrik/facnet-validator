/**
 * In-Memory PostgreSQL Database for Testing
 *
 * Uses pg-mem to create an in-memory PostgreSQL database for fast,
 * isolated integration tests without requiring a real PostgreSQL instance.
 */

import { newDb, IMemoryDb } from 'pg-mem';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../shared/schema';

let testDb: IMemoryDb | null = null;
let testDrizzle: any = null;

/**
 * Create and initialize an in-memory PostgreSQL database
 * with the application schema
 *
 * @returns In-memory database instance and Drizzle ORM
 */
export async function setupTestDatabase() {
  // Create in-memory database
  testDb = newDb();

  // Register PostgreSQL extensions and functions
  testDb.public.registerFunction({
    name: 'current_database',
    returns: 'text',
    implementation: () => 'test_db',
  });

  testDb.public.registerFunction({
    name: 'version',
    returns: 'text',
    implementation: () => 'PostgreSQL 16.0 (pg-mem)',
  });

  // Register gen_random_uuid() function
  testDb.public.registerFunction({
    name: 'gen_random_uuid',
    returns: 'uuid',
    implementation: () => {
      // Generate RFC4122 v4 UUID
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    },
  });

  // Get a pg-compatible adapter
  const pgAdapter = testDb.adapters.createPg();

  // Create Drizzle instance
  testDrizzle = drizzle(pgAdapter as any, { schema });

  // Create schema (simulate migrations)
  await createSchema();

  return { db: testDb, drizzle: testDrizzle };
}

/**
 * Create database schema in memory
 * (simplified version of actual migrations)
 */
async function createSchema() {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  // Users table
  testDb.public.none(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      auth0_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Codes table (RAMQ billing codes)
  testDb.public.none(`
    CREATE TABLE IF NOT EXISTS codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL,
      description TEXT,
      place TEXT,
      tariff_value NUMERIC(10,2),
      level_groups TEXT,
      category TEXT,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Contexts table
  testDb.public.none(`
    CREATE TABLE IF NOT EXISTS contexts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Establishments table
  testDb.public.none(`
    CREATE TABLE IF NOT EXISTS establishments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      region TEXT,
      type TEXT,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Rules table (validation rules)
  testDb.public.none(`
    CREATE TABLE IF NOT EXISTS rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      condition JSONB NOT NULL,
      threshold NUMERIC(10,2),
      enabled BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Validation runs table
  testDb.public.none(`
    CREATE TABLE IF NOT EXISTS validation_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      file_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      total_records INTEGER DEFAULT 0,
      processed_records INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      warning_count INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP
    )
  `);

  // Billing records table
  testDb.public.none(`
    CREATE TABLE IF NOT EXISTS billing_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      validation_run_id UUID REFERENCES validation_runs(id) ON DELETE CASCADE,
      record_number TEXT,
      facture TEXT,
      id_ramq TEXT,
      date_service TIMESTAMP NOT NULL,
      debut TEXT,
      fin TEXT,
      periode TEXT,
      lieu_pratique TEXT,
      secteur_activite TEXT,
      diagnostic TEXT,
      code TEXT NOT NULL,
      unites TEXT,
      role TEXT,
      element_contexte TEXT,
      montant_preliminaire NUMERIC(10,2),
      montant_paye NUMERIC(10,2),
      doctor_info TEXT,
      patient TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Validation results table
  testDb.public.none(`
    CREATE TABLE IF NOT EXISTS validation_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      validation_run_id UUID REFERENCES validation_runs(id) ON DELETE CASCADE,
      rule_id TEXT NOT NULL,
      billing_record_id UUID REFERENCES billing_records(id) ON DELETE CASCADE,
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      solution TEXT,
      rule_data JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Files table
  testDb.public.none(`
    CREATE TABLE IF NOT EXISTS files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id),
      file_name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      mime_type TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

/**
 * Seed test data into the database
 */
export async function seedTestData() {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  // Seed users
  await testDb.public.none(`
    INSERT INTO users (auth0_id, email, name, role) VALUES
    ('auth0|admin123', 'admin@test.com', 'Admin Test User', 'admin'),
    ('auth0|editor123', 'editor@test.com', 'Editor Test User', 'editor'),
    ('auth0|viewer123', 'viewer@test.com', 'Viewer Test User', 'viewer'),
    ('auth0|pending123', 'pending@test.com', 'Pending Test User', 'pending')
  `);

  // Seed RAMQ codes
  await testDb.public.none(`
    INSERT INTO codes (code, description, place, tariff_value, category) VALUES
    ('15804', 'Visite de suivi', 'Cabinet', 49.15, 'consultation'),
    ('19928', 'Frais de bureau - seuil minimum', 'Cabinet', 10.80, 'office_fee'),
    ('19929', 'Frais de bureau - seuil supérieur', 'Cabinet', 10.80, 'office_fee'),
    ('08000', 'Consultation prolongée', 'Cabinet', 85.00, 'consultation'),
    ('00100', 'Évaluation complète', 'Cabinet', 120.00, 'assessment')
  `);

  // Seed contexts
  await testDb.public.none(`
    INSERT INTO contexts (name, description) VALUES
    ('11', 'Patient inscrit'),
    ('#G160', 'Patient sans rendez-vous'),
    ('#AR', 'Accueil-réception'),
    ('85', 'Deuxième visite même journée')
  `);

  // Seed establishments
  await testDb.public.none(`
    INSERT INTO establishments (number, name, region, type) VALUES
    ('10001', 'CHUM - Centre hospitalier de l''Université de Montréal', 'Montréal', 'hospital'),
    ('20001', 'Clinique Médicale Dupont', 'Québec', 'clinic')
  `);

  // Seed validation rules
  await testDb.public.none(`
    INSERT INTO rules (name, description, condition, threshold, enabled) VALUES
    (
      'Office Fee Validation - Code 19928',
      'Validates office fee billing for code 19928',
      '{"type":"office_fee_validation","category":"billing_compliance","codes":["19928"],"walkInContexts":["#G160","#AR"],"thresholds":{"19928":{"registered":6,"walkIn":10}}}',
      64.80,
      true
    ),
    (
      'Office Fee Validation - Code 19929',
      'Validates office fee billing for code 19929',
      '{"type":"office_fee_validation","category":"billing_compliance","codes":["19929"],"walkInContexts":["#G160","#AR"],"thresholds":{"19929":{"registered":12,"walkIn":20}}}',
      64.80,
      true
    )
  `);
}

/**
 * Clear all data from the database (keep schema)
 */
export async function clearTestData() {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }

  await testDb.public.none('DELETE FROM validation_results');
  await testDb.public.none('DELETE FROM billing_records');
  await testDb.public.none('DELETE FROM validation_runs');
  await testDb.public.none('DELETE FROM files');
  await testDb.public.none('DELETE FROM rules');
  await testDb.public.none('DELETE FROM establishments');
  await testDb.public.none('DELETE FROM contexts');
  await testDb.public.none('DELETE FROM codes');
  await testDb.public.none('DELETE FROM users');
}

/**
 * Tear down the test database
 */
export async function teardownTestDatabase() {
  testDb = null;
  testDrizzle = null;
}

/**
 * Get the current test database instance
 */
export function getTestDb() {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDb;
}

/**
 * Get the current test Drizzle instance
 */
export function getTestDrizzle() {
  if (!testDrizzle) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDrizzle;
}
