const ServerConnection = require('./serverConnection');
const logger = require('../src/utils/logger');

/**
 * Исправление синтаксической ошибки в create_lk_api.php
 */
class FixCreateLKApiSyntax {
  constructor() {
    this.server = new ServerConnection();
    this.apiPath = '/var/www/specialist82_usr/data/www/specialist82.pro/create_lk_api.php';
  }

  async run() {
    try {
      logger.info('🔧 Исправление синтаксической ошибки...');

      await this.server.connect();

      // Читаем текущий файл
      const currentCode = await this.server.readFile(this.apiPath);

      // Создаём бэкап
      await this.server.backupFile(this.apiPath);

      // Исправляем код
      const fixedCode = this.fixSyntax(currentCode);

      // Загружаем обратно
      await this.server.writeFile(this.apiPath, fixedCode);

      logger.info('✅ Синтаксическая ошибка исправлена!');

    } catch (error) {
      logger.error('❌ Ошибка:', error);
      throw error;
    } finally {
      await this.server.disconnect();
    }
  }

  fixSyntax(code) {
    logger.info('Исправление синтаксиса...');

    // Убираем лишнюю закрывающую скобку после блока категорий
    // Ищем паттерн: блок категорий с лишней скобкой
    const pattern = /(\/\/ === категории ===[\s\S]*?if \(\!\$in_price_category\) \{[\s\S]*?\$ccm->add\(\$contact_id, 4\);\s*\}\s*)\}/;
    
    if (pattern.test(code)) {
      code = code.replace(pattern, '$1');
      logger.info('✅ Лишняя закрывающая скобка удалена');
    } else {
      // Альтернативный паттерн - ищем просто лишнюю скобку после блока категорий
      const altPattern = /(\$ccm->add\(\$contact_id, 4\);\s*\}\s*)\n\s*\}/;
      if (altPattern.test(code)) {
        code = code.replace(altPattern, '$1');
        logger.info('✅ Лишняя закрывающая скобка удалена (альтернативный паттерн)');
      } else {
        logger.warn('⚠️ Паттерн не найден, проверяем вручную...');
        // Ищем место где может быть лишняя скобка
        const categoryBlockEnd = code.indexOf('$ccm->add($contact_id, 4);');
        if (categoryBlockEnd > 0) {
          const afterCategory = code.substring(categoryBlockEnd);
          const nextBrace = afterCategory.indexOf('}');
          const afterBrace = afterCategory.substring(nextBrace + 1).trim();
          if (afterBrace.startsWith('}')) {
            // Нашли лишнюю скобку
            code = code.substring(0, categoryBlockEnd + afterCategory.indexOf('}') + 1) + 
                   afterBrace.substring(1);
            logger.info('✅ Лишняя закрывающая скобка удалена (ручной поиск)');
          }
        }
      }
    }

    // Проверяем, что блок категорий правильный
    const expectedBlock = `    // === категории ===
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

    // Если блок категорий не соответствует ожидаемому, заменяем его
    if (!code.includes('$base_category_id = 2;')) {
      logger.warn('⚠️ Блок категорий не найден, заменяем полностью...');
      const oldCategoryPattern = /\/\/ === категории ===[\s\S]*?\$ccm->add\(\$contact_id, \$category_id\);/;
      if (oldCategoryPattern.test(code)) {
        code = code.replace(oldCategoryPattern, expectedBlock);
        logger.info('✅ Блок категорий заменён');
      }
    }

    return code;
  }
}

if (require.main === module) {
  const fixer = new FixCreateLKApiSyntax();
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

module.exports = FixCreateLKApiSyntax;

