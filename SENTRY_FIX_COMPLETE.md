# Sentry Observability Fix - Complete Documentation

**Date**: October 6, 2025
**Branch**: `feature/sentry-observability-clean`
**Status**: ✅ Successfully Deployed to Staging
**Commit**: `7cf38cd` - fix: implement lazy loading for Sentry and OpenTelemetry dependencies

---

## Problem Statement

The Sentry observability branch failed to deploy to staging with a module import error:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@sentry/node'
```

**Root Cause**: Even when Sentry was disabled (`SENTRY_ENABLED=false`), the modules had **top-level imports** that Node.js tried to resolve at parse time, before any code execution. ES modules resolve all `import` statements immediately when the module is loaded, causing errors when optional dependencies are not installed.

---

## Solution: Lazy Loading with Dynamic Imports

Converted both Sentry and OpenTelemetry modules to use **dynamic `import()`** statements that only execute when the features are explicitly enabled.

### Key Changes

#### 1. server/observability/sentry.ts - Complete Rewrite

**Before** (top-level imports):
```typescript
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

export function initializeSentry(): boolean {
  // ... initialization code
}
```

**After** (lazy loading):
```typescript
let SentryModule: typeof import('@sentry/node') | null = null;

async function loadSentry() {
  if (SentryModule) return SentryModule;
  SentryModule = await import('@sentry/node');
  return SentryModule;
}

export async function initializeSentry(): Promise<boolean> {
  if (!config.enabled) {
    console.log('[SENTRY] Disabled (SENTRY_ENABLED=false)');
    return false;
  }

  const Sentry = await loadSentry(); // Only loads when enabled
  // ... initialization code
}
```

**Key Pattern**:
- Module variable stored as `null` initially
- Async `loadSentry()` function uses dynamic `import()`
- All Sentry functions check `if (!SentryModule)` before use
- `initializeSentry()` changed from sync to async

#### 2. server/observability/tracing.ts - Same Pattern

**Changes**:
```typescript
// Lazy-loaded modules
let OtelAPI: typeof import('@opentelemetry/api') | null = null;
let NodeSDKModule: typeof import('@opentelemetry/sdk-node') | null = null;
// ... etc

async function loadOpenTelemetry() {
  if (OtelAPI) return; // Already loaded

  OtelAPI = await import('@opentelemetry/api');
  NodeSDKModule = await import('@opentelemetry/sdk-node');
  // ... load other modules
}

export async function initializeTracing(): Promise<boolean> {
  if (!config.enabled) return false;
  await loadOpenTelemetry(); // Only when enabled
  // ... initialization
}
```

**Additional Change**: Disabled by default
```typescript
// Before: enabled unless explicitly disabled
enabled: process.env.OTEL_ENABLED !== 'false'

// After: disabled unless explicitly enabled
enabled: process.env.OTEL_ENABLED === 'true'
```

#### 3. server/observability/index.ts - Type-Only Exports

**Before**:
```typescript
export {
  trace,
  Span,
  SpanStatusCode,
  context,
  Context,
} from './tracing';
```

**After**:
```typescript
// Remove runtime exports that would load the module
// Only export functions and types
export {
  initializeTracing,
  withSpan,
  // ... etc
} from './tracing';

export type { SpanAttributes } from './tracing';
```

**Why**: Runtime exports cause the module graph to load `tracing.ts`, which would try to resolve OpenTelemetry imports even if not used.

#### 4. server/index.ts - Fix Sentry Reference

**Before**:
```typescript
import { Sentry } from './observability';

app.use(Sentry.Handlers.errorHandler());
```

**After**:
```typescript
import { getSentry } from './observability';

const Sentry = getSentry();
if (Sentry) {
  app.use(Sentry.Handlers.errorHandler());
}
```

**Why**: `Sentry` is no longer directly exported (it's lazy-loaded), so we use `getSentry()` which returns the loaded module or `null`.

---

## Technical Deep Dive

### Why Top-Level Imports Fail

In ES modules, Node.js processes imports in this order:
1. **Parse phase**: All `import` statements are resolved
2. **Execution phase**: Code runs

If a module has `import '@sentry/node'` at the top level, Node.js tries to resolve it during the **parse phase**, before any `if (enabled)` checks can run. This causes immediate errors when the package isn't installed.

### Why Dynamic Imports Work

Dynamic imports (`import()`) are:
- **Functions** that return Promises
- Executed during the **execution phase**, not parse phase
- Only resolve when called
- Can be conditionally executed inside `if` statements

```typescript
// This runs during parse phase (FAILS if package missing)
import * as Sentry from '@sentry/node';

// This runs during execution phase (SUCCEEDS if never called)
const Sentry = await import('@sentry/node');
```

### Indirect Module Loading Issue

Even after fixing Sentry and OpenTelemetry, we hit a secondary issue:

```
server/modules/validateur/validation/csvProcessor.ts:
  import { withSpan } from '../../../observability';
```

This caused `observability/index.ts` → `tracing.ts` to load, triggering OpenTelemetry imports.

**Solution**: Removed runtime exports from `index.ts` so the module graph doesn't automatically load `tracing.ts` when other files import from observability.

---

## Deployment Verification

### Local Development ✅

```bash
npm run build  # ✅ Build succeeds
npm run dev    # ✅ Server starts on port 5000
```

**Logs**:
```
[SENTRY] Disabled (SENTRY_ENABLED=false)
[TRACING] Disabled (OTEL_ENABLED=false or not set)
serving on port 5000
```

**Result**: Application runs without `@sentry/node` or `@opentelemetry/*` packages installed.

### Staging Deployment ✅

**Branch**: `feature/sentry-observability-clean`
**Server**: https://148.113.196.245:3001
**PM2 Process**: `facnet-validator-staging`

```bash
ssh ubuntu@148.113.196.245
cd /var/www/facnet/staging
sudo -u facnet git checkout feature/sentry-observability-clean
sudo -u facnet npm install && npm run build
sudo -u facnet pm2 restart facnet-validator-staging
```

**Health Check**:
```bash
curl -k https://148.113.196.245:3001/api/health
# Response: {"status":"healthy","timestamp":"..."}
```

**PM2 Status**:
```
┌────┬──────────────────────────────┬────────┬────────┬──────────┐
│ id │ name                         │ status │ cpu    │ memory   │
├────┼──────────────────────────────┼────────┼────────┼──────────┤
│ 47 │ facnet-validator-staging     │ online │ 0%     │ 18.4mb   │
└────┴──────────────────────────────┴────────┴────────┴──────────┘
```

**Logs** (no import errors):
```
[MODULE REGISTRY] ✓ Loaded module: observability (1.0.0)
[CACHE WARMUP] Loading RAMQ codes...
serving on port 3002
```

---

## Files Modified

### Core Changes
1. **[server/observability/sentry.ts](server/observability/sentry.ts)** - Complete lazy loading rewrite (90 lines changed)
2. **[server/observability/tracing.ts](server/observability/tracing.ts)** - Lazy loading for OpenTelemetry (139 lines changed)
3. **[server/observability/index.ts](server/observability/index.ts)** - Removed runtime exports (11 lines changed)
4. **[server/index.ts](server/index.ts)** - Fixed Sentry middleware reference (29 lines changed)

### Total Impact
- **4 files modified**
- **179 insertions, 90 deletions**
- **1 commit**: `7cf38cd`

---

## Lazy Loading Pattern (Reusable)

Use this pattern for any optional dependencies:

```typescript
// 1. Module variable (null initially)
let OptionalModule: typeof import('optional-package') | null = null;

// 2. Lazy loader function
async function loadOptionalModule() {
  if (OptionalModule) return OptionalModule;
  OptionalModule = await import('optional-package');
  return OptionalModule;
}

// 3. Async initialization with conditional loading
export async function initializeFeature(): Promise<boolean> {
  const config = getConfig();

  if (!config.enabled) {
    console.log('Feature disabled');
    return false;
  }

  const Module = await loadOptionalModule();
  Module.initialize();
  return true;
}

// 4. All functions check if loaded
export function useFeature() {
  if (!OptionalModule) {
    console.warn('Feature not initialized');
    return;
  }
  OptionalModule.doSomething();
}

// 5. Type-only exports in index.ts
export { initializeFeature, useFeature } from './feature';
export type { FeatureConfig } from './feature'; // Type-only!
```

**Key Principles**:
- ✅ Store module as `null`, load with dynamic `import()`
- ✅ Make initialization async
- ✅ Check if module loaded before every use
- ✅ Export types only to prevent module graph loading
- ✅ Provide graceful fallbacks when disabled

---

## Environment Variables

### Sentry Configuration
```env
SENTRY_ENABLED=false              # Default: disabled
SENTRY_DSN=https://...            # Sentry project DSN
SENTRY_ENVIRONMENT=staging        # Environment name
SENTRY_TRACES_SAMPLE_RATE=0.1     # 10% of transactions
SENTRY_PROFILES_SAMPLE_RATE=0.1   # 10% profiling
```

### OpenTelemetry Configuration
```env
OTEL_ENABLED=true                 # Default: disabled (changed!)
OTEL_SERVICE_NAME=dash-validateur # Service name
OTEL_EXPORTER_OTLP_ENDPOINT=...   # OTLP collector URL
```

---

## Benefits of Lazy Loading

### 1. Zero Runtime Errors
Application runs without optional dependencies installed. Perfect for local development without Sentry or staging without OpenTelemetry.

### 2. Smaller Bundle Size
Dependencies only included when features enabled. Production builds can exclude observability packages if not used.

### 3. Faster Startup
Modules only loaded when needed. Application starts faster when observability disabled (development/testing).

### 4. Conditional Features
Easy to enable/disable features per environment without code changes. Just set environment variables.

### 5. Better Developer Experience
Developers don't need to install or configure Sentry/OpenTelemetry for local development. Features "just work" when disabled.

---

## Next Steps

### Ready for Production Merge ✅

Both branches now successfully deployed to staging:

1. **feature/redis-caching-clean**: Redis caching with 10-50x speedup
2. **feature/sentry-observability-clean**: Sentry error tracking + OpenTelemetry tracing

### Recommended Merge Order

```bash
# 1. Merge Redis caching first (foundational)
git checkout main
git merge feature/redis-caching-clean
git push origin main

# 2. Merge Sentry observability (builds on Redis)
git checkout main
git merge feature/sentry-observability-clean
git push origin main

# 3. GitHub Actions will auto-deploy to production
# Monitor: https://148.113.196.245/api/health
```

### Production Environment Variables

Add to production `.env`:
```env
# Redis (already configured)
REDIS_URL=redis://localhost:6379

# Sentry (enable for production)
SENTRY_ENABLED=true
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1

# OpenTelemetry (optional - start disabled)
OTEL_ENABLED=false
```

### Post-Deployment Verification

```bash
# 1. Check production health
curl https://148.113.196.245/api/health

# 2. Verify Sentry initialized
# Production logs should show:
# [SENTRY] Initialized successfully (environment: production)

# 3. Test error tracking
# Trigger a test error, verify it appears in Sentry dashboard

# 4. Check cache performance
curl https://148.113.196.245/api/cache/stats
# Should show cache hit ratio > 50%
```

---

## Lessons Learned

### 1. ES Module Import Timing
Top-level `import` statements resolve at **parse time**, not runtime. Use dynamic `import()` for optional dependencies.

### 2. Module Graph Side Effects
Even exporting a value from a module causes it to load. Use `export type` for type-only exports.

### 3. Indirect Dependencies
Files that import from a module can trigger cascading module loads. Break the chain with type-only exports.

### 4. Async Initialization
Dynamic imports are async, so initialization functions must be `async` and callers must `await`.

### 5. Graceful Degradation
Always check if optional modules loaded before using them. Provide sensible defaults when disabled.

---

## Related Documentation

- [CLAUDE.md](./CLAUDE.md) - Project overview and setup
- [ARCHITECTURE_ANALYSIS.md](./ARCHITECTURE_ANALYSIS.md) - Architecture improvements
- [SERVER_SETUP.md](./SERVER_SETUP.md) - Production deployment guide

---

**Fix Completed**: October 6, 2025
**By**: Claude Code
**Status**: ✅ Production Ready
