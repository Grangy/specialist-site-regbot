const fs = require('fs');
const Fuse = require('fuse.js');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Сервис для работы с клиентами
 */
class ClientService {
  constructor() {
    this.clients = [];
    this.fuse = null;
    this.loadClients();
  }

  /**
   * Загрузка клиентов из JSON файла
   */
  loadClients() {
    try {
      const data = fs.readFileSync(config.clients.jsonPath, 'utf8');
      this.clients = JSON.parse(data);
      
      // Настраиваем Fuse.js для нечеткого поиска
      const fuseOptions = {
        keys: ['name', 'manager'],
        threshold: 0.4, // Чувствительность поиска (0 - точное совпадение, 1 - любое)
        distance: 100,
        includeScore: true,
        minMatchCharLength: 2
      };
      
      this.fuse = new Fuse(this.clients, fuseOptions);
      logger.info(`Загружено ${this.clients.length} клиентов`);
    } catch (error) {
      logger.error('Ошибка загрузки клиентов:', error);
      this.clients = [];
    }
  }

  /**
   * Перезагрузка клиентов
   */
  reloadClients() {
    this.loadClients();
  }

  /**
   * Поиск клиентов по запросу
   */
  searchClients(query, limit = 5) {
    if (!query || query.length < 2) {
      return [];
    }

    const results = this.fuse.search(query);
    return results.slice(0, limit).map(result => ({
      ...result.item,
      score: result.score
    }));
  }

  /**
   * Получение клиента по коду
   */
  getClientByCode(code) {
    return this.clients.find(client => client.code === code);
  }

  /**
   * Получение клиента по ID
   */
  getClientById(id) {
    return this.clients.find(client => client.id === parseInt(id));
  }

  /**
   * Получение всех клиентов
   */
  getAllClients() {
    return this.clients;
  }

  /**
   * Валидация данных клиента
   */
  validateClient(client) {
    if (!client.name || client.name.trim() === '') {
      return { valid: false, error: 'Отсутствует наименование клиента' };
    }
    if (!client.code || client.code.trim() === '') {
      return { valid: false, error: 'Отсутствует код клиента' };
    }
    return { valid: true };
  }
}

module.exports = new ClientService();



