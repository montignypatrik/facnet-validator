import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure SSL based on environment
// For localhost connections (staging), disable SSL
// For remote connections (production), use SSL without strict verification
const isLocalhost = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
const sslConfig = isLocalhost
  ? false  // No SSL for localhost
  : { rejectUnauthorized: false };  // SSL without strict cert verification for remote

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig
});
export const db = drizzle({ client: pool, schema });