/**
 * Cache Warm-up Utility
 *
 * Pre-loads frequently accessed reference data into Redis cache on server startup.
 * This improves first-request performance and reduces database load.
 *
 * Warm-up Strategy:
 * - Loads all RAMQ codes (~6,740 records, ~4MB)
 * - Loads all contexts (~200 records, ~60KB)
 * - Loads all establishments (~1,000 records, ~300KB)
 *
 * Note: Validation rules are now hardcoded in TypeScript (no caching needed)
 *
 * Total cache size: ~5MB of reference data
 * Expected warm-up time: 1-2 seconds
 */

import { storage } from '../core/storage.js';

/**
 * Warm up the cache by pre-loading reference data
 *
 * This function is called on server startup to populate Redis with
 * frequently accessed data, reducing database queries on first requests.
 */
export async function warmupCache(): Promise<void> {
  console.log('[CACHE WARMUP] Starting cache warm-up...');
  const startTime = Date.now();

  try {
    // Warm up codes cache (largest dataset)
    console.log('[CACHE WARMUP] Loading RAMQ codes...');
    await storage.getCodes({ page: 1, pageSize: 10000 }); // Load all codes

    // Warm up contexts cache
    console.log('[CACHE WARMUP] Loading service contexts...');
    await storage.getContexts({ page: 1, pageSize: 1000 }); // Load all contexts

    // Warm up establishments cache
    console.log('[CACHE WARMUP] Loading healthcare establishments...');
    await storage.getEstablishments({ page: 1, pageSize: 2000 }); // Load all establishments

    const duration = Date.now() - startTime;
    console.log(`[CACHE WARMUP] ✓ Cache warm-up complete in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[CACHE WARMUP] ✗ Cache warm-up failed after ${duration}ms:`, error);
    // Non-blocking error - application continues without warm cache
  }
}
