const ServerConnection = require('./serverConnection');
const logger = require('../src/utils/logger');
const axios = require('axios');

/**
 * Запуск скрипта recreateOrders.php и проверка логов
 */
class RunRecreateOrders {
  constructor() {
    this.server = new ServerConnection();
    this.scriptUrl = 'https://specialist82.pro/recreateOrders.php';
    this.token = 'SUPER_SECRET_TOKEN_123';
    this.logPath = '/var/www/specialist82_usr/data/www/specialist82.pro/logs/recreateOrders.log';
  }

  async run() {
    try {
      logger.info('🚀 Запуск скрипта recreateOrders.php...');

      // Вариант 1: Запуск через HTTP
      try {
        logger.info('📡 Запуск через HTTP...');
        const response = await axios.get(this.scriptUrl, {
          params: { token: this.token },
          timeout: 30000
        });

        logger.info('✅ Ответ от скрипта:');
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.status === 'ok') {
          logger.info('✅ Скрипт выполнен успешно!');
          response.data.orders.forEach(order => {
            if (order.status === 'success') {
              logger.info(`✅ Заказ ${order.original_id} пересоздан, новый ID: ${order.new_id}`);
            } else {
              logger.warn(`⚠️ Заказ ${order.original_id}: ${order.message}`);
            }
          });
        } else {
          logger.error('❌ Скрипт вернул ошибку:', response.data.message);
        }
      } catch (httpError) {
        logger.warn('⚠️ HTTP запрос не удался, пробуем через SSH...');
        logger.warn('Ошибка:', httpError.message);

        // Вариант 2: Запуск через SSH
        await this.server.connect();
        logger.info('📡 Запуск через SSH...');
        
        const command = `cd /var/www/specialist82_usr/data/www/specialist82.pro && php recreateOrders.php`;
        const result = await this.server.executeCommand(command);
        
        if (result.stdout) {
          logger.info('✅ Вывод скрипта:');
          console.log(result.stdout);
        }
        if (result.stderr) {
          logger.warn('⚠️ Ошибки:');
          console.log(result.stderr);
        }
      }

      // Проверяем логи
      await this.checkLogs();

    } catch (error) {
      logger.error('❌ Ошибка:', error);
      throw error;
    } finally {
      await this.server.disconnect();
    }
  }

  async checkLogs() {
    try {
      logger.info('📋 Проверка логов...');
      
      await this.server.connect();
      
      // Читаем последние 50 строк лога
      const result = await this.server.executeCommand(`tail -50 ${this.logPath}`);
      
      if (result.stdout) {
        logger.info('📄 Последние строки лога:');
        console.log(result.stdout);
      } else {
        logger.warn('⚠️ Лог файл пуст или не найден');
      }

    } catch (error) {
      logger.error('❌ Ошибка при чтении логов:', error.message);
    }
  }
}

if (require.main === module) {
  const runner = new RunRecreateOrders();
  runner.run()
    .then(() => {
      logger.info('✅ Проверка завершена');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Ошибка:', error);
      process.exit(1);
    });
}

module.exports = RunRecreateOrders;

