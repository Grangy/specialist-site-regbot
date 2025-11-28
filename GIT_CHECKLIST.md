# Git Checklist - Подготовка к коммиту

## ✅ Проверьте перед коммитом

### 1. Проверьте что .env НЕ в git
```bash
git status | grep .env
# Должно быть пусто или только .env.example
```

### 2. Проверьте .gitignore
```bash
cat .gitignore
# Убедитесь что там есть:
# - .env
# - data/*.db
# - *.xlsx
# - logs/
# - node_modules/
```

### 3. Удалите конфиденциальные данные
```bash
# Проверьте что нет реальных данных в:
cat .env.example
cat .env.production.example

# Не должно быть реальных токенов и паролей!
```

### 4. Проверьте что игнорируются нужные файлы
```bash
# Эти файлы НЕ должны быть в git:
ls -la .env              # <- НЕ должен коммититься
ls -la data/*.db         # <- НЕ должны коммититься
ls -la Клиенты.xlsx      # <- НЕ должен коммититься
ls -la logs/             # <- НЕ должны коммититься
ls -la data/clients.json # <- НЕ должен коммититься
```

## 📝 Первый коммит

```bash
# Добавьте все файлы
git add .

# Проверьте что будет закоммичено
git status

# ВАЖНО: убедитесь что там НЕТ:
# - .env (с реальными данными)
# - *.db файлов
# - *.xlsx файлов
# - clients.json
# - логов

# Если всё ОК, делаем коммит
git commit -m "Initial commit: Telegram bot for client registration"
```

## 🚀 Push в удалённый репозиторий

```bash
# Добавьте удалённый репозиторий
git remote add origin https://github.com/your-username/your-repo.git

# Или SSH
git remote add origin git@github.com:your-username/your-repo.git

# Push
git branch -M main
git push -u origin main
```

## ⚠️ Если случайно закоммитили .env

```bash
# Удалите .env из Git истории
git rm --cached .env
git commit -m "Remove .env from git"

# Если уже запушили - придётся force push (опасно!)
git push --force

# ⚠️ ВАЖНО: После этого смените все токены и пароли!
```

## 🔒 Защита веток (на GitHub/GitLab)

### GitHub
1. Settings → Branches
2. Add branch protection rule
3. Branch name pattern: `main`
4. ✅ Require pull request reviews before merging
5. ✅ Require status checks to pass

### GitLab
1. Settings → Repository → Protected Branches
2. Protect branch: `main`
3. Allowed to merge: Maintainers
4. Allowed to push: No one

## 📋 .gitignore должен содержать

```
node_modules/
.env
.env.local
.env.production
data/*.db
data/*.db-journal
data/clients.json
logs/
*.log
*.xlsx
*.xls
.DS_Store
```

## ✅ Финальный чек-лист

- [ ] `.env` в `.gitignore`
- [ ] `.env.example` без реальных данных
- [ ] `data/*.db` в `.gitignore`
- [ ] `*.xlsx` в `.gitignore`
- [ ] `logs/` в `.gitignore`
- [ ] `data/clients.json` в `.gitignore`
- [ ] `node_modules/` в `.gitignore`
- [ ] README.md обновлён без реальных данных
- [ ] DEPLOY.md создан
- [ ] Git инициализирован
- [ ] Первый коммит сделан
- [ ] Удалённый репозиторий добавлен
- [ ] Push в удалённый репозиторий

## 🎯 Готово к деплою!

После пуша в Git, на production сервере:

```bash
git clone <your-repo-url>
cd telegram-bot
cp .env.example .env
nano .env  # Вставьте РЕАЛЬНЫЕ данные
npm install --production
npm run convert
npm start
```

---

**Не забудьте:** .env файл создаётся ВРУЧНУЮ на каждом сервере!

