const ServerConnection = require('./serverConnection');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

/**
 * Скрипт для загрузки getAllCustomersApi.php на сервер
 */
async function uploadCustomersApi() {
  const server = new ServerConnection();
  
  try {
    logger.info('Подключение к серверу...');
    await server.connect();
    
    const localFile = path.join(__dirname, 'getAllCustomersApi.php');
    const remoteFile = '/var/www/specialist82_usr/data/www/specialist82.pro/getAllCustomersApi.php';
    
    if (!fs.existsSync(localFile)) {
      throw new Error(`Файл не найден: ${localFile}`);
    }
    
    logger.info(`Чтение файла: ${localFile}`);
    const content = fs.readFileSync(localFile, 'utf8');
    
    logger.info(`Загрузка файла на сервер: ${remoteFile}`);
    await server.writeFile(remoteFile, content);
    
    logger.info('✅ Файл успешно загружен на сервер!');
    
  } catch (error) {
    logger.error('❌ Ошибка загрузки файла:', error);
    throw error;
  } finally {
    await server.disconnect();
  }
}

// Запуск
uploadCustomersApi()
  .then(() => {
    logger.info('✅ Скрипт выполнен успешно');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Ошибка выполнения скрипта:', error);
    process.exit(1);
  });

