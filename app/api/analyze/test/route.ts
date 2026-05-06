export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { fullAnalysis, calcMarketData, type Candle } from '@/lib/analysis'
import { calcEnhancedSMC } from '@/lib/smc'

const HTF_MAP: Record<string, string> = {
  '1m': '1h', '5m': '4h', '15m': '4h', '30m': '4h',
  '1h': '1d', '4h': '1d', '1d': '1d',
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Only in dev' }, { status: 403 })
  }

  const url  = new URL(req.url)
  const sym  = (url.searchParams.get('pair') || 'BTCUSDT').toUpperCase()
  const interval = url.searchParams.get('tf') || '1h'
  const htfInterval = HTF_MAP[interval] || '1d'
  const tfLabel = interval.replace('m', 'Рј').replace('h', 'С‡').replace('d', 'Рґ')

  try {
    const [binanceRes, htfRes, frRes] = await Promise.allSettled([
      fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=200`),
      fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${htfInterval}&limit=100`),
      fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=1`),
    ])

    if (binanceRes.status !== 'fulfilled' || !binanceRes.value.ok) {
      return NextResponse.json({ ok: false, step: 'binance', error: `Binance fetch failed for ${sym}` })
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
    if (htfRes.status === 'fulfilled' && htfRes.value && htfRes.value.ok) {
      try {
        const htfRaw: number[][] = await htfRes.value.json()
        if (Array.isArray(htfRaw) && htfRaw.length > 0) {
          htfBias = calcEnhancedSMC(toCandles(htfRaw), null).htfBias
        }
      } catch { htfBias = undefined }
    }

    let fundingRate: number | null = null
    if (frRes.status === 'fulfilled' && frRes.value && frRes.value.ok) {
      try {
        const frData = await frRes.value.json()
        if (Array.isArray(frData) && frData[0]?.fundingRate) {
          fundingRate = parseFloat(frData[0].fundingRate)
        }
      } catch { /* ignore */ }
    }

    const market = calcMarketData(candles, fundingRate)
    if (htfBias) market.htfBias = htfBias

    const debug = url.searchParams.get('debug') === '1'

    const start = Date.now()
    const { step1, step2, final } = await fullAnalysis(sym, tfLabel, market, [], 20, 1000, 1.0)
    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    const currentPx = market.price
    const entryPx   = final.entry_price
    const isLimit   = final.entry_type === 'limit'

    return NextResponse.json({
      ok: true,
      pair: sym,
      tf: interval,
      elapsed: parseFloat(elapsed),
      price: currentPx,
      rsi: market.rsi,
      atr_pct: market.atr14pct,
      funding: fundingRate,
      verdict:    final.verdict,
      confidence: final.confidence,
      risk_score: final.risk_score,
      leverage:   final.leverage,
      entry:      entryPx,
      entry_type: final.entry_type,
      tp:         final.tp_price,
      sl:         final.sl_price,
      tp_pct:     final.tp_pct,
      sl_pct:     final.sl_pct,
      rr:         final.rr,
      confluence: final.confluence,
      description: final.full_description,
      wait_for:    final.wait_for,
      step1: { signal: step1.signal, trend: step1.trend, summary: step1.summary },
      step2: { verdict: step2.verdict, confidence: step2.confidence, summary: step2.summary },
      ob_used: final.ob_used ? {
        quality: final.ob_used.quality,
        score:   final.ob_used.score,
        range:   `$${final.ob_used.low}-$${final.ob_used.high}`,
      } : null,
      ...(debug ? {
        smc_debug: {
          htfBias:    market.smc.htfBias,
          marketHtf:  market.htfBias,
          trend:      market.smc.trend,
          sweepCount: market.smc.sweepCount,
          bosLevel:   market.smc.bosLevel,
          obCount:    market.smc.orderBlocks.length,
          fvgCount:   market.smc.fvgs.length,
          liqCount:   market.smc.liquidityLevels.length,
        }
      } : {}),
    })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, pair: sym, tf: interval, error: e instanceof Error ? e.message : String(e) })
  }
}
