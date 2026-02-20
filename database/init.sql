-- KotvukAI Database Schema
-- SQLite3 | Auto-created by backend/config/database.js
-- This file is for reference/documentation only

-- ============ USERS ============
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    name TEXT,
    password_hash TEXT,
    plan TEXT DEFAULT 'Free',          -- Free | Pro | Premium
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============ SIGNALS ============
CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT,
    type TEXT,
    entry REAL,
    tp REAL,
    sl REAL,
    reason TEXT,
    accuracy REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============ SIGNAL RESULTS (Self-Learning) ============
CREATE TABLE IF NOT EXISTS signal_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    signal_id INTEGER,
    pair TEXT NOT NULL,
    direction TEXT,                     -- LONG | SHORT
    entry_price REAL,
    tp_price REAL,
    sl_price REAL,
    actual_price REAL,
    result TEXT DEFAULT 'pending',      -- pending | tp_hit | sl_hit | timeout
    confidence REAL,                    -- 0-100%
    coin_score INTEGER,                 -- 1-10
    accuracy_score REAL,
    ai_analysis TEXT,
    ai_reflection TEXT,                 -- Self-learning reflection
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);

-- ============ TRADES (Paper Trading) ============
CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT NOT NULL,
    direction TEXT NOT NULL,            -- long | short
    quantity REAL NOT NULL,
    entry_price REAL NOT NULL,
    tp REAL,
    sl REAL,
    close_price REAL,
    pnl REAL,
    status TEXT DEFAULT 'open',         -- open | closed
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME
);

-- ============ ALERTS ============
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT NOT NULL,
    condition TEXT NOT NULL,            -- above | below | cross_above | cross_below
    value REAL NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'active',       -- active | triggered | disabled
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    triggered_at DATETIME
);

-- ============ WATCHLIST ============
CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT NOT NULL UNIQUE,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============ DRAWINGS (Chart Tools) ============
CREATE TABLE IF NOT EXISTS drawings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pair TEXT,
    data TEXT,                          -- JSON serialized drawing data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============ SETTINGS ============
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE,
    value TEXT
);

-- ============ DEFAULT PLANS ============
INSERT OR REPLACE INTO settings (key, value) VALUES
    ('plan_Free', '{"name":"Free","price":"бесплатно","indicators":3,"aiAnalyses":5,"charts":true,"pairs":3,"signals":5,"refreshRate":30}'),
    ('plan_Pro', '{"name":"Pro","price":"$29/мес","indicators":"все","aiAnalyses":50,"charts":true,"pairs":10,"signals":50,"refreshRate":10,"alerts":true,"whyButton":true,"whale":true}'),
    ('plan_Premium', '{"name":"Premium","price":"$99/мес","indicators":"все","aiAnalyses":-1,"charts":true,"pairs":10,"signals":-1,"refreshRate":5,"alerts":true,"whale":true,"ai":true,"realtimeAI":true,"prioritySupport":true}');
