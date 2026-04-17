export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol   = searchParams.get('symbol')   || 'BTCUSDT'
  const interval = searchParams.get('interval') || '1h'
  const limit    = searchParams.get('limit')    || '1000'
  const endTime  = searchParams.get('endTime')  || ''

  try {
    let url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${Math.min(Number(limit), 1500)}`
    if (endTime) url += `&endTime=${endTime}`

    const isHistorical = !!endTime && Number(endTime) < Date.now() - 60_000
    const r = await fetch(url, {
      next: { revalidate: isHistorical ? 60 : 0 },
    })
    if (!r.ok) {
      return NextResponse.json({ ok: false, error: 'Binance error' }, { status: 502 })
    }
    const data = await r.json()

    const res = NextResponse.json(data)

    if (isHistorical) {
      res.headers.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=60')
    }
    return res
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'fetch error' }, { status: 500 })
  }
}
