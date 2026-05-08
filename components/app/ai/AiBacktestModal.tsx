'use client'
import { useLang } from '@/contexts/LangContext'

interface BacktestStats {
  total_obs: number; bull_obs: number; bear_obs: number
  hit_rate: number; hit_count: number; bounce_rate: number; avg_rr: number | null
}
interface BacktestByQ { quality: string; total: number; hit_rate: number; bounce_rate: number }
interface BacktestData {
  stats: BacktestStats
  by_quality: BacktestByQ[]
  verify_candles: number
}

interface Props {
  open: boolean
  loading: boolean
  data: Record<string, unknown> | null
  pair: string
  tf: string
  onClose: () => void
  onRerun: () => void
}

export default function AiBacktestModal({ open, loading, data, pair, tf, onClose, onRerun }: Props) {
  const { t } = useLang()

  if (!open) return null

  const bd = data as BacktestData | null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--line2)', borderRadius: 8, width: '100%', maxWidth: 480, maxHeight: '80vh', overflow: 'auto', padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: '.75rem', fontWeight: 700 }}>{t('backtest_title_lbl')}</div>
            <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginTop: 2 }}>{pair} · {tf.toUpperCase()} · {t('backtest_last_candles_lbl')}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div className="ld-bar" style={{ width: 160, margin: '0 auto 10px' }} />
            <div style={{ fontSize: '.6rem', color: 'var(--muted)' }}>{t('backtest_analyzing_lbl')}</div>
          </div>
        )}

        {!loading && bd && (() => {
          const st = bd.stats
          return (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
                {([
                  { label: t('backtest_total_obs_lbl'), value: String(st.total_obs),  sub: `${st.bull_obs} Bull / ${st.bear_obs} Bear`, color: undefined },
                  { label: 'Hit Rate',                  value: `${st.hit_rate}%`,     sub: `${st.hit_count}/${st.total_obs}`,             color: st.hit_rate    >= 60 ? 'var(--long)' : 'var(--wait)' },
                  { label: 'Bounce Rate',               value: `${st.bounce_rate}%`,  sub: t('backtest_bounce_sub_lbl'),                  color: st.bounce_rate >= 55 ? 'var(--long)' : st.bounce_rate >= 40 ? 'var(--wait)' : 'var(--short)' },
                  { label: 'Avg R:R',                   value: st.avg_rr != null ? `${st.avg_rr}:1` : '—', sub: t('backtest_avg_rr_sub_lbl'), color: (st.avg_rr ?? 0) >= 1.5 ? 'var(--long)' : 'var(--wait)' },
                ] as { label: string; value: string; sub: string; color?: string }[]).map(({ label, value, sub, color }) => (
                  <div key={label} style={{ background: 'var(--bg3)', borderRadius: 5, padding: '8px 10px' }}>
                    <div style={{ fontSize: '.55rem', color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: '.85rem', fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
                    <div style={{ fontSize: '.52rem', color: 'var(--dim)', marginTop: 2 }}>{sub}</div>
                  </div>
                ))}
              </div>

              {bd.by_quality?.length > 0 && (
                <>
                  <div style={{ fontSize: '.58rem', color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('backtest_by_quality_lbl')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                    {bd.by_quality.map(q => (
                      <div key={q.quality} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'var(--bg3)', borderRadius: 4 }}>
                        <span style={{ width: 24, fontSize: '.65rem', fontWeight: 700, color: q.quality === 'A+' ? 'var(--long)' : q.quality === 'A' ? 'var(--cyan)' : 'var(--muted)' }}>{q.quality}</span>
                        <span style={{ fontSize: '.58rem', color: 'var(--muted)', width: 44 }}>{q.total} OB</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '.52rem', color: 'var(--dim)', marginBottom: 2 }}>Hit {q.hit_rate}% → Bounce {q.bounce_rate}%</div>
                          <div style={{ height: 4, background: 'var(--bg2)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: 4, borderRadius: 2, width: `${q.bounce_rate}%`, background: 'var(--long)' }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{ fontSize: '.55rem', color: 'var(--dim)', lineHeight: 1.6, borderTop: '1px solid var(--line2)', paddingTop: 8 }}>
                📌 Hit Rate — % OB zones price reached in the next {bd.verify_candles} candles. Bounce Rate — % bounces from zone.
              </div>
            </>
          )
        })()}

        {!loading && !bd && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--dim)', fontSize: '.63rem' }}>{t('no_data')}</div>
        )}

        <button
          onClick={onRerun}
          disabled={loading}
          style={{ width: '100%', marginTop: 12, padding: '8px 0', borderRadius: 4, border: '1px solid var(--line2)', background: 'var(--bg3)', color: 'var(--text)', cursor: 'pointer', fontSize: '.65rem' }}
        >
          {loading ? t('backtest_loading_lbl') : t('backtest_refresh_lbl')}
        </button>
      </div>
    </div>
  )
}
