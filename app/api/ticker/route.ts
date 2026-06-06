export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextResponse } from 'next/server'

const SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','AVAXUSDT','DOGEUSDT','LINKUSDT','ADAUSDT','DOTUSDT','TRXUSDT','LTCUSDT','ATOMUSDT','POLUSDT']

const BINANCE_APIS = [
  'https://api.binance.com/api/v3/ticker/24hr',
  'https://data.binance.com/api/v3/ticker/24hr',
]

export async function GET() {
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
