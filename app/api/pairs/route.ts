import { NextResponse } from 'next/server'
import { STATIC_PAIRS } from '@/lib/pairs'

const EXCLUDED_SUFFIXES = ['UP', 'DOWN', 'BULL', 'BEAR', '3L', '3S', '2L', '2S', '5L', '5S']

const TOP_COINS = [
  'BTC','ETH','BNB','SOL','XRP','ADA','DOGE','AVAX','DOT',
  'POL','LTC','BCH','TRX','ETC','XLM','ATOM','LINK','UNI',
]

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

    const pairSet = new Set<string>()

    if (futuresRes.status === 'fulfilled' && futuresRes.value.ok) {
      const data = await futuresRes.value.json() as Array<{ symbol: string }>
      for (const { symbol } of data) {
        if (symbol.endsWith('USDT') && !isLeverageToken(symbol)) {
          pairSet.add(toSlash(symbol))
        }
      }
    }

    if (spotRes.status === 'fulfilled' && spotRes.value.ok) {
      const data = await spotRes.value.json() as Array<{ symbol: string }>
      for (const { symbol } of data) {
        if (symbol.endsWith('USDT') && !isLeverageToken(symbol)) {
          pairSet.add(toSlash(symbol))
        }
      }
    }

    if (pairSet.size < 50) {
      return NextResponse.json(STATIC_PAIRS)
    }

    const sorted = Array.from(pairSet).sort((a, b) => {
      const ac = a.split('/')[0]
      const bc = b.split('/')[0]
      const ai = TOP_COINS.indexOf(ac)
      const bi = TOP_COINS.indexOf(bc)
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return ac.localeCompare(bc)
    })

    return NextResponse.json(sorted)
  } catch {
    return NextResponse.json(STATIC_PAIRS)
  }
}
