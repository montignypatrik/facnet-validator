// Load environment variables from .env file (if exists)
// PM2 will inherit these, but we keep minimal config here
module.exports = {
  apps: [
    {
      name: 'facnet-validator',
      script: 'dist/server/index.js',
      interpreter: 'node',
      instances: 'max', // Use all CPU cores (6 on production server)
      exec_mode: 'cluster', // Enable clustering for zero-downtime reload
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',

      // Environment variables (inherit from .env file on server)
      // This avoids hardcoding credentials in version control
      env: {
        NODE_ENV: 'production'
      },

      // Logging configuration
      log_file: '/var/www/facnet/logs/combined.log',
      out_file: '/var/www/facnet/logs/out.log',
      error_file: '/var/www/facnet/logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Process management (critical for zero-downtime reload)
      min_uptime: '10s',
      max_restarts: 10,
      kill_timeout: 5000,        // Wait 5s for graceful shutdown (SIGTERM)
      wait_ready: true,          // Wait for app.listen() before considering process online
      listen_timeout: 10000,     // Max wait time for app to be ready

      // Health check
      health_check_grace_period: 3000
    }
  ]
};