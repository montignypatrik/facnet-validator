module.exports = {
  apps: [
    {
      name: 'facnet-validator',
      script: 'server/index.ts',
      interpreter: 'node',
      interpreter_args: '--loader tsx/esm',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster', // Enable clustering for better performance
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
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
      health_check_grace_period: 3000,

      // Environment file
      env_file: '.env'
    }
  ]
};