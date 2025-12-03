const TelegramBot = require('node-telegram-bot-api');
const config = require('./config/config');
const logger = require('./utils/logger');
const database = require('./database/database');
const authHandler = require('./handlers/authHandler');
const registrationHandler = require('./handlers/registrationHandler');
const adminHandler = require('./handlers/adminHandler');
const keyboards = require('./keyboards/keyboards');
const createLKService = require('./services/createLKService');

// Создаем экземпляр бота
const bot = new TelegramBot(config.telegram.token, config.telegram.options);

logger.info('🚀 Telegram бот запущен');

/**
 * Обработка команды /start
 */
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  logger.info(`Команда /start от пользователя ${chatId}`);

  const isAuthorized = await authHandler.checkAuth(bot, msg);

  if (!isAuthorized) {
    await authHandler.requestPassword(bot, chatId);
  } else {
    const isAdmin = registrationHandler.isAdmin(chatId);
    await bot.sendMessage(
      chatId,
      `👋 С возвращением, ${msg.from.first_name}!\n\n` +
      'Выберите действие из меню:',
      keyboards.getMainMenu(isAdmin)
    );
  }
});

/**
 * Обработка команды /help
 */
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  const isAuthorized = await authHandler.checkAuth(bot, msg);
  if (!isAuthorized) {
    await authHandler.requestPassword(bot, chatId);
    return;
  }

  const helpMessage = `
📖 *Инструкция по использованию бота*

*Регистрация клиента:*
1️⃣ Нажмите "🔍 Найти клиента"
2️⃣ Введите название компании
3️⃣ Выберите нужного клиента из списка
4️⃣ Введите телефон
5️⃣ Введите email
6️⃣ Подтвердите данные

*Основные команды:*
• /start - Главное меню
• /help - Эта справка
• /stats - Ваша статистика
• /cancel - Отменить текущую операцию

*Форматы данных:*
📱 Телефон: +79787599070
📧 Email: user@example.com

Если возникли вопросы - обратитесь к администратору.
  `;

  await bot.sendMessage(chatId, helpMessage, {
    parse_mode: 'Markdown',
    ...keyboards.getMainMenu()
  });
});

/**
 * Обработка команды /stats
 */
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  
  const isAuthorized = await authHandler.checkAuth(bot, msg);
  if (!isAuthorized) {
    await authHandler.requestPassword(bot, chatId);
    return;
  }

  await registrationHandler.showUserStats(bot, chatId);
});

/**
 * Обработка команды /cancel
 */
bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  
  const isAuthorized = await authHandler.checkAuth(bot, msg);
  if (!isAuthorized) {
    await authHandler.requestPassword(bot, chatId);
    return;
  }

  await registrationHandler.cancelRegistration(bot, chatId);
});

/**
 * Обработка callback query (inline кнопки)
 */
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  logger.info(`Callback query: ${data} от пользователя ${chatId}`);

  // Проверка авторизации
  const isAuthorized = await authHandler.checkAuth(bot, { chat: { id: chatId } });
  if (!isAuthorized) {
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Необходима авторизация',
      show_alert: true
    });
    return;
  }

  try {
    if (data.startsWith('select_client_')) {
      await registrationHandler.handleClientSelection(bot, query);
    } else if (data === 'new_search') {
      await bot.answerCallbackQuery(query.id);
      await registrationHandler.startClientSearch(bot, chatId);
    } else if (data === 'confirm_registration') {
      await registrationHandler.confirmRegistration(bot, query);
    } else if (data === 'cancel_registration') {
      await bot.answerCallbackQuery(query.id);
      await registrationHandler.cancelRegistration(bot, chatId, true);
    } else if (data === 'new_registration') {
      await bot.answerCallbackQuery(query.id);
      await registrationHandler.startClientSearch(bot, chatId);
    } else if (data === 'show_stats') {
      await bot.answerCallbackQuery(query.id);
      await registrationHandler.showUserStats(bot, chatId);
    } else if (data.startsWith('approve_reg_')) {
      // Подтверждение регистрации из группы
      await handleApproveRegistration(bot, query);
    } else if (data.startsWith('reject_reg_')) {
      // Отказ в регистрации из группы
      await handleRejectRegistration(bot, query);
    } else if (data.startsWith('price_list_')) {
      // Выбор прайс-листа
      await registrationHandler.handlePriceListSelection(bot, query);
    } else if (data.startsWith('clients_page_')) {
      // Пагинация списка клиентов
      const page = parseInt(data.split('_')[2]);
      await bot.answerCallbackQuery(query.id);
      await adminHandler.showClientsList(bot, chatId, page);
    } else if (data === 'clients_refresh') {
      // Обновление списка клиентов
      await bot.answerCallbackQuery(query.id, { text: '🔄 Обновляю...' });
      await adminHandler.showClientsList(bot, chatId, 0);
    } else if (data === 'clients_back') {
      // Назад в меню
      await bot.answerCallbackQuery(query.id);
      const isAdmin = registrationHandler.isAdmin(chatId);
      await bot.sendMessage(
        chatId,
        'Выберите действие из меню:',
        keyboards.getMainMenu(isAdmin)
      );
    } else if (data.startsWith('client_info_')) {
      // Информация о клиенте
      await adminHandler.showClientInfo(bot, query);
    } else if (data.startsWith('reset_password_')) {
      // Сброс пароля
      await adminHandler.resetClientPassword(bot, query);
    } else {
      await bot.answerCallbackQuery(query.id, {
        text: '❌ Неизвестная команда'
      });
    }
  } catch (error) {
    logger.error('Ошибка обработки callback query:', error);
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Произошла ошибка',
      show_alert: true
    });
  }
});

/**
 * Обработка подтверждения регистрации из группы
 */
async function handleApproveRegistration(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  try {
    // Извлекаем contact_id и user_chat_id из callback_data
    const parts = data.split('_');
    const contactId = parts[2];
    const userChatId = parts[3];

    await bot.answerCallbackQuery(query.id, {
      text: '⏳ Создаю ЛК...'
    });

      // Получаем информацию о клиенте для category_id
      const clientInfo = await database.getClientByContactId(contactId);
      const categoryId = clientInfo && clientInfo.price_list === 'Прайс 1 (+1.5%)' ? '4' : null;
      
      // Отправляем запрос на создание ЛК
      const result = await createLKService.createLK(contactId, categoryId);

    if (result.success) {
      // Обновляем сообщение - убираем кнопки, добавляем статус
      const originalText = query.message.text;
      const updatedText = originalText.replace(
        '✅ Статус: Ожидает подтверждения',
        '✅ Статус: ПОДТВЕРЖДЕНО\n🔑 ЛК создан успешно'
      );

      await bot.editMessageText(updatedText, {
        chat_id: chatId,
        message_id: messageId
      });

      // Убираем кнопки
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: chatId,
          message_id: messageId
        }
      );

      // Уведомляем пользователя
      if (userChatId) {
        try {
          await bot.sendMessage(
            userChatId,
            '✅ Регистрация подтверждена!\n\n' +
            'Личный кабинет создан. Данные для входа отправлены на указанный email.'
          );
        } catch (e) {
          logger.warn('Не удалось уведомить пользователя:', e.message);
        }
      }

      logger.info(`ЛК создан для contact_id: ${contactId}`);
    } else {
      await bot.answerCallbackQuery(query.id, {
        text: `❌ Ошибка: ${result.error}`,
        show_alert: true
      });

      logger.error(`Ошибка создания ЛК для contact_id ${contactId}: ${result.error}`);
    }
  } catch (error) {
    logger.error('Ошибка обработки подтверждения:', error);
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Произошла ошибка',
      show_alert: true
    });
  }
}

/**
 * Обработка отказа в регистрации из группы
 */
async function handleRejectRegistration(bot, query) {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  try {
    // Извлекаем user_chat_id из callback_data
    const parts = data.split('_');
    const contactId = parts[2];
    const userChatId = parts[3];

    await bot.answerCallbackQuery(query.id, {
      text: 'Регистрация отклонена'
    });

    // Обновляем сообщение - убираем кнопки, добавляем статус
    const originalText = query.message.text;
    const updatedText = originalText.replace(
      '✅ Статус: Ожидает подтверждения',
      '❌ Статус: ОТКЛОНЕНО'
    );

    await bot.editMessageText(updatedText, {
      chat_id: chatId,
      message_id: messageId
    });

    // Убираем кнопки
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: chatId,
        message_id: messageId
      }
    );

    // Уведомляем пользователя
    if (userChatId) {
      try {
        await bot.sendMessage(
          userChatId,
          '❌ К сожалению, регистрация отклонена.\n\n' +
          'Если у вас есть вопросы, обратитесь к администратору.'
        );
      } catch (e) {
        logger.warn('Не удалось уведомить пользователя:', e.message);
      }
    }

    logger.info(`Регистрация отклонена для contact_id: ${contactId}`);
  } catch (error) {
    logger.error('Ошибка обработки отказа:', error);
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Произошла ошибка',
      show_alert: true
    });
  }
}

/**
 * Обработка текстовых сообщений
 */
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Пропускаем команды (они обрабатываются отдельно)
  if (text && text.startsWith('/')) {
    return;
  }

  logger.info(`Сообщение от ${chatId}: ${text}`);

  // Проверка авторизации
  const isAuthorized = await authHandler.checkAuth(bot, msg);

  if (!isAuthorized) {
    // Если не авторизован - пытаемся проверить пароль
    await authHandler.verifyPassword(bot, msg);
    return;
  }

  // Получаем текущее состояние пользователя
  const state = await registrationHandler.getUserState(chatId);

  try {
    // Проверка админа
    const isAdmin = registrationHandler.isAdmin(chatId);

    // Обработка кнопок меню
    if (text === '🔍 Найти клиента') {
      await registrationHandler.startClientSearch(bot, chatId);
    } else if (text === '⚡ Рег. без подтверждения' || text === '⚡ Регистрация без подтверждения') {
      // Только для админа
      if (isAdmin) {
        await registrationHandler.startClientSearch(bot, chatId, true); // true = без подтверждения
      } else {
        await bot.sendMessage(chatId, '❌ У вас нет прав для этой операции.');
      }
    } else if (text === '👥 Список клиентов') {
      // Только для админа
      if (registrationHandler.isAdmin(chatId)) {
        await adminHandler.showClientsList(bot, chatId, 0);
      } else {
        await bot.sendMessage(chatId, '❌ У вас нет прав для этой операции.');
      }
    } else if (text === '📊 Моя статистика') {
      await registrationHandler.showUserStats(bot, chatId);
    } else if (text === '❓ Помощь') {
      bot.emit('message', { ...msg, text: '/help' });
    } else if (text === '⬅️ Назад в меню' || text === '❌ Отменить регистрацию') {
      await registrationHandler.cancelRegistration(bot, chatId);
    }
    // Обработка состояний регистрации
    else if (state) {
      if (state.step === 'awaiting_client_name') {
        await registrationHandler.handleClientNameInput(bot, msg);
      } else if (state.step === 'awaiting_phone') {
        await registrationHandler.handlePhoneInput(bot, msg);
      } else if (state.step === 'awaiting_email') {
        await registrationHandler.handleEmailInput(bot, msg);
      } else if (state.step === 'awaiting_price_list') {
        // Прайс-лист выбирается через inline-кнопки, не через текст
        await bot.sendMessage(
          chatId,
          'Пожалуйста, выберите прайс-лист из кнопок выше ⬆️',
          keyboards.getPriceListButtons()
        );
      } else {
        await bot.sendMessage(
          chatId,
          '🤔 Не понимаю. Используйте меню или /help для справки.',
          keyboards.getMainMenu()
        );
      }
    } else {
      // Если нет активного состояния - показываем меню
      const isAdmin = registrationHandler.isAdmin(chatId);
      await bot.sendMessage(
        chatId,
        '🤔 Не понимаю. Выберите действие из меню:',
        keyboards.getMainMenu(isAdmin)
      );
    }
  } catch (error) {
    logger.error('Ошибка обработки сообщения:', error);
      const isAdmin = registrationHandler.isAdmin(chatId);
      await bot.sendMessage(
        chatId,
        '❌ Произошла ошибка. Попробуйте позже.',
        keyboards.getMainMenu(isAdmin)
      );
  }
});

/**
 * Обработка ошибок бота
 */
bot.on('polling_error', (error) => {
  logger.error('Polling error:', error);
});

/**
 * Graceful shutdown
 */
process.on('SIGINT', () => {
  logger.info('Получен сигнал SIGINT. Закрываю соединения...');
  database.close();
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Получен сигнал SIGTERM. Закрываю соединения...');
  database.close();
  bot.stopPolling();
  process.exit(0);
});

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  database.close();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

logger.info('✅ Бот готов к работе!');

