const database = require('../database/database');
const resetPasswordService = require('../services/resetPasswordService');
const logger = require('../utils/logger');
const keyboards = require('../keyboards/keyboards');
const config = require('../config/config');

/**
 * Обработчик админских функций
 */
class AdminHandler {
  /**
   * Показ списка всех зарегистрированных клиентов
   */
  async showClientsList(bot, chatId, page = 0) {
    try {
      const pageSize = 10;
      const offset = page * pageSize;

      const clients = await database.getAllRegisteredClients(pageSize, offset);
      const totalCount = await database.getRegisteredClientsCount();
      const totalPages = Math.ceil(totalCount / pageSize);
      const hasMore = (page + 1) * pageSize < totalCount;

      if (clients.length === 0) {
        await bot.sendMessage(
          chatId,
          '📋 Список клиентов пуст.\n\nЗарегистрированных клиентов пока нет.',
          keyboards.getMainMenu(true)
        );
        return;
      }

      let message = `👥 Список зарегистрированных клиентов\n\n`;
      message += `Всего: ${totalCount} клиентов\n`;
      message += `Страница ${page + 1} из ${totalPages || 1}\n\n`;

      clients.forEach((client, index) => {
        const num = offset + index + 1;
        const date = new Date(client.created_at);
        const priceList = client.price_list ? `\n   📋 ${client.price_list}` : '';
        
        message += `${num}. ${client.client_name}\n`;
        message += `   📧 ${client.email || 'Не указан'}\n`;
        message += `   📱 ${client.phone || 'Не указан'}\n`;
        message += `   🔢 ${client.client_code || 'Не указан'}${priceList}\n`;
        message += `   📅 ${date.toLocaleString('ru-RU')}\n`;
        message += `   [Действия](callback:client_${client.contact_id})\n\n`;
      });

      // Создаём inline-кнопки для каждого клиента
      const inlineButtons = clients.map(client => {
        const clientName = client.client_name.length > 30 
          ? client.client_name.substring(0, 27) + '...' 
          : client.client_name;
        return [{
          text: `👤 ${clientName}`,
          callback_data: `client_info_${client.contact_id}`
        }];
      });

      // Добавляем навигацию
      const navButtons = [];
      if (page > 0) {
        navButtons.push({ text: '⬅️ Назад', callback_data: `clients_page_${page - 1}` });
      }
      if (hasMore) {
        navButtons.push({ text: 'Вперёд ➡️', callback_data: `clients_page_${page + 1}` });
      }
      if (navButtons.length > 0) {
        inlineButtons.push(navButtons);
      }

      inlineButtons.push([
        { text: '🔄 Обновить', callback_data: 'clients_refresh' },
        { text: '⬅️ Назад в меню', callback_data: 'clients_back' }
      ]);

      await bot.sendMessage(
        chatId,
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: inlineButtons
          }
        }
      );

      logger.info(`Админ ${chatId} просматривает список клиентов, страница ${page + 1}`);
    } catch (error) {
      logger.error('Ошибка получения списка клиентов:', error);
      await bot.sendMessage(
        chatId,
        '❌ Ошибка получения списка клиентов',
        keyboards.getMainMenu(true)
      );
    }
  }

  /**
   * Показ информации о клиенте
   */
  async showClientInfo(bot, query) {
    const chatId = query.message.chat.id;
    const contactId = query.data.split('_')[2];

    try {
      const client = await database.getClientByContactId(contactId);

      if (!client) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Клиент не найден',
          show_alert: true
        });
        return;
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

      await bot.answerCallbackQuery(query.id);

      await bot.sendMessage(
        chatId,
        message,
        keyboards.getClientActionsButtons(contactId)
      );

      logger.info(`Админ ${chatId} просматривает информацию о клиенте ${contactId}`);
    } catch (error) {
      logger.error('Ошибка получения информации о клиенте:', error);
      await bot.answerCallbackQuery(query.id, {
        text: '❌ Ошибка получения информации',
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
      const client = await database.getClientByContactId(contactId);

      if (!client) {
        await bot.answerCallbackQuery(query.id, {
          text: '❌ Клиент не найден',
          show_alert: true
        });
        return;
      }

      await bot.answerCallbackQuery(query.id, {
        text: '⏳ Сбрасываю пароль...'
      });

      // Отправляем запрос на сброс пароля
      const result = await resetPasswordService.resetPassword(contactId, client.email);

      if (result.success) {
        await bot.sendMessage(
          chatId,
          `✅ Пароль успешно сброшен!\n\n` +
          `Новый пароль отправлен на email:\n` +
          `📧 ${client.email}\n\n` +
          `Клиент: ${client.client_name}`,
          keyboards.getMainMenu(true)
        );

        logger.info(`Админ ${chatId} сбросил пароль для клиента ${contactId} (${client.email})`);
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
        text: '❌ Произошла ошибка',
        show_alert: true
      });
    }
  }
}

module.exports = new AdminHandler();

