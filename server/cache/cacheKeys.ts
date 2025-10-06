/**
 * Cache Key Constants
 *
 * Centralized cache key definitions for Redis caching layer.
 *
 * Key Naming Convention: {namespace}:{resource}:{identifier}
 * - namespace: Domain area (ramq, validation)
 * - resource: Data type (codes, rules, contexts)
 * - identifier: Specific item or "all" for collections
 */

import type { CacheConfig } from './types';

/**
 * Cache key constants with TTL configuration
 */
export const CACHE_KEYS = {
  /** RAMQ billing codes (6,740 records, ~4MB) - TTL: 1 hour */
  CODES: 'ramq:codes:all',

  /** Validation rules (~50 rules, ~100KB) - TTL: 24 hours */
  RULES: 'validation:rules:all',

  /** Service contexts (~200 records, ~60KB) - TTL: 1 hour */
  CONTEXTS: 'ramq:contexts:all',

  /** Healthcare establishments (~1000 records, ~300KB) - TTL: 1 hour */
  ESTABLISHMENTS: 'ramq:establishments:all',
} as const;

/**
 * Cache configuration map with TTL values
 */
export const CACHE_CONFIG: Record<string, CacheConfig> = {
  [CACHE_KEYS.CODES]: {
    key: CACHE_KEYS.CODES,
    ttl: 3600, // 1 hour (RAMQ updates monthly)
    description: 'Quebec RAMQ billing codes - 6,740 records',
  },
  [CACHE_KEYS.RULES]: {
    key: CACHE_KEYS.RULES,
    ttl: 86400, // 24 hours (business rules stable)
    description: 'Validation rules - enabled rules only',
  },
  [CACHE_KEYS.CONTEXTS]: {
    key: CACHE_KEYS.CONTEXTS,
    ttl: 3600, // 1 hour (context elements rarely change)
    description: 'Service delivery contexts - ~200 records',
  },
  [CACHE_KEYS.ESTABLISHMENTS]: {
    key: CACHE_KEYS.ESTABLISHMENTS,
    ttl: 3600, // 1 hour (healthcare facilities stable)
    description: 'Healthcare establishments - ~1000 records',
  },
};

/**
 * Get cache configuration for a given key
 */
export function getCacheConfig(key: string): CacheConfig | undefined {
  return CACHE_CONFIG[key];
}

/**
 * Get TTL for a cache key (returns default if not found)
 */
export function getCacheTTL(key: string, defaultTTL = 3600): number {
  const config = CACHE_CONFIG[key];
  return config ? config.ttl : defaultTTL;
}
