const ServerConnection = require('./serverConnection');
const logger = require('../src/utils/logger');

/**
 * Скрипт для проверки логов и структуры БД для updateCustomerFieldApi
 */
async function checkUpdateFieldApi() {
  const server = new ServerConnection();
  
  try {
    logger.info('Подключение к серверу...');
    await server.connect();
    
    // 1. Проверяем логи
    console.log('\n📋 Проверка логов...');
    const logPath = '/var/www/specialist82_usr/data/www/specialist82.pro/logs/updateCustomerFieldApi.log';
    
    try {
      const logContent = await server.readFile(logPath);
      console.log('✅ Лог файл найден');
      console.log('\nПоследние 50 строк лога:');
      const lines = logContent.split('\n').filter(l => l.trim());
      const lastLines = lines.slice(-50);
      lastLines.forEach(line => console.log(line));
    } catch (error) {
      console.log('⚠️  Лог файл не найден или пуст:', error.message);
    }
    
    // 2. Проверяем структуру таблицы wa_contact_data
    console.log('\n\n📊 Проверка структуры БД...');
    
    // Получаем путь к конфигу БД
    const configPath = '/var/www/specialist82_usr/data/www/specialist82.pro/wa-config/db.php';
    try {
      const dbConfig = await server.readFile(configPath);
      console.log('✅ Конфиг БД найден');
      
      // Пытаемся найти информацию о БД
      const dbNameMatch = dbConfig.match(/database.*?['"]([^'"]+)['"]/);
      if (dbNameMatch) {
        console.log(`   Имя БД: ${dbNameMatch[1]}`);
      }
    } catch (error) {
      console.log('⚠️  Не удалось прочитать конфиг БД:', error.message);
    }
    
    // 3. Проверяем существование поля min_noncash_sum в wa_contact_data
    console.log('\n🔍 Проверка поля min_noncash_sum...');
    
    // Создаем PHP скрипт для проверки
    const checkScript = `<?php
\$waPath = __DIR__ . '/wa-config/SystemConfig.class.php';
if (!file_exists(\$waPath)) {
    die('Webasyst not found');
}

require_once(\$waPath);
\$config = new SystemConfig();
\$wa = waSystem::getInstance('shop', \$config);

// Получаем БД через waDbAdapter
\$db = new waDbAdapter(\$wa->getConfig()->getDatabase());

echo "Структура wa_contact_data:\\n";
\$result = \$db->query("DESCRIBE wa_contact_data");
while (\$row = \$result->fetch()) {
    echo "  " . \$row['Field'] . " (" . \$row['Type'] . ")\\n";
}

// Проверяем, есть ли записи с полем min_noncash_sum
\$result = \$db->query("SELECT COUNT(*) as count FROM wa_contact_data WHERE field = 'min_noncash_sum'");
\$row = \$result->fetch();
echo "\\nЗаписей с полем min_noncash_sum: " . \$row['count'] . "\\n";

// Показываем примеры
\$result = \$db->query("SELECT contact_id, field, value FROM wa_contact_data WHERE field = 'min_noncash_sum' LIMIT 5");
echo "\\nПримеры записей:\\n";
while (\$row = \$result->fetch()) {
    echo "  contact_id: " . \$row['contact_id'] . ", value: " . \$row['value'] . "\\n";
}

// Проверяем contact_id 144
\$result = \$db->query("SELECT * FROM wa_contact_data WHERE contact_id = 144 AND field = 'min_noncash_sum'");
\$row = \$result->fetch();
if (\$row) {
    echo "\\nТекущее значение для contact_id 144: " . \$row['value'] . "\\n";
} else {
    echo "\\nПоле min_noncash_sum не установлено для contact_id 144\\n";
}
`;
    
    const checkScriptPath = '/var/www/specialist82_usr/data/www/specialist82.pro/check_field_structure.php';
    await server.writeFile(checkScriptPath, checkScript);
    
    const checkResult = await server.executeCommand(`php ${checkScriptPath}`);
    console.log(checkResult.stdout);
    if (checkResult.stderr) {
      console.log('Ошибки:', checkResult.stderr);
    }
    
    // Удаляем временный скрипт
    await server.executeCommand(`rm ${checkScriptPath}`);
    
    logger.info('✅ Проверка завершена');
    
  } catch (error) {
    logger.error('❌ Ошибка проверки:', error);
    throw error;
  } finally {
    await server.disconnect();
  }
}

// Запуск
checkUpdateFieldApi()
  .then(() => {
    logger.info('✅ Скрипт выполнен успешно');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Ошибка выполнения скрипта:', error);
    process.exit(1);
  });

