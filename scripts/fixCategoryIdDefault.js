const ServerConnection = require('./serverConnection');
const logger = require('../src/utils/logger');

/**
 * Исправление значения по умолчанию для category_id
 */
class FixCategoryIdDefault {
  constructor() {
    this.server = new ServerConnection();
    this.apiPath = '/var/www/specialist82_usr/data/www/specialist82.pro/create_lk_api.php';
  }

  async run() {
    try {
      logger.info('🔧 Исправление значения по умолчанию для category_id...');

      await this.server.connect();

      // Читаем текущий файл
      const currentCode = await this.server.readFile(this.apiPath);

      // Создаём бэкап
      await this.server.backupFile(this.apiPath);

      // Исправляем код
      const fixedCode = this.fixCategoryIdDefault(currentCode);

      // Загружаем обратно
      await this.server.writeFile(this.apiPath, fixedCode);

      logger.info('✅ Значение по умолчанию исправлено!');

    } catch (error) {
      logger.error('❌ Ошибка:', error);
      throw error;
    } finally {
      await this.server.disconnect();
    }
  }

  fixCategoryIdDefault(code) {
    logger.info('Исправление значения по умолчанию...');

    // Заменяем строку где category_id по умолчанию = 2
    // Должно быть: category_id может быть null, категория 2 всегда добавляется в блоке категорий
    const oldPattern = /\$category_id = isset\(\$_REQUEST\['category_id'\]\) \? \(int\)\$_REQUEST\['category_id'\] : 2;.*?\/\/ по умолчанию "цены видны" \(2\), если передан 4 - "Цена Прайс лист1"/;
    
    const newLine = `    // === category_id из запроса ===
    // category_id может быть null (обычный прайс) или 4 (Прайс 1)
    // Категория 2 ("Цены видны") всегда добавляется в блоке категорий
    $category_id = isset($_REQUEST['category_id']) && $_REQUEST['category_id'] !== '' && $_REQUEST['category_id'] !== '0' 
        ? (int)$_REQUEST['category_id'] 
        : null;`;

    if (oldPattern.test(code)) {
      code = code.replace(oldPattern, newLine);
      logger.info('✅ Значение по умолчанию исправлено');
    } else {
      // Альтернативный паттерн
      const altPattern = /\$category_id = isset\(\$_REQUEST\['category_id'\]\) \? \(int\)\$_REQUEST\['category_id'\] : 2;/;
      if (altPattern.test(code)) {
        code = code.replace(altPattern, newLine);
        logger.info('✅ Значение по умолчанию исправлено (альтернативный паттерн)');
      } else {
        logger.warn('⚠️ Паттерн не найден, ищем вручную...');
        const lines = code.split('\n');
        const categoryIdLineIndex = lines.findIndex(l => l.includes('$category_id = isset'));
        if (categoryIdLineIndex >= 0) {
          lines[categoryIdLineIndex] = newLine;
          code = lines.join('\n');
          logger.info('✅ Значение по умолчанию исправлено (ручной поиск)');
        }
      }
    }

    // Проверяем, что блок категорий правильно обрабатывает null
    if (!code.includes('if ($category_id == 4)')) {
      logger.warn('⚠️ Блок проверки category_id == 4 не найден');
    }

    return code;
  }
}

if (require.main === module) {
  const fixer = new FixCategoryIdDefault();
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

module.exports = FixCategoryIdDefault;

