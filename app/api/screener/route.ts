export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { calcMarketData, type Candle } from '@/lib/analysis'
import { analyzeIndicators, analyzePriceAction, analyzeWyckoff, analyzeVolumeProfile, analyzeFunding, calcConsensus } from '@/lib/indicators'
import { isExcluded } from '@/lib/pairs'

const TOP_N = 50
const RETURN_N = 30

async function fetchTopPairs(): Promise<{ symbol: string; volume: number }[]> {
  const r = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr', {
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(8000),
  })
  if (!r.ok) return []
  const data = await r.json() as { symbol: string; quoteVolume: string }[]
  return data
    .filter(d => d.symbol.endsWith('USDT') && !isExcluded(d.symbol))
    .map(d => ({ symbol: d.symbol, volume: parseFloat(d.quoteVolume) }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, TOP_N)
}

async function fetchCandles(symbol: string, tf: string): Promise<Candle[]> {
  const r = await fetch(
    `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${tf}&limit=200`,
    { next: { revalidate: 30 }, signal: AbortSignal.timeout(6000) }
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

export interface ScreenerSetup {
  pair: string
  signal: 'LONG' | 'SHORT'
  confidence: number
  price: number
  rsi: number
  atrPct: number
  agreeing: number
  total: number
  summary: string
}

export async function GET(req: NextRequest) {
  const tf = new URL(req.url).searchParams.get('tf') || '1h'

  try {
    const topPairs = await fetchTopPairs()
    if (!topPairs.length) {
      return NextResponse.json({ ok: false, error: 'Binance unavailable' }, { status: 502 })
    }

    const results = await Promise.allSettled(
      topPairs.map(async ({ symbol }) => {
        const candles = await fetchCandles(symbol, tf)
        if (candles.length < 100) return null

        const market = calcMarketData(candles, null)
        const methods = [
          analyzeIndicators(candles),
          analyzePriceAction(candles),
          analyzeWyckoff(candles),
          analyzeVolumeProfile(candles),
          analyzeFunding(null),
        ]
        const consensus = calcConsensus(methods, 3)

        if (consensus.decision === 'WAIT') return null

        const isLong = consensus.decision === 'LONG'
        const confidence = isLong ? consensus.avgConfidenceLong : consensus.avgConfidenceShort
        if (confidence < 55) return null

        const setup: ScreenerSetup = {
          pair: symbol.slice(0, -4) + '/USDT',
          signal: consensus.decision,
          confidence,
          price: market.price,
          rsi: market.rsi,
          atrPct: market.atr14pct,
          agreeing: isLong ? consensus.long : consensus.short,
          total: methods.length,
          summary: `${consensus.agreeing.slice(0, 3).join(', ')} → ${consensus.decision}`,
        }
        return setup
      })
    )

    const setups: ScreenerSetup[] = results
      .filter((r): r is PromiseFulfilledResult<ScreenerSetup | null> => r.status === 'fulfilled' && r.value !== null)
      .map(r => r.value as ScreenerSetup)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, RETURN_N)

    return NextResponse.json({ ok: true, tf, setups, scanned: topPairs.length, ts: Date.now() })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
