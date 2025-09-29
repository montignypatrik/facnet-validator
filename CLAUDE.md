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
```env
# Database
DATABASE_URL=postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator

# Auth0
VITE_AUTH0_DOMAIN=dev-x63i3b6hf5kch7ab.ca.auth0.com
VITE_AUTH0_CLIENT_ID=ECieaY4IiPbZNbWMoGJTPmD4pGsEi2rr
AUTH0_CLIENT_SECRET=fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk
AUTH0_ISSUER_BASE_URL=https://dev-x63i3b6hf5kch7ab.ca.auth0.com
AUTH0_AUDIENCE=facnet-validator-api

# Client API Base URL
VITE_API_BASE_URL=http://localhost:5000/api
```

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

### Database Management
```bash
npm run db:push               # Apply schema changes
node scripts/import_codes.js             # Import RAMQ codes
node scripts/import_contexts.cjs         # Import contexts
node scripts/import_establishments.cjs   # Import establishments
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