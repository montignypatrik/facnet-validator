/**
 * Cache Service Type Definitions
 *
 * Provides TypeScript interfaces for Redis caching layer.
 */

export interface CacheConfig {
  /** Cache key identifier */
  key: string;
  /** Time-to-live in seconds */
  ttl: number;
  /** Description of what this cache stores */
  description: string;
}

export interface CacheStats {
  /** Number of successful cache hits */
  hits: number;
  /** Number of cache misses (fallback to DB) */
  misses: number;
  /** Number of cache invalidations */
  invalidations: number;
  /** Number of cache errors */
  errors: number;
  /** Cache hit ratio percentage (0-100) */
  hitRatio: number;
  /** Total requests (hits + misses) */
  totalRequests: number;
}

export interface CacheEntry<T> {
  /** Cached data */
  data: T;
  /** Timestamp when cached */
  cachedAt: number;
  /** TTL in seconds */
  ttl: number;
}
