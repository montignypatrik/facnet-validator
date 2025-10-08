# Dash - Quebec Healthcare Billing Validation Platform

## Quick Start

```bash
npm install
npm run db:push
npm run dev  # Starts on port 5000
```

**Prerequisites**: PostgreSQL 16, Redis, Node.js 20+

## Project Overview

**Dash** is a modular SAAS platform for Quebec healthcare billing validation (RAMQ). Healthcare administrators upload CSV billing files, validate against official Quebec regulations, and identify errors before submission.

- **Language**: French (Quebec market focus)
- **Status**: ✅ Production (https://148.113.196.245)
- **Database**: PostgreSQL with 6,740 RAMQ billing codes
- **Compliance**: PHI (Protected Health Information) compliant with HIPAA

## Technology Stack

### Backend
- Node.js + TypeScript + Express.js
- PostgreSQL 16 with Drizzle ORM
- Redis (caching + BullMQ queues)
- Auth0 (OAuth 2.0/JWT authentication)
- Sentry + OpenTelemetry (observability)

### Frontend
- React 18 + TypeScript + Vite
- TanStack Query (state management)
- Tailwind CSS + shadcn/ui + Radix UI
- Wouter (routing)

## Active Modules (5/10)

1. **validateur** - Quebec RAMQ billing validation (flagship)
2. **database** - Manage codes, contexts, establishments, rules
3. **administration** - User management with RBAC (pending, viewer, editor, admin)
4. **core-auth** - Auth0 authentication
5. **observability** - Sentry error tracking + OpenTelemetry tracing

## Disabled Modules (5/10)

- **chatbot** - AI-powered medical billing assistant (Ollama)
- **chatbot-chat** - Conversation management
- **chatbot-admin** - Knowledge base administration
- **formation-ressourcement** - Training resources
- **tasks** - Kanban task management

*Disabled modules are implemented but not currently active. See [docs/modules/](docs/modules/) for documentation.*

## Documentation

### Getting Started
- [Development Setup](docs/getting-started/DEVELOPMENT_SETUP.md)
- [Quick Start Guide](docs/getting-started/)

### Architecture
- [System Architecture](docs/architecture/ARCHITECTURE.md)
- [Module System](docs/modules/README.md)
- [Database Schema](docs/guides/DATABASE.md)

### Guides
- [API Reference](docs/guides/API.md)
- [Validation Rules](docs/modules/validateur/)
- [Background Jobs](docs/guides/BACKGROUND_JOBS.md)
- [Performance Optimization](docs/guides/PERFORMANCE.md)
- [Testing Guide](docs/guides/TESTING.md)

### Operations
- [Server Setup](docs/operations/SERVER_SETUP.md)
- [Deployment](docs/operations/DEPLOYMENT.md)
- [Database Credentials](docs/operations/DATABASE_CREDENTIALS.md)
- [Monitoring](docs/operations/OBSERVABILITY.md)

### Security
- [PHI Access Control](docs/security/PHI_ACCESS_CONTROL.md)
- [PHI Redaction](docs/security/PHI_REDACTION.md)
- [Security Overview](docs/security/README.md)

### User Guide
- [Guide Utilisateur (Français)](docs/guides/GUIDE_UTILISATEUR.md)

### Planning & History
- [Future Plans](docs/planning/)
- [Implementation History](docs/history/)

## Common Commands

```bash
# Development
npm run dev          # Start development server (port 5000)
npm run check        # TypeScript type checking
npm test             # Run Vitest tests
npm run test:ui      # Vitest UI

# Production
npm run build        # Build for production
npm start            # Start production server

# Database
npm run db:push      # Apply schema changes (Drizzle)

# Data Import
node scripts/import_codes.js             # Import RAMQ codes
node scripts/import_contexts.cjs         # Import contexts
node scripts/import_establishments.cjs   # Import establishments
```

## Environment Variables

**Required** (see `.env` file):

```bash
# Database (PostgreSQL with SSL/TLS)
DATABASE_URL=postgresql://dashvalidator_user:PASSWORD@localhost:5432/dashvalidator?sslmode=require

# Redis (caching + BullMQ)
REDIS_URL=redis://localhost:6379

# Auth0 (frontend - VITE_ prefix required)
VITE_AUTH0_DOMAIN=dev-x63i3b6hf5kch7ab.ca.auth0.com
VITE_AUTH0_CLIENT_ID=ECieaY4IiPbZNbWMoGJTPmD4pGsEi2rr
VITE_AUTH0_AUDIENCE=facnet-validator-api

# Auth0 (backend)
AUTH0_CLIENT_SECRET=fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk
AUTH0_ISSUER_BASE_URL=https://dev-x63i3b6hf5kch7ab.ca.auth0.com

# Client API Base URL
VITE_API_BASE_URL=http://localhost:5000/api

# PHI Security
PHI_REDACTION_SALT=99396260a8d4111225c83d71a260fcdaed678481cd868fe0e35b1969dc273f1b
```

**⚠️ Important**: `VITE_*` variables must be present at build time (embedded in JavaScript bundle).

## Production Deployment

**Automated CI/CD**: GitHub Actions deploys to production on push to `main` branch.

- **Production URL**: https://148.113.196.245
- **GitHub**: https://github.com/montignypatrik/facnet-validator
- **Workflow**: `.github/workflows/deploy.yml`
- **Server**: Ubuntu 24.04.2 LTS (OVH Cloud VPS)
- **Process Manager**: PM2 with clustering (6 instances)
- **Web Server**: Nginx with SSL/HTTPS

**Staging Environment**: https://148.113.196.245:3001 (manual deployment for feature testing)

See [Server Setup Guide](docs/operations/SERVER_SETUP.md) for complete production configuration.

## Support

- **Documentation**: [docs/](docs/)
- **GitHub Issues**: https://github.com/montignypatrik/facnet-validator/issues
- **Project Structure**: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)
