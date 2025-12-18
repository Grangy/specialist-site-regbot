const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../src/config/config');
const logger = require('../src/utils/logger');
const customersApiService = require('../src/services/customersApiService');

/**
 * Скрипт для обновления поля min_noncash_sum у всех клиентов Дмитрия
 * 
 * Использование:
 *   node scripts/updateDmitryClientsMinNoncashSum.js [--dry-run] [--delay=1000]
 * 
 * Параметры:
 *   --dry-run  - Только показать, что будет обновлено, без реального обновления
 *   --delay    - Задержка между запросами в миллисекундах (по умолчанию 1000)
 */
async function updateDmitryClientsMinNoncashSum() {
  try {
    console.log('🚀 Начинаю обновление поля min_noncash_sum для клиентов Дмитрия...\n');

    // Параметры командной строки
    const isDryRun = process.argv.includes('--dry-run');
    const delayArg = process.argv.find(arg => arg.startsWith('--delay='));
    const delay = delayArg ? parseInt(delayArg.split('=')[1]) : 1000;

    if (isDryRun) {
      console.log('⚠️  РЕЖИМ ТЕСТИРОВАНИЯ: изменения не будут сохранены\n');
    }

    // 1. Читаем clients.json
    const clientsJsonPath = path.join(__dirname, '..', 'data', 'clients.json');
    if (!fs.existsSync(clientsJsonPath)) {
      throw new Error(`Файл не найден: ${clientsJsonPath}`);
    }

    console.log('📖 Читаю файл clients.json...');
    const clientsData = JSON.parse(fs.readFileSync(clientsJsonPath, 'utf8'));
    console.log(`✅ Загружено ${clientsData.length} клиентов\n`);

    // 2. Фильтруем клиентов Дмитрия
    // Ищем по разным вариантам имени менеджера
    const dmitryVariants = ['Дмитрий', 'Дмитрий ', ' Дмитрий', 'Дмитрий\n', '\nДмитрий'];
    const dmitryClients = clientsData.filter(client => {
      const manager = (client.manager || client['Основной менеджер'] || '').trim();
      return dmitryVariants.some(variant => manager.includes('Дмитрий')) || 
             manager.toLowerCase().includes('дмитрий');
    });

    console.log(`👥 Найдено ${dmitryClients.length} клиентов с менеджером Дмитрий\n`);

    if (dmitryClients.length === 0) {
      console.log('❌ Клиенты не найдены. Проверьте имя менеджера в данных.');
      process.exit(0);
    }

    // 3. Создаем Map клиентов Дмитрия по kodv1s для быстрого поиска
    const dmitryClientsMap = new Map();
    dmitryClients.forEach(client => {
      const code = (client.code || client['Код'] || '').trim().toUpperCase();
      if (code) {
        dmitryClientsMap.set(code, client);
      }
    });
    console.log(`📋 Создан индекс из ${dmitryClientsMap.size} клиентов Дмитрия по kodv1s\n`);

    // 4. Загружаем всех зарегистрированных клиентов из БД сайта и ищем совпадения по kodv1s
    console.log('📥 Загружаю всех зарегистрированных клиентов из БД сайта...');
    const customersToUpdate = [];
    let page = 0;
    const limit = 50;
    let totalLoaded = 0;
    
    while (true) {
      const listResult = await customersApiService.getCustomersList(page, limit);
      
      if (listResult.success && listResult.customers) {
        listResult.customers.forEach(customer => {
          let found = false;
          
          // Сначала ищем по точному совпадению kodv1s
          if (customer.kodv1s) {
            // Нормализуем kodv1s для сравнения (убираем пробелы, дефисы, приводим к верхнему регистру)
            const normalizedCode = customer.kodv1s.trim().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
            
            // Проверяем точное совпадение
            for (const [dmitryCode, dmitryClient] of dmitryClientsMap.entries()) {
              const normalizedDmitryCode = dmitryCode.replace(/\s+/g, '').replace(/-/g, '');
              if (normalizedCode === normalizedDmitryCode) {
                customersToUpdate.push({
                  contact_id: customer.contact_id,
                  kodv1s: customer.kodv1s,
                  name: customer.name,
                  dmitryClient: dmitryClient,
                  matchType: 'kodv1s'
                });
                found = true;
                break;
              }
            }
          }
          
          // Если не нашли по kodv1s, пробуем поиск по имени (частичное совпадение)
          if (!found && customer.name) {
            const customerName = customer.name.trim().toLowerCase();
            for (const [dmitryCode, dmitryClient] of dmitryClientsMap.entries()) {
              const dmitryName = (dmitryClient.name || dmitryClient['Наименование'] || '').trim().toLowerCase();
              
              // Проверяем частичное совпадение имен (минимум 5 символов совпадают)
              if (dmitryName.length >= 5 && customerName.length >= 5) {
                // Извлекаем ключевые слова из имен
                const customerWords = customerName.split(/\s+/).filter(w => w.length > 3);
                const dmitryWords = dmitryName.split(/\s+/).filter(w => w.length > 3);
                
                // Если есть общие слова
                const commonWords = customerWords.filter(w => dmitryWords.some(dw => dw.includes(w) || w.includes(dw)));
                if (commonWords.length > 0) {
                  // Проверяем, что это не дубликат
                  const alreadyAdded = customersToUpdate.some(c => c.contact_id === customer.contact_id);
                  if (!alreadyAdded) {
                    customersToUpdate.push({
                      contact_id: customer.contact_id,
                      kodv1s: customer.kodv1s || 'не указан',
                      name: customer.name,
                      dmitryClient: dmitryClient,
                      matchType: 'name',
                      dmitryCode: dmitryCode
                    });
                    found = true;
                    break;
                  }
                }
              }
            }
          }
        });
        
        totalLoaded += listResult.customers.length;
        console.log(`   Загружено ${totalLoaded} клиентов, найдено совпадений: ${customersToUpdate.length}...`);
        
        // Если на странице меньше клиентов чем limit, значит это последняя страница
        if (listResult.customers.length < limit) {
          break;
        }
      } else {
        break;
      }
      
      page++;
      
      // Защита от бесконечного цикла
      if (page > 100) {
        console.log('   ⚠️  Достигнут лимит страниц (100)');
        break;
      }
    }
    
    console.log(`✅ Загружено ${totalLoaded} клиентов из БД сайта`);
    console.log(`✅ Найдено ${customersToUpdate.length} зарегистрированных клиентов Дмитрия для обновления\n`);

    // Создаем список всех клиентов Дмитрия с информацией о регистрации
    const allDmitryClientsStatus = dmitryClients.map(client => {
      const code = (client.code || client['Код'] || '').trim().toUpperCase();
      const name = client.name || client['Наименование'] || 'Без имени';
      const isRegistered = customersToUpdate.some(c => 
        (c.kodv1s || '').trim().toUpperCase() === code
      );
      return {
        name,
        code,
        isRegistered,
        contact_id: isRegistered ? customersToUpdate.find(c => 
          (c.kodv1s || '').trim().toUpperCase() === code
        )?.contact_id : null
      };
    });

    const registeredCount = allDmitryClientsStatus.filter(c => c.isRegistered).length;
    const notRegisteredCount = allDmitryClientsStatus.filter(c => !c.isRegistered).length;

    console.log(`📊 Статистика по клиентам Дмитрия:`);
    console.log(`   ✅ Зарегистрировано на сайте: ${registeredCount}`);
    console.log(`   ⚠️  Не зарегистрировано: ${notRegisteredCount}`);
    console.log(`   📋 Всего в Excel: ${dmitryClients.length}\n`);

    if (customersToUpdate.length === 0) {
      console.log('⚠️  Не найдено зарегистрированных клиентов Дмитрия в БД сайта.');
      console.log('   Возможно, они еще не зарегистрированы на сайте.');
      console.log('\n💡 Для регистрации клиентов используйте бота или API регистрации.\n');
      process.exit(0);
    }

    // 5. Обновляем поле min_noncash_sum для найденных клиентов
    const results = {
      success: [],
      failed: []
    };

    const minNoncashSum = 1000000;

    console.log(`🔄 Начинаю обновление поля min_noncash_sum = ${minNoncashSum}...\n`);
    console.log(`⏱️  Задержка между запросами: ${delay}ms\n`);

    for (let i = 0; i < customersToUpdate.length; i++) {
      const customer = customersToUpdate[i];
      const contactId = customer.contact_id;
      const kodv1s = customer.kodv1s;
      const name = customer.name;
      const dmitryClient = customer.dmitryClient;

      console.log(`[${i + 1}/${customersToUpdate.length}] Обработка: ${name}`);
      console.log(`   Код: ${kodv1s}`);
      console.log(`   Contact ID: ${contactId}`);
      if (customer.matchType === 'name') {
        console.log(`   ⚠️  Найден по имени (kodv1s может не совпадать)`);
      }

      try {
        // Обновляем поле
        if (isDryRun) {
          console.log(`   🔍 [DRY RUN] Будет обновлено: min_noncash_sum = ${minNoncashSum}`);
          results.success.push({
            client: name,
            code: kodv1s,
            contact_id: contactId,
            field_value: minNoncashSum
          });
        } else {
          const updateResult = await updateCustomerField(contactId, 'min_noncash_sum', minNoncashSum);
          
          if (updateResult.success) {
            console.log(`   ✅ Поле обновлено успешно`);
            results.success.push({
              client: name,
              code: kodv1s,
              contact_id: contactId,
              field_value: minNoncashSum
            });
          } else {
            console.log(`   ❌ Ошибка обновления: ${updateResult.error}`);
            results.failed.push({
              client: name,
              code: kodv1s,
              contact_id: contactId,
              error: updateResult.error
            });
          }
        }

        console.log('');

        // Задержка между запросами
        if (i < customersToUpdate.length - 1) {
          await sleep(delay);
        }

      } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
        results.failed.push({
          client: name,
          code: kodv1s,
          contact_id: contactId,
          error: error.message
        });
        console.log('');
      }
    }

    // 6. Выводим итоговую статистику
    console.log('\n' + '='.repeat(60));
    console.log('📊 ИТОГОВАЯ СТАТИСТИКА');
    console.log('='.repeat(60));
    console.log(`✅ Успешно обновлено: ${results.success.length}`);
    console.log(`❌ Ошибок: ${results.failed.length}`);
    console.log(`📋 Всего найдено зарегистрированных: ${customersToUpdate.length}`);
    console.log(`📋 Всего клиентов Дмитрия в Excel: ${dmitryClients.length}\n`);

    if (results.failed.length > 0) {
      console.log('❌ ОШИБКИ:');
      results.failed.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.client} (${item.code || 'нет кода'})`);
        console.log(`      Ошибка: ${item.error}`);
      });
      console.log('');
    }

    // Сохраняем отчет
    const reportPath = path.join(__dirname, '..', 'data', `dmitry_clients_update_${Date.now()}.json`);
    const report = {
      timestamp: new Date().toISOString(),
      isDryRun: isDryRun,
      minNoncashSum: minNoncashSum,
      total: dmitryClients.length,
      registered: registeredCount,
      notRegistered: notRegisteredCount,
      results: results,
      allClientsStatus: allDmitryClientsStatus
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`📄 Отчет сохранен: ${reportPath}\n`);

    // Сохраняем список незарегистрированных клиентов
    if (notRegisteredCount > 0) {
      const notRegisteredPath = path.join(__dirname, '..', 'data', `dmitry_clients_not_registered_${Date.now()}.txt`);
      const notRegisteredList = allDmitryClientsStatus
        .filter(c => !c.isRegistered)
        .map((c, i) => `${i + 1}. ${c.name} (${c.code})`)
        .join('\n');
      fs.writeFileSync(notRegisteredPath, 
        `Клиенты Дмитрия, не зарегистрированные на сайте (${notRegisteredCount} из ${dmitryClients.length}):\n\n${notRegisteredList}`,
        'utf8'
      );
      console.log(`📋 Список незарегистрированных клиентов сохранен: ${notRegisteredPath}\n`);
    }

    logger.info(`Обновление клиентов Дмитрия завершено: успешно ${results.success.length}, ошибок ${results.failed.length}, найдено зарегистрированных ${customersToUpdate.length}`);

  } catch (error) {
    console.error('\n❌ Критическая ошибка:', error.message);
    logger.error('Ошибка обновления клиентов Дмитрия:', error);
    process.exit(1);
  }
}

/**
 * Обновление поля контакта через API
 */
async function updateCustomerField(contactId, fieldName, fieldValue) {
  try {
    const apiUrl = 'https://specialist82.pro/updateCustomerFieldApi.php';
    const token = config.customersApi.token;

    const formData = new URLSearchParams();
    formData.append('token', token);
    formData.append('contact_id', contactId);
    formData.append('field_name', fieldName);
    formData.append('field_value', fieldValue);

    const response = await axios.post(apiUrl, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 15000
    });

    if (response.data.success) {
      return {
        success: true,
        data: response.data
      };
    } else {
      return {
        success: false,
        error: response.data.error || 'Unknown error'
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      details: error.response?.data || null
    };
  }
}

/**
 * Задержка
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Запуск скрипта
if (require.main === module) {
  updateDmitryClientsMinNoncashSum()
    .then(() => {
      console.log('✅ Скрипт завершен успешно');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Скрипт завершен с ошибкой:', error);
      process.exit(1);
    });
}

module.exports = { updateDmitryClientsMinNoncashSum };

