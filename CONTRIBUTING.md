# Contributing to Dash

Thank you for your interest in contributing to Dash, the Quebec healthcare billing validation platform!

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 16+
- Redis 7+
- Auth0 account (for authentication)

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/montignypatrik/facnet-validator.git
cd facnet-validator

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your local credentials

# Initialize database
npm run db:push

# Start development server
npm run dev
```

Visit http://localhost:5000 to see the application.

## Project Structure

```
/
├── client/              # React frontend
│   ├── src/pages/       # Page components
│   ├── src/components/  # Reusable UI components
│   └── src/api/         # API client
├── server/              # Express backend
│   ├── core/            # Authentication, utilities
│   ├── modules/         # Business modules
│   └── observability/   # Monitoring and logging
├── docs/                # Documentation
│   ├── guides/          # User and technical guides
│   ├── modules/         # Module-specific docs
│   ├── security/        # Security documentation
│   └── operations/      # Deployment and operations
└── tests/               # Test files
    ├── unit/            # Unit tests
    └── integration/     # Integration tests
```

## Development Workflow

### Branch Strategy

We use **GitHub Flow**:

```bash
# Create feature branch
git checkout -b feature/my-new-feature

# Make changes and commit
git add .
git commit -m "feat: Add new RAMQ validation rule"

# Push to GitHub
git push origin feature/my-new-feature

# Create pull request on GitHub
```

**Branch Naming Conventions**:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `hotfix/` - Emergency production fixes

### Commit Message Convention

We follow conventional commits:

```
feat: Add new validation rule for office visits
fix: Correct CSV parsing for Quebec billing codes
docs: Update API documentation
test: Add tests for PHI sanitization
chore: Update dependencies
```

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier with project configuration
- **Linting**: ESLint with TypeScript rules
- **Line Length**: 120 characters max
- **Language**: Code comments in English, UI text in French

### Testing Requirements

All contributions must include tests:

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Coverage requirements:
# - Statements: 80%
# - Branches: 75%
# - Functions: 80%
# - Lines: 80%
```

**Test File Naming**:
- Unit tests: `*.test.ts` in `tests/unit/`
- Integration tests: `*.test.ts` in `tests/integration/`

**Example Test**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { validateOfficeVisit } from './validation';

describe('Office Visit Validation', () => {
  it('should detect missing context element 85 for walk-in patients', () => {
    const record = {
      code: '19928',
      patient: 'PATIENT_001',
      contextElements: []
    };

    const result = validateOfficeVisit(record);
    expect(result.isValid).toBe(false);
    expect(result.errors[0].code).toBe('MISSING_CONTEXT_85');
  });
});
```

## Module Development

### Creating a New Module

1. Create module directory: `server/modules/my-module/`
2. Create `dash.json` manifest:

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

3. Create `routes.ts` with Express routes
4. Register in `server/moduleRegistry.ts`
5. Add documentation in `docs/modules/my-module/`

### Module Best Practices

- **Isolation**: Modules should be self-contained
- **Authentication**: Use `authenticateToken` middleware for protected routes
- **Authorization**: Use `requireRole()` for role-based access
- **PHI Protection**: Never log patient identifiers, use PHI sanitization
- **French Interface**: All user-facing text in French
- **Error Handling**: Use consistent error response format

## Database Changes

### Schema Modifications

We use Drizzle ORM for schema management:

1. Edit schema in `server/schema.ts`
2. Push changes to database:

```bash
npm run db:push
```

3. Create migration (production):

```bash
drizzle-kit generate:pg
```

### Adding Indexes

Performance indexes should be added for:
- Foreign keys
- Frequently queried fields
- Fields used in WHERE clauses
- Fields used in ORDER BY

Example:
```sql
CREATE INDEX idx_validation_runs_user_id ON validation_runs(user_id);
```

## Security Guidelines

### PHI (Protected Health Information) Protection

**Critical**: Never log or expose patient identifiers

✅ **Safe**:
```typescript
logger.info('Validation completed', {
  validationRunId: runId,
  rowCount: 150,
  errorCount: 5
});
```

❌ **Unsafe**:
```typescript
logger.info('Patient data', {
  patient: 'PATIENT_001',  // PHI exposure!
  healthCard: '123456789012'  // PHI exposure!
});
```

### Authentication

All API endpoints (except `/api/health`) must use authentication:

```typescript
router.get('/api/my-endpoint',
  authenticateToken,
  requireRole('viewer'),
  async (req, res) => {
    // Handler logic
  }
);
```

### Input Validation

Always validate user input with Zod:

```typescript
import { z } from 'zod';

const createRecordSchema = z.object({
  code: z.string().min(1).max(10),
  units: z.number().min(0).optional(),
  date: z.string().datetime()
});

// In route handler:
const validated = createRecordSchema.parse(req.body);
```

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] Tests added and passing (80%+ coverage)
- [ ] Documentation updated
- [ ] No PHI in logs or error messages
- [ ] French UI text is correct
- [ ] TypeScript types are correct (no `any`)
- [ ] Commit messages follow convention

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests pass (80%+ coverage)
- [ ] Documentation updated
- [ ] No PHI exposure
- [ ] French UI text correct
```

### Review Process

1. **Automated Checks**: GitHub Actions runs tests and linting
2. **Code Review**: At least one maintainer approval required
3. **Staging Deployment**: PR deployed to staging for testing
4. **Merge**: Approved PRs merged to main
5. **Production Deployment**: Automatic deployment via GitHub Actions

## Common Tasks

### Adding a Validation Rule

See [`docs/modules/validateur/RULE_CREATION_GUIDE.md`](docs/modules/validateur/RULE_CREATION_GUIDE.md)

### Adding a Database Table

1. Define table in `server/schema.ts` using Drizzle
2. Run `npm run db:push` to create table
3. Add API routes in appropriate module
4. Update documentation in `docs/guides/DATABASE.md`

### Adding API Endpoint

1. Add route in module's `routes.ts`
2. Add authentication middleware
3. Add input validation with Zod
4. Add tests
5. Update `docs/guides/API.md`

## Getting Help

- **Documentation**: Start with [`CLAUDE.md`](CLAUDE.md) and browse `docs/`
- **GitHub Issues**: Search existing issues or create new one
- **Code Questions**: Comment on relevant file or create discussion

## License

By contributing, you agree that your contributions will be licensed under the project's license.

## Code of Conduct

- Be respectful and inclusive
- Focus on what is best for the project
- Show empathy towards other community members
- Accept constructive criticism gracefully

Thank you for contributing to Dash! 🚀
