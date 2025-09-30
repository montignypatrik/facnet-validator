# Production VPS Server Setup Documentation

## Server Information

**VPS Provider**: OVH Cloud
**Operating System**: Ubuntu 24.04.2 LTS
**IP Address**: 148.113.196.245
**Hostname**: vps-45008406
**Resources**: 11GB RAM, 96GB Storage
**Kernel**: 6.8.0-56-generic

## Access & Authentication

### SSH Access
- **Primary User**: `ubuntu`
- **Authentication**: SSH Key-based (password auth disabled)
- **SSH Key**: ED25519 key pair (`~/.ssh/id_ed25519`)
- **Connection**: `ssh ubuntu@148.113.196.245`

### Service User
- **Username**: `facnet`
- **Type**: System user (UID: 110, GID: 114)
- **Home Directory**: `/var/www/facnet`
- **Shell**: `/bin/bash`
- **Purpose**: Dedicated service user for FacNet Validator application

## Database Configuration

### PostgreSQL 16
- **Service**: postgresql
- **Port**: 5432 (localhost only)
- **Production Database**: `dashvalidator`
- **Staging Database**: `dashvalidator_staging`
- **Database User**: `dashvalidator_user`
- **Database Password**: `dashvalidator123!`
- **Permissions**: Full access to both databases and `public` schema
- **Production Connection**: `postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator`
- **Staging Connection**: `postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator_staging`

### Database Commands
```bash
# Connect as postgres superuser
sudo -u postgres psql

# Connect to application database
psql -h localhost -U dashvalidator_user -d dashvalidator

# Create backup
sudo -u postgres pg_dump dashvalidator > backup.sql

# Restore backup
sudo -u postgres psql dashvalidator < backup.sql
```

## Directory Structure

```
/var/www/facnet/          # Service user home directory
├── app/                  # Production application code (main branch)
├── staging/              # Staging application code (feature branches)
├── logs/                 # Application logs (production + staging)
├── backups/              # Database backups (automated)
└── uploads/              # File uploads storage

/var/www/html/            # Default Nginx document root
/etc/nginx/sites-available/facnet-validator          # Production Nginx config
/etc/nginx/sites-available/facnet-validator-staging  # Staging Nginx config
/etc/ssl/certs/facnet.crt    # SSL certificate (shared)
/etc/ssl/private/facnet.key  # SSL private key (shared)
```

## Network & Security

### Firewall (UFW)
```bash
# Current rules
sudo ufw status verbose

# Allow new service port
sudo ufw allow 8080

# Remove rule
sudo ufw delete allow 8080
```

**Active Rules**:
- SSH (22/tcp) - LIMIT (rate limited)
- HTTP (80/tcp) - ALLOW
- HTTPS (443/tcp) - ALLOW
- Default: DENY incoming, ALLOW outgoing

### Fail2Ban
- **Service**: fail2ban
- **Configuration**: `/etc/fail2ban/jail.local`
- **Active Jails**: sshd
- **Ban Time**: 3600 seconds (1 hour)
- **Max Retry**: 3 attempts

```bash
# Check banned IPs
sudo fail2ban-client status sshd

# Unban IP
sudo fail2ban-client set sshd unbanip <IP_ADDRESS>
```

### SSL/TLS
- **Current**: Self-signed certificate for IP address
- **Certificate**: `/etc/ssl/certs/facnet.crt`
- **Private Key**: `/etc/ssl/private/facnet.key`
- **For Domain**: Use Let's Encrypt with certbot
- **Certbot Installed**: Ready for domain-based SSL setup

## Web Server (Nginx)

### Configuration
- **Config File**: `/etc/nginx/sites-available/facnet-validator`
- **Enabled**: Symlinked to `/etc/nginx/sites-enabled/`
- **Features**:
  - HTTP → HTTPS redirect
  - HTTP/2 enabled
  - Security headers
  - Gzip compression
  - File upload limit: 100MB
  - Proxy to Node.js app on port 5000

### Nginx Commands
```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# Check status
sudo systemctl status nginx

# View access logs
sudo tail -f /var/log/nginx/access.log

# View error logs
sudo tail -f /var/log/nginx/error.log
```

## Application Infrastructure

### Node.js Environment
- **Version**: Node.js 20.19.5 LTS
- **Package Manager**: npm 10.8.2
- **Global Packages**: PM2 (process manager)
- **Installation Source**: NodeSource repository

### PM2 Process Manager

#### Production Environment
```bash
# Start production application
cd /var/www/facnet/app
pm2 start ecosystem.config.cjs

# View production status
pm2 status facnet-validator

# View production logs
pm2 logs facnet-validator

# Restart production application
pm2 restart facnet-validator

# Check if production is responding
curl -k https://localhost/api/health
```

#### Production Deployment Troubleshooting

**Critical**: After GitHub Actions deployment, production may need manual intervention.

##### Issue 1: 502 Bad Gateway After Deployment

**Symptoms**: Production returns 502, staging works fine

**Diagnosis**:
```bash
# Check PM2 status
sudo -u facnet pm2 status facnet-validator

# If all processes show "stopped" status with 0 uptime:
```

**Root Cause**: GitHub Actions deployment script stops PM2 processes but sometimes fails to restart them.

**Solution**:
```bash
cd /var/www/facnet/app
sudo -u facnet pm2 restart ecosystem.config.cjs
sleep 3
curl -k https://localhost/api/health
# Should return: {"status":"healthy","timestamp":"..."}
```

##### Issue 2: "Cannot find package 'vite'" Error

**Symptoms**: PM2 logs show: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite'`

**Diagnosis**:
```bash
sudo -u facnet pm2 logs facnet-validator --err --lines 20
```

**Root Cause**: Production `npm install --production` excludes devDependencies, but the bundled server has runtime dependencies on Vite.

**Solution**:
```bash
cd /var/www/facnet/app
sudo -u facnet npm install  # Install ALL dependencies, not just production
sudo -u facnet pm2 restart ecosystem.config.cjs
```

**Why This Happens**: The esbuild bundler doesn't completely inline all Vite dependencies, leaving some runtime imports that need Vite to be present in `node_modules`.

##### Issue 3: Auth0 Domain "undefined" in Production

**Symptoms**: Login redirects to `https://undefined/authorize`

**Diagnosis**:
```bash
# Check if Auth0 domain is embedded in JavaScript bundle
cd /var/www/facnet/app/dist/public/assets
grep -o "dev-x63i3b6hf5kch7ab.ca.auth0.com" index-*.js
# No output = variables not embedded
```

**Root Cause**: `.env` file missing `VITE_AUTH0_AUDIENCE` or `vite.config.ts` missing `envDir` configuration.

**Solution**:
```bash
# 1. Verify .env has all VITE_* variables
cd /var/www/facnet/app
cat .env | grep VITE

# Should show:
# VITE_AUTH0_DOMAIN=dev-x63i3b6hf5kch7ab.ca.auth0.com
# VITE_AUTH0_CLIENT_ID=ECieaY4IiPbZNbWMoGJTPmD4pGsEi2rr
# VITE_AUTH0_AUDIENCE=facnet-validator-api
# VITE_API_BASE_URL=https://148.113.196.245/api

# 2. If missing, add them:
echo "VITE_AUTH0_AUDIENCE=facnet-validator-api" >> .env

# 3. Rebuild application (Vite embeds vars at build time)
sudo -u facnet npm run build

# 4. Restart PM2
sudo -u facnet pm2 restart ecosystem.config.cjs

# 5. Verify variables are now embedded
grep -o "dev-x63i3b6hf5kch7ab.ca.auth0.com" dist/public/assets/index-*.js
```

##### Production Health Check Checklist

After any deployment, verify:

```bash
# 1. PM2 processes running
sudo -u facnet pm2 status
# All facnet-validator instances should show "online"

# 2. Port 5000 listening
sudo ss -tlnp | grep ':5000'
# Should show node processes

# 3. API health endpoint
curl -k https://localhost/api/health
# {"status":"healthy","timestamp":"..."}

# 4. Frontend loads
curl -k https://148.113.196.245/ | grep -o '<title>[^<]*</title>'
# Should return page title

# 5. Auth0 domain embedded
curl -k https://148.113.196.245/ | grep -o 'src="/assets/index-[^"]*\.js"'
# Get JS filename
grep "dev-x63i3b6hf5kch7ab" /var/www/facnet/app/dist/public/assets/index-*.js
# Should find the domain

# 6. Database connection works
sudo -u facnet pm2 logs facnet-validator --lines 50 | grep -i "database\|postgres"
# Should not show authentication errors
```

#### Staging Environment
```bash
# Start staging application
cd /var/www/facnet/staging
pm2 start ecosystem.staging.js

# View staging status
pm2 status facnet-validator-staging

# View staging logs
pm2 logs facnet-validator-staging

# Restart staging application
pm2 restart facnet-validator-staging
```

#### General PM2 Commands
```bash
# View all processes
pm2 status

# Save current configuration
pm2 save

# Setup PM2 startup
pm2 startup

# Monitor all processes
pm2 monit
```

### Environment Variables Template
```bash
# Database
DATABASE_URL=postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator

# Auth0 Configuration
VITE_AUTH0_DOMAIN=dev-x63i3b6hf5kch7ab.ca.auth0.com
VITE_AUTH0_CLIENT_ID=ECieaY4IiPbZNbWMoGJTPmD4pGsEi2rr
AUTH0_CLIENT_SECRET=fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk
AUTH0_ISSUER_BASE_URL=https://dev-x63i3b6hf5kch7ab.ca.auth0.com
AUTH0_AUDIENCE=facnet-validator-api

# Production Settings
NODE_ENV=production
PORT=5000
VITE_API_BASE_URL=https://148.113.196.245/api
```

## Staging Environment

### Overview
**Purpose**: Safe testing environment for feature branches before production deployment
**Status**: ✅ Active (September 29, 2025)
**URL**: https://148.113.196.245:3001

### Configuration

#### Directory Structure
- **Location**: `/var/www/facnet/staging/`
- **Database**: `dashvalidator_staging` (isolated from production)
- **Configuration**: `ecosystem.staging.js`
- **Environment**: `.env.staging`

#### PM2 Configuration (`ecosystem.staging.js`)
```javascript
{
  name: 'facnet-validator-staging',
  script: 'server/index.ts',
  instances: 1,           // Single instance for easier debugging
  exec_mode: 'fork',      // Fork mode instead of cluster
  env: {
    NODE_ENV: 'staging',
    PORT: 3001,           // Different port from production
    DATABASE_URL: 'postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator_staging'
  }
}
```

#### Nginx Configuration
- **Config File**: `/etc/nginx/sites-available/facnet-validator-staging`
- **Port**: 3001 (HTTPS)
- **SSL**: Shared certificates with production
- **Document Root**: `/var/www/facnet/staging/dist/public`

### Branch Testing Workflow

#### 1. Deploy Feature Branch to Staging
```bash
# SSH to server
ssh ubuntu@148.113.196.245

# Navigate to staging directory
cd /var/www/facnet/staging

# Switch to feature branch
sudo -u facnet git fetch origin
sudo -u facnet git checkout feature/your-feature-name

# Install dependencies and build
sudo -u facnet npm install
sudo -u facnet npm run build

# Apply database changes (if any)
sudo -u facnet npm run db:push

# Restart staging application
sudo -u facnet pm2 restart facnet-validator-staging
```

#### 2. Test on Server Environment
```bash
# Access staging environment
# Visit: https://148.113.196.245:3001

# Monitor staging logs
sudo -u facnet pm2 logs facnet-validator-staging

# Check staging database
psql -h localhost -U dashvalidator_user -d dashvalidator_staging
```

#### 3. Production Deployment (if tests pass)
```bash
# Merge feature branch to main (locally or via GitHub PR)
git checkout main
git merge feature/your-feature-name
git push origin main

# GitHub Actions automatically deploys to production
```

### Database Management

#### Staging Database Commands
```bash
# Connect to staging database
psql -h localhost -U dashvalidator_user -d dashvalidator_staging

# Copy production data to staging (for realistic testing)
sudo -u postgres pg_dump dashvalidator | sudo -u postgres psql dashvalidator_staging

# Reset staging database to clean state
sudo -u postgres dropdb dashvalidator_staging
sudo -u postgres createdb dashvalidator_staging
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE dashvalidator_staging TO dashvalidator_user;"
cd /var/www/facnet/staging && sudo -u facnet npm run db:push
```

#### Data Isolation
- **Production**: Real Quebec healthcare data - **NEVER** modified during testing
- **Staging**: Copy of production data OR test data for safe experimentation
- **No Cross-Contamination**: Completely separate database schemas

### Monitoring & Troubleshooting

#### Check Staging Status
```bash
# PM2 process status
sudo -u facnet pm2 status facnet-validator-staging

# Application logs
sudo -u facnet pm2 logs facnet-validator-staging

# Nginx staging logs
sudo tail -f /var/log/nginx/access.log | grep :3001
sudo tail -f /var/log/nginx/error.log
```

#### Critical Troubleshooting: 502 Bad Gateway Errors

**IMPORTANT**: If staging returns 502 errors, the root cause is usually PM2 process configuration issues.

##### Architecture Understanding
- **Nginx (External)**: Listens on port **3001** (HTTPS)
- **Node App (Internal)**: Must run on port **3002**
- **Nginx Proxy**: Forwards `https://148.113.196.245:3001` → `http://localhost:3002`

##### Complete Staging Reset Procedure

When staging is broken with 502 errors, follow this complete reset:

```bash
# 1. SSH to server (use ubuntu, NOT root)
ssh ubuntu@148.113.196.245

# 2. Navigate to staging
cd /var/www/facnet/staging

# 3. Verify and update code
sudo -u facnet git fetch origin
sudo -u facnet git checkout feature/your-branch-name
sudo -u facnet git pull origin feature/your-branch-name

# 4. Rebuild application
sudo -u facnet npm install
sudo -u facnet npm run build

# 5. Delete any broken PM2 processes
sudo -u facnet pm2 delete facnet-validator-staging 2>/dev/null || true
sudo -u facnet pm2 delete ecosystem.staging 2>/dev/null || true

# 6. Start with DIRECT COMMAND (bypass ecosystem config)
# This is the most reliable method
sudo -u facnet PORT=3002 \
  NODE_ENV=staging \
  DATABASE_URL='postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator_staging' \
  AUTH0_ISSUER_BASE_URL='https://dev-x63i3b6hf5kch7ab.ca.auth0.com' \
  AUTH0_AUDIENCE='facnet-validator-api' \
  AUTH0_CLIENT_SECRET='fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk' \
  pm2 start dist/server/index.js --name facnet-validator-staging

# 7. Save PM2 configuration
sudo -u facnet pm2 save

# 8. Verify deployment
sudo ss -tlnp | grep ':3002'  # Should show node process
curl http://localhost:3002/api/health  # Should return JSON
curl -k https://localhost:3001/api/health  # Should return JSON through Nginx

# 9. If still failing, check logs
sudo -u facnet pm2 logs facnet-validator-staging --lines 100
```

##### Why ecosystem.staging.cjs Can Fail

**Problem**: `pm2 start ecosystem.staging.cjs` often fails because:
1. PM2 may execute the config file itself instead of the script it defines
2. Environment variables in the config may not load properly
3. Wrong process name gets created (e.g., "ecosystem.staging" instead of "facnet-validator-staging")

**Solution**: Always use direct script execution with inline environment variables.

##### Port Configuration Issues

**Wrong Configuration** (causes 502):
```bash
PORT=3001  # ❌ Conflicts with Nginx
pm2 start ecosystem.staging.cjs  # ❌ Unreliable
```

**Correct Configuration**:
```bash
PORT=3002  # ✅ Correct internal port
pm2 start dist/server/index.js --name facnet-validator-staging  # ✅ Direct script
```

##### Verification Checklist

After restarting staging, verify these points:

```bash
# 1. Check PM2 process is running
sudo -u facnet pm2 status
# Should show: facnet-validator-staging | online | fork

# 2. Check correct ports are listening
sudo ss -tlnp | grep -E ':(3001|3002)'
# Should show:
#   - nginx on 3001 (external access)
#   - node on 3002 (internal app)

# 3. Test internal app (port 3002)
curl http://localhost:3002/api/health
# Should return: {"status":"healthy","timestamp":"..."}

# 4. Test Nginx proxy (port 3001)
curl -k https://localhost:3001/api/health
# Should return: {"status":"healthy","timestamp":"..."}

# 5. Test external access
curl -k https://148.113.196.245:3001/api/health
# Should return: {"status":"healthy","timestamp":"..."}

# 6. Check PM2 logs for errors
sudo -u facnet pm2 logs facnet-validator-staging --lines 50
# Should show: "[express] serving on port 3002"
# Should NOT show: port conflicts, auth errors, or crashes
```

##### Common Mistakes to Avoid

1. ❌ **Using root for SSH**: `ssh root@148.113.196.245`
   - ✅ **Use ubuntu**: `ssh ubuntu@148.113.196.245`

2. ❌ **Wrong port**: `PORT=3001`
   - ✅ **Correct port**: `PORT=3002`

3. ❌ **Using ecosystem config**: `pm2 start ecosystem.staging.cjs`
   - ✅ **Direct script**: `pm2 start dist/server/index.js --name facnet-validator-staging`

4. ❌ **Not pulling code**: Git checkout without pull
   - ✅ **Always pull**: `git pull origin feature/branch-name`

5. ❌ **Skipping rebuild**: Restart PM2 without `npm run build`
   - ✅ **Always rebuild**: `npm run build` before PM2 restart

6. ❌ **Wrong user for operations**: Running commands as ubuntu or root
   - ✅ **Use facnet**: All PM2/npm commands must use `sudo -u facnet`

##### What We Learned (Incident Analysis)

**Date**: September 29-30, 2025
**Issue**: Staging environment returned 502 Bad Gateway errors
**Root Causes**:
1. Ecosystem config file had PORT=3001 (should be 3002)
2. PM2 was executing the config file itself, not the app script
3. Environment variables weren't loading from ecosystem config
4. Staging directory was on main branch instead of feature branch

**Resolution**: Use direct PM2 script execution with inline environment variables instead of ecosystem config file.

#### Other Common Issues
1. **Build failures**: Check Node.js dependencies and build logs
2. **SSL certificate issues**: Ensure shared certificates are accessible
3. **Database connection errors**: Verify staging database exists with correct permissions

### Benefits for Quebec Healthcare System

1. **Data Safety**: Test new validation rules without affecting production RAMQ data
2. **Server Environment Testing**: Verify features work with production PostgreSQL, Nginx, SSL
3. **Performance Testing**: Test CSV processing with production-sized Quebec healthcare files
4. **Integration Testing**: Verify Auth0 authentication works in server environment
5. **Compliance Testing**: Ensure new features meet Quebec healthcare regulatory requirements

## System Optimization

### Performance Tuning
- **File Descriptors**: Increased to 65,536 (configured in `/etc/security/limits.conf`)
- **Network Settings**: Optimized in `/etc/sysctl.d/99-saas-performance.conf`
- **Swap**: 4GB swap file at `/swapfile`
- **Swappiness**: Set to 10 (prefer RAM over swap)

### Key System Settings
```bash
# Check current file limits
ulimit -n

# View memory usage
free -h

# Check swap usage
swapon --show

# View system performance
htop
```

## Backup & Monitoring

### Automated Backups
- **Database Backups**: Daily via `/etc/cron.daily/postgres-backup`
- **Retention**: 7 days
- **Location**: `/var/www/facnet/backups/`
- **Format**: SQL dumps with timestamp

### Log Management
- **Log Rotation**: Configured via `/etc/logrotate.d/facnet`
- **Application Logs**: `/var/www/facnet/logs/`
- **Nginx Logs**: `/var/log/nginx/`
- **System Logs**: `/var/log/`

### Monitoring Tools
- **htop**: Interactive process viewer
- **tree**: Directory tree visualization
- **fail2ban**: Security monitoring
- **systemd**: Service monitoring

## Deployment Process

### Automated GitHub Actions Deployment (Current Method)
**Status**: ✅ Active and Tested (September 29, 2025)

The application is deployed automatically via GitHub Actions on every push to the main branch:

1. **Workflow File**: `.github/workflows/deploy.yml`
2. **Trigger**: Push to `main` branch or manual workflow dispatch
3. **Build Process**:
   - Checkout code
   - Setup Node.js 20
   - Install dependencies (`npm ci`)
   - Build application (`npm run build`)
4. **Deployment Process**:
   - SSH to VPS using GitHub Secrets
   - Pull latest changes from Git
   - Install production dependencies
   - Build application
   - Run database migrations (`npm run db:push`)
   - Restart PM2 with `ecosystem.config.js`
   - Verify deployment health

**GitHub Secrets Required**:
- `VPS_HOST`: 148.113.196.245
- `VPS_USER`: root
- `VPS_SSH_KEY`: Private SSH key for server access

**Last Successful Deployment**: Commit `9221ca0` - September 29, 2025

### GitHub Repository Setup
- **Repository**: https://github.com/montignypatrik/facnet-validator
- **Branch**: main
- **Deployment Key**: SSH key configured for automated access
- **Webhook**: Automatic trigger on push to main

### Manual Deployment (Backup Method)

#### Initial Deployment
1. Upload code to `/var/www/facnet/app/`
2. Set proper ownership: `sudo chown -R facnet:facnet /var/www/facnet/app/`
3. Install dependencies: `cd /var/www/facnet/app && npm install`
4. Build application: `npm run build`
5. Set up database schema: `npm run db:push`
6. Configure PM2: Create `ecosystem.config.js`
7. Start application: `pm2 start ecosystem.config.js`

#### Manual Application Updates
1. Stop application: `pm2 stop facnet-validator`
2. Upload new code
3. Install/update dependencies: `npm install`
4. Build application: `npm run build`
5. Run database migrations if needed
6. Restart application: `pm2 start facnet-validator`

## Security Considerations

### Access Control
- SSH key-based authentication only
- Dedicated service user with minimal privileges
- Database user with limited permissions
- Firewall restricting network access

### File Permissions
- Application files: `facnet:facnet` ownership
- Sensitive files: 600/640 permissions
- Public files: 644/755 permissions

### Environment Security
- Environment variables in secure files
- Database passwords stored in environment
- SSL certificates with proper permissions
- Regular security updates via unattended-upgrades

## Troubleshooting

### Common Commands
```bash
# Check service status
sudo systemctl status nginx postgresql fail2ban

# View system logs
journalctl -xe

# Check disk usage
df -h

# Check memory usage
free -h

# Check network connections
ss -tlnp

# Check running processes
ps aux

# Check system load
uptime
```

### Service Management
```bash
# Restart services
sudo systemctl restart nginx
sudo systemctl restart postgresql
sudo systemctl restart fail2ban

# Enable services on boot
sudo systemctl enable nginx postgresql fail2ban

# View service logs
journalctl -u nginx -f
journalctl -u postgresql -f
```

## Maintenance Tasks

### Weekly Tasks
- Check disk space usage
- Review log files for errors
- Verify backup integrity
- Check for security updates
- Monitor GitHub Actions deployment logs
- Verify application health endpoints

### Monthly Tasks
- Review fail2ban logs
- Update system packages
- Review and clean old log files
- Test backup restore process
- Review GitHub Actions workflow performance
- Test manual deployment procedure

### Security Updates
- Automatic security updates enabled via unattended-upgrades
- Kernel updates require manual reboot
- Application updates require manual deployment

## Future Enhancements

### Recommended Additions
- **Domain Name**: For proper SSL certificates via Let's Encrypt
- **Load Balancing**: For multiple application instances
- **Redis**: For session storage and caching
- **Monitoring**: External uptime monitoring service
- **Backup Verification**: Automated backup testing
- **Log Aggregation**: Centralized logging system

### Scaling Considerations
- **Database**: Consider read replicas for high traffic
- **Application**: PM2 cluster mode for multi-core utilization
- **Storage**: Separate file storage service for uploads
- **CDN**: Content delivery network for static assets

---

**Last Updated**: September 29, 2025
**Setup Completed By**: Claude Code Assistant
**GitHub Actions Deployment**: ✅ Active and Tested
**Documentation Version**: 1.1