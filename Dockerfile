# Используем официальный образ Node.js
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем зависимости для компиляции нативных модулей (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Копируем файлы зависимостей
COPY package.json package-lock.json ./

# Устанавливаем зависимости (включая dev для сборки нативных модулей)
RUN npm ci

# Копируем остальные файлы приложения
COPY bot.js ./

# Создаём директорию для базы данных
RUN mkdir -p /app/db

# Устанавливаем переменные окружения
ENV NODE_ENV=production

# Открываем порт (если потребуется в будущем)
# EXPOSE 3000

# Запускаем приложение
CMD ["node", "bot.js"]

