# Dash - Quebec Healthcare Billing Validation Platform

[![Production](https://img.shields.io/badge/production-online-brightgreen)](https://148.113.196.245)
[![License](https://img.shields.io/badge/license-Proprietary-blue)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://www.postgresql.org/)

A modular SAAS platform designed for Quebec healthcare billing validation and business operations management. Features intelligent RAMQ validation, comprehensive reference data management, and secure PHI handling.

**🌐 Production**: https://148.113.196.245
**📚 Repository**: https://github.com/montignypatrik/facnet-validator

---

## ✨ Features

### Core Capabilities

- **🏥 Quebec RAMQ Validation**: Intelligent validation engine with 10+ rule types for Quebec healthcare billing
- **📊 Reference Data Management**: 6,740+ RAMQ billing codes, service contexts, and healthcare establishments
- **🔐 PHI Protection**: HIPAA-ready security with ownership verification, audit logging, and automatic PHI redaction
- **🚀 High Performance**: Redis caching layer (95%+ hit ratio), strategic database indexes (40-200x speedup)
- **👥 User Management**: Auth0 integration with role-based access control (viewer, editor, admin)
- **📁 CSV Processing**: Upload Quebec billing files with drag-and-drop, asynchronous validation, and error reporting
- **📈 Analytics**: Real-time KPI tracking, usage metrics, and data visualization
- **🇫🇷 French Interface**: Fully localized for Quebec healthcare professionals
- **🧩 Modular Architecture**: Plug-and-play modules with feature flags

### Security Features

- ✅ Auth0 OAuth 2.0/JWT authentication
- ✅ Role-based access control (RBAC)
- ✅ PHI ownership verification middleware
- ✅ Automatic PHI sanitization in logs
- ✅ SSL/TLS encryption in transit
- ✅ Database encryption at rest
- ✅ Audit logging for compliance
- ✅ Automatic file cleanup after processing

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 16+
- **Redis** 7+
- **Auth0 Account** (free tier available)

### Installation (5 Minutes)

```bash
# 1. Clone repository
git clone https://github.com/montignypatrik/facnet-validator.git
cd facnet-validator

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your credentials (see Environment Variables section)

# 4. Initialize database
npm run db:push

# 5. Import reference data (optional)
node scripts/import_codes.js
node scripts/import_contexts.cjs
node scripts/import_establishments.cjs

# 6. Start development server
npm run dev
```

**Access the application**: http://localhost:5000

### Environment Variables

Create a `.env` file in the project root:

```env
# Database (with SSL/TLS encryption)
DATABASE_URL=postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator?sslmode=prefer

# Redis
REDIS_URL=redis://localhost:6379

# Auth0 - Frontend (VITE_* prefix required for client-side access)
VITE_AUTH0_DOMAIN=dev-x63i3b6hf5kch7ab.ca.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=facnet-validator-api

# Auth0 - Backend
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_ISSUER_BASE_URL=https://dev-x63i3b6hf5kch7ab.ca.auth0.com
AUTH0_AUDIENCE=facnet-validator-api

# Client API Base URL
VITE_API_BASE_URL=http://localhost:5000/api

# PHI Redaction (optional)
PHI_REDACTION_SALT=your-random-salt-here

# Observability (optional)
SENTRY_ENABLED=false
OTEL_ENABLED=false
```

See [Getting Started Guide](docs/getting-started/README.md) for detailed setup instructions.

---

## 📖 Documentation

### Getting Started

- **[Getting Started Guide](docs/getting-started/README.md)** - Complete setup instructions
- **[User Guide (French)](docs/guides/GUIDE_UTILISATEUR.md)** - French user documentation
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute

### Technical Documentation

- **[CLAUDE.md](CLAUDE.md)** - Project overview and quick reference
- **[Architecture Overview](docs/architecture/README.md)** - System architecture and design decisions
- **[API Reference](docs/guides/API.md)** - Complete REST API documentation
- **[Database Schema](docs/guides/DATABASE.md)** - Database design and schema
- **[Testing Guide](docs/guides/TESTING.md)** - Testing strategy and best practices
- **[Module System](docs/modules/README.md)** - Modular architecture details

### Security & Operations

- **[Security Overview](docs/security/README.md)** - Security architecture and HIPAA compliance
- **[PHI Access Control](docs/security/PHI_ACCESS_CONTROL.md)** - User isolation and ownership verification
- **[PHI Redaction](docs/security/PHI_REDACTION.md)** - Automatic sanitization in logs
- **[Server Setup](docs/operations/SERVER_SETUP.md)** - Production server configuration
- **[Deployment Guide](docs/operations/DEPLOYMENT.md)** - CI/CD pipeline and deployment procedures

### Module Documentation

- **[Validateur Module](docs/modules/validateur/)** - RAMQ validation engine
- **[Chatbot Module](docs/modules/chatbot/)** - AI assistant (disabled)
- **[Tasks Module](docs/modules/tasks/)** - Kanban board (disabled)

---

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework with TypeScript
- **Vite** - Build tool and dev server
- **TanStack Query** - API state management
- **Radix UI** - Accessible UI primitives
- **Tailwind CSS** - Utility-first styling
- **Auth0 React SDK** - Authentication

### Backend
- **Node.js + Express** - Web server
- **TypeScript** - Type safety
- **Drizzle ORM** - Database queries
- **PostgreSQL 16** - Primary database
- **Redis 7** - Caching layer
- **BullMQ** - Background job processing
- **Auth0** - Authentication and authorization

### Infrastructure
- **PM2** - Process management with clustering
- **Nginx** - Reverse proxy and SSL termination
- **GitHub Actions** - CI/CD pipeline
- **Ubuntu 24.04 LTS** - Production server
- **OVH Cloud** - VPS hosting

---

## 📁 Project Structure

```
facnet-validator/
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/          # Page components
│   │   ├── components/     # Reusable UI components
│   │   └── api/            # API client configuration
├── server/                 # Express backend
│   ├── core/               # Authentication and utilities
│   ├── modules/            # Business modules
│   │   ├── validateur/     # RAMQ validation (flagship)
│   │   ├── database/       # Reference data management
│   │   ├── administration/ # User management
│   │   ├── chatbot/        # AI assistant (disabled)
│   │   ├── tasks/          # Kanban board (disabled)
│   │   └── formation-ressourcement/ # Training (disabled)
│   ├── observability/      # Sentry + OpenTelemetry
│   ├── cache/              # Redis caching service
│   └── queue/              # BullMQ job processing
├── docs/                   # Documentation
│   ├── getting-started/    # Setup guides
│   ├── guides/             # User and technical guides
│   ├── modules/            # Module-specific docs
│   ├── architecture/       # System architecture
│   ├── security/           # Security documentation
│   ├── operations/         # Deployment and operations
│   └── planning/           # Future plans and analysis
├── tests/                  # Test files
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests
└── scripts/                # Data import utilities
```

---

## 🧩 Active Modules (5/10)

1. **validateur** - Quebec RAMQ billing validation (flagship module)
2. **database** - Manage codes, contexts, establishments, rules
3. **administration** - User management with RBAC
4. **core-auth** - Auth0 authentication
5. **observability** - Sentry error tracking + OpenTelemetry tracing

## 🔌 Disabled Modules (5/10)

- **chatbot** - AI-powered medical billing assistant (Ollama)
- **chatbot-chat** - Conversation management
- **chatbot-admin** - Knowledge base administration
- **formation-ressourcement** - Training resources
- **tasks** - Kanban task management

See [Module System Documentation](docs/modules/README.md) to enable/disable modules.

---

## 💻 Development

### Common Commands

```bash
# Development
npm run dev              # Start development server (port 5000)
npm run check            # TypeScript type checking
npm test                 # Run tests
npm run test:coverage    # Run tests with coverage

# Production
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:push          # Apply schema changes
npm run db:studio        # Open Drizzle Studio (database GUI)
```

### Git Workflow

We use **GitHub Flow** with automatic production deployment:

```bash
# 1. Create feature branch
git checkout -b feature/new-validation-rule

# 2. Develop and test locally
npm run dev

# 3. Commit changes
git add .
git commit -m "feat: Add new RAMQ validation rule"
git push origin feature/new-validation-rule

# 4. Create pull request on GitHub
# 5. Test on staging (https://148.113.196.245:3001)
# 6. Merge to main → automatic production deployment
```

See [Contributing Guide](CONTRIBUTING.md) for detailed workflow.

---

## 🚢 Deployment

### Production Environment

- **URL**: https://148.113.196.245
- **Server**: Ubuntu 24.04 LTS on OVH Cloud VPS
- **Process Manager**: PM2 with clustering (6 instances)
- **Web Server**: Nginx with SSL/HTTPS
- **Database**: PostgreSQL 16 (`dashvalidator`)
- **Cache**: Redis 7 (localhost:6379)

### Staging Environment

- **URL**: https://148.113.196.245:3001
- **Database**: `dashvalidator_staging`
- **Purpose**: Test feature branches before production merge

### Automated CI/CD

GitHub Actions automatically deploys to production on push to `main`:

1. Build application
2. Run tests
3. SSH to production server
4. Deploy new version
5. Restart PM2 with zero downtime

See [Deployment Guide](docs/operations/DEPLOYMENT.md) for details.

---

## 🧪 Testing

### Test Coverage Requirements

- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test path/to/test.test.ts

# Run tests in watch mode
npm test -- --watch
```

See [Testing Guide](docs/guides/TESTING.md) for best practices.

---

## 🔒 Security

### HIPAA-Ready Features

- ✅ Encryption in transit (SSL/TLS)
- ✅ Encryption at rest (file system encryption)
- ✅ Access controls (RBAC)
- ✅ Audit logging
- ✅ PHI redaction in logs
- ✅ User isolation (ownership verification)
- ✅ Automatic file deletion
- ✅ Secure authentication (Auth0)

### Quebec Healthcare Compliance

- ✅ French interface and documentation
- ✅ RAMQ validation rules based on official regulations
- ✅ Data residency (Canada)
- ⚠️ For strict compliance, ensure data remains in Quebec/Canada

See [Security Overview](docs/security/README.md) for complete security documentation.

---

## 📊 Performance

### Database Optimizations

- **9 Strategic Indexes**: 10-100x query speedup
- **Connection Pooling**: Max 20 connections
- **Query Optimization**: Drizzle ORM with prepared statements

### Redis Caching

- **Cache Hit Ratio**: 95%+ (1-5ms response time)
- **Database Load Reduction**: 95%+ for reference data
- **API Response Time**: Improved from ~150ms to ~10ms average
- **Cached Data**: 6,740 RAMQ codes, 200 contexts, 1,000 establishments

See [Architecture Documentation](docs/architecture/README.md) for performance details.

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for:

- Development setup
- Code style guidelines
- Testing requirements
- Pull request process
- PHI protection guidelines

---

## 📝 License

Proprietary - All rights reserved

---

## 🆘 Support

- **GitHub Issues**: https://github.com/montignypatrik/facnet-validator/issues
- **Documentation**: Browse the `docs/` directory
- **Getting Started**: See [Getting Started Guide](docs/getting-started/README.md)

---

## 🗺️ Roadmap

### Completed ✅

- Quebec RAMQ billing validation engine
- PHI protection and access control
- Redis caching layer
- Database performance optimization
- Automated CI/CD pipeline
- Comprehensive documentation

### In Progress 🚧

- AWS migration planning
- Swagger/OpenAPI documentation

### Planned 📋

- Chatbot module (AI-powered medical billing assistant)
- Task management module (Kanban boards)
- Training resources module (Formation & Ressourcement)
- Extended billing features (Hors-RAMQ)

---

**Built with ❤️ for Quebec healthcare professionals**
