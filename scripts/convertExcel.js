const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Конвертирует Excel файл с клиентами в JSON
 */
function convertExcelToJson() {
  try {
    console.log('📊 Начинаю конвертацию Excel в JSON...');

    // Читаем Excel файл
    const workbook = XLSX.readFile(path.join(__dirname, '..', 'Клиенты.xlsx'));
    
    // Получаем первый лист
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Конвертируем в JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`✅ Найдено ${jsonData.length} клиентов`);

    // Нормализуем данные
    const clients = jsonData.map((row, index) => {
      // Пытаемся определить колонки автоматически
      const keys = Object.keys(row);
      
      return {
        id: index + 1,
        name: row['Наименование'] || row[keys[0]] || '',
        manager: row['Основной менеджер'] || row[keys[1]] || '',
        code: row['Код'] || row[keys[2]] || '',
        // Дополнительные поля если есть
        ...row
      };
    }).filter(client => client.name); // Фильтруем пустые записи

    // Создаем директорию data если её нет
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Сохраняем в JSON файл
    const outputPath = path.join(dataDir, 'clients.json');
    fs.writeFileSync(outputPath, JSON.stringify(clients, null, 2), 'utf8');

    console.log(`✅ Клиенты успешно сохранены в ${outputPath}`);
    console.log(`📝 Пример первого клиента:`);
    console.log(JSON.stringify(clients[0], null, 2));
    
    return clients;
  } catch (error) {
    console.error('❌ Ошибка при конвертации:', error.message);
    process.exit(1);
  }
}

// Запускаем если файл выполняется напрямую
if (require.main === module) {
  convertExcelToJson();
}

module.exports = { convertExcelToJson };



