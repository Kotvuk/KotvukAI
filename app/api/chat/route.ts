export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { getDrawings } from '@/lib/db'
import { loadGroqKeys, getGroqFastModel, GROQ_URL } from '@/lib/groq'

function summarizeDrawings(drawings: unknown[]): string {
  const lines: string[] = []
  for (const d of drawings) {
    const o = d as { name?: string; points?: { value?: number; timestamp?: number }[] }
    if (!o || !Array.isArray(o.points)) continue
    const prices = o.points.map(p => p?.value).filter((v): v is number => typeof v === 'number')
    if (!prices.length) continue
    const type = String(o.name || 'line')
    if (prices.length >= 2) {
      const a = prices[0], b = prices[prices.length - 1]
      const dir = b > a ? 'восходящая' : b < a ? 'нисходящая' : 'горизонтальная'
      lines.push(`${type}: ${dir}, от $${a} до $${b}`)
    } else {
      lines.push(`${type}: уровень $${prices[0]}`)
    }
  }
  return lines.join(' | ')
}

export interface ChatAction {
  type:
    | 'update_markup'
    | 'draw_zone'
    | 'draw_liquidity'
    | 'clear_zones'
    | 'set_opacity'
    | 'set_color'
    | 'navigate_panel'
    | 'trigger_analysis'
  pair?: string; tf?: string
  tp?: number; sl?: number; entry?: number
  zoneType?: 'ob_bullish' | 'ob_bearish' | 'ob_all' | 'fvg_bullish' | 'fvg_bearish' | 'fvg_all'
  priceFrom?: number; priceTo?: number; label?: string; color?: string
  level?: number; side?: 'buy' | 'sell'
  target?: 'all' | 'ob' | 'fvg' | 'liquidity' | 'markup'
  group?: string; opacityValue?: number
  colorTarget?: string; colorValue?: string
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

  let drawingsSummary = ''
  if (ctx.pair && ctx.tf) {
    try {
      const drawings = await getDrawings(Number(user.id), ctx.pair, ctx.tf)
      if (drawings.length) drawingsSummary = summarizeDrawings(drawings)
    } catch {}
  }

  const prompt = `/no_think
You are KotvukAI trading assistant. Parse the user request and respond with a JSON object.

CONTEXT:
- Pair: ${ctx.pair || 'BTC/USDT'}, Timeframe: ${ctx.tf || '1h'}
- Price: $${ctx.price || 'unknown'}
- Signal: ${ctx.verdict || 'none'} | Entry: $${ctx.entry || '?'} | TP: $${ctx.tp || '?'} | SL: $${ctx.sl || '?'}
- SMC Order Blocks: ${JSON.stringify(smcOBs)}
- SMC FVGs: ${JSON.stringify(smcFVGs)}
- SMC Liquidity: ${JSON.stringify(smcLiqs)}
- USER DRAWINGS on chart (trend lines / levels the user drew): ${drawingsSummary || 'none'}

USER REQUEST: "${message}"

AVAILABLE ACTIONS:
- trigger_analysis: { pair?, tf? } — run full AI analysis. tf format: "1м"|"5м"|"15м"|"30м"|"1ч"|"4ч"|"1д"
- update_markup: { tp, sl, entry } — update TP/SL/entry levels on chart
- draw_zone: { zoneType: "ob_bullish"|"ob_bearish"|"fvg_bullish"|"fvg_bearish"|"ob_all"|"fvg_all", priceFrom, priceTo, label, color } — draw zone
- draw_liquidity: { level, side: "buy"|"sell" } — draw liquidity level
- clear_zones: { target: "all"|"ob"|"fvg"|"liquidity"|"markup" } — clear markup
- set_opacity: { group: "ob"|"fvg"|"liquidity"|"all", opacityValue: 0.1-0.9 } — zone opacity
- set_color: { colorTarget: "ob"|"fvg"|"tp"|"sl"|"entry", colorValue: "#hex" } — change color
- navigate_panel: { panel: "dash"|"trades"|"news"|"notifs"|"history" } — navigate to panel

If user says "анализируй" / "analyse" / "analyze" / "запусти анализ" / "дай сигнал" / "what do you think" / "signal" / "проанализируй" — trigger_analysis (include pair and tf only if explicitly stated).
If user says "draw OB" / "order block" / "нарисуй OB" — draw_zone with ob_all. Use ob_bullish/ob_bearish only if explicitly specified.
If user says "FVG" / "фвг" — draw_zone with fvg_all.
If user says "liquidity" / "ликвидность" — draw_liquidity.
If user says "trades" / "сделки" / "журнал" — navigate_panel trades.
If user says "more transparent" / "прозрачнее" — set_opacity 0.15–0.3.
If user says "clear" / "очисти" / "убери" — clear_zones.

If the user asks your opinion about their drawn trend lines / levels (e.g. "я нарисовал трендовые линии, посмотри" / "что думаешь о моих линиях" / "give your opinion on my lines"), do NOT return an action. Instead analyze the USER DRAWINGS above: compare each line's prices to the current price and to the SMC Order Blocks / liquidity, say whether the trend line acts as support or resistance, whether it aligns with the market structure, and give a concrete verdict (is it a valid level to trade from or not). Put this analysis in "text" (4-6 sentences allowed) and set action to null.

Respond in the same language the user used.

Respond ONLY with valid JSON:
{"text":"<response to user; 1-2 sentences for commands, 4-6 sentences when analyzing user's drawings>","action":{"type":"<type>","...fields"} or null if just chat or analysis}`

  const GROQ_KEYS = loadGroqKeys()
  const GROQ_MODEL = getGroqFastModel()
  const shuffledKeys = [...GROQ_KEYS].sort(() => Math.random() - 0.5)

  if (GROQ_KEYS.length === 0) {
    return NextResponse.json({ ok: true, text: 'GROQ_API_KEY is not set. Add the key to environment variables.', action: null })
  }

  try {
    let raw = ''
    for (let attempt = 0; attempt < shuffledKeys.length; attempt++) {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${shuffledKeys[attempt]}` },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 700,
          stream: false,
        }),
        signal: AbortSignal.timeout(30_000),
      })
      if (res.status === 429 || res.status === 401) continue
      if (!res.ok) {
        const errBody = await res.text().catch(() => '')
        throw new Error(`Groq ${res.status}: ${errBody.slice(0, 300)}`)
      }
      const data = await res.json()
      raw = data.choices?.[0]?.message?.content || ''
      break
    }

    if (!raw) return NextResponse.json({ ok: true, text: 'No response from AI model.', action: null })

    const match = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/)
    if (!match) {
      return NextResponse.json({ ok: true, text: raw, action: null })
    }

    const json = JSON.parse(match[1])
    return NextResponse.json({
      ok: true,
      text: String(json.text || 'Done!'),
      action: json.action || null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI error'
    return NextResponse.json({ ok: true, text: msg, action: null })
  }
}
