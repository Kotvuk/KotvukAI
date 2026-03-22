export const dynamic = 'force-dynamic'
export const maxDuration = 300
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import {
  fullAnalysis,
  calcMarketData,
  type Candle,
} from '@/lib/ollama'
import { saveSignal, createNotification } from '@/lib/db'

const TF_MAP: Record<string, string> = {
  '1м': '1m', '5м': '5m', '15м': '15m', '30м': '30m',
  '1ч': '1h', '4ч': '4h', '1д': '1d',
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const { pair, timeframe } = await req.json()
  if (!pair || !timeframe) return NextResponse.json({ ok: false, error: 'pair and timeframe required' }, { status: 400 })

  const start = Date.now()

  try {
    // 1. Fetch candles from Binance Futures
    const sym = pair.replace('/', '')
    const interval = TF_MAP[timeframe] || '1h'
    const binanceRes = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=200`
    )
    const raw: number[][] = await binanceRes.json()
    if (!Array.isArray(raw)) throw new Error('Binance error')

    const candles: Candle[] = raw.map(c => ({
      timestamp: c[0],
      open: parseFloat(String(c[1])),
      high: parseFloat(String(c[2])),
      low: parseFloat(String(c[3])),
      close: parseFloat(String(c[4])),
      volume: parseFloat(String(c[5])),
    }))

    // 2. Fetch funding rate
    let fundingRate: number | null = null
    try {
      const fr = await fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=1`)
      const fd: { fundingRate?: string }[] = await fr.json()
      if (fd[0]?.fundingRate) fundingRate = parseFloat(fd[0].fundingRate) * 100
    } catch {}

    // 3. Calculate market data
    const market = calcMarketData(candles, fundingRate)

    // 4. AI Analysis: single combined call (faster than 3 sequential calls)
    const { step1, step2, final: analysis } = await fullAnalysis(pair, timeframe, market)

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    // 5. Save to DB
    const signal = await saveSignal(user.id, {
      pair, timeframe,
      final_verdict: analysis.verdict,
      final_confidence: analysis.confidence,
      final_entry: analysis.entry_price,
      final_tp: analysis.tp_price,
      final_sl: analysis.sl_price,
      final_leverage: analysis.leverage,
      final_risk_score: analysis.risk_score,
      raw_response: { analysis, market, pipeline: { kimi: step1, maverick: step2, qwen: analysis } },
    })

    // 6. Create notification
    await createNotification(user.id, `${analysis.verdict} ${pair} ${timeframe} — ${analysis.confidence}%`)

    return NextResponse.json({
      ok: true,
      elapsed: parseFloat(elapsed),
      analysis,
      market,
      smc_probability: market.smc.probability,
      pipeline: {
        kimi:    { signal: step1.signal, strength: step1.strength, summary: step1.summary },
        maverick:{ verdict: step2.verdict, confidence: step2.confidence, summary: step2.summary },
        qwen:    { verdict: analysis.verdict, confidence: analysis.confidence },
      },
      signal_id: signal.id,
    })
  } catch (e: unknown) {
    console.error('analyze:', e)
    const msg = e instanceof Error ? e.message : 'AI error'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
