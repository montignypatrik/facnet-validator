# Deployment Guide - Dash Healthcare Validator

Complete guide for deploying the Quebec healthcare billing validation platform to production.

**Current Production**: https://148.113.196.245
**GitHub Repository**: https://github.com/montignypatrik/facnet-validator
**CI/CD**: GitHub Actions (automatic on push to main)

---

## Overview

Dash uses **automated GitHub Actions CI/CD pipeline** for zero-downtime production deployments. Every push to the `main` branch triggers automatic deployment to the production VPS.

### Deployment Architecture

```
GitHub (main branch)
       ↓
GitHub Actions Workflow
       ↓
SSH to Production VPS
       ↓
PM2 Zero-Downtime Restart
       ↓
https://148.113.196.245
```

---

## Automated Production Deployment

### GitHub Actions Workflow

File: [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml)

**Triggers**:
- Push to `main` branch
- Manual workflow dispatch

**Steps**:
1. Checkout code
2. Setup Node.js 18
3. Install dependencies (`npm install`)
4. Build application (`npm run build`)
5. Run tests (optional)
6. SSH to production server
7. Pull latest code
8. Install production dependencies
9. Build on server
10. Apply database migrations
11. Restart PM2 with zero downtime
12. Verify deployment health

**Deployment Time**: ~2-3 minutes

### Deployment Workflow

```bash
# 1. Develop feature locally
git checkout -b feature/new-validation-rule
# Make changes, test locally

# 2. Commit changes
git add .
git commit -m "feat: Add new RAMQ validation rule"
git push origin feature/new-validation-rule

# 3. Test on staging (optional but recommended)
# SSH to server and deploy to staging environment

# 4. Merge to main (triggers automatic deployment)
git checkout main
git merge feature/new-validation-rule
git push origin main

# 5. GitHub Actions automatically deploys to production!
# Monitor at: https://github.com/montignypatrik/facnet-validator/actions
```

---

## Staging Environment

### Purpose

Safe testing of features before production deployment.

- **URL**: https://148.113.196.245:3001
- **Directory**: `/var/www/facnet/staging/`
- **Database**: `dashvalidator_staging`
- **Configuration**: `ecosystem.staging.cjs`

### Manual Staging Deployment

```bash
# 1. SSH to server
ssh ubuntu@148.113.196.245

# 2. Navigate to staging directory
cd /var/www/facnet/staging

# 3. Checkout feature branch
sudo -u facnet git fetch origin
sudo -u facnet git checkout feature/your-branch-name
sudo -u facnet git pull origin feature/your-branch-name

# 4. Install dependencies and build
sudo -u facnet npm install
sudo -u facnet npm run build
sudo -u facnet npm run db:push  # Apply database changes

# 5. Restart staging app
sudo -u facnet PORT=3002 \
  NODE_ENV=staging \
  DATABASE_URL='postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator_staging' \
  AUTH0_ISSUER_BASE_URL='https://dev-x63i3b6hf5kch7ab.ca.auth0.com' \
  AUTH0_AUDIENCE='facnet-validator-api' \
  AUTH0_CLIENT_SECRET='fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk' \
  pm2 start dist/server/index.js --name facnet-validator-staging

# 6. Save PM2 configuration
sudo -u facnet pm2 save

# 7. Test at https://148.113.196.245:3001
curl -k https://148.113.196.245:3001/api/health
```

### Staging Troubleshooting

**Problem**: Staging returns 502 Bad Gateway

**Solution - Complete Staging Reset**:

```bash
# 1. SSH to server
ssh ubuntu@148.113.196.245

# 2. Navigate to staging
cd /var/www/facnet/staging

# 3. Delete any existing PM2 processes
sudo -u facnet pm2 delete facnet-validator-staging 2>/dev/null || true

# 4. Rebuild application
sudo -u facnet git pull
sudo -u facnet npm install
sudo -u facnet npm run build

# 5. Start with direct command (bypass ecosystem config)
sudo -u facnet PORT=3002 \
  NODE_ENV=staging \
  DATABASE_URL='postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator_staging' \
  AUTH0_ISSUER_BASE_URL='https://dev-x63i3b6hf5kch7ab.ca.auth0.com' \
  AUTH0_AUDIENCE='facnet-validator-api' \
  AUTH0_CLIENT_SECRET='fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk' \
  pm2 start dist/server/index.js --name facnet-validator-staging

# 6. Verify
sudo ss -tlnp | grep ':3002'  # Should show node on port 3002
curl http://localhost:3002/api/health  # Should return {"status":"healthy"}
```

**Key Points**:
- Internal Port: 3002 (NOT 3001)
- External Port: 3001 (Nginx proxies 3001 → 3002)
- Database: `dashvalidator_staging`

---

## Production Deployment

### Production Environment

- **URL**: https://148.113.196.245
- **Directory**: `/var/www/facnet/app/`
- **Database**: `dashvalidator`
- **Configuration**: `ecosystem.config.cjs`
- **Process Manager**: PM2 with clustering (6 instances)
- **Web Server**: Nginx with SSL/TLS

### Manual Production Deployment

**⚠️ Normally not needed - use GitHub Actions instead!**

```bash
# 1. SSH to production server
ssh ubuntu@148.113.196.245

# 2. Navigate to production directory
cd /var/www/facnet/app

# 3. Pull latest code
sudo -u facnet git fetch origin
sudo -u facnet git checkout main
sudo -u facnet git pull origin main

# 4. Install dependencies and build
sudo -u facnet npm install
sudo -u facnet npm run build

# 5. Apply database migrations
sudo -u facnet npm run db:push

# 6. Restart PM2 with zero downtime
sudo -u facnet pm2 restart ecosystem.config.cjs

# 7. Save PM2 configuration
sudo -u facnet pm2 save
```

---

## Post-Deployment Verification

### Critical Checks

Always verify production is working after deployment:

```bash
# 1. Check production health endpoint
curl -k https://148.113.196.245/api/health
# Should return: {"status":"healthy","timestamp":"..."}

# 2. If you get 502 Bad Gateway, check PM2 status
ssh ubuntu@148.113.196.245
sudo -u facnet pm2 status
# Should show 6 processes online

# 3. If processes are stopped, restart them
cd /var/www/facnet/app
sudo -u facnet pm2 restart ecosystem.config.cjs

# 4. Check PM2 logs for errors
sudo -u facnet pm2 logs facnet-validator --lines 50

# 5. Test authentication flow
# Visit https://148.113.196.245 and click "Sign In"
# Should redirect to Auth0 (NOT to "undefined")

# 6. Verify Auth0 variables in JavaScript bundle
curl -k https://148.113.196.245/ | grep -o 'src="/assets/index-[^"]*\.js"'
# Get filename, then:
grep -o "dev-x63i3b6hf5kch7ab.ca.auth0.com" /var/www/facnet/app/dist/public/assets/index-XXXXX.js
# Should output: dev-x63i3b6hf5kch7ab.ca.auth0.com
```

### Common Post-Deployment Issues

**Issue 1: 502 Bad Gateway**

- **Cause**: PM2 processes not running
- **Solution**:
  ```bash
  cd /var/www/facnet/app
  sudo -u facnet pm2 restart ecosystem.config.cjs
  sudo -u facnet pm2 save
  ```

**Issue 2: "Cannot find package 'vite'" Error**

- **Cause**: Production dependencies installed without devDependencies
- **Solution**:
  ```bash
  cd /var/www/facnet/app
  sudo -u facnet npm install  # Install ALL dependencies
  sudo -u facnet pm2 restart ecosystem.config.cjs
  ```

**Issue 3: Auth0 Domain Shows "undefined"**

- **Cause**: Frontend built without `VITE_AUTH0_DOMAIN` environment variable
- **Solution**:
  ```bash
  # Verify .env file has VITE_* variables
  cat /var/www/facnet/app/.env | grep VITE_AUTH0

  # Rebuild application
  cd /var/www/facnet/app
  sudo -u facnet npm run build
  sudo -u facnet pm2 restart ecosystem.config.cjs

  # Verify embedded in bundle
  grep -o "dev-x63i3b6hf5kch7ab" dist/public/assets/index-*.js
  ```

---

## Rollback Procedures

### Rolling Back to Previous Version

```bash
# 1. SSH to production
ssh ubuntu@148.113.196.245
cd /var/www/facnet/app

# 2. Check git commit history
sudo -u facnet git log --oneline -n 10

# 3. Rollback to previous commit
sudo -u facnet git reset --hard [COMMIT_HASH]

# 4. Reinstall dependencies and rebuild
sudo -u facnet npm install
sudo -u facnet npm run build

# 5. Restart PM2
sudo -u facnet pm2 restart ecosystem.config.cjs

# 6. Verify rollback
curl -k https://148.113.196.245/api/health
```

### Rolling Back Database Migrations

**⚠️ Use with caution - potential data loss!**

```bash
# 1. Connect to database
psql -U dashvalidator_user -d dashvalidator -h localhost

# 2. Check migration history
SELECT * FROM drizzle.__migrations ORDER BY created_at DESC LIMIT 5;

# 3. Manually revert schema changes (no automated rollback)
# You must manually write SQL to undo schema changes
```

**Best Practice**: Test database migrations on staging first!

---

## Zero-Downtime Deployment

### How PM2 Enables Zero Downtime

PM2's clustering mode ensures zero downtime:

1. **Current State**: 6 processes running
2. **Deployment**: PM2 restarts processes one by one
3. **Process Restart Order**:
   - Process 1 stops → Process 1 starts (new code)
   - Process 2 stops → Process 2 starts (new code)
   - ... (repeat for all 6 processes)
4. **Result**: At least 5 processes always serving requests

**Configuration** (ecosystem.config.cjs):
```javascript
{
  name: 'facnet-validator',
  instances: 6,  // 6 processes for load distribution
  exec_mode: 'cluster',  // Enables zero-downtime restart
  kill_timeout: 5000,  // Wait 5s before force-killing
  wait_ready: true,  // Wait for process to be ready
  listen_timeout: 10000  // Wait 10s for process to listen
}
```

---

## Deployment Checklist

### Before Deployment

- [ ] Code reviewed and approved
- [ ] Tests passing locally (`npm test`)
- [ ] TypeScript compiles (`npm run check`)
- [ ] Tested on staging environment
- [ ] Database migrations tested (if any)
- [ ] Auth0 environment variables correct
- [ ] No hardcoded secrets in code

### During Deployment

- [ ] GitHub Actions workflow completes successfully
- [ ] No errors in workflow logs
- [ ] PM2 processes restart successfully

### After Deployment

- [ ] Health endpoint returns 200 OK
- [ ] PM2 status shows all 6 processes online
- [ ] Authentication flow works (Auth0 login)
- [ ] Upload CSV file and validate (smoke test)
- [ ] Check PM2 logs for errors
- [ ] Verify in browser: https://148.113.196.245

---

## Monitoring Deployment

### GitHub Actions Monitoring

View deployment status:
- **Actions Tab**: https://github.com/montignypatrik/facnet-validator/actions
- **Workflow Status**: Green checkmark = success, Red X = failure
- **Logs**: Click workflow run to view detailed logs

### Production Monitoring

```bash
# SSH to production
ssh ubuntu@148.113.196.245

# Check PM2 status
sudo -u facnet pm2 status

# View real-time logs
sudo -u facnet pm2 logs facnet-validator

# View last 100 lines of logs
sudo -u facnet pm2 logs facnet-validator --lines 100

# Check Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Check system resources
htop
```

---

## Environment Variables

### Production Environment Variables

Located at: `/var/www/facnet/app/.env`

**Critical Variables**:
```env
# Database
DATABASE_URL=postgresql://dashvalidator_user:PASSWORD@localhost:5432/dashvalidator?sslmode=require

# Redis
REDIS_URL=redis://localhost:6379

# Auth0 - Frontend (VITE_* required for client bundle)
VITE_AUTH0_DOMAIN=dev-x63i3b6hf5kch7ab.ca.auth0.com
VITE_AUTH0_CLIENT_ID=ECieaY4IiPbZNbWMoGJTPmD4pGsEi2rr
VITE_AUTH0_AUDIENCE=facnet-validator-api

# Auth0 - Backend
AUTH0_CLIENT_SECRET=***
AUTH0_ISSUER_BASE_URL=https://dev-x63i3b6hf5kch7ab.ca.auth0.com
AUTH0_AUDIENCE=facnet-validator-api

# PHI Redaction
PHI_REDACTION_SALT=***

# Observability (optional)
SENTRY_ENABLED=false
OTEL_ENABLED=false
```

**Important**: After changing `VITE_*` variables, rebuild the application:
```bash
sudo -u facnet npm run build
sudo -u facnet pm2 restart ecosystem.config.cjs
```

---

## Security Considerations

### SSH Access

- **User**: `ubuntu` (NOT root)
- **Authentication**: SSH key only (password disabled)
- **Key Location**: Check with system administrator

### File Permissions

- **Owner**: `facnet` system user
- **Application Files**: `/var/www/facnet/app/` owned by `facnet:facnet`
- **Logs**: `/var/www/facnet/app/logs/` writable by `facnet`

### Firewall Rules

```bash
# Check UFW status
sudo ufw status

# Allowed ports:
# 22  (SSH - key authentication only)
# 80  (HTTP - redirects to 443)
# 443 (HTTPS)
```

---

## Troubleshooting

### Deployment Failed in GitHub Actions

1. **Check workflow logs**: GitHub → Actions → Failed workflow → View logs
2. **Common causes**:
   - npm install failed (check package.json)
   - npm run build failed (TypeScript errors)
   - SSH connection failed (check server status)
   - Disk space full on server

### PM2 Processes Not Starting

```bash
# Check PM2 logs
sudo -u facnet pm2 logs facnet-validator --err

# Common issues:
# - Missing environment variables
# - Port 5000 already in use
# - Database connection failed
# - Redis connection failed

# Check if port 5000 is in use
sudo ss -tlnp | grep ':5000'

# Check if Redis is running
redis-cli ping
# Should return: PONG

# Check if PostgreSQL is running
sudo systemctl status postgresql
```

### Database Migration Failures

```bash
# Check database connection
psql -U dashvalidator_user -d dashvalidator -h localhost -c "SELECT 1;"

# View recent migrations
psql -U dashvalidator_user -d dashvalidator -h localhost -c "
  SELECT * FROM drizzle.__migrations ORDER BY created_at DESC LIMIT 5;
"

# Manually run migrations (if automated failed)
cd /var/www/facnet/app
sudo -u facnet npm run db:push
```

---

## Related Documentation

- **[Server Setup Guide](SERVER_SETUP.md)** - Production server configuration
- **[Security Overview](../security/README.md)** - Security architecture
- **[Architecture Overview](../architecture/README.md)** - System architecture
- **[Contributing Guide](../../CONTRIBUTING.md)** - Development workflow

---

**Last Updated**: January 2025
**Production URL**: https://148.113.196.245
**CI/CD Method**: GitHub Actions (automatic on push to main)
