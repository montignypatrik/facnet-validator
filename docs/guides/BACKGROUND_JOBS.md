# Background Job Queue Implementation

## Overview

This document describes the implementation of a background job queue system using BullMQ and Redis to replace synchronous CSV processing that previously blocked the request-response cycle.

## Architecture

### Components

1. **Redis Connection Manager** (`server/queue/redis.ts`)
   - Singleton Redis client for the application
   - Connection pooling and error handling
   - Graceful shutdown support

2. **Validation Queue** (`server/queue/validationQueue.ts`)
   - BullMQ queue for CSV validation jobs
   - Job enqueueing and status tracking
   - Event listeners for logging and monitoring

3. **Validation Worker** (`server/queue/validationWorker.ts`)
   - Processes validation jobs from the queue
   - Updates progress in database during processing
   - Handles errors and retries automatically
   - Concurrency: 2 jobs at a time

4. **CSV Processor** (`server/modules/validateur/validation/csvProcessor.ts`)
   - Enhanced with progress callback support
   - Reports progress at regular intervals (every 100 rows)
   - Progress stages:
     - 0-50%: CSV parsing
     - 50-75%: Database insertion
     - 75-90%: Validation rules
     - 90-100%: Result storage

## Database Schema

The `validation_runs` table includes fields for job tracking:

```sql
CREATE TABLE validation_runs (
  id UUID PRIMARY KEY,
  file_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
  progress NUMERIC DEFAULT 0 NOT NULL,   -- 0-100
  job_id TEXT,                            -- BullMQ job ID
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## API Flow

### Before (Synchronous)

```
Client → POST /api/validations
       → Server starts processing (blocks for 2+ minutes)
       → Returns 200 when complete
```

### After (Asynchronous)

```
Client → POST /api/validations
       → Server enqueues job
       → Returns 202 Accepted immediately
       → Client polls GET /api/validations/:id
       → Worker processes job in background
       → Database updated with progress
```

## Environment Variables

Add to `.env`:

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379
```

## Installation

### Dependencies

```bash
npm install bullmq ioredis
npm install --save-dev @types/ioredis
```

### Redis Setup

**Windows:**
1. Download Redis from https://redis.io/download
2. Install and start Redis service
3. Default port: 6379

**Docker:**
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

**Linux:**
```bash
sudo apt install redis-server
sudo systemctl start redis
```

## Testing

### 1. Test Redis Connection

```bash
node test-redis.js
```

Expected output:
```
✓ Successfully connected to Redis
✓ Redis client ready
✓ PING test: PONG
✓ SET/GET test: PASSED
✓ Redis is working correctly!
```

### 2. Test Background Processing

1. Start the application:
   ```bash
   npm run dev
   ```

2. Upload a CSV file via the UI

3. Monitor logs for:
   ```
   [QUEUE] Enqueued validation job validation-<uuid> for run <uuid>
   [WORKER] Started processing job validation-<uuid>
   [WORKER] Job validation-<uuid> completed
   ```

4. Check database for progress updates:
   ```sql
   SELECT id, status, progress, job_id FROM validation_runs
   ORDER BY created_at DESC LIMIT 5;
   ```

### 3. Monitor Queue Status

Create a monitoring script (`monitor-queue.js`):

```javascript
import { Queue } from 'bullmq';
import { getRedisClient } from './server/queue/redis.js';

const connection = getRedisClient();
const queue = new Queue('validation', { connection });

async function monitor() {
  const waiting = await queue.getWaitingCount();
  const active = await queue.getActiveCount();
  const completed = await queue.getCompletedCount();
  const failed = await queue.getFailedCount();

  console.log('Queue Status:');
  console.log('  Waiting:', waiting);
  console.log('  Active:', active);
  console.log('  Completed:', completed);
  console.log('  Failed:', failed);

  await connection.quit();
}

monitor();
```

## Error Handling

### Job Failures

Jobs automatically retry up to 3 times with exponential backoff:
- Attempt 1: Immediate
- Attempt 2: 2 seconds delay
- Attempt 3: 4 seconds delay

After 3 failures, the job is marked as failed and the validation run status is updated to 'failed'.

### Redis Connection Loss

The application gracefully handles Redis disconnections:
- Automatic reconnection with retry strategy
- Jobs are persisted in Redis and resume after reconnection
- Worker continues processing when Redis is available

### Server Restart

On graceful shutdown (SIGTERM/SIGINT):
1. Stop accepting new requests
2. Worker finishes current jobs (30-second timeout)
3. Close Redis connection
4. Exit process

Jobs in the queue are preserved and resume when the server restarts.

## Performance Characteristics

### Before (Synchronous)
- Large CSV (10k rows): 2-3 minutes blocking
- Server unresponsive during processing
- Single file at a time
- No progress updates

### After (Asynchronous)
- API response: < 100ms
- Server remains responsive
- 2 concurrent files (configurable)
- Real-time progress updates
- Automatic retries on failure

## Monitoring and Debugging

### View Job Progress

```javascript
import { getJobStatus } from './server/queue/validationQueue.js';

const status = await getJobStatus('validation-<uuid>');
console.log(status);
// {
//   id: 'validation-...',
//   state: 'active',
//   progress: 75,
//   data: { validationRunId: '...', fileName: '...' }
// }
```

### View Logs

```sql
SELECT * FROM validation_logs
WHERE validation_run_id = '<uuid>'
AND source = 'worker'
ORDER BY timestamp DESC;
```

### Redis CLI

```bash
redis-cli

# View all keys
KEYS *

# View queue jobs
LRANGE bull:validation:waiting 0 -1

# View job details
HGETALL bull:validation:job-id
```

## Production Deployment

### PM2 Configuration

The worker runs in the same process as the API server. PM2 clustering provides redundancy:

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'facnet-validator',
    script: './dist/server/index.js',
    instances: 6, // Each instance has its own worker
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      REDIS_URL: 'redis://localhost:6379'
    }
  }]
};
```

### Redis Production Setup

1. **Enable persistence** (RDB or AOF)
2. **Set maxmemory policy** to avoid OOM
3. **Monitor memory usage**
4. **Set password** for security

```bash
# redis.conf
requirepass your-secure-password
maxmemory 256mb
maxmemory-policy allkeys-lru
```

Update `.env`:
```bash
REDIS_URL=redis://:your-secure-password@localhost:6379
```

### Scaling

- **Vertical**: Increase worker concurrency
- **Horizontal**: Deploy multiple app instances (PM2 clustering)
- **Redis**: Use Redis Cluster for high availability

## Security Considerations

### Data Privacy

- **No PHI in Redis**: Only validation run IDs and file names are stored
- **CSV files deleted** after processing
- **Validation results** stored in PostgreSQL, not Redis

### Job Retention

```javascript
// validationQueue.ts
defaultJobOptions: {
  removeOnComplete: {
    age: 3600,  // 1 hour
    count: 100  // Last 100 jobs
  },
  removeOnFail: {
    age: 86400, // 24 hours
    count: 1000 // Last 1000 jobs
  }
}
```

## Troubleshooting

### Issue: Worker not processing jobs

**Solution:**
```bash
# Check if worker is running
pm2 logs | grep WORKER

# Check Redis connection
node test-redis.js

# View queue status
redis-cli
> LRANGE bull:validation:waiting 0 -1
```

### Issue: Jobs stuck in "waiting" state

**Solution:**
```bash
# Restart worker
pm2 restart facnet-validator

# Check for stalled jobs
redis-cli
> LRANGE bull:validation:stalled 0 -1
```

### Issue: Progress not updating

**Solution:**
```sql
-- Check if jobId is set
SELECT id, status, job_id, progress FROM validation_runs
WHERE status = 'processing';

-- Check validation logs
SELECT * FROM validation_logs
WHERE validation_run_id = '<uuid>'
ORDER BY timestamp DESC LIMIT 20;
```

## Migration from Synchronous Processing

### Files Changed

1. ✅ `server/queue/redis.ts` - New
2. ✅ `server/queue/validationQueue.ts` - New
3. ✅ `server/queue/validationWorker.ts` - New
4. ✅ `server/modules/validateur/validation/csvProcessor.ts` - Modified
5. ✅ `server/modules/validateur/routes.ts` - Modified
6. ✅ `server/modules/validateur/logger.ts` - Modified
7. ✅ `server/index.ts` - Modified
8. ✅ `.env` - Modified

### Backward Compatibility

The API response changed:
- **Before**: `{ validationId: string, status: string }`
- **After**: `{ validationId: string, status: string, jobId: string }`

HTTP status changed:
- **Before**: 200 OK (when complete)
- **After**: 202 Accepted (immediately)

Frontend already polls `/api/validations/:id` every 5 seconds, so no changes needed.

## Future Enhancements

1. **Queue Dashboard**: BullMQ Board UI for monitoring
2. **Priority Queues**: VIP users get faster processing
3. **Scheduled Jobs**: Automatic cleanup of old validations
4. **Webhooks**: Notify when validation completes
5. **Batch Processing**: Process multiple files in one job

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Documentation](https://redis.io/documentation)
- [ioredis API](https://github.com/luin/ioredis)
