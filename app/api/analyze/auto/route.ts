export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { fullAnalysis, calcMarketData, type Candle } from '@/lib/analysis'
import { calcEnhancedSMC } from '@/lib/smc'
import { sql, saveSignal, createTrade, createNotification, getUserWatchlist, getSignalsForPair, getGlobalLossPatterns, adjustBalance, type User } from '@/lib/db'
import { sendTelegram, sendTelegramToUser } from '@/lib/telegram'
import { DEFAULT_WATCHLIST, BAD_PAIRS } from '@/lib/pairs'

function isAllowedTradingTime(): boolean {
  const now = new Date()
  const dow = now.getUTCDay()
  if (dow === 0 || dow === 6) return false

  const h = now.getUTCHours()
  const m = now.getUTCMinutes()
  const t = h * 60 + m

  // Алматы UTC+5: окна 10:00-12:00, 15:00-21:00, 22:00-00:00
  // В UTC: 05:00-07:00, 10:00-16:00, 17:00-19:00
  const windows = [
    [5 * 60, 7 * 60],
    [10 * 60, 16 * 60],
    [17 * 60, 19 * 60],
  ]
  return windows.some(([s, e]) => t >= s && t < e)
}

const HTF_MAP: Record<string, string> = {
  '5m': '1h', '15m': '4h', '30m': '4h', '1h': '1d', '4h': '1d',
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
  user: User,
  interval = '1h',
): Promise<{ ok: boolean; verdict?: string; confidence?: number; error?: string }> {
  if (['1m', '5m', '1м', '5м'].includes(interval)) {
    return { ok: true, verdict: 'SKIP', error: '1m/5m excluded — no edge' }
  }
  const htfInterval = HTF_MAP[interval] || '1d'
  const pairFmt = sym.endsWith('USDT') ? sym.slice(0, -4) + '/USDT' : sym
  const userId  = Number(user.id)

  try {
    const [binanceRes, htfRes, frRes] = await Promise.allSettled([
      fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=200`, { cache: 'no-store' }),
      fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${htfInterval}&limit=100`, { cache: 'no-store' }),
      fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=1`, { cache: 'no-store' }),
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

    const signalDirection = String(user.signal_direction ?? 'both')
    const balance      = Number(user.ai_balance ?? 1000)
    const fixedAmount  = Number(user.ai_trade_amount ?? 100)
    const maxLev       = Number(user.ai_max_leverage ?? 20)
    const tfLabel  = ({ '5m': '5м', '15m': '15м', '30m': '30м', '1h': '1ч', '4h': '4ч' } as Record<string, string>)[interval] ?? interval

    const recentSignal = await sql`
      SELECT id FROM signals
      WHERE user_id = ${userId} AND pair = ${pairFmt}
        AND timeframe IN (${interval}, ${tfLabel})
        AND created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `
    if (recentSignal.length > 0) {
      return { ok: true, verdict: 'SKIP', error: 'duplicate within 24h' }
    }

    const [memorySignals, globalPatterns] = await Promise.all([
      getSignalsForPair(userId, pairFmt, 10),
      getGlobalLossPatterns(userId),
    ])
    const { step1, step2, final } = await fullAnalysis(pairFmt, tfLabel, market, candles, memorySignals, maxLev, balance, 1.0, globalPatterns, false)

    // фильтр направления по настройке пользователя
    if (final.verdict === 'LONG'  && signalDirection === 'short') return { ok: true, verdict: 'SKIP', error: 'direction=short only' }
    if (final.verdict === 'SHORT' && signalDirection === 'long')  return { ok: true, verdict: 'SKIP', error: 'direction=long only' }

    // не сохраняем заглушки Groq (conf=45 это признак отказа ключей)
    if (final.confidence === 45 && final.verdict === 'WAIT') {
      return { ok: true, verdict: 'SKIP', confidence: 45, error: 'groq fallback skipped' }
    }

    await saveSignal(userId, {
      pair: pairFmt, timeframe: tfLabel,
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
      // кулдаун 24ч — не входим если последняя сделка по паре была убыточной
      const lastLoss = await sql`
        SELECT id FROM trades
        WHERE user_id = ${userId} AND pair = ${pairFmt}
          AND account_type = 'ai' AND status = 'closed'
          AND pnl_pct < 0
          AND closed_at > NOW() - INTERVAL '24 hours'
        LIMIT 1
      `
      if (lastLoss.length > 0) {
        return { ok: true, verdict: final.verdict, confidence: final.confidence, error: 'cooldown: last trade was a loss within 24h' }
      }

      const existing = await sql`
        SELECT id FROM trades
        WHERE user_id = ${userId} AND pair = ${pairFmt}
          AND status IN ('pending', 'open') AND account_type = 'ai'
        LIMIT 1
      `
      if (existing.length > 0) {
        return { ok: true, verdict: final.verdict, confidence: final.confidence }
      }

      const recentTrade = await sql`
        SELECT id FROM trades
        WHERE user_id = ${userId} AND pair = ${pairFmt}
          AND account_type = 'ai'
          AND (
            (status = 'closed' AND closed_at > NOW() - INTERVAL '24 hours')
            OR (status = 'cancelled' AND closed_at > NOW() - INTERVAL '24 hours')
          )
        LIMIT 1
      `
      if (recentTrade.length > 0) {
        return { ok: true, verdict: final.verdict, confidence: final.confidence }
      }

      const tradeAmount = fixedAmount > 0 ? fixedAmount : 100

      if (tradeAmount <= 0 || balance < tradeAmount) {
        return { ok: true, verdict: final.verdict, confidence: final.confidence }
      }
      const isLimit     = final.entry_type === 'limit'
      const expiresAt   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      let marketEntry = final.entry_price || null
      if (!isLimit && !marketEntry) {
        try {
          const pr = await fetch(`https://fapi.binance.com/fapi/v1/ticker/price?symbol=${sym}`, { signal: AbortSignal.timeout(4000), cache: 'no-store' })
          const pd: { price?: string } = await pr.json()
          if (pd.price) marketEntry = parseFloat(pd.price)
        } catch {}
      }

      await createTrade(userId, {
        pair:        pairFmt,
        direction:   final.verdict.toLowerCase() as 'long' | 'short',
        order_type:  isLimit ? 'limit' : 'market',
        amount:      tradeAmount,
        entry_price: isLimit ? null : marketEntry,
        limit_price: isLimit ? (final.entry_price || null) : null,
        tp_price:    final.tp_price || null,
        sl_price:    final.sl_price || null,
        leverage:    Math.min(final.leverage, maxLev),
        account_type: 'ai',
        status:      isLimit ? 'pending' : 'open',
        expires_at:  isLimit ? expiresAt.toISOString() : null,
      })
      await adjustBalance(userId, -tradeAmount)

      const dir   = final.verdict === 'LONG' ? '📈' : '📉'
      const prec  = (final.entry_price ?? 0) >= 100 ? 2 : 4
      const entry = final.entry_price ? final.entry_price.toFixed(prec) : '—'
      const tp    = final.tp_price    ? final.tp_price.toFixed(prec)    : '—'
      const sl    = final.sl_price    ? final.sl_price.toFixed(prec)    : '—'
      const rr    = final.rr && isFinite(final.rr) ? final.rr.toFixed(1) : '?'
      const msg   = `${dir} <b>AUTO ${final.verdict}</b> ${pairFmt} ${tfLabel}\n`
        + `Confidence: <b>${final.confidence}%</b>\n`
        + `Entry: $${entry} | TP: $${tp} | SL: $${sl}\n`
        + `Leverage: ${final.leverage}x | R:R: 1:${rr}`

      const tgChatId = String(user.telegram_chat_id || '')
      await Promise.allSettled([
        tgChatId ? sendTelegramToUser(tgChatId, msg) : sendTelegram(msg),
        createNotification(userId, `🤖 AUTO ${final.verdict} ${pairFmt} — confidence ${final.confidence}%`),
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
  const user = users[0] as User

  if (user.auto_analyze_paused) {
    return NextResponse.json({ ok: true, message: 'Auto-analysis is paused', paused: true })
  }

  if (!isAllowedTradingTime()) {
    const now = new Date()
    return NextResponse.json({ ok: true, message: `Outside trading hours (UTC ${now.getUTCHours()}:${String(now.getUTCMinutes()).padStart(2,'0')}, day ${now.getUTCDay()})`, skipped: true })
  }

  const userWatchlist = await getUserWatchlist(Number(user.id))
  const rawList: string[] = (userWatchlist?.length ? userWatchlist : DEFAULT_WATCHLIST)
    .filter(s => !BAD_PAIRS.has(s))
  const watchlist = (await priceSortedWatchlist(rawList)).slice(0, 12)
  const batchIndex = parseInt(req.nextUrl.searchParams.get('batch') || '0', 10)
  const batchSize  = 6
  const start      = batchIndex * batchSize
  const pairs      = watchlist.slice(start, start + batchSize)

  if (pairs.length === 0) {
    return NextResponse.json({ ok: true, message: 'No pairs in this batch', batch: batchIndex })
  }

  const interval  = req.nextUrl.searchParams.get('tf') || '1h'
  const startTime = Date.now()

  const results: Array<{ pair: string; ok: boolean; verdict?: string; confidence?: number; error?: string }> = []
  for (const sym of pairs) {
    try {
      results.push({ pair: sym, ...(await analyzeOne(sym, user, interval)) })
    } catch (e) {
      results.push({ pair: sym, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

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
