# Сборка KotvukAI как Windows EXE

## Требования
- Node.js 18+
- npm
- Windows 10/11 x64

## Запуск в режиме разработки (Electron + Next.js dev)

```bash
# Терминал 1: запустить Next.js
npm run dev

# Терминал 2: после того как dev-сервер запустился
npm run electron:dev
```

## Сборка установщика (.exe)

```bash
# Убедись что .env.local заполнен (GROQ_API_KEY, DATABASE_URL и т.д.)

# Сборка (выполняет next build + electron-builder)
npm run electron:build
```

Результат: `dist-electron/KotvukAI Setup 1.0.0.exe`

## Быстрая сборка без установщика (просто папка)

```bash
npm run electron:build:dir
```

Результат: `dist-electron/win-unpacked/KotvukAI.exe`

## Структура Electron

```
electron/
  main.js      — главный процесс (запускает Next.js, создаёт окно)
  preload.js   — preload скрипт (contextBridge)
  icon.ico     — иконка для Windows
  icon.png     — иконка PNG (512x512)
  license.txt  — лицензия (показывается в установщике)
```

## Важно про .env.local

При сборке `.env.local` копируется в `resources/.env.local` внутри exe.
Это значит API-ключи будут внутри установщика — **не публикуй установщик публично**.

## Переменные окружения в собранном приложении

Все переменные из `.env.local` загружаются через `electron/main.js` → `loadEnv()`.
Next.js серверный процесс получает их через `process.env`.
