export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { FOREX_WATCHLIST } from '@/lib/markets'
import { fetchForexCandles } from '@/lib/providers/twelvedata'

const SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','AVAXUSDT','DOGEUSDT','LINKUSDT','ADAUSDT','DOTUSDT','TRXUSDT','LTCUSDT','ATOMUSDT','POLUSDT']

const BINANCE_APIS = [
  'https://api.binance.com/api/v3/ticker/24hr',
  'https://data.binance.com/api/v3/ticker/24hr',
]

async function getForexTicker() {
  const result: Record<string, { price: number; change: number }> = {}
  await Promise.all(FOREX_WATCHLIST.map(async sym => {
    try {
      const candles = await fetchForexCandles(sym, '1h', 25)
      if (candles.length < 2) return
      const last = candles[candles.length - 1]
      const prev = candles[0]
      const price = last[4]
      const change = ((price - prev[4]) / prev[4]) * 100
      result[sym] = { price, change }
    } catch {}
  }))
  return result
}

export async function GET(req: NextRequest) {
  const market = req.nextUrl.searchParams.get('market') || 'crypto'
  if (market === 'forex') {
    const result = await getForexTicker()
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' }
    })
  }

  for (const baseUrl of BINANCE_APIS) {
    try {
      const joined = JSON.stringify(SYMBOLS)
      const res = await fetch(
        `${baseUrl}?symbols=${encodeURIComponent(joined)}`,
        { next: { revalidate: 30 }, signal: AbortSignal.timeout(8_000) }
      )
      if (!res.ok) continue
      const data: { symbol: string; lastPrice: string; priceChangePercent: string }[] = await res.json()
      const result: Record<string, { price: number; change: number }> = {}
      for (const d of data) {
        result[d.symbol] = {
          price:  parseFloat(d.lastPrice),
          change: parseFloat(d.priceChangePercent),
        }
      }
      return NextResponse.json(result, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' }
      })
    } catch { continue }
  }
  return NextResponse.json({}, { status: 502 })
}
