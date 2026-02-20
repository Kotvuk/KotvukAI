# 🏗️ KotvukAI — Architecture Document

> Версия: 1.0 | Обновлено: 2026-02-20

---

## 1. System Overview

KotvukAI is a full-stack crypto analytics platform with AI-powered trading signals, multi-timeframe analysis, and a self-learning feedback loop. It follows a monolithic architecture with a React SPA frontend and an Express.js backend acting as both API server and reverse proxy to external services.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                               │
│                   React SPA (Vite + JSX)                            │
│  ┌──────────┬──────────┬──────────┬──────────┬──────────┐           │
│  │Dashboard │ Charts   │ AI Panel │ Trades   │ Whale    │  ...      │
│  └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘           │
│       │          │          │          │          │                  │
│       └──────────┴──────────┴──────────┴──────────┘                  │
│                          │ HTTP / JSON                               │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────────┐
│              EXPRESS.JS SERVER (port 3000)                           │
│                          │                                          │
│  ┌───────────────────────┼───────────────────────────────┐          │
│  │              Auth Middleware (JWT)                     │          │
│  │              Rate Limiter (per plan)                   │          │
│  └───────────────────────┼───────────────────────────────┘          │
│                          │                                          │
│  ┌────────────┬──────────┼──────────┬────────────┐                  │
│  │ /api/auth  │ /api/ai  │ /api/*   │ /api/admin │                  │
│  │ register   │ analyze  │ trades   │ users      │                  │
│  │ login      │ chat     │ alerts   │ stats      │                  │
│  │ me         │ usage    │ signals  │ plans      │                  │
│  └────────────┴──────┬───┴──────────┴────────────┘                  │
│                      │                                              │
│  ┌───────────────────┼───────────────────────────────────┐          │
│  │            Background Workers (setInterval)           │          │
│  │  • checkAlerts()        every 10s                     │          │
│  │  • checkTradeTPSL()     every 10s                     │          │
│  │  • checkPendingSignals() every 60s                    │          │
│  └───────────────────┼───────────────────────────────────┘          │
│                      │                                              │
└──────────────────────┼──────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐   ┌─────▼─────┐  ┌────▼────┐
   │ SQLite  │   │ Binance   │  │  Groq   │
   │ (WAL)   │   │ API v3    │  │  API    │
   │         │   │           │  │ (LLM)   │
   └─────────┘   └───────────┘  └─────────┘
                       │
                 ┌─────▼──────┐
                 │Alternative │
                 │.me (FNG)   │
                 └────────────┘
```

---

## 2. Frontend Architecture

### 2.1 Technology Stack

| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Vite 5 | Build tool & dev server |
| TradingView Lightweight Charts | Candlestick/line/bar charts |
| CSS-in-JS (inline styles) | Styling (no external CSS framework) |

### 2.2 Component Tree

```
main.jsx
└── LangProvider (i18n context)
    └── ThemeProvider (light/dark theme)
        └── AuthProvider (JWT session)
            └── App.jsx
                ├── LandingPage         (unauthenticated)
                ├── AuthPage            (login / register)
                └── [Authenticated App]
                    ├── Sidebar (navigation)
                    ├── Header (burger, logo, user info, logout)
                    └── Content Area (active panel)
                        ├── DashboardPanel
                        ├── ChartsPanel
                        ├── AIPanel
                        ├── AIChat (floating)
                        ├── TradesPanel
                        ├── CalculatorPanel
                        ├── WhalePanel
                        ├── AlertsPanel
                        ├── NewsPanel
                        ├── WatchlistPanel
                        ├── HeatmapPanel
                        ├── ScreenerPanel
                        ├── LearningPanel
                        ├── SettingsPanel
                        └── AdminPanel (admin only)
```

### 2.3 Context Providers

| Context | File | Purpose |
|---|---|---|
| `LangContext` | `LangContext.jsx` | i18n: stores current locale (`ru`/`en`), exposes `t()` translation function |
| `ThemeContext` | `ThemeContext.jsx` | Light/dark theme toggle, provides `theme` object with all color tokens |
| `AuthContext` | `AuthContext.jsx` | JWT token storage (localStorage), `user` object, `login()`, `logout()`, `register()`, auto-refresh via `/api/auth/me` |

### 2.4 State Management

The app uses **React local state** (`useState`) within each panel — no Redux or Zustand. Cross-panel communication happens through:

- **Context providers** — auth, lang, theme (global)
- **Props drilling** — minimal, mostly panel ↔ sub-component
- **API as source of truth** — panels fetch data independently from the backend

### 2.5 Panel Architecture

Each panel is a self-contained component in `src/panels/`. Panels:
- Fetch their own data on mount via `useEffect`
- Manage their own local state
- Use `useLang()` for translations, `useTheme()` for styling, `useAuth()` for user info
- Follow a consistent layout pattern: stat cards → main content → action buttons

### 2.6 i18n System

`i18n.js` exports a flat dictionary keyed by locale → label key → translated string. The `LangContext` reads the current locale from `localStorage` and provides a `t(key)` function to all components.

---

## 3. Backend Architecture

### 3.1 Overview

Single-file Express.js server (`backend/server.js`) — approximately 700 lines. Handles:

1. **Authentication** — registration, login, JWT tokens
2. **Proxy routes** — forwards requests to Binance, CryptoCompare, Alternative.me
3. **CRUD routes** — trades, alerts, watchlist, signals, settings
4. **AI routes** — Groq API calls with multi-timeframe context
5. **Admin routes** — user management, platform stats
6. **Background workers** — periodic alert/trade/signal checks
7. **Static file serving** — production SPA from `frontend/dist`

### 3.2 Middleware Stack

```
Request
  │
  ├── cors()                    — Allow cross-origin requests
  ├── express.json()            — Parse JSON bodies
  └── authMiddleware()          — Extract JWT from Authorization header,
                                  attach req.userId and req.user
```

### 3.3 Route Groups

| Prefix | Middleware | Description |
|---|---|---|
| `/api/auth/*` | none | Register, login, get current user |
| `/api/klines`, `/api/ticker24h`, `/api/price`, `/api/prices` | none | Binance proxy |
| `/api/fng` | none | Fear & Greed Index proxy |
| `/api/heatmap`, `/api/screener` | none | Market data aggregation |
| `/api/exchangeInfo` | none | All USDT trading pairs |
| `/api/signals/*` | none | Signal CRUD + history + stats + tracking |
| `/api/trades/*` | none | Trade CRUD + close + stats |
| `/api/alerts/*` | none | Alert CRUD + triggered alerts |
| `/api/watchlist` | none | Watchlist CRUD |
| `/api/whale/*` | none | Order book + large trades |
| `/api/news` | none | CryptoCompare news proxy |
| `/api/news/summary` | AI limit | AI news summarization |
| `/api/ai/*` | AI limit | AI analysis + chat + usage |
| `/api/dashboard/*` | none | Aggregated dashboard data |
| `/api/admin/*` | `requireAdmin` | User management, stats, plan editing |
| `/api/settings` | none | Read platform settings |
| `/api/download-project` | none | ZIP download of source code |

### 3.4 Background Workers

| Worker | Interval | Purpose |
|---|---|---|
| `checkAlerts()` | 10s | Polls Binance prices, triggers alerts matching conditions |
| `checkTradeTPSL()` | 10s | Auto-closes open trades when TP or SL is hit |
| `checkPendingSignals()` | 60s | Resolves pending AI signals (TP/SL/timeout after 24h), triggers reflection |

### 3.5 Technical Indicator Engine

Built-in server-side calculations (no external library):

| Function | Description |
|---|---|
| `calcEMA(closes, period)` | Exponential Moving Average |
| `calcRSI(closes, period)` | Relative Strength Index (Wilder's smoothing) |
| `calcMACD(closes)` | MACD line (EMA12 − EMA26) |
| `calcIndicators(klines)` | Computes RSI14, EMA9/21/50/200, MACD from raw kline data |

---

## 4. Database Schema

**Engine:** SQLite 3 via `better-sqlite3` with WAL mode  
**Location:** `database/crypto_analytics.db`

### 4.1 Tables

#### `users`
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `email` | TEXT (UNIQUE) | User email |
| `name` | TEXT | Display name |
| `password_hash` | TEXT | SHA-256 hash of password |
| `plan` | TEXT | `Free` / `Pro` / `Premium` |
| `is_admin` | INTEGER | `0` or `1` |
| `created_at` | DATETIME | Registration timestamp |

#### `signals`
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `pair` | TEXT | Trading pair (e.g., `BTCUSDT`) |
| `type` | TEXT | Signal type |
| `entry` | REAL | Entry price |
| `tp` | REAL | Take profit |
| `sl` | REAL | Stop loss |
| `reason` | TEXT | Signal reason/description |
| `accuracy` | REAL | Predicted accuracy |
| `created_at` | DATETIME | Creation timestamp |

#### `signal_results` (Self-Learning)
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `signal_id` | INTEGER | Reference to original signal |
| `pair` | TEXT | Trading pair |
| `direction` | TEXT | `LONG` / `SHORT` |
| `entry_price` | REAL | Entry price |
| `tp_price` | REAL | Take profit target |
| `sl_price` | REAL | Stop loss target |
| `actual_price` | REAL | Price at resolution |
| `result` | TEXT | `pending` / `tp_hit` / `sl_hit` / `timeout` |
| `confidence` | REAL | AI confidence 0–100 |
| `coin_score` | INTEGER | Coin rating 1–10 |
| `accuracy_score` | REAL | Outcome score (100/50/0) |
| `ai_analysis` | TEXT | Original AI analysis text |
| `ai_reflection` | TEXT | Post-resolution self-critique |
| `created_at` | DATETIME | Signal creation time |
| `resolved_at` | DATETIME | Resolution time |

#### `trades`
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `pair` | TEXT | Trading pair |
| `direction` | TEXT | `long` / `short` |
| `quantity` | REAL | Position size |
| `entry_price` | REAL | Entry price |
| `tp` | REAL | Take profit (nullable) |
| `sl` | REAL | Stop loss (nullable) |
| `close_price` | REAL | Actual close price |
| `pnl` | REAL | Profit & loss |
| `status` | TEXT | `open` / `closed` |
| `opened_at` | DATETIME | Open timestamp |
| `closed_at` | DATETIME | Close timestamp |

#### `alerts`
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `pair` | TEXT | Trading pair |
| `condition` | TEXT | `above` / `below` / `cross_above` / `cross_below` |
| `value` | REAL | Price level |
| `message` | TEXT | Custom message |
| `status` | TEXT | `active` / `triggered` |
| `created_at` | DATETIME | Creation time |
| `triggered_at` | DATETIME | Trigger time |

#### `watchlist`
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `pair` | TEXT (UNIQUE) | Trading pair |
| `added_at` | DATETIME | When added |

#### `drawings`
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `pair` | TEXT | Trading pair |
| `data` | TEXT | JSON serialized drawing data |
| `created_at` | DATETIME | Creation time |

#### `settings`
| Column | Type | Description |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `key` | TEXT (UNIQUE) | Setting key (e.g., `plan_Free`) |
| `value` | TEXT | JSON-encoded value |

---

## 5. API Reference

### 5.1 Authentication

| Method | Endpoint | Body | Response | Auth |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{name, email, password}` | `{token, user}` | No |
| POST | `/api/auth/login` | `{email, password}` | `{token, user}` | No |
| GET | `/api/auth/me` | — | `{id, name, email, plan, is_admin}` | Yes |

### 5.2 Market Data (Binance Proxy)

| Method | Endpoint | Query Params | Description |
|---|---|---|---|
| GET | `/api/klines` | `symbol`, `interval`, `limit` | Candlestick data |
| GET | `/api/ticker24h` | — | 24h stats for top 10 pairs |
| GET | `/api/ticker24h/single` | `symbol` | 24h stats for one pair |
| GET | `/api/price` | `symbol` | Current price |
| GET | `/api/prices` | `symbols` (comma-sep) | Multiple prices |
| GET | `/api/exchangeInfo` | — | All USDT trading pairs |
| GET | `/api/heatmap` | — | Top 30 pairs by volume |
| GET | `/api/screener` | — | All USDT pairs sorted by volume |
| GET | `/api/fng` | — | Fear & Greed Index |

### 5.3 Signals & Self-Learning

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/signals` | Latest 20 signals |
| POST | `/api/signals` | Create signal `{pair, type, entry, tp, sl, reason, accuracy}` |
| GET | `/api/signals/history` | Latest 50 signal results |
| GET | `/api/signals/stats` | Aggregated accuracy stats |
| POST | `/api/signals/track` | Track a new signal for self-learning |
| POST | `/api/signals/:id/resolve` | Manually resolve `{result, actual_price}` |

### 5.4 Trades (Paper Trading)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/trades` | All trades (filter: `?status=open`) |
| POST | `/api/trades` | Open trade `{pair, direction, quantity, entry_price, tp, sl}` |
| POST | `/api/trades/:id/close` | Close trade (auto-fetches price if `close_price` not provided) |
| GET | `/api/trades/stats` | P&L summary |

### 5.5 Alerts

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/alerts` | All alerts (filter: `?status=active`) |
| POST | `/api/alerts` | Create alert `{pair, condition, value, message}` |
| DELETE | `/api/alerts/:id` | Delete alert |
| GET | `/api/alerts/triggered` | Recently triggered alerts (`?since=ISO`) |

### 5.6 Watchlist

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/watchlist` | All items |
| POST | `/api/watchlist` | Add pair `{pair}` |
| DELETE | `/api/watchlist/:id` | Remove item |

### 5.7 Whale Analysis

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/whale/orderbook` | Order book depth (`?symbol=`) |
| GET | `/api/whale/trades` | Large trades ≥$100K (`?symbol=`) |

### 5.8 News

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/news` | CryptoCompare latest news |
| POST | `/api/news/summary` | AI summary `{title, body, lang}` (rate limited) |

### 5.9 AI

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/ai/usage` | Current usage & limits |
| POST | `/api/ai/analyze` | Full multi-timeframe analysis `{symbol, price, change24h, ...}` |
| POST | `/api/ai/chat` | Chat message `{message, history[]}` |

### 5.10 Dashboard

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard` | Aggregated stats (P&L, accuracy, top mover, FNG) |
| GET | `/api/dashboard/recommendation` | AI recommendation of the day |

### 5.11 Admin

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/admin/setup` | No | Create first admin (one-time) |
| GET | `/api/admin/users` | Admin | List all users |
| PATCH | `/api/admin/users/:id/plan` | Admin | Change user plan |
| PATCH | `/api/admin/users/:id/admin` | Admin | Toggle admin status |
| DELETE | `/api/admin/users/:id` | Admin | Delete user |
| GET | `/api/admin/stats` | Admin | Platform statistics |
| GET | `/api/admin/signals` | Admin | Paginated signal history |
| PATCH | `/api/admin/plans/:plan` | Admin | Update plan settings |

### 5.12 Other

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/settings` | All platform settings |
| GET | `/api/download-project` | Download source as ZIP |

---

## 6. AI System

### 6.1 Architecture

```
┌───────────────────────────────────────────────────┐
│                  AI Analysis Pipeline              │
│                                                   │
│  1. COLLECT                                       │
│     ├── Fetch 6 timeframes from Binance           │
│     │   (5m, 15m, 1h, 4h, 1d, 1w × 200 candles)  │
│     ├── Calculate indicators per timeframe        │
│     │   (RSI14, EMA9/21/50/200, MACD)             │
│     ├── BTC correlation (if not BTC)              │
│     └── Fear & Greed Index                        │
│                                                   │
│  2. CONTEXTUALIZE                                 │
│     ├── Multi-timeframe agreement check           │
│     │   (all bullish? mixed? all bearish?)        │
│     └── Load last 10 signal results               │
│         (self-learning memory)                    │
│                                                   │
│  3. GENERATE                                      │
│     ├── Build structured prompt                   │
│     ├── Send to Groq (kimi-k2-instruct)           │
│     └── Parse: confidence %, coin score /10,      │
│         direction, entry, TP, SL                  │
│                                                   │
│  4. TRACK                                         │
│     ├── Save signal to signal_results             │
│     └── Background worker monitors TP/SL/timeout  │
│                                                   │
│  5. REFLECT (on resolution)                       │
│     ├── Generate AI self-critique via Groq        │
│     └── Store reflection for future context       │
└───────────────────────────────────────────────────┘
```

### 6.2 Self-Learning Loop

1. **Signal Generation** → AI analyzes market, outputs direction + TP/SL
2. **Auto-Tracking** → Signal saved to `signal_results` with `result = 'pending'`
3. **Background Resolution** → `checkPendingSignals()` runs every 60s:
   - If price hits TP → `result = 'tp_hit'`, score = 100
   - If price hits SL → `result = 'sl_hit'`, score = 0
   - If 24h elapsed → `result = 'timeout'`, score = 50
4. **Reflection** → On resolution, Groq generates a self-critique analyzing why the signal succeeded or failed
5. **Memory Injection** → Next analysis includes last 10 signal outcomes + reflections in the prompt, enabling the AI to learn from mistakes

### 6.3 Rate Limiting (Per Plan)

| Plan | Daily AI Analyses |
|---|---|
| Free | 5 |
| Pro | 50 |
| Premium | Unlimited |

Tracked in-memory (`dailyAiUsage` map, keyed by `userId_YYYY-MM-DD`). Resets on server restart.

### 6.4 Groq Integration

- **Model:** `moonshotai/kimi-k2-instruct`
- **Endpoint:** `https://api.groq.com/openai/v1/chat/completions`
- **Auth:** Bearer token via `GROQ_API_KEY` env var
- **Used for:** market analysis, chat, news summaries, signal reflections, daily recommendations

---

## 7. Data Flow Diagrams

### 7.1 AI Analysis Flow

```
User clicks "Analyze"
        │
        ▼
Frontend POST /api/ai/analyze
  {symbol, price, change24h, high, low, volume, fng}
        │
        ▼
Backend: checkAiLimit() ── exceeds? ──► 429 error
        │ ok
        ▼
Fetch klines × 6 timeframes from Binance
        │
        ▼
calcIndicators() for each timeframe
        │
        ▼
Fetch BTC 24h ticker (if not BTC)
        │
        ▼
Load last 10 signal_results from SQLite
        │
        ▼
Build prompt with all data
        │
        ▼
POST to Groq API
        │
        ▼
Parse response: confidence, coinScore, direction, entry, TP, SL
        │
        ▼
Save to signal_results (auto-track)
        │
        ▼
Return {analysis, confidence, coinScore, direction, entryPrice, tpPrice, slPrice}
```

### 7.2 Trade Lifecycle

```
User opens trade ──► POST /api/trades ──► SQLite (status='open')
        │
        ▼
Every 10s: checkTradeTPSL()
  │ fetch all prices from Binance
  │ for each open trade:
  │   long: price ≥ TP? close. price ≤ SL? close.
  │   short: price ≤ TP? close. price ≥ SL? close.
  │
  ▼ (or manual close)
POST /api/trades/:id/close
  │ calculate PnL
  ▼
SQLite (status='closed', pnl, close_price, closed_at)
```

### 7.3 Alert Lifecycle

```
User creates alert ──► POST /api/alerts ──► SQLite (status='active')
        │
        ▼
Every 10s: checkAlerts()
  │ fetch all prices from Binance
  │ for each active alert:
  │   condition met? ──► UPDATE status='triggered', triggered_at=NOW
  │
  ▼
Frontend polls GET /api/alerts/triggered?since=...
  │ displays notification
```

---

## 8. Security Model

### 8.1 Authentication

- **Method:** Custom JWT-like tokens (base64 payload + HMAC-SHA256 signature)
- **Token format:** `base64(JSON{id, exp}).hmac_signature`
- **Expiry:** 7 days
- **Storage:** `localStorage` on client, `Authorization: Bearer <token>` header
- **Secret:** `JWT_SECRET` env var (default fallback for dev)

### 8.2 Password Security

- **Hashing:** SHA-256 (via Node.js `crypto`)
- **Note:** Production should migrate to bcrypt/argon2 for proper password hashing

### 8.3 Authorization

| Level | Check | Routes |
|---|---|---|
| Public | None | Auth routes, market data proxies |
| Authenticated | `authMiddleware` extracts user | All routes (non-blocking) |
| Rate-limited | `checkAiLimit()` per plan | AI analysis, chat, news summary |
| Admin | `requireAdmin` middleware | `/api/admin/*` |

### 8.4 Input Validation

- Required field checks on trade/alert/signal creation
- Password minimum length (6 chars) on registration
- Email uniqueness check
- Plan name validation against whitelist
- Self-deletion prevention for admin users

### 8.5 API Key Protection

All external API calls (Binance, Groq, CryptoCompare) are proxied through the backend. The Groq API key is never exposed to the frontend.

### 8.6 CORS

Enabled globally via `cors()` middleware with default settings (allow all origins). Should be restricted in production.

---

## 9. Infrastructure

### 9.1 Runtime

| Component | Technology |
|---|---|
| Runtime | Node.js 22.x |
| Process management | Direct `node server.js` |
| Database | SQLite file on disk |
| Build | Vite (`npx vite build` → `frontend/dist/`) |

### 9.2 Database Resilience

- **WAL mode** enabled for concurrent read/write
- **Auto-migration** — `ALTER TABLE` wrapped in try/catch for safe column additions
- **Auto-init** — all tables created on startup via `CREATE TABLE IF NOT EXISTS`

### 9.3 Monitoring

- Console logging for key events:
  - `🔔 Alert triggered`
  - `📊 Trade auto-closed`
  - `🎯 Signal resolved`
  - `🧠 Reflection generated`
  - `📝 Signal saved`
  - `👑 Admin promotion`

### 9.4 Deployment

```bash
# Development
cd frontend && npm run dev        # Vite dev server (HMR)
cd backend && node server.js      # API server

# Production
cd frontend && npx vite build     # Build to dist/
cd backend && node server.js      # Serves API + static files
```

---

## 10. Technology Decisions & Rationale

| Decision | Rationale |
|---|---|
| **SQLite over PostgreSQL** | Zero-config, single file, perfect for single-server deployment. WAL mode handles concurrent reads well. Easy backup (copy file). |
| **Single-file server** | Simplicity for MVP. All routes in one file enables quick iteration. Can be split into modules later. |
| **No ORM** | `better-sqlite3` is synchronous and fast. Raw SQL keeps things simple and transparent. |
| **Groq over OpenAI** | Faster inference (Groq's LPU), free tier available, OpenAI-compatible API format. |
| **Inline CSS over CSS framework** | Full control, no build complexity, theme support via JS objects. Trade-off: more verbose. |
| **No state management library** | App is panel-based with independent data flows. Context API handles the 3 global concerns (auth, lang, theme). |
| **Server-side indicator calculation** | Ensures consistency between AI analysis and displayed data. Client doesn't need indicator libraries. |
| **Proxy architecture** | Protects API keys, avoids CORS issues, enables server-side caching (future), single point of control. |
| **Custom JWT over library** | Minimal implementation for MVP. Simple, no dependencies. Should migrate to `jsonwebtoken` for production. |
| **In-memory rate limiting** | Simple, no Redis needed. Trade-off: resets on server restart. Acceptable for current scale. |
