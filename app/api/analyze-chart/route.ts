export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { analyzeChartImage } from '@/lib/ollama'

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  try {
    const { imageBase64, pair, timeframe, context } = await req.json()
    if (!imageBase64) return NextResponse.json({ ok: false, error: 'imageBase64 required' }, { status: 400 })

    const analysis = await analyzeChartImage(imageBase64, pair || 'BTC/USDT', timeframe || '1h', context || '')

    return NextResponse.json({ ok: true, analysis })
  } catch (e: unknown) {
    console.error('analyze-chart:', e)
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Vision error' }, { status: 500 })
  }
}
