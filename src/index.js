const TelegramBot = require('node-telegram-bot-api');
const config = require('./config/config');
const logger = require('./utils/logger');
const database = require('./database/database');
const authHandler = require('./handlers/authHandler');
const registrationHandler = require('./handlers/registrationHandler');
const adminHandler = require('./handlers/adminHandler');
const keyboards = require('./keyboards/keyboards');
const createLKService = require('./services/createLKService');
const telegramUtils = require('./utils/telegramUtils');

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
  const chatId = query.message?.chat?.id;
  const data = query.data;

  // Проверка на валидность query
  if (!query || !query.id || !data) {
    logger.warn('Получен невалидный callback query');
    return;
  }

  // Проверка на устаревший query
  // Для критических кнопок (навигация, новые действия) пропускаем проверку
  const isCritical = telegramUtils.isCriticalCallback(data);
  const isExpired = telegramUtils.isCallbackQueryExpired(query);
  
  if (isExpired && !isCritical) {
    // Для некритических устаревших запросов показываем сообщение и игнорируем
    logger.warn(`Callback query ${query.id} слишком старый, игнорируем`);
    await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
      text: '⏰ Запрос устарел. Пожалуйста, обновите сообщение.',
      show_alert: false
    });
    return;
  }
  
  // Для критических кнопок или не устаревших запросов продолжаем обработку
  if (isExpired && isCritical) {
    logger.info(`Callback query ${query.id} устарел, но это критическая кнопка (${data}), обрабатываем`);
  }

  logger.info(`Callback query: ${data} от пользователя ${chatId}`);

  // Проверка авторизации
  const isAuthorized = await authHandler.checkAuth(bot, { chat: { id: chatId } });
  if (!isAuthorized) {
    await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
      text: '❌ Необходима авторизация',
      show_alert: true
    });
    return;
  }

  try {
    if (data.startsWith('select_client_')) {
      await registrationHandler.handleClientSelection(bot, query);
    } else if (data === 'new_search') {
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id);
      await registrationHandler.startClientSearch(bot, chatId);
    } else if (data === 'confirm_registration') {
      await registrationHandler.confirmRegistration(bot, query);
    } else if (data === 'cancel_registration') {
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id);
      await registrationHandler.cancelRegistration(bot, chatId, true);
    } else if (data === 'new_registration') {
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id);
      await registrationHandler.startClientSearch(bot, chatId);
    } else if (data === 'show_stats') {
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id);
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
      const parts = data.split('_');
      const page = parseInt(parts[2]);
      
      // Получаем поисковый запрос из состояния пользователя
      const adminState = await adminHandler.getUserState(chatId);
      const search = adminState && adminState.currentSearch ? adminState.currentSearch : '';
      
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id);
      await adminHandler.showClientsList(bot, chatId, page, search);
    } else if (data === 'admin_search_clients') {
      // Запуск поиска клиентов для админа (отдельная кнопка)
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id);
      await adminHandler.startClientSearch(bot, chatId);
    } else if (data === 'clients_search_start') {
      // Запуск поиска внутри списка клиентов
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id);
      await adminHandler.startClientsListSearch(bot, chatId);
    } else if (data === 'clients_clear_search') {
      // Очистка поиска и возврат к полному списку
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id, { text: '🔄 Показываю всех клиентов...' });
      
      // Очищаем поиск из состояния
      const adminState = await adminHandler.getUserState(chatId);
      if (adminState && adminState.currentSearch) {
        delete adminState.currentSearch;
        await adminHandler.setUserState(chatId, adminState);
      }
      
      await adminHandler.showClientsList(bot, chatId, 0, '');
    } else if (data === 'clients_refresh') {
      // Обновление списка клиентов (с сохранением поиска если есть)
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id, { text: '🔄 Обновляю...' });
      
      // Получаем поисковый запрос из состояния пользователя
      const adminState = await adminHandler.getUserState(chatId);
      const search = adminState && adminState.currentSearch ? adminState.currentSearch : '';
      
      await adminHandler.showClientsList(bot, chatId, 0, search);
    } else if (data === 'clients_back') {
      // Назад в меню
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id);
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
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
        text: '❌ Неизвестная команда'
      });
    }
  } catch (error) {
    logger.error('Ошибка обработки callback query:', error);
    
    // Обрабатываем специфичные ошибки Telegram
    if (error.message && (
      error.message.includes('query is too old') ||
      error.message.includes('response timeout expired') ||
      error.message.includes('query ID is invalid')
    )) {
      logger.warn(`Callback query ${query.id} устарел, игнорируем ошибку`);
      return;
    }

    // Для других ошибок пытаемся ответить
    await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
      text: '❌ Произошла ошибка',
      show_alert: true
    });
  }
});

/**
 * Обработка подтверждения регистрации из группы
 */
async function handleApproveRegistration(bot, query) {
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const data = query.data;

  if (!chatId || !messageId) {
    logger.error('Невалидный query в handleApproveRegistration');
    await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
      text: '❌ Ошибка: невалидные данные запроса',
      show_alert: true
    });
    return;
  }

  try {
    // Извлекаем contact_id, user_chat_id и category_id из callback_data
    const parts = data.split('_');
    const contactId = parts[2];
    const userChatId = parts[3];
    const priceCategoryId = parts[4] || null; // category_id для прайс-листа (4 если Прайс 1, иначе null)

    // Проверяем, что contact_id валиден
    if (!contactId || contactId === 'null' || contactId === 'undefined') {
      logger.error(`Невалидный contact_id в callback query: ${contactId}`);
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
        text: '❌ Ошибка: contact_id не найден. Невозможно создать ЛК.',
        show_alert: true
      });
      return;
    }

    await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
      text: '⏳ Создаю ЛК...'
    });

    // Если category_id не передан в callback, пытаемся получить из БД
    let finalPriceCategoryId = priceCategoryId === '0' ? null : priceCategoryId;
    if (!finalPriceCategoryId || finalPriceCategoryId === '0') {
      try {
        const clientInfo = await database.getClientByContactId(contactId);
        if (clientInfo && clientInfo.price_list === 'Прайс 1 (+1.5%)') {
          finalPriceCategoryId = '4';
        } else {
          finalPriceCategoryId = null; // Обычный прайс - только категория 2 будет добавлена на сервере
        }
      } catch (dbError) {
        logger.warn(`Не удалось получить информацию о клиенте из БД: ${dbError.message}`);
        // Продолжаем с null
        finalPriceCategoryId = null;
      }
    }
    
    // Отправляем запрос на создание ЛК
    // На сервере автоматически добавится категория 2 ("Цены видны") для ВСЕХ
    // Если finalPriceCategoryId = 4, дополнительно добавится категория 4 ("Цена Прайс лист1")
    const result = await createLKService.createLK(contactId, finalPriceCategoryId);

    if (result.success) {
      // Обновляем сообщение - убираем кнопки, добавляем статус
      const originalText = query.message.text;
      const updatedText = originalText.replace(
        '✅ Статус: Ожидает подтверждения',
        '✅ Статус: ПОДТВЕРЖДЕНО\n🔑 ЛК создан успешно'
      );

      // Проверяем, изменился ли текст
      if (updatedText !== originalText) {
        await telegramUtils.safeEditMessageText(bot, chatId, messageId, updatedText);
      }

      // Убираем кнопки
      await telegramUtils.safeEditMessageReplyMarkup(bot, chatId, messageId, { inline_keyboard: [] });

      // Уведомляем пользователя
      if (userChatId) {
        await telegramUtils.safeSendMessage(
          bot,
          userChatId,
          '✅ Регистрация подтверждена!\n\n' +
          'Личный кабинет создан. Данные для входа отправлены на указанный email.'
        );
      }

      logger.info(`ЛК создан для contact_id: ${contactId}`);
    } else {
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
        text: `❌ Ошибка: ${result.error}`,
        show_alert: true
      });

      logger.error(`Ошибка создания ЛК для contact_id ${contactId}: ${result.error}`);
    }
  } catch (error) {
    logger.error('Ошибка обработки подтверждения:', error);
    
    // Обрабатываем специфичные ошибки
    if (error.message && (
      error.message.includes('query is too old') ||
      error.message.includes('response timeout expired') ||
      error.message.includes('query ID is invalid')
    )) {
      logger.warn(`Callback query ${query.id} устарел в handleApproveRegistration`);
      return;
    }

    await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
      text: '❌ Произошла ошибка',
      show_alert: true
    });
  }
}

/**
 * Обработка отказа в регистрации из группы
 */
async function handleRejectRegistration(bot, query) {
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const data = query.data;

  if (!chatId || !messageId) {
    logger.error('Невалидный query в handleRejectRegistration');
    await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
      text: '❌ Ошибка: невалидные данные запроса',
      show_alert: true
    });
    return;
  }

  try {
    // Извлекаем user_chat_id из callback_data
    const parts = data.split('_');
    const contactId = parts[2];
    const userChatId = parts[3];

    await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
      text: 'Регистрация отклонена'
    });

    // Обновляем сообщение - убираем кнопки, добавляем статус
    const originalText = query.message.text;
    const updatedText = originalText.replace(
      '✅ Статус: Ожидает подтверждения',
      '❌ Статус: ОТКЛОНЕНО'
    );

    // Проверяем, изменился ли текст
    if (updatedText !== originalText) {
      await telegramUtils.safeEditMessageText(bot, chatId, messageId, updatedText);
    }

    // Убираем кнопки
    await telegramUtils.safeEditMessageReplyMarkup(bot, chatId, messageId, { inline_keyboard: [] });

    // Уведомляем пользователя
    if (userChatId) {
      await telegramUtils.safeSendMessage(
        bot,
        userChatId,
        '❌ К сожалению, регистрация отклонена.\n\n' +
        'Если у вас есть вопросы, обратитесь к администратору.'
      );
    }

    logger.info(`Регистрация отклонена для contact_id: ${contactId}`);
  } catch (error) {
    logger.error('Ошибка обработки отказа:', error);
    
    // Обрабатываем специфичные ошибки
    if (error.message && (
      error.message.includes('query is too old') ||
      error.message.includes('response timeout expired') ||
      error.message.includes('query ID is invalid')
    )) {
      logger.warn(`Callback query ${query.id} устарел в handleRejectRegistration`);
      return;
    }

    await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
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

  // Получаем текущее состояние пользователя (из registrationHandler и adminHandler)
  const state = await registrationHandler.getUserState(chatId);
  const adminState = await adminHandler.getUserState(chatId);

  try {
    // Проверка админа
    const isAdmin = registrationHandler.isAdmin(chatId);

    // СНАЧАЛА проверяем специальные кнопки, которые должны работать в любом состоянии
    if (text === '❌ Отменить регистрацию' || text === '⬅️ Назад в меню') {
      await registrationHandler.cancelRegistration(bot, chatId);
      return;
    }

    // ЗАТЕМ проверяем состояния (поиск, регистрация и т.д.)
    // Это важно, чтобы текст ввода обрабатывался правильно
    if (adminState && adminState.step === 'clients_list_searching') {
      // Поиск внутри списка клиентов
      await adminHandler.handleClientsListSearch(bot, msg);
      return;
    } else if (adminState && adminState.step === 'admin_searching_clients') {
      // Поиск клиентов для админа (отдельная кнопка)
      await adminHandler.handleClientSearch(bot, msg);
      return;
    } else if (state && state.step === 'awaiting_client_name') {
      await registrationHandler.handleClientNameInput(bot, msg);
      return;
    } else if (state && state.step === 'awaiting_phone') {
      await registrationHandler.handlePhoneInput(bot, msg);
      return;
    } else if (state && state.step === 'awaiting_email') {
      await registrationHandler.handleEmailInput(bot, msg);
      return;
    } else if (state && state.step === 'awaiting_price_list') {
      // Прайс-лист выбирается через inline-кнопки, не через текст
      await bot.sendMessage(
        chatId,
        'Пожалуйста, выберите прайс-лист из кнопок выше ⬆️',
        keyboards.getPriceListButtons()
      );
      return;
    }

    // ЗАТЕМ обрабатываем кнопки меню
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
    } else if (text === '🔍 Поиск клиентов') {
      // Только для админа
      if (registrationHandler.isAdmin(chatId)) {
        await adminHandler.startClientSearch(bot, chatId);
      } else {
        await bot.sendMessage(chatId, '❌ У вас нет прав для этой операции.');
      }
    } else if (text === '📊 Моя статистика') {
      await registrationHandler.showUserStats(bot, chatId);
    } else if (text === '❓ Помощь') {
      bot.emit('message', { ...msg, text: '/help' });
    } else {
      // Сначала проверяем админские состояния
      if (adminState && adminState.step === 'clients_list_searching') {
        // Поиск внутри списка клиентов
        await adminHandler.handleClientsListSearch(bot, msg);
      } else if (adminState && adminState.step === 'admin_searching_clients') {
        // Поиск клиентов для админа (отдельная кнопка)
        await adminHandler.handleClientSearch(bot, msg);
      } 
      // Затем проверяем состояния регистрации
      else if (state && state.step === 'awaiting_client_name') {
        await registrationHandler.handleClientNameInput(bot, msg);
      } else if (state && state.step === 'awaiting_phone') {
        await registrationHandler.handlePhoneInput(bot, msg);
      } else if (state && state.step === 'awaiting_email') {
        await registrationHandler.handleEmailInput(bot, msg);
      // Если дошли сюда - текст не распознан
      const isAdmin = registrationHandler.isAdmin(chatId);
      await bot.sendMessage(
        chatId,
        '🤔 Не понимаю. Используйте меню или /help для справки.',
        keyboards.getMainMenu(isAdmin)
      );
    }
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
  
  // Логируем детали ошибки
  if (reason instanceof Error) {
    logger.error('Error stack:', reason.stack);
  }
  
  // Не завершаем процесс, чтобы бот продолжал работать
  // Просто логируем ошибку
  logger.warn('Бот продолжает работу несмотря на необработанное отклонение промиса');
});

logger.info('✅ Бот готов к работе!');

