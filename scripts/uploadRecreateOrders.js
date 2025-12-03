const ServerConnection = require('./serverConnection');
const logger = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * Загрузка скрипта recreateOrders.php на сервер
 */
class UploadRecreateOrders {
  constructor() {
    this.server = new ServerConnection();
    this.localScript = path.join(__dirname, 'recreateOrders.php');
    this.remoteScript = '/var/www/specialist82_usr/data/www/specialist82.pro/recreateOrders.php';
  }

  async run() {
    try {
      logger.info('📤 Загрузка recreateOrders.php на сервер...');

      await this.server.connect();

      // Читаем локальный файл
      if (!fs.existsSync(this.localScript)) {
        throw new Error(`Локальный файл не найден: ${this.localScript}`);
      }

      const scriptContent = fs.readFileSync(this.localScript, 'utf8');
      logger.info(`✅ Локальный файл прочитан (${scriptContent.length} байт)`);

      // Загружаем на сервер
      await this.server.writeFile(this.remoteScript, scriptContent);

      // Устанавливаем права доступа
      await this.server.executeCommand(`chmod 644 ${this.remoteScript}`);

      logger.info('✅ Скрипт успешно загружен на сервер!');
      logger.info(`📍 URL: https://specialist82.pro/recreateOrders.php?token=SUPER_SECRET_TOKEN_123`);

    } catch (error) {
      logger.error('❌ Ошибка:', error);
      throw error;
    } finally {
      await this.server.disconnect();
    }
  }
}

if (require.main === module) {
  const uploader = new UploadRecreateOrders();
  uploader.run()
    .then(() => {
      logger.info('✅ Загрузка завершена успешно');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Загрузка завершена с ошибкой:', error);
      process.exit(1);
    });
}

module.exports = UploadRecreateOrders;

