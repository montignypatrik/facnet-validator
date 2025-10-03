# Dash - Modular Business Operations Platform

A SAAS platform with plug-and-play modules for healthcare billing validation, database management, AI assistance, and more. Everything your business needs, centralized in one dashboard.

**Production**: https://148.113.196.245
**Repository**: https://github.com/montignypatrik/facnet-validator

---

## Overview

Dash is a modular SAAS platform designed to sit at the center of your business operations. Each module is self-contained and purpose-built for specific business needs. Currently featuring:

- **Validateur**: Quebec healthcare billing validation (RAMQ) with intelligent error detection
- **Base de Données**: Comprehensive data management for codes, contexts, establishments, and business rules
- **Administration**: User management with role-based access control
- **Paramètres**: System configuration and theme customization

Coming soon: **Chatbot** (AI assistant), **Tâche** (task management), **Hors-RAMQ** (extended billing features)

### Key Features
- 🧩 **Modular Architecture**: Each business function is a self-contained, plug-and-play module
- 📊 **Data Management**: Manage 6,740+ RAMQ billing codes, service contexts, and healthcare establishments
- ✅ **Intelligent Validation**: Database-driven validation rules with real-time error detection
- 📁 **File Processing**: CSV upload with drag-and-drop, asynchronous processing, and error reporting
- 📈 **Analytics Dashboard**: Usage metrics, KPI tracking, and visualization
- 🔐 **Role-Based Access**: Auth0 integration with granular permissions (Viewer/Editor/Admin)
- 🇫🇷 **Fully Localized**: French interface tailored for Quebec business operations

---

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 16
- Quebec RAMQ reference data CSV files

### Installation

```bash
# Clone repository
git clone https://github.com/montignypatrik/facnet-validator.git
cd dash

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your database credentials and Auth0 settings

# Setup database
npm run db:push

# Import RAMQ reference data
node scripts/import_codes.js
node scripts/import_contexts.cjs
node scripts/import_establishments.cjs

# Start development server
npm run dev
```

Application runs on: http://localhost:5000

### Environment Variables

Required in `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/dashvalidator
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your_client_id
VITE_AUTH0_AUDIENCE=your_api_audience
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
```

See [.env.example](.env.example) for complete template.

---

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express, TypeScript, Drizzle ORM
- **Database**: PostgreSQL 16
- **Authentication**: Auth0 (OAuth 2.0/JWT)
- **Deployment**: GitHub Actions → Ubuntu VPS with PM2 + Nginx

---

## Project Structure

```
dash/
├── client/          # React frontend (Vite + TypeScript)
│   ├── pages/       # Core pages (Dashboard, Settings)
│   ├── modules/     # Modular features (validateur, database, admin)
│   └── components/  # Shared UI components
├── server/          # Express backend API
│   ├── modules/     # Module-specific routes and logic
│   └── core/        # Shared infrastructure (auth, db, storage)
├── shared/          # Shared TypeScript types and schemas
├── scripts/         # Data import utilities
├── data/            # RAMQ reference data (gitignored)
└── .github/         # CI/CD workflows
```

See [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) for detailed architecture documentation.

---

## Development

### Available Commands

```bash
npm run dev        # Start development server (port 5000)
npm run build      # Build for production
npm run start      # Start production server
npm run check      # TypeScript type checking
npm run db:push    # Apply database schema changes
```

### Git Workflow

- **Main Branch**: `main` (auto-deploys to production)
- **Feature Branches**: `feature/description`, `fix/issue-name`

```bash
# Create feature branch
git checkout -b feature/new-validation-rule

# Develop and test
npm run dev

# Commit changes
git add .
git commit -m "Add new RAMQ validation rule"

# Push to GitHub
git push origin feature/new-validation-rule

# Merge to main → automatic deployment
git checkout main
git merge feature/new-validation-rule
git push origin main
```

---

## Deployment

### Automated CI/CD
- **Method**: GitHub Actions on push to `main`
- **Target**: Ubuntu VPS at 148.113.196.245
- **Process Manager**: PM2 with clustering (6 instances)
- **Web Server**: Nginx with SSL/HTTPS

### Staging Environment
- **URL**: https://148.113.196.245:3001
- **Database**: `dashvalidator_staging`
- **Purpose**: Test feature branches before production

See [SERVER_SETUP.md](SERVER_SETUP.md) for production server details.

---

## Documentation

- **[CLAUDE.md](CLAUDE.md)**: Project instructions for Claude AI agent
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)**: Comprehensive architecture overview
- **[SERVER_SETUP.md](SERVER_SETUP.md)**: Production server configuration

---

## License

Proprietary - All rights reserved

---

## Contact

For questions or support, please open an issue on GitHub.

