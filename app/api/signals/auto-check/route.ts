export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getAllPendingSignals, getAllPendingTrades, getAllOpenTrades, expireOldSignals, setSignalOutcome, activateTrade, cancelTrade, closeTrade, adjustBalance, createNotification, getUserById, normalizeTf, getMarketTrend, sql } from '@/lib/db'
import { sendTelegram, sendTelegramToUser } from '@/lib/telegram'

const INTERVAL_MS: Record<string, number> = {
  '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000,
  '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000,
}

async function fetchCandles(sym: string, sinceMs: number, interval = '1h'): Promise<{ candles: { high: number; low: number; openTime: number }[]; startMs: number }> {
  const candleMs = INTERVAL_MS[interval] ?? 3_600_000
  const startMs = Math.max(sinceMs, Date.now() - 196 * candleMs)
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&startTime=${startMs}&limit=200`
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    if (!res.ok) return { candles: [], startMs }
    const raw: number[][] = await res.json()
    return { candles: raw.map(c => ({ openTime: Number(c[0]), high: parseFloat(String(c[2])), low: parseFloat(String(c[3])) })), startMs }
  } catch {
    return { candles: [], startMs }
  }
}

async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
  try {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/ticker/price?symbols=${encodeURIComponent(JSON.stringify(symbols))}`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return {}
    const data: { symbol: string; price: string }[] = await res.json()
    const map: Record<string, number> = {}
    for (const d of data) map[d.symbol] = parseFloat(d.price)
    return map
  } catch {
    return {}
  }
}

const HOUR_MS = 3_600_000

function groupBySymbolTf<T extends { pair: string; timeframe?: string | null }>(items: T[]): Record<string, T[]> {
  const result: Record<string, T[]> = {}
  for (const item of items) {
    const sym = item.pair.replace('/', '')
    const tf  = normalizeTf(item.timeframe || '1h')
    const key = `${sym}|${tf}`
    if (!result[key]) result[key] = []
    result[key].push(item)
  }
  return result
}

function scanTpSl(
  slice: { high: number; low: number }[],
  tp: number, sl: number, isLong: boolean,
): 'tp' | 'sl' | null {
  for (const c of slice) {
    const hitTp = isLong ? c.high >= tp : c.low  <= tp
    const hitSl = isLong ? c.low  <= sl : c.high >= sl
    if (hitTp && hitSl) return 'sl'
    if (hitTp) return 'tp'
    if (hitSl) return 'sl'
  }
  return null
}

function findEntryTouchIdx(
  slice: { high: number; low: number }[],
  entry: number, isLong: boolean,
): number {
  for (let i = 0; i < slice.length; i++) {
    const c = slice[i]
    const touched = isLong ? c.low <= entry : c.high >= entry
    if (touched) return i
  }
  return -1
}

function getEntryType(signal: { raw_response: Record<string, unknown> | null }): 'market' | 'limit' {
  const raw = signal.raw_response
  if (!raw) return 'market'
  const final = (raw.final || raw.analysis) as Record<string, unknown> | undefined
  return final?.entry_type === 'limit' ? 'limit' : 'market'
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.AUTO_ANALYZE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const userCache: Record<number, { telegram_chat_id?: string | null }> = {}
  async function getTgChatId(userId: number): Promise<string> {
    if (!userCache[userId]) userCache[userId] = (await getUserById(userId)) ?? {}
    return String(userCache[userId].telegram_chat_id || '')
  }

  const expired = await expireOldSignals()

  const [pending, pendingTrades] = await Promise.all([
    getAllPendingSignals(),
    getAllPendingTrades(),
  ])

  let signalsUpdated = 0
  let tradesActivated = 0
  let tradesCancelled = 0
  let tradesClosedTp = 0
  let tradesClosedSl = 0

  if (pending.length) {
    const bySymbolTf: Record<string, typeof pending> = {}
    for (const s of pending) {
      const sym = s.pair.replace('/', '')
      const interval = normalizeTf(s.timeframe)
      const key = `${sym}|${interval}`
      if (!bySymbolTf[key]) bySymbolTf[key] = []
      bySymbolTf[key].push(s)
    }

    for (const key of Object.keys(bySymbolTf)) {
      const [sym, interval] = key.split('|')
      const signals  = bySymbolTf[key]
      const candleMs = INTERVAL_MS[interval] ?? HOUR_MS
      const oldestMs = Math.min(...signals.map(s => new Date(s.created_at).getTime()))
      const { candles, startMs } = await fetchCandles(sym, oldestMs, interval)
      if (!candles.length) continue

      for (const signal of signals) {
        if (!signal.final_tp || !signal.final_sl || !signal.final_entry || !signal.final_verdict) continue

        const sigStartMs = new Date(signal.created_at).getTime()
        const startIdx   = Math.max(0, Math.floor((sigStartMs - startMs) / candleMs))
        const slice      = candles.slice(startIdx)
        if (!slice.length) continue

        const isLong   = signal.final_verdict === 'LONG'
        const tp       = Number(signal.final_tp)
        const sl       = Number(signal.final_sl)
        const entry    = Number(signal.final_entry)
        const leverage = Number(signal.final_leverage ?? 1)
        if (!Number.isFinite(tp) || !Number.isFinite(sl) || !Number.isFinite(entry)) continue

        let scanSlice = slice
        if (getEntryType(signal) === 'limit') {
          const touchIdx = findEntryTouchIdx(slice, entry, isLong)
          if (touchIdx === -1) continue
          scanSlice = slice.slice(touchIdx)
        }

        const hit = scanTpSl(scanSlice, tp, sl, isLong)
        if (!hit) continue

        const outcome: 'win' | 'loss' = hit === 'tp' ? 'win' : 'loss'
        const hitPrice = hit === 'tp' ? tp : sl
        const diff     = isLong ? hitPrice - entry : entry - hitPrice
        const pnlPct   = parseFloat(((diff / entry) * leverage * 100).toFixed(2))

        const outcomeRows = await setSignalOutcome(signal.id, outcome, pnlPct, signal.user_id)
        if (!outcomeRows.length) continue

        const staleLimitTrades = await sql`
          SELECT id, amount FROM trades
          WHERE user_id = ${signal.user_id} AND pair = ${signal.pair}
            AND account_type = 'ai' AND status = 'pending'
            AND (signal_id = ${signal.id} OR expires_at < NOW())
            AND created_at > NOW() - INTERVAL '8 days'
        `
        for (const t of staleLimitTrades) {
          await cancelTrade(t.id, signal.user_id)
          await adjustBalance(signal.user_id, Number(t.amount))
          await sql`DELETE FROM trades WHERE id = ${t.id}`
        }

        const hasTrade = await sql`
          SELECT id FROM trades
          WHERE user_id = ${signal.user_id} AND pair = ${signal.pair}
            AND account_type = 'ai'
            AND (closed_at > NOW() - INTERVAL '24 hours' OR status IN ('open', 'pending'))
          LIMIT 1
        `
        if (!hasTrade.length) {
          const emoji    = outcome === 'win' ? '✅' : '❌'
          const pnlStr   = pnlPct >= 0 ? `+${pnlPct}%` : `${pnlPct}%`
          const prec     = entry >= 100 ? 2 : 4
          const entryStr = entry.toFixed(prec)
          const hitStr   = hitPrice.toFixed(prec)
          const label    = hit === 'tp' ? 'TP' : 'SL'
          const tgMsg    = `${emoji} <b>${signal.final_verdict} ${signal.pair}</b> ${signal.timeframe}\n`
            + `Entry: $${entryStr} → ${label}: $${hitStr}\n`
            + `Result: <b>${pnlStr}</b>`
          const tgChatId = await getTgChatId(signal.user_id)
          await Promise.allSettled([
            tgChatId ? sendTelegramToUser(tgChatId, tgMsg) : sendTelegram(tgMsg),
            createNotification(signal.user_id, `${emoji} ${signal.final_verdict} ${signal.pair} ${signal.timeframe} — ${label} (${pnlStr})`),
          ])
        }

        signalsUpdated++
      }
    }
  }

  if (pendingTrades.length) {
    const symbols = Array.from(new Set(pendingTrades.map(t => t.pair.replace('/', ''))))
    const prices = await fetchPrices(symbols)
    const now = Date.now()

    for (const trade of pendingTrades) {
      const sym = trade.pair.replace('/', '')

      if (trade.expires_at && new Date(trade.expires_at).getTime() < now) {
        const wasCancelled = await cancelTrade(trade.id, trade.user_id)
        if (wasCancelled) {
          if (trade.account_type === 'ai') await adjustBalance(trade.user_id, Number(trade.amount))
          // автоудаление отменённых сделок из истории
          await sql`DELETE FROM trades WHERE id = ${trade.id}`
          const tgChatId = await getTgChatId(trade.user_id)
          await Promise.allSettled([
            tgChatId ? sendTelegramToUser(tgChatId, `🗑️ Limit order <b>${trade.direction.toUpperCase()} ${trade.pair}</b> cancelled (expired)`) : sendTelegram(`🗑️ ${trade.pair} cancelled`),
            createNotification(trade.user_id, `🗑️ Limit order ${trade.direction.toUpperCase()} ${trade.pair} cancelled (expired)`),
          ])
          tradesCancelled++
        }
        continue
      }

      if (!trade.limit_price) continue
      const currentPrice = prices[sym]
      if (!currentPrice) continue

      const limitHit = trade.direction === 'long'
        ? currentPrice <= trade.limit_price
        : currentPrice >= trade.limit_price

      if (limitHit) {
        const wasActivated = await activateTrade(trade.id, trade.user_id, trade.limit_price)
        if (wasActivated) {
          const msg = `✅ <b>Limit order executed!</b>\n${trade.direction.toUpperCase()} ${trade.pair} @ $${trade.limit_price}`
          const tgChatId = await getTgChatId(trade.user_id)
          await Promise.allSettled([
            tgChatId ? sendTelegramToUser(tgChatId, msg) : sendTelegram(msg),
            createNotification(trade.user_id, `✅ Limit order executed! ${trade.direction.toUpperCase()} ${trade.pair} @ $${trade.limit_price}`),
          ])
          tradesActivated++
        }
      }
    }
  }

  const openTrades = await getAllOpenTrades()

  if (openTrades.length) {
    const bySymbolTf = groupBySymbolTf(openTrades)

    for (const key of Object.keys(bySymbolTf)) {
      const [sym, interval] = key.split('|')
      const group    = bySymbolTf[key]
      const candleMs = INTERVAL_MS[interval] ?? HOUR_MS
      const oldestMs = Math.min(...group.map(t => new Date(t.created_at).getTime()))
      const { candles, startMs } = await fetchCandles(sym, oldestMs, interval)
      if (!candles.length) continue

      for (const trade of group) {
        if (!trade.tp_price || !trade.sl_price || !trade.entry_price) continue
        const tp     = Number(trade.tp_price)
        const sl     = Number(trade.sl_price)
        const entry  = Number(trade.entry_price)
        const amount = Number(trade.amount) || 0
        const lev    = Number(trade.leverage) || 1
        const isLong = trade.direction === 'long'
        if (!Number.isFinite(tp) || !Number.isFinite(sl) || !Number.isFinite(entry)) continue

        const tradeStartMs = new Date(trade.created_at).getTime()
        const startIdx     = Math.max(0, Math.floor((tradeStartMs - startMs) / candleMs))
        const slice        = candles.slice(startIdx)
        if (!slice.length) continue

        const hit = scanTpSl(slice, tp, sl, isLong)
        if (!hit) continue

        const hitPrice = hit === 'tp' ? tp : sl
        const diff     = isLong ? hitPrice - entry : entry - hitPrice
        const pnlPct   = parseFloat(((diff / entry) * lev * 100).toFixed(2))
        const pnlUsd   = parseFloat(((amount * pnlPct) / 100).toFixed(2))

        const wasClosed = await closeTrade(trade.id, trade.user_id, pnlUsd, pnlPct, hitPrice)
        if (!wasClosed) continue

        if (trade.account_type === 'ai') {
          await adjustBalance(trade.user_id, Math.max(0, amount + pnlUsd))
        }

        const emoji   = hit === 'tp' ? '✅' : '❌'
        const pnlStr  = pnlPct >= 0 ? `+${pnlPct}%` : `${pnlPct}%`
        const usdStr  = pnlUsd >= 0 ? `+$${pnlUsd.toFixed(2)}` : `-$${Math.abs(pnlUsd).toFixed(2)}`
        const hitPriceStr = hitPrice.toFixed(entry >= 100 ? 2 : 4)
        const entryStr    = entry.toFixed(entry >= 100 ? 2 : 4)
        const msg    = `${emoji} <b>AUTO ${trade.direction.toUpperCase()} ${trade.pair}</b> × ${trade.leverage}x\n`
          + `Entry: $${entryStr} → ${hit === 'tp' ? 'TP' : 'SL'}: $${hitPriceStr}\n`
          + `Result: <b>${pnlStr}</b> (${usdStr})`

        const tgChatId = await getTgChatId(trade.user_id)
        await Promise.allSettled([
          tgChatId ? sendTelegramToUser(tgChatId, msg) : sendTelegram(msg),
          createNotification(trade.user_id, `${emoji} AUTO ${trade.direction.toUpperCase()} ${trade.pair} — ${hit === 'tp' ? 'TP' : 'SL'} (${pnlStr})`),
        ])

        if (hit === 'tp') tradesClosedTp++
        else              tradesClosedSl++
      }
    }
  }

  // Авто-переключение направления по тренду BTC (только если пользователь не менял вручную)
  try {
    const trend = await getMarketTrend()
    const autoDir = trend === 'bullish' ? 'long' : trend === 'bearish' ? 'short' : 'both'
    await sql`
      UPDATE users SET signal_direction = ${autoDir}
      WHERE signal_direction IS NULL OR signal_direction = 'both'
        OR signal_direction IN ('long','short','both')
    `
  } catch {}

  return NextResponse.json({
    ok: true,
    expired,
    signals: { checked: pending.length, updated: signalsUpdated },
    trades:  {
      checked: pendingTrades.length, activated: tradesActivated, cancelled: tradesCancelled,
      open: openTrades.length, closedTp: tradesClosedTp, closedSl: tradesClosedSl,
    },
  })
}
