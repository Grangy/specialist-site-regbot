const winston = require('winston');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Создаем директорию для логов если её нет
const logsDir = path.dirname(config.logging.file);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Настройка логгера
 */
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'telegram-bot' },
  transports: [
    // Запись в файл
    new winston.transports.File({ 
      filename: config.logging.file,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Также выводим в консоль
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          info => `${info.timestamp} ${info.level}: ${info.message}`
        )
      )
    })
  ]
});

module.exports = logger;

