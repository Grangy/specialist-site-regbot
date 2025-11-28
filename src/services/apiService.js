const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Сервис для работы с API specialist82.pro
 */
class ApiService {
  constructor() {
    this.apiUrl = config.api.url;
    this.accessToken = config.api.accessToken;
  }

  /**
   * Регистрация клиента через API с retry
   */
  async registerCustomer(data, retryCount = 0, maxRetries = 3) {
    try {
      logger.info('Отправка запроса на регистрацию клиента:', {
        name: data.name,
        code: data.code,
        attempt: retryCount + 1
      });

      // Формируем данные для отправки
      const formData = new URLSearchParams();
      formData.append('data[name]', data.name);
      formData.append('data[email][0][value]', data.email);
      formData.append('data[email][0][ext]', 'work');
      formData.append('data[phone][0][value]', data.phone);
      formData.append('data[phone][0][ext]', 'mobile');
      formData.append('data[kodv1s]', data.code);

      // Отправляем POST запрос
      const response = await axios.post(
        `${this.apiUrl}?access_token=${this.accessToken}`,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 15000, // 15 секунд
          // Отключаем строгую проверку SSL если есть проблемы
          httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: true,
            keepAlive: true
          })
        }
      );

      logger.info('Успешный ответ от API:', response.data);

      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      logger.error(`Ошибка регистрации клиента ${data.name}:`, error.message);

      // Проверяем, нужен ли retry
      const shouldRetry = this.shouldRetryError(error);
      
      if (shouldRetry && retryCount < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff
        logger.info(`Повторная попытка через ${delay}ms (попытка ${retryCount + 2}/${maxRetries + 1})`);
        
        await this.sleep(delay);
        return this.registerCustomer(data, retryCount + 1, maxRetries);
      }

      // Формируем понятное сообщение об ошибке
      const errorMessage = this.getErrorMessage(error);

      return {
        success: false,
        error: errorMessage,
        details: error.response?.data || null,
        status: error.response?.status || 500,
        originalError: error.message
      };
    }
  }

  /**
   * Проверка, нужен ли retry для ошибки
   */
  shouldRetryError(error) {
    // Retry для сетевых ошибок
    if (error.code === 'ECONNABORTED') return true;
    if (error.code === 'ETIMEDOUT') return true;
    if (error.code === 'ENOTFOUND') return false; // DNS ошибка - retry не поможет
    if (error.code === 'ECONNREFUSED') return true;
    if (error.message.includes('socket disconnected')) return true;
    if (error.message.includes('TLS')) return true;
    
    // Retry для временных ошибок сервера
    if (error.response) {
      const status = error.response.status;
      return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
    }
    
    return false;
  }

  /**
   * Получение понятного сообщения об ошибке
   */
  getErrorMessage(error) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return 'Превышено время ожидания ответа от сервера';
    }
    
    if (error.code === 'ENOTFOUND') {
      return 'Сервер не найден. Проверьте URL API';
    }
    
    if (error.code === 'ECONNREFUSED') {
      return 'Сервер отклонил соединение';
    }
    
    if (error.message.includes('socket disconnected') || error.message.includes('TLS')) {
      return 'Ошибка SSL/TLS соединения с сервером';
    }
    
    if (error.response) {
      const status = error.response.status;
      if (status === 400) return 'Некорректные данные запроса';
      if (status === 401) return 'Ошибка авторизации API';
      if (status === 403) return 'Доступ запрещён';
      if (status === 404) return 'Метод API не найден';
      if (status === 429) return 'Превышен лимит запросов';
      if (status >= 500) return 'Внутренняя ошибка сервера';
    }
    
    return error.message || 'Неизвестная ошибка при обращении к API';
  }

  /**
   * Задержка
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Валидация телефона
   */
  validatePhone(phone) {
    // Удаляем все символы кроме цифр и +
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    
    // Проверяем формат (начинается с + и содержит от 10 до 15 цифр)
    const phoneRegex = /^\+?\d{10,15}$/;
    
    if (!phoneRegex.test(cleanPhone)) {
      return {
        valid: false,
        error: 'Неверный формат телефона. Используйте формат: +79787599070'
      };
    }

    // Форматируем телефон
    let formattedPhone = cleanPhone;
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('8')) {
        formattedPhone = '+7' + formattedPhone.slice(1);
      } else if (formattedPhone.startsWith('7')) {
        formattedPhone = '+' + formattedPhone;
      } else {
        formattedPhone = '+' + formattedPhone;
      }
    }

    return {
      valid: true,
      phone: formattedPhone
    };
  }

  /**
   * Валидация email
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
      return {
        valid: false,
        error: 'Неверный формат email. Пример: user@example.com'
      };
    }

    return {
      valid: true,
      email: email.toLowerCase().trim()
    };
  }
}

module.exports = new ApiService();

