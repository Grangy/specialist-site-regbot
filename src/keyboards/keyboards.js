/**
 * Модуль с клавиатурами для бота
 */

/**
 * Главное меню
 */
function getMainMenu(isAdmin = false) {
  const keyboard = [
    ['🔍 Найти клиента']
  ];

  if (isAdmin) {
    keyboard.push(['⚡ Рег. без подтверждения']);
    keyboard.push(['👥 Список клиентов', '🔍 Поиск клиентов']);
  }

  keyboard.push(['📊 Моя статистика', '❓ Помощь']);

  return {
    reply_markup: {
      keyboard: keyboard,
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
}

/**
 * Меню с кнопкой назад
 */
function getBackButton() {
  return {
    reply_markup: {
      keyboard: [
        ['⬅️ Назад в меню']
      ],
      resize_keyboard: true
    }
  };
}

/**
 * Меню отмены
 */
function getCancelButton() {
  return {
    reply_markup: {
      keyboard: [
        ['❌ Отменить регистрацию']
      ],
      resize_keyboard: true
    }
  };
}

/**
 * Inline кнопки для выбора клиента
 */
function getClientSelectionButtons(clients) {
  const buttons = clients.map((client, index) => {
    return [{
      text: `${index + 1}. ${client.name}${client.manager ? ` (${client.manager})` : ''}`,
      callback_data: `select_client_${client.id}`
    }];
  });

  // Добавляем кнопку "Назад"
  buttons.push([{
    text: '⬅️ Новый поиск',
    callback_data: 'new_search'
  }]);

  return {
    reply_markup: {
      inline_keyboard: buttons
    }
  };
}

/**
 * Inline кнопки подтверждения
 */
function getConfirmationButtons(sessionId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Да, всё верно', callback_data: 'confirm_registration' },
          { text: '❌ Отменить', callback_data: 'cancel_registration' }
        ]
      ]
    }
  };
}

/**
 * Inline кнопки после успешной регистрации
 */
function getAfterRegistrationButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔍 Зарегистрировать ещё', callback_data: 'new_registration' }
        ],
        [
          { text: '📊 Моя статистика', callback_data: 'show_stats' }
        ]
      ]
    }
  };
}

/**
 * Inline кнопки для выбора прайс-листа
 */
function getPriceListButtons() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📋 Прайс', callback_data: 'price_list_default' }
        ],
        [
          { text: '📋 Прайс 1 (+1.5%)', callback_data: 'price_list_1' }
        ]
      ]
    }
  };
}

/**
 * Inline кнопки для списка клиентов (пагинация)
 */
function getClientsListButtons(page, totalPages, hasMore) {
  const buttons = [];
  
  if (totalPages > 1) {
    const navButtons = [];
    if (page > 0) {
      navButtons.push({ text: '⬅️ Назад', callback_data: `clients_page_${page - 1}` });
    }
    if (hasMore) {
      navButtons.push({ text: 'Вперёд ➡️', callback_data: `clients_page_${page + 1}` });
    }
    if (navButtons.length > 0) {
      buttons.push(navButtons);
    }
  }
  
  buttons.push([{ text: '🔄 Обновить', callback_data: 'clients_refresh' }]);
  buttons.push([{ text: '⬅️ Назад в меню', callback_data: 'clients_back' }]);
  
  return {
    reply_markup: {
      inline_keyboard: buttons
    }
  };
}

/**
 * Inline кнопки для клиента (сброс пароля)
 */
function getClientActionsButtons(contactId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🔑 Сбросить пароль', callback_data: `reset_password_${contactId}` }
        ],
        [
          { text: '⬅️ Назад к списку', callback_data: 'clients_back' }
        ]
      ]
    }
  };
}

/**
 * Удаление клавиатуры
 */
function removeKeyboard() {
  return {
    reply_markup: {
      remove_keyboard: true
    }
  };
}

module.exports = {
  getMainMenu,
  getBackButton,
  getCancelButton,
  getClientSelectionButtons,
  getConfirmationButtons,
  getAfterRegistrationButtons,
  getPriceListButtons,
  getClientsListButtons,
  getClientActionsButtons,
  removeKeyboard
};



