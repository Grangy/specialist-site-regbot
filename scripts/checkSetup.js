const fs = require('fs');
const path = require('path');

/**
 * Скрипт для проверки корректности установки
 */
function checkSetup() {
  console.log('🔍 Проверка установки проекта\n');

  let allOk = true;

  // Проверка node_modules
  console.log('📦 Проверка зависимостей...');
  if (fs.existsSync(path.join(__dirname, '..', 'node_modules'))) {
    console.log('  ✅ node_modules установлены');
  } else {
    console.log('  ❌ node_modules не найдены. Запустите: npm install');
    allOk = false;
  }

  // Проверка .env
  console.log('\n⚙️  Проверка конфигурации...');
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    console.log('  ✅ .env файл существует');
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const requiredVars = [
      'TELEGRAM_BOT_TOKEN',
      'BOT_PASSWORD',
      'API_URL',
      'API_ACCESS_TOKEN'
    ];

    requiredVars.forEach(varName => {
      if (envContent.includes(varName)) {
        console.log(`  ✅ ${varName} настроен`);
      } else {
        console.log(`  ❌ ${varName} не найден в .env`);
        allOk = false;
      }
    });
  } else {
    console.log('  ❌ .env файл не найден');
    allOk = false;
  }

  // Проверка clients.json
  console.log('\n📊 Проверка базы клиентов...');
  const clientsPath = path.join(__dirname, '..', 'data', 'clients.json');
  if (fs.existsSync(clientsPath)) {
    const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
    console.log(`  ✅ База клиентов загружена (${clients.length} клиентов)`);
  } else {
    console.log('  ❌ clients.json не найден. Запустите: npm run convert');
    allOk = false;
  }

  // Проверка директорий
  console.log('\n📁 Проверка структуры директорий...');
  const dirs = [
    'data',
    'logs',
    'src',
    'src/config',
    'src/database',
    'src/handlers',
    'src/services',
    'src/utils',
    'scripts'
  ];

  dirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (fs.existsSync(dirPath)) {
      console.log(`  ✅ ${dir}/`);
    } else {
      console.log(`  ❌ ${dir}/ не найдена`);
      allOk = false;
    }
  });

  // Проверка ключевых файлов
  console.log('\n📄 Проверка ключевых файлов...');
  const files = [
    'src/index.js',
    'src/config/config.js',
    'src/database/database.js',
    'src/handlers/authHandler.js',
    'src/handlers/registrationHandler.js',
    'package.json'
  ];

  files.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    if (fs.existsSync(filePath)) {
      console.log(`  ✅ ${file}`);
    } else {
      console.log(`  ❌ ${file} не найден`);
      allOk = false;
    }
  });

  // Итоги
  console.log('\n' + '='.repeat(50));
  if (allOk) {
    console.log('✅ Все проверки пройдены!');
    console.log('\n🚀 Проект готов к запуску:');
    console.log('   npm start\n');
  } else {
    console.log('❌ Обнаружены проблемы!');
    console.log('\n📝 Рекомендации:');
    console.log('   1. npm install          - установить зависимости');
    console.log('   2. npm run convert      - конвертировать Excel');
    console.log('   3. Проверить .env файл  - все токены настроены?\n');
  }
  console.log('='.repeat(50));

  return allOk;
}

if (require.main === module) {
  const success = checkSetup();
  process.exit(success ? 0 : 1);
}

module.exports = { checkSetup };



