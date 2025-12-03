const ServerConnection = require('./serverConnection');
const logger = require('../src/utils/logger');

/**
 * Исправление ошибок округления в shopHelper.class.php
 */
class FixRoundTotal {
  constructor() {
    this.server = new ServerConnection();
    this.filePath = '/var/www/specialist82_usr/data/www/specialist82.pro/wa-apps/shop/lib/classes/shopHelper.class.php';
  }

  async run() {
    try {
      logger.info('🔧 Исправление ошибок округления...');

      await this.server.connect();

      // Читаем файл
      const code = await this.server.readFile(this.filePath);

      // Создаём бэкап
      await this.server.backupFile(this.filePath);

      // Исправляем код
      const fixedCode = this.fixRounding(code);

      // Загружаем обратно
      await this.server.writeFile(this.filePath, fixedCode);

      logger.info('✅ Ошибки округления исправлены!');

    } catch (error) {
      logger.error('❌ Ошибка:', error);
      throw error;
    } finally {
      await this.server.disconnect();
    }
  }

  fixRounding(code) {
    logger.info('Исправление округления...');

    // Ищем проблемный участок кода
    const oldCode = `        $order_data['total'] = $order_data['shipping'];
        foreach ($order_data['items'] as $item) {
            $item_subtotal = $item['price'] * $item['quantity'];
            if (isset($item['tax_included']) && empty($item['tax_included']) && !empty($item['tax_rate'])) {
                $item_subtotal *= 1 + $item['tax_rate']/100;
            }
            $order_data['total'] += $item_subtotal;
        }

        $order_data['total'] -= $order_data['discount'];`;

    const newCode = `        $order_data['total'] = round($order_data['shipping'], 2);
        foreach ($order_data['items'] as $item) {
            $item_subtotal = $item['price'] * $item['quantity'];
            if (isset($item['tax_included']) && empty($item['tax_included']) && !empty($item['tax_rate'])) {
                $item_subtotal *= 1 + $item['tax_rate']/100;
            }
            $item_subtotal = round($item_subtotal, 2);
            $order_data['total'] = round($order_data['total'] + $item_subtotal, 2);
        }

        $order_data['total'] = round($order_data['total'] - $order_data['discount'], 2);`;

    if (code.includes(oldCode)) {
      code = code.replace(oldCode, newCode);
      logger.info('✅ Код округления исправлен');
    } else {
      logger.warn('⚠️ Точный паттерн не найден, пробуем частичную замену...');
      
      // Частичная замена
      code = code.replace(
        /\$order_data\['total'\] = \$order_data\['shipping'\];/,
        "$order_data['total'] = round($order_data['shipping'], 2);"
      );
      
      code = code.replace(
        /(\$order_data\['total'\] \+= \$item_subtotal;)/,
        "$item_subtotal = round($item_subtotal, 2);\n            $1\n            $order_data['total'] = round($order_data['total'], 2);"
      );
      
      code = code.replace(
        /\$order_data\['total'\] -= \$order_data\['discount'\];/,
        "$order_data['total'] = round($order_data['total'] - $order_data['discount'], 2);"
      );
      
      logger.info('✅ Код округления исправлен (частичная замена)');
    }

    return code;
  }
}

if (require.main === module) {
  const fixer = new FixRoundTotal();
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

module.exports = FixRoundTotal;

