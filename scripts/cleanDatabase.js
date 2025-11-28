const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Скрипт для очистки базы данных
 */
async function cleanDatabase() {
  console.log('🗑️  Очистка базы данных\n');

  const dbPath = path.join(__dirname, '..', 'data', 'users.db');

  if (!fs.existsSync(dbPath)) {
    console.log('ℹ️  База данных не найдена. Нечего очищать.');
    return;
  }

  // Запрашиваем подтверждение
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('⚠️  Вы уверены что хотите удалить базу данных? (yes/no): ', (answer) => {
      rl.close();

      if (answer.toLowerCase() === 'yes') {
        try {
          fs.unlinkSync(dbPath);
          console.log('✅ База данных успешно удалена');
          console.log('ℹ️  При следующем запуске бота будет создана новая БД');
        } catch (error) {
          console.error('❌ Ошибка при удалении:', error.message);
        }
      } else {
        console.log('❌ Отменено');
      }

      resolve();
    });
  });
}

if (require.main === module) {
  cleanDatabase();
}

module.exports = { cleanDatabase };



