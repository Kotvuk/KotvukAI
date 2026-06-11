export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { calcMarketData, type Candle } from '@/lib/analysis'
import { analyzeIndicators, analyzePriceAction, analyzeDerivatives, analyzeVolumeProfile, analyzeFunding, calcConsensus } from '@/lib/indicators'

const TF_MAP: Record<string, string> = {
  '5m': '5m', '15m': '15m', '1h': '1h', '4h': '4h',
}

async function fetchCandles(symbol: string, interval: string): Promise<Candle[]> {
  const r = await fetch(
    `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=200`,
    { next: { revalidate: 30 }, signal: AbortSignal.timeout(8000) }
  )
  if (!r.ok) return []
  const raw = await r.json() as unknown[][]
  return raw.map(d => ({
    timestamp: Number(d[0]),
    open:   parseFloat(String(d[1])),
    high:   parseFloat(String(d[2])),
    low:    parseFloat(String(d[3])),
    close:  parseFloat(String(d[4])),
    volume: parseFloat(String(d[5])),
  }))
}

export interface TFResult {
  tf: string
  signal: 'LONG' | 'SHORT' | 'WAIT'
  confidence: number
  price: number
  rsi: number
  atrPct: number
  agreeing: string[]
  disagreeing: string[]
  trend: string
  ema50: string
  ema200: string
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const pair = (searchParams.get('pair') || 'BTCUSDT').toUpperCase()

  const tfs = Object.keys(TF_MAP)

  const results = await Promise.allSettled(
    tfs.map(async (tf) => {
      const candles = await fetchCandles(pair, TF_MAP[tf])
      if (candles.length < 100) return null

      const market = calcMarketData(candles, null)
      const methods = [
        analyzeIndicators(candles),
        analyzePriceAction(candles),
        analyzeDerivatives(null, null, candles),
        analyzeVolumeProfile(candles),
        analyzeFunding(null),
      ]
      const consensus = calcConsensus(methods, 3)

      const isLong  = consensus.decision === 'LONG'
      const isShort = consensus.decision === 'SHORT'
      const confidence = isLong ? consensus.avgConfidenceLong : isShort ? consensus.avgConfidenceShort : 45

      const result: TFResult = {
        tf,
        signal: consensus.decision,
        confidence,
        price: market.price,
        rsi: market.rsi,
        atrPct: market.atr14pct,
        agreeing: consensus.agreeing,
        disagreeing: consensus.disagreeing,
        trend: market.smc.trend,
        ema50: market.priceVsEma50,
        ema200: market.priceVsEma200,
      }
      return result
    })
  )

  const tfResults: Record<string, TFResult | null> = {}
  tfs.forEach((tf, i) => {
    const r = results[i]
    tfResults[tf] = r.status === 'fulfilled' ? r.value : null
  })

  const aligned = Object.values(tfResults).filter(Boolean) as TFResult[]
  const longCount  = aligned.filter(r => r.signal === 'LONG').length
  const shortCount = aligned.filter(r => r.signal === 'SHORT').length
  const overallBias = longCount > shortCount ? 'LONG' : shortCount > longCount ? 'SHORT' : 'WAIT'

  return NextResponse.json({
    ok: true, pair, tfs: tfResults,
    overallBias, longCount, shortCount, ts: Date.now(),
  })
}
