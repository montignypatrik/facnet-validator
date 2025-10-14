# Production Deployment Checklist

## After Every Deployment

Run these checks immediately after GitHub Actions deployment completes:

### 1. Verify PM2 Processes (30 seconds)

```bash
ssh ubuntu@148.113.196.245
sudo -u facnet pm2 status facnet-validator
```

**Expected Output:**
```
┌─────┬───────────────────────┬─────────┬─────────┬──────────┐
│ id  │ name                  │ status  │ restart │ uptime   │
├─────┼───────────────────────┼─────────┼─────────┼──────────┤
│ 0   │ facnet-validator      │ online  │ 0       │ 5s       │
│ 1   │ facnet-validator      │ online  │ 0       │ 5s       │
│ 2   │ facnet-validator      │ online  │ 0       │ 5s       │
│ 3   │ facnet-validator      │ online  │ 0       │ 5s       │
│ 4   │ facnet-validator      │ online  │ 0       │ 5s       │
│ 5   │ facnet-validator      │ online  │ 0       │ 5s       │
└─────┴───────────────────────┴─────────┴─────────┴──────────┘
```

✅ **All 6 processes should show "online" status**

❌ **If any show "stopped" or "errored":**
```bash
cd /var/www/facnet/app
sudo -u facnet pm2 logs facnet-validator --err --lines 50
sudo -u facnet pm2 reload ecosystem.config.cjs
```

### 2. Test Health Endpoint (5 seconds)

```bash
curl -f -k https://148.113.196.245/api/health
```

**Expected Output:**
```json
{"status":"healthy","timestamp":"2025-01-14T16:30:00.000Z"}
```

❌ **If 502 Bad Gateway:**
```bash
sudo -u facnet pm2 reload ecosystem.config.cjs
sleep 5
curl -f -k https://148.113.196.245/api/health
```

### 3. Verify Frontend Loads (10 seconds)

Open in browser: https://148.113.196.245

✅ **Page should load with Dash logo**
❌ **If blank or error, check PM2 logs:**
```bash
sudo -u facnet pm2 logs facnet-validator --lines 100
```

### 4. Test Authentication (20 seconds)

1. Click "Sign In" button
2. Should redirect to Auth0 (dev-x63i3b6hf5kch7ab.ca.auth0.com)
3. Login with test account
4. Should redirect back to dashboard

❌ **If redirects to "undefined/authorize":**
```bash
# Auth0 variables not embedded in build
cd /var/www/facnet/app
cat .env | grep VITE_AUTH0
# Verify all VITE_* variables exist, then rebuild:
sudo -u facnet npm run build
sudo -u facnet pm2 reload ecosystem.config.cjs
```

### 5. Test File Upload (30 seconds)

1. Navigate to Validator module
2. Upload a test CSV file
3. Verify validation runs

✅ **Validation should complete successfully**

---

## If Deployment Failed

### Scenario 1: GitHub Actions Failed

**Check workflow logs:**
https://github.com/montignypatrik/facnet-validator/actions

**Common causes:**
- npm install failed → Check package.json
- npm run build failed → Check TypeScript errors locally
- SSH connection failed → Check VPS status
- Disk space full → Free up space on server

### Scenario 2: Deployment Succeeded But App Not Running

**Diagnosis:**
```bash
ssh ubuntu@148.113.196.245

# 1. Check PM2 status
sudo -u facnet pm2 status

# 2. Check PM2 logs for errors
sudo -u facnet pm2 logs facnet-validator --err --lines 50

# 3. Check if port 5000 is listening
sudo ss -tlnp | grep ':5000'

# 4. Check Redis connection
redis-cli ping
# Should return: PONG

# 5. Check database connection
psql -U dashvalidator_user -d dashvalidator -h localhost -c "SELECT 1;"
```

**Common fixes:**

#### Missing Dependencies
```bash
cd /var/www/facnet/app
sudo -u facnet npm install  # Install ALL dependencies
sudo -u facnet pm2 reload ecosystem.config.cjs
```

#### Missing Environment Variables
```bash
cd /var/www/facnet/app
cat .env | grep -E 'DATABASE_URL|REDIS_URL|AUTH0'
# Compare with .env.production.example
# Add any missing variables, then:
sudo -u facnet pm2 reload ecosystem.config.cjs --update-env
```

#### Port Conflict
```bash
# Check what's using port 5000
sudo ss -tlnp | grep ':5000'

# If stuck processes exist:
sudo -u facnet pm2 delete facnet-validator
sudo -u facnet pm2 start ecosystem.config.cjs
```

### Scenario 3: Zero-Downtime Reload Failed

**Symptoms:** Some processes online, some stopped

**Fix:**
```bash
cd /var/www/facnet/app

# Force reload all processes
sudo -u facnet pm2 reload facnet-validator --force

# If that fails, restart (brief downtime)
sudo -u facnet pm2 restart facnet-validator

# Last resort: delete and recreate
sudo -u facnet pm2 delete facnet-validator
sudo -u facnet pm2 start ecosystem.config.cjs
sudo -u facnet pm2 save
```

---

## Manual Rollback Procedure

If the new deployment is broken and you need to revert:

```bash
ssh ubuntu@148.113.196.245
cd /var/www/facnet/app

# 1. Check recent commits
sudo -u facnet git log --oneline -n 10

# 2. Rollback to previous working commit
sudo -u facnet git reset --hard [COMMIT_HASH]

# 3. Reinstall dependencies (in case package.json changed)
sudo -u facnet npm ci

# 4. Rebuild application
sudo -u facnet npm run build

# 5. Reload PM2 with old code
sudo -u facnet pm2 reload ecosystem.config.cjs

# 6. Verify rollback worked
curl -f -k https://148.113.196.245/api/health
```

**⚠️ Important:** After manual rollback, the next push to `main` will re-deploy the broken version. **Fix the issue in git before pushing again.**

---

## Production Health Monitoring

### Quick Health Check (run anytime)

```bash
# One-liner health check
ssh ubuntu@148.113.196.245 "sudo -u facnet pm2 status && curl -s http://localhost:5000/api/health"
```

### View Live Logs

```bash
ssh ubuntu@148.113.196.245
sudo -u facnet pm2 logs facnet-validator
```

### Check Resource Usage

```bash
ssh ubuntu@148.113.196.245

# CPU and memory
htop

# Disk space
df -h

# PM2 monitoring
sudo -u facnet pm2 monit
```

---

## Zero-Downtime Deployment Explained

With the new deployment workflow:

1. **Old code running**: 6 PM2 processes serving requests
2. **GitHub Actions deploys**: Code pulled, dependencies installed, app built
3. **PM2 reload triggered**: `pm2 reload ecosystem.config.cjs`
4. **Rolling restart**:
   - Process 0 stops → Process 0 starts with new code
   - Process 1 stops → Process 1 starts with new code
   - ... (continues for all 6 processes)
5. **Result**: At least 5 processes always online, **zero downtime**

**Old workflow problems** (now fixed):
- ❌ `pm2 delete` → All processes stopped → **Complete downtime**
- ❌ `pm2 start` → Race conditions, port conflicts
- ✅ `pm2 reload` → One-by-one restart → **Zero downtime**

---

## Emergency Contacts

- **Production URL**: https://148.113.196.245
- **GitHub Actions**: https://github.com/montignypatrik/facnet-validator/actions
- **Server**: ubuntu@148.113.196.245
- **Documentation**: docs/operations/

**Last Updated**: January 2025
