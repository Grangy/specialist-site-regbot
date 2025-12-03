const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Сервис для работы с API получения всех клиентов из БД сайта
 */
class CustomersApiService {
  constructor() {
    this.apiUrl = config.customersApi.url;
    this.token = config.customersApi.token;
  }

  /**
   * Получение списка всех клиентов с пагинацией
   * @param {number} page - Номер страницы (начиная с 0)
   * @param {number} limit - Количество клиентов на странице
   * @param {string} search - Поисковый запрос (опционально)
   * @returns {Promise<Object>} Результат с данными клиентов и пагинацией
   */
  async getCustomersList(page = 0, limit = 10, search = '') {
    try {
      logger.info(`Запрос списка клиентов: page=${page}, limit=${limit}, search="${search}"`);

      const params = new URLSearchParams();
      params.append('token', this.token);
      params.append('action', 'list');
      params.append('page', page);
      params.append('limit', limit);
      if (search) {
        params.append('search', search);
      }

      const response = await axios.get(
        `${this.apiUrl}?${params.toString()}`,
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        logger.info(`Получено ${response.data.data.length} клиентов из ${response.data.pagination.total}`);
        return {
          success: true,
          customers: response.data.data,
          pagination: response.data.pagination
        };
      } else {
        throw new Error(response.data.error || 'Unknown error');
      }
    } catch (error) {
      logger.error('Ошибка получения списка клиентов:', {
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

  /**
   * Получение информации о конкретном клиенте
   * @param {number} contactId - ID контакта
   * @returns {Promise<Object>} Данные клиента
   */
  async getCustomerById(contactId) {
    try {
      logger.info(`Запрос информации о клиенте: contact_id=${contactId}`);

      const params = new URLSearchParams();
      params.append('token', this.token);
      params.append('action', 'get');
      params.append('contact_id', contactId);

      const response = await axios.get(
        `${this.apiUrl}?${params.toString()}`,
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success && response.data.data.length > 0) {
        logger.info(`Получена информация о клиенте ${contactId}`);
        return {
          success: true,
          customer: response.data.data[0]
        };
      } else {
        throw new Error('Customer not found');
      }
    } catch (error) {
      logger.error('Ошибка получения информации о клиенте:', {
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

  /**
   * Поиск клиентов по имени
   * @param {string} searchQuery - Поисковый запрос
   * @param {number} limit - Максимальное количество результатов
   * @returns {Promise<Object>} Результаты поиска
   */
  async searchCustomers(searchQuery, limit = 50) {
    try {
      logger.info(`Поиск клиентов: query="${searchQuery}", limit=${limit}`);

      const params = new URLSearchParams();
      params.append('token', this.token);
      params.append('action', 'list');
      params.append('page', 0);
      params.append('limit', limit);
      params.append('search', searchQuery);

      const response = await axios.get(
        `${this.apiUrl}?${params.toString()}`,
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        logger.info(`Найдено ${response.data.data.length} клиентов по запросу "${searchQuery}"`);
        return {
          success: true,
          customers: response.data.data,
          total: response.data.pagination.total
        };
      } else {
        throw new Error(response.data.error || 'Unknown error');
      }
    } catch (error) {
      logger.error('Ошибка поиска клиентов:', {
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

module.exports = new CustomersApiService();

