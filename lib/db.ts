import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

// Lazy initialization — does not throw at build time when env var is absent
let _sql: NeonQueryFunction<false, false> | null = null

function getSQL(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
    _sql = neon(process.env.DATABASE_URL)
  }
  return _sql
}

// Proxy so call sites can use `sql\`...\`` as before
// IMPORTANT: target must be a function for the apply trap to work with tagged templates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sql: NeonQueryFunction<false, false> = new Proxy(function () {} as any, {
  apply(_t, _this, args) {
    return (getSQL() as unknown as (...a: unknown[]) => unknown)(...args)
  },
  get(_t, prop) {
    const s = getSQL() as unknown as Record<string | symbol, unknown>
    return s[prop]
  },
})

// ── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  firebase_uid: string
  email: string | null
  nickname: string | null
  lang: string
  created_at: string
}

export interface Signal {
  id: number
  user_id: number
  pair: string
  timeframe: string
  final_verdict: string | null
  final_confidence: number | null
  final_entry: number | null
  final_tp: number | null
  final_sl: number | null
  final_leverage: number | null
  final_risk_score: number | null
  outcome: 'win' | 'loss' | null
  actual_pnl_pct: number | null
  raw_response: Record<string, unknown> | null
  created_at: string
}

export interface Trade {
  id: number
  user_id: number
  pair: string
  direction: 'long' | 'short'
  order_type: 'market' | 'limit'
  amount: number
  entry_price: number | null
  tp_price: number | null
  sl_price: number | null
  leverage: number
  status: 'open' | 'closed'
  pnl: number | null
  pnl_pct: number | null
  closed_at: string | null
  created_at: string
}

export interface Notification {
  id: number
  user_id: number
  message: string
  read: boolean
  created_at: string
}

// ── User helpers ──────────────────────────────────────────────────────────────

export async function upsertUser(firebaseUid: string, email: string): Promise<User> {
  const rows = await sql`
    INSERT INTO users (firebase_uid, email)
    VALUES (${firebaseUid}, ${email})
    ON CONFLICT (firebase_uid) DO UPDATE SET email = EXCLUDED.email
    RETURNING *
  `
  return rows[0] as User
}

export async function getUserByFirebaseUid(uid: string): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE firebase_uid = ${uid} LIMIT 1`
  return (rows[0] as User) || null
}

// ── Signal helpers ────────────────────────────────────────────────────────────

export async function saveSignal(userId: number, data: Partial<Signal>) {
  const rows = await sql`
    INSERT INTO signals (
      user_id, pair, timeframe, final_verdict, final_confidence,
      final_entry, final_tp, final_sl, final_leverage, final_risk_score, raw_response
    ) VALUES (
      ${userId}, ${data.pair!}, ${data.timeframe!}, ${data.final_verdict ?? null},
      ${data.final_confidence ?? null}, ${data.final_entry ?? null},
      ${data.final_tp ?? null}, ${data.final_sl ?? null},
      ${data.final_leverage ?? null}, ${data.final_risk_score ?? null},
      ${JSON.stringify(data.raw_response ?? {})}
    ) RETURNING *
  `
  return rows[0] as Signal
}

export async function getSignals(userId: number, limit = 100): Promise<Signal[]> {
  const rows = await sql`
    SELECT * FROM signals WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT ${limit}
  `
  return rows as Signal[]
}

export async function updateSignalOutcome(id: number, userId: number, outcome: string) {
  await sql`
    UPDATE signals SET outcome = ${outcome}
    WHERE id = ${id} AND user_id = ${userId}
  `
}

export async function getStats(userId: number) {
  const [statsRow] = await sql`
    SELECT
      COUNT(*) AS total,
      AVG(final_confidence)::int AS avg_confidence,
      COUNT(*) FILTER (WHERE outcome = 'win')::float /
        NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0) * 100 AS win_rate,
      AVG(actual_pnl_pct) AS avg_pnl_pct
    FROM signals WHERE user_id = ${userId}
  `
  const byPair = await sql`
    SELECT pair,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE outcome = 'win')::float /
        NULLIF(COUNT(*) FILTER (WHERE outcome IS NOT NULL), 0) * 100 AS win_rate
    FROM signals WHERE user_id = ${userId}
    GROUP BY pair ORDER BY total DESC LIMIT 10
  `
  return {
    total: Number(statsRow.total),
    avg_confidence: statsRow.avg_confidence,
    win_rate: statsRow.win_rate ? Math.round(Number(statsRow.win_rate)) : null,
    avg_pnl_pct: statsRow.avg_pnl_pct ? Number(statsRow.avg_pnl_pct).toFixed(1) : null,
    by_pair: byPair.map(r => ({
      pair: r.pair,
      total: Number(r.total),
      win_rate: r.win_rate ? Math.round(Number(r.win_rate)) : null,
    })),
  }
}

// ── Trade helpers ─────────────────────────────────────────────────────────────

export async function getTrades(userId: number): Promise<Trade[]> {
  const rows = await sql`
    SELECT * FROM trades WHERE user_id = ${userId} ORDER BY created_at DESC
  `
  return rows as Trade[]
}

export async function getTradeById(id: number, userId: number): Promise<Trade | null> {
  const rows = await sql`SELECT * FROM trades WHERE id = ${id} AND user_id = ${userId} LIMIT 1`
  return (rows[0] as Trade) || null
}

export async function createTrade(userId: number, data: Partial<Trade>): Promise<Trade> {
  const rows = await sql`
    INSERT INTO trades (user_id, pair, direction, order_type, amount, entry_price, tp_price, sl_price, leverage)
    VALUES (${userId}, ${data.pair!}, ${data.direction!}, ${data.order_type!},
            ${data.amount!}, ${data.entry_price ?? null}, ${data.tp_price ?? null},
            ${data.sl_price ?? null}, ${data.leverage ?? 1})
    RETURNING *
  `
  return rows[0] as Trade
}

export async function closeTrade(id: number, userId: number, pnl: number | null, pnlPct: number | null) {
  await sql`
    UPDATE trades SET status = 'closed', pnl = ${pnl}, pnl_pct = ${pnlPct}, closed_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
  `
}

// ── Notification helpers ──────────────────────────────────────────────────────

export async function getNotifications(userId: number): Promise<Notification[]> {
  const rows = await sql`
    SELECT * FROM notifications WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT 50
  `
  return rows as Notification[]
}

export async function createNotification(userId: number, message: string) {
  await sql`
    INSERT INTO notifications (user_id, message) VALUES (${userId}, ${message})
  `
}

export async function markNotificationsRead(userId: number) {
  await sql`UPDATE notifications SET read = TRUE WHERE user_id = ${userId}`
}

export async function clearNotifications(userId: number) {
  await sql`DELETE FROM notifications WHERE user_id = ${userId}`
}

// ── Settings helpers ──────────────────────────────────────────────────────────

export async function updateUserSettings(userId: number, data: { nickname?: string; email?: string; lang?: string }) {
  await sql`
    UPDATE users SET
      nickname = COALESCE(${data.nickname ?? null}, nickname),
      email    = COALESCE(${data.email ?? null}, email),
      lang     = COALESCE(${data.lang ?? null}, lang)
    WHERE id = ${userId}
  `
}

// ── Init DB (run once) ────────────────────────────────────────────────────────

export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      firebase_uid TEXT UNIQUE NOT NULL,
      email TEXT,
      nickname TEXT,
      lang TEXT DEFAULT 'ru',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS signals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      pair TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      final_verdict TEXT,
      final_confidence INTEGER,
      final_entry NUMERIC,
      final_tp NUMERIC,
      final_sl NUMERIC,
      final_leverage INTEGER,
      final_risk_score INTEGER,
      outcome TEXT,
      actual_pnl_pct NUMERIC,
      raw_response JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS trades (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      pair TEXT NOT NULL,
      direction TEXT NOT NULL,
      order_type TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      entry_price NUMERIC,
      tp_price NUMERIC,
      sl_price NUMERIC,
      leverage INTEGER DEFAULT 1,
      status TEXT DEFAULT 'open',
      pnl NUMERIC,
      pnl_pct NUMERIC,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      message TEXT NOT NULL,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}
