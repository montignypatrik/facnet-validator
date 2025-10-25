#!/bin/bash
# Rollback Deployment Script
# Rolls back to previous git commit and restarts PM2
# Usage: ./scripts/rollback-deployment.sh [commits_back]
# Example: ./scripts/rollback-deployment.sh 1  # Go back 1 commit (default)

set -euo pipefail

COMMITS_BACK=${1:-1}

echo "⚠️  WARNING: This will roll back the deployment by $COMMITS_BACK commit(s)"
echo "Current commit: $(git log -1 --oneline)"
echo "Target commit: $(git log -1 --skip=$COMMITS_BACK --oneline)"
echo ""
echo "Press Ctrl+C within 10 seconds to cancel..."
sleep 10

echo "=== Rolling back to previous commit ==="
git reset --hard HEAD~$COMMITS_BACK
echo "Rolled back to: $(git log -1 --oneline)"

echo "=== Cleaning build directory ==="
rm -rf dist/

echo "=== Installing dependencies ==="
npm ci

echo "=== Building application ==="
npm run build

echo "=== Verifying build ==="
if [ ! -f "dist/server/index.js" ]; then
  echo "ERROR: Build failed after rollback"
  exit 1
fi

echo "=== Restarting PM2 ==="
if command -v pm2 &> /dev/null; then
  pm2 stop facnet-validator || true
  sleep 3
  pm2 delete facnet-validator || true
  pm2 start ecosystem.config.cjs
  pm2 save

  echo "=== Waiting for stabilization ==="
  sleep 15

  echo "=== Verifying health ==="
  curl -f -m 10 http://localhost:5000/api/health || {
    echo "ERROR: Health check failed after rollback"
    pm2 logs facnet-validator --lines 50
    exit 1
  }

  echo "✅ Rollback completed successfully"
  pm2 status facnet-validator
else
  echo "⚠️  PM2 not found - manual restart required"
  echo "Run: pm2 restart ecosystem.config.cjs"
fi
