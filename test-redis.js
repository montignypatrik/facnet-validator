/**
 * Quick Redis connectivity test
 * Run with: node test-redis.js
 */

import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

console.log('Testing Redis connection to:', redisUrl);

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => {
    if (times > 3) {
      console.error('Failed to connect after 3 retries');
      return null;
    }
    const delay = Math.min(times * 50, 2000);
    console.log(`Retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  }
});

redis.on('connect', () => {
  console.log('✓ Successfully connected to Redis');
});

redis.on('ready', async () => {
  console.log('✓ Redis client ready');

  // Test ping
  try {
    const result = await redis.ping();
    console.log('✓ PING test:', result);

    // Test set/get
    await redis.set('test-key', 'test-value');
    const value = await redis.get('test-key');
    console.log('✓ SET/GET test:', value === 'test-value' ? 'PASSED' : 'FAILED');

    // Cleanup
    await redis.del('test-key');
    console.log('✓ Redis is working correctly!');

    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error('✗ Redis test failed:', error.message);
    await redis.quit();
    process.exit(1);
  }
});

redis.on('error', (error) => {
  console.error('✗ Redis connection error:', error.message);

  if (error.code === 'ECONNREFUSED') {
    console.error('\n❌ Redis is not running or not accessible.');
    console.error('Please ensure Redis is installed and running:');
    console.error('  - Windows: Download from https://redis.io/download');
    console.error('  - Or use Docker: docker run -d -p 6379:6379 redis:latest');
  }

  process.exit(1);
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

// Timeout after 5 seconds
setTimeout(() => {
  console.error('\n✗ Connection timeout - Redis did not respond within 5 seconds');
  redis.quit();
  process.exit(1);
}, 5000);
