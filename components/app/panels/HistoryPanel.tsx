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

// ── Session Analytics helpers ──────────────────────────────────────────────────

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

// ── Error Analysis helpers ─────────────────────────────────────────────────────

const ERROR_CATEGORIES = [
  { id: 'fomo',     label: 'FOMO вход', desc: 'Вход без подтверждения, погоня за движением' },
  { id: 'htf_bias', label: 'Против HTF', desc: 'Сделка против старшего таймфрейма' },
  { id: 'no_ob',    label: 'Нет OB/FVG', desc: 'Вход не у зоны поддержки/сопротивления' },
  { id: 'early',    label: 'Ранний вход', desc: 'Вошли до подтверждения пробоя/ретеста' },
  { id: 'risk',     label: 'Риск-менеджмент', desc: 'Слишком большой риск или маленький R:R' },
  { id: 'session',  label: 'Неверная сессия', desc: 'Торговля в неактивные часы' },
  { id: 'other',    label: 'Прочее', desc: '' },
]

// ── Quiz data ─────────────────────────────────────────────────────────────────

const QUIZ_SCENARIOS = [
  {
    q: 'На графике: цена пробила вверх уровень равных максимумов, затем резко откатилась ниже. Что произошло?',
    opts: ['Bullish BOS', 'Sweep of Sell-Side Liquidity', 'Bullish FVG', 'Change of Character'],
    ans: 1,
    exp: 'Цена "снесла" стопы продавцов (equal highs = SSL), после чего развернулась — типичный sweep sell-side liquidity перед продолжением нисходящего движения.',
  },
  {
    q: 'Последняя медвежья свеча перед сильным бычьим импульсом +2% называется...',
    opts: ['FVG', 'Bullish Order Block', 'Breaker Block', 'BSL'],
    ans: 1,
    exp: 'Bullish Order Block — последняя медвежья свеча перед импульсным движением вверх. Цена часто возвращается в эту зону для "подбора ликвидности".',
  },
  {
    q: 'Order Block был "пробит" (цена закрылась за его пределами). Как он теперь называется?',
    opts: ['Mitigation Block', 'FVG', 'Breaker Block', 'COB'],
    ans: 2,
    exp: 'Breaker Block — OB после пробоя меняет роль. Bullish OB, пробитый вниз, становится Bearish Breaker Block (теперь зона сопротивления).',
  },
  {
    q: 'Три свечи: prev.high=100, curr=95-102, next.low=103. Это...',
    opts: ['Bearish FVG', 'Bullish FVG', 'Equal Highs', 'Bullish OB'],
    ans: 1,
    exp: 'Bullish FVG (Fair Value Gap): разрыв между prev.high (100) и next.low (103). Цена "прыгнула" вверх, оставив незаполненную зону. Будет тяготеть к заполнению.',
  },
  {
    q: 'HTF trend = bullish, LTF trend = bearish, цена у bullish OB. Оптимальный сетап:',
    opts: ['SHORT по LTF тренду', 'LONG — confluence HTF+OB', 'WAIT — противоречие', 'LONG без подтверждения'],
    ans: 1,
    exp: 'LONG — идеальный Smart Money сетап: HTF структура bullish + цена у bullish OB = конфлюэнс. Это высоковероятный вход в направлении "умных денег".',
  },
  {
    q: 'Свечи: 5 Higher Highs + 5 Higher Lows за последние 10 баров. Что показывает?',
    opts: ['Ranging рынок', 'Change of Character', 'Bullish BOS (Break of Structure)', 'Bearish trend'],
    ans: 2,
    exp: 'Break of Structure (BOS) — рынок формирует HH+HL, структура bychья. BOS подтверждает продолжение bullish тренда, пока структура не нарушена.',
  },
  {
    q: 'Что означает "Change of Character" (COB/CHoCH) на рынке?',
    opts: ['Усиление текущего тренда', 'Первый признак разворота', 'Уровень ликвидности', 'Заполнение FVG'],
    ans: 1,
    exp: 'Change of Character (CHoCH) — первое нарушение структуры противоположного направления. Например, первый LL в bullish тренде. Это сигнал возможного разворота.',
  },
  {
    q: 'Объём на свече-основании OB значительно выше среднего (relVolume > 1.5). Это делает OB:',
    opts: ['Слабее (много продавцов)', 'Сильнее (институциональный)', 'Неважно для оценки', 'Mitigation Block'],
    ans: 1,
    exp: 'Высокий относительный объём указывает на институциональную активность. Такой OB получает качество A или A+ и с большей вероятностью удержит цену при ретесте.',
  },
]

export default function HistoryPanel() {
  const { t } = useLang()
  const [tab, setTab] = useState<'history' | 'analytics' | 'review' | 'quiz'>('history')
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(false)

  // Analytics
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false)

  // Error review
  const [reviewSignal, setReviewSignal] = useState<Signal | null>(null)
  const [reviewCat, setReviewCat] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewSaved, setReviewSaved] = useState(false)

  // Quiz
  const [qIdx, setQIdx] = useState(0)
  const [qScore, setQScore] = useState(0)
  const [qAnswered, setQAnswered] = useState<number | null>(null)
  const [qFinished, setQFinished] = useState(false)
  const [qHistory, setQHistory] = useState<{ correct: boolean; chosen: number }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/signals?limit=200')
    const d = await r.json()
    if (d.ok) setSignals(d.signals || [])
    setLoading(false)
    setAnalyticsLoaded(true)
  }, [])

  useEffect(() => { load() }, [load])

  async function setOutcome(id: number, outcome: string) {
    await fetch(`/api/signals/${id}/outcome`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome }),
    })
    showToast(outcome === 'win' ? t('win_marked') : t('loss_marked'))
    load()
  }

  // ── Quiz logic ────────────────────────────────────────────────────────────

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

  // ── Analytics derived data ────────────────────────────────────────────────

  const resolved = signals.filter(s => s.outcome)
  const wins = resolved.filter(s => s.outcome === 'win').length
  const wr = resolved.length ? Math.round((wins / resolved.length) * 100) : 0
  const avgConf = signals.length ? Math.round(signals.reduce((a, s) => a + (s.final_confidence || 0), 0) / signals.length) : 0
  const hourlyStats = buildHourlyStats(signals)
  const pairStats = buildPairStats(signals)
  const maxHourTotal = Math.max(...Object.values(hourlyStats).map(h => h.total), 1)

  const losses = signals.filter(s => s.outcome === 'loss')

  // ── Render ────────────────────────────────────────────────────────────────

  const TABS = [
    { id: 'history',   label: 'История' },
    { id: 'analytics', label: 'Аналитика' },
    { id: 'review',    label: 'Разбор ошибок' },
    { id: 'quiz',      label: 'Квиз' },
  ] as const

  return (
    <div className="panel active" id="panel-history">
      {/* Tab bar */}
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

      {/* ── HISTORY TAB ── */}
      {tab === 'history' && (
        <div className="tbox">
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
                  {signals.length ? signals.map(s => (
                    <tr key={s.id}>
                      <td>{new Date(s.created_at).toLocaleDateString('ru')}</td>
                      <td>{s.pair}</td>
                      <td>{s.timeframe}</td>
                      <td><span className={`tag tag-${vc(s.final_verdict)}`}>{s.final_verdict || '—'}</span></td>
                      <td>{s.final_confidence || '—'}%</td>
                      <td>${parseFloat(String(s.final_entry || 0)).toLocaleString()}</td>
                      <td>${parseFloat(String(s.final_tp || 0)).toLocaleString()}</td>
                      <td>${parseFloat(String(s.final_sl || 0)).toLocaleString()}</td>
                      <td>{s.final_leverage || '—'}×</td>
                      <td>{s.outcome ? <span className={`tag tag-${s.outcome}`}>{s.outcome.toUpperCase()}</span> : '—'}</td>
                      <td>{s.actual_pnl_pct != null ? s.actual_pnl_pct + '%' : '—'}</td>
                      <td>
                        <div className="orow">
                          <button className="obtn w" onClick={() => setOutcome(s.id, 'win')}>W</button>
                          <button className="obtn l" onClick={() => setOutcome(s.id, 'loss')}>L</button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--dim)', padding: 18, fontSize: '.63rem' }}>{t('no_history')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {tab === 'analytics' && (
        <div>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[
              { l: 'Сигналов', v: signals.length },
              { l: 'Разрешено', v: resolved.length },
              { l: 'Win Rate', v: `${wr}%`, c: wr >= 55 ? 'var(--long)' : wr >= 45 ? 'var(--wait)' : 'var(--short)' },
              { l: 'Ср. уверенность', v: `${avgConf}%` },
              { l: 'Побед', v: wins },
              { l: 'Поражений', v: resolved.length - wins },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 4, padding: '8px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: '.55rem', color: 'var(--muted)', marginBottom: 3 }}>{l}</div>
                <div style={{ fontSize: '.8rem', fontWeight: 700, color: c || 'var(--text)' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Hourly heatmap */}
          <div className="tbox" style={{ marginBottom: 12 }}>
            <div className="thead"><span className="thead-t">АКТИВНОСТЬ ПО ЧАСАМ (UTC)</span></div>
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
                        title={`${h}:00 UTC — ${s.total} сигн., ${s.wins}W/${s.total-s.wins}L`}
                        style={{ width: '100%', height, background: color, borderRadius: 2, transition: 'height .3s', opacity: s.total === 0 ? 0.3 : 1 }}
                      />
                      {h % 4 === 0 && <span style={{ fontSize: '.45rem', color: 'var(--dim)' }}>{h}</span>}
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {[['var(--long)', '>60% WR'], ['#ffa500', '40-60% WR'], ['var(--short)', '<40% WR'], ['var(--bg3)', 'нет данных']].map(([c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 8, height: 8, background: c as string, borderRadius: 1 }} />
                    <span style={{ fontSize: '.52rem', color: 'var(--dim)' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Session breakdown */}
          <div className="tbox" style={{ marginBottom: 12 }}>
            <div className="thead"><span className="thead-t">СЕССИИ</span></div>
            <div style={{ padding: '8px 12px' }}>
              {[
                { name: 'Азия', hours: [0, 8], color: '#70a1ff' },
                { name: 'Лондон', hours: [7, 16], color: '#ffa502' },
                { name: 'Нью-Йорк', hours: [13, 21], color: '#ff6b6b' },
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
                    <span style={{ fontSize: '.58rem', color: 'var(--muted)' }}>{sess.hours[0]}:00–{sess.hours[1]}:00 UTC</span>
                    <span style={{ marginLeft: 'auto', fontSize: '.62rem', fontWeight: 600 }}>
                      {sWr !== null ? `${sWr}% WR` : '—'} <span style={{ color: 'var(--dim)', fontWeight: 400 }}>({tt} сигн.)</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pair breakdown */}
          {pairStats.length > 0 && (
            <div className="tbox">
              <div className="thead"><span className="thead-t">ПАРЫ</span></div>
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
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--dim)', fontSize: '.65rem' }}>Запустите анализ чтобы собрать статистику</div>
          )}
        </div>
      )}

      {/* ── ERROR REVIEW TAB ── */}
      {tab === 'review' && (
        <div>
          <div style={{ fontSize: '.65rem', color: 'var(--muted)', marginBottom: 10 }}>
            Выберите убыточную сделку для разбора, укажите тип ошибки и запишите урок.
          </div>

          {/* Loss list */}
          <div className="tbox" style={{ marginBottom: 12 }}>
            <div className="thead"><span className="thead-t">УБЫТОЧНЫЕ СДЕЛКИ ({losses.length})</span></div>
            <div style={{ padding: '6px 0', maxHeight: 180, overflowY: 'auto' }}>
              {losses.length === 0 && (
                <div style={{ textAlign: 'center', padding: 14, color: 'var(--dim)', fontSize: '.63rem' }}>
                  Нет убыточных сделок с отметкой "loss"
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

          {/* Review form */}
          {reviewSignal && (
            <div className="tbox">
              <div className="thead">
                <span className="thead-t">РАЗБОР: {reviewSignal.pair} · {reviewSignal.timeframe}</span>
              </div>
              <div style={{ padding: '12px' }}>
                {/* Signal details */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[
                    { l: 'Сигнал', v: reviewSignal.final_verdict || '—' },
                    { l: 'Уверен.', v: `${reviewSignal.final_confidence || 0}%` },
                    { l: 'Риск', v: `${reviewSignal.final_risk_score || 0}/10` },
                    { l: 'Плечо', v: `${reviewSignal.final_leverage || 1}×` },
                  ].map(({ l, v }) => (
                    <div key={l} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 3, padding: '5px 7px', textAlign: 'center' }}>
                      <div style={{ fontSize: '.53rem', color: 'var(--muted)', marginBottom: 2 }}>{l}</div>
                      <div style={{ fontSize: '.65rem', fontWeight: 600 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Error category */}
                <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase' }}>Категория ошибки</div>
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

                {/* Error description */}
                {reviewCat && (
                  <div style={{ background: 'rgba(255,61,87,0.08)', border: '1px solid rgba(255,61,87,0.2)', borderRadius: 3, padding: '7px 10px', marginBottom: 10, fontSize: '.62rem', color: 'var(--muted)' }}>
                    <strong style={{ color: 'var(--short)' }}>{ERROR_CATEGORIES.find(e => e.id === reviewCat)?.label}:</strong>{' '}
                    {ERROR_CATEGORIES.find(e => e.id === reviewCat)?.desc}
                  </div>
                )}

                {/* Lesson note */}
                <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase' }}>Урок (что исправить)</div>
                <textarea
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder="Запишите, что нужно изменить в следующий раз..."
                  style={{
                    width: '100%', minHeight: 70, background: 'var(--bg3)', border: '1px solid var(--line2)',
                    borderRadius: 3, padding: '7px 10px', fontSize: '.63rem', color: 'var(--text)',
                    resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                  }}
                />

                {/* Suggested improvement based on category */}
                {reviewCat && (
                  <div style={{ background: 'rgba(0,200,118,0.07)', border: '1px solid rgba(0,230,118,0.2)', borderRadius: 3, padding: '8px 10px', marginTop: 8 }}>
                    <div style={{ fontSize: '.58rem', color: 'var(--long)', fontWeight: 600, marginBottom: 4 }}>РЕКОМЕНДАЦИЯ</div>
                    <div style={{ fontSize: '.62rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                      {reviewCat === 'fomo' && 'Ждать ретест зоны OB/FVG перед входом. Использовать лимитный ордер.'}
                      {reviewCat === 'htf_bias' && 'Перед каждым входом проверять HTF bias на 4H и 1D. Торговать только в направлении HTF.'}
                      {reviewCat === 'no_ob' && 'Входить только у подтверждённых OB A+/A или незаполненных FVG.'}
                      {reviewCat === 'early' && 'Ждать закрытия свечи с подтверждением (BOS или ретест). Не входить при открытой свече.'}
                      {reviewCat === 'risk' && 'Максимум 1-2% риска на сделку. R:R должен быть минимум 1.5:1 перед входом.'}
                      {reviewCat === 'session' && 'Торговать только в активные часы: Лондон (7-16 UTC) и NY (13-21 UTC). Избегать азиатскую сессию для волатильных активов.'}
                      {reviewCat === 'other' && 'Зафиксируйте конкретную ошибку в поле выше и создайте правило для её избежания.'}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { if (reviewCat || reviewNote) { showToast('Разбор сохранён', 'ok'); setReviewSaved(true) } }}
                  style={{ marginTop: 10, padding: '6px 16px', background: reviewSaved ? 'var(--bg3)' : 'var(--cyan)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: '.62rem', fontWeight: 600, color: reviewSaved ? 'var(--muted)' : '#000' }}
                >
                  {reviewSaved ? 'Сохранено ✓' : 'Сохранить разбор'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── QUIZ TAB ── */}
      {tab === 'quiz' && (
        <div>
          {!qFinished ? (
            <div className="tbox">
              <div className="thead">
                <span className="thead-t">SMC КВИЗ</span>
                <span style={{ fontSize: '.58rem', color: 'var(--muted)', marginLeft: 8 }}>
                  {qIdx + 1}/{QUIZ_SCENARIOS.length} · {qScore} правильно
                </span>
              </div>
              <div style={{ padding: '14px 14px 12px' }}>
                {/* Progress */}
                <div style={{ height: 3, background: 'var(--bg3)', borderRadius: 2, marginBottom: 12 }}>
                  <div style={{ height: 3, borderRadius: 2, width: `${((qIdx + 1) / QUIZ_SCENARIOS.length) * 100}%`, background: 'var(--cyan)', transition: 'width .3s' }} />
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

                {/* Explanation */}
                {qAnswered !== null && (
                  <div style={{ marginTop: 10, background: 'var(--bg3)', borderRadius: 4, padding: '10px 12px' }}>
                    <div style={{ fontSize: '.58rem', fontWeight: 600, marginBottom: 4, color: qAnswered === QUIZ_SCENARIOS[qIdx].ans ? 'var(--long)' : 'var(--short)' }}>
                      {qAnswered === QUIZ_SCENARIOS[qIdx].ans ? '✓ ПРАВИЛЬНО' : '✗ НЕПРАВИЛЬНО'}
                    </div>
                    <div style={{ fontSize: '.63rem', color: 'var(--muted)', lineHeight: 1.55 }}>
                      {QUIZ_SCENARIOS[qIdx].exp}
                    </div>
                    <button
                      onClick={nextQuestion}
                      style={{ marginTop: 10, padding: '6px 16px', background: 'var(--cyan)', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: '.62rem', fontWeight: 600, color: '#000' }}
                    >
                      {qIdx + 1 < QUIZ_SCENARIOS.length ? 'Далее →' : 'Результат'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Quiz result */
            <div className="tbox">
              <div className="thead"><span className="thead-t">РЕЗУЛЬТАТ КВИЗА</span></div>
              <div style={{ padding: '20px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: '2.2rem', fontWeight: 700, color: qScore >= 6 ? 'var(--long)' : qScore >= 4 ? 'var(--wait)' : 'var(--short)' }}>
                  {qScore}/{QUIZ_SCENARIOS.length}
                </div>
                <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginBottom: 16 }}>
                  {qScore >= 7 ? 'Отлично! Вы хорошо знаете Smart Money Concepts.' : qScore >= 5 ? 'Хорошо! Повторите слабые места.' : 'Нужна практика. Изучите концепции SMC.'}
                </div>
                {/* Review mistakes */}
                {qHistory.filter(h => !h.correct).length > 0 && (
                  <div style={{ textAlign: 'left', marginBottom: 14 }}>
                    <div style={{ fontSize: '.6rem', color: 'var(--muted)', marginBottom: 8 }}>ОШИБКИ:</div>
                    {qHistory.map((h, i) => !h.correct ? (
                      <div key={i} style={{ marginBottom: 8, padding: '7px 10px', background: 'rgba(255,61,87,0.08)', borderRadius: 3 }}>
                        <div style={{ fontSize: '.62rem', color: 'var(--text)', marginBottom: 3 }}>{QUIZ_SCENARIOS[i].q.slice(0, 70)}...</div>
                        <div style={{ fontSize: '.6rem', color: 'var(--muted)' }}>
                          Ваш ответ: <span style={{ color: 'var(--short)' }}>{QUIZ_SCENARIOS[i].opts[h.chosen]}</span>
                          {' · '}Правильно: <span style={{ color: 'var(--long)' }}>{QUIZ_SCENARIOS[i].opts[QUIZ_SCENARIOS[i].ans]}</span>
                        </div>
                      </div>
                    ) : null)}
                  </div>
                )}
                <button
                  onClick={restartQuiz}
                  style={{ padding: '8px 24px', background: 'var(--cyan)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '.65rem', fontWeight: 700, color: '#000' }}
                >
                  Пройти снова
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
