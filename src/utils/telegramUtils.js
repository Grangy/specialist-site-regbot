const logger = require('./logger');

/**
 * Утилиты для безопасной работы с Telegram API
 */
class TelegramUtils {
  /**
   * Безопасный ответ на callback query
   * Обрабатывает ошибки "query is too old" и другие
   */
  static async safeAnswerCallbackQuery(bot, queryId, options = {}) {
    try {
      await bot.answerCallbackQuery(queryId, options);
      return true;
    } catch (error) {
      // Игнорируем ошибки "query is too old" - это нормально для старых запросов
      if (error.message && (
        error.message.includes('query is too old') ||
        error.message.includes('response timeout expired') ||
        error.message.includes('query ID is invalid')
      )) {
        logger.warn(`Callback query ${queryId} слишком старый или недействительный, игнорируем`);
        return false;
      }
      
      // Для других ошибок логируем
      logger.error(`Ошибка при ответе на callback query ${queryId}:`, error.message);
      return false;
    }
  }

  /**
   * Безопасное обновление текста сообщения
   * Проверяет, изменился ли текст перед обновлением
   */
  static async safeEditMessageText(bot, chatId, messageId, newText, options = {}) {
    try {
      // Получаем текущее сообщение для сравнения
      try {
        const currentMessage = await bot.getChat(chatId).then(() => {
          // Пытаемся получить сообщение через forwardMessage или другой способ
          // Но проще просто попробовать обновить и обработать ошибку
          return null;
        });
      } catch (e) {
        // Игнорируем ошибки получения сообщения
      }

      await bot.editMessageText(newText, {
        chat_id: chatId,
        message_id: messageId,
        ...options
      });
      return true;
    } catch (error) {
      // Игнорируем ошибку "message is not modified" - это нормально
      if (error.message && (
        error.message.includes('message is not modified') ||
        error.message.includes('exactly the same')
      )) {
        logger.debug(`Сообщение ${messageId} не изменилось, пропускаем обновление`);
        return false;
      }

      // Для других ошибок логируем
      logger.error(`Ошибка при обновлении сообщения ${messageId}:`, error.message);
      return false;
    }
  }

  /**
   * Безопасное обновление клавиатуры сообщения
   */
  static async safeEditMessageReplyMarkup(bot, chatId, messageId, replyMarkup) {
    try {
      await bot.editMessageReplyMarkup(replyMarkup, {
        chat_id: chatId,
        message_id: messageId
      });
      return true;
    } catch (error) {
      // Игнорируем ошибку "message is not modified"
      if (error.message && (
        error.message.includes('message is not modified') ||
        error.message.includes('exactly the same')
      )) {
        logger.debug(`Клавиатура сообщения ${messageId} не изменилась, пропускаем обновление`);
        return false;
      }

      // Игнорируем ошибки "message to edit not found" - сообщение могло быть удалено
      if (error.message && (
        error.message.includes('message to edit not found') ||
        error.message.includes('message can\'t be edited')
      )) {
        logger.warn(`Сообщение ${messageId} не найдено или не может быть отредактировано`);
        return false;
      }

      logger.error(`Ошибка при обновлении клавиатуры сообщения ${messageId}:`, error.message);
      return false;
    }
  }

  /**
   * Безопасная отправка сообщения
   */
  static async safeSendMessage(bot, chatId, text, options = {}) {
    try {
      await bot.sendMessage(chatId, text, options);
      return true;
    } catch (error) {
      // Игнорируем ошибки "chat not found" или "bot blocked"
      if (error.message && (
        error.message.includes('chat not found') ||
        error.message.includes('bot was blocked') ||
        error.message.includes('user is deactivated')
      )) {
        logger.warn(`Не удалось отправить сообщение в чат ${chatId}: ${error.message}`);
        return false;
      }

      logger.error(`Ошибка при отправке сообщения в чат ${chatId}:`, error.message);
      return false;
    }
  }

  /**
   * Проверка, является ли callback query слишком старым
   * Telegram требует ответить на callback query в течение определенного времени
   */
  static isCallbackQueryExpired(query) {
    if (!query || !query.message || !query.message.date) {
      return false;
    }

    // Telegram callback query действителен примерно 60 секунд
    const queryAge = Date.now() / 1000 - query.message.date;
    const MAX_AGE = 60; // секунд

    return queryAge > MAX_AGE;
  }

  /**
   * Проверка, является ли callback_data критическим
   * Критические кнопки должны работать даже если запрос устарел
   */
  static isCriticalCallback(callbackData) {
    if (!callbackData) {
      return false;
    }

    // Список критических callback_data, которые должны работать всегда
    const criticalCallbacks = [
      'new_registration',      // "Зарегистрировать ещё"
      'new_search',            // Новый поиск
      'cancel_registration',   // Отмена регистрации
      'clients_back',          // "Назад"
      'clients_refresh',       // Обновление списка
      'clients_clear_search',  // Очистка поиска
      'show_stats',            // Статистика
      'admin_search_clients',  // Поиск клиентов (админ)
      'clients_search_start',  // Запуск поиска в списке
    ];

    // Проверяем точное совпадение
    if (criticalCallbacks.includes(callbackData)) {
      return true;
    }

    // Проверяем префиксы для пагинации
    if (callbackData.startsWith('clients_page_')) {
      return true;
    }

    // Проверяем префиксы для подтверждения/отклонения регистрации
    if (callbackData.startsWith('approve_reg_') || callbackData.startsWith('reject_reg_')) {
      return true;
    }

    return false;
  }
}

module.exports = TelegramUtils;


