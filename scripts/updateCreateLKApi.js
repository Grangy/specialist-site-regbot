const ServerConnection = require('./serverConnection');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

/**
 * Скрипт для доработки create_lk_api.php на сервере
 */
class UpdateCreateLKApi {
  constructor() {
    this.server = new ServerConnection();
    this.apiPath = '/var/www/specialist82_usr/data/www/specialist82.pro/create_lk_api.php';
    this.resetPasswordPath = '/var/www/specialist82_usr/data/www/specialist82.pro/reset_password_api.php';
  }

  /**
   * Основная функция
   */
  async run() {
    try {
      logger.info('🚀 Начало работы со сервером');

      // 1. Подключение
      const connected = await this.server.connect();
      if (!connected) {
        throw new Error('Не удалось подключиться к серверу');
      }

      // 2. Изучаем структуру
      await this.exploreStructure();

      // 3. Читаем текущий create_lk_api.php
      const currentCode = await this.server.readFile(this.apiPath);
      logger.info('Текущий код create_lk_api.php прочитан');

      // 4. Создаём бэкап
      await this.server.backupFile(this.apiPath);

      // 5. Изучаем код и дорабатываем
      const updatedCode = await this.updateCreateLKApi(currentCode);

      // 6. Загружаем обновлённый файл
      await this.server.writeFile(this.apiPath, updatedCode);

      // 7. Создаём reset_password_api.php если его нет
      await this.createResetPasswordApi();

      // 8. Проверяем права доступа
      await this.server.executeCommand(`chmod 644 ${this.apiPath}`);
      await this.server.executeCommand(`chmod 644 ${this.resetPasswordPath}`);

      logger.info('✅ Все операции завершены успешно!');

    } catch (error) {
      logger.error('❌ Критическая ошибка:', error);
      throw error;
    } finally {
      await this.server.disconnect();
    }
  }

  /**
   * Изучение структуры сервера
   */
  async exploreStructure() {
    logger.info('📁 Изучение структуры сервера...');

    try {
      // Ищем API файлы
      const apiFiles = await this.server.findFiles('*_api.php', '/var/www/specialist82_usr/data/www/specialist82.pro');
      logger.info(`Найдено API файлов: ${apiFiles.length}`);
      apiFiles.forEach(file => logger.info(`  - ${file}`));

      // Смотрим структуру wa-apps
      const waAppsPath = '/var/www/specialist82_usr/data/www/specialist82.pro/wa-apps';
      const waAppsList = await this.server.listDirectory(waAppsPath);
      logger.info('Структура wa-apps:');
      logger.info(waAppsList);

      // Ищем файлы связанные с категориями
      const categoryFiles = await this.server.findFiles('*category*.php', '/var/www/specialist82_usr/data/www/specialist82.pro');
      logger.info(`Найдено файлов с категориями: ${categoryFiles.length}`);

    } catch (error) {
      logger.warn('Ошибка при изучении структуры:', error.message);
    }
  }

  /**
   * Доработка create_lk_api.php
   */
  async updateCreateLKApi(currentCode) {
    logger.info('🔧 Доработка create_lk_api.php...');

    // Проверяем есть ли уже функционал сброса пароля и категорий
    const hasResetPassword = currentCode.includes('reset_password') || currentCode.includes('resetPassword');
    const hasCategory = currentCode.includes('category_id') || currentCode.includes('category');

    logger.info(`Текущий функционал:`);
    logger.info(`  - Сброс пароля: ${hasResetPassword ? '✅' : '❌'}`);
    logger.info(`  - Категории: ${hasCategory ? '✅' : '❌'}`);

    // Анализируем текущий код и дополняем его
    let updatedCode;
    
    if (currentCode.includes('category') || currentCode.includes('Category')) {
      // Если уже есть работа с категориями, дополняем
      updatedCode = this.enhanceExistingCode(currentCode);
    } else {
      // Создаём новую версию
      updatedCode = this.generateUpdatedCode(currentCode);
    }

    return updatedCode;
  }

  /**
   * Улучшение существующего кода
   */
  enhanceExistingCode(originalCode) {
    logger.info('Улучшение существующего кода...');
    
    let code = originalCode;
    
    // Добавляем получение category_id если его нет
    if (!code.includes("category_id = $_POST['category_id']")) {
      const insertAfter = code.indexOf('$contactId = $_POST[\'contact_id\']');
      if (insertAfter > 0) {
        const insertPos = code.indexOf(';', insertAfter) + 1;
        code = code.slice(0, insertPos) + 
          "\n$categoryId = $_POST['category_id'] ?? null; // Категория для прайс-листа" +
          code.slice(insertPos);
      }
    }
    
    // Добавляем установку категории если её нет
    if (!code.includes('shopCustomerCategoriesModel') && !code.includes('addCategory')) {
      // Ищем место после создания пользователя
      const insertAfter = code.indexOf('sendPasswordEmail') || code.indexOf('User created');
      if (insertAfter > 0) {
        const categoryCode = `
        
    // Установка категории "Цена Прайс лист1" (ID = 4)
    if ($categoryId == '4' || $categoryId === 4) {
        try {
            $categoryModel = new shopCategoryModel();
            $category = $categoryModel->getById(4);
            
            if ($category) {
                // Добавляем контакт в категорию
                $contactCategoriesModel = new shopCustomerCategoriesModel();
                $contactCategoriesModel->add($contactId, [4]);
                
                logMessage('INFO: Category set', [
                    'contact_id' => $contactId,
                    'category_id' => 4,
                    'category_name' => $category['name'] ?? 'Цена Прайс лист1'
                ]);
            } else {
                logMessage('WARNING: Category 4 not found');
            }
        } catch (Exception $e) {
            logMessage('WARNING: Failed to set category', ['error' => $e->getMessage()]);
            // Не прерываем выполнение если не удалось установить категорию
        }
    }
`;
        // Вставляем перед успешным ответом
        const beforeResponse = code.lastIndexOf('http_response_code(200)');
        if (beforeResponse > 0) {
          code = code.slice(0, beforeResponse) + categoryCode + code.slice(beforeResponse);
        }
      }
    }
    
    return code;
  }

  /**
   * Генерация обновлённого кода
   */
  generateUpdatedCode(originalCode) {
    // Если файл уже содержит нужный функционал, дополняем его
    // Иначе создаём новый

    const newCode = `<?php
/**
 * API для создания личного кабинета клиента
 * Доработано: добавлен сброс пароля и установка категории "Цена Прайс лист1"
 * Дата: ${new Date().toISOString()}
 */

// Логирование
$logFile = __DIR__ . '/logs/create_lk_api.log';
$logDir = dirname($logFile);
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

function logMessage($message, $data = null) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[{$timestamp}] {$message}";
    if ($data !== null) {
        $logEntry .= " | Data: " . json_encode($data, JSON_UNESCAPED_UNICODE);
    }
    $logEntry .= PHP_EOL;
    file_put_contents($logFile, $logEntry, FILE_APPEND);
}

// Проверка токена
$token = $_POST['token'] ?? '';
$expectedToken = 'SUPER_SECRET_TOKEN_123'; // TODO: вынести в конфиг

if ($token !== $expectedToken) {
    logMessage('ERROR: Invalid token', ['token' => $token]);
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid token'
    ]);
    exit;
}

// Получение параметров
$contactId = $_POST['contact_id'] ?? null;
$categoryId = $_POST['category_id'] ?? null; // Новый параметр для категории

if (!$contactId) {
    logMessage('ERROR: Missing contact_id');
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'contact_id is required'
    ]);
    exit;
}

logMessage('INFO: Processing request', [
    'contact_id' => $contactId,
    'category_id' => $categoryId
]);

try {
    // Подключение к Webasyst
    $waPath = __DIR__ . '/wa-config/SystemConfig.class.php';
    if (!file_exists($waPath)) {
        throw new Exception('Webasyst not found');
    }
    
    require_once($waPath);
    wa('shop');
    
    // Получаем контакт
    $contactModel = new shopCustomerModel();
    $contact = $contactModel->getById($contactId);
    
    if (!$contact) {
        logMessage('ERROR: Contact not found', ['contact_id' => $contactId]);
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Contact not found'
        ]);
        exit;
    }
    
    logMessage('INFO: Contact found', ['contact_id' => $contactId, 'name' => $contact['name'] ?? 'N/A']);
    
    // 1. Создание личного кабинета (если ещё не создан)
    $userModel = new waUserModel();
    $user = $userModel->getById($contactId);
    
    if (!$user) {
        // Создаём пользователя
        $email = $contact['email'] ?? '';
        if (!$email) {
            throw new Exception('Contact email is required');
        }
        
        // Генерируем пароль
        $password = bin2hex(random_bytes(8)); // 16 символов
        
        // Создаём пользователя
        $userData = [
            'id' => $contactId,
            'login' => $email,
            'email' => $email,
            'password' => $password,
            'create_datetime' => date('Y-m-d H:i:s'),
            'is_user' => 1
        ];
        
        // Хешируем пароль
        $auth = new waAuth();
        $userData['password'] = $auth->hashPassword($password);
        
        $userModel->insert($userData);
        
        logMessage('INFO: User created', ['contact_id' => $contactId, 'email' => $email]);
        
        // Отправляем пароль на email
        $this->sendPasswordEmail($email, $password, $contact['name'] ?? 'Клиент');
    } else {
        logMessage('INFO: User already exists', ['contact_id' => $contactId]);
    }
    
    // 2. Установка категории "Цена Прайс лист1" (ID = 4)
    if ($categoryId == '4' || $categoryId === 4) {
        try {
            $categoryModel = new shopCategoryModel();
            $category = $categoryModel->getById(4);
            
            if ($category) {
                // Добавляем контакт в категорию
                $contactCategoriesModel = new shopCustomerCategoriesModel();
                $contactCategoriesModel->add($contactId, [4]);
                
                logMessage('INFO: Category set', [
                    'contact_id' => $contactId,
                    'category_id' => 4,
                    'category_name' => $category['name'] ?? 'Цена Прайс лист1'
                ]);
            } else {
                logMessage('WARNING: Category 4 not found');
            }
        } catch (Exception $e) {
            logMessage('WARNING: Failed to set category', ['error' => $e->getMessage()]);
            // Не прерываем выполнение если не удалось установить категорию
        }
    }
    
    // 3. Успешный ответ
    logMessage('SUCCESS: LK created', ['contact_id' => $contactId]);
    
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'contact_id' => $contactId,
        'category_set' => ($categoryId == '4' || $categoryId === 4),
        'message' => 'Личный кабинет создан успешно'
    ]);
    
} catch (Exception $e) {
    logMessage('ERROR: Exception', [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Отправка пароля на email
 */
function sendPasswordEmail($email, $password, $name) {
    try {
        $mailer = new waMailMessage();
        $mailer->setTo($email);
        $mailer->setSubject('Данные для входа в личный кабинет');
        $mailer->setBody("
            Здравствуйте, {$name}!
            
            Ваш личный кабинет создан.
            
            Данные для входа:
            Email: {$email}
            Пароль: {$password}
            
            Пожалуйста, сохраните эти данные в безопасном месте.
            
            С уважением,
            Команда specialist82.pro
        ");
        
        $mailer->send();
        logMessage('INFO: Password email sent', ['email' => $email]);
    } catch (Exception $e) {
        logMessage('ERROR: Failed to send email', ['error' => $e->getMessage()]);
        // Не прерываем выполнение если не удалось отправить email
    }
}
`;

    return newCode;
  }

  /**
   * Создание reset_password_api.php
   */
  async createResetPasswordApi() {
    logger.info('📝 Создание reset_password_api.php...');

    try {
      // Проверяем существует ли файл
      try {
        await this.server.readFile(this.resetPasswordPath);
        logger.info('reset_password_api.php уже существует, обновляем...');
      } catch (e) {
        logger.info('reset_password_api.php не найден, создаём новый...');
      }

      // Создаём бэкап если файл существует
      try {
        await this.server.backupFile(this.resetPasswordPath);
      } catch (e) {
        // Игнорируем если файла нет
      }

      const resetPasswordCode = this.generateResetPasswordCode();
      await this.server.writeFile(this.resetPasswordPath, resetPasswordCode);
      logger.info('✅ reset_password_api.php создан/обновлён');

    } catch (error) {
      logger.error('Ошибка создания reset_password_api.php:', error.message);
      throw error;
    }
  }

  /**
   * Генерация кода для reset_password_api.php
   */
  generateResetPasswordCode() {
    return `<?php
/**
 * API для сброса пароля клиента
 * Дата: ${new Date().toISOString()}
 */

// Логирование
$logFile = __DIR__ . '/logs/reset_password_api.log';
$logDir = dirname($logFile);
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

function logMessage($message, $data = null) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[{$timestamp}] {$message}";
    if ($data !== null) {
        $logEntry .= " | Data: " . json_encode($data, JSON_UNESCAPED_UNICODE);
    }
    $logEntry .= PHP_EOL;
    file_put_contents($logFile, $logEntry, FILE_APPEND);
}

// Проверка токена
$token = $_POST['token'] ?? '';
$expectedToken = 'SUPER_SECRET_TOKEN_123'; // TODO: вынести в конфиг

if ($token !== $expectedToken) {
    logMessage('ERROR: Invalid token', ['token' => $token]);
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid token'
    ]);
    exit;
}

// Получение параметров
$contactId = $_POST['contact_id'] ?? null;
$email = $_POST['email'] ?? null;

if (!$contactId) {
    logMessage('ERROR: Missing contact_id');
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'contact_id is required'
    ]);
    exit;
}

logMessage('INFO: Reset password request', [
    'contact_id' => $contactId,
    'email' => $email
]);

try {
    // Подключение к Webasyst
    $waPath = __DIR__ . '/wa-config/SystemConfig.class.php';
    if (!file_exists($waPath)) {
        throw new Exception('Webasyst not found');
    }
    
    require_once($waPath);
    wa('shop');
    
    // Получаем контакт
    $contactModel = new shopCustomerModel();
    $contact = $contactModel->getById($contactId);
    
    if (!$contact) {
        logMessage('ERROR: Contact not found', ['contact_id' => $contactId]);
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Contact not found'
        ]);
        exit;
    }
    
    // Используем email из контакта если не передан
    if (!$email) {
        $email = $contact['email'] ?? '';
    }
    
    if (!$email) {
        throw new Exception('Email is required');
    }
    
    // Получаем пользователя
    $userModel = new waUserModel();
    $user = $userModel->getById($contactId);
    
    if (!$user) {
        logMessage('ERROR: User not found', ['contact_id' => $contactId]);
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'User not found'
        ]);
        exit;
    }
    
    // Генерируем новый пароль
    $newPassword = bin2hex(random_bytes(8)); // 16 символов
    
    // Обновляем пароль
    $auth = new waAuth();
    $hashedPassword = $auth->hashPassword($newPassword);
    
    $userModel->updateById($contactId, [
        'password' => $hashedPassword
    ]);
    
    logMessage('INFO: Password reset', ['contact_id' => $contactId, 'email' => $email]);
    
    // Отправляем пароль на email
    $this->sendPasswordEmail($email, $newPassword, $contact['name'] ?? 'Клиент');
    
    // Успешный ответ
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'contact_id' => $contactId,
        'email' => $email,
        'message' => 'Пароль успешно сброшен и отправлен на email'
    ]);
    
} catch (Exception $e) {
    logMessage('ERROR: Exception', [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Отправка пароля на email
 */
function sendPasswordEmail($email, $password, $name) {
    try {
        $mailer = new waMailMessage();
        $mailer->setTo($email);
        $mailer->setSubject('Новый пароль для входа в личный кабинет');
        $mailer->setBody("
            Здравствуйте, {$name}!
            
            Ваш пароль был сброшен.
            
            Новые данные для входа:
            Email: {$email}
            Пароль: {$password}
            
            Пожалуйста, сохраните эти данные в безопасном месте.
            
            С уважением,
            Команда specialist82.pro
        ");
        
        $mailer->send();
        logMessage('INFO: Password email sent', ['email' => $email]);
    } catch (Exception $e) {
        logMessage('ERROR: Failed to send email', ['error' => $e->getMessage()]);
        throw $e; // В случае сброса пароля важно знать об ошибке
    }
}
`;
  }
}

// Запуск скрипта
if (require.main === module) {
  const updater = new UpdateCreateLKApi();
  updater.run()
    .then(() => {
      logger.info('✅ Скрипт завершён успешно');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Скрипт завершён с ошибкой:', error);
      process.exit(1);
    });
}

module.exports = UpdateCreateLKApi;

