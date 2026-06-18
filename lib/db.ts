import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

type Market = 'crypto'

export const sql: NeonQueryFunction<false, false> = neon(process.env.DATABASE_URL!, {
  fetchOptions: { cache: 'no-store' },
})

export interface User {
  id: number
  firebase_uid: string
  email: string | null
  nickname: string | null
  lang: string
  ai_max_leverage: number
  ai_balance?: number
  ai_trade_amount?: number
  stripe_customer_id?: string | null  // legacy, kept for migration
  telegram_chat_id?: string | null
  watchlist?: string[] | null
  auto_analyze_paused?: boolean
  signal_direction?: string
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
  outcome: 'win' | 'loss' | 'expired' | null
  actual_pnl_pct: number | null
  raw_response: Record<string, unknown> | null
  market: Market
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
  status: 'open' | 'closed' | 'pending' | 'cancelled'
  limit_price: number | null
  expires_at: string | null
  account_type: 'user' | 'ai'
  pnl: number | null
  pnl_pct: number | null
  exit_price: number | null
  timeframe: string | null
  market: Market
  signal_id: number | null
  closed_at: string | null
  created_at: string
}

export interface Subscription {
  id: number
  user_id: number
  tier: 'free' | 'starter' | 'pro' | 'elite'
  analyses_today: number
  last_reset_date: string
  expires_at: string | null
  created_at: string
  ls_subscription_id?: string | null
  ls_customer_id?: string | null
  cryptomus_subscription_id?: string | null
  cryptomus_order_id?: string | null
}

export const SUBSCRIPTION_LIMITS: Record<string, number> = {
  free:    3,
  starter: 10,
  pro:     30,
  elite:   999,
}

export interface Notification {
  id: number
  user_id: number
  message: string
  read: boolean
  created_at: string
}

export interface LevelAlert {
  id: number
  user_id: number
  pair: string
  zone_type: string
  price_high: number
  price_low: number
  label: string | null
  is_triggered: boolean
  triggered_at: string | null
  created_at: string
}

export async function getLevelAlerts(userId: number): Promise<LevelAlert[]> {
  const rows = await sql`
    SELECT * FROM level_alerts
    WHERE user_id = ${userId} AND is_triggered = FALSE
    ORDER BY created_at DESC LIMIT 50
  `
  return rows as LevelAlert[]
}

export async function createLevelAlert(userId: number, data: {
  pair: string; zone_type: string; price_high: number; price_low: number; label?: string
}): Promise<LevelAlert> {
  const rows = await sql`
    INSERT INTO level_alerts (user_id, pair, zone_type, price_high, price_low, label)
    VALUES (${userId}, ${data.pair}, ${data.zone_type}, ${data.price_high}, ${data.price_low}, ${data.label ?? null})
    RETURNING *
  `
  return rows[0] as LevelAlert
}

export async function deleteLevelAlert(id: number, userId: number): Promise<boolean> {
  const rows = await sql`
    DELETE FROM level_alerts WHERE id = ${id} AND user_id = ${userId} RETURNING id
  `
  return rows.length > 0
}

export async function triggerLevelAlert(id: number, userId: number, pair: string, label: string | null): Promise<void> {
  await sql`
    UPDATE level_alerts SET is_triggered = TRUE, triggered_at = NOW()
    WHERE id = ${id} AND user_id = ${userId}
  `
  const msg = `🔔 Price entered zone: ${label || pair}`
  await sql`INSERT INTO notifications (user_id, message) VALUES (${userId}, ${msg})`
}

export async function checkAndTriggerAlerts(userId: number, prices: Record<string, number>): Promise<number> {
  const alerts = await getLevelAlerts(userId)
  let triggered = 0
  for (const alert of alerts) {
    const price = prices[alert.pair]
    if (price === undefined) continue
    if (price >= alert.price_low && price <= alert.price_high) {
      await triggerLevelAlert(alert.id, userId, alert.pair, alert.label)
      triggered++
    }
  }
  return triggered
}

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

export async function getUserById(id: number): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE id = ${id} LIMIT 1`
  return (rows[0] as User) || null
}

export async function getPublicProfile(userId: number) {
  const rows = await sql`
    SELECT
      u.id,
      u.nickname,
      u.created_at,
      s.tier,
      COUNT(sig.id)                                                         AS total_signals,
      COUNT(sig.id) FILTER (WHERE sig.outcome IN ('win','loss'))            AS resolved,
      COUNT(sig.id) FILTER (WHERE sig.outcome = 'win')                      AS wins,
      ROUND(AVG(sig.final_confidence) FILTER (WHERE sig.outcome IS NOT NULL)) AS avg_confidence,
      ROUND(AVG(sig.actual_pnl_pct)  FILTER (WHERE sig.outcome = 'win'))    AS avg_pnl
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id
    LEFT JOIN signals sig ON sig.user_id = u.id
    WHERE u.id = ${userId}
    GROUP BY u.id, u.nickname, u.created_at, s.tier
    LIMIT 1
  `
  if (!rows[0]) return null
  const r = rows[0] as Record<string, unknown>
  const resolved = Number(r.resolved ?? 0)
  const wins     = Number(r.wins ?? 0)
  return {
    id:           Number(r.id),
    nickname:     (r.nickname as string | null) || 'Trader',
    tier:         (r.tier as string | null) || 'free',
    joinedAt:     r.created_at as string,
    totalSignals: Number(r.total_signals ?? 0),
    winRate:      resolved > 0 ? Math.round((wins / resolved) * 100) : null,
    wins,
    losses:       resolved - wins,
    avgConf:      r.avg_confidence !== null ? Number(r.avg_confidence) : null,
    avgPnl:       r.avg_pnl !== null ? Number(r.avg_pnl) : null,
  }
}

export async function setStripeCustomerId(userId: number, customerId: string): Promise<void> {
  await sql`UPDATE users SET stripe_customer_id = ${customerId} WHERE id = ${userId}`
}

const TF_CANON: Record<string, string> = {
  '1м': '1m', '5м': '5m', '15м': '15m', '30м': '30m', '1ч': '1h', '4ч': '4h', '1д': '1d',
  '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h', '4h': '4h', '1d': '1d',
}

export function normalizeTf(tf: string): string {
  return TF_CANON[tf] ?? tf
}

const num = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) ? null : v

export async function saveSignal(userId: number, data: Partial<Signal>, market: Market = 'crypto') {
  if (data.timeframe) data.timeframe = normalizeTf(data.timeframe)
  const riskScore = num(data.final_risk_score)
  const rows = await sql`
    INSERT INTO signals (
      user_id, pair, timeframe, final_verdict, final_confidence,
      final_entry, final_tp, final_sl, final_leverage, final_risk_score, raw_response, market
    ) VALUES (
      ${userId}, ${data.pair!}, ${data.timeframe!}, ${data.final_verdict ?? null},
      ${num(data.final_confidence)}, ${num(data.final_entry)},
      ${num(data.final_tp)}, ${num(data.final_sl)},
      ${num(data.final_leverage)}, ${riskScore != null ? Math.round(riskScore) : null},
      ${JSON.stringify(data.raw_response ?? {})}, ${market}
    ) RETURNING *
  `
  return rows[0] as Signal
}

export const ENTRY_CONFIDENCE_THRESHOLD = 50

export async function getSignals(userId: number, limit = 100, offset = 0, market: Market = 'crypto', tradableOnly = false): Promise<Signal[]> {
  const rows = tradableOnly
    ? await sql`
        SELECT * FROM signals WHERE user_id = ${userId} AND market = ${market}
          AND final_verdict IN ('LONG', 'SHORT') AND final_confidence >= ${ENTRY_CONFIDENCE_THRESHOLD}
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
    : await sql`
        SELECT * FROM signals WHERE user_id = ${userId} AND market = ${market}
        ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
      `
  return rows as Signal[]
}

export async function clearSignals(userId: number) {
  await sql`DELETE FROM signals WHERE user_id = ${userId}`
}

export async function updateSignalOutcome(id: number, userId: number, outcome: string) {
  await sql`
    UPDATE signals SET outcome = ${outcome}
    WHERE id = ${id} AND user_id = ${userId}
  `
}

export async function getStats(userId: number, market: Market = 'crypto') {
  const [statsRow] = await sql`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE outcome IN ('win','loss')) AS resolved,
      AVG(final_confidence) FILTER (WHERE outcome IS NOT NULL)::int AS avg_confidence,
      COUNT(*) FILTER (WHERE outcome = 'win')::float /
        NULLIF(COUNT(*) FILTER (WHERE outcome IN ('win','loss')), 0) * 100 AS win_rate,
      AVG(actual_pnl_pct) FILTER (WHERE outcome IN ('win','loss') AND actual_pnl_pct <> 'NaN'::numeric) AS avg_pnl_pct
    FROM signals WHERE user_id = ${userId} AND market = ${market} AND final_verdict IN ('LONG','SHORT')
  `
  const byPair = await sql`
    SELECT pair,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE outcome = 'win')::float /
        NULLIF(COUNT(*) FILTER (WHERE outcome IN ('win','loss')), 0) * 100 AS win_rate
    FROM signals WHERE user_id = ${userId} AND market = ${market} AND final_verdict IN ('LONG','SHORT')
    GROUP BY pair ORDER BY total DESC LIMIT 10
  `
  const [tradesRow] = await sql`
    SELECT ROUND(SUM(pnl_pct)::numeric, 2) AS total_pnl_pct
    FROM trades WHERE user_id = ${userId} AND account_type = 'ai' AND status = 'closed'
  `
  const resolved = Number(statsRow.resolved ?? 0)
  return {
    total: Number(statsRow.total),
    resolved,
    avg_confidence: statsRow.avg_confidence,
    win_rate: resolved >= 3 ? (statsRow.win_rate ? Math.round(Number(statsRow.win_rate)) : null) : null,
    avg_pnl_pct: statsRow.avg_pnl_pct ? Number(statsRow.avg_pnl_pct).toFixed(1) : null,
    total_pnl_pct: tradesRow?.total_pnl_pct != null ? Number(tradesRow.total_pnl_pct).toFixed(1) : null,
    by_pair: byPair.map(r => ({
      pair: r.pair,
      total: Number(r.total),
      win_rate: r.win_rate ? Math.round(Number(r.win_rate)) : null,
    })),
  }
}

export async function getAdvancedStats(userId: number, market: Market = 'crypto') {
  const rows = await sql`
    SELECT actual_pnl_pct, outcome
    FROM signals
    WHERE user_id = ${userId} AND market = ${market} AND outcome IS NOT NULL AND actual_pnl_pct IS NOT NULL
    ORDER BY created_at ASC
  `
  if (!rows.length) return null

  const pnls = rows.map(r => Number(r.actual_pnl_pct))
  const wins  = pnls.filter(p => p > 0)
  const losses = pnls.filter(p => p <= 0)

  const grossWin  = wins.reduce((s, p) => s + p, 0)
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0))
  const profitFactor = grossLoss > 0 ? parseFloat((grossWin / grossLoss).toFixed(2)) : null

  let peak = 0, equity = 0, maxDD = 0
  for (const p of pnls) {
    equity += p
    if (equity > peak) peak = equity
    const dd = peak - equity
    if (dd > maxDD) maxDD = dd
  }

  const avg = pnls.reduce((s, p) => s + p, 0) / pnls.length
  const variance = pnls.reduce((s, p) => s + Math.pow(p - avg, 2), 0) / pnls.length
  const stdDev = Math.sqrt(variance)
  const sharpe = stdDev > 0 ? parseFloat((avg / stdDev).toFixed(2)) : null

  const wr = wins.length / pnls.length
  const avgWin  = wins.length  ? grossWin  / wins.length  : 0
  const avgLoss = losses.length ? grossLoss / losses.length : 0
  const expectancy = parseFloat(((wr * avgWin) - ((1 - wr) * avgLoss)).toFixed(2))

  return {
    profit_factor: profitFactor,
    max_drawdown: parseFloat(maxDD.toFixed(2)),
    sharpe_ratio: sharpe,
    expectancy,
    avg_win:  parseFloat(avgWin.toFixed(2)),
    avg_loss: parseFloat(avgLoss.toFixed(2)),
    total_resolved: pnls.length,
  }
}

export async function getTrades(
  userId: number,
  accountType?: 'user' | 'ai',
  limit = 200,
  offset = 0,
  market: Market = 'crypto',
): Promise<Trade[]> {
  const rows = accountType
    ? await sql`SELECT * FROM trades WHERE user_id = ${userId} AND account_type = ${accountType} AND market = ${market} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
    : await sql`SELECT * FROM trades WHERE user_id = ${userId} AND market = ${market} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
  return rows as Trade[]
}

export async function getTradeById(id: number, userId: number): Promise<Trade | null> {
  const rows = await sql`SELECT * FROM trades WHERE id = ${id} AND user_id = ${userId} LIMIT 1`
  return (rows[0] as Trade) || null
}

export async function createTrade(userId: number, data: Partial<Trade>, market: Market = 'crypto'): Promise<Trade> {
  const rows = await sql`
    INSERT INTO trades (user_id, pair, direction, order_type, amount, entry_price, tp_price, sl_price,
                        leverage, account_type, status, limit_price, expires_at, timeframe, market, signal_id)
    VALUES (${userId}, ${data.pair!}, ${data.direction!}, ${data.order_type ?? 'market'},
            ${data.amount!}, ${data.entry_price ?? null}, ${data.tp_price ?? null},
            ${data.sl_price ?? null}, ${data.leverage ?? 1}, ${data.account_type ?? 'user'},
            ${data.status ?? 'open'}, ${data.limit_price ?? null}, ${data.expires_at ?? null},
            ${data.timeframe ?? null}, ${data.market ?? market}, ${data.signal_id ?? null})
    RETURNING *
  `
  return rows[0] as Trade
}

export async function updateTrade(id: number, userId: number, data: { tp_price?: number; sl_price?: number }) {
  await sql`
    UPDATE trades SET
      tp_price = COALESCE(${data.tp_price ?? null}, tp_price),
      sl_price = COALESCE(${data.sl_price ?? null}, sl_price)
    WHERE id = ${id} AND user_id = ${userId} AND status IN ('open', 'pending')
  `
}

export async function closeTrade(id: number, userId: number, pnl: number | null, pnlPct: number | null, exitPrice: number | null = null): Promise<boolean> {
  const rows = await sql`
    UPDATE trades SET status = 'closed', pnl = ${pnl}, pnl_pct = ${pnlPct}, exit_price = ${exitPrice}, closed_at = NOW()
    WHERE id = ${id} AND user_id = ${userId} AND status = 'open'
    RETURNING id
  `
  return rows.length > 0
}

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

export async function getSignalsForPair(userId: number, pair: string, limit = 10, market: Market = 'crypto'): Promise<Signal[]> {
  const rows = await sql`
    SELECT id, pair, timeframe, final_verdict, final_confidence,
           final_entry, final_tp, final_sl, final_leverage, outcome, actual_pnl_pct, raw_response, created_at
    FROM signals
    WHERE user_id = ${userId} AND pair = ${pair} AND market = ${market}
    ORDER BY created_at DESC LIMIT ${limit}
  `
  return rows as Signal[]
}

export async function getGlobalLossPatterns(userId: number): Promise<string> {
  const rows = await sql`
    SELECT raw_response, final_verdict, actual_pnl_pct
    FROM signals
    WHERE user_id = ${userId}
      AND outcome = 'loss'
      AND created_at > NOW() - INTERVAL '30 days'
      AND raw_response IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 25
  `
  if (rows.length < 3) return ''

  let rsiOverboughtLongs = 0
  let highFundingLongs = 0
  let weakObCount = 0
  let trendConflict = 0
  const n = rows.length

  for (const row of rows) {
    const raw = row.raw_response as Record<string, unknown> | null
    if (!raw) continue
    const m = raw.market as Record<string, unknown> | undefined
    const pipe = raw.pipeline as Record<string, unknown> | undefined
    const s1 = pipe?.step1 as Record<string, unknown> | undefined
    const finalData = (raw.analysis || raw.final) as Record<string, unknown> | undefined
    const obUsed = finalData?.ob_used as Record<string, unknown> | undefined

    const rsi = Number(m?.rsi ?? 0)
    const funding = Number(m?.fundingRate ?? 0)
    const trend = String(s1?.trend ?? '')
    const verdict = String(row.final_verdict ?? '')
    const obQ = String(obUsed?.quality ?? '')

    if (verdict === 'LONG' && rsi > 65) rsiOverboughtLongs++
    if (verdict === 'LONG' && funding > 0.05) highFundingLongs++
    if (obQ === 'B' || obQ === 'C') weakObCount++
    if (
      (verdict === 'LONG' && (trend === 'bearish' || trend === 'ranging')) ||
      (verdict === 'SHORT' && (trend === 'bullish' || trend === 'ranging'))
    ) trendConflict++
  }

  const rules: string[] = []
  if (rsiOverboughtLongs >= 2) rules.push(`RSI>65 on LONG → ${rsiOverboughtLongs}/${n} losses (require RSI<65 for longs)`)
  if (highFundingLongs >= 2) rules.push(`Funding>0.05% on LONG → ${highFundingLongs}/${n} losses (avoid overheated longs)`)
  if (weakObCount >= Math.ceil(n * 0.5)) rules.push(`B/C quality OB → ${weakObCount}/${n} losses (prefer A/A+ zones only)`)
  if (trendConflict >= 2) rules.push(`Trend/HTF conflict → ${trendConflict}/${n} losses (align with HTF trend)`)

  if (!rules.length) return ''
  return `\n⛔ LEARNED RULES (from ${n} losses in 30 days):\n${rules.map(r => `  • ${r}`).join('\n')}\n`
}

export interface PairTier {
  tier: 'white' | 'grey' | 'black'
  resolved: number
  wins: number
  losses: number
  winRate: number | null
  consecutiveLosses: number
}

export async function getPairTier(pair: string, userId?: number, market: Market = 'crypto'): Promise<PairTier> {
  const rows = userId != null
    ? await sql`
        SELECT outcome FROM signals
        WHERE pair = ${pair} AND user_id = ${userId} AND market = ${market} AND outcome IN ('win','loss')
        ORDER BY created_at DESC LIMIT 10
      `
    : await sql`
        SELECT outcome FROM signals
        WHERE pair = ${pair} AND market = ${market} AND outcome IN ('win','loss')
        ORDER BY created_at DESC LIMIT 10
      `

  const resolved = rows.length
  const wins = rows.filter(r => r.outcome === 'win').length
  const losses = resolved - wins
  const winRate = resolved > 0 ? wins / resolved : null

  let consecutiveLosses = 0
  for (const r of rows) {
    if (r.outcome === 'loss') consecutiveLosses++
    else break
  }

  let tier: PairTier['tier'] = 'white'
  if (consecutiveLosses >= 4 || (resolved >= 6 && winRate !== null && winRate < 0.3)) {
    tier = 'black'
  } else if (consecutiveLosses >= 2 || (resolved >= 6 && winRate !== null && winRate < 0.4)) {
    tier = 'grey'
  }

  return { tier, resolved, wins, losses, winRate, consecutiveLosses }
}

export async function getPendingSignals(userId: number, market: Market = 'crypto'): Promise<Signal[]> {
  const rows = await sql`
    SELECT * FROM signals
    WHERE user_id = ${userId} AND market = ${market}
      AND outcome IS NULL
      AND final_verdict IN ('LONG','SHORT')
      AND final_tp IS NOT NULL
      AND final_sl IS NOT NULL
      AND created_at < NOW() - INTERVAL '5 minutes'
    ORDER BY created_at DESC LIMIT 50
  `
  return rows as Signal[]
}

export async function setSignalOutcome(id: number, outcome: 'win' | 'loss', pnlPct: number, userId: number) {
  const rows = await sql`
    UPDATE signals SET outcome = ${outcome}, actual_pnl_pct = ${Number.isFinite(pnlPct) ? pnlPct : null}
    WHERE id = ${id} AND user_id = ${userId} AND outcome IS NULL
    RETURNING id
  `
  return rows
}

export async function getAllPendingSignals(): Promise<Signal[]> {
  const rows = await sql`
    SELECT * FROM signals
    WHERE outcome IS NULL
      AND final_verdict IN ('LONG', 'SHORT')
      AND final_tp IS NOT NULL
      AND final_sl IS NOT NULL
      AND created_at < NOW() - INTERVAL '5 minutes'
    ORDER BY created_at ASC
    LIMIT 500
  `
  return rows as Signal[]
}

export async function expireOldSignals(): Promise<number> {
  const [r1, r2] = await Promise.all([
    sql`
      UPDATE signals SET outcome = 'expired', actual_pnl_pct = NULL
      WHERE outcome IS NULL
        AND final_verdict IN ('LONG', 'SHORT')
        AND created_at < NOW() - INTERVAL '7 days'
      RETURNING id
    `,
    sql`
      DELETE FROM signals
      WHERE final_verdict = 'WAIT'
        AND created_at < NOW() - INTERVAL '24 hours'
    `,
  ])
  return r1.length
}

export async function getDrawings(userId: number, pair: string, timeframe: string): Promise<unknown[]> {
  const rows = await sql`
    SELECT drawings FROM chart_drawings
    WHERE user_id = ${userId} AND pair = ${pair} AND timeframe = ${timeframe}
    LIMIT 1
  `
  return rows[0] ? (rows[0].drawings as unknown[]) : []
}

export async function saveDrawings(userId: number, pair: string, timeframe: string, drawings: unknown[]) {
  await sql`
    INSERT INTO chart_drawings (user_id, pair, timeframe, drawings, updated_at)
    VALUES (${userId}, ${pair}, ${timeframe}, ${JSON.stringify(drawings)}, NOW())
    ON CONFLICT (user_id, pair, timeframe)
    DO UPDATE SET drawings = ${JSON.stringify(drawings)}, updated_at = NOW()
  `
}

export async function adjustBalance(userId: number, delta: number): Promise<number> {
  const rows = await sql`
    UPDATE users SET ai_balance = GREATEST(0, ai_balance + ${delta})
    WHERE id = ${userId}
    RETURNING ai_balance::float
  `
  return Number(rows[0]?.ai_balance ?? 0)
}

export async function updateUserSettings(userId: number, data: {
  nickname?: string; email?: string; lang?: string
  ai_max_leverage?: number
  ai_balance?: number; ai_trade_amount?: number
  signal_direction?: string
}) {
  await sql`
    UPDATE users SET
      nickname          = COALESCE(${data.nickname ?? null}, nickname),
      email             = COALESCE(${data.email ?? null}, email),
      lang              = COALESCE(${data.lang ?? null}, lang),
      ai_max_leverage   = COALESCE(${data.ai_max_leverage ?? null}, ai_max_leverage),
      ai_balance        = COALESCE(${data.ai_balance ?? null}, ai_balance),
      ai_trade_amount   = COALESCE(${data.ai_trade_amount ?? null}, ai_trade_amount),
      signal_direction  = COALESCE(${data.signal_direction ?? null}, signal_direction)
    WHERE id = ${userId}
  `
}

export async function getMarketTrend(): Promise<'bullish' | 'bearish' | 'neutral'> {
  try {
    const r = await fetch('https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1d&limit=14', { signal: AbortSignal.timeout(6000) })
    if (!r.ok) return 'neutral'
    const data: number[][] = await r.json()
    if (data.length < 7) return 'neutral'
    const closes = data.map(c => parseFloat(String(c[4])))
    const first7avg = closes.slice(0, 7).reduce((a, b) => a + b, 0) / 7
    const last7avg  = closes.slice(7).reduce((a, b) => a + b, 0) / closes.slice(7).length
    const pct = (last7avg - first7avg) / first7avg * 100
    if (pct > 3) return 'bullish'
    if (pct < -3) return 'bearish'
    return 'neutral'
  } catch { return 'neutral' }
}

export async function getSubscription(userId: number): Promise<Subscription> {
  const rows = await sql`
    SELECT * FROM subscriptions WHERE user_id = ${userId} LIMIT 1
  `
  if (rows[0]) return rows[0] as Subscription
  const created = await sql`
    INSERT INTO subscriptions (user_id, tier, analyses_today, last_reset_date)
    VALUES (${userId}, 'free', 0, CURRENT_DATE)
    ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
    RETURNING *
  `
  return created[0] as Subscription
}

export async function checkAndIncrementAnalysis(userId: number): Promise<{ allowed: boolean; remaining: number; tier: string; limit: number }> {
  await getSubscription(userId)

  const todayUtc = new Date().toISOString().slice(0, 10)

  const rows = await sql`
    UPDATE subscriptions
    SET
      analyses_today = CASE WHEN last_reset_date < ${todayUtc}::date THEN 1 ELSE analyses_today + 1 END,
      last_reset_date = ${todayUtc}::date
    WHERE user_id = ${userId}
      AND (last_reset_date < ${todayUtc}::date OR analyses_today < (
        CASE tier
          WHEN 'starter' THEN 10
          WHEN 'pro'     THEN 30
          WHEN 'elite'   THEN 999
          ELSE 3
        END
      ))
    RETURNING tier, analyses_today
  `

  if (rows.length === 0) {
    const sub = await getSubscription(userId)
    const limit = SUBSCRIPTION_LIMITS[sub.tier] ?? 3
    return { allowed: false, remaining: 0, tier: sub.tier, limit }
  }

  const tier  = String(rows[0].tier)
  const count = Number(rows[0].analyses_today)
  const limit = SUBSCRIPTION_LIMITS[tier] ?? 3
  return { allowed: true, remaining: Math.max(0, limit - count), tier, limit }
}

export async function updateSubscriptionTier(userId: number, tier: string, expiresAt?: Date) {
  await sql`
    INSERT INTO subscriptions (user_id, tier, analyses_today, last_reset_date, expires_at)
    VALUES (${userId}, ${tier}, 0, CURRENT_DATE, ${expiresAt ?? null})
    ON CONFLICT (user_id) DO UPDATE SET
      tier = EXCLUDED.tier,
      expires_at = EXCLUDED.expires_at,
      analyses_today = 0,
      last_reset_date = CURRENT_DATE
  `
}

export async function getPendingTrades(userId: number): Promise<Trade[]> {
  const rows = await sql`
    SELECT * FROM trades
    WHERE user_id = ${userId} AND status = 'pending'
    ORDER BY created_at DESC
  `
  return rows as Trade[]
}

export async function getAllPendingTrades(): Promise<Trade[]> {
  const rows = await sql`
    SELECT * FROM trades
    WHERE status = 'pending'
    ORDER BY created_at DESC
    LIMIT 200
  `
  return rows as Trade[]
}

export async function getAllOpenTrades(): Promise<Trade[]> {
  const rows = await sql`
    SELECT * FROM trades
    WHERE status = 'open'
      AND tp_price IS NOT NULL
      AND sl_price IS NOT NULL
      AND entry_price IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 500
  `
  return rows as Trade[]
}

export async function activateTrade(id: number, userId: number, entryPrice: number): Promise<boolean> {
  const rows = await sql`
    UPDATE trades SET
      status = 'open',
      entry_price = ${entryPrice},
      created_at = CASE WHEN account_type = 'ai' THEN NOW() ELSE created_at END
    WHERE id = ${id} AND user_id = ${userId} AND status = 'pending'
    RETURNING id
  `
  return rows.length > 0
}

export async function cancelTrade(id: number, userId: number): Promise<boolean> {
  const rows = await sql`
    UPDATE trades SET status = 'cancelled', closed_at = NOW()
    WHERE id = ${id} AND user_id = ${userId} AND status = 'pending'
    RETURNING id
  `
  return rows.length > 0
}

export async function deleteUserById(userId: number) {
  await sql`DELETE FROM notifications WHERE user_id = ${userId}`
  await sql`DELETE FROM level_alerts  WHERE user_id = ${userId}`
  await sql`DELETE FROM trades        WHERE user_id = ${userId}`
  await sql`DELETE FROM signals       WHERE user_id = ${userId}`
  await sql`DELETE FROM subscriptions WHERE user_id = ${userId}`
  await sql`DELETE FROM users         WHERE id      = ${userId}`
}

export async function getUserByTelegramChatId(chatId: string): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE telegram_chat_id = ${chatId} LIMIT 1`
  return (rows[0] as User) || null
}

export async function updateUserTelegramChatId(userId: number, chatId: string): Promise<void> {
  await sql`UPDATE users SET telegram_chat_id = ${chatId} WHERE id = ${userId}`
}

export async function updateAutoAnalyzePaused(userId: number, paused: boolean): Promise<void> {
  await sql`UPDATE users SET auto_analyze_paused = ${paused} WHERE id = ${userId}`
}

export async function getUserWatchlist(userId: number): Promise<string[] | null> {
  const rows = await sql`SELECT watchlist FROM users WHERE id = ${userId} LIMIT 1`
  if (!rows[0]) return null
  const raw = rows[0].watchlist
  if (!raw) return null
  return Array.isArray(raw) ? (raw as string[]) : null
}

export async function updateUserWatchlist(userId: number, pairs: string[]): Promise<void> {
  await sql`UPDATE users SET watchlist = ${JSON.stringify(pairs)}::jsonb WHERE id = ${userId}`
}

export async function getAllUsersWithSubscriptions() {
  const rows = await sql`
    SELECT u.id, u.firebase_uid, u.email, u.nickname, u.lang, u.created_at,
           s.tier, s.analyses_today, s.last_reset_date, s.expires_at
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id
    ORDER BY u.created_at DESC
  `
  return rows
}

export async function getAdminStats() {
  const [totals] = await sql`
    SELECT
      COUNT(DISTINCT u.id) AS total_users,
      COUNT(DISTINCT s.id) FILTER (WHERE s.tier = 'free')    AS free_users,
      COUNT(DISTINCT s.id) FILTER (WHERE s.tier = 'starter') AS starter_users,
      COUNT(DISTINCT s.id) FILTER (WHERE s.tier = 'pro')     AS pro_users,
      COUNT(DISTINCT s.id) FILTER (WHERE s.tier = 'elite')   AS elite_users,
      COUNT(DISTINCT sig.id) AS total_signals,
      COUNT(DISTINCT t.id)   AS total_trades
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id
    LEFT JOIN signals sig ON sig.user_id = u.id
    LEFT JOIN trades t ON t.user_id = u.id
  `
  return totals
}

export async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      firebase_uid TEXT UNIQUE NOT NULL,
      email TEXT,
      nickname TEXT,
      lang TEXT DEFAULT 'ru',
      ai_trade_amount NUMERIC DEFAULT 100,
      ai_max_leverage INTEGER DEFAULT 20,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_max_leverage INTEGER DEFAULT 20`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_balance NUMERIC DEFAULT 10000`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_trade_amount NUMERIC DEFAULT 100`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS watchlist JSONB`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_analyze_paused BOOLEAN DEFAULT FALSE`
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
      limit_price NUMERIC,
      expires_at TIMESTAMPTZ,
      account_type TEXT DEFAULT 'user',
      pnl NUMERIC,
      pnl_pct NUMERIC,
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'user'`
  await sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS limit_price NUMERIC`
  await sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`
  await sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS exit_price NUMERIC`
  await sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS timeframe TEXT`
  await sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS market TEXT NOT NULL DEFAULT 'crypto'`
  await sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS signal_id INTEGER`
  await sql`ALTER TABLE signals ADD COLUMN IF NOT EXISTS market TEXT NOT NULL DEFAULT 'crypto'`
  await sql`
    CREATE TABLE IF NOT EXISTS chart_drawings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      pair TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      drawings JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, pair, timeframe)
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
  await sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) UNIQUE NOT NULL,
      tier TEXT DEFAULT 'free',
      analyses_today INTEGER DEFAULT 0,
      last_reset_date DATE DEFAULT CURRENT_DATE,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cryptomus_subscription_id TEXT`
  await sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cryptomus_order_id TEXT`
  await sql`
    CREATE TABLE IF NOT EXISTS level_alerts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      pair TEXT NOT NULL,
      zone_type TEXT NOT NULL,
      price_high NUMERIC NOT NULL,
      price_low NUMERIC NOT NULL,
      label TEXT,
      is_triggered BOOLEAN DEFAULT FALSE,
      triggered_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
}
