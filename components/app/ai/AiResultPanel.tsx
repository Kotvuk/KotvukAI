'use client'
import { useLang } from '@/contexts/LangContext'
import type { ProbabilityResult } from '@/lib/smc'
import SMCTooltip from '@/components/ui/SMCTooltip'

const SMC_TERMS = ['CHoCH', 'BOS', 'FVG', 'OTE', 'BSL', 'SSL', 'HTF', 'OB', 'BB'] as const
type SMCTerm = typeof SMC_TERMS[number]

function smcWrap(text: string) {
  const pattern = new RegExp(`\\b(${SMC_TERMS.join('|')})\\b`, 'g')
  const parts = text.split(pattern)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    (SMC_TERMS as readonly string[]).includes(part)
      ? <SMCTooltip key={i} term={part as SMCTerm}>{part}</SMCTooltip>
      : part
  )
}

function vc(v: string | null) {
  if (!v) return 'wait'
  const u = v.toUpperCase()
  return u === 'LONG' ? 'long' : u === 'SHORT' ? 'short' : 'wait'
}

interface Props {
  aiData: Record<string, unknown>
  pair: string
  tf: string
  smcProb: ProbabilityResult | null
  onNavigate?: (panel: 'dash' | 'ai' | 'trades' | 'news' | 'notifs' | 'history' | 'settings') => void
  onShowHistorical?: () => void
}

export default function AiResultPanel({ aiData, pair, tf, smcProb, onNavigate, onShowHistorical }: Props) {
  const { t } = useLang()

  const a = aiData.analysis as Record<string, unknown>
  const m = aiData.market  as Record<string, unknown>
  const p = aiData.pipeline as Record<string, unknown>
  const elap = aiData.elapsed as number | undefined

  const V  = vc(String(a.verdict))
  const rc = Number(a.risk_score) >= 7 ? 'var(--short)' : Number(a.risk_score) >= 4 ? 'var(--wait)' : 'var(--long)'

  return (
    <>
      {/* Verdict */}
      <div className={`verdict ${V}`} style={{ marginTop: 10 }}>
        <div className={`vsig ${V}`}>{String(a.verdict)}</div>
        <div className="vmeta">
          <div className="vpair">{pair} · {tf.toUpperCase()}</div>
          <div className="vprice">${Number(m.price || 0).toLocaleString()}</div>
          <div className="velap">{elap}s · Groq</div>
        </div>
        <div className="vstats">
          <div className="vst">
            <div className="vst-l">{t('confidence')}</div>
            <div className="vst-v">{String(a.confidence)}%</div>
            <div className="vbar"><div className="vbar-f" style={{ width: `${a.confidence}%` }} /></div>
          </div>
          <div className="vst">
            <div className="vst-l">{t('leverage')}</div>
            <div className="vst-v">{String(a.leverage)}×</div>
          </div>
          <div className="vst">
            <div className="vst-l">{t('risk')}</div>
            <div className="vst-v" style={{ color: rc }}>{String(a.risk_score)}/10</div>
          </div>
          <div className="vst">
            <div className="vst-l">{t('entry')}</div>
            <div className="vst-v" style={{ fontSize: '.75rem' }}>{a.entry_type === 'market' ? 'MKT' : 'LMT'}</div>
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="pipe">
        {[
          { key: 'step1', label: t('step1_technical'), sig: (p.step1 as Record<string,unknown>)?.signal,  val: `${(p.step1 as Record<string,unknown>)?.strength}/10`, sum: (p.step1 as Record<string,unknown>)?.summary },
          { key: 'step2', label: t('step2_risk'),      sig: (p.step2 as Record<string,unknown>)?.verdict, val: `${(p.step2 as Record<string,unknown>)?.confidence}%`,  sum: (p.step2 as Record<string,unknown>)?.summary },
          { key: 'step3', label: t('step3_final'),     sig: (p.step3 as Record<string,unknown>)?.verdict, val: `${(p.step3 as Record<string,unknown>)?.confidence}%`,  sum: t('smc_confluence_lbl') },
        ].map(st => (
          <div className="pc" key={st.key}>
            <div className="pn">{st.label}</div>
            <div className={`ps ${vc(String(st.sig))}`}>
              {String(st.sig || '—')} <span style={{ fontSize: '.58rem', color: 'var(--dim)' }}>{String(st.val)}</span>
            </div>
            <div className="psum">{String(st.sum || '').slice(0, 90)}{String(st.sum || '').length > 90 ? '…' : ''}</div>
          </div>
        ))}
      </div>

      {/* Multi-method analysis */}
      {Array.isArray(aiData.methods) && (aiData.methods as unknown[]).length > 0 && (() => {
        type MR = { method: string; signal: string; confidence: number; summary: string }
        type CR = { long: number; short: number; wait: number; decision: string; agreeing: string[]; threshold: number }
        const methods = aiData.methods as MR[]
        const cs = aiData.consensus as CR | undefined
        return (
          <div className="tbox" style={{ marginBottom: 10 }}>
            <div className="thead">
              <span className="thead-t">{t('methods_title_lbl')}</span>
              {cs && (
                <span style={{
                  fontSize: '.6rem', fontWeight: 700,
                  color: cs.decision === 'LONG' ? 'var(--long)' : cs.decision === 'SHORT' ? 'var(--short)' : 'var(--wait)',
                }}>
                  {cs.long}L · {cs.short}S · {cs.wait}W → {cs.decision}
                </span>
              )}
            </div>
            <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {methods.map(m => {
                const sc = m.signal === 'LONG' ? 'var(--long)' : m.signal === 'SHORT' ? 'var(--short)' : 'var(--wait)'
                return (
                  <div key={m.method} style={{ display: 'flex', alignItems: 'center', gap: 7 }} title={m.summary}>
                    <span style={{ width: 88, fontSize: '.6rem', color: 'var(--muted)', flexShrink: 0 }}>{m.method}</span>
                    <span style={{ width: 40, fontSize: '.58rem', fontWeight: 700, color: sc, flexShrink: 0 }}>{m.signal}</span>
                    <div style={{ flex: 1, height: 3, background: 'var(--bg3)', borderRadius: 2 }}>
                      <div style={{ height: 3, borderRadius: 2, background: sc, width: `${m.confidence}%`, transition: 'width .3s' }} />
                    </div>
                    <span style={{ fontSize: '.6rem', color: 'var(--text)', width: 28, textAlign: 'right' }}>{m.confidence}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Levels */}
      <div className="levels">
        <div className="lv"><div className="lv-l">{t('entry')}</div><div className="lv-v lv-entry">${Number(a.entry_price || 0).toLocaleString()}</div><div className="lv-p">{a.entry_type === 'market' ? 'market' : 'limit'}</div></div>
        <div className="lv"><div className="lv-l">{t('take_profit')}</div><div className="lv-v lv-tp">${Number(a.tp_price || 0).toLocaleString()}</div><div className="lv-p">+{String(a.tp_pct || '—')}%</div></div>
        <div className="lv"><div className="lv-l">{t('stop_loss')}</div><div className="lv-v lv-sl">${Number(a.sl_price || 0).toLocaleString()}</div><div className="lv-p">-{String(a.sl_pct || '—')}%</div></div>
      </div>

      {/* Risk management */}
      {aiData.risk_management && (() => {
        const rm = aiData.risk_management as Record<string, unknown>
        return (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)' }}>
            {[
              { l: t('rm_balance_lbl'),  v: `$${Number(rm.balance  || 0).toLocaleString()}`,           c: 'var(--text)' },
              { l: t('rm_risk_lbl'),     v: `$${Number(rm.risk_usd || 0).toFixed(2)}`,                 c: '#ff6b6b' },
              { l: t('rm_position_lbl'), v: `$${Number(rm.pos_usd  || 0).toLocaleString()}`,           c: 'var(--text)' },
              { l: 'R:R',                v: rm.rr     ? `1:${Number(rm.rr    ).toFixed(1)}` : '—',    c: '#00e676' },
              { l: t('rm_min_rr_lbl'),   v: rm.min_rr ? `1:${Number(rm.min_rr).toFixed(1)}` : '—',    c: 'var(--dim)' },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ flex: '1 1 60px', textAlign: 'center' }}>
                <div style={{ fontSize: '.52rem', color: 'var(--dim)', marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: '.68rem', fontWeight: 700, color: c }}>{v}</div>
              </div>
            ))}
          </div>
        )
      })()}

      {/* OB Quality Card */}
      {a.ob_used && (() => {
        const ob = a.ob_used as Record<string, unknown>
        const score = Number(ob.score ?? 0)
        const isBull = (ob.type as string) === 'bullish'
        const scoreColor = score >= 80 ? '#00e676' : score >= 60 ? '#ffd60a' : score >= 40 ? '#ff9800' : '#ff4444'
        const qualColor  = ob.quality === 'A+' ? '#00e676' : ob.quality === 'A' ? '#69f0ae' : ob.quality === 'B' ? '#ffd60a' : '#888'
        return (
          <div style={{ margin: '8px 0', padding: '9px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: `1px solid ${scoreColor}30` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '.56rem', color: 'var(--dim)', fontWeight: 700, letterSpacing: '.06em' }}>
                {isBull ? '↑ BULLISH' : '↓ BEARISH'} <SMCTooltip term="OB">ORDER BLOCK</SMCTooltip> — {t('ob_entry_zone_lbl')}
              </span>
              <span style={{ fontSize: '.64rem', fontWeight: 700, color: scoreColor }}>{score}/100 — {String(ob.verdict ?? '')}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: '.62rem', fontWeight: 800, color: qualColor, background: `${qualColor}18`, padding: '2px 7px', borderRadius: 4 }}>{String(ob.quality ?? '?')}</span>
              <span style={{ fontSize: '.62rem', color: 'var(--text)' }}>${Number(ob.low ?? 0).toLocaleString()} — ${Number(ob.high ?? 0).toLocaleString()}</span>
              {Boolean(ob.isFresh) && <span style={{ fontSize: '.6rem', color: '#00e676', background: 'rgba(0,230,118,0.12)', padding: '2px 6px', borderRadius: 4 }}>{t('ob_fresh_lbl')}</span>}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '.58rem', color: 'var(--dim)' }}>{t('ob_volume_lbl')} <b style={{ color: 'var(--text)' }}>{Number(ob.relVolume ?? 0).toFixed(1)}×</b></span>
              <span style={{ fontSize: '.58rem', color: 'var(--dim)' }}>{t('ob_impulse_lbl')} <b style={{ color: 'var(--text)' }}>{Number(ob.impulseSize ?? 0).toFixed(1)}%</b></span>
              <span style={{ fontSize: '.58rem', color: 'var(--dim)' }}>{t('ob_age_lbl')} <b style={{ color: 'var(--text)' }}>{Number(ob.ageCandles ?? 0)}</b></span>
              <span style={{ fontSize: '.58rem', color: 'var(--dim)' }}>{t('ob_touches_lbl')} <b style={{ color: 'var(--text)' }}>{Number(ob.touchCount ?? 0)}</b></span>
            </div>
          </div>
        )
      })()}

      {/* Open position button */}
      {(String(a.verdict) === 'LONG' || String(a.verdict) === 'SHORT') && onNavigate && (
        <button
          onClick={() => {
            localStorage.setItem('kotvuk:trade_prefill', JSON.stringify({
              pair, direction: String(a.verdict).toLowerCase(),
              entry_price: Number(a.entry_price), tp_price: Number(a.tp_price),
              sl_price: Number(a.sl_price), leverage: Number(a.leverage),
              order_type: String(a.entry_type) === 'limit' ? 'limit' : 'market',
            }))
            onNavigate('trades')
          }}
          style={{
            width: '100%', marginTop: 8, marginBottom: 4, padding: '9px 0', borderRadius: 4, border: 'none', cursor: 'pointer',
            fontSize: '.72rem', fontWeight: 700, letterSpacing: '.04em',
            background: String(a.verdict) === 'LONG' ? 'rgba(0,230,118,0.15)' : 'rgba(255,61,87,0.15)',
            color: String(a.verdict) === 'LONG' ? 'var(--long)' : 'var(--short)',
            borderTop: `1px solid ${String(a.verdict) === 'LONG' ? 'var(--long)' : 'var(--short)'}`,
          }}
        >
          {t('open_position_lbl')} {String(a.verdict)} →
        </button>
      )}

      {/* WAIT block */}
      {String(a.verdict) === 'WAIT' && a.wait_for && (
        <div style={{ margin: '10px 0', padding: '12px 14px', background: 'rgba(255,165,0,0.08)', borderRadius: 6, border: '1px solid rgba(255,165,0,0.25)' }}>
          <div style={{ fontSize: '.6rem', color: '#ffa500', fontWeight: 700, marginBottom: 4 }}>{t('wait_signal_lbl')}</div>
          <div style={{ fontSize: '.65rem', color: 'var(--text)', lineHeight: 1.6 }}>{String(a.wait_for)}</div>
        </div>
      )}

      <div className="desc">{smcWrap(String(a.full_description || '—'))}</div>

      {/* Instructions */}
      <div className="instr"><span className="ik" style={{ background: '#f0a500' }}>{t('entry_badge_lbl')}</span><span>{String(a.entry_instruction || '—')}</span></div>
      {a.entry_type === 'limit' && a.entry_limit && (
        <div className="instr" style={{ background: 'rgba(240,165,0,0.08)', borderLeft: '2px solid #f0a500' }}>
          <span className="ik" style={{ background: '#f0a500' }}>{t('limit_badge_lbl')}</span>
          <span>{t('limit_order_at')} <b>${Number(a.entry_limit).toLocaleString()}</b></span>
        </div>
      )}
      {a.confluence && (
        <div className="instr" style={{ background: 'rgba(0,230,118,0.06)', borderLeft: '2px solid #00e676' }}>
          <span className="ik" style={{ background: '#00e676', color: '#000' }}>{t('confluence_badge_lbl')}</span>
          <span>{smcWrap(String(a.confluence))}</span>
        </div>
      )}
      {a.invalidation && (
        <div className="instr" style={{ background: 'rgba(255,61,87,0.06)', borderLeft: '2px solid #ff3d57' }}>
          <span className="ik" style={{ background: '#ff3d57' }}>{t('invalidation_badge_lbl')}</span>
          <span>{smcWrap(String(a.invalidation))}</span>
        </div>
      )}
      {a.position_size && (
        <div className="instr" style={{ background: 'rgba(100,180,255,0.06)', borderLeft: '2px solid #64b4ff' }}>
          <span className="ik" style={{ background: '#64b4ff', color: '#000' }}>{t('volume_badge_lbl')}</span>
          <span>{String(a.position_size)}</span>
        </div>
      )}
      <div className="instr" style={{ marginBottom: 10 }}>
        <span className="ik" style={{ background: '#ff3d57' }}>{t('exit_badge_lbl')}</span>
        <span>{String(a.exit_instruction || '—')}</span>
      </div>

      {/* Insights */}
      <div className="sec">{t('insights')}</div>
      <div className="ins-grid">
        {((a.insights as { icon: string; tag: string; text: string }[]) || []).map((ins, i) => (
          <div className="ins" key={i}>
            <div className="ins-top"><span className="ins-icon">{ins.icon}</span><span className="ins-tag">{ins.tag}</span></div>
            <div className="ins-txt">{smcWrap(ins.text)}</div>
          </div>
        ))}
      </div>

      {/* Why signal */}
      <div className="tbox" style={{ marginBottom: 10 }}>
        <div className="thead"><span className="thead-t">{t('why_signal')}</span></div>
        <div style={{ padding: '9px 12px', fontSize: '.67rem', color: 'var(--muted)', lineHeight: 1.65 }}>
          {smcWrap(String(a.why_this_signal || '—'))}
        </div>
      </div>

      {/* SMC Probability */}
      {smcProb && (
        <div className="tbox" style={{ marginBottom: 20 }}>
          <div className="thead">
            <span className="thead-t">{t('smc_prob_title_lbl')}</span>
            <span style={{
              fontSize: '.58rem', padding: '2px 7px', borderRadius: 3, marginLeft: 8,
              background: smcProb.scenario === 'LONG' ? 'rgba(0,230,118,0.15)' : smcProb.scenario === 'SHORT' ? 'rgba(255,61,87,0.15)' : 'rgba(136,136,136,0.15)',
              color: smcProb.scenario === 'LONG' ? 'var(--long)' : smcProb.scenario === 'SHORT' ? 'var(--short)' : 'var(--muted)',
            }}>{smcProb.scenario} · {smcProb.probability}%</span>
          </div>
          <div style={{ padding: '10px 12px' }}>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '.6rem', color: 'var(--muted)' }}>{t('probability_lbl')}</span>
                <span style={{ fontSize: '.6rem', color: 'var(--text)', fontWeight: 600 }}>{smcProb.probability}%</span>
              </div>
              <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3 }}>
                <div style={{
                  height: 5, borderRadius: 3, transition: 'width .4s', width: `${smcProb.probability}%`,
                  background: smcProb.probability >= 70 ? 'var(--long)' : smcProb.probability >= 50 ? 'var(--wait)' : 'var(--short)',
                }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              {[
                { l: 'R:R',         v: `${smcProb.riskReward}:1` },
                { l: 'Expected R',  v: `${smcProb.expectedR > 0 ? '+' : ''}${smcProb.expectedR}R` },
                { l: t('confidence'), v: `${smcProb.confidence}%` },
              ].map(({ l, v }) => (
                <div key={l} style={{ flex: 1, background: 'var(--bg3)', borderRadius: 3, padding: '5px 7px' }}>
                  <div style={{ fontSize: '.55rem', color: 'var(--muted)', marginBottom: 2 }}>{l}</div>
                  <div style={{ fontSize: '.65rem', fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase' }}>{t('factors_lbl')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              {[
                { name: t('htf_structure_lbl'),     val: smcProb.factors.htfStructure,     max: 25 },
                { name: t('confluence_zones_lbl'),   val: smcProb.factors.confluenceZones,  max: 20 },
                { name: t('volume_profile_lbl'),     val: smcProb.factors.volumeProfile,    max: 15 },
                { name: t('temporal_context_lbl'),   val: smcProb.factors.temporalContext,  max: 15 },
                { name: t('historical_stats_lbl'),   val: smcProb.factors.historicalStats,  max: 20 },
                { name: t('market_sentiment_lbl'),   val: smcProb.factors.marketSentiment,  max: 5  },
              ].map(({ name, val, max }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 105, fontSize: '.58rem', color: 'var(--muted)', flexShrink: 0 }}>{name}</span>
                  <div style={{ flex: 1, height: 3, background: 'var(--bg3)', borderRadius: 2 }}>
                    <div style={{ height: 3, borderRadius: 2, width: `${(val / max) * 100}%`, background: 'var(--cyan)', transition: 'width .3s' }} />
                  </div>
                  <span style={{ fontSize: '.6rem', color: 'var(--text)', width: 28, textAlign: 'right' }}>{val}/{max}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '.63rem', color: 'var(--muted)', lineHeight: 1.5, borderTop: '1px solid var(--line2)', paddingTop: 8 }}>
              {smcProb.recommendation}
            </div>
            {smcProb.alerts.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {smcProb.alerts.map((alert, i) => {
                  const alertBg     = alert.color === 'green' ? 'rgba(0,230,118,0.1)' : alert.color === 'red' ? 'rgba(255,61,87,0.1)' : alert.color === 'orange' ? 'rgba(255,165,0,0.1)' : 'rgba(255,220,0,0.1)'
                  const alertBorder = alert.color === 'green' ? '#00e676' : alert.color === 'red' ? '#ff3d57' : alert.color === 'orange' ? '#ffa500' : '#ffdd00'
                  const stageName   = alert.level === 'watchlist' ? t('stage_watchlist_lbl') : alert.level === 'setup_ready' ? t('stage_ready_lbl') : t('stage_trigger_lbl')
                  return (
                    <div key={i} style={{ background: alertBg, border: `1px solid ${alertBorder}40`, borderLeft: `3px solid ${alertBorder}`, borderRadius: 3, padding: '6px 9px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: '.55rem', color: alertBorder, fontWeight: 700, textTransform: 'uppercase' }}>СТАДИЯ {alert.stage} · {stageName}</span>
                        <span style={{ fontSize: '.55rem', color: 'var(--muted)' }}>{alert.confidence}%</span>
                      </div>
                      <div style={{ fontSize: '.6rem', color: 'var(--text)', lineHeight: 1.4 }}>{alert.message}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Historical setups button */}
      {onShowHistorical && (
        <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={onShowHistorical}
            style={{ padding: '7px 18px', background: 'var(--bg3)', border: '1px solid var(--line2)', borderRadius: 4, cursor: 'pointer', fontSize: '.63rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            {t('similar_setups_lbl')}
          </button>
        </div>
      )}
    </>
  )
}
