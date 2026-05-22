export const maxDuration = 60
import { NextResponse } from 'next/server'
import { STATIC_PAIRS } from '@/lib/pairs'

const EXCLUDED_SUFFIXES = ['UP', 'DOWN', 'BULL', 'BEAR', '3L', '3S', '2L', '2S', '5L', '5S']

function toSlash(symbol: string): string {
  return symbol.slice(0, -4) + '/USDT'
}

function isLeverageToken(symbol: string): boolean {
  const base = symbol.slice(0, -4)
  return EXCLUDED_SUFFIXES.some(s => base.endsWith(s))
}

export const revalidate = 3600

export async function GET() {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)

    const [futuresRes, spotRes] = await Promise.allSettled([
      fetch('https://fapi.binance.com/fapi/v1/premiumIndex', {
        signal: ctrl.signal,
        next: { revalidate: 3600 },
      }),
      fetch('https://api.binance.com/api/v3/ticker/price', {
        signal: ctrl.signal,
        next: { revalidate: 3600 },
      }),
    ])
    clearTimeout(timer)

    const priceMap: Record<string, number> = {}
    const pairSet  = new Set<string>()

    if (futuresRes.status === 'fulfilled' && futuresRes.value.ok) {
      const data = await futuresRes.value.json() as Array<{ symbol: string; markPrice?: string }>
      for (const item of data) {
        const { symbol, markPrice } = item
        if (symbol.endsWith('USDT') && !isLeverageToken(symbol)) {
          const pair = toSlash(symbol)
          pairSet.add(pair)
          if (markPrice) priceMap[pair] = parseFloat(markPrice)
        }
      }
    }

    if (spotRes.status === 'fulfilled' && spotRes.value.ok) {
      const data = await spotRes.value.json() as Array<{ symbol: string; price?: string }>
      for (const item of data) {
        const { symbol, price } = item
        if (symbol.endsWith('USDT') && !isLeverageToken(symbol)) {
          const pair = toSlash(symbol)
          pairSet.add(pair)
          if (!priceMap[pair] && price) priceMap[pair] = parseFloat(price)
        }
      }
    }

    if (pairSet.size < 50) {
      return NextResponse.json(STATIC_PAIRS)
    }

    const sorted = Array.from(pairSet).sort((a, b) => {
      const pa = priceMap[a] ?? -1
      const pb = priceMap[b] ?? -1
      return pb - pa
    })

    return NextResponse.json(sorted)
  } catch {
    return NextResponse.json(STATIC_PAIRS)
  }
}
