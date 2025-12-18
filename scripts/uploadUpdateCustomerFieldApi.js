const ServerConnection = require('./serverConnection');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

/**
 * Скрипт для загрузки updateCustomerFieldApi.php на сервер
 */
async function uploadUpdateCustomerFieldApi() {
  const server = new ServerConnection();
  
  try {
    logger.info('Подключение к серверу...');
    await server.connect();
    
    const localFile = path.join(__dirname, 'updateCustomerFieldApi.php');
    const remoteFile = '/var/www/specialist82_usr/data/www/specialist82.pro/updateCustomerFieldApi.php';
    
    if (!fs.existsSync(localFile)) {
      throw new Error(`Файл не найден: ${localFile}`);
    }
    
    logger.info(`Чтение файла: ${localFile}`);
    const content = fs.readFileSync(localFile, 'utf8');
    
    // Создаем бэкап если файл существует
    try {
      await server.backupFile(remoteFile);
    } catch (e) {
      // Игнорируем если файла нет
    }
    
    logger.info(`Загрузка файла на сервер: ${remoteFile}`);
    await server.writeFile(remoteFile, content);
    
    // Устанавливаем права доступа
    await server.executeCommand(`chmod 644 ${remoteFile}`);
    
    logger.info('✅ Файл успешно загружен на сервер!');
    
  } catch (error) {
    logger.error('❌ Ошибка загрузки файла:', error);
    throw error;
  } finally {
    await server.disconnect();
  }
}

// Запуск
uploadUpdateCustomerFieldApi()
  .then(() => {
    logger.info('✅ Скрипт выполнен успешно');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Ошибка выполнения скрипта:', error);
    process.exit(1);
  });

