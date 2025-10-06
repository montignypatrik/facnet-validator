/**
 * Redis Cache Service
 *
 * Implements cache-aside pattern with manual invalidation for Quebec healthcare data.
 *
 * Features:
 * - Generic type-safe get/set operations
 * - TTL-based expiration
 * - Cache statistics tracking (hits/misses/errors)
 * - Graceful degradation on Redis errors (fallback to DB)
 * - Pattern-based invalidation
 *
 * Usage:
 * ```typescript
 * const cached = await cacheService.get<Code[]>(CACHE_KEYS.CODES);
 * if (cached) return cached;
 *
 * const codes = await db.select().from(codes);
 * await cacheService.set(CACHE_KEYS.CODES, codes, 3600);
 * return codes;
 * ```
 */

import { getRedisClient } from '../queue/redis.js';
import { getCacheTTL } from './cacheKeys.js';
import type { CacheStats } from './types.js';
import type Redis from 'ioredis';

class CacheService {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    errors: 0,
    hitRatio: 0,
    totalRequests: 0,
  };

  private redis: Redis | null = null;

  /**
   * Initialize Redis connection (lazy loading)
   */
  private getRedis(): Redis {
    if (!this.redis) {
      this.redis = getRedisClient();
    }
    return this.redis;
  }

  /**
   * Get cached value by key
   *
   * @param key Cache key
   * @returns Cached value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const redis = this.getRedis();
      const value = await redis.get(key);

      if (value) {
        this.stats.hits++;
        this.updateHitRatio();
        console.log(`[CACHE HIT] ${key}`);
        return JSON.parse(value) as T;
      }

      this.stats.misses++;
      this.updateHitRatio();
      console.log(`[CACHE MISS] ${key}`);
      return null;
    } catch (error) {
      this.stats.errors++;
      console.error(`[CACHE ERROR] Failed to get key "${key}":`, error);
      // Graceful degradation - return null, caller will query DB
      return null;
    }
  }

  /**
   * Set cached value with TTL
   *
   * @param key Cache key
   * @param value Data to cache
   * @param ttl Time-to-live in seconds (optional, uses config default)
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const redis = this.getRedis();
      const cacheTTL = ttl || getCacheTTL(key);
      const serialized = JSON.stringify(value);

      await redis.set(key, serialized, 'EX', cacheTTL);
      console.log(`[CACHE SET] ${key} (TTL: ${cacheTTL}s)`);
    } catch (error) {
      this.stats.errors++;
      console.error(`[CACHE ERROR] Failed to set key "${key}":`, error);
      // Non-blocking error - cache population failure won't crash the app
    }
  }

  /**
   * Invalidate (delete) cached value
   *
   * @param key Cache key to invalidate
   */
  async invalidate(key: string): Promise<void> {
    try {
      const redis = this.getRedis();
      const deleted = await redis.del(key);

      if (deleted > 0) {
        this.stats.invalidations++;
        console.log(`[CACHE INVALIDATE] ${key}`);
      }
    } catch (error) {
      this.stats.errors++;
      console.error(`[CACHE ERROR] Failed to invalidate key "${key}":`, error);
    }
  }

  /**
   * Invalidate all keys matching a pattern
   *
   * @param pattern Redis key pattern (e.g., "ramq:codes:*")
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const redis = this.getRedis();
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        const deleted = await redis.del(...keys);
        this.stats.invalidations += deleted;
        console.log(`[CACHE INVALIDATE PATTERN] ${pattern} (${deleted} keys deleted)`);
      }
    } catch (error) {
      this.stats.errors++;
      console.error(`[CACHE ERROR] Failed to invalidate pattern "${pattern}":`, error);
    }
  }

  /**
   * Check if a key exists in cache
   *
   * @param key Cache key
   * @returns True if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const redis = this.getRedis();
      const exists = await redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.stats.errors++;
      console.error(`[CACHE ERROR] Failed to check existence of key "${key}":`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   *
   * @param key Cache key
   * @returns TTL in seconds, -1 if no expiration, -2 if key doesn't exist
   */
  async getTTL(key: string): Promise<number> {
    try {
      const redis = this.getRedis();
      return await redis.ttl(key);
    } catch (error) {
      this.stats.errors++;
      console.error(`[CACHE ERROR] Failed to get TTL for key "${key}":`, error);
      return -2;
    }
  }

  /**
   * Clear all cache keys (use with caution!)
   */
  async clear(): Promise<void> {
    try {
      const redis = this.getRedis();

      // Only delete keys with our namespace prefixes (ramq:*, validation:*)
      const patterns = ['ramq:*', 'validation:*'];
      let totalDeleted = 0;

      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          const deleted = await redis.del(...keys);
          totalDeleted += deleted;
        }
      }

      this.stats.invalidations += totalDeleted;
      console.log(`[CACHE CLEAR] Deleted ${totalDeleted} keys`);
    } catch (error) {
      this.stats.errors++;
      console.error('[CACHE ERROR] Failed to clear cache:', error);
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Current cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      invalidations: 0,
      errors: 0,
      hitRatio: 0,
      totalRequests: 0,
    };
    console.log('[CACHE] Statistics reset');
  }

  /**
   * Update hit ratio calculation
   * @private
   */
  private updateHitRatio(): void {
    this.stats.totalRequests = this.stats.hits + this.stats.misses;
    this.stats.hitRatio = this.stats.totalRequests > 0
      ? (this.stats.hits / this.stats.totalRequests) * 100
      : 0;
  }
}

// Export singleton instance
export const cacheService = new CacheService();
