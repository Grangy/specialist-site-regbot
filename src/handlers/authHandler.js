const database = require('../database/database');
const config = require('../config/config');
const logger = require('../utils/logger');
const keyboards = require('../keyboards/keyboards');

/**
 * Обработчик авторизации
 */
class AuthHandler {
  /**
   * Проверка авторизации пользователя
   */
  async checkAuth(bot, msg) {
    const chatId = msg.chat.id;
    
    try {
      const isAuthorized = await database.isUserAuthorized(chatId);
      
      if (isAuthorized) {
        await database.updateLastActivity(chatId);
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Ошибка проверки авторизации:', error);
      return false;
    }
  }

  /**
   * Запрос пароля
   */
  async requestPassword(bot, chatId) {
    await bot.sendMessage(
      chatId,
      '🔐 Добро пожаловать!\n\n' +
      'Для доступа к боту необходима авторизация.\n' +
      'Пожалуйста, введите пароль:',
      keyboards.removeKeyboard()
    );
  }

  /**
   * Проверка пароля
   */
  async verifyPassword(bot, msg) {
    const chatId = msg.chat.id;
    const password = msg.text.trim();

    if (password === config.auth.password) {
      try {
        // Сохраняем пользователя в БД
        await database.authorizeUser(chatId, {
          username: msg.from.username,
          first_name: msg.from.first_name,
          last_name: msg.from.last_name
        });

        await bot.sendMessage(
          chatId,
          '✅ Авторизация успешна!\n\n' +
          'Теперь вам доступен полный функционал бота.\n' +
          'Выберите действие из меню:',
          keyboards.getMainMenu()
        );

        logger.info(`Пользователь ${chatId} успешно авторизован`);
        return true;
      } catch (error) {
        logger.error('Ошибка сохранения пользователя:', error);
        await bot.sendMessage(
          chatId,
          '❌ Произошла ошибка при авторизации. Попробуйте позже.'
        );
        return false;
      }
    } else {
      await bot.sendMessage(
        chatId,
        '❌ Неверный пароль. Попробуйте ещё раз:'
      );
      logger.warn(`Неудачная попытка авторизации: ${chatId}`);
      return false;
    }
  }
}

module.exports = new AuthHandler();



