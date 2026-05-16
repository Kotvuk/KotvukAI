export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { fullAnalysis, calcMarketData, type Candle } from '@/lib/analysis'
import { calcEnhancedSMC } from '@/lib/smc'
import { sql, saveSignal, createTrade, createNotification, getUserWatchlist, getSignalsForPair, adjustBalance } from '@/lib/db'
import { sendTelegram, sendTelegramToUser } from '@/lib/telegram'
import { DEFAULT_WATCHLIST } from '@/lib/pairs'

const HTF_MAP: Record<string, string> = {
  '5m': '1h', '15m': '4h', '1h': '1d', '4h': '1d',
}

async function priceSortedWatchlist(symbols: string[]): Promise<string[]> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 5_000)
    const res = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex', { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return symbols
    const data: Array<{ symbol: string; markPrice?: string }> = await res.json()
    const pm: Record<string, number> = {}
    for (const d of data) if (d.symbol && d.markPrice) pm[d.symbol] = parseFloat(d.markPrice)
    return [...symbols].sort((a, b) => (pm[b] ?? -1) - (pm[a] ?? -1))
  } catch {
    return symbols
  }
}

function toCandles(rows: number[][]): Candle[] {
  return rows.map(c => ({
    timestamp: c[0],
    open: parseFloat(String(c[1])),
    high: parseFloat(String(c[2])),
    low: parseFloat(String(c[3])),
    close: parseFloat(String(c[4])),
    volume: parseFloat(String(c[5])),
  }))
}

async function analyzeOne(
  sym: string,
  user: Record<string, any>,
  interval = '1h',
): Promise<{ ok: boolean; verdict?: string; confidence?: number; error?: string }> {
  const htfInterval = HTF_MAP[interval] || '1d'

  try {
    const [binanceRes, htfRes, frRes] = await Promise.allSettled([
      fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=200`),
      fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${htfInterval}&limit=100`),
      fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=1`),
    ])

    if (binanceRes.status !== 'fulfilled' || !binanceRes.value.ok) {
      return { ok: false, error: `Binance error for ${sym}` }
    }

    const raw: number[][] = await binanceRes.value.json()
    if (!Array.isArray(raw) || raw.length === 0) {
      return { ok: false, error: `No candles for ${sym}` }
    }

    const candles = toCandles(raw)

    let htfBias: string | undefined
    if (htfRes.status === 'fulfilled' && htfRes.value.ok) {
      try {
        const htfRaw: number[][] = await htfRes.value.json()
        if (Array.isArray(htfRaw) && htfRaw.length > 0) {
          htfBias = calcEnhancedSMC(toCandles(htfRaw), null).htfBias
        }
      } catch { htfBias = undefined }
    }

    let fundingRate: number | null = null
    if (frRes.status === 'fulfilled' && frRes.value.ok) {
      try {
        const fd: { fundingRate?: string }[] = await frRes.value.json()
        if (fd[0]?.fundingRate) fundingRate = parseFloat(fd[0].fundingRate) * 100
      } catch {}
    }

    const market = calcMarketData(candles, fundingRate)
    if (htfBias) market.htfBias = htfBias

    const balance  = Number(user.ai_balance ?? 1000)
    const riskPct  = Number(user.ai_risk_per_trade ?? 1.0)
    const maxLev   = Number(user.ai_max_leverage ?? 20)
    const userId   = Number(user.id)
    const tfLabel  = interval === '1h' ? '1ч' : interval === '4h' ? '4ч' : interval

    const memorySignals = await getSignalsForPair(userId, sym, 5)
    const { step1, step2, final } = await fullAnalysis(sym, tfLabel, market, candles, memorySignals, maxLev, balance, riskPct)

    await saveSignal(userId, {
      pair: sym, timeframe: tfLabel,
      final_verdict:    final.verdict,
      final_confidence: final.confidence,
      final_entry:      final.entry_price || null,
      final_tp:         final.tp_price || null,
      final_sl:         final.sl_price || null,
      final_leverage:   final.leverage,
      final_risk_score: final.risk_score,
      raw_response: {
        final,
        market: { price: market.price, rsi: market.rsi, atr14pct: market.atr14pct },
        pipeline: { step1, step2 },
      },
    })

    if ((final.verdict === 'LONG' || final.verdict === 'SHORT') && final.confidence >= 60) {
      const existing = await sql`
        SELECT id FROM trades
        WHERE user_id = ${userId} AND pair = ${sym}
          AND direction = ${final.verdict.toLowerCase()}
          AND status IN ('pending', 'open') AND account_type = 'ai'
        LIMIT 1
      `
      if (existing.length > 0) {
        return { ok: true, verdict: final.verdict, confidence: final.confidence }
      }

      const slDist = (final.sl_price && final.entry_price)
        ? Math.abs(final.entry_price - final.sl_price) / final.entry_price
        : 0.02
      const riskUsd     = balance * riskPct / 100
      const rawAmount   = final.pos_usd || Math.round(riskUsd / Math.max(slDist, 0.001))
      const tradeAmount = Math.min(Math.round(rawAmount), Math.round(balance * maxLev))

      if (tradeAmount <= 0 || balance <= 0) {
        return { ok: true, verdict: final.verdict, confidence: final.confidence }
      }
      const isLimit     = final.entry_type === 'limit'
      const expiresAt   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      await createTrade(userId, {
        pair:        sym,
        direction:   final.verdict.toLowerCase() as 'long' | 'short',
        order_type:  isLimit ? 'limit' : 'market',
        amount:      tradeAmount,
        entry_price: isLimit ? null : (final.entry_price || null),
        limit_price: isLimit ? (final.entry_price || null) : null,
        tp_price:    final.tp_price || null,
        sl_price:    final.sl_price || null,
        leverage:    Math.min(final.leverage, maxLev),
        account_type: 'ai',
        status:      isLimit ? 'pending' : 'open',
        expires_at:  isLimit ? expiresAt.toISOString() : null,
      })
      await adjustBalance(userId, -tradeAmount)

      const dir = final.verdict === 'LONG' ? '📈' : '📉'
      const entry = final.entry_price?.toFixed(2) ?? '—'
      const tp    = final.tp_price?.toFixed(2) ?? '—'
      const sl    = final.sl_price?.toFixed(2) ?? '—'
      const msg   = `${dir} <b>AUTO ${final.verdict}</b> ${sym} ${tfLabel}\n`
        + `Уверенность: <b>${final.confidence}%</b>\n`
        + `Вход: $${entry} | TP: $${tp} | SL: $${sl}\n`
        + `Плечо: ${final.leverage}x | R:R: ${final.rr}`

      const tgChatId = String(user.telegram_chat_id || '')
      const notifyTg = interval === '1h' || interval === '4h'
      await Promise.allSettled([
        notifyTg ? (tgChatId ? sendTelegramToUser(tgChatId, msg) : sendTelegram(msg)) : Promise.resolve(),
        createNotification(userId, `🤖 AUTO ${final.verdict} ${sym} — уверенность ${final.confidence}%`),
      ])
    }

    return { ok: true, verdict: final.verdict, confidence: final.confidence }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.AUTO_ANALYZE_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminEmail = process.env.ADMIN_EMAILS?.split(',')[0]?.trim()
  if (!adminEmail) return NextResponse.json({ error: 'ADMIN_EMAILS not set' }, { status: 500 })

  const users = await sql`SELECT * FROM users WHERE email = ${adminEmail} LIMIT 1`
  if (!users.length) {
    return NextResponse.json({ error: `User not found: ${adminEmail}` }, { status: 404 })
  }
  const user = users[0] as Record<string, any>

  if (user.auto_analyze_paused) {
    return NextResponse.json({ ok: true, message: 'Auto-analysis is paused', paused: true })
  }

  const userWatchlist = await getUserWatchlist(Number(user.id))
  const rawList: string[] = userWatchlist?.length ? userWatchlist : DEFAULT_WATCHLIST
  // Sort by price (BTC→ETH→…) and hard-cap at 15 pairs
  const watchlist = (await priceSortedWatchlist(rawList)).slice(0, 15)
  const batchIndex = parseInt(req.nextUrl.searchParams.get('batch') || '0', 10)
  const batchSize  = 5
  const start      = batchIndex * batchSize
  const pairs      = watchlist.slice(start, start + batchSize)

  if (pairs.length === 0) {
    return NextResponse.json({ ok: true, message: 'No pairs in this batch', batch: batchIndex })
  }

  const interval  = req.nextUrl.searchParams.get('tf') || '1h'
  const startTime = Date.now()

  const settled = await Promise.allSettled(pairs.map(sym => analyzeOne(sym, user, interval)))
  const results = settled.map((r, i) => ({
    pair: pairs[i],
    ...(r.status === 'fulfilled' ? r.value : { ok: false, error: String(r.reason) }),
  }))

  const elapsed  = ((Date.now() - startTime) / 1000).toFixed(1)
  const signals  = results.filter(r => r.verdict === 'LONG' || r.verdict === 'SHORT').length
  const waits    = results.filter(r => r.verdict === 'WAIT').length
  const errors   = results.filter(r => !r.ok).length

  return NextResponse.json({
    ok: true,
    batch:          batchIndex,
    pairs_analyzed: pairs.length,
    elapsed:        parseFloat(elapsed),
    signals,
    waits,
    errors,
    results,
  })
}
