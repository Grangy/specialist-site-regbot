const ServerConnection = require('./serverConnection');
const logger = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * Скрипт для правильной доработки create_lk_api.php
 */
class FixCreateLKApi {
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
      logger.info('🚀 Начало доработки create_lk_api.php');

      // Подключение
      const connected = await this.server.connect();
      if (!connected) {
        throw new Error('Не удалось подключиться к серверу');
      }

      // Читаем текущий файл
      const currentCode = await this.server.readFile(this.apiPath);
      
      // Создаём бэкап
      await this.server.backupFile(this.apiPath);

      // Дорабатываем код
      const fixedCode = this.fixCode(currentCode);

      // Загружаем на сервер
      await this.server.writeFile(this.apiPath, fixedCode);

      // Создаём reset_password_api.php
      await this.createResetPasswordApi();

      // Устанавливаем права
      await this.server.executeCommand(`chmod 644 ${this.apiPath}`);
      await this.server.executeCommand(`chmod 644 ${this.resetPasswordPath}`);

      logger.info('✅ Все файлы успешно обновлены!');

    } catch (error) {
      logger.error('❌ Ошибка:', error);
      throw error;
    } finally {
      await this.server.disconnect();
    }
  }

  /**
   * Исправление кода create_lk_api.php
   */
  fixCode(originalCode) {
    logger.info('🔧 Исправление кода...');

    let code = originalCode;

    // 1. Добавляем логирование в начало
    if (!code.includes('logMessage')) {
      const logFunction = `
// Логирование (добавлено автоматически)
\$logFile = dirname(__FILE__) . '/logs/create_lk_api.log';
\$logDir = dirname(\$logFile);
if (!is_dir(\$logDir)) {
    mkdir(\$logDir, 0755, true);
}

function logMessage(\$message, \$data = null) {
    global \$logFile;
    \$timestamp = date('Y-m-d H:i:s');
    \$logEntry = "[{\$timestamp}] {\$message}";
    if (\$data !== null) {
        \$logEntry .= " | Data: " . json_encode(\$data, JSON_UNESCAPED_UNICODE);
    }
    \$logEntry .= PHP_EOL;
    file_put_contents(\$logFile, \$logEntry, FILE_APPEND);
}
`;

      // Вставляем после подключения PHPMailer
      const insertPos = code.indexOf('require_once dirname(__FILE__) . \'/phpmailer/SMTP.php\';');
      if (insertPos > 0) {
        const afterPos = code.indexOf(';', insertPos) + 1;
        code = code.slice(0, afterPos) + '\n' + logFunction + code.slice(afterPos);
      }
    }

    // 2. Изменяем category_id чтобы брался из запроса
    const oldCategoryPattern = /\$category_id\s*=\s*2;\s*\/\/\s*"цены видны"/;
    const newCategoryLine = `    // === category_id из запроса ===
    \$category_id = isset(\$_REQUEST['category_id']) ? (int)\$_REQUEST['category_id'] : 2; // по умолчанию "цены видны" (2), если передан 4 - "Цена Прайс лист1"
    dstep(\$response, 'read_category_id', ['category_id' => \$category_id]);
    logMessage('Category ID from request', ['category_id' => \$category_id]);`;

    if (oldCategoryPattern.test(code)) {
      code = code.replace(oldCategoryPattern, newCategoryLine);
      logger.info('✅ category_id теперь берётся из запроса');
    } else {
      // Если строка уже изменена, проверяем есть ли получение из запроса
      if (!code.includes("_REQUEST['category_id']")) {
        // Вставляем после чтения contact_id
        const afterContactId = code.indexOf('dstep($response, \'read_contact_id\'');
        if (afterContactId > 0) {
          const insertPos = code.indexOf(';', code.indexOf('$contact_id', afterContactId)) + 1;
          code = code.slice(0, insertPos) + '\n\n' + newCategoryLine + '\n' + code.slice(insertPos);
        }
      }
    }

    // 3. Добавляем логирование в ключевых местах
    const logPoints = [
      { after: 'dstep($response, \'start\');', log: 'logMessage(\'API call started\', [\'contact_id\' => $contact_id ?? null, \'category_id\' => $category_id ?? null]);' },
      { after: 'dstep($response, \'add_category\'', log: 'logMessage(\'Category added\', [\'contact_id\' => $contact_id, \'category_id\' => $category_id]);' },
      { after: '$email_sent = true;', log: 'logMessage(\'Email sent successfully\', [\'email\' => $email, \'contact_id\' => $contact_id]);' },
      { after: '$response[\'status\'] = \'ok\';', log: 'logMessage(\'API call completed successfully\', [\'contact_id\' => $contact_id, \'category_id\' => $category_id, \'email_sent\' => $email_sent]);' }
    ];

    logPoints.forEach(({ after, log }) => {
      if (code.includes(after) && !code.includes(log)) {
        const pos = code.indexOf(after) + after.length;
        const nextLine = code.indexOf('\n', pos);
        code = code.slice(0, nextLine + 1) + '        ' + log + '\n' + code.slice(nextLine + 1);
      }
    });

    // 4. Улучшаем обработку ошибок email
    if (code.includes('$email_error = $e->getMessage();')) {
      code = code.replace(
        '$email_error = $e->getMessage();',
        '$email_error = $e->getMessage();\n            logMessage(\'Email send error\', [\'error\' => $email_error, \'email\' => $email, \'contact_id\' => $contact_id]);'
      );
    }

    // 5. Добавляем информацию о категории в ответ
    if (code.includes("$response['category_id'] = $category_id;")) {
      const categoryName = code.includes("'Цена Прайс лист1'") ? '' : 
        `    \$response['category_name'] = (\$category_id == 4) ? 'Цена Прайс лист1' : 'Цены видны';`;
      
      if (!code.includes("$response['category_name']")) {
        code = code.replace(
          "$response['category_id'] = $category_id;",
          "$response['category_id'] = $category_id;\n    " + categoryName
        );
      }
    }

    logger.info('✅ Код успешно доработан');
    return code;
  }

  /**
   * Создание reset_password_api.php
   */
  async createResetPasswordApi() {
    logger.info('📝 Создание reset_password_api.php...');

    try {
      // Проверяем существует ли
      let exists = false;
      try {
        await this.server.readFile(this.resetPasswordPath);
        exists = true;
        await this.server.backupFile(this.resetPasswordPath);
      } catch (e) {
        // Файл не существует
      }

      const code = this.generateResetPasswordCode();
      await this.server.writeFile(this.resetPasswordPath, code);
      
      logger.info(`✅ reset_password_api.php ${exists ? 'обновлён' : 'создан'}`);

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
// reset_password_api.php
header('Content-Type: application/json; charset=utf-8');

ini_set('display_errors', 1);
error_reporting(E_ALL);

// Подключаем PHPMailer
require_once dirname(__FILE__) . '/phpmailer/Exception.php';
require_once dirname(__FILE__) . '/phpmailer/PHPMailer.php';
require_once dirname(__FILE__) . '/phpmailer/SMTP.php';

// Логирование
$logFile = dirname(__FILE__) . '/logs/reset_password_api.log';
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

$response = [
    'status' => 'error',
    'message' => '',
    'debug' => [],
];

function dstep(&$resp, $step, $info = null) {
    $item = ['step' => $step];
    if ($info !== null) {
        $item['info'] = $info;
    }
    $resp['debug'][] = $item;
}

/**
 * Генерация случайного пароля
 */
function generateRandomPassword($length = 10) {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $max = strlen($chars) - 1;
    $pass = '';

    for ($i = 0; $i < $length; $i++) {
        $pass .= $chars[random_int(0, $max)];
    }

    return $pass;
}

try {
    dstep($response, 'start');
    logMessage('Reset password request started');

    // === параметры ===
    $secret = 'SUPER_SECRET_TOKEN_123';
    $from_email = 'info@specialist82.pro';
    $from_name = 'specialist82.pro';
    $login_url = 'https://specialist82.pro/my/';

    // === токен ===
    dstep($response, 'check_token', $_REQUEST);
    
    if (empty($_REQUEST['token']) || $_REQUEST['token'] !== $secret) {
        logMessage('ERROR: Invalid token', ['token' => $_REQUEST['token'] ?? 'empty']);
        http_response_code(403);
        $response['message'] = 'Forbidden (bad token)';
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    // === contact_id ===
    $contact_id = isset($_REQUEST['contact_id']) ? (int)$_REQUEST['contact_id'] : 0;
    dstep($response, 'read_contact_id', ['contact_id' => $contact_id]);
    logMessage('Contact ID received', ['contact_id' => $contact_id]);

    if ($contact_id <= 0) {
        logMessage('ERROR: Missing contact_id');
        http_response_code(400);
        $response['message'] = 'contact_id required';
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    // === Webasyst ядро ===
    dstep($response, 'include_system_config');

    $path = dirname(__FILE__) . '/wa-config/SystemConfig.class.php';
    if (!file_exists($path)) {
        throw new Exception('SystemConfig.class.php not found at ' . $path);
    }
    require_once($path);

    dstep($response, 'init_system');
    $config = new SystemConfig();
    waSystem::getInstance('shop', $config);

    // === модели ===
    dstep($response, 'init_models');
    $cm = new waContactModel();

    // === загрузка контакта ===
    dstep($response, 'load_contact');
    $row = $cm->getById($contact_id);
    
    if (!$row) {
        logMessage('ERROR: Contact not found', ['contact_id' => $contact_id]);
        throw new Exception('Contact not found (id=' . $contact_id . ')');
    }

    $contact = new waContact($contact_id);
    if (!$contact->exists()) {
        logMessage('ERROR: Contact does not exist', ['contact_id' => $contact_id]);
        throw new Exception('Contact does not exist (id=' . $contact_id . ')');
    }

    // === email ===
    dstep($response, 'get_email');
    $email = trim((string)$contact->get('email', 'default'));
    
    if ($email === '') {
        logMessage('ERROR: No email for contact', ['contact_id' => $contact_id]);
        http_response_code(400);
        $response['message'] = 'Contact has no email';
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    // === проверка что пользователь существует ===
    if (empty($row['password']) && empty($row['is_user'])) {
        logMessage('WARNING: User not created yet', ['contact_id' => $contact_id]);
        http_response_code(400);
        $response['message'] = 'User account not created yet. Use create_lk_api.php first.';
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    // === генерация нового пароля ===
    dstep($response, 'generate_new_password');
    $plain_password = generateRandomPassword(10);
    $password_hash = waContact::getPasswordHash($plain_password);

    logMessage('New password generated', ['contact_id' => $contact_id, 'email' => $email]);

    // === сохранение пароля ===
    dstep($response, 'save_new_password');
    $cm->updateById($contact_id, [
        'password' => $password_hash,
        'is_user' => 1,
    ]);

    logMessage('Password updated in database', ['contact_id' => $contact_id]);

    // === отправка email ===
    dstep($response, 'prepare_email', ['email_to' => $email]);

    $subject = 'Новый пароль для входа в личный кабинет на specialist82.pro';

    $body = <<<TEXT
Здравствуйте!

Ваш пароль был сброшен администратором.

Новые данные для входа:
Логин: {$email}
Пароль: {$plain_password}

Войти в личный кабинет: {$login_url}

Рекомендуем после входа изменить пароль на свой.

С уважением,
Команда specialist82.pro
TEXT;

    // === отправка через SMTP ===
    dstep($response, 'send_email_smtp');

    $mail = new \\PHPMailer\\PHPMailer\\PHPMailer(true);
    $email_sent = false;
    $email_error = null;

    try {
        $mail->isSMTP();
        $mail->Host = 'smtp.spaceweb.ru';
        $mail->SMTPAuth = true;
        $mail->Username = 'info@specialist82.pro';
        $mail->Password = 'VE3SMYxCBVEX2T1@';
        $mail->SMTPSecure = \\PHPMailer\\PHPMailer\\PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port = 465;
        $mail->CharSet = 'UTF-8';

        $mail->setFrom($from_email, $from_name);
        $mail->addAddress($email);
        $mail->Subject = $subject;
        $mail->Body = $body;

        $mail->send();
        $email_sent = true;
        dstep($response, 'send_email_smtp_success');
        logMessage('Password reset email sent', ['email' => $email, 'contact_id' => $contact_id]);

    } catch (\\Exception $e) {
        $email_error = $e->getMessage();
        dstep($response, 'send_email_smtp_error', $email_error);
        logMessage('ERROR: Email send failed', ['error' => $email_error, 'email' => $email, 'contact_id' => $contact_id]);
    }

    // === итог ===
    $response['status'] = 'ok';
    $response['contact_id'] = $contact_id;
    $response['email'] = $email;
    $response['email_sent'] = $email_sent;
    $response['email_error'] = $email_error;
    $response['message'] = 'Password reset successfully';
    $response['debug'][] = ['step' => 'finish_ok'];

    logMessage('Password reset completed', [
        'contact_id' => $contact_id,
        'email' => $email,
        'email_sent' => $email_sent
    ]);

} catch (Exception $e) {
    $response['message'] = $e->getMessage();
    dstep($response, 'exception', $e->getMessage());
    logMessage('ERROR: Exception', [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
`;
  }
}

// Запуск
if (require.main === module) {
  const fixer = new FixCreateLKApi();
  fixer.run()
    .then(() => {
      logger.info('✅ Скрипт завершён успешно');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Скрипт завершён с ошибкой:', error);
      process.exit(1);
    });
}

module.exports = FixCreateLKApi;

