module.exports = {
  apps: [
    {
      name: 'facnet-validator-staging',
      script: 'server/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx/esm',
      instances: 1, // Single instance for testing
      exec_mode: 'fork', // Fork mode for easier debugging
      autorestart: true,
      watch: false,
      max_memory_restart: '512M', // Lower memory limit for staging
      env: {
        NODE_ENV: 'staging',
        PORT: 3001, // Different port from production
        DATABASE_URL: 'postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator_staging',
        REDIS_URL: 'redis://localhost:6379',
        AUTH0_ISSUER_BASE_URL: 'https://dev-x63i3b6hf5kch7ab.ca.auth0.com',
        AUTH0_AUDIENCE: 'facnet-validator-api',
        AUTH0_CLIENT_SECRET: 'fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk',
        PHI_REDACTION_SALT: '99396260a8d4111225c83d71a260fcdaed678481cd868fe0e35b1969dc273f1b'
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
        DATABASE_URL: 'postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator_staging',
        REDIS_URL: 'redis://localhost:6379',
        AUTH0_ISSUER_BASE_URL: 'https://dev-x63i3b6hf5kch7ab.ca.auth0.com',
        AUTH0_AUDIENCE: 'facnet-validator-api',
        AUTH0_CLIENT_SECRET: 'fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk',
        PHI_REDACTION_SALT: '99396260a8d4111225c83d71a260fcdaed678481cd868fe0e35b1969dc273f1b'
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