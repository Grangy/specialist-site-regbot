<?php
/**
 * Исправление логики категорий в create_lk_api.php
 * 
 * Правило:
 * - ВСЕ клиенты после подтверждения попадают в категорию 2 ("Цены видны")
 * - Если выбран "Прайс 1 (+1.5%)", дополнительно добавляется категория 4 ("Цена Прайс лист1")
 */

// Читаем текущий файл
$filePath = '/var/www/specialist82_usr/data/www/specialist82.pro/create_lk_api.php';
$code = file_get_contents($filePath);

// Ищем блок с категориями
$categoryBlock = <<<'PHP'
    // === категории ===
    dstep($response, 'load_categories');

    $cats = $ccm->getContactCategories($contact_id); // category_id => ...
    
    // ВСЕГДА добавляем категорию 2 ("Цены видны")
    $base_category_id = 2;
    $in_base_category = !empty($cats[$base_category_id]);
    
    if (!$in_base_category) {
        dstep($response, 'add_base_category', ['category_id' => $base_category_id]);
        logMessage('Base category added', ['contact_id' => $contact_id, 'category_id' => $base_category_id]);
        $ccm->add($contact_id, $base_category_id);
    }
    
    // Если передан category_id=4, дополнительно добавляем категорию 4 ("Цена Прайс лист1")
    if ($category_id == 4) {
        $in_price_category = !empty($cats[4]);
        if (!$in_price_category) {
            dstep($response, 'add_price_category', ['category_id' => 4]);
            logMessage('Price category added', ['contact_id' => $contact_id, 'category_id' => 4]);
            $ccm->add($contact_id, 4);
        }
    }
PHP;

// Заменяем старый блок категорий
$oldPattern = '/\/\/ === категории ===.*?if \(\!\$in_category\) \{.*?\$ccm->add\(\$contact_id, \$category_id\);/s';
$code = preg_replace($oldPattern, $categoryBlock, $code);

// Сохраняем
file_put_contents($filePath, $code);
echo "✅ Файл обновлён\n";

