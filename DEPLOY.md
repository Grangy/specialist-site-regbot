# Инструкция по деплою

## 🚀 Деплой на сервер

### 1. Подготовка сервера

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Устанавливаем PM2 (опционально)
sudo npm install -g pm2
```

### 2. Клонирование проекта

```bash
# Клонируем репозиторий
git clone <your-repo-url> telegram-bot
cd telegram-bot

# Устанавливаем зависимости
npm install --production
```

### 3. Настройка окружения

```bash
# Создаём .env файл из примера
cp .env.production.example .env

# Редактируем .env - вставляем РЕАЛЬНЫЕ данные
nano .env
```

**Важно!** Заполните в `.env`:
- `TELEGRAM_BOT_TOKEN` - токен вашего бота
- `BOT_PASSWORD` - пароль для авторизации
- `API_URL` - URL вашего API
- `API_ACCESS_TOKEN` - токен доступа к API

### 4. Загрузка базы клиентов

```bash
# Загрузите файл Клиенты.xlsx на сервер
# Например через scp:
# scp Клиенты.xlsx user@server:/path/to/telegram-bot/

# Конвертируем Excel в JSON
npm run convert
```

### 5. Запуск

#### Вариант A: Обычный запуск
```bash
npm start
```

#### Вариант B: PM2 (рекомендуется для production)
```bash
# Запуск с PM2
pm2 start ecosystem.config.js --env production

# Настройка автозапуска
pm2 startup
pm2 save

# Полезные команды PM2
pm2 status          # Статус
pm2 logs            # Логи
pm2 restart all     # Перезапуск
pm2 stop all        # Остановка
```

#### Вариант C: Docker
```bash
# Создайте .env файл с реальными данными
cp .env.production.example .env
nano .env

# Запуск
docker-compose up -d

# Логи
docker-compose logs -f

# Остановка
docker-compose down
```

#### Вариант D: Systemd Service
```bash
# Создайте systemd service
sudo nano /etc/systemd/system/telegram-bot.service
```

Содержимое файла:
```ini
[Unit]
Description=Telegram Bot for Client Registration
After=network.target

[Service]
Type=simple
User=your_user
WorkingDirectory=/path/to/telegram-bot
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=telegram-bot
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Запуск:
```bash
sudo systemctl daemon-reload
sudo systemctl enable telegram-bot
sudo systemctl start telegram-bot
sudo systemctl status telegram-bot
```

## 🔄 Обновление

```bash
# Останавливаем бота
pm2 stop telegram-bot
# или
sudo systemctl stop telegram-bot

# Получаем обновления
git pull

# Обновляем зависимости
npm install --production

# Конвертируем базу (если обновился Excel)
npm run convert

# Запускаем
pm2 restart telegram-bot
# или
sudo systemctl start telegram-bot
```

## 📊 Мониторинг

### Логи
```bash
# PM2
pm2 logs telegram-bot

# Systemd
sudo journalctl -u telegram-bot -f

# Docker
docker-compose logs -f

# Файлы логов
tail -f logs/bot.log
```

### Статистика
```bash
npm run stats
```

### Проверка работы
```bash
npm run check
```

## 🔒 Безопасность

1. **Никогда не коммитьте .env файл!**
2. **Используйте сильные пароли**
3. **Регулярно обновляйте зависимости:** `npm update`
4. **Делайте бэкапы БД:** `cp data/users.db data/users.db.backup`
5. **Ограничьте доступ к серверу**

## 🐛 Troubleshooting

### Бот не запускается
```bash
# Проверьте логи
tail -f logs/bot.log

# Проверьте .env
cat .env

# Проверьте конвертацию
npm run convert
```

### Ошибки при работе
```bash
# Перезапустите бота
pm2 restart telegram-bot

# Очистите логи
pm2 flush

# Проверьте статус
pm2 status
```

### База данных повреждена
```bash
# Восстановите из бэкапа
cp data/users.db.backup data/users.db

# Или пересоздайте
npm run clean-db
```

## 📦 Бэкап

```bash
# Создайте скрипт бэкапа
nano backup.sh
```

Содержимое:
```bash
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Бэкап БД
cp data/users.db "$BACKUP_DIR/users_$DATE.db"

# Бэкап логов
tar -czf "$BACKUP_DIR/logs_$DATE.tar.gz" logs/

# Удаляем старые бэкапы (старше 30 дней)
find "$BACKUP_DIR" -name "*.db" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +30 -delete
```

Автоматизация через cron:
```bash
crontab -e

# Добавить строку (бэкап каждый день в 3:00)
0 3 * * * /path/to/telegram-bot/backup.sh
```

## 🌐 Nginx (если нужен веб-интерфейс)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /health {
        proxy_pass http://localhost:3000;
    }
}
```

## ✅ Чек-лист деплоя

- [ ] Node.js установлен
- [ ] Проект склонирован
- [ ] Зависимости установлены (`npm install`)
- [ ] `.env` файл создан с реальными данными
- [ ] Excel файл загружен на сервер
- [ ] База клиентов конвертирована (`npm run convert`)
- [ ] Бот запущен (PM2/systemd/Docker)
- [ ] Автозапуск настроен
- [ ] Бэкапы настроены
- [ ] Мониторинг настроен
- [ ] Бот работает в Telegram!

---

**Готово! Бот в production! 🚀**

