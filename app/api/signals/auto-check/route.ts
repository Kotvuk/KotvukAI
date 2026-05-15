export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getAllPendingSignals, getAllPendingTrades, getAllOpenTrades, expireOldSignals, setSignalOutcome, activateTrade, cancelTrade, closeTrade, adjustBalance, createNotification, getUserById } from '@/lib/db'
import { sendTelegram, sendTelegramToUser } from '@/lib/telegram'

async function fetchCandles(sym: string, sinceMs: number): Promise<{ high: number; low: number }[]> {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=1h&startTime=${sinceMs}&limit=200`
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    if (!res.ok) return []
    const raw: number[][] = await res.json()
    return raw.map(c => ({ high: parseFloat(String(c[2])), low: parseFloat(String(c[3])) }))
  } catch {
    return []
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
    const pairGroups: Record<string, typeof pending> = {}
    for (const sig of pending) {
      const key = sig.pair.replace('/', '')
      if (!pairGroups[key]) pairGroups[key] = []
      pairGroups[key].push(sig)
    }

    for (const sym of Object.keys(pairGroups)) {
      const signals = pairGroups[sym]
      const oldestMs = Math.min(...signals.map(s => new Date(s.created_at).getTime()))
      const candles  = await fetchCandles(sym, oldestMs)
      if (!candles.length) continue

      const hourMs = 3_600_000

      for (const signal of signals) {
        if (!signal.final_tp || !signal.final_sl || !signal.final_entry || !signal.final_verdict) continue

        const sigStartMs = new Date(signal.created_at).getTime()
        const startIdx   = Math.max(0, Math.floor((sigStartMs - oldestMs) / hourMs))
        const slice      = candles.slice(startIdx)
        if (!slice.length) continue

        const isLong   = signal.final_verdict === 'LONG'
        const tp       = signal.final_tp
        const sl       = signal.final_sl
        const entry    = signal.final_entry
        const leverage = signal.final_leverage ?? 1

        let hitTp = false
        let hitSl = false

        for (const c of slice) {
          if (hitTp || hitSl) break
          if (isLong) {
            if (c.high >= tp) { hitTp = true; break }
            if (c.low  <= sl) { hitSl = true; break }
          } else {
            if (c.low  <= tp) { hitTp = true; break }
            if (c.high >= sl) { hitSl = true; break }
          }
        }

        if (!hitTp && !hitSl) continue

        const outcome: 'win' | 'loss' = hitTp ? 'win' : 'loss'
        const hitPrice = hitTp ? tp : sl
        const diff     = isLong ? hitPrice - entry : entry - hitPrice
        const pnlPct   = parseFloat(((diff / entry) * leverage * 100).toFixed(2))

        await setSignalOutcome(signal.id, outcome, pnlPct, signal.user_id)

        const emoji  = outcome === 'win' ? '✅' : '❌'
        const pnlStr = pnlPct >= 0 ? `+${pnlPct}%` : `${pnlPct}%`
        const tgMsg  = `${emoji} <b>${signal.final_verdict} ${signal.pair}</b> [${signal.timeframe}]\n`
          + `${outcome === 'win' ? 'TP достигнут' : 'SL пробит'} — <b>${pnlStr}</b>`
        const tgChatId = await getTgChatId(signal.user_id)
        await Promise.allSettled([
          tgChatId ? sendTelegramToUser(tgChatId, tgMsg) : sendTelegram(tgMsg),
          createNotification(signal.user_id, `${emoji} ${signal.final_verdict} ${signal.pair} ${signal.timeframe} — ${outcome === 'win' ? 'TP' : 'SL'} (${pnlStr})`),
        ])

        signalsUpdated++
      }
    }
  }

  if (pendingTrades.length) {
    const symbols = Array.from(new Set(pendingTrades.map(t => t.pair.replace('/', ''))))
    const priceMap = await fetchPrices(symbols)
    const now = Date.now()

    for (const trade of pendingTrades) {
      const sym = trade.pair.replace('/', '')

      if (trade.expires_at && new Date(trade.expires_at).getTime() < now) {
        const wasCancelled = await cancelTrade(trade.id, trade.user_id)
        if (wasCancelled) {
          await adjustBalance(trade.user_id, Number(trade.amount))
          const msg = `🗑️ Лимитный ордер <b>${trade.direction.toUpperCase()} ${trade.pair}</b> отменён — истёк срок (7 дней)`
          const tgChatId = await getTgChatId(trade.user_id)
          await Promise.allSettled([
            tgChatId ? sendTelegramToUser(tgChatId, msg) : sendTelegram(msg),
            createNotification(trade.user_id, `🗑️ Лимитный ордер ${trade.direction.toUpperCase()} ${trade.pair} отменён (истёк срок)`),
          ])
          tradesCancelled++
        }
        continue
      }

      if (!trade.limit_price) continue
      const currentPrice = priceMap[sym]
      if (!currentPrice) continue

      const limitHit = trade.direction === 'long'
        ? currentPrice <= trade.limit_price
        : currentPrice >= trade.limit_price

      if (limitHit) {
        const wasActivated = await activateTrade(trade.id, trade.user_id, trade.limit_price)
        if (wasActivated) {
          const msg = `✅ <b>Лимитный ордер исполнен!</b>\n${trade.direction.toUpperCase()} ${trade.pair} по $${trade.limit_price}`
          const tgChatId = await getTgChatId(trade.user_id)
          await Promise.allSettled([
            tgChatId ? sendTelegramToUser(tgChatId, msg) : sendTelegram(msg),
            createNotification(trade.user_id, `✅ Лимитный ордер исполнен! ${trade.direction.toUpperCase()} ${trade.pair} по $${trade.limit_price}`),
          ])
          tradesActivated++
        }
      }
    }
  }

  const openTrades = await getAllOpenTrades()

  if (openTrades.length) {
    const tradeGroups: Record<string, typeof openTrades> = {}
    for (const t of openTrades) {
      const sym = t.pair.replace('/', '')
      if (!tradeGroups[sym]) tradeGroups[sym] = []
      tradeGroups[sym].push(t)
    }

    const hourMs = 3_600_000

    for (const sym of Object.keys(tradeGroups)) {
      const group = tradeGroups[sym]
      const oldestMs = Math.min(...group.map(t => new Date(t.created_at).getTime()))
      const candles  = await fetchCandles(sym, oldestMs)
      if (!candles.length) continue

      for (const trade of group) {
        const tp    = trade.tp_price!
        const sl    = trade.sl_price!
        const entry = trade.entry_price!
        const isLong = trade.direction === 'long'

        const tradeStartMs = new Date(trade.created_at).getTime()
        const startIdx     = Math.max(0, Math.floor((tradeStartMs - oldestMs) / hourMs))
        const slice        = candles.slice(startIdx)
        if (!slice.length) continue

        let hitTp = false
        let hitSl = false

        for (const c of slice) {
          if (hitTp || hitSl) break
          if (isLong) {
            if (c.high >= tp) { hitTp = true; break }
            if (c.low  <= sl) { hitSl = true; break }
          } else {
            if (c.low  <= tp) { hitTp = true; break }
            if (c.high >= sl) { hitSl = true; break }
          }
        }

        if (!hitTp && !hitSl) continue

        const hitPrice = hitTp ? tp : sl
        const diff     = isLong ? hitPrice - entry : entry - hitPrice
        const pnlPct   = parseFloat(((diff / entry) * trade.leverage * 100).toFixed(2))
        const pnlUsd   = parseFloat(((trade.amount * pnlPct) / 100).toFixed(2))

        const wasClosed = await closeTrade(trade.id, trade.user_id, pnlUsd, pnlPct)
        if (!wasClosed) continue

        if (trade.account_type === 'ai') {
          await adjustBalance(trade.user_id, trade.amount + pnlUsd)
        }

        const emoji  = hitTp ? '✅' : '❌'
        const pnlStr = pnlPct >= 0 ? `+${pnlPct}%` : `${pnlPct}%`
        const usdStr = pnlUsd >= 0 ? `+$${pnlUsd.toFixed(2)}` : `-$${Math.abs(pnlUsd).toFixed(2)}`
        const msg    = `${emoji} <b>AUTO ${trade.direction.toUpperCase()} ${trade.pair}</b>\n`
          + `${hitTp ? 'TP достигнут' : 'SL пробит'} — <b>${pnlStr}</b> (${usdStr})`

        const tgChatId = await getTgChatId(trade.user_id)
        await Promise.allSettled([
          tgChatId ? sendTelegramToUser(tgChatId, msg) : sendTelegram(msg),
          createNotification(trade.user_id, `${emoji} AUTO ${trade.direction.toUpperCase()} ${trade.pair} — ${hitTp ? 'TP' : 'SL'} (${pnlStr})`),
        ])

        if (hitTp) tradesClosedTp++
        else       tradesClosedSl++
      }
    }
  }

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
