export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { fullAnalysis, calcMarketData, type Candle } from '@/lib/analysis'
import { calcEnhancedSMC } from '@/lib/smc'
import { sql, saveSignal, createTrade, createNotification, getPairTier, adjustBalance, type User } from '@/lib/db'


const HTF_MAP: Record<string, string> = {
  '1m': '1h', '5m': '4h', '15m': '4h', '30m': '4h',
  '1h': '1d', '4h': '1d', '1d': '1d',
}

const TF_LABEL: Record<string, string> = {
  '1m': '1м', '5m': '5м', '15m': '15м', '30m': '30м',
  '1h': '1ч', '4h': '4ч', '1d': '1д',
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only in dev' }, { status: 403 })
  }

  const adminEmail = process.env.ADMIN_EMAILS?.split(',')[0]?.trim()
  if (!adminEmail) return NextResponse.json({ error: 'ADMIN_EMAILS not set' }, { status: 500 })

  const users = await sql`SELECT * FROM users WHERE email = ${adminEmail} LIMIT 1`
  if (!users.length) return NextResponse.json({ error: `User not found: ${adminEmail}` }, { status: 404 })
  const user = users[0] as User

  const url      = new URL(req.url)
  const sym      = (url.searchParams.get('pair') || 'BTCUSDT').toUpperCase()
  const interval = url.searchParams.get('tf') || '1h'
  const htfInterval = HTF_MAP[interval] || '1d'
  const tfLabel  = TF_LABEL[interval] || '1ч'

  try {
    const [binanceRes, htfRes, frRes] = await Promise.allSettled([
      fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=200`),
      fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${htfInterval}&limit=100`),
      fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=1`),
    ])

    if (binanceRes.status !== 'fulfilled' || !binanceRes.value.ok) {
      return NextResponse.json({ ok: false, error: `Binance fetch failed for ${sym}` })
    }

    const raw: number[][] = await binanceRes.value.json()
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ ok: false, error: `No candles for ${sym}` })
    }

    const toCandles = (rows: number[][]): Candle[] => rows.map(c => ({
      timestamp: c[0], open: parseFloat(String(c[1])), high: parseFloat(String(c[2])),
      low: parseFloat(String(c[3])), close: parseFloat(String(c[4])), volume: parseFloat(String(c[5])),
    }))

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

    const balance      = Number(user.ai_balance ?? 1000)
    const fixedAmount  = Number(user.ai_trade_amount ?? 100)
    const maxLev       = Number(user.ai_max_leverage ?? 20)

    const start = Date.now()
    const pairTier = await getPairTier(sym)
    const { step1, step2, final } = await fullAnalysis(sym, tfLabel, market, candles, [], maxLev, balance, 1.0, '', false, pairTier.tier)
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    const signal = await saveSignal(user.id, {
      pair: sym, timeframe: tfLabel,
      final_verdict:    final.verdict,
      final_confidence: final.confidence,
      final_entry:      final.entry_price || null,
      final_tp:         final.tp_price || null,
      final_sl:         final.sl_price || null,
      final_leverage:   final.leverage,
      final_risk_score: final.risk_score,
      raw_response: { final, market: { price: market.price, rsi: market.rsi, atr14pct: market.atr14pct }, pipeline: { step1, step2 }, tier: pairTier.tier },
    })

    await createNotification(user.id,
      `📊 [BATCH] ${final.verdict} ${sym} ${tfLabel} — confidence ${final.confidence}%`
    )

    if (final.verdict === 'LONG' || final.verdict === 'SHORT') {
      const tradeAmount = fixedAmount > 0 ? fixedAmount : 100
      const isLimit     = final.entry_type === 'limit'
      const expiresAt   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

      const trade = await createTrade(user.id, {
        pair: sym,
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
        timeframe:   interval,
      })
      if (tradeAmount > 0) await adjustBalance(user.id, -tradeAmount)

      return NextResponse.json({
        ok: true, saved: true, pair: sym, tf: interval, elapsed: parseFloat(elapsed),
        user_email: user.email, signal_id: signal.id, trade_id: trade.id,
        verdict: final.verdict, confidence: final.confidence,
        entry: final.entry_price, entry_type: final.entry_type,
        tp: final.tp_price, sl: final.sl_price,
        rr: final.rr, leverage: final.leverage,
        description: final.full_description,
        step1: { trend: step1.trend, summary: step1.summary },
        step2: { verdict: step2.verdict, summary: step2.summary },
      })
    }

    return NextResponse.json({
      ok: true, saved: true, pair: sym, tf: interval, elapsed: parseFloat(elapsed),
      user_email: user.email, signal_id: signal.id, trade_id: null,
      verdict: final.verdict, confidence: final.confidence,
      wait_for: final.wait_for,
      step1: { trend: step1.trend, summary: step1.summary },
      step2: { verdict: step2.verdict, summary: step2.summary },
    })

  } catch (e: unknown) {
    return NextResponse.json({ ok: false, pair: sym, tf: interval, error: e instanceof Error ? e.message : String(e) })
  }
}
