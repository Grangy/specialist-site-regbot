require('dotenv').config();

/**
 * Конфигурация приложения
 */
module.exports = {
  // Telegram Bot
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    options: {
      polling: true
    }
  },

  // Авторизация
  auth: {
    password: process.env.BOT_PASSWORD || '22170313'
  },

  // Администратор
  admin: {
    id: parseInt(process.env.ADMIN_ID) || null
  },

  // Уведомления
  notifications: {
    groupId: process.env.NOTIFICATION_GROUP_ID || null
  },

  // Create LK API
  createLK: {
    url: process.env.CREATE_LK_API_URL || 'https://specialist82.pro/create_lk_api.php',
    token: process.env.CREATE_LK_API_TOKEN || ''
  },

  // Reset Password API
  resetPassword: {
    url: process.env.RESET_PASSWORD_API_URL || 'https://specialist82.pro/reset_password_api.php',
    token: process.env.RESET_PASSWORD_API_TOKEN || ''
  },

  // Customers API (для получения всех клиентов из БД сайта)
  customersApi: {
    url: process.env.CUSTOMERS_API_URL || 'https://specialist82.pro/getAllCustomersApi.php',
    token: process.env.CUSTOMERS_API_TOKEN || 'SUPER_SECRET_TOKEN_123'
  },

  // API
  api: {
    url: process.env.API_URL || 'https://specialist82.pro/api.php/shop.customer.add',
    accessToken: process.env.API_ACCESS_TOKEN || 'a9a871eafe959f413c0c0240c8716258'
  },

  // База данных
  database: {
    path: process.env.DATABASE_PATH || './data/users.db'
  },

  // Файл с клиентами
  clients: {
    jsonPath: process.env.CLIENTS_JSON_PATH || './data/clients.json'
  },

  // Настройки бота
  bot: {
    maxSearchResults: parseInt(process.env.MAX_SEARCH_RESULTS) || 5,
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 1800000 // 30 минут
  },

  // Логирование
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/bot.log'
  }
};



