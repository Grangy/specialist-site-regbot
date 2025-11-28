const sqlite3 = require('sqlite3').verbose();
const path = require('path');

/**
 * Скрипт для просмотра статистики
 */
function getStats() {
  const dbPath = path.join(__dirname, '..', 'data', 'users.db');
  const db = new sqlite3.Database(dbPath);

  console.log('📊 Статистика бота\n');

  db.serialize(() => {
    // Общая статистика
    db.get(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM registration_history) as total_registrations,
        (SELECT COUNT(*) FROM registration_history WHERE status = 'success') as successful,
        (SELECT COUNT(*) FROM registration_history WHERE status = 'error') as failed
    `, (err, row) => {
      if (err) {
        console.error('Ошибка:', err);
        return;
      }

      console.log('📈 Общая статистика:');
      console.log(`   👥 Всего пользователей: ${row.total_users}`);
      console.log(`   📝 Всего регистраций: ${row.total_registrations}`);
      console.log(`   ✅ Успешных: ${row.successful}`);
      console.log(`   ❌ Неудачных: ${row.failed}`);
      console.log('');
    });

    // Топ пользователей
    db.all(`
      SELECT 
        u.chat_id,
        u.first_name,
        u.username,
        COUNT(rh.id) as registrations
      FROM users u
      LEFT JOIN registration_history rh ON u.chat_id = rh.chat_id
      GROUP BY u.chat_id
      ORDER BY registrations DESC
      LIMIT 10
    `, (err, rows) => {
      if (err) {
        console.error('Ошибка:', err);
        return;
      }

      console.log('🏆 Топ-10 активных пользователей:');
      rows.forEach((row, index) => {
        const name = row.first_name || row.username || 'Неизвестен';
        console.log(`   ${index + 1}. ${name}: ${row.registrations} регистраций`);
      });
      console.log('');
    });

    // Последние регистрации
    db.all(`
      SELECT 
        client_name,
        status,
        created_at
      FROM registration_history
      ORDER BY created_at DESC
      LIMIT 10
    `, (err, rows) => {
      if (err) {
        console.error('Ошибка:', err);
        return;
      }

      console.log('📋 Последние 10 регистраций:');
      rows.forEach((row, index) => {
        const status = row.status === 'success' ? '✅' : '❌';
        const date = new Date(row.created_at).toLocaleString('ru-RU');
        console.log(`   ${status} ${row.client_name}`);
        console.log(`      ${date}`);
      });
      console.log('');

      db.close();
    });
  });
}

if (require.main === module) {
  getStats();
}

module.exports = { getStats };



