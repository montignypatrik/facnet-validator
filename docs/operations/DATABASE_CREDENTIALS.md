# Database Credentials Reference

## ⚠️ CRITICAL: Environment-Specific Passwords

This project uses **DIFFERENT database passwords** in different environments due to shell escaping issues with special characters on Linux.

## Local Development (Windows)

**Source of Truth**: `.env` file in project root

```env
DATABASE_URL=postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator
```

**Credentials:**
- Database: `dashvalidator`
- User: `dashvalidator_user`
- Password: `dashvalidator123!`
- Host: `localhost`
- Port: `5432`

**Notes:**
- Password contains `!` character - works fine in `.env` on Windows
- For `psql` command-line access on Windows, the `!` may need escaping in some shells

## Production VPS (Ubuntu Linux)

**Source of Truth**: `/var/www/facnet/app/.env` on production server

```env
DATABASE_URL=postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator
```

**Credentials:**
- Database: `dashvalidator`
- User: `dashvalidator_user`
- Password: `DashValidator2024`
- Host: `localhost`
- Port: `5432`

**Notes:**
- Password has NO special characters to avoid bash escaping issues
- Used in: production, staging environments
- Documented in: `SERVER_SETUP.md`, `CLAUDE.md`

## Staging VPS (Ubuntu Linux)

**Source of Truth**: `/var/www/facnet/staging/.env` on production server

```env
DATABASE_URL=postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator_staging
```

**Credentials:**
- Database: `dashvalidator_staging`
- User: `dashvalidator_user`
- Password: `DashValidator2024`
- Host: `localhost`
- Port: `5432`

## Why Different Passwords?

The `!` character in `dashvalidator123!` causes problems in Linux bash scripts:
- Shell history expansion
- Escaping issues in systemd, PM2, nginx configs
- Problems in deployment scripts

Therefore:
- **Windows local dev**: Uses `dashvalidator123!` (works fine in .env)
- **Linux VPS**: Uses `DashValidator2024` (no special chars)

## How to Connect

### Local Development

**Node.js app** (automatic):
```bash
npm run dev  # Uses .env DATABASE_URL automatically
```

**psql command-line** (Windows):
```bash
# Method 1: Set environment variable
set PGPASSWORD=dashvalidator123!
psql -h localhost -U dashvalidator_user -d dashvalidator

# Method 2: Connection string
psql "postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator"
```

### Production/Staging VPS

**SSH to server first:**
```bash
ssh ubuntu@148.113.196.245
```

**Then use psql:**
```bash
PGPASSWORD=DashValidator2024 psql -h localhost -U dashvalidator_user -d dashvalidator

# Or for staging:
PGPASSWORD=DashValidator2024 psql -h localhost -U dashvalidator_user -d dashvalidator_staging
```

## Troubleshooting

### "Password authentication failed"

**Check which environment you're in:**
1. Local Windows → use `dashvalidator123!`
2. VPS Linux → use `DashValidator2024`

**Verify the actual password:**
```bash
# Local
cat .env | grep DATABASE_URL

# VPS
ssh ubuntu@148.113.196.245
cat /var/www/facnet/app/.env | grep DATABASE_URL
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
