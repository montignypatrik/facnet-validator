# Database Credentials Reference

## ⚠️ CRITICAL: Environment-Specific Passwords

This project uses **DIFFERENT database passwords** in different environments due to shell escaping issues with special characters on Linux.

## Local Development (Windows)

**Source of Truth**: `.env` file in project root (never committed to git)

```env
DATABASE_URL=postgresql://dashvalidator_user:<your-local-password>@localhost:5432/dashvalidator
```

**To access credentials:**
```bash
# Check your local .env file
cat .env | grep DATABASE_URL
```

**Database Information:**
- Database: `dashvalidator`
- User: `dashvalidator_user`
- Host: `localhost`
- Port: `5432`

**Notes:**
- Local password is set during initial PostgreSQL setup
- Never commit `.env` file to version control

## Production VPS (Ubuntu Linux)

**Source of Truth**: `/var/www/facnet/app/.env` on production server

**To access credentials (SSH required):**
```bash
ssh ubuntu@148.113.196.245
sudo -u facnet cat /var/www/facnet/app/.env | grep DATABASE_URL
```

**Database Information:**
- Database: `dashvalidator`
- User: `dashvalidator_user`
- Host: `localhost`
- Port: `5432`

**Notes:**
- Password has NO special characters to avoid bash escaping issues
- Used in: production, staging environments
- **NEVER document actual passwords in version control**

## Staging VPS (Ubuntu Linux)

**Source of Truth**: `/var/www/facnet/staging/.env` on production server

**To access credentials (SSH required):**
```bash
ssh ubuntu@148.113.196.245
sudo -u facnet cat /var/www/facnet/staging/.env | grep DATABASE_URL
```

**Database Information:**
- Database: `dashvalidator_staging`
- User: `dashvalidator_user`
- Host: `localhost`
- Port: `5432`

## Why Different Passwords?

Special characters (like `!`) can cause problems in Linux bash scripts:
- Shell history expansion
- Escaping issues in systemd, PM2, nginx configs
- Problems in deployment scripts

Therefore:
- **Windows local dev**: Can use any password in `.env`
- **Linux VPS**: Use passwords without special characters for easier script compatibility

## How to Connect

### Local Development

**Node.js app** (automatic):
```bash
npm run dev  # Uses .env DATABASE_URL automatically
```

**psql command-line** (Windows):
```bash
# Method 1: Set environment variable from .env
set PGPASSWORD=<your-password-from-env>
psql -h localhost -U dashvalidator_user -d dashvalidator

# Method 2: Use connection string from .env
psql "<paste-DATABASE_URL-from-env>"
```

### Production/Staging VPS

**SSH to server first:**
```bash
ssh ubuntu@148.113.196.245
```

**Then use psql:**
```bash
# Get password from .env first
PGPASSWORD=$(grep DATABASE_URL /var/www/facnet/app/.env | cut -d':' -f3 | cut -d'@' -f1) \
  psql -h localhost -U dashvalidator_user -d dashvalidator

# Or for staging:
PGPASSWORD=$(grep DATABASE_URL /var/www/facnet/staging/.env | cut -d':' -f3 | cut -d'@' -f1) \
  psql -h localhost -U dashvalidator_user -d dashvalidator_staging
```

## Troubleshooting

### "Password authentication failed"

**Verify the actual password from environment:**
```bash
# Local
cat .env | grep DATABASE_URL

# VPS Production
ssh ubuntu@148.113.196.245
sudo -u facnet cat /var/www/facnet/app/.env | grep DATABASE_URL

# VPS Staging
ssh ubuntu@148.113.196.245
sudo -u facnet cat /var/www/facnet/staging/.env | grep DATABASE_URL
```

### Documentation Conflicts

If you see conflicting passwords in documentation:
- **Always trust the `.env` file** in that specific environment
- This file (`DATABASE_CREDENTIALS.md`) is the authoritative reference
- Other docs may be outdated

## Security Notes

- Both passwords are stored in `.env` files (gitignored)
- Production `.env` is on the VPS only, not in git
- Never commit `.env` to version control
- Both users have full permissions on their respective databases

## Last Updated

2025-10-06 - Created to resolve recurring password confusion issues
