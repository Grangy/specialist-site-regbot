const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Сервис для сброса пароля клиента
 */
class ResetPasswordService {
  constructor() {
    this.apiUrl = config.resetPassword.url;
    this.token = config.resetPassword.token;
  }

  /**
   * Сброс пароля для клиента
   */
  async resetPassword(contactId, email) {
    try {
      logger.info(`Отправка запроса на сброс пароля для contact_id: ${contactId}, email: ${email}`);

      if (!this.token) {
        throw new Error('RESET_PASSWORD_API_TOKEN не настроен в .env');
      }

      if (!contactId) {
        throw new Error('contact_id не указан');
      }

      // Формируем данные для отправки
      const formData = new URLSearchParams();
      formData.append('token', this.token);
      formData.append('contact_id', contactId);
      if (email) {
        formData.append('email', email);
      }

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

      logger.info('Успешный ответ от reset_password_api:', response.data);

      return {
        success: true,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      logger.error('Ошибка при сбросе пароля:', {
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

module.exports = new ResetPasswordService();

