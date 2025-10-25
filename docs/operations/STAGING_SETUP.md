# Staging Environment Setup

This guide explains how to set up and deploy the staging environment for the Dash application.

## Overview

The staging environment allows testing features before deploying to production. It runs on the same server as production but on a different port (3001) with separate configuration.

**Key Differences from Production:**
- Port: 3001 (vs 5000 for production)
- Process: Single instance (vs clustered for production)
- Database: `dashvalidator_staging` (separate database)
- Execution: Fork mode for easier debugging (vs cluster mode)
- Memory: 512MB limit (vs 1GB for production)

## Prerequisites

- SSH access to production server (148.113.196.245)
- `facnet` user access
- PostgreSQL database `dashvalidator_staging` created
- Redis running on server

## Initial Setup

### 1. Create Staging Database

```bash
ssh ubuntu@148.113.196.245
sudo -u postgres psql

CREATE DATABASE dashvalidator_staging;
GRANT ALL PRIVILEGES ON DATABASE dashvalidator_staging TO dashvalidator_user;
```

### 2. Create `.env.staging` File

SSH to the server and create the staging environment file:

```bash
ssh ubuntu@148.113.196.245
sudo -u facnet bash
cd /var/www/facnet/app
nano .env.staging
```

Add the following configuration (replace credentials as needed):

```bash
# Environment
NODE_ENV=staging
PORT=3001

# Database (Staging)
DATABASE_URL=postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator_staging?sslmode=disable

# Redis
REDIS_URL=redis://localhost:6379

# Auth0 (Development)
AUTH0_ISSUER_BASE_URL=https://dev-x63i3b6hf5kch7ab.ca.auth0.com
AUTH0_AUDIENCE=facnet-validator-api
AUTH0_CLIENT_SECRET=fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk

# Security
PHI_REDACTION_SALT=99396260a8d4111225c83d71a260fcdaed678481cd868fe0e35b1969dc273f1b
```

**Important:** The `.env.staging` file is NOT committed to version control (see `.gitignore`).

### 3. Set File Permissions

```bash
chmod 600 .env.staging
chown facnet:facnet .env.staging
```

## Deployment

### Manual Deployment

```bash
ssh ubuntu@148.113.196.245
sudo -u facnet bash
cd /var/www/facnet/app

# Pull latest code
git fetch origin
git checkout <branch-name>  # e.g., feature/new-validation-rule

# Install dependencies
npm ci

# Build application
npm run build

# Run database migrations
npm run db:push

# Start/Restart staging environment
pm2 restart ecosystem.staging.cjs
# OR if not running:
pm2 start ecosystem.staging.cjs

# Save PM2 configuration
pm2 save
```

### Verify Deployment

```bash
# Check PM2 status
pm2 status facnet-validator-staging

# View logs
pm2 logs facnet-validator-staging --lines 50

# Test health endpoint
curl http://localhost:3001/api/health

# Check which port is running
pm2 describe facnet-validator-staging | grep PORT
```

## Common Operations

### View Logs

```bash
# Real-time logs
pm2 logs facnet-validator-staging

# Last 100 lines
pm2 logs facnet-validator-staging --lines 100

# Error logs only
pm2 logs facnet-validator-staging --err

# Log files location
tail -f /var/www/facnet/logs/staging-*.log
```

### Stop Staging

```bash
pm2 stop facnet-validator-staging
pm2 delete facnet-validator-staging
```

### Restart Staging

```bash
pm2 restart facnet-validator-staging
```

### Access Staging from Browser

The staging environment is accessible at:
```
https://148.113.196.245:3001
```

**Note:** You may need to configure Nginx to proxy this port if not already done.

## Nginx Configuration (Optional)

To access staging via a subdomain (e.g., `staging.yourdomain.com`):

```nginx
server {
    listen 443 ssl;
    server_name staging.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 3001
sudo lsof -i :3001

# Or with netstat
netstat -tulpn | grep :3001

# Kill the process if needed
kill -9 <PID>
```

### Database Connection Issues

```bash
# Test database connection
psql postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator_staging

# Check if database exists
sudo -u postgres psql -l | grep dashvalidator_staging
```

### PM2 Not Loading Environment Variables

```bash
# Verify .env.staging exists and is readable
ls -la .env.staging

# Check PM2 environment
pm2 describe facnet-validator-staging | grep -A 20 "env:"

# Restart with explicit env file
pm2 delete facnet-validator-staging
pm2 start ecosystem.staging.cjs
```

### Build Failures

```bash
# Clean and rebuild
rm -rf dist/ node_modules/
npm install
npm run build
```

## Security Notes

- **Never commit** `.env.staging` to version control
- Staging credentials should be different from production
- Staging database should contain synthetic/test data only
- PHI_REDACTION_SALT should be unique for staging
- Consider using separate Auth0 tenant for staging

## Migration from Production

If you need to test with production-like data:

```bash
# Dump production data (sanitize PHI first!)
pg_dump -U dashvalidator_user dashvalidator > prod_backup.sql

# Restore to staging (CAUTION: Contains PHI if not sanitized)
psql -U dashvalidator_user dashvalidator_staging < prod_backup.sql
```

**⚠️ WARNING:** Never restore production data containing PHI to staging without proper sanitization.

## See Also

- [Deployment Guide](DEPLOYMENT.md)
- [Server Setup](SERVER_SETUP.md)
- [Database Credentials](DATABASE_CREDENTIALS.md)
