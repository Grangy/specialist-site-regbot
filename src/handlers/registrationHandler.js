const database = require('../database/database');
const clientService = require('../services/clientService');
const apiService = require('../services/apiService');
const createLKService = require('../services/createLKService');
const logger = require('../utils/logger');
const keyboards = require('../keyboards/keyboards');
const config = require('../config/config');
const telegramUtils = require('../utils/telegramUtils');

/**
 * Обработчик регистрации клиентов
 */
class RegistrationHandler {
  constructor() {
    // Храним состояния пользователей
    this.userStates = new Map();
  }

  /**
   * Получение состояния пользователя
   */
  async getUserState(chatId) {
    if (this.userStates.has(chatId)) {
      return this.userStates.get(chatId);
    }

    // Пытаемся загрузить из БД
    const session = await database.getSession(chatId);
    if (session) {
      this.userStates.set(chatId, session);
      return session;
    }

    return null;
  }

  /**
   * Установка состояния пользователя
   */
  async setUserState(chatId, state) {
    this.userStates.set(chatId, state);
    await database.saveSession(chatId, state);
  }

  /**
   * Очистка состояния пользователя
   */
  async clearUserState(chatId) {
    this.userStates.delete(chatId);
    await database.deleteSession(chatId);
  }

  /**
   * Начало поиска клиента
   */
  async startClientSearch(bot, chatId, withoutApproval = false) {
    await bot.sendMessage(
      chatId,
      '🔍 Поиск клиента\n\n' +
      'Введите наименование клиента или часть названия.\n' +
      'Я найду 5 наиболее подходящих вариантов.\n\n' +
      'Например: ООО, Рога, Копыта и т.д.',
      keyboards.getCancelButton()
    );

    await this.setUserState(chatId, {
      step: 'awaiting_client_name',
      clientName: null,
      clientCode: null,
      clientManager: null,
      phone: null,
      email: null,
      withoutApproval: withoutApproval // Флаг для регистрации без подтверждения
    });
  }

  /**
   * Обработка ввода названия клиента
   */
  async handleClientNameInput(bot, msg) {
    const chatId = msg.chat.id;
    const query = msg.text.trim();

    if (query.length < 2) {
      await bot.sendMessage(
        chatId,
        '⚠️ Введите минимум 2 символа для поиска.'
      );
      return;
    }

    // Ищем клиентов
    const clients = clientService.searchClients(query);

    if (clients.length === 0) {
      await bot.sendMessage(
        chatId,
        '😔 К сожалению, клиенты не найдены.\n\n' +
        'Попробуйте изменить запрос или проверьте правильность написания.',
        keyboards.getCancelButton()
      );
      return;
    }

    // Показываем найденных клиентов
    let message = `🔍 Найдено клиентов: ${clients.length}\n\n`;
    message += 'Выберите нужного клиента из списка ниже:';

    await bot.sendMessage(
      chatId,
      message,
      keyboards.getClientSelectionButtons(clients)
    );

    logger.info(`Найдено ${clients.length} клиентов для запроса: ${query}`);
  }

  /**
   * Обработка выбора клиента
   */
  async handleClientSelection(bot, query) {
    const chatId = query.message.chat.id;
    const clientId = parseInt(query.data.split('_')[2]);

    const client = clientService.getClientById(clientId);

    if (!client) {
      await bot.answerCallbackQuery(query.id, {
        text: '❌ Клиент не найден',
        show_alert: true
      });
      return;
    }

    // Получаем текущее состояние чтобы сохранить флаг withoutApproval
    const currentState = await this.getUserState(chatId);
    const withoutApproval = currentState ? currentState.withoutApproval : false;

    logger.info(`Выбор клиента ${client.name} пользователем ${chatId}, withoutApproval: ${withoutApproval}`);

    // Сохраняем выбранного клиента
    await this.setUserState(chatId, {
      step: 'awaiting_phone',
      clientName: client.name,
      clientCode: client.code,
      clientManager: client.manager,
      phone: null,
      email: null,
      priceList: null, // Прайс-лист
      withoutApproval: withoutApproval // Сохраняем флаг
    });

    await bot.answerCallbackQuery(query.id);

    await bot.sendMessage(
      chatId,
      `✅ Выбран клиент:\n\n` +
      `📋 Наименование: ${client.name}\n` +
      `🔢 Код: ${client.code}\n` +
      `👤 Менеджер: ${client.manager || 'Не указан'}\n\n` +
      `📱 Теперь введите номер телефона клиента:\n\n` +
      `Формат: +79787599070`,
      keyboards.getCancelButton()
    );

    logger.info(`Клиент ${client.name} выбран пользователем ${chatId}`);
  }

  /**
   * Обработка ввода телефона
   */
  async handlePhoneInput(bot, msg) {
    const chatId = msg.chat.id;
    const phone = msg.text.trim();

    const validation = apiService.validatePhone(phone);

    if (!validation.valid) {
      await bot.sendMessage(
        chatId,
        `❌ ${validation.error}\n\nПопробуйте ещё раз:`,
        keyboards.getCancelButton()
      );
      return;
    }

    // Обновляем состояние
    const state = await this.getUserState(chatId);
    if (!state) {
      await bot.sendMessage(chatId, '❌ Сессия истекла. Начните заново.', keyboards.getCancelButton());
      return;
    }
    
    state.phone = validation.phone;
    state.step = 'awaiting_email';
    // Сохраняем флаг withoutApproval если он был
    await this.setUserState(chatId, state);

    await bot.sendMessage(
      chatId,
      `✅ Телефон сохранен: ${validation.phone}\n\n` +
      `📧 Теперь введите email клиента:\n\n` +
      `Формат: user@example.com`,
      keyboards.getCancelButton()
    );
  }

  /**
   * Обработка ввода email
   */
  async handleEmailInput(bot, msg) {
    const chatId = msg.chat.id;
    const email = msg.text.trim();

    const validation = apiService.validateEmail(email);

    if (!validation.valid) {
      await bot.sendMessage(
        chatId,
        `❌ ${validation.error}\n\nПопробуйте ещё раз:`,
        keyboards.getCancelButton()
      );
      return;
    }

    // Обновляем состояние
    const state = await this.getUserState(chatId);
    if (!state) {
      await bot.sendMessage(chatId, '❌ Сессия истекла. Начните заново.', keyboards.getCancelButton());
      return;
    }
    
    state.email = validation.email;
    state.step = 'awaiting_price_list';
    await this.setUserState(chatId, state);

    // Показываем выбор прайс-листа
    await bot.sendMessage(
      chatId,
      `✅ Email сохранен: ${validation.email}\n\n` +
      `📋 Выберите прайс-лист для клиента:`,
      keyboards.getPriceListButtons()
    );
  }

  /**
   * Обработка выбора прайс-листа
   */
  async handlePriceListSelection(bot, query) {
    const chatId = query.message?.chat?.id;
    const data = query.data;

    if (!chatId) {
      logger.error('Невалидный query в handlePriceListSelection');
      return;
    }

    try {
      const state = await this.getUserState(chatId);
      if (!state) {
        await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
          text: '❌ Сессия истекла. Начните заново.',
          show_alert: true
        });
        return;
      }

      // Определяем выбранный прайс-лист
      let priceList = null;
      let priceListName = 'Прайс';
      
      if (data === 'price_list_1') {
        priceList = 4; // ID категории "Цена Прайс лист1"
        priceListName = 'Прайс 1 (+1.5%)';
      } else {
        priceList = null; // Обычный прайс без категории
        priceListName = 'Прайс';
      }

      state.priceList = priceList;
      state.priceListName = priceListName;

      await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
        text: `Выбран: ${priceListName}`
      });

      // Если регистрация без подтверждения - сразу регистрируем
      if (state.withoutApproval === true) {
        logger.info(`Регистрация без подтверждения для админа ${chatId}`);
        await this.registerWithoutApproval(bot, chatId, state);
        return;
      }

      // Иначе показываем сводку для подтверждения
      state.step = 'awaiting_confirmation';
      await this.setUserState(chatId, state);

      await bot.sendMessage(
        chatId,
        `📋 Проверьте данные перед регистрацией:\n\n` +
        `👤 Клиент: ${state.clientName}\n` +
        `🔢 Код 1С: ${state.clientCode}\n` +
        `👔 Менеджер: ${state.clientManager || 'Не указан'}\n` +
        `📱 Телефон: ${state.phone}\n` +
        `📧 Email: ${state.email}\n` +
        `📋 Прайс-лист: ${priceListName}\n\n` +
        `Всё верно?`,
        keyboards.getConfirmationButtons()
      );
    } catch (error) {
      logger.error('Ошибка в handlePriceListSelection:', error);
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
        text: '❌ Произошла ошибка',
        show_alert: true
      });
    }
  }

  /**
   * Подтверждение и отправка регистрации
   */
  async confirmRegistration(bot, query) {
    const chatId = query.message?.chat?.id;
    
    if (!chatId) {
      logger.error('Невалидный query в confirmRegistration');
      return;
    }

    try {
      const state = await this.getUserState(chatId);

      if (!state) {
        await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
          text: '❌ Сессия истекла. Начните заново.',
          show_alert: true
        });
        return;
      }

      await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
      text: '⏳ Отправляю данные...'
    });

    const statusMsg = await bot.sendMessage(
      chatId,
      '⏳ Регистрирую клиента на сайте...',
      keyboards.removeKeyboard()
    );

    // Отправляем запрос к API
    const result = await apiService.registerCustomer({
      name: state.clientName,
      code: state.clientCode,
      phone: state.phone,
      email: state.email,
      priceList: state.priceList || null
    });

    // Удаляем сообщение о загрузке
    try {
      await bot.deleteMessage(chatId, statusMsg.message_id);
    } catch (e) {
      // Игнорируем ошибку если не удалось удалить
    }

    // Сохраняем историю
    await database.saveRegistrationHistory(chatId, {
      clientName: state.clientName,
      clientCode: state.clientCode,
      phone: state.phone,
      email: state.email,
      priceListName: state.priceListName || null,
      apiResponse: result,
      status: result.success ? 'success' : 'error'
    });

    // Очищаем состояние
    await this.clearUserState(chatId);

    if (result.success) {
      await bot.sendMessage(
        chatId,
        `✅ Регистрация успешно завершена!\n\n` +
        `Клиент ${state.clientName} зарегистрирован на сайте.\n\n` +
        `Что делаем дальше?`,
        keyboards.getAfterRegistrationButtons()
      );

      logger.info(`Клиент ${state.clientName} успешно зарегистрирован пользователем ${chatId}`);

      // Отправляем уведомление в группу
      await this.sendGroupNotification(bot, chatId, state, result);
    } else {
      let errorMsg = `❌ Ошибка регистрации\n\n` +
        `К сожалению, произошла ошибка:\n` +
        `${result.error}\n\n`;
      
      // Добавляем рекомендации в зависимости от ошибки
      if (result.error.includes('SSL') || result.error.includes('TLS') || result.error.includes('соединения')) {
        errorMsg += `🔧 Рекомендации:\n`;
        errorMsg += `• Проверьте интернет-соединение\n`;
        errorMsg += `• Попробуйте через несколько минут\n`;
        errorMsg += `• Возможны технические работы на сервере\n\n`;
      } else if (result.error.includes('время ожидания')) {
        errorMsg += `⏱️ Сервер не ответил вовремя. Попробуйте ещё раз.\n\n`;
      } else if (result.error.includes('авторизации')) {
        errorMsg += `🔑 Проблема с авторизацией API. Обратитесь к администратору.\n\n`;
      }
      
      errorMsg += `Попробуйте позже или обратитесь к администратору.`;

      const isAdmin = this.isAdmin(chatId);
      await bot.sendMessage(
        chatId,
        errorMsg,
        keyboards.getMainMenu(isAdmin)
      );

      logger.error(`Ошибка регистрации клиента ${state.clientName}:`, {
        error: result.error,
        originalError: result.originalError,
        status: result.status
      });
    }
    } catch (error) {
      logger.error('Ошибка в confirmRegistration:', error);
      await telegramUtils.safeAnswerCallbackQuery(bot, query.id, {
        text: '❌ Произошла ошибка при регистрации',
        show_alert: true
      });
      
      // Пытаемся отправить сообщение об ошибке
      try {
        const isAdmin = this.isAdmin(chatId);
        await bot.sendMessage(
          chatId,
          '❌ Произошла ошибка. Попробуйте позже.',
          keyboards.getMainMenu(isAdmin)
        );
      } catch (e) {
        logger.error('Не удалось отправить сообщение об ошибке:', e);
      }
    }
  }

  /**
   * Отмена регистрации
   */
  async cancelRegistration(bot, chatId, fromCallback = false) {
    await this.clearUserState(chatId);

    const message = '❌ Регистрация отменена.\n\nВыберите действие из меню:';
    const isAdmin = this.isAdmin(chatId);

    if (fromCallback) {
      await bot.sendMessage(
        chatId,
        message,
        keyboards.getMainMenu(isAdmin)
      );
    } else {
      await bot.sendMessage(
        chatId,
        message,
        keyboards.getMainMenu(isAdmin)
      );
    }

    logger.info(`Регистрация отменена пользователем ${chatId}`);
  }

  /**
   * Показ статистики пользователя
   */
  async showUserStats(bot, chatId) {
    try {
      const history = await database.getRegistrationHistory(chatId, 10);
      const stats = await database.getStats();

      let message = `📊 Ваша статистика\n\n`;
      message += `✅ Успешных регистраций: ${history.filter(h => h.status === 'success').length}\n`;
      message += `❌ Неудачных попыток: ${history.filter(h => h.status === 'error').length}\n\n`;

      if (history.length > 0) {
        message += `📋 Последние регистрации:\n\n`;
        history.slice(0, 5).forEach((record, index) => {
          const date = new Date(record.created_at);
          const status = record.status === 'success' ? '✅' : '❌';
          message += `${status} ${record.client_name}\n`;
          message += `   📅 ${date.toLocaleString('ru-RU')}\n\n`;
        });
      }

      message += `\nВсего пользователей бота: ${stats.total_users}`;

      const isAdmin = this.isAdmin(chatId);
      await bot.sendMessage(
        chatId,
        message,
        keyboards.getMainMenu(isAdmin)
      );
    } catch (error) {
      logger.error('Ошибка получения статистики:', error);
      const isAdmin = this.isAdmin(chatId);
      await bot.sendMessage(
        chatId,
        '❌ Ошибка получения статистики',
        keyboards.getMainMenu(isAdmin)
      );
    }
  }

  /**
   * Отправка уведомления в группу о новой регистрации
   */
  async sendGroupNotification(bot, chatId, state, result) {
    try {
      const groupId = config.notifications.groupId;
      
      if (!groupId) {
        logger.warn('NOTIFICATION_GROUP_ID не настроен в .env');
        return;
      }

      // Получаем информацию о пользователе
      let userName = 'Неизвестен';
      try {
        const chat = await bot.getChat(chatId);
        userName = chat.first_name || chat.username || `ID: ${chatId}`;
        if (chat.last_name) {
          userName += ` ${chat.last_name}`;
        }
        if (chat.username) {
          userName += ` (@${chat.username})`;
        }
      } catch (e) {
        logger.warn('Не удалось получить информацию о пользователе:', e.message);
      }

      // Получаем contact_id из ответа API
      const contactId = result.data?.id || result.data?.contact_id || null;

      // Формируем сообщение для группы
      const priceListInfo = state.priceListName ? `\n📋 Прайс-лист: ${state.priceListName}` : '';
      const notificationMessage = 
        `🎉 НОВАЯ РЕГИСТРАЦИЯ НА САЙТЕ\n\n` +
        `👤 Клиент: ${state.clientName}\n` +
        `🔢 Код 1С: ${state.clientCode}\n` +
        `👔 Менеджер: ${state.clientManager || 'Не указан'}\n` +
        `📱 Телефон: ${state.phone}\n` +
        `📧 Email: ${state.email}${priceListInfo}\n\n` +
        `👨‍💼 Зарегистрировал: ${userName}\n` +
        `🕐 Время: ${new Date().toLocaleString('ru-RU')}\n` +
        `✅ Статус: Ожидает подтверждения`;

      // Inline кнопки для подтверждения/отказа
      // Передаём category_id в callback_data (4 если Прайс 1, иначе null)
      // На сервере автоматически добавится категория 2 ("Цены видны") для всех
      const priceCategoryIdForCallback = state.priceList === 4 ? '4' : '0';
      const keyboard = {
        inline_keyboard: [
          [
            {
              text: '✅ Подтвердить',
              callback_data: `approve_reg_${contactId}_${chatId}_${priceCategoryIdForCallback}`
            },
            {
              text: '❌ Отказать',
              callback_data: `reject_reg_${contactId}_${chatId}`
            }
          ]
        ]
      };

      await bot.sendMessage(groupId, notificationMessage, {
        reply_markup: keyboard
      });
      
      logger.info(`Уведомление о регистрации ${state.clientName} отправлено в группу ${groupId} с contact_id: ${contactId}`);
    } catch (error) {
      logger.error('Ошибка отправки уведомления в группу:', error.message);
      // Не прерываем процесс, если не удалось отправить уведомление
    }
  }

  /**
   * Регистрация без подтверждения (для админа)
   * Сразу создаёт ЛК и отправляет уведомление в группу без кнопок
   */
  async registerWithoutApproval(bot, chatId, state) {
    try {
      const statusMsg = await bot.sendMessage(
        chatId,
        '⏳ Регистрирую клиента и создаю ЛК...',
        keyboards.removeKeyboard()
      );

      // 1. Регистрируем клиента
      const registrationResult = await apiService.registerCustomer({
        name: state.clientName,
        code: state.clientCode,
        phone: state.phone,
        email: state.email,
        priceList: state.priceList || null
      });

      // Удаляем сообщение о загрузке
      try {
        await bot.deleteMessage(chatId, statusMsg.message_id);
      } catch (e) {
        // Игнорируем ошибку
      }

      if (!registrationResult.success) {
        await bot.sendMessage(
          chatId,
          `❌ Ошибка регистрации:\n${registrationResult.error}`,
          keyboards.getMainMenu(config.admin.id === chatId)
        );
        return;
      }

      // 2. Получаем contact_id
      const contactId = registrationResult.data?.id || registrationResult.data?.contact_id || null;

      if (!contactId) {
        await bot.sendMessage(
          chatId,
          `❌ Ошибка: не удалось получить contact_id из ответа API`,
          keyboards.getMainMenu(config.admin.id === chatId)
        );
        return;
      }

      // 3. Сразу создаём ЛК
      // На сервере автоматически добавится категория 2 ("Цены видны")
      // Если выбран Прайс 1, передаём category_id=4 для дополнительной категории
      const priceCategoryId = state.priceList === 4 ? '4' : null;
      const lkResult = await createLKService.createLK(contactId, priceCategoryId);

      // 4. Сохраняем историю
      await database.saveRegistrationHistory(chatId, {
        clientName: state.clientName,
        clientCode: state.clientCode,
        phone: state.phone,
        email: state.email,
        priceListName: state.priceListName || null,
        apiResponse: registrationResult,
        status: 'success'
      });

      // 5. Очищаем состояние
      await this.clearUserState(chatId);

      // 6. Отправляем уведомление в группу БЕЗ кнопок
      await this.sendGroupNotificationWithoutButtons(bot, chatId, state, registrationResult, lkResult);

      // 7. Уведомляем админа
      const priceListInfo = state.priceListName ? `\n📋 Прайс-лист: ${state.priceListName}` : '';
      let adminMessage = `✅ Регистрация завершена!\n\n` +
        `👤 Клиент: ${state.clientName}\n` +
        `🔢 Код 1С: ${state.clientCode}\n` +
        `📱 Телефон: ${state.phone}\n` +
        `📧 Email: ${state.email}${priceListInfo}\n\n`;

      if (lkResult.success) {
        adminMessage += `🔑 Личный кабинет создан успешно!\n\n`;
      } else {
        adminMessage += `⚠️ ЛК не создан: ${lkResult.error}\n\n`;
      }

      adminMessage += `Уведомление отправлено в группу.`;

      await bot.sendMessage(
        chatId,
        adminMessage,
        keyboards.getAfterRegistrationButtons()
      );

      logger.info(`Админ ${chatId} зарегистрировал ${state.clientName} без подтверждения. ЛК: ${lkResult.success ? 'создан' : 'ошибка'}`);
    } catch (error) {
      logger.error('Ошибка регистрации без подтверждения:', error);
      await bot.sendMessage(
        chatId,
        `❌ Произошла ошибка: ${error.message}`,
        keyboards.getMainMenu(config.admin.id === chatId)
      );
    }
  }

  /**
   * Отправка уведомления в группу БЕЗ кнопок (для админской регистрации)
   */
  async sendGroupNotificationWithoutButtons(bot, chatId, state, registrationResult, lkResult) {
    try {
      const groupId = config.notifications.groupId;
      
      if (!groupId) {
        logger.warn('NOTIFICATION_GROUP_ID не настроен в .env');
        return;
      }

      // Получаем информацию о пользователе
      let userName = 'Администратор';
      try {
        const chat = await bot.getChat(chatId);
        userName = chat.first_name || chat.username || `ID: ${chatId}`;
        if (chat.last_name) {
          userName += ` ${chat.last_name}`;
        }
        if (chat.username) {
          userName += ` (@${chat.username})`;
        }
        userName += ' [АДМИН]';
      } catch (e) {
        logger.warn('Не удалось получить информацию о пользователе:', e.message);
      }

      // Формируем сообщение для группы
      const priceListInfo = state.priceListName ? `\n📋 Прайс-лист: ${state.priceListName}` : '';
      let notificationMessage = 
        `🎉 НОВАЯ РЕГИСТРАЦИЯ НА САЙТЕ\n\n` +
        `👤 Клиент: ${state.clientName}\n` +
        `🔢 Код 1С: ${state.clientCode}\n` +
        `👔 Менеджер: ${state.clientManager || 'Не указан'}\n` +
        `📱 Телефон: ${state.phone}\n` +
        `📧 Email: ${state.email}${priceListInfo}\n\n` +
        `👨‍💼 Зарегистрировал: ${userName}\n` +
        `🕐 Время: ${new Date().toLocaleString('ru-RU')}\n` +
        `✅ Статус: ПОДТВЕРЖДЕНО И СОЗДАНО`;

      if (lkResult.success) {
        notificationMessage += `\n🔑 Личный кабинет создан`;
      } else {
        notificationMessage += `\n⚠️ ЛК не создан: ${lkResult.error}`;
      }

      await bot.sendMessage(groupId, notificationMessage);
      
      logger.info(`Уведомление о регистрации ${state.clientName} (без подтверждения) отправлено в группу ${groupId}`);
    } catch (error) {
      logger.error('Ошибка отправки уведомления в группу:', error.message);
    }
  }

  /**
   * Проверка является ли пользователь админом
   */
  isAdmin(chatId) {
    return config.admin.id && chatId === config.admin.id;
  }
}

module.exports = new RegistrationHandler();

