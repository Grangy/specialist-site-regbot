/**
 * Вспомогательные утилиты
 */

/**
 * Форматирование даты для отображения
 */
function formatDate(date) {
  if (typeof date === 'string') {
    date = new Date(date);
  }
  
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Экранирование специальных символов для Markdown
 */
function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

/**
 * Обрезка текста с добавлением многоточия
 */
function truncate(text, maxLength = 50) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Задержка выполнения
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Форматирование номера телефона для отображения
 */
function formatPhoneDisplay(phone) {
  if (!phone) return '';
  
  // Удаляем все кроме цифр
  const digits = phone.replace(/\D/g, '');
  
  // Форматируем как +7 (XXX) XXX-XX-XX
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  
  return phone;
}

/**
 * Генерация случайного ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Проверка является ли строка пустой или только пробелами
 */
function isEmpty(str) {
  return !str || str.trim().length === 0;
}

/**
 * Безопасное получение свойства объекта
 */
function safeGet(obj, path, defaultValue = null) {
  try {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj) || defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Валидация email (дополнительная)
 */
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Валидация телефона (дополнительная)
 */
function isValidPhone(phone) {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Склонение числительных
 */
function pluralize(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return few;
  } else {
    return many;
  }
}

/**
 * Форматирование числа клиентов
 */
function formatClientCount(count) {
  return `${count} ${pluralize(count, 'клиент', 'клиента', 'клиентов')}`;
}

/**
 * Проверка истечения времени сессии
 */
function isSessionExpired(timestamp, timeoutMs = 1800000) {
  const now = Date.now();
  const sessionTime = new Date(timestamp).getTime();
  return now - sessionTime > timeoutMs;
}

/**
 * Капитализация первой буквы
 */
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Удаление лишних пробелов
 */
function normalizeSpaces(str) {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
}

module.exports = {
  formatDate,
  escapeMarkdown,
  truncate,
  sleep,
  formatPhoneDisplay,
  generateId,
  isEmpty,
  safeGet,
  isValidEmail,
  isValidPhone,
  pluralize,
  formatClientCount,
  isSessionExpired,
  capitalize,
  normalizeSpaces
};



