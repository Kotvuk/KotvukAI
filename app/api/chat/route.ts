export const dynamic = 'force-dynamic'
export const maxDuration = 120
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'

const BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const TEXT_MODEL = process.env.OLLAMA_TEXT_MODEL || 'qwen3:1.7b'

export interface ChatAction {
  type:
    | 'update_markup'
    | 'draw_zone'
    | 'draw_liquidity'
    | 'clear_zones'
    | 'set_opacity'
    | 'set_color'
    | 'navigate_panel'
  // update_markup
  tp?: number; sl?: number; entry?: number
  // draw_zone (OB or FVG)
  zoneType?: 'ob_bullish' | 'ob_bearish' | 'fvg_bullish' | 'fvg_bearish'
  priceFrom?: number; priceTo?: number; label?: string; color?: string
  // draw_liquidity
  level?: number; side?: 'buy' | 'sell'
  // clear_zones
  target?: 'all' | 'ob' | 'fvg' | 'liquidity' | 'markup'
  // set_opacity
  group?: string; opacityValue?: number
  // set_color
  colorTarget?: string; colorValue?: string
  // navigate_panel
  panel?: 'dash' | 'ai' | 'trades' | 'news' | 'notifs' | 'history'
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { message, context } = body as {
    message: string
    context?: {
      pair?: string; tf?: string; price?: number
      tp?: number; sl?: number; entry?: number; verdict?: string
      smc?: { orderBlocks?: unknown[]; fvgs?: unknown[]; liquidityLevels?: unknown[] }
    }
  }

  if (!message?.trim()) return NextResponse.json({ ok: false, error: 'Empty message' }, { status: 400 })

  const ctx = context || {}
  const smcOBs = ctx.smc?.orderBlocks?.slice(0, 3) || []
  const smcFVGs = ctx.smc?.fvgs?.slice(0, 3) || []
  const smcLiqs = ctx.smc?.liquidityLevels?.slice(0, 4) || []

  const prompt = `/no_think
You are KotvukAI assistant for a crypto trading platform. Parse the user's request and respond with a JSON object.

CURRENT CONTEXT:
- Pair: ${ctx.pair || 'BTC/USDT'}, Timeframe: ${ctx.tf || '1h'}
- Price: $${ctx.price || 'unknown'}
- Signal: ${ctx.verdict || 'none'} | Entry: $${ctx.entry || '?'} | TP: $${ctx.tp || '?'} | SL: $${ctx.sl || '?'}
- SMC Order Blocks: ${JSON.stringify(smcOBs)}
- SMC FVGs: ${JSON.stringify(smcFVGs)}
- SMC Liquidity: ${JSON.stringify(smcLiqs)}

USER REQUEST: "${message}"

SUPPORTED ACTIONS:
- update_markup: { tp, sl, entry } — change TP/SL/entry levels on chart
- draw_zone: { zoneType: "ob_bullish"|"ob_bearish"|"fvg_bullish"|"fvg_bearish", priceFrom, priceTo, label, color } — draw a price zone
- draw_liquidity: { level, side: "buy"|"sell" } — draw a liquidity level
- clear_zones: { target: "all"|"ob"|"fvg"|"liquidity"|"markup" } — clear drawings
- set_opacity: { group: "ob"|"fvg"|"liquidity"|"all", opacityValue: 0.1-0.9 } — change opacity
- set_color: { colorTarget: "ob"|"fvg"|"tp"|"sl"|"entry", colorValue: "#hexcolor" } — change color
- navigate_panel: { panel: "dash"|"trades"|"news"|"notifs"|"history" } — switch panel

RULES:
- If user says "нарисуй OB" / "draw OB" / "order block" — use draw_zone with ob_bullish or ob_bearish based on context
- If user says "FVG" / "фвг" / "fair value gap" — use draw_zone with fvg type
- If user says "ликвидность" / "liquidity" — use draw_liquidity
- If user says "сделки" / "trades" / "журнал" — use navigate_panel with trades
- If user says "сделай прозрачнее" / "more transparent" — use set_opacity with lower value (0.15-0.3)
- If user says "измени цвет" / "change color" — use set_color
- If user says "очисти" / "clear" / "убери" — use clear_zones
- For price values, use the context SMC data if available and user doesn't specify exact levels
- Respond in Russian if user writes in Russian, in English if English

Return ONLY valid JSON:
{
  "text": "<natural language response in user's language, 1-2 sentences>",
  "action": { "type": "<action_type>", ...fields } or null if just chatting
}`

  try {
    const res = await fetch(`${BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: TEXT_MODEL,
        prompt,
        stream: false,
        think: false,
        options: { temperature: 0.3, num_predict: 400 },
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
    const data = await res.json()
    const raw: string = data.response || ''

    // Clean think blocks
    const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    const match = cleaned.match(/```json\s*([\s\S]*?)```/) || cleaned.match(/(\{[\s\S]*\})/)

    if (!match) {
      return NextResponse.json({ ok: true, text: cleaned || 'Готово!', action: null })
    }

    const json = JSON.parse(match[1])
    return NextResponse.json({
      ok: true,
      text: String(json.text || 'Готово!'),
      action: json.action || null,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'AI error'
    console.error('chat:', msg)
    // Fallback: try to give a helpful response without AI
    return NextResponse.json({
      ok: true,
      text: 'Ollama недоступен. Убедитесь что Ollama запущен: ollama serve',
      action: null,
    })
  }
}
