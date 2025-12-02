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
  removeKeyboard
};



