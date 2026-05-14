export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { fullAnalysis, calcMarketData, type Candle } from '@/lib/analysis'
import { calcEnhancedSMC } from '@/lib/smc'
import { saveSignal, createNotification, createTrade, getSignalsForPair, checkAndIncrementAnalysis, SUBSCRIPTION_LIMITS, adjustBalance, sql } from '@/lib/db'
import { sendTelegram, sendTelegramToUser } from '@/lib/telegram'

const TF_MAP: Record<string, string> = {
  '1м': '1m', '5м': '5m', '15м': '15m', '30м': '30m',
  '1ч': '1h', '4ч': '4h', '1д': '1d',
}

const HTF_MAP: Record<string, string> = {
  '1m': '1h', '5m': '4h', '15m': '4h', '30m': '4h',
  '1h': '1d', '4h': '1d', '1d': '1d',
}

const PAIR_RE = /^[A-Z]{2,12}(USDT?|BTC|ETH|BNB)$/

const BINANCE_ENDPOINTS = [
  'https://fapi.binance.com',
  'https://api.binance.com',
  'https://data.binance.com',
]

async function fetchKlines(sym: string, interval: string, limit: number): Promise<number[][]> {
  const withTimeout = (url: string) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 9000)
    return fetch(url, { signal: ctrl.signal, cache: 'no-store' })
      .finally(() => clearTimeout(t))
  }

  let lastError = ''

  for (const baseUrl of BINANCE_ENDPOINTS) {
    try {
      const isFutures = baseUrl.includes('fapi')
      const path = isFutures ? '/fapi/v1/klines' : '/api/v3/klines'
      const url = `${baseUrl}${path}?symbol=${sym}&interval=${interval}&limit=${limit}`

      const r = await withTimeout(url)
      if (r.ok) {
        const d: number[][] = await r.json()
        if (Array.isArray(d) && d.length > 0) return d
      }
      lastError = `endpoint ${baseUrl} returned ${r.status}`
    } catch (e) {
      lastError = String(e)
    }
  }

  throw new Error(`Не удалось получить свечи: ${lastError}`)
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { pair, timeframe } = await req.json()
  if (!pair || !timeframe) return NextResponse.json({ ok: false, error: 'pair and timeframe required' }, { status: 400 })

  const sym = pair.replace('/', '')
  if (!PAIR_RE.test(sym)) return NextResponse.json({ ok: false, error: 'Invalid pair format' }, { status: 400 })

  const quota = await checkAndIncrementAnalysis(user.id)
  if (!quota.allowed) {
    return NextResponse.json({
      ok: false,
      error: `Дневной лимит анализов исчерпан (${SUBSCRIPTION_LIMITS[quota.tier]}/${quota.tier}). Обновите тариф.`,
      quota,
    }, { status: 429 })
  }

  const start = Date.now()

  try {
    const interval    = TF_MAP[timeframe] || '1h'
    const htfInterval = HTF_MAP[interval] || '1d'

    const toCandles = (rows: number[][]): Candle[] => rows.map(c => ({
      timestamp: c[0],
      open:   parseFloat(String(c[1])),
      high:   parseFloat(String(c[2])),
      low:    parseFloat(String(c[3])),
      close:  parseFloat(String(c[4])),
      volume: parseFloat(String(c[5])),
    }))

    const raw = await fetchKlines(sym, interval, 200)
    const candles = toCandles(raw)

    const [htfRes, frRes] = await Promise.allSettled([
      fetchKlines(sym, htfInterval, 100),
      fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=1`, { cache: 'no-store' }),
    ])

    let htfBias: string | undefined
    if (htfRes.status === 'fulfilled') {
      try {
        if (htfRes.value.length > 0) {
          htfBias = calcEnhancedSMC(toCandles(htfRes.value), null).htfBias
        }
      } catch { /* ignore */ }
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

    const memorySignals = await getSignalsForPair(user.id, pair, 5)
    const balance       = Number(user.ai_balance ?? 1000)
    const riskPct       = Number(user.ai_risk_per_trade ?? 1.0)
    const userMaxLev    = Number(user.ai_max_leverage ?? 20)
    const { step1, step2, final: analysis, methods, consensus } = await fullAnalysis(pair, timeframe, market, candles, memorySignals, userMaxLev, balance, riskPct)

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    const signal = await saveSignal(user.id, {
      pair, timeframe,
      final_verdict:    analysis.verdict,
      final_confidence: analysis.confidence,
      final_entry:      analysis.entry_price,
      final_tp:         analysis.tp_price,
      final_sl:         analysis.sl_price,
      final_leverage:   analysis.leverage,
      final_risk_score: analysis.risk_score,
      raw_response: { analysis, market, pipeline: { step1, step2 } },
    })

    await createNotification(user.id, `📊 ${analysis.verdict} ${pair} ${timeframe} — уверенность ${analysis.confidence}%`)

    if (analysis.verdict === 'LONG' || analysis.verdict === 'SHORT') {
      try {
        const existing = await sql`
          SELECT id FROM trades
          WHERE user_id = ${user.id} AND pair = ${pair}
            AND direction = ${analysis.verdict.toLowerCase()}
            AND status IN ('pending', 'open') AND account_type = 'ai'
          LIMIT 1
        `
        if (existing.length === 0) {
          const expiresAt     = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          const maxLeverage   = Number(user.ai_max_leverage ?? 20)
          const tradeLeverage = Math.min(analysis.leverage ?? 2, maxLeverage)

          const slDist = (analysis.sl_price && analysis.entry_price)
            ? Math.abs(analysis.entry_price - analysis.sl_price) / analysis.entry_price
            : 0.02
          const riskUsd     = balance * riskPct / 100
          const rawAmount   = analysis.pos_usd || Math.round(riskUsd / Math.max(slDist, 0.001))
          const tradeAmount = Math.min(Math.round(rawAmount), Math.round(balance * maxLeverage))

          const isLimit = analysis.entry_type === 'limit'
          const limitPx = analysis.entry_price ?? null

          await createTrade(user.id, {
            pair,
            direction:    analysis.verdict.toLowerCase() as 'long' | 'short',
            order_type:   isLimit ? 'limit' : 'market',
            amount:       tradeAmount,
            entry_price:  isLimit ? null : limitPx,
            limit_price:  isLimit ? limitPx : null,
            tp_price:     analysis.tp_price ?? null,
            sl_price:     analysis.sl_price ?? null,
            leverage:     tradeLeverage,
            account_type: 'ai',
            status:       isLimit ? 'pending' : 'open',
            expires_at:   isLimit ? expiresAt.toISOString() : null,
          })
          await adjustBalance(user.id, -tradeAmount)

          if (isLimit && limitPx) {
            await createNotification(user.id,
              `⏳ Лимитный ордер ${analysis.verdict} ${pair} ожидает входа на $${limitPx.toFixed(2)} (истекает через 7 дней)`
            )
          }

          const dir = analysis.verdict === 'LONG' ? '📈' : '📉'
          const msg = `${dir} <b>${analysis.verdict}</b> ${sym} ${timeframe}\n`
            + `Уверенность: <b>${analysis.confidence}%</b>\n`
            + `Вход: $${(analysis.entry_price ?? 0).toFixed(2)} | TP: $${(analysis.tp_price ?? 0).toFixed(2)} | SL: $${(analysis.sl_price ?? 0).toFixed(2)}\n`
            + `Плечо: ${analysis.leverage}x | R:R: ${analysis.rr ?? '?'}`
          const tgChatId = String(user.telegram_chat_id || '')
          ;(tgChatId ? sendTelegramToUser(tgChatId, msg) : sendTelegram(msg)).catch(() => {})
        }
      } catch { /* не критично */ }
    }

    return NextResponse.json({
      ok: true,
      elapsed: parseFloat(elapsed),
      analysis,
      market,
      smc_probability: market.smc.probability,
      pipeline: {
        step1: { signal: step1.signal, strength: step1.strength, summary: step1.summary },
        step2: { verdict: step2.verdict, confidence: step2.confidence, summary: step2.summary },
        step3: { verdict: analysis.verdict, confidence: analysis.confidence },
      },
      methods,
      consensus,
      signal_id: signal.id,
      quota: { remaining: quota.remaining, tier: quota.tier, limit: quota.limit },
      risk_management: {
        balance,
        risk_pct: riskPct,
        risk_usd: analysis.risk_usd,
        pos_usd: analysis.pos_usd,
        leverage: userMaxLev,
        rr: analysis.rr,
        min_rr: analysis.min_rr,
      },
    })
  } catch (e: unknown) {
    console.error('analyze:', e)
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'AI error' }, { status: 500 })
  }
}
