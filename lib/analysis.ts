import { calcEnhancedSMC, scoreOrderBlock, type SMCData, type OrderBlock, type Candle } from './smc'
import { loadGroqKeys, getGroqModel, getGroqFastModel, groqGenerate } from './groq'
import { analyzeIndicators, analyzePriceAction, analyzeWyckoff, analyzeVolumeProfile, analyzeFunding, calcConsensus, type MethodResult, type ConsensusResult } from './indicators'
export type { SMCData, Candle }

function extractJSON(text: string): Record<string, unknown> {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  const match = cleaned.match(/```json\s*([\s\S]*?)```/) || cleaned.match(/(\{[\s\S]*\})/)
  if (!match) throw new Error('No JSON found in response')
  return JSON.parse(match[1])
}

async function parseJSON(
  raw: string,
  keys: string[],
  model: string,
  originalPrompt: string,
  maxTokens: number,
  temperature: number,
  systemPrompt?: string,
  reasoningEffort?: 'low' | 'medium' | 'high',
): Promise<Record<string, unknown>> {
  try { return extractJSON(raw) } catch {}

  const retryPrompt = `/no_think
Previous response contained invalid JSON. Return ONLY clean valid JSON without markdown, without explanation.
Task was: ${originalPrompt.slice(0, 200)}...`
  const retryRaw = await groqGenerate(keys, model, retryPrompt, maxTokens, temperature, systemPrompt, reasoningEffort)
  try { return extractJSON(retryRaw) } catch {}

  const simplePrompt = `/no_think
Return ONLY one line of valid JSON (no markdown, no explanation): {"v":"WAIT","c":50,"r":5}`
  const simpleRaw = await groqGenerate(keys, model, simplePrompt, 100, 0.0)
  return extractJSON(simpleRaw)
}

function getContext(market: MarketData): string {
  const price = market.price
  const smc = market.smc

  const qualityOrder: Record<string, number> = { 'A+': 0, 'A': 1, 'B': 2, 'C': 3 }
  const sortOBs = (obs: typeof smc.orderBlocks) =>
    [...obs].sort((a, b) => (qualityOrder[a.quality] ?? 9) - (qualityOrder[b.quality] ?? 9))

  const bullOBs = sortOBs(smc.orderBlocks.filter(o => o.type === 'bullish' && !o.isMitigated))
  const bearOBs = sortOBs(smc.orderBlocks.filter(o => o.type === 'bearish' && !o.isMitigated))
  const demandOBs = bullOBs.filter(o => o.high < price).slice(0, 3)
  const supplyOBs = bearOBs.filter(o => o.low > price).slice(0, 3)

  const fmtOB = (o: typeof smc.orderBlocks[0]) =>
    `[${o.quality}/${o.strength}] $${o.low.toFixed(2)}-$${o.high.toFixed(2)} | dist:${((Math.abs(price - o.mid) / price) * 100).toFixed(2)}% | touches:${o.touchCount} | relVol:${o.relVolume.toFixed(1)}x | age:${o.ageCandles}c`

  const breakerBull = smc.breakerBlocks.filter(b => b.type === 'bullish').slice(0, 2)
  const breakerBear = smc.breakerBlocks.filter(b => b.type === 'bearish').slice(0, 2)
  const fmtBB = (b: typeof smc.breakerBlocks[0]) =>
    `[BB/${b.strength}] $${b.low.toFixed(2)}-$${b.high.toFixed(2)}`

  const fvgsAbove = smc.fvgs.filter(f => f.type === 'bullish' && f.low > price && !f.isFilled).slice(0, 3)
  const fvgsBelow = smc.fvgs.filter(f => f.type === 'bearish' && f.high < price && !f.isFilled).slice(0, 3)
  const fmtFVG = (f: typeof smc.fvgs[0]) =>
    `[${f.quality}] $${f.low.toFixed(2)}-$${f.high.toFixed(2)} | gap:${f.gapPct.toFixed(2)}% | filled:${f.fillPct}%`

  const bsl = smc.liquidityLevels.filter(l => l.type === 'buy' && l.price > price && !l.isSwept)
    .sort((a, b) => a.price - b.price).slice(0, 3)
  const ssl = smc.liquidityLevels.filter(l => l.type === 'sell' && l.price < price && !l.isSwept)
    .sort((a, b) => b.price - a.price).slice(0, 3)
  const fmtLiq = (l: typeof smc.liquidityLevels[0]) =>
    `$${l.price.toFixed(2)} [${l.strength}] touches:${l.touchCount}`

  const alerts = smc.probability.alerts.slice(0, 3)
    .map(a => `[Stage${a.stage}/${a.level.toUpperCase()}] ${a.type} @$${a.price} conf:${a.confidence}%`)
    .join('\n  ')

  const funding = market.fundingRate ?? 0
  const fundingCtx = funding > 0.1 ? 'EXTREME LONGS — probable short squeeze / correction'
    : funding > 0.05 ? 'Longs overheated — bearish pressure'
    : funding < -0.05 ? 'EXTREME SHORTS — probable squeeze up'
    : funding < -0.01 ? 'Shorts heavy — bullish pressure'
    : 'Neutral'

  const htfBias = (market.htfBias || smc.htfBias || 'neutral').toUpperCase()

  const rsiInterp = market.rsi > 70 ? '🔴 overbought'
    : market.rsi > 60 ? '🟡 moderately overbought'
    : market.rsi < 30 ? '🟢 oversold'
    : market.rsi < 40 ? '🟡 moderately oversold'
    : '⚪ neutral'

  const last5 = market.recentCandles.slice(-5)
  const candleLines = last5.map((c, i) => {
    const dir = c.c > c.o ? '▲' : c.c < c.o ? '▼' : '—'
    const bodyPct = Math.abs(c.c - c.o) / c.o * 100
    return `  [${i + 1}] ${dir} O:${c.o} H:${c.h} L:${c.l} C:${c.c} V:${c.v}k body:${bodyPct.toFixed(1)}%`
  }).join('\n')

  return `
━━━ TECHNICAL INDICATORS ━━━
RSI-14: ${market.rsi.toFixed(1)} ${rsiInterp}
MACD: ${market.macdSignal} | EMA-50: price ${market.priceVsEma50} | EMA-200: price ${market.priceVsEma200}
Volume: ${market.volSignal} | ATR-14: ${market.atr14pct}%
Funding: ${funding.toFixed(4)}% → ${fundingCtx}

━━━ LAST 5 CANDLES (OHLCV, V in thousands) ━━━
${candleLines}

━━━ MARKET STRUCTURE ━━━
HTF bias: ${htfBias} | Trend: ${smc.trend}
${smc.bosLevel ? `BOS at $${smc.bosLevel} → confirms ${htfBias} structure` : 'No BOS detected'}
${smc.cob ? `COB (change of character) at $${smc.cob}` : ''}
Liquidity sweeps last 10 candles: ${smc.sweepCount}

━━━ DEMAND ZONES (bullish OBs below price) ━━━
${demandOBs.length ? demandOBs.map(fmtOB).join('\n') : 'None detected'}

━━━ SUPPLY ZONES (bearish OBs above price) ━━━
${supplyOBs.length ? supplyOBs.map(fmtOB).join('\n') : 'None detected'}

━━━ BREAKER BLOCKS (highest priority) ━━━
Bullish (support): ${breakerBull.length ? breakerBull.map(fmtBB).join(' | ') : 'none'}
Bearish (resistance): ${breakerBear.length ? breakerBear.map(fmtBB).join(' | ') : 'none'}

━━━ FAIR VALUE GAPS ━━━
Above price (LONG targets): ${fvgsAbove.length ? fvgsAbove.map(fmtFVG).join('\n  ') : 'none above'}
Below price (SHORT targets): ${fvgsBelow.length ? fvgsBelow.map(fmtFVG).join('\n  ') : 'none below'}

━━━ LIQUIDITY ━━━
BSL (above price, SHORT magnets): ${bsl.length ? bsl.map(fmtLiq).join(' | ') : 'none'}
SSL (below price, LONG magnets): ${ssl.length ? ssl.map(fmtLiq).join(' | ') : 'none'}

━━━ PRE-SIGNAL SMC ENGINE ━━━
Scenario: ${smc.probability.scenario} | Probability: ${smc.probability.probability}% | Confidence: ${smc.probability.confidence}%
R:R model: ${smc.probability.riskReward} | Expected R: ${smc.probability.expectedR}
Active alerts:
  ${alerts || 'none'}`.trim()
}

function findEntry(verdict: string, price: number, aiEntry: number, smc: SMCData): { entry: number; ob: OrderBlock | null } {
  const qRank = (q: string) => ({ 'A+': 4, 'A': 3, 'B': 2, 'C': 1 }[q] ?? 0)

  if (verdict === 'LONG') {
    const ob = [...smc.orderBlocks]
      .filter(o => o.type === 'bullish' && !o.isMitigated && o.high <= price * 1.006 && o.high >= price * 0.94)
      .sort((a, b) => qRank(b.quality) - qRank(a.quality) || b.high - a.high)[0]
    if (ob) {
      return {
        entry: parseFloat((ob.high - (ob.high - ob.low) * 0.705).toFixed(2)),
        ob,
      }
    }
  } else if (verdict === 'SHORT') {
    const ob = [...smc.orderBlocks]
      .filter(o => o.type === 'bearish' && !o.isMitigated && o.low >= price * 0.994 && o.low <= price * 1.06)
      .sort((a, b) => qRank(b.quality) - qRank(a.quality) || a.low - b.low)[0]
    if (ob) {
      return {
        entry: parseFloat((ob.low + (ob.high - ob.low) * 0.705).toFixed(2)),
        ob,
      }
    }
  }
  return { entry: aiEntry, ob: null }
}

interface MemorySignal {
  pair: string; timeframe: string; final_verdict: string | null
  final_confidence: number | null; final_entry: number | null
  final_tp: number | null; final_sl: number | null
  outcome: 'win' | 'loss' | null; actual_pnl_pct: number | null
  raw_response?: Record<string, unknown> | null
  created_at: string
}

function extractSignalConditions(raw: Record<string, unknown> | null | undefined): string[] {
  if (!raw) return []
  const m = raw.market as Record<string, unknown> | undefined
  const pipe = raw.pipeline as Record<string, unknown> | undefined
  const s1 = pipe?.step1 as Record<string, unknown> | undefined
  const finalData = (raw.analysis || raw.final) as Record<string, unknown> | undefined
  const obUsed = finalData?.ob_used as Record<string, unknown> | undefined

  const rsi = m?.rsi !== undefined ? Number(m.rsi) : null
  const funding = m?.fundingRate !== undefined ? Number(m.fundingRate) : null
  const trend = String(s1?.trend || m?.htfBias || '')
  const obQ = String(obUsed?.quality || '')

  const out: string[] = []
  if (rsi !== null && rsi > 0) {
    const flag = rsi > 70 ? '🔴' : rsi > 65 ? '⚠️' : rsi < 30 ? '🟢' : ''
    out.push(`RSI=${rsi.toFixed(0)}${flag}`)
  }
  if (trend) out.push(`trend=${trend}`)
  if (obQ) out.push(`OB=${obQ}`)
  if (funding !== null && Math.abs(funding) > 0.01) out.push(`funding=${funding > 0 ? '+' : ''}${funding.toFixed(3)}%${funding > 0.05 ? '⚠️' : ''}`)
  return out
}

function getHistory(signals: MemorySignal[], globalPatterns = ''): string {
  if (!signals.length) return globalPatterns

  const wins    = signals.filter(s => s.outcome === 'win')
  const losses  = signals.filter(s => s.outcome === 'loss')
  const pending = signals.filter(s => !s.outcome)

  const fmtLine = (s: MemorySignal, tag: string) => {
    const d = new Date(s.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })
    const pnlNum = s.actual_pnl_pct != null ? Number(s.actual_pnl_pct) : null
    const pnl = pnlNum != null ? ` ${pnlNum >= 0 ? '+' : ''}${pnlNum.toFixed(1)}%` : ''
    const conds = extractSignalConditions(s.raw_response).join(', ')
    return `  • ${s.final_verdict ?? 'WAIT'} [${d} ${s.timeframe}] conf:${s.final_confidence ?? '?'}%${conds ? ' [' + conds + ']' : ''} → ${tag}${pnl}`
  }

  let out = '\n━━━ MEMORY: recent signals for this pair ━━━\n'

  if (wins.length) {
    out += `✅ WIN PATTERNS (${wins.length}):\n`
    out += wins.map(s => fmtLine(s, 'WIN')).join('\n') + '\n'
  }

  if (losses.length) {
    out += `⚠️ LOSS PATTERNS (${losses.length}) — DO NOT REPEAT:\n`
    out += losses.map(s => fmtLine(s, 'LOSS')).join('\n') + '\n'
    out += `→ Study these conditions. Never repeat the losing setup.\n`
  }

  if (pending.length) {
    out += `⏳ PENDING: ${pending.map(s => `${s.final_verdict} conf:${s.final_confidence ?? '?'}%`).join(', ')}\n`
  }

  if (globalPatterns) out += globalPatterns

  out += 'Apply winning patterns. Strictly avoid all losing conditions.\n'
  return out
}

export async function fullAnalysis(
  pair: string,
  tf: string,
  market: MarketData,
  candles: Candle[],
  memorySignals: MemorySignal[] = [],
  maxLeverage = 20,
  balance = 1000,
  riskPct = 1.0,
  globalLossPatterns = '',
  translate = true
): Promise<{ step1: Step1Result; step2: Step2Result; final: FinalResult; methods: MethodResult[]; consensus: ConsensusResult }> {
  const keys       = loadGroqKeys()
  const finalize = (r: { step1: Step1Result; step2: Step2Result; final: FinalResult; methods?: MethodResult[]; consensus?: ConsensusResult }) =>
    translate ? translateResponse(keys, r) : passThroughResult(r)
  const mainModel  = getGroqModel()
  const quickModel = getGroqFastModel()
  const price      = market.price
  const ctx        = getContext(market)
  const histCtx    = getHistory(memorySignals, globalLossPatterns)

  const indResult = analyzeIndicators(candles)
  const paResult  = analyzePriceAction(candles)
  const wyResult  = analyzeWyckoff(candles)
  const vpResult  = analyzeVolumeProfile(candles)
  const frResult  = analyzeFunding(market.fundingRate)

  const riskUsd = parseFloat((balance * riskPct / 100).toFixed(2))
  const atrPct  = market.atr14pct ?? 2.0
  const atrAbs  = market.price * atrPct / 100

  const recentOutcomes = memorySignals.slice(0, 3).map(s => s.outcome)
  const consecutiveLosses = recentOutcomes.filter(o => o === 'loss').length
  const strictMode = consecutiveLosses >= 2

  const resolvedSignals = memorySignals.filter(s => s.outcome !== null)
  const pairWinRate = resolvedSignals.length >= 3
    ? resolvedSignals.filter(s => s.outcome === 'win').length / resolvedSignals.length
    : null
  const lowWinRate = pairWinRate !== null && pairWinRate < 0.4
  const minConfThreshold = 60

  const utcHour = new Date().getUTCHours()
  const session = utcHour < 8 ? 'Asia (00-08 UTC, low liquidity)'
    : utcHour < 13 ? 'London (08-13 UTC, high liquidity)'
    : utcHour < 22 ? 'New York (13-22 UTC, peak liquidity)'
    : 'After hours (quiet market)'

  const prompt1 = `/no_think
You are an institutional SMC analyst. Structural analysis of ${pair} (${tf}).
PRICE: $${price} | SESSION: ${session} | VOLATILITY: ATR=${atrPct}%
${ctx}

Analyze: BOS = trend continuation; CHoCH = first sign of reversal; Liquidity sweep + reversal into OB = strong entry.
RSI${market.rsi > 70 ? ' OVERBOUGHT — caution with longs' : market.rsi < 30 ? ' OVERSOLD — caution with shorts' : ' neutral'}.
EMA-50/200: ${market.priceVsEma50}/${market.priceVsEma200}.

Reply with a single-line JSON:
{"trend":"bullish|bearish|ranging","htf":"bullish|bearish|neutral","phase":"accumulation|distribution|markup|markdown|ranging","choch":true|false,"sweep_ssl":true|false,"sweep_bsl":true|false,"volatility":"low|medium|high","key_level":${price},"bos_confirmed":true|false,"sweep_recent":true|false,"ranging_risk":true|false,"summary":"<2 sentences: structure + what to expect in ${session.split(' ')[0]} session>"}`

  const raw1 = await groqGenerate(keys, quickModel, prompt1, 350, 0.1)
  let s1: Record<string, unknown> = {}
  try { s1 = extractJSON(raw1) } catch { s1 = { trend: 'ranging', htf: 'neutral', summary: 'No data', ranging_risk: true } }

  const trendDir = String(s1.trend  || 'ranging')
  const summary1 = String(s1.summary || '')
  const htf      = String(s1.htf || 'neutral')

  const smcSignal: 'LONG' | 'SHORT' | 'WAIT' =
    trendDir === 'bullish' && !s1.ranging_risk ? 'LONG' :
    trendDir === 'bearish' && !s1.ranging_risk ? 'SHORT' : 'WAIT'

  const smcFactors: string[] = []
  if (trendDir === 'bullish')             smcFactors.push('Uptrend')
  else if (trendDir === 'bearish')        smcFactors.push('Downtrend')
  if (s1.bos_confirmed)                   smcFactors.push('BOS confirmed')
  if (s1.sweep_ssl || s1.sweep_bsl)       smcFactors.push('Liquidity sweep')
  if (s1.choch)                           smcFactors.push('CHoCH — change of character')
  if (s1.phase)                           smcFactors.push(`Phase: ${s1.phase}`)

  const smcMethod: MethodResult = {
    method: 'SMC',
    signal: smcSignal,
    confidence: s1.bos_confirmed ? 68 : 52,
    factors: smcFactors.length ? smcFactors : ['Structure analysis'],
    summary: `Trend: ${trendDir}, HTF: ${htf}`,
  }

  const allMethods = [smcMethod, indResult, paResult, wyResult, vpResult, frResult]
  const consensus  = calcConsensus(allMethods, 3)

  const consensusCtx = [
    '━━━ MULTI-METHOD ANALYSIS (6 methods) ━━━',
    allMethods.map(m => `${m.method}: ${m.signal} ${m.confidence}%`).join(' | '),
    `Consensus: ${consensus.long}×LONG / ${consensus.short}×SHORT / ${consensus.wait}×WAIT → ${consensus.decision} (≥${consensus.threshold} required)`,
    consensus.agreeing.length ? `Agreeing: ${consensus.agreeing.join(', ')}` : '',
  ].filter(Boolean).join('\n')

  const consensusOverride = !strictMode
    && consensus.decision !== 'WAIT'
    && (consensus.long >= 3 || consensus.short >= 4)

  if (trendDir === 'ranging' && (htf === 'neutral' || htf === 'ranging') || s1.ranging_risk === true) {
    if (!consensusOverride) {
      const waitStep1: Step1Result = { signal: 'WAIT', strength: 3, trend: trendDir, summary: summary1 }
      const waitStep2: Step2Result = { verdict: 'WAIT', confidence: 45, risk_score: 5, leverage: 1, summary: 'Range + neutral HTF — no clear direction' }
      const rangeLevel = market.resistances[0] || market.supports[0] || 0
      const waitFinal = makeWait(45, 'Range with no HTF bias. Waiting for structure resolution.', riskUsd, balance, riskPct, allMethods, consensus, rangeLevel)
      return finalize({ step1: waitStep1, step2: waitStep2, final: waitFinal, methods: allMethods, consensus })
    }
  }

  const strictWarning = strictMode ? `\n⚠️ STRICT MODE (${consecutiveLosses} consecutive losses): require at least 4 confluence factors, confluence_count≥4, else WAIT.\n` : ''

  const prompt2 = `/no_think
You are an SMC analyst. Identify the best POI for ${pair} (${tf}).${strictWarning}
PRICE: $${price} | Trend: ${s1.trend} | HTF: ${s1.htf} | Phase: ${s1.phase}
BOS: ${s1.bos_confirmed} | CHoCH: ${s1.choch || false} | Sweeps: SSL=${s1.sweep_ssl || false} BSL=${s1.sweep_bsl || false}
${ctx}

POI priority: BB (Breaker Block) > A+ OB with sweep > A OB + FVG > B OB
For LONG: bullish POI BELOW price + SSL sweep already happened + target (FVG/BSL) ABOVE
For SHORT: bearish POI ABOVE price + BSL sweep already happened + target (FVG/SSL) BELOW
Without a liquidity sweep — WAIT only or very high confidence required.

Min R:R (risk:reward): A+/BB → 1:3; A OB → 1:2; B OB → 1:1.5; no POI → WAIT.
confluence_count = number of confirmed factors (OB, FVG, BOS, CHoCH, sweep, HTF, volume, RSI, session).
Minimum 3 factors for LONG/SHORT. Strict mode — minimum 4.

Reply with a single-line JSON:
{"poi_type":"OB|BB|FVG|none","poi_dir":"bullish|bearish","poi_quality":"A+|A|B|C","poi_high":0,"poi_low":0,"confluence_score":<0-100>,"confluence_count":<1-9>,"sweep_confirmed":true|false,"fvg_target":true|false,"liq_target":true|false,"entry_zone":"<POI description with price range>","wait_reason":"<WAIT reason>","min_rr":<1.5-5.0>}`

  const raw2 = await groqGenerate(keys, quickModel, prompt2, 450, 0.15)
  let s2: Record<string, unknown> = {}
  try { s2 = extractJSON(raw2) } catch { s2 = { poi_type: 'none', confluence_score: 0, confluence_count: 0, sweep_confirmed: false } }

  const step2Summary    = String(s2.entry_zone || s2.wait_reason || '')
  const confluenceCount = Number(s2.confluence_count || 0)
  const sweepConfirmed  = Boolean(s2.sweep_confirmed)

  const minConfluence = strictMode ? 4 : 3
  const confluenceOk = confluenceCount >= minConfluence
  const sweepOk = sweepConfirmed || Boolean(s1.sweep_ssl) || Boolean(s1.sweep_bsl)

  if (!confluenceOk) {
    if (!consensusOverride) {
      const waitStep1: Step1Result = { signal: 'WAIT', strength: 4, trend: trendDir, summary: summary1 }
      const waitStep2: Step2Result = { verdict: 'WAIT', confidence: 48, risk_score: 5, leverage: 1, summary: `Only ${confluenceCount} factor(s) out of ${minConfluence} required. ${step2Summary}` }
      const poiLevel = Number(s2.poi_low || 0) || Number(s2.poi_high || 0)
      const waitFinal = makeWait(48, `Insufficient confluence (${confluenceCount}/${minConfluence}). ${String(s2.wait_reason || 'Wait for a cleaner setup.')}`, riskUsd, balance, riskPct, allMethods, consensus, poiLevel)
      return finalize({ step1: waitStep1, step2: waitStep2, final: waitFinal, methods: allMethods, consensus })
    }
  }

  const systemPrompt3 = `You are an institutional SMC trader with 10 years of experience trading Smart Money Concepts. Your goal is high-quality signals with minimum R:R of 1:1.5. You only trade when there is confluence of at least 3 factors. You do not trade in ranging markets. A liquidity sweep is a mandatory condition for entry. Reply only with valid JSON.`

  const sweepWarn = !sweepOk ? '⚠️ SWEEP NOT CONFIRMED — require WAIT unless there are strong grounds' : '✅ Sweep confirmed'

  const prompt3 = `Final signal for ${pair} (${tf}). Confluence: ${confluenceCount} factors. ${sweepWarn}.
${strictMode ? `⚠️ STRICT MODE: ${consecutiveLosses} consecutive losses — require confidence≥70% or WAIT.` : ''}
${consensusCtx}
${histCtx}

━━━ MARKET STRUCTURE ━━━
Trend: ${s1.trend} | HTF: ${s1.htf} | Phase: ${s1.phase} | Volatility: ${s1.volatility || 'medium'}
BOS: ${s1.bos_confirmed} | CHoCH: ${s1.choch || false} | Session: ${session}
Liquidity sweeps: SSL=${s1.sweep_ssl || false} BSL=${s1.sweep_bsl || false}
RSI: ${market.rsi.toFixed(1)} | MACD: ${market.macdSignal} | EMA-50: ${market.priceVsEma50} | EMA-200: ${market.priceVsEma200}

━━━ BEST POI ━━━
${s2.poi_type}/${s2.poi_dir} [quality: ${s2.poi_quality || 'B'}] | confluence=${s2.confluence_score}% (${confluenceCount} factors) | min R:R 1:${s2.min_rr || 2}
${s2.entry_zone || s2.wait_reason || 'no POI'}
FVG target: ${s2.fvg_target || false} | Liquidity target: ${s2.liq_target || false}

━━━ FULL SMC CONTEXT ━━━
${ctx}

━━━ RISK MANAGEMENT ━━━
Deposit: $${balance} | Risk/trade: ${riskPct}% = $${riskUsd}
ATR-14: ${atrPct}% | Max leverage: ${maxLeverage}x

LEVERAGE SELECTION:
• A+/BB + confluence≥4 + ATR<2% → 10-${Math.min(maxLeverage, 20)}x
• A + confluence 3-4 + ATR 2-3% → 5-10x
• A + ATR 3-5% → 2-5x
• B or ATR>5% → 1-3x

ENTRY RULES:
LONG: bullish OB/BB below price + HTF bullish + SSL sweep + FVG/BSL above as target → OTE 62-79% into OB
SHORT: bearish OB/BB above price + HTF bearish + BSL sweep + FVG/SSL below as target → OTE 62-79% into OB
WAIT: no A/A+ POI | R:R < 1:${s2.min_rr || 2} | HTF/LTF conflict | no sweep | price already inside OB

TP = nearest FVG midpoint or liquidity level. SL = beyond OB low/high + 0.3% buffer.
ATR-14 = ${atrPct}% = $${atrAbs.toFixed(4)} — use it to size TP/SL:
  SL distance: 1.0–2.0× ATR = $${(atrAbs * 1.0).toFixed(4)}–$${(atrAbs * 2.0).toFixed(4)} from entry.
  TP distance: min 1.5× SL, ideally 2.5–3× ATR = $${(atrAbs * 2.5).toFixed(4)}–$${(atrAbs * 3.0).toFixed(4)}.
  TP/SL must stay within ±10% of the ENTRY price (not current price).
R:R notation: risk:reward = 1:X (where X is the number, e.g. 1:2 means reward is twice the risk).

Reply with ONLY one line of valid JSON (all numeric fields must be numbers, not strings):
{"v":"LONG|SHORT|WAIT","c":<55-95>,"r":<1-9>,"l":<leverage 1-${maxLeverage}>,"e":<OTE price>,"tp":<TP price>,"sl":<SL price>,"rr":<R:R number, e.g. 1.5>,"min_rr":<${s2.min_rr || 2.0}>,"risk_usd":${riskUsd},"pos_usd":<${riskUsd} / SL_distance% * 100>,"trend":"uptrend|downtrend|sideways","desc":"<5 sentences: structure, POI, entry logic, target, invalidation>","entry_logic":"<specific OTE entry: 62-79% into OB $X-$Y = $Z>","confluence":"<${confluenceCount} specific factors with prices>","invalidation":"<candle close below/above $X>","position_size":"<$${riskUsd} / SL_dist% = $X position with Nx leverage>","exit_why":"<FVG $X-$Y or liquidity $X>","wait_for":"<ONLY for WAIT: wait for $X under condition Y>","i1":"<HTF structure + BOS/CHoCH>","i2":"<POI $X-$Y [quality] + entry $Z>","i3":"<target: FVG/liquidity $X>"}`

  let raw3 = await groqGenerate(keys, mainModel, prompt3, 1200, 0.3, systemPrompt3)
  const json = await parseJSON(raw3, keys, mainModel, prompt3, 1200, 0.3, systemPrompt3)

  const aiRr         = Number(json.rr || 0)
  const minRr        = Number(json.min_rr || s2.min_rr || 2.0)
  const posUsd       = Number(json.pos_usd || 0)
  const riskUsdFinal = Number(json.risk_usd || riskUsd)

  const rawVerdict  = String(json.v || json.verdict || 'WAIT')
  const verdict     = (rawVerdict === 'WAIT' && consensus.decision !== 'WAIT' && !strictMode)
    ? consensus.decision
    : rawVerdict
  const confidence  = Number(json.c || json.confidence || 50)

  const shortAllowed =
    (htf === 'bearish' && consensus.short >= 3) ||
    (consensus.short >= 4)
  if (verdict === 'SHORT' && !shortAllowed) {
    const ss1: Step1Result = { signal: 'WAIT', strength: 3, trend: trendDir, summary: summary1 }
    const ss2: Step2Result = {
      verdict: 'WAIT', confidence: 48, risk_score: 5, leverage: 1,
      summary: 'SHORT: требуется медвежий HTF + 3 метода, или 4+ метода без условия HTF.',
    }
    const sf = makeWait(48, 'SHORT не подтверждён: нужен медвежий HTF + 3 метода, либо 4+ метода.', riskUsd, balance, riskPct, allMethods, consensus)
    return finalize({ step1: ss1, step2: ss2, final: sf, methods: allMethods, consensus })
  }

  const fundingOpposes =
    (verdict === 'LONG'  && frResult.signal === 'SHORT' && frResult.confidence >= 60) ||
    (verdict === 'SHORT' && frResult.signal === 'LONG'  && frResult.confidence >= 60)
  if (fundingOpposes) {
    const fs1: Step1Result = { signal: 'WAIT', strength: 3, trend: trendDir, summary: summary1 }
    const fs2: Step2Result = {
      verdict: 'WAIT', confidence: 48, risk_score: 5, leverage: 1,
      summary: `Funding strongly opposes ${verdict} (${frResult.summary}). Funding is the most reliable filter — skipping.`,
    }
    const ff = makeWait(48, `Funding rate opposes the ${verdict} setup — historically the strongest contrarian signal. Waiting.`, riskUsd, balance, riskPct, allMethods, consensus)
    return finalize({ step1: fs1, step2: fs2, final: ff, methods: allMethods, consensus })
  }

  if ((verdict === 'LONG' || verdict === 'SHORT') && confidence < minConfThreshold && !consensusOverride) {
    const ws1: Step1Result = { signal: 'WAIT', strength: 3, trend: trendDir, summary: summary1 }
    const ws2: Step2Result = {
      verdict: 'WAIT', confidence: 48, risk_score: 5, leverage: 1,
      summary: `Confidence ${confidence}% below ${minConfThreshold}%${lowWinRate ? ` (win rate ${Math.round((pairWinRate ?? 0) * 100)}% on this pair)` : ''}`,
    }
    const wf = makeWait(48, `Confidence gate: ${confidence}% < ${minConfThreshold}% required.`, riskUsd, balance, riskPct, allMethods, consensus)
    return finalize({ step1: ws1, step2: ws2, final: wf, methods: allMethods, consensus })
  }

  const rawRisk     = Number(json.r || json.risk_score || 5)
  const riskScore   = rawRisk > 0 && rawRisk < 1 ? Math.round(rawRisk * 10) : Math.round(rawRisk)

  const htfAligned     = (verdict === 'LONG' && htf === 'bullish') || (verdict === 'SHORT' && htf === 'bearish')
  const fundingAgrees  = frResult.signal === verdict
  const strongConsensus = verdict === 'LONG' ? consensus.long >= 4 : verdict === 'SHORT' ? consensus.short >= 4 : false
  const convictionScore = [htfAligned, fundingAgrees, strongConsensus].filter(Boolean).length
  const convictionFactor = convictionScore >= 3 ? 1.0 : convictionScore === 2 ? 0.65 : convictionScore === 1 ? 0.4 : 0.25
  const aiLeverage  = Math.min(Number(json.l || json.leverage || 2), maxLeverage)
  const leverage    = Math.max(2, Math.min(aiLeverage, Math.round(maxLeverage * convictionFactor)))
  const waitFor     = String(json.wait_for || '')
  const aiEntry     = Number(json.e || json.entry_price || price)
  const trend       = String(json.trend || 'neutral')
  const desc        = String(json.desc || json.why_this_signal || '')
  const entryLogic  = String(json.entry_logic || json.entry_why || desc)
  const confluenceStr = String(json.confluence || '')
  const invalidation  = String(json.invalidation || '')
  const positionSize  = String(json.position_size || '')
  const exitWhy       = String(json.exit_why || '')

  let tpPrice = Number(json.tp || json.tp_price || 0)
  let slPrice = Number(json.sl || json.sl_price || 0)

  const { entry: entryPrice, ob: selectedOB } = findEntry(verdict, price, aiEntry, market.smc)

  const LIMIT_THRESHOLD = 0.005
  const autoEntryType: 'market' | 'limit' = (
    (verdict === 'LONG'  && entryPrice < price * (1 - LIMIT_THRESHOLD)) ||
    (verdict === 'SHORT' && entryPrice > price * (1 + LIMIT_THRESHOLD))
  ) ? 'limit' : 'market'

  const isLongV  = verdict === 'LONG'
  const isShortV = verdict === 'SHORT'
  const sigFigs  = entryPrice >= 1000 ? 2 : entryPrice >= 1 ? 4 : 6

  if (isLongV || isShortV) {
    const MAX_DEV = 0.20
    const tpBad = !tpPrice || (isLongV ? tpPrice <= entryPrice : tpPrice >= entryPrice) || Math.abs(tpPrice - entryPrice) / entryPrice > MAX_DEV
    const slBad = !slPrice || (isLongV ? slPrice >= entryPrice : slPrice <= entryPrice) || Math.abs(entryPrice - slPrice) / entryPrice > MAX_DEV

    if (slBad) slPrice = isLongV ? entryPrice - atrAbs * 1.2 : entryPrice + atrAbs * 1.2
    if (tpBad) tpPrice = isLongV ? entryPrice + atrAbs * 2.5 : entryPrice - atrAbs * 2.5

    tpPrice = parseFloat(tpPrice.toFixed(sigFigs))
    slPrice = parseFloat(slPrice.toFixed(sigFigs))
  }

  const tp_pct = parseFloat(((tpPrice - entryPrice) / entryPrice * 100).toFixed(2))
  const sl_pct = parseFloat(((entryPrice - slPrice) / entryPrice * 100).toFixed(2))
  const rrStr  = sl_pct !== 0 ? (Math.abs(tp_pct) / Math.abs(sl_pct)).toFixed(1) : '?'

  const i1 = String(json.i1 || trend)
  const i2 = String(json.i2 || `Entry $${entryPrice} → TP $${tpPrice.toFixed(2)} (+${Math.abs(tp_pct).toFixed(2)}%)`)
  const i3 = String(json.i3 || `SL $${slPrice.toFixed(2)} (-${Math.abs(sl_pct).toFixed(2)}%) | R:R 1:${rrStr}`)

  const whyFinal = desc || [summary1, step2Summary, confluenceStr]
    .filter(s => s.trim().length > 3).join('. ')

  const entryFinal = entryLogic || (verdict !== 'WAIT'
    ? `Entry at $${entryPrice.toFixed(sigFigs)} (${autoEntryType === 'limit' ? 'limit order' : 'market'})${confluenceStr ? '. ' + confluenceStr : ''}`
    : whyFinal)

  const exitFinal = exitWhy || (verdict !== 'WAIT'
    ? `TP $${tpPrice.toFixed(sigFigs)} (+${Math.abs(tp_pct).toFixed(2)}%) | SL $${slPrice.toFixed(sigFigs)} (-${Math.abs(sl_pct).toFixed(2)}%) | R:R 1:${rrStr}`
    : '')

  const step1: Step1Result = { signal: verdict, strength: Math.round(confidence / 10), trend: trendDir, summary: summary1 }
  const step2: Step2Result = { verdict, confidence, risk_score: riskScore, leverage, summary: step2Summary }
  const final: FinalResult = {
    verdict, confidence, risk_score: riskScore, leverage,
    entry_price: entryPrice, entry_limit: null, entry_type: autoEntryType,
    tp_price: tpPrice, tp_pct: tp_pct,
    sl_price: slPrice, sl_pct: sl_pct,
    full_description: whyFinal, entry_instruction: entryFinal,
    confluence: confluenceStr, invalidation, position_size: positionSize,
    exit_instruction: exitFinal, why_this_signal: whyFinal,
    wait_for: waitFor,
    rr: aiRr || parseFloat(rrStr),
    min_rr: minRr,
    risk_usd: riskUsdFinal,
    pos_usd: Math.min(posUsd || Math.round(riskUsd / Math.max(0.01, Math.abs(sl_pct) / 100)), Math.round(balance * maxLeverage)),
    ob_used: selectedOB ? (() => {
      const scored = scoreOrderBlock(selectedOB)
      return {
        type: selectedOB.type,
        quality: selectedOB.quality,
        strength: selectedOB.strength,
        high: selectedOB.high,
        low: selectedOB.low,
        touchCount: selectedOB.touchCount,
        relVolume: selectedOB.relVolume,
        impulseSize: selectedOB.impulseSize,
        ageCandles: selectedOB.ageCandles,
        score: scored.score,
        isFresh: selectedOB.touchCount === 0,
        verdict: scored.verdict,
      }
    })() : undefined,
    insights: [
      { icon: '📊', tag: 'STRUCTURE',  text: i1 },
      { icon: '🎯', tag: 'ZONE',       text: i2 },
      { icon: '💧', tag: 'LIQUIDITY',  text: i3 },
    ],
    methods: allMethods,
    consensus,
  }
  return finalize({ step1, step2, final, methods: allMethods, consensus })
}

function makeWait(confidence: number, reason: string, riskUsd: number, balance: number, riskPct: number, methods?: MethodResult[], consensus?: ConsensusResult, watchLevel?: number): FinalResult {
  return {
    verdict: 'WAIT', confidence, risk_score: 4, leverage: 1,
    entry_price: 0, entry_limit: null, entry_type: 'limit',
    tp_price: 0, tp_pct: 0,
    sl_price: 0, sl_pct: 0,
    full_description: reason, entry_instruction: reason,
    confluence: '', invalidation: '', position_size: '',
    exit_instruction: '', why_this_signal: reason,
    wait_for: reason,
    watch_level: watchLevel && watchLevel > 0 ? watchLevel : undefined,
    rr: 0, min_rr: 2,
    risk_usd: riskUsd,
    pos_usd: 0,
    ob_used: undefined,
    insights: [
      { icon: '⏳', tag: 'WAITING',   text: reason },
      { icon: '📊', tag: 'BALANCE',   text: `$${balance} | Risk ${riskPct}% = $${riskUsd}` },
      { icon: '🎯', tag: 'CONDITION', text: 'Waiting for structure confirmation and liquidity sweep' },
    ],
    methods,
    consensus,
  }
}

type FinalizeResult = { step1: Step1Result; step2: Step2Result; final: FinalResult; methods: MethodResult[]; consensus: ConsensusResult }

function passThroughResult(result: { step1: Step1Result; step2: Step2Result; final: FinalResult; methods?: MethodResult[]; consensus?: ConsensusResult }): FinalizeResult {
  return {
    step1: result.step1,
    step2: result.step2,
    final: result.final,
    methods: result.methods ?? ([] as MethodResult[]),
    consensus: result.consensus ?? { long: 0, short: 0, wait: 0, threshold: 3, decision: 'WAIT' as const, avgConfidenceLong: 0, avgConfidenceShort: 0, agreeing: [], disagreeing: [] },
  }
}

async function translateResponse(
  keys: string[],
  result: { step1: Step1Result; step2: Step2Result; final: FinalResult; methods?: MethodResult[]; consensus?: ConsensusResult }
): Promise<{ step1: Step1Result; step2: Step2Result; final: FinalResult; methods: MethodResult[]; consensus: ConsensusResult }> {
  const ins = result.final.insights
  const texts: Record<string, string> = {
    s1: result.step1.summary || '',
    s2: result.step2.summary || '',
    fd: result.final.full_description || '',
    ei: result.final.entry_instruction || '',
    cn: result.final.confluence || '',
    iv: result.final.invalidation || '',
    ws: result.final.why_this_signal || '',
    wf: result.final.wait_for || '',
    ex: result.final.exit_instruction || '',
    ps: result.final.position_size || '',
    i0: ins[0]?.text || '',
    i1: ins[1]?.text || '',
    i2: ins[2]?.text || '',
  }

  const toTranslate = Object.fromEntries(
    Object.entries(texts).filter(([, v]) => v.trim().length > 5 && /[a-zA-Z]{4,}/.test(v))
  )
  if (Object.keys(toTranslate).length === 0) return {
    step1: result.step1,
    step2: result.step2,
    final: result.final,
    methods: result.methods ?? ([] as MethodResult[]),
    consensus: result.consensus ?? { long: 0, short: 0, wait: 0, threshold: 3, decision: 'WAIT' as const, avgConfidenceLong: 0, avgConfidenceShort: 0, agreeing: [], disagreeing: [] },
  }

  const prompt = `/no_think
Translate the following JSON values to Russian. Rules:
- Keep numbers, $, %, →, ↑, ↓, | unchanged
- Keep SMC terms unchanged: OB, FVG, BOS, CHoCH, SL, TP, ATR, EMA, RSI, MACD, HTF, LONG, SHORT, WAIT, OTE, BB
- Keep trading pairs unchanged (BTCUSDT, ETHUSDT etc)
- Keep price values unchanged (e.g. $81500)
- Return ONLY valid single-line JSON, no explanations

${JSON.stringify(toTranslate)}`

  try {
    const raw = await groqGenerate(keys, getGroqFastModel(), prompt, 1500, 0.05)
    const tr = extractJSON(raw)
    const g = (k: string): string =>
      tr[k] && typeof tr[k] === 'string' ? String(tr[k]) : texts[k]

    return {
      step1: { ...result.step1, summary: g('s1') },
      step2: { ...result.step2, summary: g('s2') },
      final: {
        ...result.final,
        full_description:  g('fd'),
        entry_instruction: g('ei'),
        confluence:        g('cn'),
        invalidation:      g('iv'),
        why_this_signal:   g('ws'),
        wait_for:          g('wf'),
        exit_instruction:  g('ex'),
        position_size:     g('ps'),
        insights: ins.map((item, i) => ({ ...item, text: g(`i${i}`) })),
      },
      methods: result.methods ?? ([] as MethodResult[]),
      consensus: result.consensus ?? { long: 0, short: 0, wait: 0, threshold: 3, decision: 'WAIT' as const, avgConfidenceLong: 0, avgConfidenceShort: 0, agreeing: [], disagreeing: [] },
    }
  } catch {
    return {
      step1: result.step1,
      step2: result.step2,
      final: result.final,
      methods: result.methods ?? ([] as MethodResult[]),
      consensus: result.consensus ?? { long: 0, short: 0, wait: 0, threshold: 3, decision: 'WAIT' as const, avgConfidenceLong: 0, avgConfidenceShort: 0, agreeing: [], disagreeing: [] },
    }
  }
}

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
  atr14pct: number
  smc: SMCData
  htfBias?: string
}

export function calcMarketData(candles: Candle[], fundingRate: number | null): MarketData {
  const closes = candles.map(c => c.close)
  const price  = closes[closes.length - 1]

  const rsi    = calcRSI(closes, 14)
  const ema50  = calcEMA(closes, 50)
  const ema200 = calcEMA(closes, 200)
  const macd   = calcMACD(closes)

  const recentVols = candles.slice(-10).map(c => c.volume)
  const avgVol     = recentVols.slice(0, -1).reduce((a, b) => a + b, 0) / (recentVols.length - 1)
  const volSignal  = recentVols[recentVols.length - 1] > avgVol * 1.2 ? 'rising' : 'neutral'

  const { supports, resistances } = findSRLevels(candles.slice(-50), price)

  const recentCandles = candles.slice(-10).map(c => ({
    o: parseFloat(c.open.toFixed(2)),
    h: parseFloat(c.high.toFixed(2)),
    l: parseFloat(c.low.toFixed(2)),
    c: parseFloat(c.close.toFixed(2)),
    v: parseFloat((c.volume / 1000).toFixed(1)),
  }))

  const smc = calcEnhancedSMC(candles, fundingRate)

  const atr14pct = (() => {
    const slice = candles.slice(-15)
    if (slice.length < 2) return 2.0
    const trs = slice.slice(1).map((c, i) =>
      Math.max(c.high - c.low, Math.abs(c.high - slice[i].close), Math.abs(c.low - slice[i].close))
    )
    const avg = trs.slice(-14).reduce((a, b) => a + b, 0) / Math.min(14, trs.length)
    return parseFloat((avg / price * 100).toFixed(2))
  })()

  return {
    price,
    rsi: parseFloat(rsi.toFixed(1)),
    macdSignal:    macd > 0 ? 'bullish' : 'bearish',
    priceVsEma50:  price > ema50  ? 'above' : 'below',
    priceVsEma200: price > ema200 ? 'above' : 'below',
    volSignal,
    fundingRate,
    fundingSignal: fundingRate !== null
      ? (fundingRate > 0.05 ? 'overheated' : fundingRate < -0.01 ? 'bearish' : 'neutral')
      : null,
    supports,
    resistances,
    recentCandles,
    atr14pct,
    smc,
  }
}

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
  return 100 - 100 / (1 + avgGain / avgLoss)
}

function calcMACD(closes: number[]): number {
  return calcEMA(closes, 12) - calcEMA(closes, 26)
}

function findSRLevels(candles: Candle[], price: number): { supports: number[]; resistances: number[] } {
  const pivots: number[] = []
  for (let i = 2; i < candles.length - 2; i++) {
    const isHigh = candles[i].high > candles[i-1].high && candles[i].high > candles[i-2].high &&
                   candles[i].high > candles[i+1].high && candles[i].high > candles[i+2].high
    const isLow  = candles[i].low  < candles[i-1].low  && candles[i].low  < candles[i-2].low  &&
                   candles[i].low  < candles[i+1].low  && candles[i].low  < candles[i+2].low
    if (isHigh) pivots.push(candles[i].high)
    if (isLow)  pivots.push(candles[i].low)
  }
  return {
    supports:    pivots.filter(p => p < price).sort((a, b) => b - a).slice(0, 3).map(p => parseFloat(p.toFixed(2))),
    resistances: pivots.filter(p => p > price).sort((a, b) => a - b).slice(0, 3).map(p => parseFloat(p.toFixed(2))),
  }
}

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
  entry_limit: number | null
  entry_type: 'market' | 'limit'
  tp_price: number
  tp_pct: number
  sl_price: number
  sl_pct: number
  full_description: string
  entry_instruction: string
  confluence: string
  invalidation: string
  position_size: string
  exit_instruction: string
  why_this_signal: string
  wait_for: string
  watch_level?: number
  insights: { icon: string; tag: string; text: string }[]
  rr?: number
  min_rr?: number
  risk_usd?: number
  pos_usd?: number
  ob_used?: {
    type: 'bullish' | 'bearish'
    quality: string
    strength: string
    high: number
    low: number
    touchCount: number
    relVolume: number
    impulseSize: number
    ageCandles: number
    score: number
    isFresh: boolean
    verdict: string
  }
  methods?: MethodResult[]
  consensus?: ConsensusResult
}
