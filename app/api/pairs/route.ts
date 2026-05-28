export const maxDuration = 60
import { NextResponse } from 'next/server'
import { STATIC_PAIRS, isExcluded } from '@/lib/pairs'

function toSlash(symbol: string): string {
  return symbol.slice(0, -4) + '/USDT'
}

export const revalidate = 1800

export async function GET() {
  try {
    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)

    const res = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex', {
      signal: ctrl.signal,
      next: { revalidate: 1800 },
    })
    clearTimeout(timer)

    if (!res.ok) return NextResponse.json(STATIC_PAIRS)

    const data = await res.json() as Array<{ symbol: string; markPrice?: string }>

    const priceMap: Record<string, number> = {}
    const pairSet  = new Set<string>()

    for (const item of data) {
      const { symbol, markPrice } = item
      if (!symbol.endsWith('USDT') || isExcluded(symbol)) continue
      const pair = toSlash(symbol)
      pairSet.add(pair)
      if (markPrice) priceMap[pair] = parseFloat(markPrice)
    }

    if (pairSet.size < 50) return NextResponse.json(STATIC_PAIRS)

    const sorted = Array.from(pairSet).sort((a, b) => (priceMap[b] ?? -1) - (priceMap[a] ?? -1))
    return NextResponse.json(sorted)
  } catch {
    return NextResponse.json(STATIC_PAIRS)
  }
}
