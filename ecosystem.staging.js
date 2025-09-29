module.exports = {
  apps: [
    {
      name: 'facnet-validator-staging',
      script: 'server/index.ts',
      interpreter: 'node',
      interpreter_args: '--loader tsx/esm',
      instances: 1, // Single instance for testing
      exec_mode: 'fork', // Fork mode for easier debugging
      autorestart: true,
      watch: false,
      max_memory_restart: '512M', // Lower memory limit for staging
      env: {
        NODE_ENV: 'staging',
        PORT: 3001, // Different port from production
        DATABASE_URL: 'postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator_staging'
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
        DATABASE_URL: 'postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator_staging'
      },
      // Logging configuration for staging
      log_file: '/var/www/facnet/logs/staging-combined.log',
      out_file: '/var/www/facnet/logs/staging-out.log',
      error_file: '/var/www/facnet/logs/staging-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Process management
      min_uptime: '10s',
      max_restarts: 5,

      // Health check
      health_check_grace_period: 3000,

      // Environment file
      env_file: '.env.staging'
    }
  ]
};