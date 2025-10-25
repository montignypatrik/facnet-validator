# Deployment Agent - Comprehensive Guide

This document contains all information needed to deploy and run the Dash application in all environments.

## Table of Contents
1. [Environment Overview](#environment-overview)
2. [Local Development](#local-development)
3. [Staging Deployment](#staging-deployment)
4. [Production Deployment](#production-deployment)
5. [Troubleshooting](#troubleshooting)
6. [Common Commands](#common-commands)

---

## Environment Overview

### Local Development
- **Port:** 5000 (backend), 5173 (frontend dev server)
- **Database:** Local PostgreSQL
- **Redis:** Local Redis
- **Environment:** `.env` file
- **Mode:** Development with hot reload

### Staging
- **Server:** 148.113.196.245
- **Port:** 3001
- **Database:** `dashvalidator_staging`
- **Environment:** `.env.staging` (on server, NOT in version control)
- **Mode:** Single instance, fork mode
- **Purpose:** Test features before production

### Production
- **Server:** 148.113.196.245
- **Port:** 5000
- **Database:** `dashvalidator`
- **Environment:** `.env` (on server)
- **Mode:** Clustered (6 workers)
- **URL:** https://148.113.196.245

---

## Local Development

### Prerequisites
```bash
# Required software
- Node.js 20+
- PostgreSQL 16
- Redis
- Git
```

### Initial Setup
```bash
# 1. Clone repository
git clone https://github.com/montignypatrik/facnet-validator.git
cd facnet-validator

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env
# Edit .env with your local credentials

# 4. Setup database
npm run db:push

# 5. Import data (optional)
node scripts/import_codes.js
node scripts/import_contexts.cjs
node scripts/import_establishments.cjs
```

### Running Locally
```bash
# Start development server (auto-cleanup ports)
npm run dev

# This will:
# 1. Run cleanup-ports.js (kills processes on 5000, 5173)
# 2. Start backend on port 5000
# 3. Start frontend dev server on port 5173

# Access:
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:5000/api
# - Health check: http://localhost:5000/api/health
```

### Build Locally
```bash
# Clean build (removes dist/ first)
npm run build

# This will:
# 1. Run clean (removes dist/)
# 2. Build with Vite + esbuild
# 3. Verify build artifacts exist
# 4. Exit with error if build failed

# Test production build locally
npm start
# Access: http://localhost:5000
```

### Common Local Commands
```bash
# Port cleanup (if needed manually)
npm run cleanup

# Emergency: Kill all Node.js processes
bash scripts/kill-all-node.sh

# Type checking
npm run check

# Database migrations
npm run db:push

# Tests
npm test
npm run test:ui
npm run test:coverage
```

---

## Staging Deployment

### Server Access
```bash
# SSH to server
ssh ubuntu@148.113.196.245

# Switch to facnet user
sudo -u facnet bash
cd /var/www/facnet/app
```

### Manual Staging Deployment

#### Method 1: Using Helper Script (Recommended)
```bash
ssh ubuntu@148.113.196.245
sudo -u facnet bash
cd /var/www/facnet/app

# Pull latest code
git fetch origin
git checkout <branch-name>  # e.g., feature/new-feature
git pull origin <branch-name>

# Install dependencies
npm ci

# Build application
npm run build

# Run migrations
npm run db:push

# Start/Restart staging
./start-staging.sh
```

#### Method 2: Manual PM2 Commands
```bash
ssh ubuntu@148.113.196.245
sudo -u facnet bash
cd /var/www/facnet/app

# Pull code
git fetch origin
git checkout <branch-name>
git pull

# Build
npm ci
npm run build

# Stop staging if running
pm2 stop facnet-validator-staging
pm2 delete facnet-validator-staging

# Load environment
source .env.staging
export NODE_ENV PORT DATABASE_URL REDIS_URL AUTH0_ISSUER_BASE_URL AUTH0_AUDIENCE AUTH0_CLIENT_SECRET PHI_REDACTION_SALT

# Start staging
pm2 start server/index.ts \
  --name facnet-validator-staging \
  --interpreter node \
  --interpreter-args="--import tsx/esm"

# Save PM2 config
pm2 save

# Verify
pm2 status facnet-validator-staging
curl http://localhost:3001/api/health
```

### Staging Verification
```bash
# Check PM2 status
pm2 status facnet-validator-staging

# View logs
pm2 logs facnet-validator-staging --lines 50

# Health check
curl http://localhost:3001/api/health

# Test from browser
# https://148.113.196.245:3001
```

### Staging Environment File
**Location:** `/var/www/facnet/app/.env.staging`

**Contents:**
```bash
NODE_ENV=staging
PORT=3001
DATABASE_URL=postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator_staging?sslmode=disable
REDIS_URL=redis://localhost:6379
AUTH0_ISSUER_BASE_URL=https://dev-x63i3b6hf5kch7ab.ca.auth0.com
AUTH0_AUDIENCE=facnet-validator-api
AUTH0_CLIENT_SECRET=fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk
PHI_REDACTION_SALT=99396260a8d4111225c83d71a260fcdaed678481cd868fe0e35b1969dc273f1b
```

**Permissions:** `600` (owner read/write only)

---

## Production Deployment

### Automated Deployment (GitHub Actions)

**Trigger:** Push to `main` branch

```bash
# From your local machine
git add .
git commit -m "Your commit message"
git push origin main
```

**Deployment Process (Automatic):**
1. ✅ Git pull latest code
2. ✅ Clean build directory (`rm -rf dist/`)
3. ✅ Install dependencies (`npm ci`)
4. ✅ Build application (`npm run build`)
5. ✅ Verify build artifacts exist
6. ✅ Run database migrations (`npm run db:push`)
7. ✅ Stop PM2 gracefully
8. ✅ Delete old PM2 processes
9. ✅ Start fresh PM2 cluster (6 workers)
10. ✅ Wait 15 seconds for stabilization
11. ✅ Verify workers are online
12. ✅ Health check (strict, fails deployment on error)

**Monitor Deployment:**
```bash
# GitHub Actions
https://github.com/montignypatrik/facnet-validator/actions

# SSH to server and watch
ssh ubuntu@148.113.196.245
sudo -u facnet bash
cd /var/www/facnet/app

# Watch PM2 logs
pm2 logs facnet-validator --lines 50

# Check status
pm2 status facnet-validator
```

### Manual Production Deployment

**⚠️ Use only if GitHub Actions fails:**

```bash
ssh ubuntu@148.113.196.245
sudo -u facnet bash
cd /var/www/facnet/app

# Pull latest
git fetch origin
git reset --hard origin/main

# Clean build
rm -rf dist/
npm ci
npm run build

# Verify build
ls -lh dist/server/index.js
ls -lh dist/public/index.html

# Migrations
npm run db:push

# Restart PM2
pm2 stop facnet-validator
sleep 3
pm2 delete facnet-validator
pm2 start ecosystem.config.cjs
pm2 save

# Wait for stabilization
sleep 15

# Verify
pm2 status facnet-validator
curl -f http://localhost:5000/api/health
```

### Production Rollback

**If deployment fails:**

```bash
ssh ubuntu@148.113.196.245
sudo -u facnet bash
cd /var/www/facnet/app

# Option 1: Use rollback script
./scripts/rollback-deployment.sh 1  # Go back 1 commit

# Option 2: Manual rollback
git reset --hard HEAD~1
npm ci
npm run build
pm2 restart ecosystem.config.cjs
```

### Production Environment File
**Location:** `/var/www/facnet/app/.env`

**Permissions:** `600` (owner read/write only)

**Note:** Never commit `.env` to version control. For credentials, see `docs/operations/DATABASE_CREDENTIALS.md`

---

## Troubleshooting

### Local Development Issues

#### Port Already in Use
```bash
# Automatic cleanup
npm run cleanup

# Manual check
netstat -ano | findstr ":5000"
netstat -ano | findstr ":5173"

# Emergency kill all Node
bash scripts/kill-all-node.sh
```

#### Build Failures
```bash
# Clean rebuild
npm run clean
npm install
npm run build

# Check TypeScript errors
npm run check
```

#### Database Connection Issues
```bash
# Check PostgreSQL is running
# Windows: Services → PostgreSQL
# Linux: sudo systemctl status postgresql

# Test connection
psql -U dashvalidator_user -d dashvalidator -h localhost
```

### Staging Issues

#### Staging Not Starting
```bash
# Check logs
pm2 logs facnet-validator-staging --lines 100

# Check port 3001
sudo lsof -i :3001
sudo netstat -tulpn | grep :3001

# Verify .env.staging exists
ls -la /var/www/facnet/app/.env.staging

# Restart
./start-staging.sh
```

#### Staging Database Issues
```bash
# Check database exists
sudo -u postgres psql -l | grep dashvalidator_staging

# Test connection
psql postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator_staging
```

### Production Issues

#### Deployment Failed
```bash
# Check GitHub Actions logs
https://github.com/montignypatrik/facnet-validator/actions

# SSH to server
ssh ubuntu@148.113.196.245
sudo -u facnet bash

# Check PM2 status
pm2 status facnet-validator

# View logs
pm2 logs facnet-validator --lines 100

# Check health
curl http://localhost:5000/api/health
```

#### Workers Not Starting
```bash
# Check PM2 list
pm2 list

# Check for errors
pm2 logs facnet-validator --err --lines 50

# Restart
pm2 restart ecosystem.config.cjs

# Nuclear option: Delete and start fresh
pm2 delete facnet-validator
pm2 start ecosystem.config.cjs
pm2 save
```

#### Health Check Failing
```bash
# Check server is listening
sudo lsof -i :5000
curl -v http://localhost:5000/api/health

# Check logs for errors
pm2 logs facnet-validator --lines 100

# Check database connection
psql postgresql://dashvalidator_user:PASSWORD@localhost:5432/dashvalidator
```

---

## Common Commands

### GitHub Actions
```bash
# View workflows
https://github.com/montignypatrik/facnet-validator/actions

# Trigger manual deployment
# Go to Actions → Deploy FacNet Validator → Run workflow
```

### PM2 Commands
```bash
# Status
pm2 status

# Logs
pm2 logs <name>                    # Real-time
pm2 logs <name> --lines 100        # Last 100 lines
pm2 logs <name> --err              # Errors only

# Restart
pm2 restart <name>
pm2 reload <name>                  # Zero-downtime

# Stop/Delete
pm2 stop <name>
pm2 delete <name>

# Save configuration
pm2 save

# Startup script (run once)
pm2 startup
```

### Server Management
```bash
# SSH
ssh ubuntu@148.113.196.245

# Switch to app user
sudo -u facnet bash
cd /var/www/facnet/app

# Check disk space
df -h

# Check memory
free -h

# Check processes
ps aux | grep node

# Check ports
sudo netstat -tulpn | grep LISTEN
```

### Database Commands
```bash
# Connect to production DB
psql postgresql://dashvalidator_user:PASSWORD@localhost:5432/dashvalidator

# Connect to staging DB
psql postgresql://dashvalidator_user:PASSWORD@localhost:5432/dashvalidator_staging

# List databases
sudo -u postgres psql -l

# Backup database
pg_dump -U dashvalidator_user dashvalidator > backup.sql

# Restore database
psql -U dashvalidator_user dashvalidator < backup.sql
```

---

## Quick Reference

### Ports
- **Local Backend:** 5000
- **Local Frontend:** 5173
- **Staging:** 3001
- **Production:** 5000

### Server Paths
- **App Directory:** `/var/www/facnet/app`
- **Logs:** `/var/www/facnet/logs/`
- **PM2 Logs:** `/var/www/facnet/.pm2/logs/`

### Important Files
- **Local Env:** `.env`
- **Staging Env:** `.env.staging` (server only)
- **Production Env:** `.env` (server only)
- **PM2 Production:** `ecosystem.config.cjs`
- **PM2 Staging:** `ecosystem.staging.cjs`
- **Staging Helper:** `start-staging.sh`

### Key Scripts
- `npm run dev` - Local development
- `npm run build` - Build application
- `npm run cleanup` - Kill port conflicts
- `./start-staging.sh` - Start staging (server)
- `./scripts/rollback-deployment.sh` - Rollback (server)

---

## Deployment Checklist

### Before Deploying to Production
- [ ] Code reviewed
- [ ] Tests passing locally (`npm test`)
- [ ] TypeScript check passing (`npm run check`)
- [ ] Tested on staging
- [ ] Database migrations tested on staging
- [ ] No PHI in code or logs
- [ ] Environment variables documented

### After Production Deployment
- [ ] GitHub Actions succeeded
- [ ] All 6 PM2 workers online
- [ ] Health check passing
- [ ] Test critical functionality
- [ ] Check error logs for issues
- [ ] Monitor for 15-30 minutes

---

## Security Notes

1. **Never commit** `.env` files to version control
2. **Never commit** credentials in any file
3. **Always use** `chmod 600` for `.env` files on server
4. **Rotate credentials** periodically
5. **Review logs** before sharing (may contain PHI)
6. **Use SSH keys** only, no passwords
7. **Keep staging and production credentials separate**

---

## Support

- **Documentation:** `docs/` directory
- **GitHub Issues:** https://github.com/montignypatrik/facnet-validator/issues
- **Server Setup:** `docs/operations/SERVER_SETUP.md`
- **Staging Setup:** `docs/operations/STAGING_SETUP.md`
