const ServerConnection = require('./serverConnection');
const logger = require('../src/utils/logger');

/**
 * Исправление логики категорий на сервере
 */
class FixCategoriesOnServer {
  constructor() {
    this.server = new ServerConnection();
    this.apiPath = '/var/www/specialist82_usr/data/www/specialist82.pro/create_lk_api.php';
  }

  async run() {
    try {
      logger.info('🔧 Исправление логики категорий...');

      await this.server.connect();

      // Читаем текущий файл
      const currentCode = await this.server.readFile(this.apiPath);

      // Создаём бэкап
      await this.server.backupFile(this.apiPath);

      // Исправляем код
      const fixedCode = this.fixCategories(currentCode);

      // Загружаем обратно
      await this.server.writeFile(this.apiPath, fixedCode);

      logger.info('✅ Логика категорий исправлена!');

    } catch (error) {
      logger.error('❌ Ошибка:', error);
      throw error;
    } finally {
      await this.server.disconnect();
    }
  }

  fixCategories(code) {
    logger.info('Исправление блока категорий...');

    // Ищем блок с категориями и заменяем его
    const oldPattern = /\/\/ === категории ===[\s\S]*?if \(\!\$in_category\) \{[\s\S]*?\$ccm->add\(\$contact_id, \$category_id\);/;
    
    const newBlock = `    // === категории ===
    dstep($response, 'load_categories');

    $cats = $ccm->getContactCategories($contact_id); // category_id => ...
    
    // ВСЕГДА добавляем категорию 2 ("Цены видны") для всех клиентов
    $base_category_id = 2;
    $in_base_category = !empty($cats[$base_category_id]);
    
    if (!$in_base_category) {
        dstep($response, 'add_base_category', ['category_id' => $base_category_id]);
        logMessage('Base category added', ['contact_id' => $contact_id, 'category_id' => $base_category_id]);
        $ccm->add($contact_id, $base_category_id);
    }
    
    // Если передан category_id=4, дополнительно добавляем категорию 4 ("Цена Прайс лист1")
    if ($category_id == 4) {
        $in_price_category = !empty($cats[4]);
        if (!$in_price_category) {
            dstep($response, 'add_price_category', ['category_id' => 4]);
            logMessage('Price category added', ['contact_id' => $contact_id, 'category_id' => 4]);
            $ccm->add($contact_id, 4);
        }
    }`;

    if (oldPattern.test(code)) {
      code = code.replace(oldPattern, newBlock);
      logger.info('✅ Блок категорий заменён');
    } else {
      // Если паттерн не найден, ищем другой вариант
      const altPattern = /\$cats = \$ccm->getContactCategories\(\$contact_id\);[\s\S]*?\$ccm->add\(\$contact_id, \$category_id\);/;
      if (altPattern.test(code)) {
        code = code.replace(altPattern, newBlock.replace('    // === категории ===\n    dstep($response, \'load_categories\');\n\n    ', ''));
        logger.info('✅ Блок категорий заменён (альтернативный паттерн)');
      } else {
        logger.warn('⚠️ Не найден блок категорий для замены, добавляем новый');
        // Ищем место после "// === категории ==="
        const insertAfter = code.indexOf('// === категории ===');
        if (insertAfter > 0) {
          const insertPos = code.indexOf('}', code.indexOf('$ccm->add', insertAfter)) + 1;
          code = code.slice(0, insertPos) + '\n\n' + newBlock + '\n' + code.slice(insertPos);
        }
      }
    }

    // Обновляем ответ чтобы показывал обе категории
    if (code.includes("$response['category_id'] = $category_id;")) {
      code = code.replace(
        "$response['category_id'] = $category_id;",
        "$response['category_id'] = $category_id;\n    $response['base_category_id'] = 2;\n    $response['has_price_category'] = ($category_id == 4);"
      );
    }

    return code;
  }
}

if (require.main === module) {
  const fixer = new FixCategoriesOnServer();
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

module.exports = FixCategoriesOnServer;

