module.exports = {
  apps: [
    {
      name: 'facnet-validator-staging',
      script: 'dist/server/index.js',
      interpreter: 'node',
      instances: 1, // Single instance for testing
      exec_mode: 'fork', // Fork mode for easier debugging
      autorestart: true,
      watch: false,
      max_memory_restart: '512M', // Lower memory limit for staging

      // Environment variables loaded from .env.staging file
      // This avoids hardcoding credentials in version control
      env: {
        NODE_ENV: 'staging',
        PORT: '3001' // Different port from production
      },

      // Logging configuration for staging
      log_file: '/var/www/facnet/logs/staging-combined.log',
      out_file: '/var/www/facnet/logs/staging-out.log',
      error_file: '/var/www/facnet/logs/staging-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Process management
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // Health check
      health_check_grace_period: 3000,

      // Environment file
      env_file: '.env.staging'
    }
  ]
};