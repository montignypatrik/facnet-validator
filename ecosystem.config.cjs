module.exports = {
  apps: [
    {
      name: 'facnet-validator',
      script: 'dist/server/index.js',
      interpreter: 'node',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster', // Enable clustering for better performance
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        DATABASE_URL: 'postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator',
        REDIS_URL: 'redis://localhost:6379',
        AUTH0_ISSUER_BASE_URL: 'https://dev-x63i3b6hf5kch7ab.ca.auth0.com',
        AUTH0_AUDIENCE: 'facnet-validator-api',
        AUTH0_CLIENT_SECRET: 'fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk',
        PHI_REDACTION_SALT: '99396260a8d4111225c83d71a260fcdaed678481cd868fe0e35b1969dc273f1b'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        DATABASE_URL: 'postgresql://dashvalidator_user:DashValidator2024@localhost:5432/dashvalidator',
        REDIS_URL: 'redis://localhost:6379',
        AUTH0_ISSUER_BASE_URL: 'https://dev-x63i3b6hf5kch7ab.ca.auth0.com',
        AUTH0_AUDIENCE: 'facnet-validator-api',
        AUTH0_CLIENT_SECRET: 'fNxeP-Gq0kSe6EjEcgCYaHoCPoIYOKheH2sh0NjdefrlhOk9n6PUSg4te3likmk',
        PHI_REDACTION_SALT: '99396260a8d4111225c83d71a260fcdaed678481cd868fe0e35b1969dc273f1b'
      },
      // Logging configuration
      log_file: '/var/www/facnet/logs/combined.log',
      out_file: '/var/www/facnet/logs/out.log',
      error_file: '/var/www/facnet/logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Process management
      min_uptime: '10s',
      max_restarts: 10,

      // Health check
      health_check_grace_period: 3000
    }
  ]
};