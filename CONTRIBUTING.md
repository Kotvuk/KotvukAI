# 🤝 Участие в разработке KotvukAI

Спасибо за интерес к проекту! Мы приветствуем вклад от сообщества.

---

## 📋 Как внести вклад

### 1. Сообщить об ошибке

- Откройте [Issue](../../issues/new) с меткой `bug`
- Опишите ожидаемое и фактическое поведение
- Укажите шаги для воспроизведения
- Приложите скриншоты, если возможно

### 2. Предложить улучшение

- Откройте Issue с меткой `enhancement`
- Опишите предлагаемую функциональность и зачем она нужна

### 3. Отправить Pull Request

1. Сделайте **fork** репозитория
2. Создайте ветку от `main` (см. [соглашения по именованию веток](#именование-веток))
3. Внесите изменения
4. Проверьте, что проект запускается и работает
5. Откройте **Pull Request** с описанием изменений (см. [шаблон PR](#шаблон-pull-request))

---

## 🎨 Code Style Guide

### Общие правила

- **Отступы:** 2 пробела (не табы)
- **Точки с запятой:** обязательны
- **Кавычки:** одинарные `'` для JS, обратные `` ` `` для шаблонных строк
- **Максимальная длина строки:** 120 символов (рекомендация)
- **Без неиспользуемых переменных и импортов**
- **Trailing comma:** в многострочных массивах и объектах

### Именование

| Что | Стиль | Пример |
|---|---|---|
| Переменные | camelCase | `totalPnl`, `currentPrice` |
| Функции | camelCase | `calcEMA()`, `checkAlerts()` |
| React-компоненты | PascalCase | `ChartsPanel`, `AIChat` |
| Файлы компонентов | PascalCase.jsx | `DashboardPanel.jsx` |
| Утилиты/контексты | PascalCase.jsx | `AuthContext.jsx`, `LangContext.jsx` |
| Константы | UPPER_SNAKE_CASE | `JWT_SECRET`, `GROQ_KEY` |
| CSS-классы | camelCase (inline styles) | `styles.navItem` |
| API маршруты | kebab-case | `/api/download-project` |
| БД таблицы | snake_case | `signal_results` |
| БД колонки | snake_case | `entry_price`, `created_at` |

### React / Frontend

```jsx
// ✅ Хорошо
const [isOpen, setIsOpen] = useState(false);
const { t } = useLang();
const { theme } = useTheme();

// ❌ Плохо
const [open, setopen] = useState(false); // не camelCase для сеттера
var x = useLang(); // var, неинформативное имя
```

- Используйте функциональные компоненты + хуки (не классы)
- Деструктуризация пропсов: `function Panel({ symbol, onClose })`
- `useEffect` — всегда указывайте зависимости
- Стили — inline objects через `getStyles(theme)` паттерн (см. `App.jsx`)

### Backend

```javascript
// ✅ Хорошо
app.get('/api/trades', (req, res) => {
  const { status } = req.query;
  const trades = db.prepare('SELECT * FROM trades WHERE status = ?').all(status);
  res.json(trades);
});

// ❌ Плохо
app.get('/api/trades', function(req, res) {  // function вместо arrow
  var trades = db.prepare("SELECT * FROM trades").all();  // var, двойные кавычки
  res.send(trades);  // .send вместо .json
});
```

- Arrow functions для обработчиков маршрутов
- Параметризованные SQL-запросы (`:?` placeholders) — **никогда** не конкатенация строк
- Обработка ошибок: `try/catch` с `res.status(500).json({ error: e.message })`

---

## 🌿 Git Workflow

### Именование веток

```
<тип>/<краткое-описание>

feat/whale-panel          — новая функциональность
fix/alert-trigger-bug     — исправление бага
docs/architecture-md      — документация
style/dark-theme-tweaks   — стили без изменения логики
refactor/split-server     — рефакторинг
test/trade-api-tests      — тесты
chore/update-deps         — обновление зависимостей
i18n/news-panel-en        — переводы
```

### Стиль коммитов

Используйте [Conventional Commits](https://www.conventionalcommits.org/):

```
<тип>(<область>): <описание>

feat(trades): add auto-close on TP/SL hit
fix(ai): handle empty klines response
docs(readme): update installation steps
style(dashboard): adjust card spacing
refactor(server): extract indicator calculations
test(alerts): add trigger condition tests
i18n(settings): add English translations
chore(deps): bump better-sqlite3 to 11.x
```

**Типы:**

| Тип | Описание |
|---|---|
| `feat` | Новая функциональность |
| `fix` | Исправление бага |
| `docs` | Документация |
| `style` | Форматирование (без изменения логики) |
| `refactor` | Рефакторинг |
| `test` | Тесты |
| `chore` | Зависимости, конфиг, CI |
| `i18n` | Переводы |
| `perf` | Оптимизация производительности |

### Правила

- Коммит-сообщения на **английском**
- Одна фича/фикс = один PR
- Не коммитить `node_modules/`, `dist/`, `*.db`, `.env`
- Squash мелких коммитов перед мержем

---

## 📝 Шаблон Pull Request

```markdown
## Описание
Краткое описание изменений.

## Тип изменения
- [ ] feat — новая функциональность
- [ ] fix — исправление бага
- [ ] docs — документация
- [ ] refactor — рефакторинг
- [ ] style — визуальные изменения
- [ ] test — тесты

## Что сделано
- [ ] Описание изменения 1
- [ ] Описание изменения 2

## Скриншоты (если применимо)

## Чеклист
- [ ] Код соответствует стилю проекта
- [ ] Проект запускается без ошибок
- [ ] Переводы добавлены (RU + EN) в i18n.js
- [ ] Нет console.log (кроме серверных логов с эмодзи)
- [ ] Проверено в мобильном разрешении
```

---

## 🧩 Как добавить новую панель

### 1. Создайте файл компонента

```bash
touch frontend/src/panels/MyNewPanel.jsx
```

### 2. Напишите компонент

```jsx
import React, { useState, useEffect } from 'react';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';

const getStyles = (theme) => ({
  container: { padding: 0 },
  title: {
    fontSize: 22, fontWeight: 700, color: theme.text,
    marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
  },
  card: {
    background: theme.cardBg, borderRadius: 16,
    border: '1px solid ' + theme.border, padding: 20, marginBottom: 16,
  },
  // ... добавьте свои стили
});

export default function MyNewPanel() {
  const { t } = useLang();
  const { theme } = useTheme();
  const { user } = useAuth();
  const styles = getStyles(theme);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/my-endpoint')
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.title}>🆕 {t('myNewPanel')}</div>
      <div style={styles.card}>
        {loading ? t('loading') : JSON.stringify(data)}
      </div>
    </div>
  );
}
```

### 3. Зарегистрируйте в App.jsx

```jsx
// 1. Импорт (вверху файла)
import MyNewPanel from './panels/MyNewPanel';

// 2. Добавьте в массив basePanels
const basePanels = [
  // ... существующие панели
  { id: 'mynew', icon: '🆕', labelKey: 'myNewPanel' },
];

// 3. Добавьте рендер в switch/условие (в области content)
{panel === 'mynew' && <MyNewPanel />}
```

### 4. Добавьте переводы в i18n.js

```javascript
// В объект ru:
myNewPanel: 'Моя панель',

// В объект en:
myNewPanel: 'My Panel',
```

---

## 🔌 Как добавить новый API маршрут

### 1. Добавьте маршрут в server.js

```javascript
// ============ MY FEATURE ============

// GET — получить данные
app.get('/api/my-feature', (req, res) => {
  try {
    const data = db.prepare('SELECT * FROM my_table ORDER BY created_at DESC').all();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST — создать запись
app.post('/api/my-feature', (req, res) => {
  try {
    const { name, value } = req.body;
    if (!name || !value) return res.status(400).json({ error: 'Missing fields' });
    const r = db.prepare('INSERT INTO my_table (name, value) VALUES (?, ?)').run(name, value);
    res.json({ id: r.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE — удалить запись
app.delete('/api/my-feature/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM my_table WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

### 2. Если нужна новая таблица — добавьте в блок `db.exec()`

```javascript
CREATE TABLE IF NOT EXISTS my_table (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  value REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Если нужна авторизация

```javascript
// Для маршрута, доступного только авторизованным:
app.get('/api/my-feature', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Не авторизован' });
  // ...
});

// Для админского маршрута:
app.get('/api/admin/my-feature', requireAdmin, (req, res) => {
  // ...
});

// Для маршрута с AI лимитом:
app.post('/api/my-feature/ai', (req, res) => {
  if (!checkAiLimit(req, res)) return;
  // ...
});
```

### 4. Если нужен прокси к внешнему API

```javascript
app.get('/api/my-external', async (req, res) => {
  try {
    const r = await fetch('https://external-api.com/data');
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

---

## 🧪 Testing Guidelines

### Ручное тестирование (текущий подход)

Пока проект не имеет автоматических тестов, проверяйте вручную:

1. **Запуск проекта:**
   ```bash
   cd backend && node server.js
   cd frontend && npm run dev
   ```

2. **Проверьте:** 
   - Проект запускается без ошибок в консоли
   - Все панели загружаются
   - API-запросы возвращают данные
   - Авторизация работает (регистрация, вход, выход)

3. **Тестируйте в двух языках:** RU и EN

4. **Мобильное разрешение:** откройте DevTools → Toggle device toolbar

### Тестирование API (curl)

```bash
# Регистрация
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456","name":"Test"}'

# Авторизация
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'

# Получить сделки
curl http://localhost:3000/api/trades

# Создать сделку
curl -X POST http://localhost:3000/api/trades \
  -H "Content-Type: application/json" \
  -d '{"pair":"BTCUSDT","direction":"long","quantity":0.1,"entry_price":65000}'
```

### Будущее: автоматические тесты

При добавлении тестов используйте:
- **Backend:** Jest или Vitest + supertest
- **Frontend:** Vitest + React Testing Library
- Файлы тестов: рядом с модулем (`MyPanel.test.jsx`) или в `__tests__/`

---

## 🌐 i18n Guidelines

### Структура переводов

Файл: `frontend/src/i18n.js`

```javascript
const translations = {
  ru: {
    dashboard: 'Дашборд',
    charts: 'Графики',
    // ...
  },
  en: {
    dashboard: 'Dashboard',
    charts: 'Charts',
    // ...
  },
};
```

### Правила

1. **Каждый видимый текст** должен идти через `t('key')` — никакого хардкода строк в JSX
2. **Всегда добавляйте оба языка** (ru + en) одновременно
3. **Ключи** — camelCase на английском: `aiAnalytics`, `tradeHistory`, `noDataAvailable`
4. **Не переводите:** эмодзи, числа, тикеры (BTCUSDT), техническую терминологию в контексте (RSI, MACD)
5. **Плюрализация:** пока простая — одна строка. При необходимости — `t('trades_count', { count })` с логикой в `t()`

### Пример использования

```jsx
import { useLang } from '../LangContext';

export default function MyPanel() {
  const { t } = useLang();

  return (
    <div>
      <h1>{t('myPanel')}</h1>
      <p>{t('noDataAvailable')}</p>
      <button>{t('refresh')}</button>
    </div>
  );
}
```

### Проверка

После добавления переводов:
1. Переключитесь на EN в настройках — убедитесь, что нет `undefined` или ключей вместо текста
2. Переключитесь обратно на RU

---

## 🏗️ Локальная разработка

```bash
# Клонировать
git clone https://github.com/YOUR_USERNAME/KotvukAI.git
cd KotvukAI

# Установить зависимости
cd backend && npm install
cd ../frontend && npm install
cd ..

# Скопировать конфигурацию
cp .env.example .env
# Заполнить .env:
#   GROQ_API_KEY=your_key
#   JWT_SECRET=your_secret

# Запустить backend
cd backend && node server.js &

# Запустить frontend (dev mode с HMR)
cd frontend && npm run dev

# Или: собрать и запустить production
cd frontend && npx vite build
cd ../backend && node server.js
# Открыть http://localhost:3000
```

---

## ⚖️ Лицензия

Отправляя Pull Request, вы соглашаетесь с тем, что ваш вклад будет лицензирован под [MIT License](LICENSE).

## 💬 Вопросы?

Откройте Issue с меткой `question` или свяжитесь с мейнтейнером через GitHub.
