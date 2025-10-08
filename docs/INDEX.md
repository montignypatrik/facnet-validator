# Dash Documentation Index

Complete documentation for the Quebec healthcare billing validation platform.

**Quick Links**: [Getting Started](getting-started/README.md) | [CLAUDE.md](../CLAUDE.md) | [Contributing](../CONTRIBUTING.md) | [README](../README.md)

---

## 🚀 Getting Started

New to Dash? Start here:

- **[Getting Started Guide](getting-started/README.md)** - Complete setup in 10 minutes
- **[CLAUDE.md](../CLAUDE.md)** - Project overview and quick reference
- **[README.md](../README.md)** - Repository homepage with badges and features
- **[Contributing Guide](../CONTRIBUTING.md)** - How to contribute to the project

---

## 📚 User Documentation

### French User Guide

- **[Guide Utilisateur (Français)](guides/GUIDE_UTILISATEUR.md)** - Complete French documentation for Quebec healthcare professionals
  - File upload procedures
  - Validation result interpretation
  - Common error corrections
  - FAQ section

---

## 🛠️ Technical Documentation

### Core Guides

- **[API Reference](guides/API.md)** - Complete REST API documentation
  - Health endpoints
  - Validation endpoints
  - Database management endpoints
  - Administration endpoints
  - Analytics endpoints
  - Error handling
  - Rate limiting

- **[Database Schema](guides/DATABASE.md)** - Database design and schema
  - 15+ tables documented
  - 9 performance indexes explained
  - PHI protection mechanisms
  - Common queries
  - Migration procedures

- **[Testing Guide](guides/TESTING.md)** - Testing strategy and best practices
  - Vitest framework setup
  - Unit test examples
  - Integration test examples
  - Coverage requirements (80% statements)
  - Mocking strategies
  - CI/CD integration

### Architecture

- **[Architecture Overview](architecture/README.md)** - System architecture and design decisions
  - High-level architecture diagram
  - Technology stack rationale
  - Module system design
  - Authentication & authorization flow
  - Data architecture
  - Security architecture
  - Performance optimizations
  - Scalability considerations

---

## 🧩 Module Documentation

Dash uses a modular architecture where each business function is a self-contained module.

### Module System

- **[Module System Guide](modules/README.md)** - Complete module architecture documentation
  - Creating new modules
  - Module best practices
  - Module configuration
  - Testing modules
  - Enabling/disabling modules

### Active Modules (5/10)

1. **[Validateur Module](modules/validateur/)** - Quebec RAMQ billing validation (flagship)
   - Rule creation guide
   - Rule templates
   - Example rules
   - Technical documentation

2. **Database Module** - Reference data management (codes, contexts, establishments)

3. **Administration Module** - User management with RBAC

4. **Core Auth Module** - Auth0 authentication

5. **Observability Module** - Sentry + OpenTelemetry

### Disabled Modules (5/10)

- **[Chatbot Module](modules/chatbot/)** - AI-powered medical billing assistant (Ollama)
  - Knowledge base management
  - Conversation system
  - RAG pipeline
  - Administration interface

- **[Tasks Module](modules/tasks/)** - Kanban task and workflow management
  - Board management
  - Real-time UI updates
  - Status tracking

- **Formation Module** - Training resources for Quebec healthcare professionals

---

## 🔒 Security Documentation

Security is critical for Quebec healthcare PHI protection.

### Security Guides

- **[Security Overview](security/README.md)** - Complete security architecture
  - Authentication & authorization (Auth0)
  - PHI protection mechanisms
  - Network security (firewall, SSL/TLS)
  - File upload security
  - Database security
  - Security headers (Helmet.js)
  - Rate limiting
  - Session management
  - Secrets management
  - Monitoring & alerting
  - Security checklist
  - HIPAA compliance
  - Incident response

- **[PHI Access Control](security/PHI_ACCESS_CONTROL.md)** - User isolation and ownership verification
  - Ownership verification middleware
  - Protected endpoints
  - Audit logging
  - Test coverage
  - Usage examples

- **[PHI Redaction](security/PHI_REDACTION.md)** - Automatic sanitization in logs
  - Whitelist approach
  - PHI field blocking
  - Error message sanitization
  - Sentry integration
  - Test coverage (31 tests, 100% coverage)

---

## 🚢 Operations Documentation

Production deployment and operational procedures.

### Deployment

- **[Server Setup Guide](operations/SERVER_SETUP.md)** - Complete production server configuration
  - Ubuntu 24.04 LTS setup
  - PostgreSQL 16 configuration
  - Redis 7 setup
  - PM2 process management
  - Nginx reverse proxy
  - SSL/TLS certificates
  - Firewall (UFW)
  - Security hardening (Fail2ban)
  - Backup procedures

- **[Deployment Guide](operations/DEPLOYMENT.md)** - CI/CD pipeline and deployment
  - GitHub Actions workflow
  - Staging environment
  - Production deployment
  - Zero-downtime deployments
  - Rollback procedures
  - Post-deployment verification

### Monitoring

- **[Observability Guide](operations/OBSERVABILITY.md)** - Production observability
  - Sentry error tracking
  - OpenTelemetry distributed tracing
  - PHI sanitization in telemetry
  - Health check endpoints
  - Performance monitoring
  - Sampling rates

---

## 📋 Planning Documentation

Future plans and analysis documents (not yet implemented).

> **⚠️ These documents contain proposed features and analysis, not current implementation.**

### Infrastructure Planning

- **[AWS Deployment Plan](planning/AWS_DEPLOYMENT_PLAN.md)** - AWS migration strategy
  - Current OVH VPS vs proposed AWS architecture
  - EC2, RDS, ElastiCache, S3, ALB configuration
  - External service configuration (Auth0, GitHub, Sentry)
  - Cost estimates ($540/month)
  - 6-phase migration strategy
  - Security and HIPAA compliance

- **[Microservices Roadmap](planning/MICROSERVICES_ROADMAP.md)** - Long-term architecture evolution
  - 18-24 month roadmap
  - Strangler Fig Pattern migration
  - Service boundaries
  - Event-driven architecture
  - Service mesh

### Analysis Documents

- **[Project Analysis](planning/PROJECT_ANALYSIS.md)** - Comprehensive project assessment (October 2025)
  - Strengths and weaknesses
  - Technical debt analysis
  - Recommendations

- **[Architecture Analysis](planning/ARCHITECTURE_ANALYSIS.md)** - Architecture assessment
  - Current state evaluation
  - Proposed improvements
  - Best practices

- **[Validation Analysis](planning/VALIDATION_ANALYSIS.md)** - RAMQ validation system analysis
  - Rule completeness assessment
  - Missing rules identification
  - Recommendations

- **[Validation Logging Plan](planning/VALIDATION_LOGGING_PLAN.md)** - Logging system improvements
  - Current implementation status
  - Future enhancements

---

## 📜 Historical Documentation

Implementation records and completed work.

### Implementation Records

Located in `history/` directory:

- **Chatbot Implementation** - AI assistant development records
- **Task Module Implementation** - Kanban board development records
- **Validation System** - Validation engine development
- **Security Implementations** - PHI protection, access control
- **Performance Optimizations** - Redis caching, database indexes
- **Observability Implementation** - Sentry + OpenTelemetry integration

---

## 🔍 Finding Documentation

### By Topic

**Authentication & Security**:
- [Security Overview](security/README.md)
- [PHI Access Control](security/PHI_ACCESS_CONTROL.md)
- [PHI Redaction](security/PHI_REDACTION.md)

**Database & Performance**:
- [Database Schema](guides/DATABASE.md)
- [Architecture Overview](architecture/README.md) (Performance section)

**API Development**:
- [API Reference](guides/API.md)
- [Module System](modules/README.md)
- [Contributing Guide](../CONTRIBUTING.md)

**Testing**:
- [Testing Guide](guides/TESTING.md)
- [Contributing Guide](../CONTRIBUTING.md)

**Deployment**:
- [Server Setup](operations/SERVER_SETUP.md)
- [Deployment Guide](operations/DEPLOYMENT.md)

**Module Development**:
- [Module System](modules/README.md)
- [Validateur Module](modules/validateur/)
- [Chatbot Module](modules/chatbot/)
- [Tasks Module](modules/tasks/)

### By Role

**New Developer**:
1. [Getting Started](getting-started/README.md)
2. [CLAUDE.md](../CLAUDE.md)
3. [Architecture Overview](architecture/README.md)
4. [Contributing Guide](../CONTRIBUTING.md)

**Frontend Developer**:
1. [Getting Started](getting-started/README.md)
2. [API Reference](guides/API.md)
3. [Module System](modules/README.md)

**Backend Developer**:
1. [Architecture Overview](architecture/README.md)
2. [Database Schema](guides/DATABASE.md)
3. [Testing Guide](guides/TESTING.md)
4. [Module System](modules/README.md)

**DevOps Engineer**:
1. [Server Setup](operations/SERVER_SETUP.md)
2. [Deployment Guide](operations/DEPLOYMENT.md)
3. [Security Overview](security/README.md)

**Quebec Healthcare Professional** (User):
1. [Guide Utilisateur (Français)](guides/GUIDE_UTILISATEUR.md)

---

## 📝 Documentation Standards

### Writing Guidelines

- **Language**: Technical docs in English, user docs in French
- **Format**: Markdown with GitHub-flavored syntax
- **Line Length**: 120 characters max
- **Code Examples**: Always include language identifier for syntax highlighting
- **Links**: Use relative paths (e.g., `[Link](guides/API.md)`)

### Documentation Structure

```
docs/
├── INDEX.md                    # This file
├── getting-started/            # Setup guides
│   └── README.md
├── guides/                     # User and technical guides
│   ├── GUIDE_UTILISATEUR.md    # French user guide
│   ├── API.md                  # API reference
│   ├── DATABASE.md             # Database schema
│   └── TESTING.md              # Testing guide
├── modules/                    # Module-specific docs
│   ├── README.md               # Module system guide
│   ├── validateur/             # Validateur module
│   ├── chatbot/                # Chatbot module
│   └── tasks/                  # Tasks module
├── architecture/               # System architecture
│   └── README.md
├── security/                   # Security documentation
│   ├── README.md
│   ├── PHI_ACCESS_CONTROL.md
│   └── PHI_REDACTION.md
├── operations/                 # Deployment and operations
│   ├── SERVER_SETUP.md
│   ├── DEPLOYMENT.md
│   └── OBSERVABILITY.md
├── planning/                   # Future plans and analysis
│   ├── AWS_DEPLOYMENT_PLAN.md
│   ├── MICROSERVICES_ROADMAP.md
│   ├── PROJECT_ANALYSIS.md
│   ├── ARCHITECTURE_ANALYSIS.md
│   ├── VALIDATION_ANALYSIS.md
│   └── VALIDATION_LOGGING_PLAN.md
└── history/                    # Implementation records
    ├── chatbot/
    ├── tasks/
    └── validateur/
```

### Contributing to Documentation

See [Contributing Guide](../CONTRIBUTING.md) for documentation contribution guidelines.

---

## 🆘 Support

- **GitHub Issues**: https://github.com/montignypatrik/facnet-validator/issues
- **Getting Started**: [Getting Started Guide](getting-started/README.md)
- **General Questions**: Create GitHub discussion

---

**Last Updated**: January 2025
**Documentation Version**: 1.0.0
