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
- **Database Name**: `dashvalidator`
- **Database User**: `dashvalidator_user`
- **Database Password**: `dashvalidator123!`
- **Permissions**: Full access to `dashvalidator` database and `public` schema
- **Connection String**: `postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator`

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
├── app/                  # Application code deployment
├── logs/                 # Application logs
├── backups/              # Database backups (automated)
└── uploads/              # File uploads storage

/var/www/html/            # Default Nginx document root
/etc/nginx/sites-available/facnet-validator  # Nginx configuration
/etc/ssl/certs/facnet.crt    # SSL certificate
/etc/ssl/private/facnet.key  # SSL private key
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
```bash
# Start application
pm2 start ecosystem.config.js

# View status
pm2 status

# View logs
pm2 logs facnet-validator

# Restart application
pm2 restart facnet-validator

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup
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

### Initial Deployment
1. Upload code to `/var/www/facnet/app/`
2. Set proper ownership: `sudo chown -R facnet:facnet /var/www/facnet/app/`
3. Install dependencies: `cd /var/www/facnet/app && npm install`
4. Build application: `npm run build`
5. Set up database schema: `npm run db:push`
6. Configure PM2: Create `ecosystem.config.js`
7. Start application: `pm2 start ecosystem.config.js`

### Application Updates
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

### Monthly Tasks
- Review fail2ban logs
- Update system packages
- Review and clean old log files
- Test backup restore process

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
**Documentation Version**: 1.0