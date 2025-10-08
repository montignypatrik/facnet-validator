# Getting Started with Dash

Welcome to **Dash**, the Quebec healthcare billing validation platform! This guide will help you get the application running locally in under 10 minutes.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18 or higher ([Download](https://nodejs.org/))
- **PostgreSQL** 16 or higher ([Download](https://www.postgresql.org/download/))
- **Redis** 7 or higher ([Download](https://redis.io/download))
- **Git** ([Download](https://git-scm.com/downloads))
- **Auth0 Account** (free tier available at [auth0.com](https://auth0.com))

### Verify Installation

```bash
node --version    # Should be v18.x.x or higher
npm --version     # Should be 9.x.x or higher
psql --version    # Should be 16.x or higher
redis-server --version  # Should be 7.x or higher
```

## Quick Start (5 Minutes)

### 1. Clone the Repository

```bash
git clone https://github.com/montignypatrik/facnet-validator.git
cd facnet-validator
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages for both frontend and backend.

### 3. Setup PostgreSQL Database

```bash
# Start PostgreSQL service
# On Ubuntu/Debian:
sudo systemctl start postgresql

# On macOS (with Homebrew):
brew services start postgresql

# On Windows:
# Start PostgreSQL service from Services panel or pgAdmin
```

Create the database and user:

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user (run these commands in psql)
CREATE DATABASE dashvalidator;
CREATE USER dashvalidator_user WITH PASSWORD 'DashValidator2024';
GRANT ALL PRIVILEGES ON DATABASE dashvalidator TO dashvalidator_user;
GRANT ALL ON SCHEMA public TO dashvalidator_user;
\q
```

### 4. Setup Redis

```bash
# Start Redis service
# On Ubuntu/Debian:
sudo systemctl start redis-server

# On macOS (with Homebrew):
brew services start redis

# On Windows:
# Download and run Redis from GitHub or use WSL
redis-server
```

Verify Redis is running:

```bash
redis-cli ping
# Should return: PONG
```

### 5. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Database (with SSL/TLS encryption)
DATABASE_URL=postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator?sslmode=prefer

# Redis
REDIS_URL=redis://localhost:6379

# Auth0 - Frontend (VITE_* prefix required)
VITE_AUTH0_DOMAIN=dev-x63i3b6hf5kch7ab.ca.auth0.com
VITE_AUTH0_CLIENT_ID=ECieaY4IiPbZNbWMoGJTPmD4pGsEi2rr
VITE_AUTH0_AUDIENCE=facnet-validator-api

# Auth0 - Backend
AUTH0_CLIENT_SECRET=your-auth0-client-secret
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

**Important**: Replace `your-auth0-client-secret` with your actual Auth0 credentials. See [Auth0 Setup](#auth0-setup) below.

### 6. Initialize Database Schema

```bash
npm run db:push
```

This creates all required database tables using Drizzle ORM.

### 7. Import Reference Data (Optional)

```bash
# Import RAMQ billing codes
node scripts/import_codes.js

# Import service contexts
node scripts/import_contexts.cjs

# Import healthcare establishments
node scripts/import_establishments.cjs
```

### 8. Start the Development Server

```bash
npm run dev
```

The application will start on **http://localhost:5000**

You should see:

```
[DASH] Server starting on port 5000...
[REDIS] Successfully connected to Redis
[DATABASE] Database connection successful
[MODULE REGISTRY] Loaded 5/10 modules
[DASH] Server ready at http://localhost:5000
```

### 9. Access the Application

Open your browser and navigate to:

**http://localhost:5000**

You should see the Dash login page. Click "Sign In" to authenticate via Auth0.

## Auth0 Setup

### Create Auth0 Application

1. Go to [auth0.com](https://auth0.com) and sign up for a free account
2. Create a new **Single Page Application**
3. Note your **Domain** and **Client ID**
4. Configure **Allowed Callback URLs**:
   ```
   http://localhost:5000/callback,
   http://localhost:5000
   ```
5. Configure **Allowed Logout URLs**:
   ```
   http://localhost:5000
   ```
6. Configure **Allowed Web Origins**:
   ```
   http://localhost:5000
   ```

### Create Auth0 API

1. Go to **Applications > APIs** in Auth0 dashboard
2. Create a new API with identifier: `facnet-validator-api`
3. Note the **Identifier** (this is your audience)

### Update Environment Variables

Edit `.env` with your Auth0 credentials:

```env
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=facnet-validator-api
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
```

**Important**: After changing Auth0 environment variables, rebuild the application:

```bash
npm run build
```

This ensures the frontend JavaScript bundle includes the correct Auth0 configuration.

## Project Structure

```
facnet-validator/
├── client/              # React frontend
│   ├── src/
│   │   ├── pages/       # Page components (Dashboard, Codes, etc.)
│   │   ├── components/  # Reusable UI components
│   │   └── api/         # API client configuration
├── server/              # Express backend
│   ├── core/            # Authentication and utilities
│   ├── modules/         # Business modules (validateur, database, etc.)
│   └── observability/   # Monitoring and logging
├── docs/                # Documentation
│   ├── guides/          # User and technical guides
│   ├── modules/         # Module-specific documentation
│   └── operations/      # Deployment and operations
├── tests/               # Test files
│   ├── unit/            # Unit tests
│   └── integration/     # Integration tests
└── scripts/             # Data import utilities
```

## Available Modules

### Active Modules (5/10)

1. **validateur** - Quebec RAMQ billing validation (flagship)
2. **database** - Manage codes, contexts, establishments, rules
3. **administration** - User management with RBAC
4. **core-auth** - Auth0 authentication
5. **observability** - Sentry error tracking + OpenTelemetry tracing

### Disabled Modules (5/10)

- **chatbot** - AI-powered medical billing assistant (Ollama)
- **chatbot-chat** - Conversation management
- **chatbot-admin** - Knowledge base administration
- **formation-ressourcement** - Training resources
- **tasks** - Kanban task management

To enable a module, edit `server/moduleRegistry.ts` and change `enabled: false` to `enabled: true`.

## Common Commands

### Development

```bash
npm run dev              # Start development server (port 5000)
npm run check            # TypeScript type checking
npm test                 # Run tests
npm run test:coverage    # Run tests with coverage
```

### Production

```bash
npm run build            # Build for production
npm run start            # Start production server
```

### Database

```bash
npm run db:push          # Apply schema changes
npm run db:studio        # Open Drizzle Studio (database GUI)
```

## User Roles

The application uses role-based access control (RBAC):

| Role | Access Level | Permissions |
|------|--------------|-------------|
| **pending** | None | Awaiting admin approval |
| **viewer** | Read-only | View codes, contexts, validation results |
| **editor** | Read + Write | Upload files, run validations, manage data |
| **admin** | Full access | User management, deletions, system configuration |

### Setting User Role

After first login, users have `pending` role by default. An admin must assign a role:

1. Login as admin
2. Go to **Administration** > **Users**
3. Find the user and click **Edit**
4. Select role and save

## Troubleshooting

### Port 5000 Already in Use

```bash
# Find process using port 5000
# On Linux/macOS:
lsof -i :5000

# On Windows:
netstat -ano | findstr :5000

# Kill the process
# On Linux/macOS:
kill -9 [PID]

# On Windows:
taskkill /PID [PID] /F
```

### Database Connection Errors

```bash
# Verify PostgreSQL is running
psql -U dashvalidator_user -d dashvalidator -h localhost

# Check connection string in .env
DATABASE_URL=postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator?sslmode=prefer
```

### Redis Connection Errors

```bash
# Verify Redis is running
redis-cli ping
# Should return: PONG

# Check Redis URL in .env
REDIS_URL=redis://localhost:6379
```

### Auth0 Shows "undefined" Domain

This means `VITE_AUTH0_DOMAIN` wasn't loaded during build:

1. Ensure `.env` file exists in project root (not in `client/` subdirectory)
2. Verify all `VITE_*` variables are present
3. **Rebuild the application**:
   ```bash
   npm run build
   ```
4. Verify variables are embedded in built JavaScript:
   ```bash
   grep -o "your-tenant.auth0.com" dist/public/assets/index-*.js
   ```

### Tests Failing

```bash
# Clear test cache
npm run test -- --clearCache

# Run specific test file
npm test path/to/test.test.ts

# Run tests in watch mode
npm test -- --watch
```

## Next Steps

Now that you have Dash running locally:

1. **Upload a CSV File**: Go to **Validateur** and upload a Quebec healthcare billing CSV
2. **View Validation Results**: See detected errors and warnings
3. **Explore Reference Data**: Check out **Codes**, **Contexts**, and **Establishments**
4. **Read Documentation**: Browse `docs/` for detailed guides
5. **Contribute**: See [CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines

## Additional Resources

- **User Guide (French)**: [docs/guides/GUIDE_UTILISATEUR.md](../guides/GUIDE_UTILISATEUR.md)
- **API Documentation**: [docs/guides/API.md](../guides/API.md)
- **Testing Guide**: [docs/guides/TESTING.md](../guides/TESTING.md)
- **Database Schema**: [docs/guides/DATABASE.md](../guides/DATABASE.md)
- **Security Overview**: [docs/security/README.md](../security/README.md)
- **Module System**: [docs/modules/README.md](../modules/README.md)

## Support

- **GitHub Issues**: https://github.com/montignypatrik/facnet-validator/issues
- **Documentation**: Browse `docs/` directory
- **Code Questions**: Review existing code or create discussion

## License

See LICENSE file in project root.

---

**Welcome to Dash!** 🚀

For detailed project overview, see [CLAUDE.md](../../CLAUDE.md).
