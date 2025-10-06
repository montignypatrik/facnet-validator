import Redis from 'ioredis';

/**
 * Redis Connection Manager
 *
 * Provides a singleton Redis client for the application.
 * Handles connection, error handling, and graceful shutdown.
 */

let redisClient: Redis | null = null;

/**
 * Get or create the Redis client
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    console.log('[REDIS] Initializing Redis connection:', redisUrl.replace(/:[^:@]+@/, ':***@')); // Hide password in logs

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ for blocking commands
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        console.log(`[REDIS] Retry attempt ${times}, waiting ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          console.log('[REDIS] Reconnecting due to READONLY error');
          return true;
        }
        return false;
      },
    });

    // Connection event handlers
    redisClient.on('connect', () => {
      console.log('[REDIS] Successfully connected to Redis');
    });

    redisClient.on('ready', () => {
      console.log('[REDIS] Redis client ready');
    });

    redisClient.on('error', (error: Error) => {
      console.error('[REDIS] Redis connection error:', error.message);
    });

    redisClient.on('close', () => {
      console.log('[REDIS] Redis connection closed');
    });

    redisClient.on('reconnecting', () => {
      console.log('[REDIS] Reconnecting to Redis...');
    });
  }

  return redisClient;
}

/**
 * Gracefully close the Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    console.log('[REDIS] Closing Redis connection...');
    await redisClient.quit();
    redisClient = null;
    console.log('[REDIS] Redis connection closed');
  }
}

/**
 * Check if Redis is connected and healthy
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = getRedisClient();
    const result = await client.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('[REDIS] Health check failed:', error);
    return false;
  }
}
