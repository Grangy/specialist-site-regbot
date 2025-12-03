const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

/**
 * Конфигурация подключения к серверу
 */
const CONFIG = {
  host: '77.222.47.184',
  port: 22,
  username: 'root',
  password: 'sEuxmbvfssuyk_23',
  remotePath: '/var/www/specialist82_usr/data/www/specialist82.pro'
};

/**
 * Класс для работы с сервером
 */
class ServerConnection {
  constructor() {
    this.ssh = new NodeSSH();
    this.connected = false;
  }

  /**
   * Подключение к серверу
   */
  async connect() {
    try {
      logger.info('Подключение к серверу...');
      await this.ssh.connect({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.username,
        password: CONFIG.password,
        readyTimeout: 20000
      });
      this.connected = true;
      logger.info('✅ Успешно подключено к серверу');
      return true;
    } catch (error) {
      logger.error('Ошибка подключения к серверу:', error.message);
      return false;
    }
  }

  /**
   * Отключение от сервера
   */
  async disconnect() {
    if (this.connected) {
      this.ssh.dispose();
      this.connected = false;
      logger.info('Отключено от сервера');
    }
  }

  /**
   * Выполнение команды на сервере
   */
  async executeCommand(command, options = {}) {
    if (!this.connected) {
      throw new Error('Не подключено к серверу');
    }

    try {
      logger.info(`Выполнение команды: ${command}`);
      const result = await this.ssh.execCommand(command, options);
      
      if (result.stdout) {
        logger.info(`STDOUT: ${result.stdout}`);
      }
      if (result.stderr) {
        logger.warn(`STDERR: ${result.stderr}`);
      }
      
      return result;
    } catch (error) {
      logger.error(`Ошибка выполнения команды: ${error.message}`);
      throw error;
    }
  }

  /**
   * Чтение файла с сервера
   */
  async readFile(remotePath) {
    if (!this.connected) {
      throw new Error('Не подключено к серверу');
    }

    try {
      logger.info(`Чтение файла: ${remotePath}`);
      const result = await this.ssh.execCommand(`cat ${remotePath}`);
      
      if (result.code !== 0) {
        throw new Error(`Ошибка чтения файла: ${result.stderr}`);
      }
      
      return result.stdout;
    } catch (error) {
      logger.error(`Ошибка чтения файла ${remotePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Запись файла на сервер
   */
  async writeFile(remotePath, content) {
    if (!this.connected) {
      throw new Error('Не подключено к серверу');
    }

    try {
      logger.info(`Запись файла: ${remotePath}`);
      
      // Создаём временный файл локально
      const tempFile = path.join(__dirname, '../temp_upload_file.php');
      fs.writeFileSync(tempFile, content, 'utf8');
      
      // Загружаем на сервер
      await this.ssh.putFile(tempFile, remotePath);
      
      // Удаляем временный файл
      fs.unlinkSync(tempFile);
      
      logger.info('✅ Файл успешно загружен на сервер');
      return true;
    } catch (error) {
      logger.error(`Ошибка записи файла ${remotePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Создание бэкапа файла
   */
  async backupFile(remotePath) {
    if (!this.connected) {
      throw new Error('Не подключено к сервера');
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = `${remotePath}.backup_${timestamp}`;
      
      logger.info(`Создание бэкапа: ${backupPath}`);
      const result = await this.ssh.execCommand(`cp ${remotePath} ${backupPath}`);
      
      if (result.code !== 0) {
        throw new Error(`Ошибка создания бэкапа: ${result.stderr}`);
      }
      
      logger.info(`✅ Бэкап создан: ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.error(`Ошибка создания бэкапа:`, error.message);
      throw error;
    }
  }

  /**
   * Поиск файлов на сервере
   */
  async findFiles(pattern, directory = CONFIG.remotePath) {
    if (!this.connected) {
      throw new Error('Не подключено к серверу');
    }

    try {
      logger.info(`Поиск файлов: ${pattern} в ${directory}`);
      const result = await this.ssh.execCommand(`find ${directory} -name "${pattern}" -type f`);
      
      if (result.code !== 0) {
        logger.warn(`Поиск не дал результатов или ошибка: ${result.stderr}`);
        return [];
      }
      
      const files = result.stdout.split('\n').filter(f => f.trim());
      logger.info(`Найдено файлов: ${files.length}`);
      return files;
    } catch (error) {
      logger.error(`Ошибка поиска файлов:`, error.message);
      return [];
    }
  }

  /**
   * Получение списка файлов в директории
   */
  async listDirectory(directory) {
    if (!this.connected) {
      throw new Error('Не подключено к серверу');
    }

    try {
      logger.info(`Список файлов в: ${directory}`);
      const result = await this.ssh.execCommand(`ls -la ${directory}`);
      
      if (result.code !== 0) {
        throw new Error(`Ошибка получения списка: ${result.stderr}`);
      }
      
      return result.stdout;
    } catch (error) {
      logger.error(`Ошибка получения списка файлов:`, error.message);
      throw error;
    }
  }
}

module.exports = ServerConnection;

