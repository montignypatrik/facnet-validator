# Dash Module System

Dash uses a **modular architecture** where each business function is a self-contained module with its own routes, logic, and resources.

## Architecture Overview

### Module Registry

All modules are registered in [`server/moduleRegistry.ts`](../../server/moduleRegistry.ts):

```typescript
export interface DashModule {
  name: string;
  version: string;
  description: string;
  router: Router;
  enabled: boolean;
  requiredRole?: string;
}
```

### Module Loading

Modules are loaded dynamically at server startup:

1. Module manifests (`dash.json`) define configuration
2. Routes imported dynamically from module directories
3. Module registry mounts routes with appropriate prefixes
4. Disabled modules are skipped during registration

## Active Modules (5/10)

### 1. Core Authentication (`core-auth`)
- **Path**: `server/core/authRoutes.ts`
- **Purpose**: Auth0 integration and user management
- **Routes**: `/api/auth/*`
- **Required**: Yes (always enabled)

### 2. Observability (`observability`)
- **Path**: `server/observability/`
- **Purpose**: Sentry error tracking + OpenTelemetry tracing
- **Routes**: `/api/observability/*`
- **Features**: PHI sanitization, distributed tracing

### 3. Validateur (`validateur`)
- **Path**: `server/modules/validateur/`
- **Purpose**: Quebec RAMQ billing validation (flagship module)
- **Routes**: `/api/*` (validation, files, analytics)
- **Documentation**: [Validateur Module Guide](validateur/)

### 4. Database (`database`)
- **Path**: `server/modules/database/`
- **Purpose**: Manage codes, contexts, establishments, rules
- **Routes**: `/api/codes`, `/api/contexts`, `/api/establishments`, `/api/rules`

### 5. Administration (`administration`)
- **Path**: `server/modules/administration/`
- **Purpose**: User management with RBAC
- **Routes**: `/api/users/*`
- **Required Role**: `admin`

## Disabled Modules (5/10)

These modules are implemented but not currently active in production:

### 6. Chatbot (`chatbot`)
- **Status**: Disabled
- **Purpose**: AI-powered medical billing assistant (Ollama)
- **Documentation**: [Chatbot Module Guide](chatbot/)

### 7. Chatbot Chat (`chatbot-chat`)
- **Status**: Disabled
- **Purpose**: Conversation and message management

### 8. Chatbot Admin (`chatbot-admin`)
- **Status**: Disabled
- **Purpose**: Knowledge base administration
- **Required Role**: `editor`

### 9. Formation & Ressourcement (`formation-ressourcement`)
- **Status**: Disabled
- **Purpose**: Training resources for healthcare billing professionals

### 10. Tasks (`tasks`)
- **Status**: Disabled
- **Purpose**: Kanban task and workflow management
- **Documentation**: [Tasks Module Guide](tasks/)

## Module Structure

### Standard Module Layout

```
server/modules/my-module/
├── dash.json           # Module manifest
├── routes.ts           # Express routes
├── storage.ts          # Database operations
├── validation.ts       # Business logic
└── types.ts            # TypeScript types
```

### Module Manifest (`dash.json`)

Every module must have a `dash.json` file:

```json
{
  "name": "my-module",
  "version": "1.0.0",
  "description": "Module description",
  "routes": [
    {
      "path": "/api/my-module",
      "file": "routes.ts"
    }
  ],
  "requiresAuth": true,
  "dependencies": []
}
```

## Creating a New Module

### Step 1: Create Module Directory

```bash
mkdir -p server/modules/my-module
cd server/modules/my-module
```

### Step 2: Create Manifest

Create `dash.json`:

```json
{
  "name": "my-module",
  "version": "1.0.0",
  "description": "My new module",
  "routes": [
    {
      "path": "/api/my-module",
      "file": "routes.ts"
    }
  ],
  "requiresAuth": true,
  "dependencies": []
}
```

### Step 3: Create Routes

Create `routes.ts`:

```typescript
import { Router } from "express";
import { authenticateToken, requireRole } from "../../core/auth";

const router = Router();

router.get("/api/my-module",
  authenticateToken,
  requireRole("viewer"),
  async (req, res) => {
    res.json({ message: "Hello from my module!" });
  }
);

export default router;
```

### Step 4: Register Module

Edit `server/moduleRegistry.ts`:

```typescript
// Import routes
const myModuleRoutes = (await import("./modules/my-module/routes")).default;

// Add to modules array
{
  name: "my-module",
  version: "1.0.0",
  description: "My new module",
  router: myModuleRoutes,
  enabled: true,
}
```

### Step 5: Add Documentation

Create `docs/modules/my-module/README.md`:

```markdown
# My Module

Description of what this module does.

## Features

- Feature 1
- Feature 2

## API Endpoints

### GET /api/my-module

Returns module data.

**Authentication**: Required
**Role**: viewer

**Response**:
```json
{
  "message": "Hello from my module!"
}
```
```

## Module Best Practices

### Authentication

Always use authentication middleware for protected routes:

```typescript
router.get("/api/my-endpoint",
  authenticateToken,  // Verify JWT token
  requireRole("viewer"),  // Check user role
  async (req, res) => {
    // Handler logic
  }
);
```

### Error Handling

Use consistent error responses:

```typescript
try {
  const result = await doSomething();
  res.json({ success: true, data: result });
} catch (error) {
  console.error("Error in my-module:", error);
  res.status(500).json({
    error: "Internal server error",
    message: error.message
  });
}
```

### Input Validation

Use Zod for request validation:

```typescript
import { z } from "zod";

const requestSchema = z.object({
  name: z.string().min(1).max(100),
  value: z.number().positive()
});

router.post("/api/my-endpoint",
  authenticateToken,
  async (req, res) => {
    try {
      const validated = requestSchema.parse(req.body);
      // Use validated data
    } catch (error) {
      res.status(400).json({ error: "Invalid input" });
    }
  }
);
```

### PHI Protection

Never log patient identifiers:

```typescript
// ✅ Safe
logger.info("Processing validation", {
  runId: validationRunId,
  rowCount: 150
});

// ❌ Unsafe - PHI exposure!
logger.info("Processing patient", {
  patient: "PATIENT_001",  // Don't log!
  healthCard: "123456"     // Don't log!
});
```

## Module Configuration

### Environment Variables

Module-specific environment variables should be prefixed:

```env
# Example for "my-module"
MY_MODULE_API_KEY=secret123
MY_MODULE_ENABLED=true
```

### Feature Flags

Use the `enabled` flag in module registry for feature flagging:

```typescript
{
  name: "my-module",
  version: "1.0.0",
  description: "My new module",
  router: myModuleRoutes,
  enabled: process.env.MY_MODULE_ENABLED === 'true',
}
```

## Module Dependencies

### Declaring Dependencies

If your module depends on another module:

```json
{
  "name": "my-module",
  "version": "1.0.0",
  "description": "My new module",
  "dependencies": ["database", "core-auth"]
}
```

### Checking Dependencies

The module registry validates dependencies at startup.

## Testing Modules

### Unit Tests

Create tests in `tests/unit/modules/my-module/`:

```typescript
import { describe, it, expect } from 'vitest';
import { processData } from '../../../../server/modules/my-module/logic';

describe('My Module Logic', () => {
  it('should process data correctly', () => {
    const result = processData({ value: 42 });
    expect(result).toBe(84);
  });
});
```

### Integration Tests

Create tests in `tests/integration/modules/my-module/`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../../../server/index';

describe('My Module API', () => {
  it('should return module data', async () => {
    const response = await request(app)
      .get('/api/my-module')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Hello from my module!');
  });
});
```

## Module Documentation

Each module should have documentation in `docs/modules/[module-name]/`:

- `README.md` - Module overview
- `API.md` - API endpoints (if different from main API)
- `ARCHITECTURE.md` - Technical architecture
- `EXAMPLES.md` - Usage examples

## Enabling/Disabling Modules

### During Development

Edit `server/moduleRegistry.ts`:

```typescript
{
  name: "my-module",
  version: "1.0.0",
  description: "My module",
  router: myModuleRoutes,
  enabled: true,  // Change to false to disable
}
```

### In Production

Use environment variables:

```env
ENABLE_MY_MODULE=true
```

```typescript
{
  name: "my-module",
  version: "1.0.0",
  description: "My module",
  router: myModuleRoutes,
  enabled: process.env.ENABLE_MY_MODULE === 'true',
}
```

## Module Lifecycle

1. **Initialization**: Module imported and routes registered
2. **Request Handling**: Routes handle incoming requests
3. **Shutdown**: Graceful cleanup (if needed)

### Graceful Shutdown

If your module needs cleanup on shutdown:

```typescript
// In module routes.ts
export async function cleanup() {
  console.log('[MY-MODULE] Cleaning up resources...');
  // Close connections, save state, etc.
}

// In server/index.ts shutdown handler
import { cleanup as cleanupMyModule } from './modules/my-module/routes';
await cleanupMyModule();
```

## Module Introspection

### List Available Modules

```bash
curl http://localhost:5000/api/modules
```

Returns:
```json
{
  "platform": "Dash",
  "version": "1.0.0",
  "modules": [
    {
      "name": "validateur",
      "version": "1.0.0",
      "description": "Quebec healthcare billing validation (RAMQ)",
      "enabled": true
    },
    ...
  ]
}
```

## Related Documentation

- [Contributing Guide](../../CONTRIBUTING.md) - How to contribute modules
- [API Documentation](../guides/API.md) - Complete API reference
- [Testing Guide](../guides/TESTING.md) - Testing best practices
- [Architecture Overview](../architecture/README.md) - System architecture

## Support

For questions about module development:
- Check existing module implementations in `server/modules/`
- Review module documentation in `docs/modules/`
- Create GitHub issue for specific questions
