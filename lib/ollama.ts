import { calcEnhancedSMC, type SMCData, type Candle } from './smc'
export type { SMCData, Candle }

const BASE = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
const TEXT_MODEL = process.env.OLLAMA_TEXT_MODEL || 'qwen3:8b'
const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'qwen3-vl:8b'

// ── Types ────────────────────────────────────────────────────────────────────

export interface OllamaTextResponse {
  model: string
  response: string
  done: boolean
}

// ── Core generate ─────────────────────────────────────────────────────────────

async function generate(model: string, prompt: string, images?: string[]): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    prompt,
    stream: false,
    think: false,  // disable reasoning mode (qwen3) — prevents huge <think> blocks
    options: { temperature: 0.7, num_predict: 600 },
  }
  if (images?.length) body.images = images

  const res = await fetch(`${BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240_000),
  })
  if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`)
  const data: OllamaTextResponse = await res.json()
  return data.response
}

// ── Parse JSON from model response ───────────────────────────────────────────

function extractJSON(text: string): Record<string, unknown> {
  // Strip <think>...</think> blocks produced by qwen3 reasoning mode
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  // Try to find JSON block between ```json ... ``` or just { ... }
  const match = cleaned.match(/```json\s*([\s\S]*?)```/) || cleaned.match(/(\{[\s\S]*\})/)
  if (!match) throw new Error('No JSON found in response')
  return JSON.parse(match[1])
}

// ── Step 1: Technical Analysis ────────────────────────────────────────────────

export async function technicalAnalysis(pair: string, tf: string, market: MarketData): Promise<Step1Result> {
  const prompt = `Ты опытный технический аналитик криптовалют. Проведи анализ ${pair} (${tf}).

Данные рынка:
- Цена: $${market.price}
- RSI(14): ${market.rsi}
- MACD сигнал: ${market.macdSignal}
- EMA50: цена ${market.priceVsEma50}
- EMA200: цена ${market.priceVsEma200}
- Объём: ${market.volSignal}
- Funding Rate: ${market.fundingRate}%
- Последние свечи (OHLCV, последние 10): ${JSON.stringify(market.recentCandles)}
- Поддержки: ${market.supports.join(', ')}
- Сопротивления: ${market.resistances.join(', ')}

Верни ТОЛЬКО JSON без комментариев:
{
  "signal": "LONG" | "SHORT" | "WAIT",
  "strength": <число 1-10>,
  "trend": "восходящий" | "нисходящий" | "боковой",
  "summary": "<краткий технический анализ 2-3 предложения>"
}`
  const raw = await generate(TEXT_MODEL, prompt)
  const json = extractJSON(raw)
  return {
    signal: String(json.signal || 'WAIT'),
    strength: Number(json.strength || 5),
    trend: String(json.trend || 'боковой'),
    summary: String(json.summary || ''),
  }
}

// ── Step 2: Risk Assessment ───────────────────────────────────────────────────

export async function riskAssessment(
  pair: string,
  tf: string,
  step1: Step1Result,
  market: MarketData
): Promise<Step2Result> {
  const prompt = `Ты риск-менеджер крипто-трейдинга. Оцени риск для ${pair} (${tf}).

Технический анализ: ${step1.signal} (сила: ${step1.strength}/10)
Тренд: ${step1.trend}
Цена: $${market.price}
Фандинг: ${market.fundingRate}%
RSI: ${market.rsi}

Учти: фандинг-рейт, перекупленность/перепроданность, силу тренда.

Верни ТОЛЬКО JSON:
{
  "verdict": "LONG" | "SHORT" | "WAIT",
  "confidence": <число 0-100>,
  "risk_score": <число 1-10, где 10 = очень рискованно>,
  "leverage": <рекомендованное плечо 1-20>,
  "summary": "<объяснение риска 1-2 предложения>"
}`
  const raw = await generate(TEXT_MODEL, prompt)
  const json = extractJSON(raw)
  return {
    verdict: String(json.verdict || 'WAIT'),
    confidence: Number(json.confidence || 50),
    risk_score: Number(json.risk_score || 5),
    leverage: Number(json.leverage || 3),
    summary: String(json.summary || ''),
  }
}

// ── Step 3: Final Synthesis ───────────────────────────────────────────────────

export async function finalSynthesis(
  pair: string,
  tf: string,
  step1: Step1Result,
  step2: Step2Result,
  market: MarketData
): Promise<FinalResult> {
  const price = market.price
  const prompt = `Ты главный аналитик крипто-фонда. Синтезируй финальный торговый сигнал для ${pair} (${tf}).

Технический анализ: ${step1.signal} (сила ${step1.strength}/10) — ${step1.summary}
Риск-менеджмент: ${step2.verdict} (уверенность ${step2.confidence}%, риск ${step2.risk_score}/10) — ${step2.summary}
Текущая цена: $${price}
Рекомендованное плечо: ${step2.leverage}x

Верни ТОЛЬКО валидный JSON:
{
  "verdict": "LONG" | "SHORT" | "WAIT",
  "confidence": <0-100>,
  "risk_score": <1-10>,
  "leverage": <1-20>,
  "entry_price": <число>,
  "entry_type": "market" | "limit",
  "tp_price": <число>,
  "tp_pct": <процент от entry>,
  "sl_price": <число>,
  "sl_pct": <процент от entry>,
  "full_description": "<полное описание 3-4 предложения>",
  "entry_instruction": "<конкретная инструкция входа>",
  "exit_instruction": "<конкретная инструкция выхода>",
  "why_this_signal": "<подробное объяснение почему именно этот сигнал>",
  "insights": [
    {"icon": "📊", "tag": "ТРЕНД", "text": "<инсайт>"},
    {"icon": "🎯", "tag": "УРОВЕНЬ", "text": "<инсайт>"},
    {"icon": "⚠️", "tag": "РИСК", "text": "<инсайт>"}
  ]
}`
  const raw = await generate(TEXT_MODEL, prompt)
  const json = extractJSON(raw)
  const entryPrice = Number(json.entry_price || price)
  const tpPrice = Number(json.tp_price || price)
  const slPrice = Number(json.sl_price || price)
  return {
    verdict: String(json.verdict || 'WAIT'),
    confidence: Number(json.confidence || 50),
    risk_score: Number(json.risk_score || 5),
    leverage: Number(json.leverage || 3),
    entry_price: entryPrice,
    entry_type: String(json.entry_type || 'market') as 'market' | 'limit',
    tp_price: tpPrice,
    tp_pct: json.tp_pct ? Number(json.tp_pct) : parseFloat(((tpPrice - entryPrice) / entryPrice * 100).toFixed(2)),
    sl_price: slPrice,
    sl_pct: json.sl_pct ? Number(json.sl_pct) : parseFloat(((entryPrice - slPrice) / entryPrice * 100).toFixed(2)),
    full_description: String(json.full_description || ''),
    entry_instruction: String(json.entry_instruction || ''),
    exit_instruction: String(json.exit_instruction || ''),
    why_this_signal: String(json.why_this_signal || ''),
    insights: Array.isArray(json.insights) ? json.insights : [],
  }
}

// ── Combined single-call analysis (3x faster than 3 separate calls) ──────────

export async function fullAnalysis(
  pair: string,
  tf: string,
  market: MarketData
): Promise<{ step1: Step1Result; step2: Step2Result; final: FinalResult }> {
  const price = market.price
  const rsiLabel = market.rsi < 30 ? 'OVERSOLD 🔥' : market.rsi > 70 ? 'OVERBOUGHT ⚠️' : 'neutral'
  const fundingLabel = (market.fundingRate ?? 0) > 0.05 ? 'overheated longs' : (market.fundingRate ?? 0) < -0.01 ? 'bearish' : 'neutral'
  const nearestSupport = market.supports[0] ?? price * 0.98
  const nearestResistance = market.resistances[0] ?? price * 1.02

  const prompt = `/no_think
You are a senior crypto futures analyst. Analyze ${pair} on ${tf} timeframe and produce a precise trading signal.

MARKET CONDITIONS:
- Price: $${price}
- RSI(14): ${market.rsi} [${rsiLabel}]
- MACD: ${market.macdSignal} crossover
- EMA50: price ${market.priceVsEma50} (short-term bias)
- EMA200: price ${market.priceVsEma200} (long-term bias)
- Volume: ${market.volSignal}
- Funding rate: ${market.fundingRate}% [${fundingLabel}]
- Key support: $${nearestSupport} | Key resistance: $${nearestResistance}
- All supports: ${market.supports.join(', ')} | All resistances: ${market.resistances.join(', ')}
- SMC trend: ${market.smc.trend} | HTF bias: ${market.smc.htfBias} | BOS: ${market.smc.bosLevel ?? 'n/a'} | COB: ${market.smc.cob ?? 'n/a'}
- Order Blocks: ${market.smc.orderBlocks.slice(0,3).map(o=>`${o.type}[${o.quality}/${o.strength}] ${o.low}-${o.high}`).join(', ') || 'none'}
- Breaker Blocks: ${market.smc.breakerBlocks.slice(0,2).map(b=>`${b.type}[BB] ${b.low}-${b.high}`).join(', ') || 'none'}
- FVGs: ${market.smc.fvgs.slice(0,3).map(f=>`${f.type}[${f.quality}] ${f.low}-${f.high} fill:${f.fillPct}%`).join(', ') || 'none'}
- Liquidity: ${market.smc.liquidityLevels.slice(0,4).map(l=>`${l.type}[${l.strength}]@${l.price}${l.isSwept?'(swept)':''}`).join(', ') || 'none'}
- SMC Probability: ${market.smc.probability.scenario} ${market.smc.probability.probability}% | R:R ${market.smc.probability.riskReward} | Sweeps: ${market.smc.sweepCount}

RULES:
- TP must be at nearest resistance (LONG) or support (SHORT), minimum 0.5% from entry
- SL must be just below nearest support (LONG) or above resistance (SHORT)
- Risk/Reward >= 1.5:1 always
- Low RSI + bullish MACD + price above EMA = strong LONG signal
- High RSI + bearish MACD + price below EMA = strong SHORT signal
- Conflicting signals = WAIT or low confidence

Output ONLY valid JSON (all prices in USD, all numbers as integers/decimals):
{"v":"LONG|SHORT|WAIT","c":<51-95>,"r":<1-10>,"l":<1-20>,"e":${price},"et":"market|limit","tp":<tp_usd>,"sl":<sl_usd>,"trend":"восходящий|нисходящий|боковой","desc":"<analysis 2-3 sentences in Russian>","entry_why":"<entry reason in Russian>","exit_why":"<exit conditions in Russian>","i1":"<trend insight in Russian>","i2":"<level insight in Russian>","i3":"<risk insight in Russian>"}`

  const raw = await generate(TEXT_MODEL, prompt)
  const json = extractJSON(raw)

  const verdict = String(json.v || json.verdict || 'WAIT')
  const confidence = Number(json.c || json.confidence || 50)
  const riskScore = Number(json.r || json.risk_score || 5)
  const leverage = Number(json.l || json.leverage || 3)
  const entryPrice = Number(json.e || json.entry_price || price)
  const tpPrice = Number(json.tp || json.tp_price || price * 1.01)
  const slPrice = Number(json.sl || json.sl_price || price * 0.99)
  const entryType = String(json.et || json.entry_type || 'market') as 'market' | 'limit'
  const trend = String(json.trend || (market.macdSignal === 'бычий' ? 'восходящий' : 'нисходящий'))
  const desc = String(json.desc || json.w || json.why_this_signal || '')
  const entryWhy = String(json.entry_why || desc)
  const exitWhy = String(json.exit_why || '')
  const i1 = String(json.i1 || trend)
  const i2 = String(json.i2 || `Вход $${entryPrice} → TP $${tpPrice}`)
  const i3 = String(json.i3 || `SL $${slPrice} | Риск ${riskScore}/10`)

  const step1: Step1Result = {
    signal: verdict,
    strength: Math.round(confidence / 10),
    trend,
    summary: desc,
  }
  const step2: Step2Result = {
    verdict,
    confidence,
    risk_score: riskScore,
    leverage,
    summary: entryWhy,
  }
  const final: FinalResult = {
    verdict,
    confidence,
    risk_score: riskScore,
    leverage,
    entry_price: entryPrice,
    entry_type: entryType,
    tp_price: tpPrice,
    tp_pct: parseFloat(((tpPrice - entryPrice) / entryPrice * 100).toFixed(2)),
    sl_price: slPrice,
    sl_pct: parseFloat(((entryPrice - slPrice) / entryPrice * 100).toFixed(2)),
    full_description: desc,
    entry_instruction: entryWhy,
    exit_instruction: exitWhy,
    why_this_signal: desc,
    insights: [
      { icon: '📊', tag: 'ТРЕНД', text: i1 },
      { icon: '🎯', tag: 'УРОВЕНЬ', text: i2 },
      { icon: '⚠️', tag: 'РИСК', text: i3 },
    ],
  }
  return { step1, step2, final }
}

// ── Vision Analysis ───────────────────────────────────────────────────────────

export async function analyzeChartImage(
  imageBase64: string,
  pair: string,
  tf: string,
  context: string
): Promise<string> {
  const prompt = `Ты опытный технический аналитик криптовалют. Проанализируй этот свечной график ${pair} (${tf}).
${context ? `Контекст: ${context}` : ''}

Опиши:
1. Текущий тренд и структуру рынка
2. Ключевые уровни поддержки и сопротивления видимые на графике
3. Свечные паттерны (если есть)
4. Рекомендацию: LONG / SHORT / WAIT с кратким обоснованием

Отвечай на русском языке, чётко и структурированно.`
  return await generate(VISION_MODEL, prompt, [imageBase64])
}

// ── Market Data Calculation ───────────────────────────────────────────────────

export interface MarketData {
  price: number
  rsi: number
  macdSignal: string
  priceVsEma50: string
  priceVsEma200: string
  volSignal: string
  fundingRate: number | null
  fundingSignal: string | null
  supports: number[]
  resistances: number[]
  recentCandles: { o: number; h: number; l: number; c: number; v: number }[]
  smc: SMCData
}

export function calcMarketData(candles: Candle[], fundingRate: number | null): MarketData {
  const closes = candles.map(c => c.close)
  const price = closes[closes.length - 1]

  // RSI(14)
  const rsi = calcRSI(closes, 14)

  // EMA
  const ema50 = calcEMA(closes, 50)
  const ema200 = calcEMA(closes, 200)

  // MACD
  const macd = calcMACD(closes)

  // Volume signal
  const recentVols = candles.slice(-10).map(c => c.volume)
  const avgVol = recentVols.slice(0, -1).reduce((a, b) => a + b, 0) / (recentVols.length - 1)
  const volSignal = recentVols[recentVols.length - 1] > avgVol * 1.2 ? 'растущий' : 'нейтральный'

  // S/R levels (simple: recent swing highs/lows)
  const { supports, resistances } = findSRLevels(candles.slice(-50), price)

  // Recent candles for prompt
  const recentCandles = candles.slice(-10).map(c => ({
    o: parseFloat(c.open.toFixed(2)),
    h: parseFloat(c.high.toFixed(2)),
    l: parseFloat(c.low.toFixed(2)),
    c: parseFloat(c.close.toFixed(2)),
    v: parseFloat((c.volume / 1000).toFixed(1)),
  }))

  const smc = calcEnhancedSMC(candles, fundingRate)

  return {
    price,
    rsi: parseFloat(rsi.toFixed(1)),
    macdSignal: macd > 0 ? 'бычий' : 'медвежий',
    priceVsEma50: price > ema50 ? 'выше' : 'ниже',
    priceVsEma200: price > ema200 ? 'выше' : 'ниже',
    volSignal,
    fundingRate,
    fundingSignal: fundingRate !== null ? (fundingRate > 0.05 ? 'перегрет' : fundingRate < -0.01 ? 'медвежий' : 'нейтральный') : null,
    supports,
    resistances,
    recentCandles,
    smc,
  }
}

// ── Indicator helpers ─────────────────────────────────────────────────────────

function calcEMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1]
  const k = 2 / (period + 1)
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k)
  return ema
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff; else losses -= diff
  }
  let avgGain = gains / period, avgLoss = losses / period
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period
  }
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function calcMACD(closes: number[]): number {
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  return ema12 - ema26
}

function findSRLevels(candles: Candle[], price: number): { supports: number[]; resistances: number[] } {
  const pivots: number[] = []
  for (let i = 2; i < candles.length - 2; i++) {
    const isHigh = candles[i].high > candles[i-1].high && candles[i].high > candles[i-2].high &&
                   candles[i].high > candles[i+1].high && candles[i].high > candles[i+2].high
    const isLow  = candles[i].low < candles[i-1].low && candles[i].low < candles[i-2].low &&
                   candles[i].low < candles[i+1].low && candles[i].low < candles[i+2].low
    if (isHigh) pivots.push(candles[i].high)
    if (isLow)  pivots.push(candles[i].low)
  }
  const supports     = pivots.filter(p => p < price).sort((a, b) => b - a).slice(0, 3).map(p => parseFloat(p.toFixed(2)))
  const resistances  = pivots.filter(p => p > price).sort((a, b) => a - b).slice(0, 3).map(p => parseFloat(p.toFixed(2)))
  return { supports, resistances }
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface Step1Result {
  signal: string
  strength: number
  trend: string
  summary: string
}

export interface Step2Result {
  verdict: string
  confidence: number
  risk_score: number
  leverage: number
  summary: string
}

export interface FinalResult {
  verdict: string
  confidence: number
  risk_score: number
  leverage: number
  entry_price: number
  entry_type: 'market' | 'limit'
  tp_price: number
  tp_pct: number
  sl_price: number
  sl_pct: number
  full_description: string
  entry_instruction: string
  exit_instruction: string
  why_this_signal: string
  insights: { icon: string; tag: string; text: string }[]
}
