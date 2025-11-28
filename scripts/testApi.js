const apiService = require('../src/services/apiService');
const logger = require('../src/utils/logger');

/**
 * Скрипт для тестирования API
 */
async function testApi() {
  console.log('🧪 Тестирование API...\n');

  // Тестовые данные
  const testData = {
    name: 'Тестовый Клиент ООО',
    code: 'TEST-00000001',
    phone: '+79999999999',
    email: 'test@example.com'
  };

  console.log('📋 Тестовые данные:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('');

  try {
    console.log('📤 Отправка запроса к API...');
    const result = await apiService.registerCustomer(testData);

    console.log('\n📥 Результат:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success) {
      console.log('\n✅ API работает корректно!');
    } else {
      console.log('\n❌ API вернуло ошибку');
      console.log('Детали:', result.error);
    }
  } catch (error) {
    console.error('\n❌ Ошибка при тестировании:', error.message);
  }
}

// Запускаем тест
testApi();



