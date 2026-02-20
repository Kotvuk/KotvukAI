const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.TEST_DB_PATH || path.join(__dirname, '..', '..', 'database', 'crypto_analytics.db');
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

// Migrations
try { db.exec('ALTER TABLE signal_results ADD COLUMN confidence REAL'); } catch(e) {}
try { db.exec('ALTER TABLE signal_results ADD COLUMN coin_score INTEGER'); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT'); } catch(e) {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)'); } catch(e) {}
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

// Insert default plans
const plans = {
  Free: { name: 'Free', price: 'бесплатно', indicators: 3, aiAnalyses: 5, charts: true, pairs: 3, signals: 5, refreshRate: 30 },
  Pro: { name: 'Pro', price: '$29/мес', indicators: 'все', aiAnalyses: 50, charts: true, pairs: 10, signals: 50, refreshRate: 10, alerts: true, whyButton: true, whale: true },
  Premium: { name: 'Premium', price: '$99/мес', indicators: 'все', aiAnalyses: -1, charts: true, pairs: 10, signals: -1, refreshRate: 5, alerts: true, whale: true, ai: true, realtimeAI: true, prioritySupport: true }
};
const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(plans)) upsert.run(`plan_${k}`, JSON.stringify(v));

module.exports = db;
