export const dynamic = 'force-dynamic'
export const maxDuration = 60
import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth-helper'
import { loadGroqKeys, getGroqFastModel, GROQ_URL } from '@/lib/groq'

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

  const prompt = `/no_think
Ты ИИ-ассистент KotvukAI для криптотрейдинга. Разбери запрос пользователя и ответь JSON-объектом.

КОНТЕКСТ:
- Пара: ${ctx.pair || 'BTC/USDT'}, Таймфрейм: ${ctx.tf || '1h'}
- Цена: $${ctx.price || 'неизвестна'}
- Сигнал: ${ctx.verdict || 'нет'} | Вход: $${ctx.entry || '?'} | TP: $${ctx.tp || '?'} | SL: $${ctx.sl || '?'}
- SMC Order Blocks: ${JSON.stringify(smcOBs)}
- SMC FVGs: ${JSON.stringify(smcFVGs)}
- SMC Ликвидность: ${JSON.stringify(smcLiqs)}

ЗАПРОС ПОЛЬЗОВАТЕЛЯ: "${message}"

ДОСТУПНЫЕ ДЕЙСТВИЯ:
- trigger_analysis: { pair?, tf? } — запустить полный AI-анализ. tf в формате: "1м"|"5м"|"15м"|"30м"|"1ч"|"4ч"|"1д"
- update_markup: { tp, sl, entry } — изменить уровни TP/SL/вход на графике
- draw_zone: { zoneType: "ob_bullish"|"ob_bearish"|"fvg_bullish"|"fvg_bearish"|"ob_all"|"fvg_all", priceFrom, priceTo, label, color } — нарисовать зону
- draw_liquidity: { level, side: "buy"|"sell" } — нарисовать уровень ликвидности
- clear_zones: { target: "all"|"ob"|"fvg"|"liquidity"|"markup" } — очистить разметку
- set_opacity: { group: "ob"|"fvg"|"liquidity"|"all", opacityValue: 0.1-0.9 } — прозрачность зон
- set_color: { colorTarget: "ob"|"fvg"|"tp"|"sl"|"entry", colorValue: "#hex" } — изменить цвет
- navigate_panel: { panel: "dash"|"trades"|"news"|"notifs"|"history" } — перейти в панель

Если пользователь говорит "анализируй" / "analyse" / "analyze" / "запусти анализ" / "дай сигнал" / "что думаешь по" / "проверь" / "signal" / "проанализируй" — trigger_analysis (с pair и tf если указаны явно, иначе без них).
Если говорит "нарисуй OB" / "все OB" / "order block" — draw_zone с ob_all. Только если явно сказано бычьи/медвежьи — ob_bullish/ob_bearish.
Если говорит "FVG" / "фвг" — draw_zone с fvg_all.
Если говорит "ликвидность" — draw_liquidity.
Если говорит "сделки" / "журнал" — navigate_panel trades.
Если говорит "прозрачнее" — set_opacity 0.15–0.3.
Если говорит "очисти" / "убери" — clear_zones.

Ответь на том же языке, на котором пользователь написал запрос.

Ответь ТОЛЬКО валидным JSON:
{"text":"<ответ пользователю 1-2 предложения>","action":{"type":"<тип>","...поля"} или null если просто чат}`

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
          max_tokens: 400,
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
