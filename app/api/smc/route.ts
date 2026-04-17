export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { calcEnhancedSMC } from '@/lib/smc'

const TF_MAP: Record<string, string> = {
  '1м': '1m', '5м': '5m', '15м': '15m', '30м': '30m',
  '1ч': '1h', '4ч': '4h', '1д': '1d',
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { pair, timeframe, candles: clientCandles } = body
  if (!pair || !timeframe) return NextResponse.json({ ok: false, error: 'pair and timeframe required' }, { status: 400 })

  const sym      = pair.replace('/', '')
  const interval = TF_MAP[timeframe] || '1h'

  try {
    let fundingRate: number | null = null
    try {
      const fr = await fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${sym}&limit=1`)
      const fd: { fundingRate?: string }[] = await fr.json()
      if (fd[0]?.fundingRate) fundingRate = parseFloat(fd[0].fundingRate) * 100
    } catch {  }

    let candles: { timestamp: number; open: number; high: number; low: number; close: number; volume: number }[]
    if (Array.isArray(clientCandles) && clientCandles.length > 0) {
      candles = clientCandles
    } else {
      const res = await fetch(
        `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=1500`
      )
      const raw: number[][] = await res.json()
      if (!Array.isArray(raw)) throw new Error('Binance error')
      candles = raw.map(c => ({
        timestamp: c[0],
        open:   parseFloat(String(c[1])),
        high:   parseFloat(String(c[2])),
        low:    parseFloat(String(c[3])),
        close:  parseFloat(String(c[4])),
        volume: parseFloat(String(c[5])),
      }))
    }

    const smc = calcEnhancedSMC(candles, fundingRate)

    return NextResponse.json({ ok: true, smc })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
