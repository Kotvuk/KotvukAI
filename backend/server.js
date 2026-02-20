require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const archiver = require('archiver');

const app = express();
app.use(cors());
app.use(express.json());

// SQLite setup
const dbPath = path.join(__dirname, '..', 'database', 'crypto_analytics.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Create all tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT, name TEXT, plan TEXT DEFAULT 'Free',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT, type TEXT, entry REAL, tp REAL, sl REAL,
    reason TEXT, accuracy REAL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE, value TEXT
  );
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT NOT NULL,
    direction TEXT NOT NULL,
    quantity REAL NOT NULL,
    entry_price REAL NOT NULL,
    tp REAL,
    sl REAL,
    close_price REAL,
    pnl REAL,
    status TEXT DEFAULT 'open',
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME
  );
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT NOT NULL,
    condition TEXT NOT NULL,
    value REAL NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    triggered_at DATETIME
  );
  CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT NOT NULL UNIQUE,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS drawings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT, data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS signal_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id INTEGER,
    pair TEXT NOT NULL,
    direction TEXT,
    entry_price REAL,
    tp_price REAL,
    sl_price REAL,
    actual_price REAL,
    result TEXT DEFAULT 'pending',
    confidence REAL,
    coin_score INTEGER,
    accuracy_score REAL,
    ai_analysis TEXT,
    ai_reflection TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
  );
`);

// Add confidence/coin_score columns if missing (migration)
try { db.exec('ALTER TABLE signal_results ADD COLUMN confidence REAL'); } catch(e) {}
try { db.exec('ALTER TABLE signal_results ADD COLUMN coin_score INTEGER'); } catch(e) {}

// Auth migration: add password_hash column if missing
try { db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT'); } catch(e) {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)'); } catch(e) {}

// Admin migration: add is_admin column if missing
try { db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0'); } catch(e) {}

// Make the first registered user an admin if no admin exists
const adminExists = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get();
if (adminExists.count === 0) {
  const firstUser = db.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 1').get();
  if (firstUser) {
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(firstUser.id);
    console.log(`👑 Made user #${firstUser.id} an admin (first registered user)`);
  }
}

// ============ AUTH ============
const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const JWT_SECRET = process.env.JWT_SECRET || 'kotvukai-secret-key-change-me';

function createToken(userId) {
  const payload = { id: userId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
  return data + '.' + sig;
}

function verifyToken(token) {
  if (!token) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
  if (sig !== expected) return null;
  const payload = JSON.parse(Buffer.from(data, 'base64').toString());
  if (payload.exp < Date.now()) return null;
  return payload;
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const payload = verifyToken(auth.slice(7));
    if (payload) {
      req.userId = payload.id;
      req.user = db.prepare('SELECT id, name, email, plan, is_admin FROM users WHERE id = ?').get(payload.id);
    }
  }
  next();
}

app.use(authMiddleware);

app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
    if (password.length < 6) return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    const hash = hashPassword(password);
    const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name || '', email, hash);
    const token = createToken(result.lastInsertRowid);
    res.json({ token, user: { id: result.lastInsertRowid, name, email, plan: 'Free' } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }
    const token = createToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, plan: user.plan } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Не авторизован' });
  res.json(req.user);
});

// Insert default plans
const plans = {
  Free: { name: 'Free', price: 'бесплатно', indicators: 3, aiAnalyses: 5, charts: true, pairs: 3, signals: 5, refreshRate: 30 },
  Pro: { name: 'Pro', price: '$29/мес', indicators: 'все', aiAnalyses: 50, charts: true, pairs: 10, signals: 50, refreshRate: 10, alerts: true, whyButton: true, whale: true },
  Premium: { name: 'Premium', price: '$99/мес', indicators: 'все', aiAnalyses: -1, charts: true, pairs: 10, signals: -1, refreshRate: 5, alerts: true, whale: true, ai: true, realtimeAI: true, prioritySupport: true }
};
const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(plans)) upsert.run(`plan_${k}`, JSON.stringify(v));

const GROQ_KEY = process.env.GROQ_API_KEY || '';

// ============ TECHNICAL INDICATORS ============

function calcEMA(closes, period) {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return +ema.toFixed(6);
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return +(100 - 100 / (1 + rs)).toFixed(2);
}

function calcMACD(closes) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  if (ema12 === null || ema26 === null) return null;
  const macdLine = +(ema12 - ema26).toFixed(6);
  // Simple signal line approximation
  return { macd: macdLine, signal: 0, histogram: macdLine };
}

function calcIndicators(klines) {
  const closes = klines.map(k => +k[4]);
  return {
    rsi14: calcRSI(closes, 14),
    ema9: calcEMA(closes, 9),
    ema21: calcEMA(closes, 21),
    ema50: calcEMA(closes, 50),
    ema200: calcEMA(closes, 200),
    macd: calcMACD(closes),
    lastClose: closes[closes.length - 1]
  };
}

// ============ BINANCE PROXY ROUTES ============

app.get('/api/klines', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT', interval = '1h', limit = 500 } = req.query;
    const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ticker24h', async (req, res) => {
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const data = await r.json();
    const pairs = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'];
    res.json(data.filter(t => pairs.includes(t.symbol)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/price', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/prices', async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) return res.json([]);
    const list = symbols.split(',');
    const r = await fetch('https://api.binance.com/api/v3/ticker/price');
    const data = await r.json();
    res.json(data.filter(t => list.includes(t.symbol)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ticker24h/single', async (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/fng', async (req, res) => {
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=1');
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/exchangeInfo', async (req, res) => {
  try {
    const r = await fetch('https://api.binance.com/api/v3/exchangeInfo');
    const data = await r.json();
    const usdtPairs = data.symbols
      .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING')
      .map(s => s.symbol);
    res.json(usdtPairs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ HEATMAP & SCREENER ============

app.get('/api/heatmap', async (req, res) => {
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const data = await r.json();
    const usdt = data.filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('UP') && !t.symbol.includes('DOWN'))
      .sort((a, b) => (+b.quoteVolume) - (+a.quoteVolume))
      .slice(0, 30);
    res.json(usdt);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/screener', async (req, res) => {
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const data = await r.json();
    const usdt = data.filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('UP') && !t.symbol.includes('DOWN'))
      .sort((a, b) => (+b.quoteVolume) - (+a.quoteVolume));
    res.json(usdt);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ SIGNALS ============

app.get('/api/signals', (req, res) => {
  const signals = db.prepare('SELECT * FROM signals ORDER BY created_at DESC LIMIT 20').all();
  res.json(signals);
});

app.post('/api/signals', (req, res) => {
  const { pair, type, entry, tp, sl, reason, accuracy } = req.body;
  const r = db.prepare('INSERT INTO signals (pair,type,entry,tp,sl,reason,accuracy) VALUES (?,?,?,?,?,?,?)').run(pair, type, entry, tp, sl, reason, accuracy);
  res.json({ id: r.lastInsertRowid });
});

// ============ SIGNAL RESULTS (History + Self-Learning) ============

app.get('/api/signals/history', (req, res) => {
  const results = db.prepare('SELECT * FROM signal_results ORDER BY created_at DESC LIMIT 50').all();
  res.json(results);
});

app.get('/api/signals/stats', (req, res) => {
  const all = db.prepare('SELECT * FROM signal_results WHERE result != ?').all('pending');
  const total = all.length;
  const tpHit = all.filter(s => s.result === 'tp_hit').length;
  const slHit = all.filter(s => s.result === 'sl_hit').length;
  const timeout = all.filter(s => s.result === 'timeout').length;
  const accuracy = total > 0 ? (tpHit / total * 100) : 0;
  const avgScore = total > 0 ? (all.reduce((s, r) => s + (r.accuracy_score || 0), 0) / total) : 0;
  const pending = db.prepare('SELECT COUNT(*) as cnt FROM signal_results WHERE result = ?').get('pending').cnt;
  res.json({ total, tpHit, slHit, timeout, accuracy, avgScore, pending });
});

app.post('/api/signals/track', (req, res) => {
  const { pair, direction, entry_price, tp_price, sl_price, ai_analysis, confidence, coin_score } = req.body;
  if (!pair || !entry_price) return res.status(400).json({ error: 'Missing fields' });
  const r = db.prepare(
    'INSERT INTO signal_results (pair, direction, entry_price, tp_price, sl_price, ai_analysis, confidence, coin_score) VALUES (?,?,?,?,?,?,?,?)'
  ).run(pair, direction || null, +entry_price, tp_price ? +tp_price : null, sl_price ? +sl_price : null, ai_analysis || null, confidence ? +confidence : null, coin_score ? +coin_score : null);
  res.json({ id: r.lastInsertRowid });
});

app.post('/api/signals/:id/resolve', (req, res) => {
  const { result, actual_price } = req.body;
  const sig = db.prepare('SELECT * FROM signal_results WHERE id = ?').get(req.params.id);
  if (!sig) return res.status(404).json({ error: 'Signal not found' });
  const validResults = ['tp_hit', 'sl_hit', 'timeout'];
  if (!validResults.includes(result)) return res.status(400).json({ error: 'Invalid result' });
  
  let score = 0;
  if (result === 'tp_hit') score = 100;
  else if (result === 'timeout') score = 50;
  else score = 0;

  db.prepare('UPDATE signal_results SET result = ?, actual_price = ?, accuracy_score = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(result, actual_price ? +actual_price : null, score, sig.id);
  
  generateReflection(sig.id).catch(e => console.error('Reflection error:', e.message));
  
  res.json({ ok: true });
});

async function generateReflection(signalId) {
  const sig = db.prepare('SELECT * FROM signal_results WHERE id = ?').get(signalId);
  if (!sig || sig.result === 'pending') return;

  const prompt = `Ты дал торговый сигнал:
- Пара: ${sig.pair}
- Направление: ${sig.direction || 'N/A'}
- Цена входа: $${sig.entry_price}
- Take Profit: ${sig.tp_price ? '$' + sig.tp_price : 'не указан'}
- Stop Loss: ${sig.sl_price ? '$' + sig.sl_price : 'не указан'}
- Результат: ${sig.result === 'tp_hit' ? 'TP сработал ✅' : sig.result === 'sl_hit' ? 'SL сработал ❌' : 'Таймаут ⏰'}
- Фактическая цена: ${sig.actual_price ? '$' + sig.actual_price : 'N/A'}

Проанализируй КРАТКО (3-4 предложения):
1. Почему сигнал оказался ${sig.result === 'tp_hit' ? 'верным' : 'ошибочным'}?
2. Какие факторы ты мог не учесть?
3. Что нужно учитывать в будущем для подобных ситуаций?`;

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2-instruct',
        messages: [
          { role: 'system', content: 'Ты крипто-аналитик, анализирующий свои прошлые сигналы. Будь самокритичен и конкретен. Отвечай на русском.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5, max_tokens: 500
      })
    });
    const data = await r.json();
    const reflection = data?.choices?.[0]?.message?.content || '';
    if (reflection) {
      db.prepare('UPDATE signal_results SET ai_reflection = ? WHERE id = ?').run(reflection, signalId);
      console.log(`🧠 Reflection generated for signal #${signalId}`);
    }
  } catch (e) { console.error('Reflection API error:', e.message); }
}

// ============ TRADES ============

app.get('/api/trades', (req, res) => {
  const { status } = req.query;
  if (status) {
    res.json(db.prepare('SELECT * FROM trades WHERE status = ? ORDER BY opened_at DESC').all(status));
  } else {
    res.json(db.prepare('SELECT * FROM trades ORDER BY opened_at DESC').all());
  }
});

app.post('/api/trades', (req, res) => {
  const { pair, direction, quantity, entry_price, tp, sl } = req.body;
  if (!pair || !direction || !quantity || !entry_price) return res.status(400).json({ error: 'Missing fields' });
  const r = db.prepare('INSERT INTO trades (pair, direction, quantity, entry_price, tp, sl) VALUES (?,?,?,?,?,?)').run(pair, direction, quantity, entry_price, tp || null, sl || null);
  res.json({ id: r.lastInsertRowid });
});

app.post('/api/trades/:id/close', async (req, res) => {
  const trade = db.prepare('SELECT * FROM trades WHERE id = ? AND status = ?').get(req.params.id, 'open');
  if (!trade) return res.status(404).json({ error: 'Trade not found or already closed' });
  let closePrice = req.body.close_price;
  if (!closePrice) {
    try {
      const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${trade.pair}`);
      const d = await r.json();
      closePrice = +d.price;
    } catch { return res.status(500).json({ error: 'Cannot fetch price' }); }
  }
  const pnl = trade.direction === 'long'
    ? (closePrice - trade.entry_price) * trade.quantity
    : (trade.entry_price - closePrice) * trade.quantity;
  db.prepare('UPDATE trades SET status = ?, close_price = ?, pnl = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run('closed', closePrice, pnl, trade.id);
  res.json({ id: trade.id, pnl, close_price: closePrice });
});

app.get('/api/trades/stats', (req, res) => {
  const closed = db.prepare('SELECT * FROM trades WHERE status = ?').all('closed');
  const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const wins = closed.filter(t => (t.pnl || 0) > 0).length;
  const winRate = closed.length > 0 ? (wins / closed.length * 100) : 0;
  const avgPnl = closed.length > 0 ? totalPnl / closed.length : 0;
  const best = closed.length > 0 ? Math.max(...closed.map(t => t.pnl || 0)) : 0;
  const worst = closed.length > 0 ? Math.min(...closed.map(t => t.pnl || 0)) : 0;
  res.json({ totalPnl, winRate, avgPnl, best, worst, total: closed.length });
});

// ============ ALERTS ============

app.get('/api/alerts', (req, res) => {
  const { status } = req.query;
  if (status) {
    res.json(db.prepare('SELECT * FROM alerts WHERE status = ? ORDER BY created_at DESC').all(status));
  } else {
    res.json(db.prepare('SELECT * FROM alerts ORDER BY created_at DESC').all());
  }
});

app.post('/api/alerts', (req, res) => {
  const { pair, condition, value, message } = req.body;
  if (!pair || !condition || !value) return res.status(400).json({ error: 'Missing fields' });
  const r = db.prepare('INSERT INTO alerts (pair, condition, value, message) VALUES (?,?,?,?)').run(pair, condition, +value, message || '');
  res.json({ id: r.lastInsertRowid });
});

app.delete('/api/alerts/:id', (req, res) => {
  db.prepare('DELETE FROM alerts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Triggered alerts endpoint for frontend polling
app.get('/api/alerts/triggered', (req, res) => {
  const { since } = req.query;
  let results;
  if (since) {
    results = db.prepare('SELECT * FROM alerts WHERE status = ? AND triggered_at > ? ORDER BY triggered_at DESC').all('triggered', since);
  } else {
    results = db.prepare('SELECT * FROM alerts WHERE status = ? ORDER BY triggered_at DESC LIMIT 10').all('triggered');
  }
  res.json(results);
});

// ============ WATCHLIST ============

app.get('/api/watchlist', (req, res) => {
  res.json(db.prepare('SELECT * FROM watchlist ORDER BY added_at DESC').all());
});

app.post('/api/watchlist', (req, res) => {
  const { pair } = req.body;
  if (!pair) return res.status(400).json({ error: 'pair required' });
  try {
    const r = db.prepare('INSERT OR IGNORE INTO watchlist (pair) VALUES (?)').run(pair);
    res.json({ id: r.lastInsertRowid });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/watchlist/:id', (req, res) => {
  db.prepare('DELETE FROM watchlist WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ WHALE ============

app.get('/api/whale/orderbook', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT' } = req.query;
    const r = await fetch(`https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=50`);
    res.json(await r.json());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/whale/trades', async (req, res) => {
  try {
    const { symbol = 'BTCUSDT' } = req.query;
    const r = await fetch(`https://api.binance.com/api/v3/aggTrades?symbol=${symbol}&limit=500`);
    const data = await r.json();
    if (!Array.isArray(data)) return res.json([]);
    const pr = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const pd = await pr.json();
    const price = +pd.price || 0;
    const large = data
      .map(t => ({ ...t, usdValue: +t.q * price }))
      .filter(t => t.usdValue >= 100000)
      .sort((a, b) => b.usdValue - a.usdValue);
    res.json(large);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ NEWS ============

app.get('/api/news', async (req, res) => {
  try {
    const r = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
    const data = await r.json();
    res.json(data.Data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/news/summary', async (req, res) => {
  try {
    const { title, body } = req.body;
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2-instruct',
        messages: [
          { role: 'system', content: 'You are a crypto news analyst. Summarize the news article in 2-3 sentences. Include key takeaways and potential market impact. Reply in the same language as the question.' },
          { role: 'user', content: `Title: ${title}\n\n${body || ''}` }
        ],
        temperature: 0.5,
        max_tokens: 500
      })
    });
    const data = await r.json();
    res.json({ summary: data?.choices?.[0]?.message?.content || 'Error' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ AI ANALYSIS (Enhanced with multi-timeframe, indicators, BTC correlation, self-learning) ============

app.post('/api/ai/analyze', async (req, res) => {
  try {
    const { symbol, price, change24h, high, low, volume, fng, marketData } = req.body;

    // 1. Fetch multi-timeframe klines
    const timeframes = ['1h', '4h', '1d'];
    const klinesData = {};
    const indicators = {};
    for (const tf of timeframes) {
      try {
        const r = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol || 'BTCUSDT'}&interval=${tf}&limit=200`);
        const klines = await r.json();
        if (Array.isArray(klines)) {
          klinesData[tf] = klines;
          indicators[tf] = calcIndicators(klines);
        }
      } catch (e) { console.error(`Klines ${tf} error:`, e.message); }
    }

    // 2. BTC correlation context
    let btcContext = '';
    if (symbol && symbol !== 'BTCUSDT') {
      try {
        const r = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
        const btcData = await r.json();
        const btcChange = (+btcData.priceChangePercent).toFixed(2);
        const btcTrend = +btcChange > 0 ? 'bullish' : 'bearish';
        btcContext = `\n\n📊 BTC Correlation: BTC 24h trend: ${btcChange > 0 ? '+' : ''}${btcChange}% (${btcTrend} context)${+btcChange < -3 ? ' — be cautious with longs' : +btcChange > 3 ? ' — bullish momentum supports longs' : ''}`;
      } catch (e) {}
    }

    // 3. Past signals for self-learning
    const pastSignals = db.prepare('SELECT * FROM signal_results ORDER BY created_at DESC LIMIT 10').all();
    let learningContext = '';
    if (pastSignals.length > 0) {
      learningContext = '\n\n🧠 SELF-LEARNING — Here are your past 10 signals and outcomes. Learn from mistakes:\n';
      for (const sig of pastSignals) {
        learningContext += `- ${sig.pair} ${sig.direction || '?'} @ $${sig.entry_price} → ${sig.result === 'tp_hit' ? '✅ TP Hit' : sig.result === 'sl_hit' ? '❌ SL Hit' : sig.result === 'timeout' ? '⏰ Timeout' : '⏳ Pending'}`;
        if (sig.ai_reflection) learningContext += ` | Reflection: ${sig.ai_reflection.slice(0, 100)}`;
        learningContext += '\n';
      }
      learningContext += '\nUse these outcomes to improve your accuracy. Avoid repeating past mistakes.\n';
    }

    // 4. Format indicators for prompt
    let indicatorText = '';
    for (const tf of timeframes) {
      if (indicators[tf]) {
        const ind = indicators[tf];
        indicatorText += `\n[${tf.toUpperCase()}] RSI(14): ${ind.rsi14 ?? 'N/A'} | EMA9: ${ind.ema9 ?? 'N/A'} | EMA21: ${ind.ema21 ?? 'N/A'} | EMA50: ${ind.ema50 ?? 'N/A'} | EMA200: ${ind.ema200 ?? 'N/A'} | MACD: ${ind.macd?.macd ?? 'N/A'}`;
      }
    }

    // 5. Multi-timeframe agreement check
    let tfAgreement = '';
    const tfSignals = {};
    for (const tf of timeframes) {
      if (indicators[tf]) {
        const ind = indicators[tf];
        const bullish = (ind.rsi14 && ind.rsi14 > 50) && (ind.ema9 && ind.ema21 && ind.ema9 > ind.ema21);
        tfSignals[tf] = bullish ? 'bullish' : 'bearish';
      }
    }
    const allSame = Object.values(tfSignals).length > 1 && new Set(Object.values(tfSignals)).size === 1;
    if (Object.values(tfSignals).length > 1) {
      tfAgreement = allSame
        ? `\n\n⚡ All timeframes AGREE: ${Object.values(tfSignals)[0].toUpperCase()} — stronger signal`
        : `\n\n⚠️ Timeframes DISAGREE: ${Object.entries(tfSignals).map(([k, v]) => `${k}=${v}`).join(', ')} — be cautious`;
    }

    const prompt = `Проанализируй криптовалюту ${symbol || 'BTCUSDT'}.

Текущие данные:
- Цена: $${price}
- Изменение за 24ч: ${change24h}%
- Максимум 24ч: $${high}
- Минимум 24ч: $${low}
- Объём: ${volume}
- Индекс страха и жадности: ${fng || 'N/A'}
${marketData ? `- Дополнительные данные рынка: ${JSON.stringify(marketData)}` : ''}

📐 Рассчитанные технические индикаторы:${indicatorText}${tfAgreement}${btcContext}${learningContext}

Дай подробный анализ:

## 📊 Технический анализ
(используй предоставленные индикаторы RSI, EMA, MACD)
## 📈 Фундаментальный анализ
## 🎯 Торговый сигнал (LONG/SHORT/НЕЙТРАЛЬНО с точками входа, TP, SL)
## 💡 Объяснение
## 📊 Уверенность: X% (число от 0 до 100)
## ⭐ Оценка монеты: X/10 (число от 1 до 10 — общая привлекательность для торговли)`;

    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2-instruct',
        messages: [
          { role: 'system', content: 'Ты — профессиональный крипто-аналитик с системой самообучения. Отвечай подробно на русском языке. Используй markdown форматирование. ОБЯЗАТЕЛЬНО укажи числовую уверенность (0-100%) и оценку монеты (1-10).' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7, max_tokens: 2000
      })
    });
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content || (data?.error?.message ? `Ошибка API: ${data.error.message}` : 'Ошибка получения ответа от AI');

    // Parse confidence and coin score
    let confidence = null;
    let coinScore = null;
    const confMatch = text.match(/[Уу]веренность[:\s]*(\d{1,3})\s*%/i) || text.match(/(\d{1,3})\s*%/);
    if (confMatch) confidence = Math.min(100, Math.max(0, +confMatch[1]));
    const scoreMatch = text.match(/[Оо]ценка\s*монеты[:\s]*(\d{1,2})\s*\/\s*10/i) || text.match(/(\d{1,2})\s*\/\s*10/);
    if (scoreMatch) coinScore = Math.min(10, Math.max(1, +scoreMatch[1]));

    // Parse direction, entry, tp, sl for auto-tracking
    let direction = null;
    const upper = text.toUpperCase();
    if (upper.includes('LONG') && !upper.includes('SHORT')) direction = 'LONG';
    else if (upper.includes('SHORT') && !upper.includes('LONG')) direction = 'SHORT';

    let entryPrice = +price;
    let tpPrice = null;
    let slPrice = null;
    const tpMatch = text.match(/(?:TP|Take\s*Profit)[:\s]*\$?([\d,.]+)/i);
    const slMatch = text.match(/(?:SL|Stop\s*Loss)[:\s]*\$?([\d,.]+)/i);
    if (tpMatch) tpPrice = +tpMatch[1].replace(',', '');
    if (slMatch) slPrice = +slMatch[1].replace(',', '');

    // Save signal to signal_results for self-learning
    if (direction && entryPrice) {
      try {
        db.prepare(
          'INSERT INTO signal_results (pair, direction, entry_price, tp_price, sl_price, ai_analysis, confidence, coin_score) VALUES (?,?,?,?,?,?,?,?)'
        ).run(symbol || 'BTCUSDT', direction, entryPrice, tpPrice, slPrice, text.slice(0, 500), confidence, coinScore);
        console.log(`📝 Signal saved: ${symbol} ${direction} @ $${entryPrice}`);
      } catch (e) { console.error('Save signal error:', e.message); }
    }

    res.json({ analysis: text, confidence, coinScore, direction, entryPrice, tpPrice, slPrice });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    const messages = [
      { role: 'system', content: 'Ты — AI помощник на платформе KotvukAI. Отвечай на вопросы о криптовалютах, трейдинге, техническом и фундаментальном анализе. Будь полезным и дружелюбным. Отвечай на том языке, на котором задан вопрос.' },
      ...history.filter(m => m.role && m.content).slice(-10),
      { role: 'user', content: message }
    ];
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({ model: 'moonshotai/kimi-k2-instruct', messages, temperature: 0.7, max_tokens: 1500 })
    });
    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content || data?.error?.message || 'Ошибка';
    res.json({ reply });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ DASHBOARD ============

app.get('/api/dashboard', async (req, res) => {
  try {
    // Trade stats
    const closed = db.prepare('SELECT * FROM trades WHERE status = ?').all('closed');
    const totalPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);

    // Signal stats
    const allSignals = db.prepare('SELECT * FROM signal_results WHERE result != ?').all('pending');
    const tpHit = allSignals.filter(s => s.result === 'tp_hit').length;
    const signalAccuracy = allSignals.length > 0 ? (tpHit / allSignals.length * 100) : 0;

    // Best signal today
    const today = new Date().toISOString().slice(0, 10);
    const todaySignals = db.prepare("SELECT * FROM signal_results WHERE date(created_at) = ? AND result = 'tp_hit' ORDER BY accuracy_score DESC LIMIT 1").all(today);
    const bestSignal = todaySignals[0] || null;

    // Top mover from ticker
    let topMover = null;
    try {
      const r = await fetch('https://api.binance.com/api/v3/ticker/24hr');
      const data = await r.json();
      const pairs = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','AVAXUSDT'];
      const filtered = data.filter(t => pairs.includes(t.symbol));
      if (filtered.length) {
        filtered.sort((a, b) => Math.abs(+b.priceChangePercent) - Math.abs(+a.priceChangePercent));
        topMover = { symbol: filtered[0].symbol, change: +filtered[0].priceChangePercent };
      }
    } catch (e) {}

    // Fear & Greed
    let fngValue = null;
    try {
      const r = await fetch('https://api.alternative.me/fng/?limit=1');
      const d = await r.json();
      fngValue = d.data?.[0]?.value || null;
    } catch (e) {}

    res.json({ totalPnl, signalAccuracy, totalSignals: allSignals.length, bestSignal, topMover, fngValue });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard/recommendation', async (req, res) => {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2-instruct',
        messages: [
          { role: 'system', content: 'Ты крипто-аналитик. Дай ОДНО короткое предложение — рекомендация дня для трейдера. Максимум 15 слов. На русском.' },
          { role: 'user', content: `Дата: ${new Date().toISOString().slice(0, 10)}. Дай рекомендацию дня.` }
        ],
        temperature: 0.8, max_tokens: 100
      })
    });
    const data = await r.json();
    res.json({ recommendation: data?.choices?.[0]?.message?.content || 'Торгуйте осторожно' });
  } catch (e) { res.json({ recommendation: 'Следите за рынком' }); }
});

// ============ DOWNLOAD PROJECT ============

app.get('/api/download-project', (req, res) => {
  const archive = archiver('zip', { zlib: { level: 9 } });
  res.attachment('KotvukAI.zip');
  archive.pipe(res);
  archive.directory(path.join(__dirname, '..', 'frontend', 'src'), 'KotvukAI/frontend/src');
  archive.file(path.join(__dirname, 'server.js'), { name: 'KotvukAI/backend/server.js' });
  archive.file(path.join(__dirname, 'package.json'), { name: 'KotvukAI/backend/package.json' });
  archive.file(path.join(__dirname, '..', 'frontend', 'package.json'), { name: 'KotvukAI/frontend/package.json' });
  archive.file(path.join(__dirname, '..', 'frontend', 'vite.config.mjs'), { name: 'KotvukAI/frontend/vite.config.mjs' });
  archive.file(path.join(__dirname, '..', 'frontend', 'index.html'), { name: 'KotvukAI/frontend/index.html' });
  const fs = require('fs');
  if (fs.existsSync(path.join(__dirname, '..', 'start.bat'))) {
    archive.file(path.join(__dirname, '..', 'start.bat'), { name: 'KotvukAI/start.bat' });
  }
  if (fs.existsSync(path.join(__dirname, '..', 'database', 'init.sql'))) {
    archive.file(path.join(__dirname, '..', 'database', 'init.sql'), { name: 'KotvukAI/database/init.sql' });
  }
  archive.finalize();
});

// ============ SERVER-SIDE ALERT CHECKING ============

async function checkAlerts() {
  try {
    const activeAlerts = db.prepare('SELECT * FROM alerts WHERE status = ?').all('active');
    if (activeAlerts.length === 0) return;
    const r = await fetch('https://api.binance.com/api/v3/ticker/price');
    const prices = await r.json();
    const priceMap = {};
    prices.forEach(p => { priceMap[p.symbol] = +p.price; });

    for (const alert of activeAlerts) {
      const currentPrice = priceMap[alert.pair];
      if (!currentPrice) continue;
      let triggered = false;
      if (alert.condition === 'above' && currentPrice >= alert.value) triggered = true;
      if (alert.condition === 'below' && currentPrice <= alert.value) triggered = true;
      if (alert.condition === 'cross_above' && currentPrice >= alert.value) triggered = true;
      if (alert.condition === 'cross_below' && currentPrice <= alert.value) triggered = true;
      if (triggered) {
        db.prepare('UPDATE alerts SET status = ?, triggered_at = CURRENT_TIMESTAMP WHERE id = ?').run('triggered', alert.id);
        console.log(`🔔 Alert triggered: ${alert.pair} ${alert.condition} ${alert.value} (current: ${currentPrice})`);
      }
    }
  } catch (e) { console.error('Alert check error:', e.message); }
}

// ============ SERVER-SIDE AUTO-CLOSE TRADES ON TP/SL ============

async function checkTradeTPSL() {
  try {
    const openTrades = db.prepare('SELECT * FROM trades WHERE status = ?').all('open');
    if (openTrades.length === 0) return;
    const r = await fetch('https://api.binance.com/api/v3/ticker/price');
    const prices = await r.json();
    const priceMap = {};
    prices.forEach(p => { priceMap[p.symbol] = +p.price; });

    for (const trade of openTrades) {
      const currentPrice = priceMap[trade.pair];
      if (!currentPrice) continue;
      let shouldClose = false;
      if (trade.direction === 'long') {
        if (trade.tp && currentPrice >= trade.tp) shouldClose = true;
        if (trade.sl && currentPrice <= trade.sl) shouldClose = true;
      } else {
        if (trade.tp && currentPrice <= trade.tp) shouldClose = true;
        if (trade.sl && currentPrice >= trade.sl) shouldClose = true;
      }
      if (shouldClose) {
        const pnl = trade.direction === 'long'
          ? (currentPrice - trade.entry_price) * trade.quantity
          : (trade.entry_price - currentPrice) * trade.quantity;
        db.prepare('UPDATE trades SET status = ?, close_price = ?, pnl = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run('closed', currentPrice, pnl, trade.id);
        console.log(`📊 Trade auto-closed: ${trade.pair} ${trade.direction} PnL: ${pnl.toFixed(2)}`);
      }
    }
  } catch (e) { console.error('Trade TP/SL check error:', e.message); }
}

// ============ SIGNAL AUTO-RESOLUTION (TP/SL check + timeout) ============

async function checkPendingSignals() {
  try {
    const pending = db.prepare("SELECT * FROM signal_results WHERE result = 'pending'").all();
    if (pending.length === 0) return;

    const r = await fetch('https://api.binance.com/api/v3/ticker/price');
    const prices = await r.json();
    const priceMap = {};
    prices.forEach(p => { priceMap[p.symbol] = +p.price; });

    for (const sig of pending) {
      const currentPrice = priceMap[sig.pair];
      if (!currentPrice) continue;

      // Check TP/SL
      let result = null;
      if (sig.direction === 'LONG' || sig.direction === 'long') {
        if (sig.tp_price && currentPrice >= sig.tp_price) result = 'tp_hit';
        else if (sig.sl_price && currentPrice <= sig.sl_price) result = 'sl_hit';
      } else if (sig.direction === 'SHORT' || sig.direction === 'short') {
        if (sig.tp_price && currentPrice <= sig.tp_price) result = 'tp_hit';
        else if (sig.sl_price && currentPrice >= sig.sl_price) result = 'sl_hit';
      }

      // Check timeout (24h for signals)
      if (!result) {
        const created = new Date(sig.created_at).getTime();
        const now = Date.now();
        if (now - created > 24 * 60 * 60 * 1000) {
          result = 'timeout';
        }
      }

      if (result) {
        const score = result === 'tp_hit' ? 100 : result === 'timeout' ? 50 : 0;
        db.prepare('UPDATE signal_results SET result = ?, actual_price = ?, accuracy_score = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(result, currentPrice, score, sig.id);
        console.log(`🎯 Signal #${sig.id} resolved: ${sig.pair} → ${result} (price: $${currentPrice})`);
        generateReflection(sig.id).catch(e => console.error('Reflection error:', e.message));
      }
    }
  } catch (e) { console.error('Signal check error:', e.message); }
}

// Run checks
setInterval(checkAlerts, 10000);
setInterval(checkTradeTPSL, 10000);
setInterval(checkPendingSignals, 60000);

// ============ ADMIN PANEL ROUTES ============

// Admin middleware - check if user is admin
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Create first admin (only works when no admins exist)
app.post('/api/admin/setup', async (req, res) => {
  try {
    const adminExists = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 1').get();
    if (adminExists.count > 0) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hash = hashPassword(password);
    const result = db.prepare('INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)')
      .run(name || '', email, hash);
    
    const token = createToken(result.lastInsertRowid);
    res.json({ 
      token, 
      user: { id: result.lastInsertRowid, name, email, plan: 'Free', is_admin: 1 } 
    });
  } catch (e) { 
    res.status(500).json({ error: e.message }); 
  }
});

// Get all users
app.get('/api/admin/users', requireAdmin, (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, email, plan, is_admin, created_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Change user plan
app.patch('/api/admin/users/:id/plan', requireAdmin, (req, res) => {
  try {
    const { plan } = req.body;
    const validPlans = ['Free', 'Pro', 'Premium'];
    if (!validPlans.includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan' });
    }
    
    db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Toggle admin status
app.patch('/api/admin/users/:id/admin', requireAdmin, (req, res) => {
  try {
    const { is_admin } = req.body;
    if (is_admin !== 0 && is_admin !== 1) {
      return res.status(400).json({ error: 'is_admin must be 0 or 1' });
    }

    // Prevent user from removing their own admin status
    if (req.user.id === parseInt(req.params.id) && is_admin === 0) {
      return res.status(400).json({ error: 'Cannot remove admin status from yourself' });
    }
    
    db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(is_admin, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete user
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.user.id === parseInt(req.params.id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Platform stats
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  try {
    // User stats
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const freeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE plan = ?').get('Free').count;
    const proUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE plan = ?').get('Pro').count;
    const premiumUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE plan = ?').get('Premium').count;

    // Trade stats
    const totalTrades = db.prepare('SELECT COUNT(*) as count FROM trades').get().count;

    // Signal stats
    const totalSignals = db.prepare('SELECT COUNT(*) as count FROM signal_results').get().count;
    const resolvedSignals = db.prepare('SELECT * FROM signal_results WHERE result != ?').all('pending');
    const tpHit = resolvedSignals.filter(s => s.result === 'tp_hit').length;
    const signalAccuracy = resolvedSignals.length > 0 ? (tpHit / resolvedSignals.length * 100) : 0;

    res.json({
      totalUsers,
      usersByPlan: { Free: freeUsers, Pro: proUsers, Premium: premiumUsers },
      totalTrades,
      totalSignals,
      signalAccuracy: parseFloat(signalAccuracy.toFixed(2))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all signals with pagination
app.get('/api/admin/signals', requireAdmin, (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const signals = db.prepare('SELECT * FROM signal_results ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset);
    const total = db.prepare('SELECT COUNT(*) as count FROM signal_results').get().count;

    res.json({
      signals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update plan settings
app.patch('/api/admin/plans/:plan', requireAdmin, (req, res) => {
  try {
    const planName = req.params.plan;
    const validPlans = ['Free', 'Pro', 'Premium'];
    if (!validPlans.includes(planName)) {
      return res.status(400).json({ error: 'Invalid plan name' });
    }

    const planData = req.body;
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run(`plan_${planName}`, JSON.stringify(planData));
    
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ SERVE STATIC (production) ============

const distPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not built. Run: cd frontend && npx vite build');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`KotvukAI backend running on port ${PORT}`));
