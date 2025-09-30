# FacNet Validator - Project Structure

**Last Updated**: September 29, 2025
**Version**: 1.0

This document provides a comprehensive overview of the project structure, file organization, and architectural decisions for the FacNet Validator healthcare billing validation system.

## Table of Contents
- [Overview](#overview)
- [Directory Structure](#directory-structure)
- [Key Directories](#key-directories)
- [Configuration Files](#configuration-files)
- [Data Management](#data-management)
- [Development Workflow](#development-workflow)

---

## Overview

FacNet Validator is a full-stack web application for validating Quebec healthcare billing data against RAMQ (Régie de l'assurance maladie du Québec) rules. The project uses a monorepo structure with separate client and server directories, shared TypeScript types, and comprehensive data import capabilities.

### Technology Stack Summary
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript + Drizzle ORM
- **Database**: PostgreSQL 16
- **Authentication**: Auth0 (OAuth 2.0 / JWT)
- **Deployment**: GitHub Actions CI/CD → Ubuntu VPS with PM2 + Nginx

---

## Directory Structure

```
facnet-validator/
├── client/                      # React frontend application
│   ├── src/
│   │   ├── api/                 # API client configuration (Axios)
│   │   ├── components/          # Reusable UI components
│   │   │   ├── ui/              # shadcn/ui base components (Button, Dialog, etc.)
│   │   │   ├── AppLayout.tsx    # Main layout with sidebar navigation
│   │   │   ├── DataTable.tsx    # Generic data grid with CRUD operations
│   │   │   ├── DynamicForm.tsx  # Form generator for custom fields
│   │   │   └── FileDropzone.tsx # File upload with drag-and-drop
│   │   ├── hooks/               # Custom React hooks
│   │   ├── lib/                 # Utility functions and helpers
│   │   ├── pages/               # Route components
│   │   │   ├── Dashboard.tsx    # KPI overview and quick actions
│   │   │   ├── Codes.tsx        # RAMQ billing codes management
│   │   │   ├── Contexts.tsx     # Service context elements
│   │   │   ├── Establishments.tsx # Healthcare facilities
│   │   │   ├── Rules.tsx        # Validation rules management
│   │   │   ├── Settings.tsx     # User settings and preferences
│   │   │   └── validator/       # Multi-page validation workflow
│   │   │       ├── ValidatorUpload.tsx    # File upload interface
│   │   │       ├── ValidatorRuns.tsx      # Validation execution list
│   │   │       └── ValidatorAnalytics.tsx # Results visualization
│   │   ├── main.tsx             # Application entry point (Auth0 setup)
│   │   ├── App.tsx              # Root component with routing
│   │   └── index.css            # Global styles and Tailwind directives
│   ├── index.html               # HTML template
│   └── vite.config.ts           # Vite build configuration
│
├── server/                      # Express backend API
│   ├── index.ts                 # Server entry point and middleware setup
│   ├── routes.ts                # API endpoint handlers
│   ├── storage.ts               # Database abstraction layer (Drizzle)
│   ├── schema.ts                # Database schema definitions
│   ├── auth.ts                  # JWT verification and RBAC middleware
│   ├── migrate-rules.ts         # Database rule initialization
│   └── validation/              # Validation engine
│       ├── engine.ts            # Main validation orchestrator
│       ├── databaseRuleLoader.ts # Dynamic rule loading from DB
│       ├── rules/               # Rule implementations
│       │   ├── base.ts          # Base validation rule interface
│       │   ├── officeFeeValidation.ts # Office fee daily limits
│       │   └── [other rules]    # Additional validation rules
│       └── types.ts             # Validation-specific TypeScript types
│
├── shared/                      # Shared TypeScript types
│   └── types.ts                 # Common interfaces and types
│
├── scripts/                     # Data import utilities
│   ├── import_codes.js          # RAMQ billing codes importer
│   ├── import_contexts.cjs      # Context elements importer
│   └── import_establishments.cjs # Healthcare facilities importer
│
├── data/                        # Data files (gitignored)
│   ├── imports/                 # Official RAMQ reference data
│   │   ├── RAMQ-codes.csv       # 6,740+ billing codes
│   │   ├── RAMQ-contexts.csv    # Service context modifiers
│   │   └── RAMQ-establishments.csv # Quebec healthcare facilities
│   └── samples/                 # Example billing CSV files for testing
│
├── uploads/                     # Temporary file uploads (gitignored)
│
├── .github/                     # GitHub configuration
│   └── workflows/
│       └── deploy.yml           # Automated deployment pipeline
│
├── .gitignore                   # Git exclusions
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── drizzle.config.ts            # Drizzle ORM configuration
├── .env                         # Environment variables (gitignored)
├── .env.example                 # Environment template
├── ecosystem.config.js          # PM2 production configuration
├── ecosystem.staging.js         # PM2 staging configuration
├── CLAUDE.md                    # Claude AI project instructions
├── PROJECT_STRUCTURE.md         # This file
├── SERVER_SETUP.md              # Production server documentation
└── README.md                    # Project overview
```

---

## Key Directories

### `/client` - Frontend Application

**Purpose**: React-based user interface for healthcare administrators
**Build Output**: `dist/` directory (served by Nginx in production)
**Dev Server**: Vite development server on port 5000

**Important Subdirectories**:
- **`src/pages/`**: One component per route, organized by feature
- **`src/components/ui/`**: Shadcn/ui primitives (Button, Dialog, Select, etc.)
- **`src/components/`**: Custom business components (DataTable, AppLayout)
- **`src/api/`**: Axios client with Auth0 token injection
- **`src/lib/`**: Utilities (date formatting, validation helpers)

**Key Files**:
- `main.tsx` - Auth0Provider configuration with Quebec domain
- `App.tsx` - Wouter routing setup with authentication guards
- `vite.config.ts` - Proxies `/api` to backend, sets `envDir: "./"` for root `.env` access

### `/server` - Backend API

**Purpose**: Express REST API with PostgreSQL database
**Runtime**: Node.js with TypeScript compilation
**Port**: 5000 (both dev and production)

**Important Files**:
- **`index.ts`**: Server initialization, middleware setup (CORS, body-parser, Auth0)
- **`routes.ts`**: All API endpoints grouped by resource type
- **`storage.ts`**: Database queries using Drizzle ORM
- **`schema.ts`**: PostgreSQL table definitions with relationships
- **`auth.ts`**: JWT verification, email domain validation (`@facturation.net`), RBAC

**Validation Engine** (`/validation`):
- **`engine.ts`**: Processes uploaded CSV files against validation rules
- **`databaseRuleLoader.ts`**: Converts database rules to executable JavaScript functions
- **`rules/`**: Individual rule implementations (office fees, context validation, etc.)

### `/shared` - Common Types

**Purpose**: TypeScript interfaces shared between client and server
**Why**: Ensures type safety across full stack (API contracts)

**Contents**:
- Database entity types (Code, Context, Establishment, Rule, ValidationRun)
- API request/response interfaces
- Validation result types

### `/scripts` - Data Importers

**Purpose**: Populate database with official Quebec healthcare data
**Runtime**: Node.js scripts run manually or during deployment

**Scripts**:
- `import_codes.js` - Imports 6,740+ RAMQ billing codes from CSV
- `import_contexts.cjs` - Imports service context modifiers
- `import_establishments.cjs` - Imports Quebec healthcare facilities across 18 regions

**Usage**:
```bash
node scripts/import_codes.js
node scripts/import_contexts.cjs
node scripts/import_establishments.cjs
```

### `/data` - Reference Data

**Purpose**: Store CSV files for database imports and testing samples
**Git Status**: Excluded from version control (added to `.gitignore`)

**Structure**:
- **`data/imports/`**: Official RAMQ reference data (codes, contexts, establishments)
- **`data/samples/`**: Example billing CSV files for validation testing

**Why Gitignored**: Data files are large (1.6MB+) and contain sensitive healthcare information

---

## Configuration Files

### Root Level

| File | Purpose | Notes |
|------|---------|-------|
| **`package.json`** | Dependencies, scripts, project metadata | Defines `dev`, `build`, `start`, `db:push` commands |
| **`tsconfig.json`** | TypeScript compiler options | Strict mode enabled, path aliases configured |
| **`drizzle.config.ts`** | Drizzle ORM database connection | Points to `server/schema.ts` for migrations |
| **`.env`** | Environment variables (gitignored) | Database credentials, Auth0 config |
| **`.env.example`** | Environment template | Safe to commit, no secrets |
| **`.gitignore`** | Git exclusions | Excludes `node_modules/`, `dist/`, `data/`, `.env` |
| **`vite.config.ts`** | Vite bundler configuration | API proxy, path resolution, envDir |

### Deployment Configuration

| File | Purpose | Environment |
|------|---------|-------------|
| **`ecosystem.config.js`** | PM2 process manager config | Production (cluster mode, 6 instances) |
| **`ecosystem.staging.js`** | PM2 staging config | Staging (fork mode, single instance) |
| **`.github/workflows/deploy.yml`** | GitHub Actions CI/CD | Automated deployment on push to `main` |

### Documentation

| File | Purpose | Audience |
|------|---------|----------|
| **`CLAUDE.md`** | AI assistant project instructions | Claude AI agent |
| **`PROJECT_STRUCTURE.md`** | This file - architecture overview | Developers |
| **`SERVER_SETUP.md`** | Production server setup guide | DevOps/Sysadmin |
| **`README.md`** | Project overview and quick start | All users |

---

## Data Management

### Database Schema

**ORM**: Drizzle (type-safe SQL query builder)
**Migration Strategy**: Schema push (`npm run db:push`)
**Database**: PostgreSQL 16

**Core Tables**:
- `users` - Authentication and authorization
- `codes` - RAMQ billing codes (6,740+ records)
- `contexts` - Service context modifiers
- `establishments` - Quebec healthcare facilities
- `rules` - Validation rules (database-driven)
- `field_catalog` - Dynamic field definitions
- `files` - Upload metadata
- `validation_runs` - Validation execution history
- `validation_results` - Individual validation errors/warnings

**Key Relationships**:
- `validation_runs` → `files` (foreign key)
- `validation_results` → `validation_runs` (foreign key)
- `validation_results` → `rules` (foreign key, rule_id as text)

### Data Import Workflow

1. **Download RAMQ Data**: Obtain official CSV files from Quebec government
2. **Place in `data/imports/`**: Copy CSV files to this directory
3. **Run Import Scripts**: Execute Node.js scripts to populate database
4. **Verify Data**: Check database for correct record counts
5. **Test Validation**: Upload sample billing CSV to verify rules work

**Important**: Data files are excluded from Git. New team members must obtain RAMQ data separately and run import scripts.

### File Upload Processing

**Storage**: Files saved to `uploads/` directory (gitignored)
**Security**: Automatic deletion after validation completes
**Supported Formats**: CSV files (comma or semicolon delimited)
**Size Limits**: Configured in server middleware (default: 10MB)

**Processing Pipeline**:
1. User uploads CSV via drag-and-drop interface
2. File saved to `uploads/` with unique filename
3. Validation run created in database
4. CSV parsed and validated row-by-row
5. Results stored in `validation_results` table
6. File automatically deleted from `uploads/`
7. User views results in analytics interface

---

## Development Workflow

### Local Development

**Prerequisites**:
- Node.js 18+ and npm
- PostgreSQL 16 installed and running
- Quebec RAMQ data CSV files

**Setup Steps**:
```bash
# 1. Clone repository
git clone https://github.com/montignypatrik/facnet-validator.git
cd facnet-validator

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your database credentials and Auth0 settings

# 4. Setup database
npm run db:push

# 5. Import reference data
node scripts/import_codes.js
node scripts/import_contexts.cjs
node scripts/import_establishments.cjs

# 6. Start development server
npm run dev
# Frontend and backend both run on http://localhost:5000
```

**Development Tools**:
- **TypeScript**: Type checking with `npm run check`
- **Hot Reload**: Vite HMR for instant frontend updates
- **Database GUI**: pgAdmin or DBeaver for PostgreSQL management
- **API Testing**: Use frontend or tools like Postman/Insomnia

### Git Workflow

**Branch Strategy**: GitHub Flow
**Main Branch**: `main` (auto-deploys to production)
**Feature Branches**: `feature/description`, `fix/issue-name`

**Development Process**:
```bash
# 1. Create feature branch
git checkout -b feature/new-validation-rule

# 2. Develop and test locally
npm run dev
# Make changes, test thoroughly

# 3. Commit changes
git add .
git commit -m "Add new RAMQ validation rule for office fees"

# 4. Push to GitHub
git push origin feature/new-validation-rule

# 5. Test on staging (optional)
ssh ubuntu@148.113.196.245
cd /var/www/facnet/staging
sudo -u facnet git checkout feature/new-validation-rule
sudo -u facnet npm install && npm run build
sudo -u facnet pm2 restart facnet-validator-staging

# 6. Merge to main → automatic production deployment
git checkout main
git merge feature/new-validation-rule
git push origin main
# GitHub Actions deploys to production automatically
```

### Production Deployment

**Method**: Automated via GitHub Actions
**Trigger**: Push to `main` branch
**Target**: Ubuntu VPS at 148.113.196.245

**Deployment Steps** (automated):
1. GitHub Actions workflow triggered
2. Application builds in CI environment
3. Tests run (if configured)
4. SSH deploy to VPS
5. Dependencies installed (`npm install`)
6. Database migrations applied (`npm run db:push`)
7. Application built (`npm run build`)
8. PM2 restarts with zero downtime
9. Health checks verify deployment success

**Manual Verification**:
```bash
# Check PM2 status
ssh ubuntu@148.113.196.245 "pm2 status"

# Check application logs
ssh ubuntu@148.113.196.245 "pm2 logs facnet-validator --lines 50"

# Verify HTTPS access
curl https://148.113.196.245
```

### Staging Environment

**Purpose**: Safe testing before production
**URL**: https://148.113.196.245:3001
**Database**: `dashvalidator_staging` (separate from production)

**Testing Workflow**:
1. Deploy feature branch to staging manually
2. Test with production-like data and environment
3. Verify validation rules work correctly
4. If tests pass, merge to main for production deployment

---

## File Organization Principles

### What Goes Where?

**Client Code** (`/client`):
- React components, pages, hooks
- Frontend-only utilities (date formatting, UI helpers)
- Styling (Tailwind classes, CSS files)
- Auth0 React SDK usage

**Server Code** (`/server`):
- Express routes and middleware
- Database queries (Drizzle ORM)
- Validation engine and rules
- Auth0 JWT verification
- File upload handling

**Shared Code** (`/shared`):
- TypeScript interfaces used by both client and server
- Common enums and constants
- API contract types

**Scripts** (`/scripts`):
- One-time or periodic data import tasks
- Database maintenance utilities
- Development helper scripts

**Data** (`/data`):
- CSV files for database imports
- Sample billing files for testing
- **Never committed to Git** (added to `.gitignore`)

### What NOT to Commit

As specified in [.gitignore](/.gitignore):
- `node_modules/` - Dependencies (install via npm)
- `dist/` and `build/` - Build artifacts (generated by Vite)
- `.env` and `client/.env` - Secrets and local config
- `uploads/` - Temporary uploaded files
- `data/` - Large CSV files and sensitive data
- `*.png` - Screenshots and images (unless explicitly needed)
- `.claude/` - Claude AI session state

---

## Architecture Decisions

### Why Monorepo?

**Decision**: Keep client and server in same repository
**Rationale**:
- Shared TypeScript types between frontend and backend
- Simplified deployment (single build process)
- Easier refactoring (change types in one place)
- Single version control history

**Trade-offs**:
- Single `package.json` means one shared dependency tree
- Must be careful not to import server code in client

### Why Database-Driven Validation Rules?

**Decision**: Store validation rules in PostgreSQL instead of hardcoded
**Rationale**:
- Non-developers can create/modify rules via UI
- Rules can be enabled/disabled without code changes
- Audit trail of rule changes
- Quebec healthcare rules change frequently

**Implementation**:
- Rules stored as JSON in `rules` table
- `databaseRuleLoader.ts` converts JSON to executable functions
- Fallback to hardcoded rules if database empty
- Rule engine (`engine.ts`) executes rules against billing data

### Why Vite Instead of Create React App?

**Decision**: Use Vite for frontend build tool
**Rationale**:
- Faster development server startup (ES modules)
- Faster hot module replacement (HMR)
- Better production builds (Rollup)
- Official React team recommendation (CRA deprecated)

### Why Auth0 Instead of Custom Auth?

**Decision**: Use Auth0 for authentication and authorization
**Rationale**:
- Healthcare data requires enterprise-grade security
- OAuth 2.0 / JWT industry standard
- Social login support (Google, etc.)
- Role-based access control (RBAC) built-in
- Email verification and MFA capabilities
- Compliance with SOC 2, HIPAA, GDPR

---

## Troubleshooting

### Common Issues

**Port 5000 Already in Use**:
```bash
# Windows
netstat -ano | findstr :5000
powershell "Stop-Process -Id [PID] -Force"

# Linux/Mac
lsof -ti:5000 | xargs kill -9
```

**Database Connection Errors**:
- Verify PostgreSQL is running: `pg_isready`
- Check credentials in `.env` match database user
- Ensure database exists: `psql -l | grep dashvalidator`
- Run migrations: `npm run db:push`

**Auth0 Login Fails**:
- Check Auth0 domain in `.env` matches Auth0 dashboard
- Verify callback URL registered: `http://localhost:5000/callback`
- Check browser console for errors
- Clear Auth0 cache: Delete localStorage keys starting with `@@auth0`

**Validation Rules Not Running**:
- Check rules exist in database: `SELECT * FROM rules WHERE enabled = true`
- Run rule migration: `npm run dev` (migrations run on startup)
- Check server logs for rule loading errors

**CSV Upload Processing Stuck**:
- Check file is valid CSV with proper headers
- Verify delimiter detection in server logs
- Check uploads directory is writable
- Look for validation errors in database: `SELECT * FROM validation_results`

---

## Additional Resources

- **Auth0 Documentation**: https://auth0.com/docs
- **Drizzle ORM Docs**: https://orm.drizzle.team/docs/overview
- **Vite Documentation**: https://vite.dev/guide/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **shadcn/ui**: https://ui.shadcn.com/docs
- **RAMQ Official Site**: https://www.ramq.gouv.qc.ca/

---

**Document Maintainer**: This file should be updated whenever significant architectural changes are made to the project structure. Last updated during project cleanup refactoring (September 29, 2025).