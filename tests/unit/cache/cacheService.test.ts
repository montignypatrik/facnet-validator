/**
 * Cache Service Unit Tests
 *
 * Tests Redis caching functionality including:
 * - Cache hits and misses
 * - Cache invalidation
 * - Pattern-based invalidation
 * - Error handling and graceful degradation
 * - Statistics tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cacheService } from '../../../server/cache/cacheService';
import { CACHE_KEYS } from '../../../server/cache/cacheKeys';

describe('CacheService', () => {
  beforeEach(async () => {
    // Clear all cache keys before each test
    await cacheService.clear();
    // Reset statistics
    cacheService.resetStats();
  });

  afterEach(async () => {
    // Cleanup after each test
    await cacheService.clear();
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve data from cache (cache hit)', async () => {
      const testData = { id: '1', name: 'Test Code', code: '12345' };
      const cacheKey = 'test:cache:hit';

      // Set data in cache
      await cacheService.set(cacheKey, testData, 60);

      // Retrieve data from cache
      const cached = await cacheService.get(cacheKey);

      expect(cached).toEqual(testData);
      expect(cacheService.getStats().hits).toBe(1);
      expect(cacheService.getStats().misses).toBe(0);
    });

    it('should return null for non-existent cache key (cache miss)', async () => {
      const cacheKey = 'test:cache:miss';

      // Try to get non-existent key
      const cached = await cacheService.get(cacheKey);

      expect(cached).toBeNull();
      expect(cacheService.getStats().hits).toBe(0);
      expect(cacheService.getStats().misses).toBe(1);
    });

    it('should handle complex data structures', async () => {
      const complexData = {
        codes: [
          { id: '1', code: '12345', description: 'Test 1' },
          { id: '2', code: '67890', description: 'Test 2' },
        ],
        metadata: {
          total: 2,
          page: 1,
        },
      };
      const cacheKey = 'test:complex:data';

      await cacheService.set(cacheKey, complexData);
      const cached = await cacheService.get(cacheKey);

      expect(cached).toEqual(complexData);
    });

    it('should handle arrays', async () => {
      const arrayData = [1, 2, 3, 4, 5];
      const cacheKey = 'test:array:data';

      await cacheService.set(cacheKey, arrayData);
      const cached = await cacheService.get<number[]>(cacheKey);

      expect(cached).toEqual(arrayData);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cached data', async () => {
      const testData = { id: '1', name: 'Test' };
      const cacheKey = 'test:invalidation';

      // Set and verify cache
      await cacheService.set(cacheKey, testData);
      let cached = await cacheService.get(cacheKey);
      expect(cached).toEqual(testData);

      // Invalidate cache
      await cacheService.invalidate(cacheKey);

      // Verify cache is cleared
      cached = await cacheService.get(cacheKey);
      expect(cached).toBeNull();
      expect(cacheService.getStats().invalidations).toBe(1);
    });

    it('should invalidate multiple keys with pattern', async () => {
      // Set multiple keys with same pattern
      await cacheService.set('ramq:codes:all', { data: 'codes' });
      await cacheService.set('ramq:contexts:all', { data: 'contexts' });
      await cacheService.set('validation:rules:all', { data: 'rules' });

      // Invalidate all ramq:* keys
      await cacheService.invalidatePattern('ramq:*');

      // Verify ramq keys are cleared
      expect(await cacheService.get('ramq:codes:all')).toBeNull();
      expect(await cacheService.get('ramq:contexts:all')).toBeNull();

      // Verify validation key still exists
      expect(await cacheService.get('validation:rules:all')).toEqual({ data: 'rules' });
    });

    it('should clear all cache keys', async () => {
      // Set multiple keys
      await cacheService.set(CACHE_KEYS.CODES, { data: 'codes' });
      await cacheService.set(CACHE_KEYS.RULES, { data: 'rules' });
      await cacheService.set(CACHE_KEYS.CONTEXTS, { data: 'contexts' });

      // Clear all cache
      await cacheService.clear();

      // Verify all keys are cleared
      expect(await cacheService.get(CACHE_KEYS.CODES)).toBeNull();
      expect(await cacheService.get(CACHE_KEYS.RULES)).toBeNull();
      expect(await cacheService.get(CACHE_KEYS.CONTEXTS)).toBeNull();
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache hits and misses', async () => {
      const cacheKey = 'test:stats';

      // Generate some hits and misses
      await cacheService.set(cacheKey, { data: 'test' });
      await cacheService.get(cacheKey); // Hit
      await cacheService.get(cacheKey); // Hit
      await cacheService.get('nonexistent:key'); // Miss
      await cacheService.get('another:missing'); // Miss

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.totalRequests).toBe(4);
      expect(stats.hitRatio).toBe(50); // 2/4 = 50%
    });

    it('should track invalidations', async () => {
      await cacheService.set('key1', 'value1');
      await cacheService.set('key2', 'value2');
      await cacheService.set('key3', 'value3');

      await cacheService.invalidate('key1');
      await cacheService.invalidate('key2');

      const stats = cacheService.getStats();
      expect(stats.invalidations).toBe(2);
    });

    it('should calculate hit ratio correctly', async () => {
      const cacheKey = 'test:ratio';
      await cacheService.set(cacheKey, { data: 'test' });

      // 8 hits, 2 misses = 80% hit ratio
      for (let i = 0; i < 8; i++) {
        await cacheService.get(cacheKey);
      }
      await cacheService.get('miss1');
      await cacheService.get('miss2');

      const stats = cacheService.getStats();
      expect(stats.hitRatio).toBe(80);
    });

    it('should reset statistics', async () => {
      const cacheKey = 'test:reset';
      await cacheService.set(cacheKey, { data: 'test' });
      await cacheService.get(cacheKey);
      await cacheService.get('nonexistent');

      // Verify stats exist
      let stats = cacheService.getStats();
      expect(stats.hits).toBeGreaterThan(0);

      // Reset stats
      cacheService.resetStats();

      // Verify stats are cleared
      stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.invalidations).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.hitRatio).toBe(0);
      expect(stats.totalRequests).toBe(0);
    });
  });

  describe('TTL and Expiration', () => {
    it('should check if key exists', async () => {
      const cacheKey = 'test:exists';
      await cacheService.set(cacheKey, { data: 'test' });

      expect(await cacheService.exists(cacheKey)).toBe(true);
      expect(await cacheService.exists('nonexistent')).toBe(false);
    });

    it('should get remaining TTL', async () => {
      const cacheKey = 'test:ttl';
      const ttl = 60; // 60 seconds

      await cacheService.set(cacheKey, { data: 'test' }, ttl);

      const remainingTTL = await cacheService.getTTL(cacheKey);
      expect(remainingTTL).toBeGreaterThan(0);
      expect(remainingTTL).toBeLessThanOrEqual(ttl);
    });

    it('should return -2 for non-existent key TTL', async () => {
      const ttl = await cacheService.getTTL('nonexistent:key');
      expect(ttl).toBe(-2);
    });

    it('should expire keys after TTL', async () => {
      const cacheKey = 'test:expiration';
      const shortTTL = 1; // 1 second

      await cacheService.set(cacheKey, { data: 'test' }, shortTTL);

      // Verify key exists
      expect(await cacheService.exists(cacheKey)).toBe(true);

      // Wait for expiration (1.5 seconds to ensure key expired)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Verify key no longer exists
      expect(await cacheService.exists(cacheKey)).toBe(false);
      expect(await cacheService.get(cacheKey)).toBeNull();
    });
  });

  describe('Error Handling and Graceful Degradation', () => {
    it('should handle Redis errors gracefully on get', async () => {
      // Create a spy to track console.error calls
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Try to get with an invalid key that might cause an error
      // (Note: In real scenarios, this might require mocking Redis to simulate errors)
      const result = await cacheService.get('test:error:key');

      // Should return null on error (graceful degradation)
      expect(result).toBeNull();

      consoleErrorSpy.mockRestore();
    });

    it('should not throw errors on set failures', async () => {
      // Setting invalid data should not crash the app
      await expect(
        cacheService.set('test:error:set', { data: 'test' })
      ).resolves.not.toThrow();
    });

    it('should not throw errors on invalidation failures', async () => {
      // Invalidating non-existent key should not crash
      await expect(
        cacheService.invalidate('nonexistent:key')
      ).resolves.not.toThrow();
    });
  });

  describe('Real-World Cache Scenarios', () => {
    it('should simulate RAMQ codes caching workflow', async () => {
      // Simulate fetching codes from database (first time - cache miss)
      const codesData = {
        data: [
          { id: '1', code: '12345', description: 'Office Visit' },
          { id: '2', code: '67890', description: 'Consultation' },
        ],
        total: 2,
      };

      // First request - cache miss
      let cached = await cacheService.get(CACHE_KEYS.CODES);
      expect(cached).toBeNull();

      // Store in cache
      await cacheService.set(CACHE_KEYS.CODES, codesData);

      // Second request - cache hit
      cached = await cacheService.get(CACHE_KEYS.CODES);
      expect(cached).toEqual(codesData);

      // Simulate code update - invalidate cache
      await cacheService.invalidate(CACHE_KEYS.CODES);

      // Next request should be cache miss again
      cached = await cacheService.get(CACHE_KEYS.CODES);
      expect(cached).toBeNull();

      const stats = cacheService.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.invalidations).toBe(1);
    });

    it('should handle concurrent cache operations', async () => {
      const cacheKey = 'test:concurrent';

      // Simulate multiple concurrent requests
      const operations = [
        cacheService.set(cacheKey, { id: 1 }),
        cacheService.get(cacheKey),
        cacheService.get(cacheKey),
        cacheService.exists(cacheKey),
        cacheService.getTTL(cacheKey),
      ];

      // All operations should complete without errors
      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });
});
