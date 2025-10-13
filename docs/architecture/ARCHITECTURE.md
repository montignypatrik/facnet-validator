# Dash Healthcare SAAS - Architecture Diagrams

## 1. Current System Architecture (As-Is)

### 1.1 High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  React 18 SPA (Vite)                                          │  │
│  │  ├─ Auth0 React SDK (OAuth 2.0)                               │  │
│  │  ├─ TanStack Query (Server State)                             │  │
│  │  ├─ Wouter (Routing)                                          │  │
│  │  └─ Radix UI + Tailwind CSS                                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │ HTTPS
                              │ Auth0 JWT Tokens
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NGINX REVERSE PROXY                              │
│  ├─ SSL/TLS Termination (Self-Signed Cert)                         │
│  ├─ Static Asset Serving (/dist/public/*)                          │
│  ├─ API Proxy (/api/* → localhost:5000)                            │
│  └─ Load Balancing (Future: PM2 Cluster)                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXPRESS.JS API SERVER                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  PM2 Process Manager (6 Clustered Instances)                  │  │
│  │  ├─ Port 5000 (Dev) / 3000 (Prod)                             │  │
│  │  ├─ Graceful Shutdown & Auto-Restart                          │  │
│  │  └─ Health Monitoring (/api/health)                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Middleware Stack                                             │  │
│  │  ├─ Auth0 JWT Validation (auth.ts)                            │  │
│  │  ├─ RBAC Authorization (roles: viewer/editor/admin)           │  │
│  │  ├─ Multer File Upload (multipart/form-data)                  │  │
│  │  ├─ Body Parser (JSON, URL-encoded)                           │  │
│  │  └─ CORS Configuration                                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Module Registry (moduleRegistry.ts)                          │  │
│  │  ├─ Validateur Module                                         │  │
│  │  ├─ Base de Données Module                                    │  │
│  │  ├─ Administration Module                                     │  │
│  │  └─ Paramètres Module                                         │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL DATABASE                              │
│  ├─ Database: dashvalidator                                         │
│  ├─ User: dashvalidator_user                                        │
│  ├─ Schema: public                                                  │
│  │  ├─ users, codes, contexts, establishments                       │
│  │  ├─ rules, validation_runs, validation_results                   │
│  │  ├─ files, field_catalog                                         │
│  │  └─ billing_records (CSV import data)                            │
│  └─ Drizzle ORM (Type-Safe Queries)                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                                │
│  ├─ Auth0 (dev-x63i3b6hf5kch7ab.ca.auth0.com)                      │
│  │  ├─ User Authentication (OAuth 2.0)                             │
│  │  ├─ JWT Token Issuance                                          │
│  │  └─ User Profile Management                                     │
│  └─ File Storage (Local: /uploads/)                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 Modular Monolith Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DASH MODULAR MONOLITH                            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  CORE LAYER (Shared Infrastructure)                        │   │
│  │  ├─ server/core/storage.ts (DB Abstraction)                │   │
│  │  ├─ server/auth.ts (JWT Validation & RBAC)                 │   │
│  │  ├─ shared/schema.ts (Zod Validation)                      │   │
│  │  └─ server/moduleRegistry.ts (Module Loading)              │   │
│  └────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  MODULE LAYER (Business Capabilities)                       │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │ Validateur Module (Flagship)                        │   │  │
│  │  │ ├─ routes.ts (API Endpoints)                        │   │  │
│  │  │ ├─ validation/                                      │   │  │
│  │  │ │   ├─ engine.ts (Orchestration)                    │   │  │
│  │  │ │   ├─ csvProcessor.ts (File Parsing)               │   │  │
│  │  │ │   ├─ ruleRegistry.ts (Rule Registration)          │   │  │
│  │  │ │   └─ rules/ (TypeScript validation rules)         │   │  │
│  │  │ └─ schema.ts (Data Models)                          │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │ Base de Données Module                              │   │  │
│  │  │ ├─ Codes Management                                 │   │  │
│  │  │ ├─ Contexts Management                              │   │  │
│  │  │ ├─ Establishments Management                        │   │  │
│  │  │ └─ Rules Management                                 │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │ Administration Module                               │   │  │
│  │  │ ├─ User Management (RBAC)                           │   │  │
│  │  │ └─ Role Assignment                                  │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │ Paramètres Module                                   │   │  │
│  │  │ ├─ Theme Settings (Light/Dark/System)               │   │  │
│  │  │ └─ System Configuration                             │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │ Planned Modules                                     │   │  │
│  │  │ ├─ Chatbot (AI Assistant)                           │   │  │
│  │  │ ├─ Tâche (Task Management)                          │   │  │
│  │  │ └─ Hors-RAMQ (Extended Billing)                     │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Validation Engine Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER UPLOADS CSV FILE (Quebec Healthcare Billing Data)            │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  POST /api/validations                                              │
│  ├─ Multer saves file to /uploads/                                  │
│  ├─ Create validation_run record (status: pending)                  │
│  └─ Return 201 Created with run ID                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SYNCHRONOUS CSV PROCESSING (BOTTLENECK!)                           │
│  ├─ csvProcessor.ts reads file line-by-line                         │
│  ├─ Auto-detect delimiter (comma vs semicolon)                      │
│  ├─ Parse Quebec amount format (32,40 → 32.40)                      │
│  ├─ Map CSV columns to billing record schema                        │
│  └─ Store in billing_records table (23+ columns)                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  VALIDATION ENGINE                                                  │
│  ├─ ruleRegistry.ts loads hardcoded TypeScript rules                │
│  ├─ engine.ts orchestrates validation                               │
│  └─ rules/*.ts execute business logic                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RULE EXECUTION (Per Billing Record)                               │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Office Fee Validation (19928/19929)                        │  │
│  │  ├─ Check daily maximum ($64.80 per doctor)                 │  │
│  │  ├─ Count registered vs walk-in patients                    │  │
│  │  ├─ Validate context elements (#G160, #AR)                  │  │
│  │  └─ Create validation_result if violation found             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Other Active Rules (TypeScript Hardcoded)                  │  │
│  │  ├─ Annual Billing Code (Leaf pattern validation)           │  │
│  │  ├─ GMF Forfait 8875 (Duplicate + opportunity detection)    │  │
│  │  ├─ Intervention Clinique (180 min/day limit)               │  │
│  │  └─ Visit Duration Optimization (Revenue optimization)      │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RESULT STORAGE                                                     │
│  ├─ Update validation_run (status: completed/failed)                │
│  ├─ Store validation_results (errors found)                         │
│  └─ Delete CSV file (security compliance)                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND DISPLAY                                                   │
│  ├─ GET /api/validations/:id (Fetch results)                        │
│  ├─ Display errors in DataTable component                           │
│  └─ Clear results when user navigates away                          │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.4 Database Schema (Entity Relationship)

```
┌──────────────────┐         ┌──────────────────┐
│  users           │         │  files           │
├──────────────────┤         ├──────────────────┤
│ id (PK)          │         │ id (PK)          │
│ email            │         │ name             │
│ name             │         │ size             │
│ role             │◄────────│ user_id (FK)     │
│ created_at       │         │ created_at       │
│ updated_at       │         └──────────────────┘
└──────────────────┘                   │
                                       │
                                       ▼
                            ┌──────────────────┐
                            │ validation_runs  │
                            ├──────────────────┤
                            │ id (PK)          │
                            │ file_id (FK)     │
                            │ status           │
                            │ error_count      │
                            │ created_at       │
                            │ completed_at     │
                            └──────────────────┘
                                       │
                                       │
                                       ▼
                            ┌──────────────────┐
                            │validation_results│
                            ├──────────────────┤
                            │ id (PK)          │
                            │ run_id (FK)      │
                            │ rule_id (text)   │
                            │ record_id        │
                            │ severity         │
                            │ message          │
                            │ created_at       │
                            └──────────────────┘

┌──────────────────┐         ┌──────────────────┐
│  codes           │         │  contexts        │
├──────────────────┤         ├──────────────────┤
│ id (PK UUID)     │         │ id (PK)          │
│ code (string)    │         │ name (string)    │
│ description      │         │ description      │
│ place            │         │ active           │
│ tariffValue      │         │ created_at       │
│ levelGroups      │         └──────────────────┘
│ active           │
│ created_at       │         ┌──────────────────┐
└──────────────────┘         │ establishments   │
                             ├──────────────────┤
┌──────────────────┐         │ id (PK)          │
│  rules           │         │ name (string)    │
├──────────────────┤         │ number (string)  │
│ id (PK)          │         │ sector           │
│ name             │         │ region           │
│ condition (JSON) │         │ active           │
│ threshold        │         │ created_at       │
│ enabled          │         └──────────────────┘
│ created_at       │
└──────────────────┘         ┌──────────────────┐
                             │ billing_records  │
                             ├──────────────────┤
                             │ id (PK)          │
                             │ facture          │
                             │ idRamq           │
                             │ dateService      │
                             │ code             │
                             │ diagnostic       │
                             │ context          │
                             │ patient          │
                             │ ... (23+ cols)   │
                             └──────────────────┘
```

## 2. Deployment Architecture (Production VPS)

### 2.1 Production Server Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                    OVH CLOUD VPS                                    │
│  IP: 148.113.196.245                                                │
│  OS: Ubuntu 24.04.2 LTS                                             │
│  CPU: 4 vCores | RAM: 8GB | Disk: 160GB SSD                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SECURITY LAYER                                                     │
│  ├─ UFW Firewall (80/443/22/5432 allowed)                          │
│  ├─ Fail2Ban (Intrusion Detection)                                 │
│  └─ SSH Key Authentication (Password login disabled)                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  NGINX REVERSE PROXY                                                │
│  ├─ Port 80 → Redirect to 443                                      │
│  ├─ Port 443 (HTTPS) → proxy_pass to localhost:3000                │
│  ├─ SSL Certificate (Self-Signed)                                   │
│  ├─ Static Asset Caching                                            │
│  └─ Gzip Compression                                                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PM2 PROCESS MANAGER                                                │
│  ├─ App Name: facnet-validator                                     │
│  ├─ Instances: 6 (Cluster Mode)                                    │
│  ├─ Port: 3000 (Internal)                                          │
│  ├─ Auto-Restart: Enabled                                          │
│  ├─ Max Memory: 500MB per instance                                 │
│  └─ User: facnet (dedicated service user)                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  APPLICATION DEPLOYMENT                                             │
│  Path: /var/www/facnet/app/                                        │
│  ├─ dist/ (Built application)                                      │
│  ├─ node_modules/ (Production dependencies)                        │
│  ├─ .env (Environment variables)                                   │
│  └─ ecosystem.config.cjs (PM2 configuration)                       │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  POSTGRESQL 16                                                      │
│  ├─ Database: dashvalidator                                         │
│  ├─ User: dashvalidator_user                                        │
│  ├─ Password: DashValidator2024                                     │
│  ├─ Port: 5432 (localhost only)                                    │
│  └─ Daily Backups: /var/backups/postgres/ (7-day retention)        │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 CI/CD Pipeline (GitHub Actions)

```
┌─────────────────────────────────────────────────────────────────────┐
│  DEVELOPER WORKFLOW                                                 │
│  ├─ git push origin main                                            │
│  └─ Triggers GitHub Actions                                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  GITHUB ACTIONS RUNNER                                              │
│  Workflow: .github/workflows/deploy.yml                             │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Step 1: Build & Test                                        │  │
│  │  ├─ npm install                                             │  │
│  │  ├─ npm run build                                           │  │
│  │  └─ npm run check (TypeScript validation)                  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Step 2: Deploy to VPS                                       │  │
│  │  ├─ SSH to ubuntu@148.113.196.245                           │  │
│  │  ├─ Pull latest code                                        │  │
│  │  ├─ npm install --production                                │  │
│  │  ├─ npm run build                                           │  │
│  │  ├─ npm run db:push (Database migrations)                   │  │
│  │  └─ pm2 restart ecosystem.config.cjs                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Step 3: Health Check                                        │  │
│  │  ├─ curl https://148.113.196.245/api/health                 │  │
│  │  └─ Verify 200 OK response                                  │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PRODUCTION LIVE                                                    │
│  ├─ Zero-downtime deployment (PM2 reload)                          │
│  ├─ Automatic rollback on health check failure                     │
│  └─ Notification on deployment status                              │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Staging Environment

```
┌─────────────────────────────────────────────────────────────────────┐
│  STAGING ENVIRONMENT (Same VPS)                                     │
│  Port: 3001 (External) / 3002 (Internal)                            │
│  Path: /var/www/facnet/staging/                                     │
│  Database: dashvalidator_staging                                    │
│  Purpose: Feature branch testing before production                  │
│                                                                      │
│  Manual Deployment Workflow:                                        │
│  1. SSH to ubuntu@148.113.196.245                                   │
│  2. cd /var/www/facnet/staging                                      │
│  3. sudo -u facnet git checkout feature/branch-name                 │
│  4. sudo -u facnet npm install && npm run build                     │
│  5. sudo -u facnet pm2 restart facnet-validator-staging             │
│  6. Test at https://148.113.196.245:3001                            │
└─────────────────────────────────────────────────────────────────────┘
```

## 3. Authentication & Authorization Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER BROWSER                                                       │
│  ├─ Click "Sign In" button                                          │
│  └─ Redirect to Auth0 login page                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AUTH0 IDENTITY PROVIDER                                            │
│  Domain: dev-x63i3b6hf5kch7ab.ca.auth0.com                         │
│  ├─ User enters credentials                                         │
│  ├─ MFA verification (if enabled)                                   │
│  └─ Consent screen (first login)                                    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AUTHORIZATION RESPONSE                                             │
│  ├─ OAuth 2.0 Authorization Code Flow                              │
│  ├─ Redirect to callback URL with code                             │
│  └─ Exchange code for tokens                                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENT RECEIVES TOKENS                                             │
│  ├─ Access Token (JWT)                                              │
│  ├─ ID Token (User Profile)                                         │
│  ├─ Refresh Token (Long-lived)                                      │
│  └─ Store in memory (not localStorage for security)                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  API REQUEST WITH JWT                                               │
│  ├─ Authorization: Bearer <access_token>                            │
│  └─ API call to backend                                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKEND JWT VALIDATION (server/auth.ts)                           │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 1. Extract JWT from Authorization header                    │  │
│  │ 2. Verify signature with Auth0 public key                   │  │
│  │ 3. Check expiration timestamp                               │  │
│  │ 4. Verify audience claim matches API                        │  │
│  │ 5. Verify issuer is Auth0 domain                            │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RBAC AUTHORIZATION                                                 │
│  ├─ Extract user role from custom claims                           │
│  ├─ Check route permission requirements                             │
│  │   ├─ Viewer: Read-only (GET endpoints)                          │
│  │   ├─ Editor: Read + Write (GET, POST, PATCH)                    │
│  │   └─ Admin: Full access (GET, POST, PATCH, DELETE)              │
│  └─ Deny access if insufficient permissions                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  API RESPONSE                                                       │
│  ├─ 200 OK (Success)                                                │
│  ├─ 401 Unauthorized (Invalid/Expired Token)                        │
│  └─ 403 Forbidden (Insufficient Permissions)                        │
└─────────────────────────────────────────────────────────────────────┘
```

## 4. Frontend Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  APP ROOT (client/src/main.tsx)                                     │
│  ├─ Auth0Provider (Authentication Context)                          │
│  ├─ QueryClientProvider (TanStack Query)                            │
│  └─ ThemeProvider (Light/Dark/System)                               │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  APP LAYOUT (client/src/components/AppLayout.tsx)                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Sidebar Navigation                                         │  │
│  │  ├─ Dashboard (Tableau de Bord)                             │  │
│  │  ├─ Validateur (CSV Processing)                             │  │
│  │  ├─ Base de Données (Reference Data)                        │  │
│  │  ├─ Administration (User Management)                        │  │
│  │  └─ Paramètres (Settings)                                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Main Content Area                                          │  │
│  │  └─ Router (Wouter)                                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PAGE COMPONENTS (client/src/pages/)                                │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Dashboard.tsx                                              │  │
│  │  ├─ Personalized French greeting                            │  │
│  │  └─ Validateur Compact module (primary action)              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Validator.tsx (Upload Interface)                           │  │
│  │  ├─ FileDropzone component                                  │  │
│  │  ├─ File validation (CSV only)                              │  │
│  │  └─ POST /api/validations                                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  RunDetails.tsx (Validation Results)                        │  │
│  │  ├─ GET /api/validations/:id                                │  │
│  │  ├─ DataTable with error results                            │  │
│  │  └─ "Nouvelle Validation" button → /validator               │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Codes.tsx, Contexts.tsx, Establishments.tsx                │  │
│  │  ├─ DataTable component (CRUD operations)                   │  │
│  │  ├─ Search and pagination                                   │  │
│  │  └─ CSV import/export                                       │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  Settings.tsx                                               │  │
│  │  ├─ Theme selector (Light/Dark/System)                      │  │
│  │  ├─ Live preview with theme persistence                     │  │
│  │  └─ Profile management                                      │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 5. Data Isolation & Multi-Tenancy Strategy

### Current: Single Database with User Isolation

```
┌─────────────────────────────────────────────────────────────────────┐
│  SINGLE DATABASE: dashvalidator                                     │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  PUBLIC SCHEMA                                              │  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ Global Reference Data (Shared)                       │  │  │
│  │  │ ├─ codes (RAMQ billing codes)                        │  │  │
│  │  │ ├─ contexts (Service contexts)                       │  │  │
│  │  │ ├─ establishments (Healthcare facilities)            │  │  │
│  │  │ └─ rules (Validation rules)                          │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ User-Specific Data (user_id FK)                      │  │  │
│  │  │ ├─ files (uploaded CSVs)                             │  │  │
│  │  │ ├─ validation_runs (per user)                        │  │  │
│  │  │ ├─ validation_results (per run)                      │  │  │
│  │  │ └─ billing_records (per file)                        │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ Access Control                                       │  │  │
│  │  │ ├─ Application-level filtering (WHERE user_id = ?)   │  │  │
│  │  │ ├─ No row-level security (RLS) implemented           │  │  │
│  │  │ └─ Trust application logic for isolation             │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Future: Multi-Tenant with Row-Level Security

```
┌─────────────────────────────────────────────────────────────────────┐
│  ENHANCED MULTI-TENANT DATABASE                                     │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  TENANT ISOLATION STRATEGY                                  │  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ Option 1: Schema-Per-Tenant                          │  │  │
│  │  │ ├─ public (shared reference data)                    │  │  │
│  │  │ ├─ tenant_org1 (complete schema copy)                │  │  │
│  │  │ ├─ tenant_org2 (complete schema copy)                │  │  │
│  │  │ └─ Strong isolation, higher maintenance              │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ Option 2: Row-Level Security (RLS)                   │  │  │
│  │  │ ├─ Add tenant_id column to all tables                │  │  │
│  │  │ ├─ CREATE POLICY per table                           │  │  │
│  │  │ ├─ SET app.current_tenant_id = ?                     │  │  │
│  │  │ └─ Database enforces isolation automatically         │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                              │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ Recommended: Hybrid Approach                         │  │  │
│  │  │ ├─ Shared: codes, contexts, establishments           │  │  │
│  │  │ ├─ Tenant-Specific: files, validation_runs, etc.     │  │  │
│  │  │ ├─ RLS policies on tenant-specific tables            │  │  │
│  │  │ └─ Cost-effective with strong security               │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Summary

These architectural diagrams represent the current state of Dash Healthcare SAAS platform:

1. **Modular Monolith**: Clean module boundaries with shared core infrastructure
2. **Synchronous Processing**: Current bottleneck in CSV validation (requires async queue)
3. **Production-Ready**: PM2 clustering, CI/CD pipeline, staging environment
4. **Security**: Auth0 OAuth 2.0, RBAC, but no RLS for multi-tenancy yet
5. **Scalability**: Horizontal scaling ready, needs caching and microservices extraction

**Next Steps**: See Task 3 (Architecture Analysis) and Task 4 (Evolution Roadmap) for detailed recommendations.
