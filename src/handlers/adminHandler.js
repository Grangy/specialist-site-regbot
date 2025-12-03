const database = require('../database/database');
const resetPasswordService = require('../services/resetPasswordService');
const customersApiService = require('../services/customersApiService');
const logger = require('../utils/logger');
const keyboards = require('../keyboards/keyboards');
const config = require('../config/config');

/**
 * Обработчик админских функций
 */
class AdminHandler {
  constructor() {
    this.userStates = new Map(); // Для хранения состояний админа (поиск, пагинация и т.д.)
  }
  /**
   * Показ списка всех клиентов из БД сайта
   */
  async showClientsList(bot, chatId, page = 0, search = '') {
    try {
      const result = await customersApiService.getCustomersList(page, 10, search);

      if (!result.success) {
        throw new Error(result.error || 'Ошибка получения списка клиентов');
      }

      const customers = result.customers;
      const pagination = result.pagination;

      if (customers.length === 0) {
        const message = search 
          ? `🔍 По запросу "${search}" ничего не найдено.\n\nПопробуйте изменить поисковый запрос.`
          : '📋 Список клиентов пуст.';
        
        await bot.sendMessage(
          chatId,
          message,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔍 Поиск', callback_data: 'clients_search_start' }],
                [{ text: '⬅️ Назад в меню', callback_data: 'clients_back' }]
              ]
            }
          }
        );
        return;
      }

      let message = `👥 Список клиентов из БД сайта\n\n`;
      if (search) {
        message += `🔍 Поиск: "${search}"\n`;
      }
      message += `Всего: ${pagination.total} клиентов\n`;
      message += `Страница ${pagination.page + 1} из ${pagination.total_pages}\n\n`;

      customers.forEach((customer, index) => {
        const num = pagination.page * pagination.limit + index + 1;
        const date = customer.created_at ? new Date(customer.created_at).toLocaleString('ru-RU') : 'Не указана';
        const priceList = customer.price_list ? `\n   📋 ${customer.price_list}` : '';
        
        message += `${num}. ${customer.name}\n`;
        message += `   📧 ${customer.email || 'Не указан'}\n`;
        message += `   📱 ${customer.phone || 'Не указан'}\n`;
        message += `   🔢 ${customer.kodv1s || 'Не указан'}${priceList}\n`;
        message += `   📅 ${date}\n\n`;
      });

      // Создаём inline-кнопки для каждого клиента
      const inlineButtons = customers.map(customer => {
        const clientName = customer.name.length > 30 
          ? customer.name.substring(0, 27) + '...' 
          : customer.name;
        return [{
          text: `👤 ${clientName}`,
          callback_data: `client_info_${customer.contact_id}`
        }];
      });

      // Добавляем навигацию
      const navButtons = [];
      if (pagination.page > 0) {
        navButtons.push({ 
          text: '⬅️ Назад', 
          callback_data: `clients_page_${pagination.page - 1}${search ? `_search_${encodeURIComponent(search)}` : ''}` 
        });
      }
      if (pagination.page + 1 < pagination.total_pages) {
        navButtons.push({ 
          text: 'Вперёд ➡️', 
          callback_data: `clients_page_${pagination.page + 1}${search ? `_search_${encodeURIComponent(search)}` : ''}` 
        });
      }
      if (navButtons.length > 0) {
        inlineButtons.push(navButtons);
      }

      // Кнопки управления
      const controlButtons = [];
      controlButtons.push({ text: '🔍 Поиск', callback_data: 'clients_search_start' });
      controlButtons.push({ text: '🔄 Обновить', callback_data: search ? `clients_refresh_search_${encodeURIComponent(search)}` : 'clients_refresh' });
      if (search) {
        controlButtons.push({ text: '❌ Очистить поиск', callback_data: 'clients_clear_search' });
      }
      inlineButtons.push(controlButtons);
      
      inlineButtons.push([
        { text: '⬅️ Назад в меню', callback_data: 'clients_back' }
      ]);

      await bot.sendMessage(
        chatId,
        message,
        {
          reply_markup: {
            inline_keyboard: inlineButtons
          }
        }
      );

      logger.info(`Админ ${chatId} просматривает список клиентов, страница ${pagination.page + 1}, поиск: "${search}"`);
    } catch (error) {
      logger.error('Ошибка получения списка клиентов:', error);
      await bot.sendMessage(
        chatId,
        `❌ Ошибка получения списка клиентов:\n${error.message}`,
        keyboards.getMainMenu(true)
      );
    }
  }

  /**
   * Запуск поиска клиентов для админа (отдельная кнопка)
   * Поиск выполняется по всем клиентам сайта через API
   */
  async startClientSearch(bot, chatId) {
    try {
      await this.setUserState(chatId, { step: 'admin_searching_clients' });
      
      await bot.sendMessage(
        chatId,
        '🔍 Поиск по всем клиентам сайта\n\n' +
        'Введите название клиента для поиска:\n\n' +
        'Поиск выполняется по всей базе клиентов сайта.',
        keyboards.getBackButton()
      );

      logger.info(`Админ ${chatId} начал поиск по всем клиентам сайта`);
    } catch (error) {
      logger.error('Ошибка запуска поиска клиентов:', error);
      await bot.sendMessage(
        chatId,
        '❌ Ошибка запуска поиска',
        keyboards.getMainMenu(true)
      );
    }
  }

  /**
   * Запуск поиска внутри списка клиентов
   * Поиск выполняется по всем клиентам сайта через API
   */
  async startClientsListSearch(bot, chatId) {
    try {
      await this.setUserState(chatId, { step: 'clients_list_searching' });
      
      await bot.sendMessage(
        chatId,
        '🔍 Поиск по всем клиентам сайта\n\n' +
        'Введите название клиента для поиска:\n\n' +
        'Поиск выполняется по всей базе клиентов сайта.\n' +
        'Для отмены нажмите /cancel',
        keyboards.getBackButton()
      );

      logger.info(`Админ ${chatId} начал поиск в списке клиентов (по всем клиентам сайта)`);
    } catch (error) {
      logger.error('Ошибка запуска поиска в списке клиентов:', error);
      await bot.sendMessage(
        chatId,
        '❌ Ошибка запуска поиска',
        keyboards.getMainMenu(true)
      );
    }
  }

  /**
   * Обработка поискового запроса в списке клиентов
   */
  async handleClientsListSearch(bot, msg) {
    const chatId = msg.chat.id;
    const searchQuery = msg.text.trim();

    try {
      if (searchQuery.length < 2) {
        await bot.sendMessage(
          chatId,
          '❌ Поисковый запрос должен содержать минимум 2 символа.\n\nПопробуйте ещё раз:',
          keyboards.getBackButton()
        );
        return;
      }

      await bot.sendMessage(chatId, '⏳ Ищу клиентов в БД сайта...');

      // Используем API для поиска по ВСЕМ клиентам сайта (не только зарегистрированным через бота)
      // Показываем результаты в формате списка с пагинацией (первая страница)
      await this.showClientsList(bot, chatId, 0, searchQuery);
      
      await this.clearUserState(chatId);
      logger.info(`Админ ${chatId} выполнил поиск в списке по всем клиентам сайта через API: "${searchQuery}"`);
    } catch (error) {
      logger.error('Ошибка поиска в списке клиентов:', error);
      await bot.sendMessage(
        chatId,
        `❌ Ошибка поиска:\n${error.message}`,
        keyboards.getBackButton()
      );
      await this.clearUserState(chatId);
    }
  }

  /**
   * Обработка поискового запроса админа (использует API для поиска по всем клиентам сайта)
   */
  async handleClientSearch(bot, msg) {
    const chatId = msg.chat.id;
    const searchQuery = msg.text.trim();

    try {
      if (searchQuery.length < 2) {
        await bot.sendMessage(
          chatId,
          '❌ Поисковый запрос должен содержать минимум 2 символа.\n\nПопробуйте ещё раз:',
          keyboards.getBackButton()
        );
        return;
      }

      await bot.sendMessage(chatId, '⏳ Ищу клиентов в БД сайта...');

      // Используем API для поиска по ВСЕМ клиентам сайта (не только зарегистрированным через бота)
      // Показываем результаты в формате списка с пагинацией (первая страница)
      await this.showClientsList(bot, chatId, 0, searchQuery);
      
      await this.clearUserState(chatId);
      logger.info(`Админ ${chatId} выполнил поиск по всем клиентам сайта через API: "${searchQuery}"`);
    } catch (error) {
      logger.error('Ошибка поиска клиентов:', error);
      await bot.sendMessage(
        chatId,
        `❌ Ошибка поиска:\n${error.message}`,
        keyboards.getBackButton()
      );
      await this.clearUserState(chatId);
    }
  }

  /**
   * Получение состояния пользователя
   */
  async getUserState(chatId) {
    return this.userStates.get(chatId);
  }

  /**
   * Установка состояния пользователя
   */
  async setUserState(chatId, state) {
    this.userStates.set(chatId, state);
  }

  /**
   * Очистка состояния пользователя
   */
  async clearUserState(chatId) {
    this.userStates.delete(chatId);
  }

  /**
   * Показ информации о клиенте
   */
  async showClientInfo(bot, query) {
    const chatId = query.message.chat.id;
    const contactId = query.data.split('_')[2];

    try {
      await bot.answerCallbackQuery(query.id, {
        text: '⏳ Загружаю информацию...'
      });

      // Получаем информацию о клиенте из API
      const result = await customersApiService.getCustomerById(contactId);

      if (!result.success || !result.customer) {
        // Пробуем получить из локальной БД (для обратной совместимости)
        const client = await database.getClientByContactId(contactId);
        if (!client) {
          throw new Error('Клиент не найден');
        }

        const date = new Date(client.created_at);
        const priceList = client.price_list ? `\n📋 Прайс-лист: ${client.price_list}` : '';

        const message = 
          `👤 Информация о клиенте\n\n` +
          `Название: ${client.client_name}\n` +
          `🔢 Код 1С: ${client.client_code || 'Не указан'}\n` +
          `📧 Email: ${client.email || 'Не указан'}\n` +
          `📱 Телефон: ${client.phone || 'Не указан'}${priceList}\n` +
          `🆔 Contact ID: ${client.contact_id}\n` +
          `📅 Дата регистрации: ${date.toLocaleString('ru-RU')}`;

        await bot.sendMessage(
          chatId,
          message,
          keyboards.getClientActionsButtons(contactId)
        );
        return;
      }

      const customer = result.customer;
      const date = customer.created_at ? new Date(customer.created_at).toLocaleString('ru-RU') : 'Не указана';
      const priceList = customer.price_list ? `\n📋 Прайс-лист: ${customer.price_list}` : '';

      const message = 
        `👤 Информация о клиенте\n\n` +
        `Название: ${customer.name}\n` +
        `🔢 Код 1С: ${customer.kodv1s || 'Не указан'}\n` +
        `📧 Email: ${customer.email || 'Не указан'}\n` +
        `📱 Телефон: ${customer.phone || 'Не указан'}${priceList}\n` +
        `🆔 Contact ID: ${customer.contact_id}\n` +
        `📅 Дата создания: ${date}`;

      await bot.sendMessage(
        chatId,
        message,
        keyboards.getClientActionsButtons(contactId)
      );

      logger.info(`Админ ${chatId} просматривает информацию о клиенте ${contactId}`);
    } catch (error) {
      logger.error('Ошибка получения информации о клиенте:', error);
      await bot.answerCallbackQuery(query.id, {
        text: `❌ Ошибка: ${error.message}`,
        show_alert: true
      });
    }
  }

  /**
   * Сброс пароля клиента
   */
  async resetClientPassword(bot, query) {
    const chatId = query.message.chat.id;
    const contactId = query.data.split('_')[2];

    try {
      await bot.answerCallbackQuery(query.id, {
        text: '⏳ Сбрасываю пароль...'
      });

      // Получаем информацию о клиенте из API
      const customerResult = await customersApiService.getCustomerById(contactId);
      
      let email = null;
      let customerName = null;

      if (customerResult.success && customerResult.customer) {
        email = customerResult.customer.email;
        customerName = customerResult.customer.name;
      } else {
        // Пробуем получить из локальной БД (для обратной совместимости)
        const client = await database.getClientByContactId(contactId);
        if (client) {
          email = client.email;
          customerName = client.client_name;
        }
      }

      if (!email) {
        throw new Error('Email клиента не найден. Невозможно сбросить пароль.');
      }

      // Отправляем запрос на сброс пароля
      const result = await resetPasswordService.resetPassword(contactId, email);

      if (result.success) {
        await bot.sendMessage(
          chatId,
          `✅ Пароль успешно сброшен!\n\n` +
          `Новый пароль отправлен на email:\n` +
          `📧 ${email}\n\n` +
          `Клиент: ${customerName || 'Неизвестно'}`,
          keyboards.getMainMenu(true)
        );

        logger.info(`Админ ${chatId} сбросил пароль для клиента ${contactId} (${email})`);
      } else {
        await bot.sendMessage(
          chatId,
          `❌ Ошибка сброса пароля:\n${result.error}\n\n` +
          `Попробуйте позже или обратитесь к разработчику.`,
          keyboards.getMainMenu(true)
        );

        logger.error(`Ошибка сброса пароля для ${contactId}: ${result.error}`);
      }
    } catch (error) {
      logger.error('Ошибка сброса пароля:', error);
      await bot.answerCallbackQuery(query.id, {
        text: `❌ Ошибка: ${error.message}`,
        show_alert: true
      });
    }
  }
}

module.exports = new AdminHandler();

