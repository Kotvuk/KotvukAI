'use client'
import { useEffect, useState, useCallback } from 'react'
import { useLang } from '@/contexts/LangContext'
import { showToast } from '@/components/ui/Toast'

interface Signal {
  id: number; pair: string; timeframe: string; final_verdict: string | null
  final_confidence: number | null; final_entry: number | null; final_tp: number | null
  final_sl: number | null; final_leverage: number | null; final_risk_score: number | null
  outcome: string | null; actual_pnl_pct: number | null; created_at: string
}

function vc(v: string | null) {
  if (!v) return 'wait'
  const u = v.toUpperCase()
  return u === 'LONG' ? 'long' : u === 'SHORT' ? 'short' : 'wait'
}

function buildHourlyStats(signals: Signal[]) {
  const hourMap: Record<number, { wins: number; total: number; sumR: number }> = {}
  for (let h = 0; h < 24; h++) hourMap[h] = { wins: 0, total: 0, sumR: 0 }
  for (const s of signals) {
    if (!s.outcome) continue
    const h = new Date(s.created_at).getUTCHours()
    hourMap[h].total++
    if (s.outcome === 'win') {
      hourMap[h].wins++
      hourMap[h].sumR += s.actual_pnl_pct ? Number(s.actual_pnl_pct) : 1
    } else {
      hourMap[h].sumR -= s.actual_pnl_pct ? Math.abs(Number(s.actual_pnl_pct)) : 1
    }
  }
  return hourMap
}

function buildPairStats(signals: Signal[]) {
  const map: Record<string, { wins: number; total: number }> = {}
  for (const s of signals) {
    if (!s.outcome) continue
    if (!map[s.pair]) map[s.pair] = { wins: 0, total: 0 }
    map[s.pair].total++
    if (s.outcome === 'win') map[s.pair].wins++
  }
  return Object.entries(map)
    .map(([pair, v]) => ({ pair, ...v, wr: Math.round((v.wins / v.total) * 100) }))
    .sort((a, b) => b.wr - a.wr)
}

const ERROR_CATEGORIES = [
  { id: 'fomo',     label: 'FOMO РІС…РѕРґ', desc: 'Р’С…РѕРґ Р±РµР· РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ, РїРѕРіРѕРЅСЏ Р·Р° РґРІРёР¶РµРЅРёРµРј' },
  { id: 'htf_bias', label: 'РџСЂРѕС‚РёРІ HTF', desc: 'РЎРґРµР»РєР° РїСЂРѕС‚РёРІ СЃС‚Р°СЂС€РµРіРѕ С‚Р°Р№РјС„СЂРµР№РјР°' },
  { id: 'no_ob',    label: 'РќРµС‚ OB/FVG', desc: 'Р’С…РѕРґ РЅРµ Сѓ Р·РѕРЅС‹ РїРѕРґРґРµСЂР¶РєРё/СЃРѕРїСЂРѕС‚РёРІР»РµРЅРёСЏ' },
  { id: 'early',    label: 'Р Р°РЅРЅРёР№ РІС…РѕРґ', desc: 'Р’РѕС€Р»Рё РґРѕ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РїСЂРѕР±РѕСЏ/СЂРµС‚РµСЃС‚Р°' },
  { id: 'risk',     label: 'Р РёСЃРє-РјРµРЅРµРґР¶РјРµРЅС‚', desc: 'РЎР»РёС€РєРѕРј Р±РѕР»СЊС€РѕР№ СЂРёСЃРє РёР»Рё РјР°Р»РµРЅСЊРєРёР№ R:R' },
  { id: 'session',  label: 'РќРµРІРµСЂРЅР°СЏ СЃРµСЃСЃРёСЏ', desc: 'РўРѕСЂРіРѕРІР»СЏ РІ РЅРµР°РєС‚РёРІРЅС‹Рµ С‡Р°СЃС‹' },
  { id: 'other',    label: 'РџСЂРѕС‡РµРµ', desc: '' },
]

function QuizDiagram({ idx }: { idx: number }) {
  const C = { bull: '#00e676', bear: '#ff3d57', cyan: '#00d4ff', zone: 'rgba(0,212,255,0.18)', dim: '#333', txt: '#555' }
  const diagrams = [
    <svg key={0} viewBox="0 0 200 72" style={{ width: '100%', height: 72, display: 'block' }}>
      <rect width={200} height={72} fill="#0a0a0a" />
      {[[20,55,44,48],[36,58,42,44],[52,60,38,46]].map(([x,o,c,h],i) => (
        <g key={i}><line x1={x} y1={h} x2={x} y2={62} stroke={C.bull} strokeWidth={1}/><rect x={x-4} y={Math.min(o,c)} width={8} height={Math.abs(o-c)||2} fill={C.bull}/></g>
      ))}
      <line x1={10} y1={38} x2={130} y2={38} stroke={C.dim} strokeWidth={1} strokeDasharray="3,2"/>
      <line x1={68} y1={38} x2={68} y2={22} stroke={C.bear} strokeWidth={1}/>
      <rect x={64} y={22} width={8} height={16} fill={C.bear}/>
      <rect x={64} y={22} width={8} height={4} fill="#ff8c00" opacity={0.7}/>
      {[[86,45,55],[102,50,58],[118,54,62]].map(([x,o,c],i) => (
        <g key={i}><rect x={x-4} y={Math.min(o,c)} width={8} height={Math.abs(o-c)||2} fill={C.bear}/></g>
      ))}
      <text x={140} y={35} fontSize="8" fill={C.cyan} fontFamily="monospace">SWEEP</text>
      <text x={140} y={46} fontSize="7" fill={C.txt} fontFamily="monospace">SSL</text>
    </svg>,

    <svg key={1} viewBox="0 0 200 72" style={{ width: '100%', height: 72, display: 'block' }}>
      <rect width={200} height={72} fill="#0a0a0a" />
      {[[20,55,44],[36,58,46],[52,56,48]].map(([x,o,c],i) => (
        <g key={i}><rect x={x-4} y={Math.min(o,c)} width={8} height={Math.abs(o-c)||2} fill={C.bear}/></g>
      ))}
      <rect x={58} y={30} width={40} height={28} fill={C.zone} stroke={C.cyan} strokeWidth={1}/>
      <rect x={64} y={36} width={8} height={16} fill={C.bear} stroke={C.cyan} strokeWidth={1.5}/>
      <text x={72} y={30} fontSize="7" fill={C.cyan} fontFamily="monospace">OB</text>
      {[[90,52,32],[106,46,22],[122,38,14]].map(([x,o,c],i) => (
        <g key={i}><line x1={x} y1={c-4} x2={x} y2={o+4} stroke={C.bull} strokeWidth={1}/><rect x={x-4} y={Math.min(o,c)} width={8} height={Math.abs(o-c)||2} fill={C.bull}/></g>
      ))}
      <text x={136} y={24} fontSize="8" fill={C.bull} fontFamily="monospace">в†‘ IMPULSE</text>
    </svg>,

    <svg key={2} viewBox="0 0 200 72" style={{ width: '100%', height: 72, display: 'block' }}>
      <rect width={200} height={72} fill="#0a0a0a" />
      <rect x={20} y={20} width={60} height={20} fill="rgba(0,230,118,0.12)" stroke={C.bull} strokeWidth={1} strokeDasharray="3,2"/>
      <text x={22} y={18} fontSize="7" fill={C.bull} fontFamily="monospace">Bull OB</text>
      {[[30,36,26],[46,40,30]].map(([x,o,c],i) => (
        <g key={i}><rect x={x-4} y={Math.min(o,c)} width={8} height={Math.abs(o-c)||2} fill={C.bull}/></g>
      ))}
      {[[90,28,40],[106,38,50],[122,48,58]].map(([x,o,c],i) => (
        <g key={i}><rect x={x-4} y={Math.min(o,c)} width={8} height={Math.abs(o-c)||2} fill={C.bear}/></g>
      ))}
      <rect x={20} y={20} width={60} height={20} fill="rgba(255,61,87,0.1)" stroke={C.bear} strokeWidth={1}/>
      <text x={22} y={52} fontSize="7" fill={C.bear} fontFamily="monospace">в†’ BREAKER</text>
      <line x1={138} y1={44} x2={138} y2={30} stroke={C.bear} strokeWidth={1} markerEnd="url(#a)"/>
      <rect x={128} y={20} width={20} height={12} fill="rgba(255,61,87,0.15)" stroke={C.bear} strokeWidth={1}/>
      <text x={130} y={29} fontSize="6" fill={C.bear} fontFamily="monospace">TEST</text>
    </svg>,

    <svg key={3} viewBox="0 0 200 72" style={{ width: '100%', height: 72, display: 'block' }}>
      <rect width={200} height={72} fill="#0a0a0a" />
      <line x1={30} y1={2} x2={30} y2={62} stroke={C.bear} strokeWidth={1}/>
      <rect x={26} y={40} width={8} height={16} fill={C.bear}/>
      <line x1={30} y1={40} x2={30} y2={32} stroke={C.bear} strokeWidth={1}/>
      <rect x={60} y={4} width={8} height={54} fill={C.bull} opacity={0.9}/>
      <line x1={64} y1={2} x2={64} y2={62} stroke={C.bull} strokeWidth={1}/>
      <line x1={82} y1={2} x2={82} y2={62} stroke={C.bull} strokeWidth={1}/>
      <rect x={78} y={26} width={8} height={30} fill={C.bull}/>
      <rect x={50} y={28} width={50} height={18} fill={C.zone} stroke={C.cyan} strokeWidth={1}/>
      <text x={103} y={33} fontSize="8" fill={C.cyan} fontFamily="monospace">FVG</text>
      <text x={103} y={44} fontSize="6" fill={C.txt} fontFamily="monospace">gap</text>
      <line x1={50} y1={40} x2={100} y2={40} stroke={C.cyan} strokeWidth={0.5} strokeDasharray="2,2"/>
      <line x1={50} y1={28} x2={100} y2={28} stroke={C.cyan} strokeWidth={0.5} strokeDasharray="2,2"/>
    </svg>,

    <svg key={4} viewBox="0 0 200 72" style={{ width: '100%', height: 72, display: 'block' }}>
      <rect width={200} height={72} fill="#0a0a0a" />
      <text x={10} y={18} fontSize="8" fill={C.bull} fontFamily="monospace">HTF в†‘ BULLISH</text>
      <line x1={10} y1={22} x2={190} y2={22} stroke={C.bull} strokeWidth={0.5} opacity={0.4}/>
      <rect x={20} y={38} width={50} height={22} fill={C.zone} stroke={C.cyan} strokeWidth={1}/>
      <text x={22} y={50} fontSize="8" fill={C.cyan} fontFamily="monospace">Bull OB</text>
      <text x={22} y={60} fontSize="6" fill={C.txt} fontFamily="monospace">A+ quality</text>
      {[[90,56,44],[106,46,32],[122,36,20]].map(([x,o,c],i) => (
        <g key={i}><rect x={x-4} y={Math.min(o,c)} width={8} height={Math.abs(o-c)||2} fill={C.bull}/></g>
      ))}
      <text x={138} y={30} fontSize="9" fill={C.bull} fontFamily="monospace">LONG в†‘</text>
    </svg>,

    <svg key={5} viewBox="0 0 200 72" style={{ width: '100%', height: 72, display: 'block' }}>
      <rect width={200} height={72} fill="#0a0a0a" />
      {[
        [20,60,52,64],[34,56,44,58],[48,50,36,52],[62,46,32,48],[76,40,24,42],[90,36,18,38]
      ].map(([x,o,c,lw],i) => (
        <g key={i}><line x1={x} y1={lw} x2={x} y2={c-2} stroke={C.bull} strokeWidth={1}/><rect x={x-4} y={Math.min(o,c)} width={8} height={Math.abs(o-c)||2} fill={C.bull}/></g>
      ))}
      <line x1={10} y1={24} x2={100} y2={24} stroke={C.cyan} strokeWidth={1} strokeDasharray="3,2"/>
      <text x={102} y={28} fontSize="8" fill={C.cyan} fontFamily="monospace">BOS</text>
      <text x={22} y={70} fontSize="6" fill={C.txt} fontFamily="monospace">HH</text>
      <text x={50} y={70} fontSize="6" fill={C.txt} fontFamily="monospace">HL</text>
      <text x={78} y={70} fontSize="6" fill={C.txt} fontFamily="monospace">HHв†’BOS</text>
    </svg>,

    <svg key={6} viewBox="0 0 200 72" style={{ width: '100%', height: 72, display: 'block' }}>
      <rect width={200} height={72} fill="#0a0a0a" />
      {[
        [20,58,50],[34,52,40],[48,46,32],[62,40,28]
      ].map(([x,o,c],i) => (
        <g key={i}><rect x={x-4} y={Math.min(o,c)} width={8} height={Math.abs(o-c)||2} fill={C.bull}/></g>
      ))}
      <text x={22} y={68} fontSize="6" fill={C.txt} fontFamily="monospace">HH</text>
      <text x={50} y={68} fontSize="6" fill={C.txt} fontFamily="monospace">HH</text>
      <line x1={10} y1={32} x2={100} y2={32} stroke={C.dim} strokeWidth={1} strokeDasharray="2,2"/>
      {[
        [80,30,46],[96,42,56],[112,52,62]
      ].map(([x,o,c],i) => (
        <g key={i}><rect x={x-4} y={Math.min(o,c)} width={8} height={Math.abs(o-c)||2} fill={C.bear}/></g>
      ))}
      <text x={90} y={68} fontSize="6" fill={C.bear} fontFamily="monospace">LL</text>
      <text x={118} y={40} fontSize="8" fill={C.bear} fontFamily="monospace">CHoCH</text>
      <line x1={76} y1={32} x2={76} y2={46} stroke={C.bear} strokeWidth={1.5}/>
    </svg>,

    <svg key={7} viewBox="0 0 200 72" style={{ width: '100%', height: 72, display: 'block' }}>
      <rect width={200} height={72} fill="#0a0a0a" />
      {[[20,50,44],[36,54,46]].map(([x,o,c],i) => (
        <g key={i}><rect x={x-4} y={Math.min(o,c)} width={8} height={Math.abs(o-c)||2} fill={C.bear} opacity={0.5}/></g>
      ))}
      <rect x={44} y={22} width={50} height={36} fill="rgba(0,212,255,0.1)" stroke={C.cyan} strokeWidth={1.5}/>
      <rect x={48} y={26} width={8} height={28} fill={C.bear} stroke={C.cyan} strokeWidth={1.5}/>
      <line x1={52} y1={22} x2={52} y2={18} stroke={C.bear} strokeWidth={1}/>
      <line x1={52} y1={54} x2={52} y2={60} stroke={C.bear} strokeWidth={1}/>
      <text x={60} y={38} fontSize="7" fill={C.cyan} fontFamily="monospace">HIGH</text>
      <text x={60} y={48} fontSize="7" fill={C.cyan} fontFamily="monospace">VOL OB</text>
      <text x={60} y={58} fontSize="6" fill={C.bull} fontFamily="monospace">A+</text>
      {[[108,50,36],[124,40,26],[140,34,18]].map(([x,o,c],i) => (
        <g key={i}><rect x={x-4} y={Math.min(o,c)} width={8} height={Math.abs(o-c)||2} fill={C.bull}/></g>
      ))}
      <text x={150} y={28} fontSize="7" fill={C.bull} fontFamily="monospace">в†‘ INST.</text>
    </svg>,
  ]
  return diagrams[idx] ?? null
}

const QUIZ_SCENARIOS = [
  {
    q: 'РќР° РіСЂР°С„РёРєРµ: С†РµРЅР° РїСЂРѕР±РёР»Р° РІРІРµСЂС… СѓСЂРѕРІРµРЅСЊ СЂР°РІРЅС‹С… РјР°РєСЃРёРјСѓРјРѕРІ, Р·Р°С‚РµРј СЂРµР·РєРѕ РѕС‚РєР°С‚РёР»Р°СЃСЊ РЅРёР¶Рµ. Р§С‚Рѕ РїСЂРѕРёР·РѕС€Р»Рѕ?',
    opts: ['Bullish BOS', 'Sweep of Sell-Side Liquidity', 'Bullish FVG', 'Change of Character'],
    ans: 1,
    exp: 'Р¦РµРЅР° "СЃРЅРµСЃР»Р°" СЃС‚РѕРїС‹ РїСЂРѕРґР°РІС†РѕРІ (equal highs = SSL), РїРѕСЃР»Рµ С‡РµРіРѕ СЂР°Р·РІРµСЂРЅСѓР»Р°СЃСЊ вЂ” С‚РёРїРёС‡РЅС‹Р№ sweep sell-side liquidity РїРµСЂРµРґ РїСЂРѕРґРѕР»Р¶РµРЅРёРµРј РЅРёСЃС…РѕРґСЏС‰РµРіРѕ РґРІРёР¶РµРЅРёСЏ.',
  },
  {
    q: 'РџРѕСЃР»РµРґРЅСЏСЏ РјРµРґРІРµР¶СЊСЏ СЃРІРµС‡Р° РїРµСЂРµРґ СЃРёР»СЊРЅС‹Рј Р±С‹С‡СЊРёРј РёРјРїСѓР»СЊСЃРѕРј РЅР°Р·С‹РІР°РµС‚СЃСЏ...',
    opts: ['FVG', 'Bullish Order Block', 'Breaker Block', 'BSL'],
    ans: 1,
    exp: 'Bullish Order Block вЂ” РїРѕСЃР»РµРґРЅСЏСЏ РјРµРґРІРµР¶СЊСЏ СЃРІРµС‡Р° РїРµСЂРµРґ РёРјРїСѓР»СЊСЃРЅС‹Рј РґРІРёР¶РµРЅРёРµРј РІРІРµСЂС…. Р¦РµРЅР° С‡Р°СЃС‚Рѕ РІРѕР·РІСЂР°С‰Р°РµС‚СЃСЏ РІ СЌС‚Сѓ Р·РѕРЅСѓ РґР»СЏ РїРѕРґР±РѕСЂР° Р»РёРєРІРёРґРЅРѕСЃС‚Рё.',
  },
  {
    q: 'Order Block Р±С‹Р» РїСЂРѕР±РёС‚ (С†РµРЅР° Р·Р°РєСЂС‹Р»Р°СЃСЊ Р·Р° РµРіРѕ РїСЂРµРґРµР»Р°РјРё). РљР°Рє РѕРЅ С‚РµРїРµСЂСЊ РЅР°Р·С‹РІР°РµС‚СЃСЏ?',
    opts: ['Mitigation Block', 'FVG', 'Breaker Block', 'COB'],
    ans: 2,
    exp: 'Breaker Block вЂ” OB РїРѕСЃР»Рµ РїСЂРѕР±РѕСЏ РјРµРЅСЏРµС‚ СЂРѕР»СЊ. Bullish OB, РїСЂРѕР±РёС‚С‹Р№ РІРЅРёР·, СЃС‚Р°РЅРѕРІРёС‚СЃСЏ Bearish Breaker Block (С‚РµРїРµСЂСЊ Р·РѕРЅР° СЃРѕРїСЂРѕС‚РёРІР»РµРЅРёСЏ).',
  },
  {
    q: 'РўСЂРё СЃРІРµС‡Рё: prev.high=100, curr=95-102, next.low=103. Р§С‚Рѕ СЌС‚Рѕ С‚Р°РєРѕРµ?',
    opts: ['Bearish FVG', 'Bullish FVG', 'Equal Highs', 'Bullish OB'],
    ans: 1,
    exp: 'Bullish FVG (Fair Value Gap): СЂР°Р·СЂС‹РІ РјРµР¶РґСѓ prev.high (100) Рё next.low (103). Р¦РµРЅР° РїСЂС‹РіРЅСѓР»Р° РІРІРµСЂС…, РѕСЃС‚Р°РІРёРІ РЅРµР·Р°РїРѕР»РЅРµРЅРЅСѓСЋ Р·РѕРЅСѓ вЂ” Р±СѓРґРµС‚ С‚СЏРіРѕС‚РµС‚СЊ Рє Р·Р°РїРѕР»РЅРµРЅРёСЋ.',
  },
  {
    q: 'HTF С‚СЂРµРЅРґ Р±С‹С‡РёР№, LTF С‚СЂРµРЅРґ РјРµРґРІРµР¶РёР№, С†РµРЅР° Сѓ bullish OB. РћРїС‚РёРјР°Р»СЊРЅС‹Р№ СЃРµС‚Р°Рї:',
    opts: ['SHORT РїРѕ LTF С‚СЂРµРЅРґСѓ', 'LONG вЂ” confluence HTF+OB', 'WAIT вЂ” РїСЂРѕС‚РёРІРѕСЂРµС‡РёРµ', 'LONG Р±РµР· РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ'],
    ans: 1,
    exp: 'LONG вЂ” РёРґРµР°Р»СЊРЅС‹Р№ SMC СЃРµС‚Р°Рї: HTF СЃС‚СЂСѓРєС‚СѓСЂР° bullish + С†РµРЅР° Сѓ bullish OB = РєРѕРЅС„Р»СЋСЌРЅСЃ. Р’С‹СЃРѕРєРѕРІРµСЂРѕСЏС‚РЅС‹Р№ РІС…РѕРґ РІ РЅР°РїСЂР°РІР»РµРЅРёРё РёРЅСЃС‚РёС‚СѓС†РёРѕРЅР°Р»СЊРЅС‹С… РґРµРЅРµРі.',
  },
  {
    q: 'РЎРІРµС‡Рё С„РѕСЂРјРёСЂСѓСЋС‚ 5 Higher Highs Рё 5 Higher Lows РїРѕРґСЂСЏРґ. Р§С‚Рѕ СЌС‚Рѕ РѕР·РЅР°С‡Р°РµС‚?',
    opts: ['Ranging СЂС‹РЅРѕРє', 'Change of Character', 'Bullish BOS (Break of Structure)', 'Bearish trend'],
    ans: 2,
    exp: 'Break of Structure (BOS) вЂ” СЂС‹РЅРѕРє С„РѕСЂРјРёСЂСѓРµС‚ HH+HL, СЃС‚СЂСѓРєС‚СѓСЂР° Р±С‹С‡СЊСЏ. BOS РїРѕРґС‚РІРµСЂР¶РґР°РµС‚ РїСЂРѕРґРѕР»Р¶РµРЅРёРµ С‚СЂРµРЅРґР°, РїРѕРєР° СЃС‚СЂСѓРєС‚СѓСЂР° РЅРµ РЅР°СЂСѓС€РµРЅР°.',
  },
  {
    q: 'Р§С‚Рѕ РѕР·РЅР°С‡Р°РµС‚ Change of Character (CHoCH) РЅР° СЂС‹РЅРєРµ?',
    opts: ['РЈСЃРёР»РµРЅРёРµ С‚РµРєСѓС‰РµРіРѕ С‚СЂРµРЅРґР°', 'РџРµСЂРІС‹Р№ РїСЂРёР·РЅР°Рє СЂР°Р·РІРѕСЂРѕС‚Р°', 'РЈСЂРѕРІРµРЅСЊ Р»РёРєРІРёРґРЅРѕСЃС‚Рё', 'Р—Р°РїРѕР»РЅРµРЅРёРµ FVG'],
    ans: 1,
    exp: 'CHoCH вЂ” РїРµСЂРІРѕРµ РЅР°СЂСѓС€РµРЅРёРµ СЃС‚СЂСѓРєС‚СѓСЂС‹ РІ РїСЂРѕС‚РёРІРѕРїРѕР»РѕР¶РЅРѕРј РЅР°РїСЂР°РІР»РµРЅРёРё. РќР°РїСЂРёРјРµСЂ, РїРµСЂРІС‹Р№ LL РІ Р±С‹С‡СЊРµРј С‚СЂРµРЅРґРµ. РЎРёРіРЅР°Р» РІРѕР·РјРѕР¶РЅРѕРіРѕ СЂР°Р·РІРѕСЂРѕС‚Р°.',
  },
  {
    q: 'РћР±СЉС‘Рј РЅР° СЃРІРµС‡Рµ-РѕСЃРЅРѕРІР°РЅРёРё OB Р·РЅР°С‡РёС‚РµР»СЊРЅРѕ РІС‹С€Рµ СЃСЂРµРґРЅРµРіРѕ (relVolume > 1.5). Р­С‚Рѕ РґРµР»Р°РµС‚ OB:',
    opts: ['РЎР»Р°Р±РµРµ (РјРЅРѕРіРѕ РїСЂРѕРґР°РІС†РѕРІ)', 'РЎРёР»СЊРЅРµРµ (РёРЅСЃС‚РёС‚СѓС†РёРѕРЅР°Р»СЊРЅС‹Р№)', 'РќРµРІР°Р¶РЅРѕ РґР»СЏ РѕС†РµРЅРєРё', 'Mitigation Block'],
    ans: 1,
    exp: 'Р’С‹СЃРѕРєРёР№ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅС‹Р№ РѕР±СЉС‘Рј СѓРєР°Р·С‹РІР°РµС‚ РЅР° РёРЅСЃС‚РёС‚СѓС†РёРѕРЅР°Р»СЊРЅСѓСЋ Р°РєС‚РёРІРЅРѕСЃС‚СЊ. РўР°РєРѕР№ OB РїРѕР»СѓС‡Р°РµС‚ РєР°С‡РµСЃС‚РІРѕ A РёР»Рё A+ Рё СЃ Р±РѕР»СЊС€РµР№ РІРµСЂРѕСЏС‚РЅРѕСЃС‚СЊСЋ СѓРґРµСЂР¶РёС‚ С†РµРЅСѓ РїСЂРё СЂРµС‚РµСЃС‚Рµ.',
  },
]

export default function HistoryPanel() {
  const { t } = useLang()
  const [tab, setTab] = useState<'history' | 'analytics' | 'review' | 'quiz'>('history')
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(false)

  const [analyticsLoaded, setAnalyticsLoaded] = useState(false)
  const [confBuckets, setConfBuckets] = useState<{ bucket: number; label: string; total: number; wins: number; win_rate: number | null; avg_pnl: number | null }[]>([])
  const [advStats, setAdvStats] = useState<{ profit_factor: number | null; max_drawdown: number; sharpe_ratio: number | null; expectancy: number; avg_win: number; avg_loss: number; total_resolved: number } | null>(null)

  const [filterPair, setFilterPair] = useState('all')
  const [filterTf, setFilterTf] = useState('all')
  const [filterOutcome, setFilterOutcome] = useState('all')

  const [reviewSignal, setReviewSignal] = useState<Signal | null>(null)
  const [reviewCat, setReviewCat] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewSaved, setReviewSaved] = useState(false)

  const [qIdx, setQIdx] = useState(0)
  const [qScore, setQScore] = useState(0)
  const [qAnswered, setQAnswered] = useState<number | null>(null)
  const [qFinished, setQFinished] = useState(false)
  const [qHistory, setQHistory] = useState<{ correct: boolean; chosen: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [sigRes, confRes, advRes] = await Promise.all([
      fetch('/api/signals?limit=200'),
      fetch('/api/stats/confidence'),
      fetch('/api/stats/advanced'),
    ])
    const sigData = await sigRes.json()
    if (sigData.ok) setSignals(sigData.signals || [])
    const confData = await confRes.json()
    if (confData.ok) setConfBuckets(confData.buckets || [])
    const advData = await advRes.json()
    if (advData.ok && advData.stats) setAdvStats(advData.stats)
    setLoading(false)
    setAnalyticsLoaded(true)
  }, [])

  useEffect(() => {
    fetch('/api/signals/check-outcomes', { method: 'POST' })
      .then(r => r.json())
      .then(d => { if (d.ok && d.updated > 0) load() })
      .catch(() => {})
    load()
  }, [load])

  async function clearHistory() {
    if (!confirm('РћС‡РёСЃС‚РёС‚СЊ РІСЃСЋ РёСЃС‚РѕСЂРёСЋ СЃРёРіРЅР°Р»РѕРІ?')) return
    await fetch('/api/signals', { method: 'DELETE' })
    setSignals([])
    showToast('РСЃС‚РѕСЂРёСЏ РѕС‡РёС‰РµРЅР°')
  }

  async function setOutcome(id: number, outcome: string) {
    await fetch(`/api/signals/${id}/outcome`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome }),
    })
    showToast(outcome === 'win' ? t('win_marked') : t('loss_marked'))
    load()
  }

  function answerQuiz(idx: number) {
    if (qAnswered !== null) return
    setQAnswered(idx)
    const correct = idx === QUIZ_SCENARIOS[qIdx].ans
    if (correct) setQScore(s => s + 1)
    setQHistory(h => [...h, { correct, chosen: idx }])
  }

  function nextQuestion() {
    if (qIdx + 1 >= QUIZ_SCENARIOS.length) {
      setQFinished(true)
    } else {
      setQIdx(i => i + 1)
      setQAnswered(null)
    }
  }

  function restartQuiz() {
    setQIdx(0); setQScore(0); setQAnswered(null); setQFinished(false); setQHistory([])
  }

  const uniquePairs = Array.from(new Set(signals.map(s => s.pair))).sort()
  const uniqueTfs = Array.from(new Set(signals.map(s => s.timeframe))).sort()

  const filteredSignals = signals.filter(s => {
    if (filterPair !== 'all' && s.pair !== filterPair) return false
    if (filterTf !== 'all' && s.timeframe !== filterTf) return false
    if (filterOutcome === 'pending') return !s.outcome
    if (filterOutcome !== 'all' && s.outcome !== filterOutcome) return false
    return true
  })

  const resolved = signals.filter(s => s.outcome)
  const wins = resolved.filter(s => s.outcome === 'win').length
  const wr = resolved.length ? Math.round((wins / resolved.length) * 100) : 0
  const avgConf = signals.length ? Math.round(signals.reduce((a, s) => a + (s.final_confidence || 0), 0) / signals.length) : 0
  const hourlyStats = buildHourlyStats(signals)
  const pairStats = buildPairStats(signals)
  const maxHourTotal = Math.max(...Object.values(hourlyStats).map(h => h.total), 1)

  const losses = signals.filter(s => s.outcome === 'loss')

  const TABS = [
    { id: 'history',   label: 'РСЃС‚РѕСЂРёСЏ' },
    { id: 'analytics', label: 'РђРЅР°Р»РёС‚РёРєР°' },
    { id: 'review',    label: 'Р Р°Р·Р±РѕСЂ РѕС€РёР±РѕРє' },
    { id: 'quiz',      label: 'РљРІРёР·' },
  ] as const

  return (
    <div className="panel active" id="panel-history">
      {}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid var(--line2)', paddingBottom: 8 }}>
        {TABS.map(tb => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            style={{
              padding: '4px 12px', fontSize: '.62rem', borderRadius: 3, cursor: 'pointer', border: 'none',
              background: tab === tb.id ? 'var(--cyan)' : 'var(--bg3)',
              color: tab === tb.id ? '#000' : 'var(--muted)',
              fontWeight: tab === tb.id ? 700 : 400,
            }}
          >{tb.label}</button>
        ))}
        <button
          className="run"
          onClick={load}
          style={{ marginLeft: 'auto', padding: '3px 10px', fontSize: '.6rem' }}
        >{t('refresh')}</button>
      </div>

      {}
      {tab === 'history' && (
        <div className="tbox">
          {!loading && signals.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <select
                value={filterPair}
                onChange={e => setFilterPair(e.target.value)}
                style={{ fontSize: '.62rem', padding: '3px 8px', background: 'var(--bg3)', border: '1px solid var(--line2)', borderRadius: 4, color: 'var(--text)', cursor: 'pointer' }}
              >
                <option value="all">Р’СЃРµ РїР°СЂС‹</option>
                {uniquePairs.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select
                value={filterTf}
                onChange={e => setFilterTf(e.target.value)}
                style={{ fontSize: '.62rem', padding: '3px 8px', background: 'var(--bg3)', border: '1px solid var(--line2)', borderRadius: 4, color: 'var(--text)', cursor: 'pointer' }}
              >
                <option value="all">Р’СЃРµ TF</option>
                {uniqueTfs.map(tf => <option key={tf} value={tf}>{tf}</option>)}
              </select>
              <select
                value={filterOutcome}
                onChange={e => setFilterOutcome(e.target.value)}
                style={{ fontSize: '.62rem', padding: '3px 8px', background: 'var(--bg3)', border: '1px solid var(--line2)', borderRadius: 4, color: 'var(--text)', cursor: 'pointer' }}
              >
                <option value="all">Р’СЃРµ</option>
                <option value="win">Win</option>
                <option value="loss">Loss</option>
                <option value="pending">РћР¶РёРґР°СЋС‚</option>
              </select>
              <span style={{ fontSize: '.6rem', color: 'var(--dim)', marginLeft: 2 }}>
                {filteredSignals.length} / {signals.length}
              </span>
              <button onClick={clearHistory} style={{ marginLeft: 'auto', fontSize: '.62rem', padding: '4px 10px', background: 'var(--card2)', border: '1px solid var(--line2)', borderRadius: 4, color: 'var(--muted)', cursor: 'pointer' }}>
                РћС‡РёСЃС‚РёС‚СЊ РёСЃС‚РѕСЂРёСЋ
              </button>
            </div>
          )}
          {loading && <div className="loading"><div className="ld-bar" /><div className="ld-t">{t('fetching')}</div></div>}
          {!loading && (
            <div className="twrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('date')}</th><th>{t('pair')}</th><th>{t('tf')}</th><th>{t('signal')}</th>
                    <th>{t('conf')}</th><th>{t('entry_price')}</th><th>TP</th><th>SL</th>
                    <th>Lev</th><th>{t('result')}</th><th>PnL%</th><th>{t('mark')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSignals.length ? filteredSignals.map(s => (
                    <tr key={s.id}>
                      <td>{new Date(s.created_at).toLocaleDateString('ru')}</td>
                      <td>{s.pair}</td>
                      <td>{s.timeframe}</td>
                      <td><span className={`tag tag-${vc(s.final_verdict)}`}>{s.final_verdict || 'вЂ”'}</span></td>
                      <td>{s.final_confidence || 'вЂ”'}%</td>
                      <td>${parseFloat(String(s.final_entry || 0)).toLocaleString()}</td>
                      <td>${parseFloat(String(s.final_tp || 0)).toLocaleString()}</td>
                      <td>${parseFloat(String(s.final_sl || 0)).toLocaleString()}</td>
                      <td>{s.final_leverage || 'вЂ”'}Г—</td>
                      <td>{s.outcome ? <span className={`tag tag-${s.outcome}`}>{s.outcome.toUpperCase()}</span> : 'вЂ”'}</td>
                      <td>{s.actual_pnl_pct != null ? s.actual_pnl_pct + '%' : 'вЂ”'}</td>
                      <td>
                        <div className="orow">
                          <button className="obtn w" onClick={() => setOutcome(s.id, 'win')}>W</button>
                          <button className="obtn l" onClick={() => setOutcome(s.id, 'loss')}>L</button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--dim)', padding: 18, fontSize: '.63rem' }}>{filterPair !== 'all' || filterTf !== 'all' || filterOutcome !== 'all' ? 'РќРµС‚ СЃРёРіРЅР°Р»РѕРІ РїРѕ С„РёР»СЊС‚СЂСѓ' : t('no_history')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {}
      {tab === 'analytics' && (
        <div>
          {}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[
              { l: 'РЎРёРіРЅР°Р»РѕРІ', v: signals.length },
              { l: 'Р Р°Р·СЂРµС€РµРЅРѕ', v: resolved.length },
              { l: 'Win Rate', v: `${wr}%`, c: wr >= 55 ? 'var(--long)' : wr >= 45 ? 'var(--wait)' : 'var(--short)' },
              { l: 'РЎСЂ. СѓРІРµСЂРµРЅРЅРѕСЃС‚СЊ', v: `${avgConf}%` },
              { l: 'РџРѕР±РµРґ', v: wins },
              { l: 'РџРѕСЂР°Р¶РµРЅРёР№', v: resolved.length - wins },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 4, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '.55rem', color: 'var(--muted)', marginBottom: 3 }}>{l}</div>
                <div style={{ fontSize: '.8rem', fontWeight: 700, color: c || 'var(--text)' }}>{v}</div>
              </div>
            ))}
          </div>

          {}
          {advStats && (
            <div className="tbox" style={{ marginBottom: 12 }}>
              <div className="thead"><span className="thead-t">Р РђРЎРЁРР Р•РќРќРђРЇ РЎРўРђРўРРЎРўРРљРђ</span></div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    {
                      label: 'Profit Factor',
                      value: advStats.profit_factor !== null ? advStats.profit_factor.toFixed(2) : 'вЂ”',
                      color: advStats.profit_factor !== null ? (advStats.profit_factor >= 1.5 ? 'var(--long)' : advStats.profit_factor >= 1 ? '#ffa500' : 'var(--short)') : 'var(--muted)',
                      tip: '>1.5 РѕС‚Р»РёС‡РЅРѕ, >1 РїСЂРёР±С‹Р»СЊРЅРѕ, <1 СѓР±С‹С‚РѕС‡РЅРѕ',
                    },
                    {
                      label: 'Max Drawdown',
                      value: `-${advStats.max_drawdown.toFixed(1)}%`,
                      color: advStats.max_drawdown > 30 ? 'var(--short)' : advStats.max_drawdown > 15 ? '#ffa500' : 'var(--long)',
                      tip: 'РњР°РєСЃРёРјР°Р»СЊРЅР°СЏ РїСЂРѕСЃР°РґРєР° РѕС‚ РїРёРєР°',
                    },
                    {
                      label: 'Sharpe Ratio',
                      value: advStats.sharpe_ratio !== null ? advStats.sharpe_ratio.toFixed(2) : 'вЂ”',
                      color: advStats.sharpe_ratio !== null ? (advStats.sharpe_ratio >= 1 ? 'var(--long)' : advStats.sharpe_ratio >= 0 ? '#ffa500' : 'var(--short)') : 'var(--muted)',
                      tip: '>1 С…РѕСЂРѕС€Рѕ, >2 РѕС‚Р»РёС‡РЅРѕ. Р”РѕС…РѕРґРЅРѕСЃС‚СЊ РЅР° РµРґРёРЅРёС†Сѓ СЂРёСЃРєР°.',
                    },
                    {
                      label: 'Expectancy',
                      value: `${advStats.expectancy >= 0 ? '+' : ''}${advStats.expectancy.toFixed(2)}%`,
                      color: advStats.expectancy >= 0 ? 'var(--long)' : 'var(--short)',
                      tip: 'РЎСЂРµРґРЅРёР№ РѕР¶РёРґР°РµРјС‹Р№ СЂРµР·СѓР»СЊС‚Р°С‚ РЅР° СЃРґРµР»РєСѓ',
                    },
                  ].map(({ label, value, color, tip }) => (
                    <div key={label} title={tip} style={{ background: 'var(--bg3)', borderRadius: 4, padding: '8px 10px', textAlign: 'center', cursor: 'help' }}>
                      <div style={{ fontSize: '.52rem', color: 'var(--dim)', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: '.78rem', fontWeight: 700, color }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: '.6rem', color: 'var(--muted)' }}>
                  <span>РЎСЂ. РїСЂРѕС„РёС‚: <span style={{ color: 'var(--long)' }}>+{advStats.avg_win}%</span></span>
                  <span>РЎСЂ. СѓР±С‹С‚РѕРє: <span style={{ color: 'var(--short)' }}>-{advStats.avg_loss}%</span></span>
                  <span>Р Р°Р·СЂРµС€РµРЅРѕ: <span style={{ color: 'var(--text)' }}>{advStats.total_resolved}</span></span>
                </div>
              </div>
            </div>
          )}

          {}
          <div className="tbox" style={{ marginBottom: 12 }}>
            <div className="thead"><span className="thead-t">РђРљРўРР’РќРћРЎРўР¬ РџРћ Р§РђРЎРђРњ (UTC)</span></div>
            <div style={{ padding: '10px 12px' }}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 60 }}>
                {Array.from({ length: 24 }, (_, h) => {
                  const s = hourlyStats[h]
                  const height = s.total > 0 ? Math.max(6, (s.total / maxHourTotal) * 54) : 3
                  const wr2 = s.total > 0 ? s.wins / s.total : 0
                  const color = s.total === 0 ? 'var(--bg3)' : wr2 >= 0.6 ? '#00e676' : wr2 >= 0.4 ? '#ffa500' : '#ff3d57'
                  return (
                    <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div
                        title={`${h}:00 UTC вЂ” ${s.total} СЃРёРіРЅ., ${s.wins}W/${s.total-s.wins}L`}
                        style={{ width: '100%', height, background: color, borderRadius: 2, transition: 'height .3s', opacity: s.total === 0 ? 0.3 : 1 }}
                      />
                      {h % 4 === 0 && <span style={{ fontSize: '.45rem', color: 'var(--dim)' }}>{h}</span>}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {[['var(--long)', '>60% WR'], ['#ffa500', '40-60% WR'], ['var(--short)', '<40% WR'], ['var(--bg3)', 'РЅРµС‚ РґР°РЅРЅС‹С…']].map(([c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, background: c as string, borderRadius: 1 }} />
                    <span style={{ fontSize: '.52rem', color: 'var(--dim)' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {}
          <div className="tbox" style={{ marginBottom: 12 }}>
            <div className="thead"><span className="thead-t">РЎР•РЎРЎРР</span></div>
            <div style={{ padding: '8px 12px' }}>
              {[
                { name: 'РђР·РёСЏ', hours: [0, 8], color: '#70a1ff' },
                { name: 'Р›РѕРЅРґРѕРЅ', hours: [7, 16], color: '#ffa502' },
                { name: 'РќСЊСЋ-Р™РѕСЂРє', hours: [13, 21], color: '#ff6b6b' },
              ].map(sess => {
                let tw = 0, tt = 0
                for (let h = sess.hours[0]; h < sess.hours[1]; h++) {
                  tw += hourlyStats[h]?.wins || 0
                  tt += hourlyStats[h]?.total || 0
                }
                const sWr = tt > 0 ? Math.round((tw / tt) * 100) : null
                return (
                  <div key={sess.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
                    <div style={{ width: 8, height: 8, background: sess.color, borderRadius: 1 }} />
                    <span style={{ fontSize: '.62rem', color: 'var(--text)', width: 70 }}>{sess.name}</span>
                    <span style={{ fontSize: '.58rem', color: 'var(--muted)' }}>{sess.hours[0]}:00вЂ“{sess.hours[1]}:00 UTC</span>
                    <span style={{ marginLeft: 'auto', fontSize: '.62rem', fontWeight: 600 }}>
                      {sWr !== null ? `${sWr}% WR` : 'вЂ”'} <span style={{ color: 'var(--dim)', fontWeight: 400 }}>({tt} СЃРёРіРЅ.)</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {}
          {confBuckets.length > 0 && (
            <div className="tbox" style={{ marginBottom: 12 }}>
              <div className="thead"><span className="thead-t">РљРђР›РР‘Р РћР’РљРђ РЈР’Р•Р Р•РќРќРћРЎРўР</span></div>
              <div style={{ padding: '10px 12px' }}>
                <p style={{ fontSize: '.58rem', color: 'var(--dim)', marginBottom: 10 }}>
                  Р РµР°Р»СЊРЅС‹Р№ Win Rate РґР»СЏ РєР°Р¶РґРѕРіРѕ РґРёР°РїР°Р·РѕРЅР° СѓРІРµСЂРµРЅРЅРѕСЃС‚Рё AI. Р§РµРј Р±Р»РёР¶Рµ WR Рє confidence вЂ” С‚РµРј Р»СѓС‡С€Рµ РѕС‚РєР°Р»РёР±СЂРѕРІР°РЅ.
                </p>
                {confBuckets.map(b => {
                  const wr = b.win_rate ?? 0
                  const wrColor = wr >= 60 ? 'var(--long)' : wr >= 45 ? '#ffa500' : 'var(--short)'
                  const confMid = b.bucket + 5
                  const gap = Math.abs(wr - confMid)
                  return (
                    <div key={b.bucket} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: '.6rem', color: 'var(--muted)', width: 56 }}>{b.label}</span>
                        <div style={{ flex: 1, height: 6, background: 'var(--bg3)', borderRadius: 3, position: 'relative' }}>
                          {/* РџРѕР»РѕСЃР° WR */}
                          <div style={{ height: 6, borderRadius: 3, width: `${wr}%`, background: wrColor, transition: 'width .4s' }} />
                          {/* РњР°СЂРєРµСЂ РѕР¶РёРґР°РµРјРѕРіРѕ confidence */}
                          <div style={{ position: 'absolute', top: -2, left: `${confMid}%`, width: 2, height: 10, background: 'var(--cyan)', borderRadius: 1 }} title={`AI Р·Р°СЏРІР»СЏРµС‚ ~${confMid}%`} />
                        </div>
                        <span style={{ fontSize: '.6rem', fontWeight: 700, color: wrColor, width: 38, textAlign: 'right' }}>
                          {b.win_rate !== null ? `${b.win_rate}%` : 'вЂ”'}
                        </span>
                        <span style={{ fontSize: '.55rem', color: 'var(--dim)', width: 44 }}>
                          {b.total} СЃРёРіРЅ.
                        </span>
                        <span style={{ fontSize: '.52rem', color: gap <= 10 ? 'var(--long)' : gap <= 20 ? '#ffa500' : 'var(--short)', width: 48 }}
                          title="Р Р°СЃС…РѕР¶РґРµРЅРёРµ РјРµР¶РґСѓ Р·Р°СЏРІР»РµРЅРЅРѕР№ СѓРІРµСЂРµРЅРЅРѕСЃС‚СЊСЋ Рё СЂРµР°Р»СЊРЅС‹Рј WR">
                          {gap <= 10 ? 'вњ“ С‚РѕС‡РЅРѕ' : gap <= 20 ? '~ РЅРѕСЂРј' : 'вњ— Р·Р°РІС‹С€РµРЅ'}
                        </span>
                      </div>
                      {b.avg_pnl !== null && (
                        <div style={{ fontSize: '.54rem', color: 'var(--dim)', marginLeft: 64 }}>
                          СЃСЂРµРґРЅРёР№ PnL: <span style={{ color: b.avg_pnl >= 0 ? 'var(--long)' : 'var(--short)' }}>
                            {b.avg_pnl >= 0 ? '+' : ''}{b.avg_pnl}%
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <div style={{ width: 2, height: 10, background: 'var(--cyan)', borderRadius: 1 }} />
                  <span style={{ fontSize: '.52rem', color: 'var(--dim)' }}>вЂ” Р·Р°СЏРІР»РµРЅРЅР°СЏ СѓРІРµСЂРµРЅРЅРѕСЃС‚СЊ AI</span>
                </div>
              </div>
            </div>
          )}

          {}
          {pairStats.length > 0 && (
            <div className="tbox">
              <div className="thead"><span className="thead-t">РџРђР Р«</span></div>
              <div style={{ padding: '8px 12px' }}>
                {pairStats.slice(0, 10).map(ps => (
                  <div key={ps.pair} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: '.62rem', width: 80 }}>{ps.pair}</span>
                    <div style={{ flex: 1, height: 4, background: 'var(--bg3)', borderRadius: 2 }}>
                      <div style={{ height: 4, borderRadius: 2, width: `${ps.wr}%`, background: ps.wr >= 55 ? 'var(--long)' : ps.wr >= 45 ? 'var(--wait)' : 'var(--short)' }} />
                    </div>
                    <span style={{ fontSize: '.6rem', color: 'var(--muted)', width: 60, textAlign: 'right' }}>
                      {ps.wr}% ({ps.total})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!analyticsLoaded && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--dim)', fontSize: '.65rem' }}>Р—Р°РїСѓСЃС‚РёС‚Рµ Р°РЅР°Р»РёР· С‡С‚РѕР±С‹ СЃРѕР±СЂР°С‚СЊ СЃС‚Р°С‚РёСЃС‚РёРєСѓ</div>
          )}
        </div>
      )}

      {}
      {tab === 'review' && (
        <div>
          <div style={{ fontSize: '.65rem', color: 'var(--muted)', marginBottom: 10 }}>
            Р’С‹Р±РµСЂРёС‚Рµ СѓР±С‹С‚РѕС‡РЅСѓСЋ СЃРґРµР»РєСѓ РґР»СЏ СЂР°Р·Р±РѕСЂР°, СѓРєР°Р¶РёС‚Рµ С‚РёРї РѕС€РёР±РєРё Рё Р·Р°РїРёС€РёС‚Рµ СѓСЂРѕРє.
          </div>

          {}
          <div className="tbox" style={{ marginBottom: 12 }}>
            <div className="thead"><span className="thead-t">РЈР‘Р«РўРћР§РќР«Р• РЎР”Р•Р›РљР ({losses.length})</span></div>
            <div style={{ padding: '6px 0', maxHeight: 180, overflowY: 'auto' }}>
              {losses.length === 0 && (
                <div style={{ textAlign: 'center', padding: 14, color: 'var(--dim)', fontSize: '.63rem' }}>
                  РќРµС‚ СѓР±С‹С‚РѕС‡РЅС‹С… СЃРґРµР»РѕРє СЃ РѕС‚РјРµС‚РєРѕР№ "loss"
                </div>
              )}
              {losses.map(s => (
                <div
                  key={s.id}
                  onClick={() => { setReviewSignal(s); setReviewCat(''); setReviewNote(''); setReviewSaved(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer',
                    background: reviewSignal?.id === s.id ? 'var(--bg3)' : 'transparent',
                    borderLeft: reviewSignal?.id === s.id ? '2px solid var(--short)' : '2px solid transparent',
                  }}
                >
                  <span style={{ fontSize: '.6rem', color: 'var(--dim)' }}>{new Date(s.created_at).toLocaleDateString('ru')}</span>
                  <span style={{ fontSize: '.63rem' }}>{s.pair}</span>
                  <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>{s.timeframe}</span>
                  <span className={`tag tag-${vc(s.final_verdict)}`} style={{ fontSize: '.55rem' }}>{s.final_verdict}</span>
                  {s.actual_pnl_pct != null && (
                    <span style={{ marginLeft: 'auto', fontSize: '.6rem', color: 'var(--short)' }}>{s.actual_pnl_pct}%</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {}
          {reviewSignal && (
            <div className="tbox">
              <div className="thead">
                <span className="thead-t">Р РђР—Р‘РћР : {reviewSignal.pair} В· {reviewSignal.timeframe}</span>
              </div>
              <div style={{ padding: '12px' }}>
                {}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[
                    { l: 'РЎРёРіРЅР°Р»', v: reviewSignal.final_verdict || 'вЂ”' },
                    { l: 'РЈРІРµСЂРµРЅ.', v: `${reviewSignal.final_confidence || 0}%` },
                    { l: 'Р РёСЃРє', v: `${reviewSignal.final_risk_score || 0}/10` },
                    { l: 'РџР»РµС‡Рѕ', v: `${reviewSignal.final_leverage || 1}Г—` },
                  ].map(({ l, v }) => (
                    <div key={l} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 3, padding: '5px 7px', textAlign: 'center' }}>
                      <div style={{ fontSize: '.53rem', color: 'var(--muted)', marginBottom: 2 }}>{l}</div>
                      <div style={{ fontSize: '.65rem', fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {}
                <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' }}>РљР°С‚РµРіРѕСЂРёСЏ РѕС€РёР±РєРё</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
                  {ERROR_CATEGORIES.map(ec => (
                    <button
                      key={ec.id}
                      onClick={() => setReviewCat(ec.id)}
                      title={ec.desc}
                      style={{
                        padding: '4px 10px', fontSize: '.6rem', borderRadius: 3, cursor: 'pointer', border: 'none',
                        background: reviewCat === ec.id ? 'var(--short)' : 'var(--bg3)',
                        color: reviewCat === ec.id ? '#fff' : 'var(--muted)',
                        fontWeight: reviewCat === ec.id ? 600 : 400,
                      }}
                    >{ec.label}</button>
                  ))}
                </div>

                {}
                {reviewCat && (
                  <div style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.2)', borderRadius: 3, padding: '7px 10px', marginBottom: 10, fontSize: '.62rem', color: 'var(--muted)' }}>
                    <strong style={{ color: 'var(--short)' }}>{ERROR_CATEGORIES.find(e => e.id === reviewCat)?.label}:</strong>{' '}
                    {ERROR_CATEGORIES.find(e => e.id === reviewCat)?.desc}
                  </div>
                )}

                {}
                <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase' }}>РЈСЂРѕРє (С‡С‚Рѕ РёСЃРїСЂР°РІРёС‚СЊ)</div>
                <textarea
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder="Р—Р°РїРёС€РёС‚Рµ, С‡С‚Рѕ РЅСѓР¶РЅРѕ РёР·РјРµРЅРёС‚СЊ РІ СЃР»РµРґСѓСЋС‰РёР№ СЂР°Р·..."
                  style={{
                    width: '100%', minHeight: 70, background: 'var(--bg3)', border: '1px solid var(--line2)',
                    borderRadius: 3, padding: '7px 10px', fontSize: '.63rem', color: 'var(--text)',
                    resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                  }}
                />

                {}
                {reviewCat && (
                  <div style={{ background: 'rgba(0,200,118,0.07)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: 3, padding: '8px 10px', marginTop: 8 }}>
                    <div style={{ fontSize: '.58rem', color: 'var(--long)', fontWeight: 600, marginBottom: 4 }}>Р Р•РљРћРњР•РќР”РђР¦РРЇ</div>
                    <div style={{ fontSize: '.62rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                      {reviewCat === 'fomo' && 'Р–РґР°С‚СЊ СЂРµС‚РµСЃС‚ Р·РѕРЅС‹ OB/FVG РїРµСЂРµРґ РІС…РѕРґРѕРј. РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ Р»РёРјРёС‚РЅС‹Р№ РѕСЂРґРµСЂ.'}
                      {reviewCat === 'htf_bias' && 'РџРµСЂРµРґ РєР°Р¶РґС‹Рј РІС…РѕРґРѕРј РїСЂРѕРІРµСЂСЏС‚СЊ HTF bias РЅР° 4H Рё 1D. РўРѕСЂРіРѕРІР°С‚СЊ С‚РѕР»СЊРєРѕ РІ РЅР°РїСЂР°РІР»РµРЅРёРё HTF.'}
                      {reviewCat === 'no_ob' && 'Р’С…РѕРґРёС‚СЊ С‚РѕР»СЊРєРѕ Сѓ РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅС‹С… OB A+/A РёР»Рё РЅРµР·Р°РїРѕР»РЅРµРЅРЅС‹С… FVG.'}
                      {reviewCat === 'early' && 'Р–РґР°С‚СЊ Р·Р°РєСЂС‹С‚РёСЏ СЃРІРµС‡Рё СЃ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµРј (BOS РёР»Рё СЂРµС‚РµСЃС‚). РќРµ РІС…РѕРґРёС‚СЊ РїСЂРё РѕС‚РєСЂС‹С‚РѕР№ СЃРІРµС‡Рµ.'}
                      {reviewCat === 'risk' && 'РњР°РєСЃРёРјСѓРј 1-2% СЂРёСЃРєР° РЅР° СЃРґРµР»РєСѓ. R:R РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РјРёРЅРёРјСѓРј 1:1.5 РїРµСЂРµРґ РІС…РѕРґРѕРј.'}
                      {reviewCat === 'session' && 'РўРѕСЂРіРѕРІР°С‚СЊ С‚РѕР»СЊРєРѕ РІ Р°РєС‚РёРІРЅС‹Рµ С‡Р°СЃС‹: Р›РѕРЅРґРѕРЅ (7-16 UTC) Рё NY (13-21 UTC). РР·Р±РµРіР°С‚СЊ Р°Р·РёР°С‚СЃРєСѓСЋ СЃРµСЃСЃРёСЋ РґР»СЏ РІРѕР»Р°С‚РёР»СЊРЅС‹С… Р°РєС‚РёРІРѕРІ.'}
                      {reviewCat === 'other' && 'Р—Р°С„РёРєСЃРёСЂСѓР№С‚Рµ РєРѕРЅРєСЂРµС‚РЅСѓСЋ РѕС€РёР±РєСѓ РІ РїРѕР»Рµ РІС‹С€Рµ Рё СЃРѕР·РґР°Р№С‚Рµ РїСЂР°РІРёР»Рѕ РґР»СЏ РµС‘ РёР·Р±РµР¶Р°РЅРёСЏ.'}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { if (reviewCat || reviewNote) { showToast('Р Р°Р·Р±РѕСЂ СЃРѕС…СЂР°РЅС‘РЅ', 'ok'); setReviewSaved(true) } }}
                  style={{ marginTop: 10, padding: '6px 16px', background: reviewSaved ? 'var(--bg3)' : 'var(--cyan)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: '.62rem', fontWeight: 600, color: reviewSaved ? 'var(--muted)' : '#000' }}
                >
                  {reviewSaved ? 'РЎРѕС…СЂР°РЅРµРЅРѕ вњ“' : 'РЎРѕС…СЂР°РЅРёС‚СЊ СЂР°Р·Р±РѕСЂ'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {}
      {tab === 'quiz' && (
        <div>
          {!qFinished ? (
            <div className="tbox">
              <div className="thead">
                <span className="thead-t">SMC РљР’РР—</span>
                <span style={{ fontSize: '.58rem', color: 'var(--muted)', marginLeft: 8 }}>
                  {qIdx + 1}/{QUIZ_SCENARIOS.length} В· {qScore} РїСЂР°РІРёР»СЊРЅРѕ
                </span>
              </div>
              <div style={{ padding: '14px 14px 12px' }}>
                {}
                <div style={{ height: 3, background: 'var(--bg3)', borderRadius: 2, marginBottom: 12 }}>
                  <div style={{ height: 3, borderRadius: 2, width: `${((qIdx + 1) / QUIZ_SCENARIOS.length) * 100}%`, background: 'var(--cyan)', transition: 'width .3s' }} />
                </div>

                <div style={{ marginBottom: 12, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--line2)' }}>
                  <QuizDiagram idx={qIdx} />
                </div>

                <div style={{ fontSize: '.7rem', color: 'var(--text)', lineHeight: 1.55, marginBottom: 14 }}>
                  {QUIZ_SCENARIOS[qIdx].q}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {QUIZ_SCENARIOS[qIdx].opts.map((opt, i) => {
                    let bg = 'var(--bg3)'
                    let border = 'var(--line2)'
                    let color = 'var(--text)'
                    if (qAnswered !== null) {
                      if (i === QUIZ_SCENARIOS[qIdx].ans) { bg = 'rgba(0,230,118,0.12)'; border = '#00e676'; color = 'var(--long)' }
                      else if (i === qAnswered && qAnswered !== QUIZ_SCENARIOS[qIdx].ans) { bg = 'rgba(255,61,87,0.12)'; border = '#ff3d57'; color = 'var(--short)' }
                    }
                    return (
                      <button
                        key={i}
                        onClick={() => answerQuiz(i)}
                        disabled={qAnswered !== null}
                        style={{
                          padding: '9px 12px', background: bg, border: `1px solid ${border}`,
                          borderRadius: 4, cursor: qAnswered !== null ? 'default' : 'pointer',
                          textAlign: 'left', fontSize: '.65rem', color, transition: 'all .2s',
                        }}
                      >
                        <span style={{ fontWeight: 600, marginRight: 8 }}>{String.fromCharCode(65 + i)}.</span>
                        {opt}
                      </button>
                    )
                  })}
                </div>

                {}
                {qAnswered !== null && (
                  <div style={{ marginTop: 10, background: 'var(--bg3)', borderRadius: 4, padding: '10px 12px' }}>
                    <div style={{ fontSize: '.58rem', fontWeight: 600, marginBottom: 4, color: qAnswered === QUIZ_SCENARIOS[qIdx].ans ? 'var(--long)' : 'var(--short)' }}>
                      {qAnswered === QUIZ_SCENARIOS[qIdx].ans ? 'вњ“ РџР РђР’РР›Р¬РќРћ' : 'вњ— РќР•РџР РђР’РР›Р¬РќРћ'}
                    </div>
                    <div style={{ fontSize: '.63rem', color: 'var(--muted)', lineHeight: 1.55 }}>
                      {QUIZ_SCENARIOS[qIdx].exp}
                    </div>
                    <button
                      onClick={nextQuestion}
                      style={{ marginTop: 10, padding: '6px 16px', background: 'var(--cyan)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: '.62rem', fontWeight: 600, color: '#000' }}
                    >
                      {qIdx + 1 < QUIZ_SCENARIOS.length ? 'Р”Р°Р»РµРµ в†’' : 'Р РµР·СѓР»СЊС‚Р°С‚'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            
            <div className="tbox">
              <div className="thead"><span className="thead-t">Р Р•Р—РЈР›Р¬РўРђРў РљР’РР—Рђ</span></div>
              <div style={{ padding: '20px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 700, color: qScore >= 6 ? 'var(--long)' : qScore >= 4 ? 'var(--wait)' : 'var(--short)' }}>
                  {qScore}/{QUIZ_SCENARIOS.length}
                </div>
                <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: 16 }}>
                  {qScore >= 7 ? 'РћС‚Р»РёС‡РЅРѕ! Р’С‹ С…РѕСЂРѕС€Рѕ Р·РЅР°РµС‚Рµ Smart Money Concepts.' : qScore >= 5 ? 'РҐРѕСЂРѕС€Рѕ! РџРѕРІС‚РѕСЂРёС‚Рµ СЃР»Р°Р±С‹Рµ РјРµСЃС‚Р°.' : 'РќСѓР¶РЅР° РїСЂР°РєС‚РёРєР°. РР·СѓС‡РёС‚Рµ РєРѕРЅС†РµРїС†РёРё SMC.'}
                </div>
                {}
                {qHistory.filter(h => !h.correct).length > 0 && (
                  <div style={{ textAlign: 'left', marginBottom: 14 }}>
                    <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 8 }}>РћРЁРР‘РљР:</div>
                    {qHistory.map((h, i) => !h.correct ? (
                      <div key={i} style={{ marginBottom: 8, padding: '7px 10px', background: 'rgba(255,61,87,0.08)', borderRadius: 3 }}>
                        <div style={{ fontSize: '.62rem', color: 'var(--text)', marginBottom: 3 }}>{QUIZ_SCENARIOS[i].q.slice(0, 70)}...</div>
                        <div style={{ fontSize: '.6rem', color: 'var(--muted)' }}>
                          Р’Р°С€ РѕС‚РІРµС‚: <span style={{ color: 'var(--short)' }}>{QUIZ_SCENARIOS[i].opts[h.chosen]}</span>
                          {' В· '}РџСЂР°РІРёР»СЊРЅРѕ: <span style={{ color: 'var(--long)' }}>{QUIZ_SCENARIOS[i].opts[QUIZ_SCENARIOS[i].ans]}</span>
                        </div>
                      </div>
                    ) : null)}
                  </div>
                )}
                <button
                  onClick={restartQuiz}
                  style={{ padding: '8px 24px', background: 'var(--cyan)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '.65rem', fontWeight: 700, color: '#000' }}
                >
                  РџСЂРѕР№С‚Рё СЃРЅРѕРІР°
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
