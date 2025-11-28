const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Класс для работы с базой данных
 */
class Database {
  constructor() {
    // Создаем директорию для БД если её нет
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new sqlite3.Database(config.database.path, (err) => {
      if (err) {
        logger.error('Ошибка подключения к БД:', err);
      } else {
        logger.info('База данных подключена успешно');
        this.init();
      }
    });
  }

  /**
   * Инициализация таблиц
   */
  init() {
    this.db.serialize(() => {
      // Таблица авторизованных пользователей
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          chat_id INTEGER PRIMARY KEY,
          username TEXT,
          first_name TEXT,
          last_name TEXT,
          authorized_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Таблица сессий регистрации
      this.db.run(`
        CREATE TABLE IF NOT EXISTS registration_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id INTEGER,
          client_name TEXT,
          client_code TEXT,
          client_manager TEXT,
          phone TEXT,
          email TEXT,
          step TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (chat_id) REFERENCES users(chat_id)
        )
      `);

      // Таблица истории регистраций
      this.db.run(`
        CREATE TABLE IF NOT EXISTS registration_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chat_id INTEGER,
          client_name TEXT,
          client_code TEXT,
          phone TEXT,
          email TEXT,
          api_response TEXT,
          status TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (chat_id) REFERENCES users(chat_id)
        )
      `);

      logger.info('Таблицы инициализированы');
    });
  }

  /**
   * Проверка авторизации пользователя
   */
  isUserAuthorized(chatId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM users WHERE chat_id = ?',
        [chatId],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(!!row);
          }
        }
      );
    });
  }

  /**
   * Авторизация пользователя
   */
  authorizeUser(chatId, userInfo) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO users (chat_id, username, first_name, last_name)
         VALUES (?, ?, ?, ?)`,
        [chatId, userInfo.username, userInfo.first_name, userInfo.last_name],
        (err) => {
          if (err) {
            reject(err);
          } else {
            logger.info(`Пользователь ${chatId} авторизован`);
            resolve();
          }
        }
      );
    });
  }

  /**
   * Обновление последней активности
   */
  updateLastActivity(chatId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE chat_id = ?',
        [chatId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Сохранение/обновление сессии регистрации
   */
  saveSession(chatId, sessionData) {
    return new Promise((resolve, reject) => {
      // Сначала удаляем старую сессию
      this.db.run('DELETE FROM registration_sessions WHERE chat_id = ?', [chatId], (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Создаем новую сессию
        this.db.run(
          `INSERT INTO registration_sessions 
           (chat_id, client_name, client_code, client_manager, phone, email, step)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            chatId,
            sessionData.clientName,
            sessionData.clientCode,
            sessionData.clientManager,
            sessionData.phone,
            sessionData.email,
            sessionData.step
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    });
  }

  /**
   * Получение сессии
   */
  getSession(chatId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM registration_sessions WHERE chat_id = ?',
        [chatId],
        (err, row) => {
          if (err) {
            reject(err);
          } else if (row) {
            resolve({
              clientName: row.client_name,
              clientCode: row.client_code,
              clientManager: row.client_manager,
              phone: row.phone,
              email: row.email,
              step: row.step
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * Удаление сессии
   */
  deleteSession(chatId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM registration_sessions WHERE chat_id = ?',
        [chatId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Сохранение истории регистрации
   */
  saveRegistrationHistory(chatId, data) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO registration_history 
         (chat_id, client_name, client_code, phone, email, api_response, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          chatId,
          data.clientName,
          data.clientCode,
          data.phone,
          data.email,
          JSON.stringify(data.apiResponse),
          data.status
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Получение истории регистраций пользователя
   */
  getRegistrationHistory(chatId, limit = 10) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM registration_history 
         WHERE chat_id = ? 
         ORDER BY created_at DESC 
         LIMIT ?`,
        [chatId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  /**
   * Получение статистики
   */
  getStats() {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT 
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM registration_history WHERE status = 'success') as successful_registrations,
          (SELECT COUNT(*) FROM registration_history WHERE status = 'error') as failed_registrations
        `,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Закрытие соединения
   */
  close() {
    this.db.close((err) => {
      if (err) {
        logger.error('Ошибка закрытия БД:', err);
      } else {
        logger.info('База данных закрыта');
      }
    });
  }
}

module.exports = new Database();



