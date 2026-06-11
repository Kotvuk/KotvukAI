export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { fullAnalysis, calcMarketData, type Candle } from '@/lib/analysis'
import { calcEnhancedSMC } from '@/lib/smc'
import { saveSignal, createNotification, createTrade, getSignalsForPair, getGlobalLossPatterns, getPairTier, checkAndIncrementAnalysis, SUBSCRIPTION_LIMITS, adjustBalance, normalizeTf, sql } from '@/lib/db'

const TF_MAP: Record<string, string> = {
  '1м': '1m', '5м': '5m', '15м': '15m', '30м': '30m',
  '1ч': '1h', '4ч': '4h', '1д': '1d',
}

const HTF_MAP: Record<string, string> = {
  '1m': '1h', '5m': '4h', '15m': '4h', '30m': '4h',
  '1h': '1d', '4h': '1d', '1d': '1d',
}

const OI_PERIOD_MAP: Record<string, string> = {
  '1m': '5m', '5m': '5m', '15m': '15m', '30m': '30m',
  '1h': '1h', '4h': '4h', '1d': '4h',
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

  throw new Error(`Failed to fetch candles: ${lastError}`)
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
      error_code: 'quota_exceeded',
      quota,
    }, { status: 429 })
  }

  const start = Date.now()
  const interval = TF_MAP[timeframe] || '1h'

  try {
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

    const oiPeriod = OI_PERIOD_MAP[interval] || '15m'

    const [htfRes, frRes, oiRes, lsRes] = await Promise.allSettled([
      fetchKlines(sym, htfInterval, 100),
      fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=1`, { cache: 'no-store' }),
      fetch(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${sym}&period=${oiPeriod}&limit=12`, { cache: 'no-store' }),
      fetch(`https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${sym}&period=${oiPeriod}&limit=4`, { cache: 'no-store' }),
    ])

    let htfBias: string | undefined
    if (htfRes.status === 'fulfilled') {
      try {
        if (htfRes.value.length > 0) {
          htfBias = calcEnhancedSMC(toCandles(htfRes.value), null).htfBias
        }
      } catch {}
    }

    let fundingRate: number | null = null
    if (frRes.status === 'fulfilled' && frRes.value.ok) {
      try {
        const fd: { fundingRate?: string }[] = await frRes.value.json()
        if (fd[0]?.fundingRate) fundingRate = parseFloat(fd[0].fundingRate) * 100
      } catch {}
    }

    let openInterestHist: { sumOpenInterest: number; timestamp: number }[] | null = null
    if (oiRes.status === 'fulfilled' && oiRes.value.ok) {
      try {
        const oid: { sumOpenInterest: string; timestamp: number }[] = await oiRes.value.json()
        if (Array.isArray(oid) && oid.length > 0) {
          openInterestHist = oid.map(p => ({ sumOpenInterest: parseFloat(p.sumOpenInterest), timestamp: p.timestamp }))
        }
      } catch {}
    }

    let longShortRatio: { longShortRatio: number; timestamp: number }[] | null = null
    if (lsRes.status === 'fulfilled' && lsRes.value.ok) {
      try {
        const lsd: { longShortRatio: string; timestamp: number }[] = await lsRes.value.json()
        if (Array.isArray(lsd) && lsd.length > 0) {
          longShortRatio = lsd.map(p => ({ longShortRatio: parseFloat(p.longShortRatio), timestamp: p.timestamp }))
        }
      } catch {}
    }

    const market = calcMarketData(candles, fundingRate, openInterestHist, longShortRatio)
    if (htfBias) market.htfBias = htfBias

    const [memorySignals, globalPatterns, pairTier] = await Promise.all([
      getSignalsForPair(user.id, pair, 10),
      getGlobalLossPatterns(user.id),
      getPairTier(pair),
    ])
    const balance       = Number(user.ai_balance ?? 10000)
    const fixedAmount   = Number(user.ai_trade_amount ?? 100)
    const userMaxLev    = Number(user.ai_max_leverage ?? 20)
    const { step1, step2, final: analysis, methods, consensus } = await fullAnalysis(pair, timeframe, market, candles, memorySignals, userMaxLev, balance, 1.0, globalPatterns, true, pairTier.tier)

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
      raw_response: { analysis, market, pipeline: { step1, step2 }, tier: pairTier.tier },
    })

    await createNotification(user.id, `📊 ${analysis.verdict} ${pair} ${timeframe} — confidence ${analysis.confidence}%`)

    let tradeCreated = false
    let tradeSkipped = ''

    const isShortTf = ['1m', '5m'].includes(interval)
    const utcDay = new Date().getUTCDay()
    const isWeekend = utcDay === 0 || utcDay === 6

    if ((analysis.verdict === 'LONG' || analysis.verdict === 'SHORT') && !isShortTf && !isWeekend) {
      try {
        const existing = await sql`
          SELECT id FROM trades
          WHERE user_id = ${user.id} AND pair = ${pair}
            AND direction = ${analysis.verdict.toLowerCase()}
            AND status IN ('pending', 'open') AND account_type = 'ai'
          LIMIT 1
        `
        if (pairTier.tier === 'black') {
          tradeSkipped = 'pair tier black'
        } else if (existing.length > 0) {
          tradeSkipped = 'duplicate'
        } else {
          const expiresAt     = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          const tradeLeverage = Math.min(analysis.leverage ?? 2, userMaxLev)

          const tradeAmount = fixedAmount > 0 ? fixedAmount : 100

          if (tradeAmount > 0) {
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
              timeframe:    normalizeTf(timeframe),
            })
            if (balance > 0) await adjustBalance(user.id, -Math.min(tradeAmount, balance))
            tradeCreated = true

            const prec = (analysis.entry_price ?? 0) >= 100 ? 2 : 4

            if (isLimit && limitPx) {
              await createNotification(user.id,
                `⏳ Limit order ${analysis.verdict} ${pair} waiting @ $${limitPx.toFixed(prec)} (expires in 7 days)`
              )
            } else {
              await createNotification(user.id,
                `🤖 AI opened ${analysis.verdict} ${pair} @ market | TP $${(analysis.tp_price ?? 0).toFixed(prec)} | SL $${(analysis.sl_price ?? 0).toFixed(prec)}`
              )
            }

          } else {
            tradeSkipped = 'zero_amount'
          }
        }
      } catch (e) {
        console.error('[analyze] trade creation error:', e)
        tradeSkipped = e instanceof Error ? e.message : 'db_error'
      }
    }

    return NextResponse.json({
      ok: true,
      elapsed: parseFloat(elapsed),
      trade_created: tradeCreated,
      trade_skipped: tradeSkipped || undefined,
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
        risk_usd: analysis.risk_usd,
        pos_usd: analysis.pos_usd,
        leverage: userMaxLev,
        rr: analysis.rr,
        min_rr: analysis.min_rr,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[analyze] error:', msg)
    const isGroqExhausted = msg.includes('exhausted') || msg.includes('rate') || msg.includes('429')
    return NextResponse.json({ ok: false, error: msg }, { status: isGroqExhausted ? 503 : 500 })
  }
}
