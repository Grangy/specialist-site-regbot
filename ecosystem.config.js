// PM2 конфигурация для production деплоя
module.exports = {
  apps: [{
    name: 'telegram-bot',
    script: './src/index.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Автоперезапуск
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    
    // Логи
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Environment
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    
    // Restart delays
    restart_delay: 4000,
    min_uptime: '10s',
    max_restarts: 10
  }]
};

