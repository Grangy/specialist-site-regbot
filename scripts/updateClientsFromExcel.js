const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

/**
 * Обновляет клиентов из Excel файла
 * По умолчанию использует "клиенты 17122025.xlsx", но можно указать другой файл через аргумент
 */
async function updateClientsFromExcel(excelFileName = null) {
  try {
    console.log('📊 Начинаю обновление клиентов из Excel...');

    // Определяем имя файла
    let fileName = excelFileName;
    if (!fileName) {
      // Пробуем найти файл с датой в названии (клиенты 17122025.xlsx)
      const possibleFiles = [
        'клиенты 17122025.xlsx',
        'Клиенты новые.xlsx',
        'Клиенты.xlsx'
      ];
      
      for (const file of possibleFiles) {
        const testPath = path.join(__dirname, '..', file);
        if (fs.existsSync(testPath)) {
          fileName = file;
          break;
        }
      }
      
      if (!fileName) {
        throw new Error(`Не найден файл клиентов. Ожидаемые имена: ${possibleFiles.join(', ')}`);
      }
    }

    // Путь к Excel файлу
    const excelPath = path.join(__dirname, '..', fileName);
    const outputPath = path.join(__dirname, '..', 'data', 'clients.json');
    const backupPath = path.join(__dirname, '..', 'data', `clients.backup.${Date.now()}.json`);

    console.log(`📄 Используется файл: ${fileName}`);

    // Проверяем существование Excel файла
    if (!fs.existsSync(excelPath)) {
      throw new Error(`Файл не найден: ${excelPath}`);
    }

    // Создаем бэкап существующего файла клиентов
    if (fs.existsSync(outputPath)) {
      console.log('📦 Создаю бэкап существующего файла...');
      fs.copyFileSync(outputPath, backupPath);
      console.log(`✅ Бэкап создан: ${backupPath}`);
    }

    // Читаем Excel файл
    console.log('📖 Читаю Excel файл...');
    const workbook = XLSX.readFile(excelPath);
    
    // Получаем первый лист
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Конвертируем в JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`✅ Найдено ${jsonData.length} строк в Excel`);

    // Нормализуем данные
    const clients = jsonData
      .map((row, index) => {
        // Извлекаем основные поля
        const name = row['Наименование'] || '';
        const code = row['Код'] || '';
        const manager = row['Основной менеджер'] || '';
        const region = row['Бизнес-регион'] || '';
        const regDate = row['Дата регистрации'] || '';

        // Пропускаем пустые записи
        if (!name || !code) {
          return null;
        }

        return {
          id: index + 1,
          name: name.trim(),
          manager: manager.trim(),
          code: code.trim(),
          region: region.trim(),
          registrationDate: regDate.trim(),
          // Сохраняем все оригинальные поля из Excel
          ...row
        };
      })
      .filter(client => client !== null); // Удаляем null записи

    console.log(`✅ Обработано ${clients.length} валидных клиентов`);

    // Создаем директорию data если её нет
    const dataDir = path.dirname(outputPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Сохраняем в JSON файл
    fs.writeFileSync(outputPath, JSON.stringify(clients, null, 2), 'utf8');

    console.log(`\n✅ Клиенты успешно обновлены!`);
    console.log(`📁 Файл сохранен: ${outputPath}`);
    console.log(`📊 Всего клиентов: ${clients.length}`);
    console.log(`📝 Пример первого клиента:`);
    console.log(JSON.stringify(clients[0], null, 2));
    
    // Статистика
    const managers = [...new Set(clients.map(c => c.manager).filter(Boolean))];
    const regions = [...new Set(clients.map(c => c.region).filter(Boolean))];
    
    console.log(`\n📈 Статистика:`);
    console.log(`   - Уникальных менеджеров: ${managers.length}`);
    console.log(`   - Уникальных регионов: ${regions.length}`);
    
    if (fs.existsSync(backupPath)) {
      const oldClients = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      const added = clients.length - oldClients.length;
      console.log(`   - Изменение количества: ${added > 0 ? '+' : ''}${added}`);
    }

    logger.info(`Клиенты обновлены из Excel: ${clients.length} записей`);
    
    return clients;
  } catch (error) {
    console.error('❌ Ошибка при обновлении клиентов:', error.message);
    logger.error('Ошибка обновления клиентов:', error);
    process.exit(1);
  }
}

// Запускаем если файл выполняется напрямую
if (require.main === module) {
  // Можно передать имя файла как аргумент командной строки
  const fileName = process.argv[2] || null;
  updateClientsFromExcel(fileName);
}

module.exports = { updateClientsFromExcel };





