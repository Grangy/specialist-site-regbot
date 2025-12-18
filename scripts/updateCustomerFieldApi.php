<?php
/**
 * API для обновления полей контакта
 * Используется для массового обновления полей клиентов
 */

header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Логирование
$logFile = dirname(__FILE__) . '/logs/updateCustomerFieldApi.log';
$logDir = dirname($logFile);
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

function logMessage($message, $data = null) {
    global $logFile;
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[{$timestamp}] {$message}";
    if ($data !== null) {
        $logEntry .= " | Data: " . json_encode($data, JSON_UNESCAPED_UNICODE);
    }
    $logEntry .= PHP_EOL;
    file_put_contents($logFile, $logEntry, FILE_APPEND);
}

// Проверка токена
$token = $_POST['token'] ?? $_GET['token'] ?? '';
$expectedToken = 'SUPER_SECRET_TOKEN_123';

if ($token !== $expectedToken) {
    logMessage('ERROR: Invalid token', ['token' => $token]);
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid token'
    ]);
    exit;
}

// Получение параметров
$contactId = $_POST['contact_id'] ?? $_GET['contact_id'] ?? null;
$fieldName = $_POST['field_name'] ?? $_GET['field_name'] ?? null;
$fieldValue = $_POST['field_value'] ?? $_GET['field_value'] ?? null;

if (!$contactId || !$fieldName) {
    logMessage('ERROR: Missing required parameters', [
        'contact_id' => $contactId,
        'field_name' => $fieldName
    ]);
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'contact_id and field_name are required'
    ]);
    exit;
}

logMessage('INFO: Update field request', [
    'contact_id' => $contactId,
    'field_name' => $fieldName,
    'field_value' => $fieldValue
]);

try {
    // Подключение к Webasyst
    $waPath = dirname(__FILE__) . '/wa-config/SystemConfig.class.php';
    if (!file_exists($waPath)) {
        throw new Exception('Webasyst not found at: ' . $waPath);
    }
    
    require_once($waPath);
    $config = new SystemConfig();
    $wa = waSystem::getInstance('shop', $config);
    
    // Получаем контакт
    $contact = new waContact($contactId);
    
    if (!$contact->exists()) {
        logMessage('ERROR: Contact not found', ['contact_id' => $contactId]);
        http_response_code(404);
        echo json_encode([
            'success' => false,
            'error' => 'Contact not found'
        ]);
        exit;
    }
    
    // Обновляем поле через waContactDataModel (проверенный способ)
    try {
        $contactDataModel = new waContactDataModel();
        
        // Получаем старое значение для логирования
        $oldValue = null;
        $oldData = $contactDataModel->getByField(array(
            'contact_id' => $contactId,
            'field' => $fieldName
        ));
        if ($oldData) {
            $oldValue = $oldData['value'];
        }
        
        // Удаляем старое значение поля (если есть)
        $contactDataModel->deleteByField(array(
            'contact_id' => $contactId,
            'field' => $fieldName
        ));
        
        // Добавляем новое значение (преобразуем в строку для совместимости)
        $contactDataModel->insert(array(
            'contact_id' => $contactId,
            'field' => $fieldName,
            'value' => (string)$fieldValue,
            'ext' => null,
            'sort' => 0
        ));
        
        // Проверяем, что значение установлено
        $newData = $contactDataModel->getByField(array(
            'contact_id' => $contactId,
            'field' => $fieldName
        ));
        $newValue = $newData ? $newData['value'] : null;
        
        if ($newValue != (string)$fieldValue) {
            throw new Exception("Field value was not updated correctly. Expected: {$fieldValue}, Got: {$newValue}");
        }
        
        logMessage('SUCCESS: Field updated', [
            'contact_id' => $contactId,
            'field_name' => $fieldName,
            'old_value' => $oldValue,
            'new_value' => $newValue
        ]);
        
    } catch (Exception $e) {
        logMessage('ERROR: Failed to update field', [
            'contact_id' => $contactId,
            'field_name' => $fieldName,
            'field_value' => $fieldValue,
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        throw $e;
    }
    
    // Успешный ответ
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'contact_id' => $contactId,
        'field_name' => $fieldName,
        'field_value' => $fieldValue,
        'message' => 'Field updated successfully'
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    logMessage('ERROR: Exception', [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'contact_id' => $contactId,
        'field_name' => $fieldName
    ]);
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}

