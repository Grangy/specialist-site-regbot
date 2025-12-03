<?php
/**
 * Скрипт для пересоздания заказов 160 и 159
 * 
 * Использование:
 * php recreateOrders.php
 * или через браузер: https://specialist82.pro/recreateOrders.php?token=SUPER_SECRET_TOKEN_123
 */

header('Content-Type: application/json; charset=utf-8');

ini_set('display_errors', 1);
error_reporting(E_ALL);

// Логирование
$logFile = dirname(__FILE__) . '/logs/recreateOrders.log';
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

$response = [
    'status' => 'error',
    'message' => '',
    'orders' => []
];

try {
    // === Проверка токена (если запускается через браузер) ===
    $secret = 'SUPER_SECRET_TOKEN_123';
    if (php_sapi_name() !== 'cli') {
        if (empty($_REQUEST['token']) || $_REQUEST['token'] !== $secret) {
            http_response_code(403);
            $response['message'] = 'Forbidden (bad token)';
            echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            exit;
        }
    }

    logMessage('Recreate orders script started', ['orders' => [159, 160]]);

    // === Подключение Webasyst ===
    $path = dirname(__FILE__) . '/wa-config/SystemConfig.class.php';
    if (!file_exists($path)) {
        throw new Exception('SystemConfig.class.php not found at ' . $path);
    }
    require_once($path);

    $config = new SystemConfig();
    $wa = waSystem::getInstance('shop', $config);

    // === Модели ===
    // В Webasyst модели находятся в wa-apps/shop/lib/model/
    // Подключаем интерфейс и модели в правильном порядке
    $modelPath = dirname(__FILE__) . '/wa-apps/shop/lib/model/';
    require_once($modelPath . 'shopOrderStorage.interface.php');
    require_once($modelPath . 'shopOrder.model.php');
    require_once($modelPath . 'shopOrderParams.model.php');
    require_once($modelPath . 'shopOrderItems.model.php');
    
    // Создаём экземпляры моделей
    $orderModel = new shopOrderModel();
    $orderParamsModel = new shopOrderParamsModel();
    $orderItemsModel = new shopOrderItemsModel();

    // === Заказы для пересоздания ===
    $orderIds = [159, 160];

    foreach ($orderIds as $orderId) {
        logMessage("Processing order {$orderId}");

        // === Загружаем оригинальный заказ ===
        // Используем getById вместо getOrder, чтобы избежать зависимостей
        $originalOrder = $orderModel->getById($orderId);
        
        if (!$originalOrder) {
            logMessage("Order {$orderId} not found");
            $response['orders'][] = [
                'original_id' => $orderId,
                'status' => 'error',
                'message' => 'Order not found'
            ];
            continue;
        }

        logMessage("Order {$orderId} loaded", [
            'contact_id' => $originalOrder['contact_id'],
            'total' => $originalOrder['total'],
            'currency' => $originalOrder['currency']
        ]);

        // === Подготовка данных для нового заказа ===
        $newOrderData = [
            'contact_id' => $originalOrder['contact_id'],
            'currency' => $originalOrder['currency'],
            'rate' => $originalOrder['rate'],
            'total' => $originalOrder['total'],
            'discount' => $originalOrder['discount'],
            'tax' => $originalOrder['tax'],
            'shipping' => $originalOrder['shipping'],
            'items' => [],
            'params' => []
        ];

        // === Копируем товары ===
        $items = $orderItemsModel->getItems($orderId);
        foreach ($items as $item) {
            $newOrderData['items'][] = [
                'product_id' => $item['product_id'],
                'sku_id' => $item['sku_id'],
                'name' => $item['name'],
                'sku_name' => $item['sku_name'],
                'price' => $item['price'],
                'quantity' => $item['quantity'],
                'type' => $item['type'],
                'stock_id' => $item['stock_id'] ?? null,
            ];
        }

        // === Копируем параметры заказа ===
        $params = $orderParamsModel->get($orderId);
        foreach ($params as $key => $value) {
            // Пропускаем системные параметры, которые не нужно копировать
            if (!in_array($key, ['id', 'order_id', 'create_datetime', 'update_datetime'])) {
                $newOrderData['params'][$key] = $value;
            }
        }

        // === Создаём новый заказ ===
        logMessage("Creating new order from order {$orderId}");

        // Подготавливаем данные для вставки
        $orderInsertData = [
            'contact_id' => $newOrderData['contact_id'],
            'currency' => $newOrderData['currency'] ?: 'RUB',
            'rate' => $newOrderData['rate'] ?: 1.0,
            'total' => $newOrderData['total'],
            'discount' => $newOrderData['discount'] ?: 0,
            'tax' => $newOrderData['tax'] ?: 0,
            'shipping' => $newOrderData['shipping'] ?: 0,
            'state_id' => isset($originalOrder['state_id']) ? $originalOrder['state_id'] : 'new',
            'create_datetime' => date('Y-m-d H:i:s'),
            'update_datetime' => date('Y-m-d H:i:s'),
        ];

        // Вставляем заказ в БД
        try {
            $newOrderId = $orderModel->insert($orderInsertData);
        } catch (Exception $e) {
            logMessage("Error inserting order: " . $e->getMessage());
            $response['orders'][] = [
                'original_id' => $orderId,
                'status' => 'error',
                'message' => 'Failed to insert order: ' . $e->getMessage()
            ];
            continue;
        }

        if (!$newOrderId) {
            logMessage("Failed to create new order from order {$orderId}");
            $response['orders'][] = [
                'original_id' => $orderId,
                'status' => 'error',
                'message' => 'Failed to create new order (insert returned false)'
            ];
            continue;
        }

        // Добавляем товары
        if (!empty($newOrderData['items'])) {
            foreach ($newOrderData['items'] as $item) {
                try {
                    $itemData = [
                        'order_id' => $newOrderId,
                        'product_id' => isset($item['product_id']) ? $item['product_id'] : 0,
                        'sku_id' => isset($item['sku_id']) ? $item['sku_id'] : 0,
                        'name' => $item['name'] ?: '',
                        'sku_name' => isset($item['sku_name']) ? $item['sku_name'] : '',
                        'price' => $item['price'] ?: 0,
                        'quantity' => $item['quantity'] ?: 1,
                        'type' => isset($item['type']) ? $item['type'] : 'product',
                    ];
                    
                    if (isset($item['stock_id']) && $item['stock_id']) {
                        $itemData['stock_id'] = $item['stock_id'];
                    }
                    
                    $orderItemsModel->insert($itemData);
                } catch (Exception $e) {
                    logMessage("Error inserting item: " . $e->getMessage(), ['item' => $item]);
                }
            }
        }

        // Добавляем параметры
        if (!empty($newOrderData['params'])) {
            foreach ($newOrderData['params'] as $key => $value) {
                try {
                    $orderParamsModel->set($newOrderId, $key, $value);
                } catch (Exception $e) {
                    logMessage("Error setting param {$key}: " . $e->getMessage());
                }
            }
        }

        logMessage("New order created", [
            'original_id' => $orderId,
            'new_id' => $newOrderId
        ]);

        $response['orders'][] = [
            'original_id' => $orderId,
            'new_id' => $newOrderId,
            'status' => 'success',
            'message' => "Order recreated successfully"
        ];
    }

    $response['status'] = 'ok';
    $response['message'] = 'Orders recreated successfully';

} catch (Exception $e) {
    logMessage('Error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
    $response['message'] = $e->getMessage();
    $response['error'] = $e->getTraceAsString();
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

