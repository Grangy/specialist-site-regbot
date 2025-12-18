<?php
/**
 * Скрипт для проверки логов и исправления проблем
 */

$waPath = __DIR__ . '/wa-config/SystemConfig.class.php';
if (!file_exists($waPath)) {
    die('Webasyst not found');
}

require_once($waPath);
$config = new SystemConfig();
$wa = waSystem::getInstance('shop', $config);

// Создаем директорию для логов если её нет
$logDir = __DIR__ . '/logs';
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
    echo "✅ Создана директория для логов: {$logDir}\n";
}

$logFile = $logDir . '/updateCustomerFieldApi.log';

// Проверяем логи
if (file_exists($logFile)) {
    echo "📋 Последние 30 строк лога:\n";
    $lines = file($logFile);
    $lastLines = array_slice($lines, -30);
    foreach ($lastLines as $line) {
        echo $line;
    }
} else {
    echo "⚠️  Лог файл не найден: {$logFile}\n";
}

// Проверяем структуру wa_contact_data
echo "\n📊 Структура wa_contact_data:\n";
$contactDataModel = new waContactDataModel();
$contactModel = new waContactModel(); // Используем для получения БД

$result = $contactModel->query("DESCRIBE wa_contact_data");
while ($row = $result->fetch()) {
    echo "  " . $row['Field'] . " (" . $row['Type'] . ")\n";
}

// Проверяем, есть ли записи с полем min_noncash_sum
$result = $contactModel->query("SELECT COUNT(*) as count FROM wa_contact_data WHERE field = 'min_noncash_sum'");
$row = $result->fetch();
echo "\nЗаписей с полем min_noncash_sum: " . $row['count'] . "\n";

// Показываем примеры
$result = $contactModel->query("SELECT contact_id, field, value FROM wa_contact_data WHERE field = 'min_noncash_sum' LIMIT 5");
echo "\nПримеры записей:\n";
while ($row = $result->fetch()) {
    echo "  contact_id: " . $row['contact_id'] . ", value: " . $row['value'] . "\n";
}

// Проверяем contact_id 144
$result = $contactModel->query("SELECT * FROM wa_contact_data WHERE contact_id = 144 AND field = 'min_noncash_sum'");
$row = $result->fetch();
if ($row) {
    echo "\n✅ Текущее значение для contact_id 144: " . $row['value'] . "\n";
} else {
    echo "\n⚠️  Поле min_noncash_sum не установлено для contact_id 144\n";
}

// Тестируем обновление
echo "\n🧪 Тестируем обновление поля для contact_id 144...\n";
try {
    // Удаляем старое значение
    $contactDataModel->deleteByField(array(
        'contact_id' => 144,
        'field' => 'min_noncash_sum'
    ));
    
    // Добавляем новое значение
    $contactDataModel->insert(array(
        'contact_id' => 144,
        'field' => 'min_noncash_sum',
        'value' => '1000000',
        'ext' => null,
        'sort' => 0
    ));
    
    // Проверяем
    $check = $contactDataModel->getByField(array(
        'contact_id' => 144,
        'field' => 'min_noncash_sum'
    ));
    
    if ($check && $check['value'] == '1000000') {
        echo "✅ Тестовое обновление успешно! Значение установлено: " . $check['value'] . "\n";
    } else {
        echo "❌ Тестовое обновление не удалось\n";
    }
} catch (Exception $e) {
    echo "❌ Ошибка тестового обновления: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}

