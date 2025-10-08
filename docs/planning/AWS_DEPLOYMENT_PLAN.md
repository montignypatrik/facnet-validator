# AWS Deployment Plan for Dash Healthcare Validator

> **⚠️ PLANNING DOCUMENT**
>
> This document contains future plans and analysis for AWS migration. The information represents proposed architecture and is **not yet implemented**. Current production environment uses OVH VPS (see [Server Setup](../operations/SERVER_SETUP.md)).
>
> **Status**: Planning Phase
> **Last Updated**: October 2025

---

## Executive Summary

Deploy the Quebec healthcare billing validator from OVH VPS to AWS with HIPAA-compliant architecture, high availability, and auto-scaling. Estimated cost: **$540/month** (base), timeline: **4-5 weeks**.

---

## 1. Current Architecture Analysis

**Existing Setup (OVH VPS):**
- Ubuntu 24.04 LTS on single VPS (148.113.196.245)
- Node.js/Express API + React frontend (Vite)
- PostgreSQL 16 (dashvalidator database)
- Redis (caching + BullMQ queues)
- PM2 clustering (6 instances)
- Nginx reverse proxy with SSL
- Auth0 authentication
- Handles PHI (Protected Health Information) - **CRITICAL for compliance**

---

## 2. Proposed AWS Architecture

### **Region:** ca-central-1 (Canada - Quebec compliance)

### **Components:**
1. **VPC** (10.0.0.0/16)
   - Public subnets (2 AZs): ALB, NAT Gateway
   - Private subnets (2 AZs): EC2 application instances
   - Database subnets (2 AZs): RDS PostgreSQL
   - Cache subnets (2 AZs): ElastiCache Redis

2. **Compute:** EC2 Auto Scaling Group
   - Instance Type: t3.medium (2 vCPU, 4GB RAM)
   - Min: 2 instances, Max: 6 instances (multi-AZ)
   - AMI: Ubuntu 24.04 LTS
   - PM2 clustering within each instance

3. **Database:** RDS PostgreSQL 16
   - Instance: db.t3.medium (Multi-AZ)
   - Storage: 100GB GP3 SSD (encrypted)
   - Automated backups: 7-day retention

4. **Cache:** ElastiCache Redis
   - Node Type: cache.t3.medium
   - Cluster mode: Disabled (with 1 replica)
   - Encryption: At-rest and in-transit

5. **Storage:** S3 Buckets
   - `facnet-validator-uploads-prod` (CSV files)
   - `facnet-validator-backups-prod` (database backups)
   - Server-side encryption enabled

6. **Load Balancer:** Application Load Balancer (ALB)
   - HTTPS (443) listener with ACM certificate
   - HTTP (80) → HTTPS redirect
   - Health checks: GET /api/health

7. **DNS:** Route 53 (optional, for custom domain)

8. **Security:** IAM roles, Security Groups, Secrets Manager

---

## 3. External Services Configuration

### **3.1 Auth0 (Already Configured) ✅**

**Current Configuration:**
- Domain: `dev-x63i3b6hf5kch7ab.ca.auth0.com`
- Client ID: `ECieaY4IiPbZNbWMoGJTPmD4pGsEi2rr`
- Client Secret: `fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk`
- Audience: `facnet-validator-api`

**⚠️ ACTION REQUIRED:**
1. Log in to Auth0 dashboard
2. Update "Allowed Callback URLs" to include:
   - `https://your-aws-domain.com/callback`
   - `https://alb-dns-name.ca-central-1.elb.amazonaws.com/callback`
3. Update "Allowed Logout URLs" similarly
4. Update "Allowed Web Origins" for CORS

---

### **3.2 GitHub (For CI/CD)**

**Repository:** https://github.com/montignypatrik/facnet-validator

**⚠️ SECRETS TO ADD (GitHub Repository → Settings → Secrets):**

```bash
AWS_ACCESS_KEY_ID=AKIA...              # From IAM user
AWS_SECRET_ACCESS_KEY=...              # From IAM user
AWS_REGION=ca-central-1
AWS_ACCOUNT_ID=123456789012            # Your 12-digit AWS account ID

# Database (will be generated during RDS setup)
RDS_DATABASE_URL=postgresql://dashvalidator_app:PASSWORD@rds-endpoint.ca-central-1.rds.amazonaws.com:5432/dashvalidator?sslmode=require

# Redis (will be generated during ElastiCache setup)
REDIS_URL=rediss://:AUTH_TOKEN@elasticache-endpoint.cache.amazonaws.com:6379

# S3 Bucket
S3_BUCKET_NAME=facnet-validator-uploads-prod-ACCOUNT_ID

# Auth0 (existing)
AUTH0_CLIENT_SECRET=fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk
AUTH0_ISSUER_BASE_URL=https://dev-x63i3b6hf5kch7ab.ca.auth0.com
AUTH0_AUDIENCE=facnet-validator-api

# PHI Security
PHI_REDACTION_SALT=99396260a8d4111225c83d71a260fcdaed678481cd868fe0e35b1969dc273f1b
```

---

### **3.3 Sentry (Optional - Error Tracking)**

**If Enabling:**
1. Create account at sentry.io
2. Create new project: "Dash Validator"
3. Copy DSN (looks like: `https://abc123@o123.ingest.sentry.io/456`)
4. Add to GitHub Secrets:
   ```bash
   SENTRY_DSN=https://...@sentry.io/...
   SENTRY_ENVIRONMENT=production
   SENTRY_TRACES_SAMPLE_RATE=0.1
   ```

---

### **3.4 Ollama AI Service**

**Current:** External server at `http://148.113.196.245:11434`

**⚠️ DECISION NEEDED:**
- **Option A:** Keep external Ollama server (add to EC2 security group)
- **Option B:** Deploy Ollama on AWS EC2 instance (t3.large or g4dn.xlarge for GPU)
- **Option C:** Use AWS Bedrock (managed AI service, ~$0.001/1K tokens)

**Recommendation:** Option A (simplest) or Option C (most scalable)

---

## 4. AWS Account Setup & Credentials

### **4.1 AWS Account Requirements**

**⚠️ PRE-MIGRATION CHECKLIST:**

1. **Create/Access AWS Account**
   - AWS Account ID: _________________ (12-digit number)
   - Root email: _____________________
   - **Enable MFA on root account** ✓

2. **Sign AWS Business Associate Agreement (BAA)**
   - Required for HIPAA compliance
   - Contact AWS Support to enable HIPAA-eligible services
   - Document: Download BAA from AWS Artifact

3. **Create IAM User for Deployment**
   ```bash
   Username: facnet-deployer
   Access Type: Programmatic access
   Policies:
   - AmazonEC2FullAccess
   - AmazonRDSFullAccess
   - AmazonElastiCacheFullAccess
   - AmazonS3FullAccess
   - AmazonVPCFullAccess
   - IAMFullAccess
   - SecretsManagerReadWrite
   - AWSCodeDeployFullAccess
   ```

   **Generated Credentials:**
   - AWS_ACCESS_KEY_ID: _______________
   - AWS_SECRET_ACCESS_KEY: _______________

4. **Create EC2 Key Pair**
   ```bash
   Name: facnet-validator-prod
   Download: facnet-validator-prod.pem
   ```
   **Store securely** (needed for SSH access to EC2 instances)

5. **Generate Strong Passwords (20+ characters)**
   ```bash
   RDS Master Password: _______________
   RDS App User Password: _______________
   ElastiCache AUTH Token: _______________
   ```

6. **SSL Certificate**
   - **Option A:** Request free certificate from AWS Certificate Manager
     - Domain: _____________ (e.g., dash-validator.com)
     - Validation: DNS or email
   - **Option B:** Import existing certificate
     - Need: certificate.crt, private.key, ca-bundle.crt

7. **Domain Name (Optional)**
   - Purchase via Route 53 or use existing
   - Domain: _____________

---

## 5. Code Changes Required

### **Files to Create/Modify:**

1. **S3 File Upload Service** (`server/storage/s3Service.ts`)
   - Replace local filesystem with S3
   - Install: `@aws-sdk/client-s3`, `multer-s3`

2. **Database Connection** (`server/storage.ts`)
   - Update for RDS endpoint with SSL
   - Download RDS CA certificate

3. **Redis Connection** (`server/queue/redis.ts`)
   - Update for ElastiCache with AUTH token
   - Enable TLS

4. **Session Storage** (`server/index.ts`)
   - Switch from memorystore to `connect-redis`
   - Required for multi-instance deployment

5. **Secrets Manager Client** (`server/config/secrets.ts`)
   - Fetch secrets from AWS Secrets Manager on startup

6. **Health Check** (`server/routes.ts`)
   - Enhance to check S3, RDS, Redis connectivity

7. **Environment Variables** (`.env.production`)
   - Update all connection strings for AWS services

8. **GitHub Actions Workflow** (`.github/workflows/deploy-aws.yml`)
   - Replace SSH deployment with AWS CodeDeploy

---

## 6. Migration Strategy (4-5 Weeks)

### **Phase 1: AWS Infrastructure (Week 1-2)**
- Create VPC, subnets, security groups
- Deploy RDS PostgreSQL Multi-AZ
- Deploy ElastiCache Redis cluster
- Create S3 buckets with encryption
- Set up Application Load Balancer
- Configure Route 53 (if custom domain)
- Request/import SSL certificate
- Create IAM roles and policies

### **Phase 2: Code Preparation (Week 2)**
- Create branch: `feature/aws-migration`
- Implement S3 file upload service
- Update database/Redis connections
- Add Secrets Manager integration
- Update session storage to Redis
- Test locally with AWS dev environment

### **Phase 3: Staging Environment (Week 3)**
- Deploy to AWS staging environment
- Run full test suite
- Load testing with sample data
- Security audit
- PHI compliance verification

### **Phase 4: Data Migration (1-2 days)**
- Export PostgreSQL: `pg_dump dashvalidator`
- Import to RDS: `pg_restore`
- Verify data integrity (6,740 codes, contexts, establishments)
- Test validation rules

### **Phase 5: Production Cutover (4-8 hours, scheduled)**
- Announce maintenance window
- Final database sync
- Update Auth0 callback URLs
- Update DNS (TTL to 60 seconds beforehand)
- Deploy to AWS production
- Monitor health checks
- Keep OVH as backup for 1 week

### **Phase 6: Post-Migration (Week 4-5)**
- Monitor CloudWatch metrics
- Optimize auto-scaling policies
- Fine-tune RDS performance
- Document infrastructure
- Decommission OVH VPS

---

## 7. Cost Estimate (Monthly, ca-central-1)

| Service | Configuration | Cost/Month |
|---------|---------------|------------|
| EC2 (2x t3.medium) | Base instances | $120 |
| EC2 Auto Scaling | Peak (4 instances) | +$120 peak |
| RDS PostgreSQL | db.t3.medium Multi-AZ | $140 |
| RDS Storage | 100GB GP3 + backups | $33 |
| ElastiCache Redis | cache.t3.medium + replica | $100 |
| ALB | Base + LCU | $33 |
| S3 | Uploads + backups | $10 |
| NAT Gateway | 2 AZs for HA | $64 |
| Data Transfer | 100GB/month | $20 |
| CloudWatch | Logs + metrics | $15 |
| Secrets Manager | 5 secrets | $2 |
| ACM Certificate | SSL/TLS | Free |
| **TOTAL (Base)** | **2 instances** | **~$540/month** |
| **TOTAL (Peak)** | **4 instances** | **~$660/month** |

**Cost Optimization:**
- Reserved Instances (1-year): Save 30% (~$160/month)
- Spot Instances (non-critical): Save 50-70%
- Current OVH cost: ~$50-100/month
- **AWS Premium:** ~$440/month for HA, managed services, HIPAA compliance

---

## 8. Security & Compliance

### **HIPAA Requirements:**
- ✅ AWS Business Associate Agreement signed
- ✅ Encryption at rest (KMS) for EBS, RDS, ElastiCache, S3
- ✅ Encryption in transit (TLS 1.2+) for all connections
- ✅ Private subnets for application and database
- ✅ CloudTrail audit logs (90-day retention)
- ✅ VPC Flow Logs enabled
- ✅ IAM least privilege access
- ✅ Secrets Manager for credentials (no hardcoded secrets)

### **Security Best Practices:**
- Multi-AZ deployment for high availability
- Automated backups (RDS: 7 days, manual snapshots: indefinite)
- Security Groups (stateful firewall)
- AWS Systems Manager Session Manager (no SSH keys in network)
- CloudWatch monitoring and alarms
- Regular security patches via Auto Scaling rolling updates

---

## 9. Monitoring & Alerting

### **CloudWatch Alarms (SNS → Email):**
- EC2 CPU >80% for 5 minutes
- RDS connections >80% of max
- RDS free storage <10GB
- ALB HTTP 5xx errors >1%
- ElastiCache cache hit rate <80%
- Validation queue length >100 jobs

### **CloudWatch Dashboards:**
- Application health (latency, errors, throughput)
- Database performance (connections, queries, disk I/O)
- Infrastructure metrics (CPU, memory, network)

---

## 10. Disaster Recovery

**RTO (Recovery Time):** 4 hours
**RPO (Recovery Point):** 5 minutes

**Scenarios:**
- Single AZ failure: Auto-failover (1-2 min)
- Complete region failure: Manual restore to DR region (2-4 hours)
- Data corruption: Point-in-time recovery

---

## 11. Detailed AWS Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                 │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
                      ┌───────────▼────────────┐
                      │   Route 53 (DNS)       │
                      └───────────┬────────────┘
                                  │
┌─────────────────────────────────▼─────────────────────────────────┐
│                           VPC (10.0.0.0/16)                        │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              Public Subnets (2 AZs)                          │ │
│  │                                                              │ │
│  │  ┌────────────────────────────────────────────────┐         │ │
│  │  │  Application Load Balancer (ALB)               │         │ │
│  │  │  - HTTPS (443) with ACM certificate            │         │ │
│  │  │  - Health checks: /api/health                  │         │ │
│  │  └─────────────────┬──────────────────────────────┘         │ │
│  │                    │                                         │ │
│  │         ┌──────────┴────────────┐                           │ │
│  │         │                       │                           │ │
│  └─────────┼───────────────────────┼───────────────────────────┘ │
│            │                       │                             │
│  ┌─────────▼───────────────────────▼───────────────────────────┐ │
│  │           Private Subnets (2 AZs)                           │ │
│  │                                                             │ │
│  │  ┌──────────────────┐      ┌──────────────────┐           │ │
│  │  │  EC2 Instance 1  │      │  EC2 Instance 2  │           │ │
│  │  │  (t3.medium)     │      │  (t3.medium)     │           │ │
│  │  │  - Node.js/PM2   │      │  - Node.js/PM2   │           │ │
│  │  │  - Auto Scaling  │      │  - Auto Scaling  │           │ │
│  │  └────────┬─────────┘      └────────┬─────────┘           │ │
│  │           │                         │                     │ │
│  │           └──────────┬──────────────┘                     │ │
│  └──────────────────────┼────────────────────────────────────┘ │
│                         │                                       │
│  ┌──────────────────────┼────────────────────────────────────┐ │
│  │       Database Subnets (2 AZs)                            │ │
│  │                      │                                    │ │
│  │  ┌───────────────────▼────────────────────┐              │ │
│  │  │  RDS PostgreSQL 16 (Multi-AZ)          │              │ │
│  │  │  - db.t3.medium                        │              │ │
│  │  │  - 100GB GP3 SSD (encrypted)           │              │ │
│  │  │  - Automated backups: 7 days           │              │ │
│  │  └────────────────────────────────────────┘              │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │       ElastiCache Subnets (2 AZs)                        │   │
│  │                                                          │   │
│  │  ┌───────────────────────────────────────┐              │   │
│  │  │  ElastiCache Redis (Cluster)          │              │   │
│  │  │  - cache.t3.medium                    │              │   │
│  │  │  - 1 replica (Multi-AZ)               │              │   │
│  │  │  - Encryption at-rest & in-transit    │              │   │
│  │  └───────────────────────────────────────┘              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

External Services:
┌────────────────────────────────────────────────────────────────┐
│  - S3 Buckets (uploads, backups) - encrypted                   │
│  - CloudWatch (logs, metrics, alarms)                          │
│  - Secrets Manager (credentials)                               │
│  - AWS Certificate Manager (SSL/TLS)                           │
│  - Auth0 (authentication) - dev-x63i3b6hf5kch7ab.ca.auth0.com  │
│  - GitHub Actions (CI/CD)                                      │
└────────────────────────────────────────────────────────────────┘
```

---

## 12. Network Security Architecture

### **Security Groups (Firewall Rules):**

**ALB Security Group:**
```
Inbound:
- Port 443 (HTTPS) from 0.0.0.0/0
- Port 80 (HTTP) from 0.0.0.0/0

Outbound:
- Port 5000 to EC2 Security Group
```

**EC2 Security Group:**
```
Inbound:
- Port 5000 from ALB Security Group
- Port 22 from Bastion/Session Manager (admin access)

Outbound:
- Port 5432 to RDS Security Group
- Port 6379 to ElastiCache Security Group
- Port 443 to 0.0.0.0/0 (for Auth0, GitHub, external APIs)
```

**RDS Security Group:**
```
Inbound:
- Port 5432 from EC2 Security Group
- Port 5432 from Bastion (admin access)

Outbound:
- None required
```

**ElastiCache Security Group:**
```
Inbound:
- Port 6379 from EC2 Security Group

Outbound:
- None required
```

---

## 13. IAM Roles and Policies

### **EC2 Instance Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::facnet-validator-uploads-prod/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:ca-central-1:ACCOUNT_ID:secret:facnet/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

### **CodeDeploy Service Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "autoscaling:*",
        "elasticloadbalancing:*",
        "s3:GetObject"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 14. Secrets Management Strategy

### **AWS Secrets Manager Secrets:**

1. **facnet/database/rds**
   ```json
   {
     "username": "dashvalidator_app",
     "password": "GENERATED_PASSWORD",
     "engine": "postgres",
     "host": "rds-endpoint.ca-central-1.rds.amazonaws.com",
     "port": 5432,
     "dbname": "dashvalidator"
   }
   ```

2. **facnet/redis/elasticache**
   ```json
   {
     "host": "elasticache-endpoint.cache.amazonaws.com",
     "port": 6379,
     "auth_token": "GENERATED_AUTH_TOKEN",
     "tls": true
   }
   ```

3. **facnet/auth0/credentials**
   ```json
   {
     "domain": "dev-x63i3b6hf5kch7ab.ca.auth0.com",
     "client_id": "ECieaY4IiPbZNbWMoGJTPmD4pGsEi2rr",
     "client_secret": "fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk",
     "audience": "facnet-validator-api"
   }
   ```

4. **facnet/phi/redaction-salt**
   ```json
   {
     "salt": "99396260a8d4111225c83d71a260fcdaed678481cd868fe0e35b1969dc273f1b"
   }
   ```

5. **facnet/s3/bucket-name**
   ```json
   {
     "uploads_bucket": "facnet-validator-uploads-prod-ACCOUNT_ID",
     "backups_bucket": "facnet-validator-backups-prod-ACCOUNT_ID"
   }
   ```

---

## 15. GitHub Actions CI/CD Workflow

### **New Workflow File:** `.github/workflows/deploy-aws.yml`

```yaml
name: Deploy to AWS

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  deploy:
    name: Deploy to AWS Production
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          VITE_AUTH0_DOMAIN: ${{ secrets.VITE_AUTH0_DOMAIN }}
          VITE_AUTH0_CLIENT_ID: ${{ secrets.VITE_AUTH0_CLIENT_ID }}
          VITE_AUTH0_AUDIENCE: ${{ secrets.VITE_AUTH0_AUDIENCE }}

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Create deployment package
        run: |
          mkdir -p deploy
          cp -r dist deploy/
          cp -r node_modules deploy/
          cp package.json deploy/
          cp ecosystem.config.aws.cjs deploy/
          cd deploy
          zip -r ../deployment.zip .

      - name: Upload to S3
        run: |
          aws s3 cp deployment.zip s3://facnet-validator-deployments/deployment-${{ github.sha }}.zip

      - name: Create CodeDeploy deployment
        run: |
          aws deploy create-deployment \
            --application-name facnet-validator \
            --deployment-group-name production \
            --s3-location bucket=facnet-validator-deployments,key=deployment-${{ github.sha }}.zip,bundleType=zip \
            --description "Deployment from commit ${{ github.sha }}"

      - name: Wait for deployment
        run: |
          # Wait for deployment to complete (timeout after 10 minutes)
          timeout 600 bash -c 'until aws deploy get-deployment --deployment-id $DEPLOYMENT_ID --query "deploymentInfo.status" --output text | grep -q "Succeeded"; do sleep 10; done'

      - name: Verify deployment
        run: |
          # Check health endpoint
          curl -f https://your-aws-domain.com/api/health || exit 1
```

---

## 16. Auto Scaling Configuration

### **Auto Scaling Policies:**

**Scale Up Policy (CPU-based):**
```yaml
Metric: Average CPU Utilization
Threshold: >70% for 5 minutes
Action: Add 1 instance
Cooldown: 300 seconds
```

**Scale Up Policy (Request-based):**
```yaml
Metric: ALB Request Count per Target
Threshold: >1000 requests/minute
Action: Add 1 instance
Cooldown: 300 seconds
```

**Scale Down Policy:**
```yaml
Metric: Average CPU Utilization
Threshold: <30% for 10 minutes
Action: Remove 1 instance
Cooldown: 600 seconds
```

**Capacity:**
```yaml
Minimum: 2 instances (Multi-AZ HA)
Desired: 2 instances
Maximum: 6 instances
```

---

## 17. Database Migration Procedure

### **Export from OVH VPS:**
```bash
# SSH to OVH VPS
ssh ubuntu@148.113.196.245

# Export database
pg_dump -h localhost -U dashvalidator_user -d dashvalidator \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file=/tmp/dashvalidator_export.dump

# Verify export
pg_restore --list /tmp/dashvalidator_export.dump

# Download to local machine
scp ubuntu@148.113.196.245:/tmp/dashvalidator_export.dump ./
```

### **Import to AWS RDS:**
```bash
# Upload to bastion or EC2 instance
scp -i facnet-validator-prod.pem dashvalidator_export.dump ubuntu@bastion-ip:/tmp/

# SSH to bastion
ssh -i facnet-validator-prod.pem ubuntu@bastion-ip

# Restore to RDS (get endpoint from AWS console)
pg_restore \
  -h rds-endpoint.ca-central-1.rds.amazonaws.com \
  -U dashvalidator_admin \
  -d dashvalidator \
  --no-owner \
  --no-privileges \
  --verbose \
  /tmp/dashvalidator_export.dump

# Verify data
psql -h rds-endpoint.ca-central-1.rds.amazonaws.com \
     -U dashvalidator_admin \
     -d dashvalidator \
     -c "SELECT COUNT(*) FROM codes;"
# Expected: 6740 rows

# Create application user
psql -h rds-endpoint.ca-central-1.rds.amazonaws.com \
     -U dashvalidator_admin \
     -d dashvalidator \
     -c "CREATE USER dashvalidator_app WITH PASSWORD 'GENERATED_PASSWORD';"

# Grant permissions
psql -h rds-endpoint.ca-central-1.rds.amazonaws.com \
     -U dashvalidator_admin \
     -d dashvalidator \
     -c "GRANT CONNECT ON DATABASE dashvalidator TO dashvalidator_app;"
psql -h rds-endpoint.ca-central-1.rds.amazonaws.com \
     -U dashvalidator_admin \
     -d dashvalidator \
     -c "GRANT USAGE ON SCHEMA public TO dashvalidator_app;"
psql -h rds-endpoint.ca-central-1.rds.amazonaws.com \
     -U dashvalidator_admin \
     -d dashvalidator \
     -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dashvalidator_app;"
```

---

## 18. DNS Cutover Procedure

### **Pre-Cutover (24 hours before):**
```bash
# Lower TTL on existing DNS record
# Current: 3600 seconds (1 hour)
# New: 300 seconds (5 minutes)
# Wait 24 hours for TTL to expire globally
```

### **Cutover Steps:**
```bash
# 1. Verify AWS environment is ready
curl https://alb-dns-name.ca-central-1.elb.amazonaws.com/api/health

# 2. Update DNS record
# Option A: Route 53
aws route53 change-resource-record-sets \
  --hosted-zone-id ZXXXXXXXXXXXXX \
  --change-batch file://dns-change.json

# Option B: External DNS provider
# Log in to DNS provider dashboard
# Update A record to point to ALB IP address
# OR update CNAME to ALB DNS name

# 3. Monitor traffic shift
# Watch CloudWatch ALB metrics
# Watch OVH VPS traffic decrease

# 4. Verify new traffic
# Test from multiple locations
curl -H "Host: your-domain.com" https://your-domain.com/api/health

# 5. Monitor for 1 hour
# Check error rates
# Check response times
# Check authentication flow

# 6. Keep OVH as backup for 7 days
# Don't delete OVH VPS immediately
```

---

## 19. Rollback Plan

### **If Issues During Cutover:**

**Quick Rollback (5 minutes):**
```bash
# 1. Revert DNS to OVH VPS
aws route53 change-resource-record-sets \
  --hosted-zone-id ZXXXXXXXXXXXXX \
  --change-batch file://dns-rollback.json

# 2. Announce rollback to users
# "We've encountered issues and temporarily rolled back"

# 3. Investigate AWS issues
# Check CloudWatch logs
# Check RDS connectivity
# Check ElastiCache connectivity
# Check S3 access
```

**Common Issues and Solutions:**

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Database connection fails | 5xx errors, "cannot connect to database" | Check RDS security group, verify SSL certificate |
| Redis connection fails | Slow responses, no caching | Check ElastiCache security group, AUTH token |
| File upload fails | Upload errors | Check S3 IAM permissions, bucket policy |
| Auth0 callback fails | Cannot login | Update Auth0 allowed callback URLs |
| High latency | Slow API responses | Check ALB target health, EC2 CPU usage |

---

## 20. Cost Optimization Strategies

### **Phase 1 (Immediate - Post-Migration):**
- Use Reserved Instances (1-year, no upfront): Save 30% (~$160/month)
- Right-size instances after monitoring (may be able to use t3.small)
- Enable RDS automated backups only (disable extra manual snapshots)

### **Phase 2 (After 3 months):**
- Analyze CloudWatch metrics to optimize instance count
- Consider Spot Instances for non-critical background workers
- Implement S3 Intelligent-Tiering for backups
- Review data transfer patterns and optimize

### **Phase 3 (After 6 months):**
- Consider Aurora Serverless v2 for database (pay per use)
- Implement CloudFront CDN for static assets
- Optimize ElastiCache node size based on usage
- Review and remove unused resources

### **Long-term Cost Monitoring:**
- Set up AWS Budgets with alerts ($700/month threshold)
- Monthly cost review meetings
- Tag all resources for cost allocation
- Use AWS Cost Explorer for trend analysis

---

## 21. Testing Checklist (Before Production)

### **Functional Tests:**
- [ ] File upload (CSV processing)
- [ ] Validation engine (RAMQ rules)
- [ ] Database queries (codes, contexts, establishments)
- [ ] Redis caching (cache hit rates)
- [ ] Auth0 login/logout flow
- [ ] User role permissions (viewer, editor, admin)
- [ ] Background job processing (BullMQ)
- [ ] Health check endpoint
- [ ] API endpoints (all modules)

### **Performance Tests:**
- [ ] Load test with 100 concurrent users
- [ ] Large CSV file upload (1000+ records)
- [ ] Database query performance (compare to OVH)
- [ ] Cache performance (Redis)
- [ ] API response times (<500ms for 95th percentile)

### **Security Tests:**
- [ ] SSL/TLS certificate validation
- [ ] Security group rules (no open ports)
- [ ] IAM permissions (least privilege)
- [ ] Secrets Manager access
- [ ] PHI redaction functionality
- [ ] Audit logging (CloudTrail)

### **High Availability Tests:**
- [ ] Simulate EC2 instance failure
- [ ] Simulate RDS failover (Multi-AZ)
- [ ] Simulate ElastiCache failover
- [ ] Auto Scaling scale-up/scale-down

### **Disaster Recovery Tests:**
- [ ] Database backup and restore
- [ ] Point-in-time recovery
- [ ] Cross-region snapshot copy

---

## 22. Next Steps

### **Week 1: AWS Account Setup**
1. Create AWS account or use existing
2. Sign HIPAA Business Associate Agreement
3. Create IAM users and roles
4. Set up billing alerts and budgets
5. Request service limit increases if needed

### **Week 2: Infrastructure Deployment**
1. Create VPC and networking (Terraform/CloudFormation)
2. Deploy RDS PostgreSQL (Multi-AZ)
3. Deploy ElastiCache Redis
4. Create S3 buckets
5. Set up Application Load Balancer
6. Request SSL certificate (ACM)

### **Week 3: Code Preparation**
1. Create feature branch: `feature/aws-migration`
2. Implement S3 file upload service
3. Update database connection for RDS
4. Update Redis connection for ElastiCache
5. Implement Secrets Manager integration
6. Update session storage to connect-redis
7. Create new GitHub Actions workflow

### **Week 4: Testing and Validation**
1. Deploy to AWS staging environment
2. Run full test suite
3. Load testing
4. Security audit
5. PHI compliance verification

### **Week 5: Production Migration**
1. Export and import database
2. Update Auth0 configuration
3. Schedule maintenance window
4. DNS cutover
5. Monitor for 48 hours
6. Optimize and fine-tune

---

## 23. Support and Escalation

### **AWS Support Plan:**
- **Recommendation:** Business Support ($100/month or 10% of AWS spend)
- **Includes:** 24/7 phone/chat/email support, 1-hour response for production issues
- **Alternative:** Developer Support ($29/month) for non-critical workloads

### **Escalation Contacts:**
- AWS Account Manager: TBD after account setup
- AWS TAM (Technical Account Manager): Available with Enterprise Support
- Emergency: AWS Support Center (support.aws.amazon.com)

### **Community Resources:**
- AWS Documentation: docs.aws.amazon.com
- AWS Forums: forums.aws.amazon.com
- Stack Overflow: Tag [amazon-web-services]

---

## 24. Compliance and Audit Documentation

### **HIPAA Compliance Checklist:**
- [ ] AWS Business Associate Agreement signed
- [ ] All data encrypted at rest (KMS)
- [ ] All data encrypted in transit (TLS 1.2+)
- [ ] CloudTrail logging enabled (90-day retention)
- [ ] VPC Flow Logs enabled
- [ ] Access logging enabled (ALB, S3)
- [ ] MFA enabled for all IAM users
- [ ] Regular security patching process
- [ ] Incident response plan documented
- [ ] Backup and recovery tested quarterly
- [ ] Risk assessment completed
- [ ] Security training completed

### **Audit Trail:**
- CloudTrail logs: All API calls logged
- VPC Flow Logs: Network traffic logged
- ALB access logs: HTTP requests logged
- RDS audit logging: Database queries logged (if enabled)
- Application logs: Stored in CloudWatch Logs

---

## 25. Maintenance Windows

### **Recommended Maintenance Schedule:**
- **Database Maintenance:** Sundays 04:00-05:00 UTC (low traffic)
- **Application Deployment:** Rolling deployment (zero downtime)
- **Security Patches:** Monthly, automated via Auto Scaling Group refresh
- **Major Updates:** Quarterly, with staged rollout

### **Emergency Maintenance:**
- Critical security patches: Within 24 hours
- Service disruptions: Immediate response
- Communication: Email notification to users

---

## Appendices

### **Appendix A: AWS Service Limits**
- EC2 instances per region: Default 20 (request increase if needed)
- RDS instances per region: Default 40
- VPCs per region: Default 5
- S3 buckets per account: Default 100

### **Appendix B: Terraform/CloudFormation Templates**
- Coming soon: Infrastructure as Code templates
- Repository: TBD

### **Appendix C: Contact Information**
- Project Lead: _____________________
- AWS Contact: _____________________
- Auth0 Contact: _____________________
- Emergency On-Call: _____________________

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-08 | Claude | Initial AWS deployment plan |

---

**End of Document**
