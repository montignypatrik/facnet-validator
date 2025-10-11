# DBeaver Database Connections

Guide for connecting DBeaver to all Dash project databases (dev, staging, production).

---

## 📋 Quick Reference Table

| Environment | Host | Port | Database | User | Password | SSL Mode |
|-------------|------|------|----------|------|----------|----------|
| **Local Dev** | `localhost` | `5432` | `dashvalidator` | `dashvalidator_user` | `DashValidator2024` | Disable |
| **Staging** | `148.113.196.245` | `5432` | `dashvalidator_staging` | `dashvalidator_user` | `DashValidator2024` | Require |
| **Production** | `148.113.196.245` | `5432` | `dashvalidator` | `dashvalidator_user` | `DashValidator2024` | Require |

---

## 🔌 Connection 1: Local Development

### Connection Details
```
Name: Dash - Local Dev
Host: localhost
Port: 5432
Database: dashvalidator
User: dashvalidator_user
Password: DashValidator2024
```

### DBeaver Setup Steps

1. **Create New Connection**
   - Click "New Database Connection" (or `Ctrl+N`)
   - Select **PostgreSQL**
   - Click **Next**

2. **Main Tab**
   ```
   Host: localhost
   Port: 5432
   Database: dashvalidator
   Username: dashvalidator_user
   Password: DashValidator2024
   ```
   - ✅ Check "Save password"

3. **PostgreSQL Tab**
   - Show all databases: ✅ (optional)
   - Show template databases: ❌

4. **SSL Tab**
   ```
   SSL Mode: disable
   ```
   ⚠️ **Important**: Local dev uses `sslmode=disable`

5. **Connection Details Tab (Optional)**
   ```
   Connection name: Dash - Local Dev
   Connection type: Development
   Folder: Facnet Validator
   Color: Blue
   ```

6. **Test Connection**
   - Click "Test Connection"
   - Should see: "Connected (PostgreSQL 16.x)"
   - Click **Finish**

---

## 🔌 Connection 2: Staging Environment

### Connection Details
```
Name: Dash - Staging (VPS)
Host: 148.113.196.245
Port: 5432
Database: dashvalidator_staging
User: dashvalidator_user
Password: DashValidator2024
```

### DBeaver Setup Steps

1. **Create New Connection**
   - PostgreSQL → Next

2. **Main Tab**
   ```
   Host: 148.113.196.245
   Port: 5432
   Database: dashvalidator_staging
   Username: dashvalidator_user
   Password: DashValidator2024
   ```
   - ✅ Check "Save password"

3. **SSL Tab**
   ```
   SSL Mode: require
   ```
   ⚠️ **Important**: Remote connections require SSL

4. **SSH Tab** (Optional - if direct connection blocked)
   ```
   Use SSH Tunnel: ✅
   Host: 148.113.196.245
   Port: 22
   User: ubuntu
   Authentication Method: Public Key
   Private key: [Your SSH key path]
   ```

5. **Connection Details Tab**
   ```
   Connection name: Dash - Staging (VPS)
   Connection type: Test
   Folder: Facnet Validator
   Color: Orange
   ```

6. **Test Connection**
   - Click "Test Connection"
   - Should see: "Connected"
   - Click **Finish**

---

## 🔌 Connection 3: Production Environment

### Connection Details
```
Name: Dash - Production (VPS)
Host: 148.113.196.245
Port: 5432
Database: dashvalidator
User: dashvalidator_user
Password: DashValidator2024
```

### DBeaver Setup Steps

1. **Create New Connection**
   - PostgreSQL → Next

2. **Main Tab**
   ```
   Host: 148.113.196.245
   Port: 5432
   Database: dashvalidator
   Username: dashvalidator_user
   Password: DashValidator2024
   ```
   - ✅ Check "Save password"

3. **SSL Tab**
   ```
   SSL Mode: require
   ```

4. **SSH Tab** (Optional - if direct connection blocked)
   ```
   Use SSH Tunnel: ✅
   Host: 148.113.196.245
   Port: 22
   User: ubuntu
   Authentication Method: Public Key
   Private key: [Your SSH key path]
   ```

5. **Connection Details Tab**
   ```
   Connection name: Dash - Production (VPS)
   Connection type: Production
   Folder: Facnet Validator
   Color: Red
   ```

6. **⚠️ Enable "Confirm transactions" for safety**
   - Right-click connection → Edit Connection
   - Connection Details tab
   - ✅ Check "Confirm data changes" (CRITICAL for production!)

7. **Test Connection**
   - Click "Test Connection"
   - Should see: "Connected"
   - Click **Finish**

---

## 🔐 SSH Tunnel Setup (If Needed)

If you can't connect directly to the VPS (firewall blocking port 5432), use SSH tunnel.

### Prerequisites
```bash
# Test SSH access first
ssh ubuntu@148.113.196.245
```

### SSH Key Location
```
Windows: C:\Users\monti\.ssh\id_rsa
Linux/Mac: ~/.ssh/id_rsa
```

### DBeaver SSH Configuration
```
Host/IP: 148.113.196.245
Port: 22
User Name: ubuntu
Authentication Method: Public Key
Private Key: [Browse to your SSH key]
Passphrase: [If your key has one]
```

---

## 📊 Database Schema Overview

### Tables to Explore

**Core Tables:**
- `codes` - 6,740 RAMQ billing codes
- `contexts` - Context elements (G160, AR, etc.)
- `establishments` - Medical establishments
- `rules` - Validation rules configuration

**User Tables:**
- `users` - User accounts
- `user_roles` - Role assignments

**Validation Tables:**
- `validation_runs` - Validation execution history
- `validation_results` - Individual validation errors
- `billing_records` - Uploaded billing data

**Chatbot Tables** (disabled module):
- `conversations`
- `knowledge_base`

### Useful Queries

**Check active rules:**
```sql
SELECT rule_id, name, rule_type, severity, enabled
FROM rules
WHERE enabled = true
ORDER BY rule_id;
```

**Count records by table:**
```sql
SELECT
  'codes' as table_name, COUNT(*) as count FROM codes
UNION ALL SELECT 'contexts', COUNT(*) FROM contexts
UNION ALL SELECT 'establishments', COUNT(*) FROM establishments
UNION ALL SELECT 'rules', COUNT(*) FROM rules
UNION ALL SELECT 'users', COUNT(*) FROM users;
```

**Recent validation runs:**
```sql
SELECT
  id,
  created_at,
  user_id,
  file_name,
  total_records,
  status
FROM validation_runs
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🛡️ Safety Guidelines

### Local Development
✅ Safe to experiment
✅ Can drop/recreate tables
✅ Test queries freely

### Staging
⚠️ Be cautious
⚠️ Used for testing
⚠️ May contain important test data

### Production
🚨 **EXTREME CAUTION**
🚨 Always use transactions for updates
🚨 Back up before any changes
🚨 Test queries in staging first
🚨 Never delete data without backup

### DBeaver Safety Settings for Production

**Enable these settings:**
1. **Confirm data changes** ✅
   - Right-click connection → Edit → Connection Details
   - Check "Confirm data changes"

2. **Confirm execute script** ✅
   - Preferences → Editors → SQL Editor
   - Check "Confirm script execution"

3. **Enable smart commit** ✅
   - Preferences → Editors → SQL Editor → Transactions
   - Check "Smart auto commit"

4. **Read-only connection** (optional, very safe)
   - Right-click connection → Edit → Connection Details
   - Check "Read-only connection"

---

## 🔍 Troubleshooting

### Connection Refused

**Problem**: `Connection refused` error

**Solutions:**
1. Check if PostgreSQL is running
   ```bash
   # Local
   sc query postgresql-x64-16

   # VPS (via SSH)
   ssh ubuntu@148.113.196.245 "sudo systemctl status postgresql"
   ```

2. Check firewall allows port 5432
   ```bash
   # VPS
   ssh ubuntu@148.113.196.245 "sudo ufw status"
   ```

3. Use SSH tunnel if direct connection blocked

### Authentication Failed

**Problem**: `password authentication failed for user "dashvalidator_user"`

**Solutions:**
1. Verify password is exactly: `DashValidator2024`
2. Check username is: `dashvalidator_user` (with underscore!)
3. Verify database name:
   - Local: `dashvalidator`
   - Staging: `dashvalidator_staging`
   - Production: `dashvalidator`

### SSL Error

**Problem**: `SSL connection required`

**Solutions:**
1. For **local dev**: SSL Mode = `disable`
2. For **staging/prod**: SSL Mode = `require`
3. Check SSL tab in connection settings

### SSH Tunnel Issues

**Problem**: SSH authentication fails

**Solutions:**
1. Test SSH manually first:
   ```bash
   ssh ubuntu@148.113.196.245
   ```

2. Verify SSH key path in DBeaver is correct

3. Check SSH key permissions (Windows: properties, Linux: `chmod 600`)

4. Try password authentication instead of key

---

## 📝 Connection Import/Export

### Export Connections (Backup)

1. DBeaver → Database → Driver Manager
2. Click gear icon → Export
3. Save to: `docs/operations/dbeaver-connections.json`

### Import Connections (New Machine)

1. DBeaver → Database → Driver Manager
2. Click gear icon → Import
3. Select: `docs/operations/dbeaver-connections.json`

---

## 🎨 DBeaver Tips & Tricks

### Color Coding Connections
- **Blue**: Local Dev
- **Orange**: Staging
- **Red**: Production

### Keyboard Shortcuts
```
Ctrl+Enter      Execute query
Ctrl+Shift+E    Execute script
Ctrl+\          Format SQL
Ctrl+Space      Auto-complete
F4              Edit table/view
Ctrl+Tab        Switch between tabs
```

### SQL Editor Settings
```
Preferences → Editors → SQL Editor:
✅ Auto-save editor state
✅ Auto-complete
✅ Format SQL on save
✅ Show line numbers
```

### Useful Extensions
- **ERD (Entity Relationship Diagram)**: Right-click database → View Diagram
- **Data Transfer**: Right-click table → Export Data / Import Data
- **SQL Scripts**: Organize scripts by project folder

---

## 📚 Additional Resources

- [DATABASE_CREDENTIALS.md](./DATABASE_CREDENTIALS.md) - Password reference
- [SERVER_SETUP.md](./SERVER_SETUP.md) - VPS setup guide
- [DATABASE.md](../guides/DATABASE.md) - Schema documentation
- [DBeaver Documentation](https://dbeaver.io/docs/)

---

## ✅ Quick Checklist

Before connecting to production:
- [ ] Test connection to local dev first
- [ ] Test connection to staging second
- [ ] Enable "Confirm data changes" in production
- [ ] Consider read-only mode for browsing
- [ ] Have backup plan for any changes
- [ ] Test queries in staging before production

---

**Last Updated**: 2025-10-10
**Maintained By**: DevOps Team
