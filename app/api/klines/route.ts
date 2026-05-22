export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const symbol   = searchParams.get('symbol')   || 'BTCUSDT'
  const interval = searchParams.get('interval') || '1h'
  const limit    = searchParams.get('limit')    || '500'
  const endTime  = searchParams.get('endTime')  || ''

  try {
    let url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${Math.min(parseInt(limit) || 500, 1500)}`
    if (endTime) url += `&endTime=${endTime}`

    const isHistorical = !!endTime && Number(endTime) < Date.now() - 90_000

    const r = await fetch(url, {
      next: { revalidate: isHistorical ? 300 : 15 },
      signal: AbortSignal.timeout(10_000),
    })

    if (!r.ok) {
      return NextResponse.json({ ok: false, error: 'Binance error' }, { status: 502 })
    }

    const data = await r.json()

    const formattedData = (data as unknown[][]).map(d => [
      d[0],
      parseFloat(String(d[1])),
      parseFloat(String(d[2])),
      parseFloat(String(d[3])),
      parseFloat(String(d[4])),
      parseFloat(String(d[5])),
    ])

    const res = NextResponse.json(formattedData)
    res.headers.set('Cache-Control', isHistorical
      ? 'public, max-age=300, stale-while-revalidate=60'
      : 'public, max-age=15, stale-while-revalidate=5'
    )
    return res
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'fetch error' }, { status: 500 })
  }
}
