const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Сервис для создания ЛК через API
 */
class CreateLKService {
  constructor() {
    this.apiUrl = config.createLK.url;
    this.token = config.createLK.token;
  }

  /**
   * Создание ЛК для клиента
   */
  async createLK(contactId) {
    try {
      logger.info(`Отправка запроса на создание ЛК для contact_id: ${contactId}`);

      if (!this.token) {
        throw new Error('CREATE_LK_API_TOKEN не настроен в .env');
      }

      if (!contactId) {
        throw new Error('contact_id не указан');
      }

      // Формируем данные для отправки
      const formData = new URLSearchParams();
      formData.append('token', this.token);
      formData.append('contact_id', contactId);

      // Отправляем POST запрос
      const response = await axios.post(
        this.apiUrl,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000 // 10 секунд
        }
      );

      logger.info('Успешный ответ от create_lk_api:', response.data);

      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      logger.error('Ошибка при создании ЛК:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      return {
        success: false,
        error: error.message,
        details: error.response?.data || null,
        status: error.response?.status || 500
      };
    }
  }
}

module.exports = new CreateLKService();



