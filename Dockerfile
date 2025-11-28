FROM node:18-alpine

# Установка рабочей директории
WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Создаём необходимые директории
RUN mkdir -p data logs

# Не копируем .env - он должен быть на сервере!
# Не копируем Excel файлы - конвертация на сервере!

# Здоровье контейнера
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Запуск
CMD ["node", "src/index.js"]

