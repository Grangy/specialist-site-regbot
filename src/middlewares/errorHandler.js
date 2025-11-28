const logger = require('../utils/logger');

/**
 * Middleware для обработки ошибок
 */
class ErrorHandler {
  /**
   * Обработка ошибок Telegram API
   */
  static handleTelegramError(error, bot, chatId) {
    logger.error('Telegram API Error:', error);

    const errorMessages = {
      'ETELEGRAM: 400': '❌ Некорректный запрос к Telegram API',
      'ETELEGRAM: 401': '❌ Неверный токен бота',
      'ETELEGRAM: 403': '❌ Бот заблокирован пользователем',
      'ETELEGRAM: 404': '❌ Метод не найден',
      'ETELEGRAM: 429': '⏳ Слишком много запросов. Подождите немного.',
      'ETIMEDOUT': '⏳ Превышено время ожидания. Попробуйте позже.',
      'ECONNREFUSED': '❌ Не удалось подключиться к Telegram'
    };

    let message = '❌ Произошла ошибка при работе с Telegram';

    // Ищем соответствующее сообщение
    for (const [key, value] of Object.entries(errorMessages)) {
      if (error.message && error.message.includes(key)) {
        message = value;
        break;
      }
    }

    if (chatId) {
      bot.sendMessage(chatId, message).catch(err => {
        logger.error('Failed to send error message:', err);
      });
    }

    return message;
  }

  /**
   * Обработка ошибок базы данных
   */
  static handleDatabaseError(error, context = '') {
    logger.error(`Database Error [${context}]:`, error);

    const errorType = error.code || error.errno;
    
    const errorMessages = {
      'SQLITE_CONSTRAINT': 'Ошибка ограничения БД',
      'SQLITE_BUSY': 'База данных занята',
      'SQLITE_LOCKED': 'База данных заблокирована',
      'SQLITE_CANTOPEN': 'Не удалось открыть базу данных',
      'SQLITE_CORRUPT': 'База данных повреждена'
    };

    return errorMessages[errorType] || 'Ошибка работы с базой данных';
  }

  /**
   * Обработка ошибок API
   */
  static handleApiError(error, context = '') {
    logger.error(`API Error [${context}]:`, {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    if (error.response) {
      const status = error.response.status;
      
      const statusMessages = {
        400: 'Некорректные данные запроса',
        401: 'Ошибка авторизации API',
        403: 'Доступ запрещён',
        404: 'Метод API не найден',
        429: 'Превышен лимит запросов',
        500: 'Внутренняя ошибка сервера',
        502: 'Сервер недоступен',
        503: 'Сервис временно недоступен',
        504: 'Превышено время ожидания ответа'
      };

      return statusMessages[status] || `Ошибка API (${status})`;
    }

    if (error.code === 'ECONNABORTED') {
      return 'Превышено время ожидания ответа от сервера';
    }

    if (error.code === 'ENOTFOUND') {
      return 'Сервер не найден';
    }

    if (error.code === 'ECONNREFUSED') {
      return 'Не удалось подключиться к серверу';
    }

    return 'Ошибка при обращении к API';
  }

  /**
   * Обработка общих ошибок
   */
  static handleGenericError(error, context = '') {
    logger.error(`Generic Error [${context}]:`, error);

    if (error instanceof TypeError) {
      return 'Ошибка типа данных';
    }

    if (error instanceof ReferenceError) {
      return 'Ошибка ссылки на переменную';
    }

    if (error instanceof SyntaxError) {
      return 'Синтаксическая ошибка';
    }

    return 'Неизвестная ошибка';
  }

  /**
   * Логирование пользовательских действий
   */
  static logUserAction(chatId, action, data = {}) {
    logger.info(`User Action [${chatId}]: ${action}`, data);
  }

  /**
   * Логирование системных событий
   */
  static logSystemEvent(event, data = {}) {
    logger.info(`System Event: ${event}`, data);
  }
}

module.exports = ErrorHandler;



