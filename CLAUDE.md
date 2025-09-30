# FacNet Validator - CLAUDE.md

## Project Overview

**FacNet Validator** is a comprehensive web application designed for managing and validating Quebec's healthcare billing system data, specifically RAMQ (Régie de l'assurance maladie du Québec) medical billing codes and related healthcare data. The application serves as a data management platform for healthcare administrators to upload, validate, and process CSV files containing medical billing codes, manage healthcare establishment data, and perform analytics on healthcare billing patterns.

The application is fully internationalized in French, reflecting its Quebec healthcare system focus.

## Technology Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Auth0 (OAuth 2.0/JWT)
- **File Processing**: Multer for uploads, CSV-Parser for data processing
- **Validation**: Zod schemas for type safety

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Framework**: Radix UI primitives with custom components
- **Styling**: Tailwind CSS with shadcn/ui
- **Authentication**: Auth0 React SDK

## Project Structure

```
/
├── client/              # React frontend application
│   ├── src/
│   │   ├── pages/       # Page components (Dashboard, Codes, etc.)
│   │   ├── components/  # Reusable UI components
│   │   ├── api/         # API client configuration
│   │   └── lib/         # Utilities and helpers
├── server/              # Express backend API
│   ├── index.ts         # Server entry point
│   ├── routes.ts        # API route handlers
│   ├── storage.ts       # Database layer
│   ├── auth.ts          # Authentication middleware
│   └── schema.ts        # Drizzle database schema
├── shared/              # Shared TypeScript types
├── scripts/             # Data import utilities
├── uploads/             # File upload storage
└── attached_assets/     # Sample data files
```

## Key Features

### 1. Dashboard (Tableau de Bord)
- French interface with KPI overview
- System metrics and statistics
- Quick actions for file uploads
- Recent validation runs display

### 2. Data Management
- **Codes**: RAMQ medical billing codes management
- **Establishments**: Healthcare facilities across Quebec
- **Contexts**: Service delivery contexts and modifiers
- **Rules**: Business validation rules

### 3. File Processing System
- CSV file upload with drag-and-drop interface
- Asynchronous validation pipeline
- Progress tracking and error reporting
- Import/export functionality

### 4. Analytics
- Usage analytics and KPI metrics
- Data visualization with charts
- Performance monitoring

### 5. Dynamic Field System
- Custom field definitions per table
- Support for text, number, boolean, date, select types
- Validation rules and constraints

## Database Schema

### Core Tables
- `users` - Authentication and user management
- `codes` - RAMQ medical billing codes
- `contexts` - Healthcare service contexts
- `establishments` - Healthcare facilities
- `rules` - Business validation rules
- `field_catalog` - Dynamic field definitions
- `validation_runs` - File processing tracking
- `files` - Upload metadata

### Key Features
- Custom JSON fields for extensibility
- Soft deletes with active flags
- Audit trails with timestamps
- Role-based access control

## Authentication & Authorization

### Auth0 Configuration
- **Domain**: `dev-x63i3b6hf5kch7ab.ca.auth0.com`
- **Client ID**: `ECieaY4IiPbZNbWMoGJTPmD4pGsEi2rr`
- **Audience**: `facnet-validator-api`

### User Roles
- **Viewer**: Read-only access
- **Editor**: Read and write access
- **Admin**: Full access including deletions

## API Endpoints

### Authentication
- `POST /api/auth/verify` - Verify Auth0 token

### Data Management (for each table: codes, contexts, establishments, rules)
- `GET /api/{table}` - List with pagination/search
- `POST /api/{table}` - Create (Editor/Admin)
- `PATCH /api/{table}/:id` - Update (Editor/Admin)
- `DELETE /api/{table}/:id` - Delete (Admin)
- `POST /api/{table}/import` - CSV import (Editor/Admin)
- `GET /api/{table}/export` - CSV export

### File Processing
- `POST /api/files` - Upload file
- `POST /api/validations` - Start validation
- `GET /api/validations` - List validation runs
- `GET /api/validations/:id` - Get validation details

### Analytics
- `GET /api/analytics/kpis` - Key performance indicators
- `GET /api/analytics/unique-patients-by-day` - Patient analytics
- `GET /api/analytics/codes` - Code usage analytics

### Configuration
- `GET /api/field-catalog` - Dynamic field definitions
- `POST /api/field-catalog` - Create field (Editor/Admin)
- `PATCH /api/field-catalog/:id` - Update field (Editor/Admin)
- `DELETE /api/field-catalog/:id` - Delete field (Admin)

## Environment Configuration

### Database Credentials
**Database Name**: `dashvalidator`
**Username**: `dashvalidator_user`
**Password**: `dashvalidator123!`
**Host**: `localhost`
**Port**: `5432`

> **Important**: These credentials are stored in the `.env` file and should be kept secure. The database user has full permissions on the `dashvalidator` database and `public` schema.

### Required Environment Variables

**CRITICAL**: All `VITE_*` variables must be present in `.env` file at build time. Vite embeds these values into the JavaScript bundle during build. The `vite.config.ts` has `envDir` configured to load `.env` from project root (not from `client/` subdirectory).

```env
# Database
DATABASE_URL=postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator

# Auth0 - Frontend (VITE_* prefix required for client-side access)
VITE_AUTH0_DOMAIN=dev-x63i3b6hf5kch7ab.ca.auth0.com
VITE_AUTH0_CLIENT_ID=ECieaY4IiPbZNbWMoGJTPmD4pGsEi2rr
VITE_AUTH0_AUDIENCE=facnet-validator-api

# Auth0 - Backend (server-side only)
AUTH0_CLIENT_SECRET=fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk
AUTH0_ISSUER_BASE_URL=https://dev-x63i3b6hf5kch7ab.ca.auth0.com
AUTH0_AUDIENCE=facnet-validator-api

# Client API Base URL
VITE_API_BASE_URL=http://localhost:5000/api
```

### Environment Variable Troubleshooting

**Problem**: Auth0 shows "undefined" domain or authentication fails
**Symptoms**: Browser redirects to `https://undefined/authorize`
**Root Cause**: `VITE_AUTH0_DOMAIN` (or other `VITE_*` variables) missing or not loaded during build

**Solution**:
1. Verify `.env` file exists in **project root** (not in `client/` subdirectory)
2. Ensure all `VITE_*` variables are present with correct values
3. **Rebuild the application** after adding/changing environment variables:
   ```bash
   npm run build
   ```
4. Verify variables are embedded in built JavaScript:
   ```bash
   grep -o "dev-x63i3b6hf5kch7ab.ca.auth0.com" dist/public/assets/index-*.js
   ```
   - If no output, variables weren't loaded during build
   - Check `vite.config.ts` has `envDir: path.resolve(import.meta.dirname)`

**Why this matters**: Unlike backend environment variables (loaded at runtime), Vite frontend variables are **embedded at build time**. Changing `.env` requires rebuilding to take effect.

## Development Commands

### Setup
```bash
npm install                    # Install dependencies
npm run db:push               # Setup database schema
```

### Development
```bash
npm run dev                   # Start development server (port 5000)
npm run check                 # TypeScript type checking
```

### Production
```bash
npm run build                 # Build for production
npm run start                 # Start production server
```

### Production Deployment
**Current Method**: Automated GitHub Actions CI/CD Pipeline
**Status**: ✅ Active and Tested (September 29, 2025)

The application is automatically deployed to production on every push to the main branch:
- **Production URL**: https://148.113.196.245
- **GitHub Repository**: https://github.com/montignypatrik/facnet-validator
- **Workflow File**: `.github/workflows/deploy.yml`
- **Last Deployment**: Commit `9221ca0` - September 29, 2025

**Deployment Process**:
1. Push to main branch triggers GitHub Actions
2. Application builds and tests in CI environment
3. Automated SSH deployment to production VPS
4. Database migrations run automatically
5. PM2 restarts application with zero downtime
6. Health checks verify successful deployment

**Production Environment**:
- **Server**: Ubuntu 24.04.2 LTS on OVH Cloud VPS
- **Process Manager**: PM2 with clustering (6 instances)
- **Web Server**: Nginx with SSL/HTTPS
- **Database**: PostgreSQL 16 (`dashvalidator`)
- **Monitoring**: PM2 status, health endpoints, fail2ban security

### Staging Environment
**Purpose**: Safe testing of features before production deployment
**Status**: ✅ Active (September 29, 2025)

The staging environment mirrors production for safe feature testing:
- **Staging URL**: https://148.113.196.245:3001
- **Directory**: `/var/www/facnet/staging/`
- **Database**: `dashvalidator_staging`
- **Configuration**: `ecosystem.staging.js`

**Staging Features**:
- **Separate Database**: Isolated testing without affecting production data
- **Single Instance**: Fork mode for easier debugging
- **Same Infrastructure**: PostgreSQL 16, Nginx SSL, Ubuntu environment
- **Manual Deployment**: Deploy feature branches for testing

**Branch Testing Workflow**:
1. **Develop locally**: Create feature branch (`feature/new-validation`)
2. **Deploy to staging**: Manual deployment of feature branch
3. **Test on server**: Verify with real server environment and data structure
4. **Merge to main**: If tests pass, merge triggers automatic production deployment

### Database Management
```bash
npm run db:push               # Apply schema changes
node scripts/import_codes.js             # Import RAMQ codes
node scripts/import_contexts.cjs         # Import contexts
node scripts/import_establishments.cjs   # Import establishments
```

## Git Branch Development Workflow

### Branch Strategy
The project uses **GitHub Flow** for safe, continuous deployment of healthcare validation features.

#### Branch Types:
```bash
main                           # ← Production branch (auto-deploy)
feature/patient-analytics      # ← New features
feature/csv-improvements       # ← Feature development
fix/validation-performance     # ← Bug fixes
hotfix/critical-security       # ← Emergency fixes
```

#### Recommended Naming Conventions:
```bash
# Features
feature/email-notifications
feature/bulk-data-import
feature/dashboard-analytics
feature/user-roles-rbac

# Bug Fixes
fix/csv-parsing-error
fix/auth0-login-timeout
fix/validation-rule-logic

# Hotfixes
hotfix/security-vulnerability
hotfix/data-corruption-fix
```

### Development Workflow

#### 1. Local Development
```bash
# Start new feature
git checkout main
git pull origin main
git checkout -b feature/new-validation-rule

# Develop and test locally
npm run dev
# Make changes, test locally

# Commit your work
git add .
git commit -m "Add new RAMQ validation rule for Quebec billing codes"
git push origin feature/new-validation-rule
```

#### 2. Staging Deployment (Manual Testing)
```bash
# SSH to server (use ubuntu user, NOT root)
ssh ubuntu@148.113.196.245

# Navigate to staging
cd /var/www/facnet/staging

# Switch to your feature branch
sudo -u facnet git fetch origin
sudo -u facnet git checkout feature/new-validation-rule
sudo -u facnet git pull origin feature/new-validation-rule

# Install dependencies and build
sudo -u facnet npm install
sudo -u facnet npm run build
sudo -u facnet npm run db:push  # Apply any database changes

# Restart staging app (see troubleshooting below if this fails)
sudo -u facnet pm2 restart facnet-validator-staging

# Test at https://148.113.196.245:3001
# Verify Quebec healthcare data validation works correctly
```

#### Staging Troubleshooting Guide

**IMPORTANT**: If staging fails to start or shows 502 errors, follow this complete reset procedure:

##### Problem: Staging Returns 502 Bad Gateway
**Root Cause**: PM2 process not running on correct port or environment variables not loaded

**Solution - Complete Staging Reset**:
```bash
# 1. SSH to server
ssh ubuntu@148.113.196.245

# 2. Navigate to staging directory
cd /var/www/facnet/staging

# 3. Ensure you're on the correct branch
sudo -u facnet git fetch origin
sudo -u facnet git checkout feature/your-branch-name
sudo -u facnet git pull origin feature/your-branch-name

# 4. Rebuild application
sudo -u facnet npm install
sudo -u facnet npm run build

# 5. Delete any existing staging PM2 processes
sudo -u facnet pm2 delete facnet-validator-staging 2>/dev/null || true
sudo -u facnet pm2 delete ecosystem.staging 2>/dev/null || true

# 6. Start with direct command (bypass ecosystem config issues)
sudo -u facnet PORT=3002 \
  NODE_ENV=staging \
  DATABASE_URL='postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator_staging' \
  AUTH0_ISSUER_BASE_URL='https://dev-x63i3b6hf5kch7ab.ca.auth0.com' \
  AUTH0_AUDIENCE='facnet-validator-api' \
  AUTH0_CLIENT_SECRET='fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk' \
  pm2 start dist/server/index.js --name facnet-validator-staging

# 7. Save PM2 configuration
sudo -u facnet pm2 save

# 8. Verify process is running on port 3002
sudo ss -tlnp | grep ':3002'

# 9. Test health endpoint
curl http://localhost:3002/api/health
curl -k https://localhost:3001/api/health  # Through Nginx

# 10. Check PM2 logs if issues persist
sudo -u facnet pm2 logs facnet-validator-staging --lines 50
```

##### Key Points About Staging Environment:
- **Internal Port**: App must run on port **3002** (NOT 3001)
- **External Port**: Nginx listens on port **3001** and proxies to 3002
- **Database**: Uses `dashvalidator_staging` (separate from production)
- **User**: Always use `ubuntu` for SSH, `facnet` for file operations
- **PM2 Config**: ecosystem.staging.cjs can fail to load env vars, use direct command instead
- **Process Name**: Must be exactly `facnet-validator-staging`

##### Common Mistakes to Avoid:
1. ❌ **Wrong Port**: Setting PORT=3001 (conflicts with Nginx)
   - ✅ **Correct**: PORT=3002 (Nginx proxies 3001 → 3002)

2. ❌ **Using ecosystem config directly**: `pm2 start ecosystem.staging.cjs`
   - ✅ **Correct**: Use direct script start with environment variables

3. ❌ **Using root user**: `ssh root@148.113.196.245`
   - ✅ **Correct**: `ssh ubuntu@148.113.196.245`

4. ❌ **Not pulling latest code**: Checking out branch without pull
   - ✅ **Correct**: Always git pull after checkout

5. ❌ **Forgetting to rebuild**: Restarting PM2 without running `npm run build`
   - ✅ **Correct**: Always build before restarting

##### Verify Staging Deployment:
```bash
# Check PM2 status
sudo -u facnet pm2 status

# Should show:
# facnet-validator-staging | online | port 3002

# Check ports
sudo ss -tlnp | grep -E ':(3001|3002)'

# Should show:
# nginx on 3001 (external)
# node on 3002 (internal app)

# Test endpoints
curl -k https://148.113.196.245:3001/api/health
# Should return: {"status":"healthy","timestamp":"..."}
```

#### 3. Production Deployment (Automatic)
```bash
# If staging tests pass, merge to main
git checkout main
git merge feature/new-validation-rule
git push origin main

# 🚀 GitHub Actions automatically deploys to production!
# Application available at https://148.113.196.245
```

##### Post-Deployment Verification (Critical!)

After GitHub Actions deployment completes, **always verify** production is working:

```bash
# 1. Check production health endpoint
curl -k https://148.113.196.245/api/health
# Should return: {"status":"healthy","timestamp":"..."}

# 2. If you get 502 Bad Gateway, check PM2 status
ssh ubuntu@148.113.196.245
sudo -u facnet pm2 status

# 3. If processes are stopped, restart them
cd /var/www/facnet/app
sudo -u facnet pm2 restart ecosystem.config.cjs

# 4. If you see "Cannot find package 'vite'" error:
# Install all dependencies (including devDependencies needed at runtime)
sudo -u facnet npm install
sudo -u facnet pm2 restart ecosystem.config.cjs

# 5. Verify Auth0 variables are embedded in JavaScript bundle
curl -k https://148.113.196.245/ | grep -o 'src="/assets/index-[^"]*\.js"'
# Get the filename, then check:
grep -o "dev-x63i3b6hf5kch7ab.ca.auth0.com" /var/www/facnet/app/dist/public/assets/index-XXXXX.js
# Should output: dev-x63i3b6hf5kch7ab.ca.auth0.com

# 6. Test authentication flow in browser
# Visit https://148.113.196.245 and click "Sign In"
# Should redirect to Auth0 (NOT to "undefined")
```

##### Common Production Issues After Deployment

**Problem 1: 502 Bad Gateway after deployment**
- **Cause**: GitHub Actions stopped PM2 processes but they didn't restart
- **Solution**: `cd /var/www/facnet/app && sudo -u facnet pm2 restart ecosystem.config.cjs`

**Problem 2: "Cannot find package 'vite'" error**
- **Cause**: Production dependencies installed without devDependencies, but Vite is needed at runtime
- **Solution**: `sudo -u facnet npm install` (not `npm install --production`)
- **Why**: The bundled server code has some runtime dependencies on Vite

**Problem 3: Auth0 domain shows "undefined" in production**
- **Cause**: Frontend was built without `VITE_AUTH0_AUDIENCE` or `vite.config.ts` missing `envDir`
- **Solution**: Ensure `.env` in production has all `VITE_*` variables and rebuild
- **Verification**: `grep -o "dev-x63i3b6hf5kch7ab" dist/public/assets/index-*.js`

### Branch Protection Strategy

For your Quebec healthcare system, implement these **GitHub branch protection rules**:

```yaml
Branch Protection for 'main':
✅ Require pull request reviews before merging
✅ Require status checks to pass (GitHub Actions)
✅ Require branches to be up to date before merging
✅ Include administrators in restrictions
✅ Restrict pushes (no direct commits to main)
✅ Require review from code owners
```

### Benefits for Healthcare Data Validation

1. **Patient Data Safety**: Never break production Quebec healthcare processing
2. **Regulatory Compliance**: Code review trail for healthcare audit requirements
3. **Quality Assurance**: All RAMQ validation rules tested before deployment
4. **Zero Downtime**: PM2 clustering ensures continuous healthcare data processing
5. **Rollback Capability**: Easy revert if validation logic causes issues
6. **Team Collaboration**: Multiple developers can safely work on validation features

### Example: Adding New Validation Rule

```bash
# 1. Create feature branch for new RAMQ rule
git checkout -b feature/ramq-office-visit-validation

# 2. Implement validation logic
# Edit server/validation/rules/office-visits.ts
# Add new rule for Quebec billing code validation

# 3. Test locally with sample Quebec healthcare data
npm run dev
# Upload test CSV with Quebec billing codes

# 4. Deploy to staging for server testing
# SSH to server, checkout branch, test with production-like data

# 5. Create pull request on GitHub
# Code review ensures healthcare compliance

# 6. Merge to main → Automatic production deployment
# New validation rule active for Quebec healthcare system
```

## Key Components

### Frontend Components
- `AppLayout` - Main shell with sidebar navigation
- `DataTable` - Reusable data grid with CRUD operations
- `FileDropzone` - File upload with drag-and-drop
- `DynamicForm` - Form generator for custom fields

### Backend Components
- `storage.ts` - Database abstraction layer
- `auth.ts` - JWT validation and RBAC
- `routes.ts` - API endpoint handlers

## Billing Data CSV Structure

### Input CSV Format
The application processes Quebec healthcare billing CSV files with the following structure:

| Field | Name | Description | Validation Importance |
|-------|------|-------------|----------------------|
| 1 | # | Sequential record number | Not important |
| 2 | **Facture** | Internal invoice number | **Critical** - For grouping records |
| 3 | **ID RAMQ** | RAMQ invoice number | **Critical** - Official billing reference |
| 4 | **Date de Service** | Service date | **Critical** - For time-based rules |
| 5 | **Début** | Start time | **Important** - For scheduling conflicts |
| 6 | **Fin** | End time | **Important** - For scheduling conflicts |
| 7 | Periode | Period code | Not important |
| 8 | **Lieu de pratique** | Establishment number | **Critical** - Links to establishments table |
| 9 | **Secteur d'activité** | Establishment sector | **Important** - For sector-specific rules |
| 10 | **Diagnostic** | Diagnostic code | **Critical** - For medical logic rules |
| 11 | **Code** | Billing code | **MAIN TARGET** - Links to codes table |
| 12 | **Unités** | Units (time/length/etc.) | **Critical** - Some codes require units |
| 13 | **Rôle** | Role (primary=1/assistant) | **Important** - Affects billing permissions |
| 14 | **Élement de contexte** | Context elements | **Critical** - Links to contexts table |
| 15 | **Montant Preliminaire** | Expected amount | **Important** - For amount validation |
| 16 | **Montant payé** | Received amount | **Important** - For payment reconciliation |
| 17 | **Doctor Info** | Doctor information | **Important** - For doctor-specific rules |
| 18-20 | DEV NOTE fields | Development placeholders | Not important |
| 21 | Agence | Agency | Not important |
| 22 | **Patient** | Unique patient identifier | **Critical** - For patient-specific rules |
| 23 | Grand Total | Grand total | Not important |

### Key Validation Fields

#### **Primary Validation Targets**
- **Code** - The main billing code (links to codes table)
- **Élement de contexte** - Context modifiers (links to contexts table)
- **Lieu de pratique** - Establishment (links to establishments table)

#### **Critical Business Rules**
- **Same Patient Multiple Visits**: If a patient is seen multiple times on the same day, subsequent visits must have context element "85"
- **Units Requirements**: Some billing codes require specific unit values (time, length, etc.)
- **Role Restrictions**: Certain codes can only be billed by primary physicians, not assistants
- **Sector Limitations**: Hospital sectors (urgent care, external clinic, palliative care) have different billing rules than regular clinics

## File Upload & Processing

### Supported File Types
- CSV files for Quebec healthcare billing data
- CSV files for reference data import (codes, establishments, contexts)
- Size limit configured in server

### Processing Pipeline
1. File upload via Multer
2. CSV parsing and validation
3. Background processing for large files
4. Progress tracking and error reporting
5. Database import with transaction safety
6. **Billing validation engine** - Processes billing data against business rules

### Validation Rule Categories
1. **Missing Context Elements** - Required context codes for specific scenarios
2. **Units Validation** - Codes that require proper unit values
3. **Role Restrictions** - Billing permissions based on physician role
4. **Code Conflicts** - Incompatible billing codes on same invoice
5. **Frequency Rules** - Maximum occurrences of codes per patient/day
6. **Time-Based Rules** - Minimum intervals between services
7. **Amount Validation** - Expected vs actual billing amounts
8. **Sector Compliance** - Establishment sector-specific rules

## Production Server Setup

> **📄 Complete Server Documentation**: See [`SERVER_SETUP.md`](./SERVER_SETUP.md) for comprehensive production server configuration, including all credentials, security settings, and operational procedures.

### Production Environment
- **VPS**: Ubuntu 24.04.2 LTS on OVH Cloud (148.113.196.245)
- **Security**: UFW firewall, Fail2Ban, SSH key authentication
- **Web Server**: Nginx reverse proxy with SSL/TLS
- **Process Management**: PM2 with clustering and auto-restart
- **Database**: PostgreSQL 16 with production optimization
- **Service User**: `facnet` dedicated system user
- **Backups**: Automated daily database backups with 7-day retention

### Development vs Production

#### Development (Local)
- Port 5000 (required for Auth0)
- Vite dev server and Express API on same port
- HTTP only, self-signed certificates for testing
- Direct database access

#### Production (VPS)
- HTTPS with automatic HTTP redirect
- Nginx reverse proxy handling SSL termination
- PM2 process management with clustering
- Firewall protection and intrusion detection
- Automated backups and monitoring

### Deployment Process
1. **Code Upload**: Deploy to `/var/www/facnet/app/` on production server
2. **Dependencies**: `npm install` and `npm run build`
3. **Database**: Run migrations with `npm run db:push`
4. **Process Management**: Start with PM2 using `ecosystem.config.js`
5. **Monitoring**: Verify via PM2 status and Nginx logs

### Auth0 Configuration
- **Development**: Callback URLs for localhost:5000
- **Production**: Update Auth0 for VPS IP address (148.113.196.245)
- JWT verification with RS256
- Custom claims for user roles

### Database Setup
- PostgreSQL required with proper user permissions
- Drizzle handles schema migrations
- Production database optimized for SaaS workloads
- Automated backup and recovery procedures

## Troubleshooting

### Common Issues
1. **Port 5000 in use**: Kill process or change PORT env var
2. **Database permissions**: Ensure user has schema permissions
3. **Auth0 errors**: Check domain and client ID configuration
4. **File upload issues**: Check uploads directory permissions

### Development Tips
- Use pgAdmin for database management
- Check server logs for API errors
- Browser dev tools for frontend debugging
- Auth0 logs for authentication issues

### CSV Processing Debugging

#### CSV Format Support
The application supports both **comma-delimited** and **semicolon-delimited** CSV files with automatic delimiter detection.

#### Common CSV Issues & Solutions

**Problem**: CSV processing returns 0 records
- **Cause**: Incorrect delimiter detection or column header mismatch
- **Solution**: Check logs for `[DEBUG] Detected CSV delimiter` and `[DEBUG] Processing row` messages
- **Debug Commands**:
  ```bash
  # Check server logs for CSV processing
  # Look for delimiter detection and row parsing messages
  ```

**Problem**: Database UUID errors during validation
- **Cause**: Rule IDs stored as strings but database expects UUIDs
- **Solution**: Update schema `rule_id` field from `uuid` to `text`
- **Fix Command**:
  ```sql
  ALTER TABLE validation_results ALTER COLUMN rule_id TYPE text;
  ```

**Problem**: Validation rules not running
- **Cause**: Server not restarting after code changes
- **Solution**: Kill all processes on port 5000 and restart
- **Commands**:
  ```bash
  netstat -ano | findstr :5000
  powershell "Stop-Process -Id [PID] -Force"
  npm run dev
  ```

#### Validation Pipeline Status
✅ **CSV Delimiter Detection**: Automatic semicolon/comma detection
✅ **Data Parsing**: Proper column separation (23+ columns expected)
✅ **Quebec Amount Format**: Handles comma as decimal separator (e.g., "32,40" → 32.40)
✅ **Database Integration**: Fixed UUID schema issues
✅ **Validation Engine**: Office fee rules (19928/19929) operational
✅ **Error Reporting**: Results saved and displayed in interface
✅ **Database-Driven Rules**: Validation rules loaded from database instead of hardcoded
✅ **Security Compliance**: CSV files automatically deleted after processing
✅ **Data Cleanup**: Validation results cleared when user changes pages
✅ **Production Deployment**: Automated GitHub Actions CI/CD pipeline active
✅ **Production Testing**: Deployment successfully tested with commit `9221ca0`

## Database-Driven Validation System

### Architecture Overview
The validation system is now fully database-driven, allowing dynamic rule management without code changes.

### Key Components
- **Migration System**: `server/migrate-rules.ts` - Populates database with default rules on startup
- **Database Rule Loader**: `server/validation/databaseRuleLoader.ts` - Converts database rules to executable validation logic
- **Fallback Mechanism**: Falls back to hardcoded rules if database is empty
- **Rule Engine**: `server/validation/engine.ts` - Executes validation rules against billing data

### Database Rule Structure
```typescript
{
  name: string;           // Human-readable rule name
  condition: {            // Rule configuration
    type: string;         // Rule type (e.g., 'office_fee_validation')
    category: string;     // Rule category
    codes: string[];      // Target billing codes
    walkInContexts?: string[];  // Walk-in context codes
    thresholds?: object;  // Code-specific thresholds
  };
  threshold: number;      // Daily maximum amount
  enabled: boolean;       // Rule activation status
}
```

### Office Fee Validation Rule (19928/19929)
- **Purpose**: Validates daily office fee maximums for Quebec billing codes 19928 and 19929
- **Thresholds**:
  - Code 19928: 6 registered patients, 10 walk-in patients max/day
  - Code 19929: 12 registered patients, 20 walk-in patients max/day
- **Daily Maximum**: $64.80 per doctor per day
- **Walk-in Contexts**: #G160, #AR

### Security Features
- **CSV File Cleanup**: Uploaded files automatically deleted after processing
- **Data Persistence Control**: Validation results cleared when user navigates away
- **Database Permissions**: Proper PostgreSQL user permissions for data isolation

### Rule Management Commands
```bash
# Check if rules exist in database
curl http://localhost:5000/api/rules

# Migration runs automatically on server startup
npm run dev  # Will populate rules if database is empty
```

## Data Import Scripts

The project includes utility scripts for importing Quebec healthcare data:

- `import_codes.js` - RAMQ billing codes
- `import_contexts.cjs` - Service contexts
- `import_establishments.cjs` - Healthcare facilities

These scripts process CSV files and populate the database with official Quebec healthcare system data.

## Recent Fixes & Updates

### RAMQ Codes System (Completed)
✅ **Data Import**: Successfully imported 6,740 RAMQ billing codes from CSV
✅ **Schema Design**: Updated to use UUID primary keys allowing duplicate billing codes with different attributes (e.g., same code for "cabinet" vs "établissement")
✅ **Search Functionality**: Fixed billing code search to properly handle string-based searches
✅ **Frontend Display**: Enhanced table to show all important columns (Code, Description, Place, Tariff Value, Level Groups, etc.)
✅ **Data Type Handling**: Fixed tariff value display to handle string-to-number conversion

### Search System Fixes
- **Issue**: Search for billing codes like "15804" was failing with SQL parameter binding errors
- **Root Cause**: Debugging code with raw SQL queries was causing PostgreSQL parameter conflicts
- **Solution**: Simplified search to use clean Drizzle ORM `like()` operators
- **Result**: Search now works perfectly for all billing codes (confirmed with "15804" test)

### Frontend Error Resolution
- **Issue**: `value.toFixed is not a function` error in Codes table
- **Root Cause**: Database returns `tariffValue` as string but frontend expected number
- **Solution**: Added type-safe conversion with fallback handling
- **Implementation**:
  ```typescript
  render: (value: string | number) => {
    if (!value) return "-";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    return isNaN(numValue) ? "-" : `$${numValue.toFixed(2)}`;
  }
  ```

### Database Schema Updates
- **Codes Table**: Changed from string primary key to UUID to allow duplicate billing codes
- **Billing Codes**: Support for multiple records with same code but different settings (cabinet/établissement)
- **Data Integrity**: Maintained all original CSV data while enabling proper duplicate handling

### Current System Status
✅ **RAMQ Codes Database**: 6,740 codes successfully imported and searchable
✅ **Search Functionality**: Working for all billing code searches
✅ **Frontend Interface**: Clean table display with proper formatting
✅ **Data Types**: Proper handling of numeric fields from string database values
✅ **Duplicate Code Support**: Allows legitimate duplicate codes with different attributes

### Validation Data Examples
When searching for code "15804":
- **Result 1**: "Visite de suivi" - Cabinet ($49.15)
- **Result 2**: "Visite de suivi" - Établissement ($36.95)

This demonstrates the system correctly handles Quebec's billing structure where the same medical service has different rates depending on location.

## Latest UI/UX Updates (January 2025)

### Dashboard Redesign
✅ **Simplified Interface**: Removed complex dashboard components as per user requirements
- **Removed**: KPI cards, recent activity section, system status cards, export cards, analytics section
- **Added**: Clean, centered "Validateur Compact" module focused on primary action
- **Header Update**: Replaced generic description with personalized French greeting using first name only

### Sidebar Navigation Improvements
✅ **Streamlined Validator Flow**: Consolidated three separate validator links into single entry point
- **Before**: Separate "Télécharger", "Exécutions", "Analytiques" links
- **After**: Single "Validateur" link pointing to `/validator`
- **Removed**: Subtitle "Gestion de Données" from brand header
- **Flow**: Users land on upload → automatically move to runs during validation → reach analytics when complete

### Validation Flow Enhancements
✅ **Improved Navigation**: Enhanced end-of-validation user experience
- **Button Update**: Changed "Back to Runs" to "Nouvelle Validation"
- **Redirect**: Now points to `/validator` instead of `/validator/runs`
- **User Experience**: Encourages new validation workflow rather than returning to runs list

### Technical Fixes
✅ **Radix UI Select Component**: Fixed console error in Runs page
- **Issue**: Empty string value in SelectItem causing validation error
- **Solution**: Changed from `value=""` to `value="all"` with proper filtering logic
- **Result**: Eliminated console errors and improved component stability

### UI Component Status
✅ **Dashboard**: Minimalist design with focus on primary upload action
✅ **Sidebar**: Clean navigation with logical validator workflow
✅ **Validation Flow**: Seamless progression from upload to results to new validation
✅ **Error Resolution**: Console errors eliminated, stable component behavior
✅ **French Localization**: Maintained throughout all interface changes

These updates align with the simplified, focused user experience requested, emphasizing the core validation workflow while maintaining the professional French interface for Quebec healthcare system users.

## Production Deployment History

### September 29, 2025 - GitHub Actions CI/CD Implementation
✅ **Automated Deployment Pipeline**: Successfully implemented and tested GitHub Actions workflow for continuous deployment
- **Repository**: https://github.com/montignypatrik/facnet-validator
- **Workflow**: `.github/workflows/deploy.yml`
- **Test Deployment**: Commit `9221ca0` - French text improvement for dashboard
- **Verification**: Application responding correctly at https://148.113.196.245
- **Health Check**: API endpoint `/api/health` returning status 200
- **Process Management**: PM2 running with clustering enabled

✅ **Production Environment Status**:
- **Frontend**: React application served via Nginx
- **Backend**: Express API with Auth0 authentication
- **Database**: PostgreSQL 16 with proper schema deployment
- **SSL**: Self-signed certificate for HTTPS
- **Security**: Fail2ban, UFW firewall, SSH key authentication
- **Monitoring**: PM2 process management, health endpoints

✅ **Deployment Verification**:
- **Automated Build**: ✓ Application builds successfully in CI
- **Database Migration**: ✓ Schema changes applied automatically
- **Process Restart**: ✓ PM2 restarts with zero downtime
- **Health Verification**: ✓ Deployment health checks pass
- **Static Assets**: ✓ Frontend assets served correctly
- **API Connectivity**: ✓ Backend API responding to requests

**Note**: For detailed server configuration and operational procedures, see `SERVER_SETUP.md`.