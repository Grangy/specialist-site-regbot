<?php
/**
 * API для получения списка всех клиентов из БД сайта
 * Используется ботом для отображения всех клиентов и поиска
 */

header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Логирование ошибок
$logFile = dirname(__FILE__) . '/logs/getAllCustomersApi.log';
$logDir = dirname($logFile);
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}

function logError($message, $data = null) {
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
$token = isset($_REQUEST['token']) ? $_REQUEST['token'] : '';
$expectedToken = 'SUPER_SECRET_TOKEN_123'; // Должен совпадать с токеном в .env

if ($token !== $expectedToken) {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'Unauthorized: Invalid token'
    ]);
    exit;
}

// Подключение к Webasyst
$path = dirname(__FILE__) . '/wa-config/SystemConfig.class.php';
if (!file_exists($path)) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'SystemConfig not found'
    ]);
    exit;
}

require_once($path);

$config = new SystemConfig();
$wa = waSystem::getInstance('shop', $config);

try {
    // Получаем параметры запроса
    $action = isset($_REQUEST['action']) ? $_REQUEST['action'] : 'list';
    $page = isset($_REQUEST['page']) ? (int)$_REQUEST['page'] : 0;
    $limit = isset($_REQUEST['limit']) ? (int)$_REQUEST['limit'] : 10;
    $search = isset($_REQUEST['search']) ? trim($_REQUEST['search']) : '';
    $contactId = isset($_REQUEST['contact_id']) ? (int)$_REQUEST['contact_id'] : null;
    
    $offset = $page * $limit;
    
    // Получаем все контакты (не пользователи системы)
    $contactModel = new waContactModel();
    
    if ($action === 'list') {
        // Получаем список клиентов
        $sql = "SELECT DISTINCT c.id, c.name, c.firstname, c.middlename, c.lastname, c.create_datetime
                FROM wa_contact c
                WHERE c.is_user = 0";
        
        if ($search) {
            $searchEscaped = $contactModel->escape($search);
            $sql .= " AND (c.name LIKE '%{$searchEscaped}%' OR c.firstname LIKE '%{$searchEscaped}%' OR c.lastname LIKE '%{$searchEscaped}%')";
        }
        
        $sql .= " ORDER BY c.id DESC LIMIT {$limit} OFFSET {$offset}";
        
        $contacts = $contactModel->query($sql)->fetchAll();
        
        // Получаем общее количество
        $countSql = "SELECT COUNT(DISTINCT c.id) as total
                     FROM wa_contact c
                     WHERE c.is_user = 0";
        if ($search) {
            $searchEscaped = $contactModel->escape($search);
            $countSql .= " AND (c.name LIKE '%{$searchEscaped}%' OR c.firstname LIKE '%{$searchEscaped}%' OR c.lastname LIKE '%{$searchEscaped}%')";
        }
        $total = $contactModel->query($countSql)->fetch()['total'];
        
    } elseif ($action === 'get') {
        // Получаем информацию о конкретном клиенте
        if (!$contactId) {
            throw new Exception('contact_id required for get action');
        }
        
        $contact = $contactModel->getById($contactId);
        if (!$contact) {
            throw new Exception('Contact not found');
        }
        
        $contacts = [$contact];
        $total = 1;
    } else {
        throw new Exception('Invalid action');
    }
    
    // Обогащаем данные контактов
    $result = [];
    foreach ($contacts as $contact) {
        $contactId = $contact['id'];
        
        // Используем waContact для получения данных
        $c = new waContact($contactId);
        
        // Получаем email (первый доступный)
        $email = $c->get('email', 'default');
        if (is_array($email)) {
            $email = isset($email['value']) ? $email['value'] : (isset($email[0]) ? $email[0] : null);
        }
        
        // Получаем телефон (первый доступный)
        $phone = $c->get('phone', 'default');
        if (is_array($phone)) {
            $phone = isset($phone['value']) ? $phone['value'] : (isset($phone[0]) ? $phone[0] : null);
        }
        
        // Получаем kodv1s
        $kodv1s = $c->get('kodv1s');
        
        // Получаем категории через модель
        $priceList = null;
        try {
            $contactCategoriesModel = new waContactCategoriesModel();
            $categories = $contactCategoriesModel->getContactCategories($contactId);
            if (is_array($categories)) {
                foreach ($categories as $cat) {
                    if (isset($cat['name']) && ($cat['name'] === 'Цена Прайс лист1' || (isset($cat['id']) && $cat['id'] == 4))) {
                        $priceList = 'Прайс 1 (+1.5%)';
                        break;
                    }
                }
            }
        } catch (Exception $e) {
            // Игнорируем ошибки получения категорий
            logError('Error getting categories', ['contact_id' => $contactId, 'error' => $e->getMessage()]);
        }
        
        $name = $contact['name'];
        if (empty($name)) {
            $name = trim(($contact['firstname'] ?? '') . ' ' . ($contact['lastname'] ?? ''));
            if (empty($name)) {
                $name = 'Без имени';
            }
        }
        
        $result[] = [
            'contact_id' => $contactId,
            'name' => $name,
            'firstname' => $contact['firstname'] ?? '',
            'lastname' => $contact['lastname'] ?? '',
            'email' => $email,
            'phone' => $phone,
            'kodv1s' => $kodv1s,
            'price_list' => $priceList,
            'created_at' => $contact['create_datetime'] ?? null
        ];
    }
        
    echo json_encode([
        'success' => true,
        'data' => $result,
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total' => (int)$total,
            'total_pages' => ceil($total / $limit)
        ]
    ], JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    logError('Exception caught', [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ]);
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ], JSON_UNESCAPED_UNICODE);
} catch (Error $e) {
    logError('Fatal error caught', [
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ]);
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ], JSON_UNESCAPED_UNICODE);
}

