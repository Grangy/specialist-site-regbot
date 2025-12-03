const ServerConnection = require('./serverConnection');
const logger = require('../src/utils/logger');
const fs = require('fs');

/**
 * Скрипт для чтения файла с сервера
 */
async function readServerFile() {
  const server = new ServerConnection();
  
  try {
    await server.connect();
    
    const filePath = '/var/www/specialist82_usr/data/www/specialist82.pro/create_lk_api.php';
    const content = await server.readFile(filePath);
    
    // Сохраняем локально для анализа
    fs.writeFileSync('./temp/create_lk_api_current.php', content, 'utf8');
    logger.info('Файл сохранён в ./temp/create_lk_api_current.php');
    
    console.log('\n=== СОДЕРЖИМОЕ ФАЙЛА ===\n');
    console.log(content);
    
  } catch (error) {
    logger.error('Ошибка:', error);
  } finally {
    await server.disconnect();
  }
}

readServerFile();

