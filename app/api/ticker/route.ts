export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','AVAXUSDT','DOGEUSDT','LINKUSDT']

export async function GET() {
  try {
    const joined = JSON.stringify(SYMBOLS)
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(joined)}`,
      { next: { revalidate: 30 } }
    )
    if (!res.ok) throw new Error('Binance error')
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
  } catch {
    return NextResponse.json({}, { status: 502 })
  }
}
