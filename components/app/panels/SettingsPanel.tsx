'use client'
import { useEffect, useState } from 'react'
import { updatePassword } from 'firebase/auth'
import { useLang } from '@/contexts/LangContext'
import { useAuth } from '@/contexts/AuthContext'
import { showToast } from '@/components/ui/Toast'

const TIER_LABELS: Record<string, { name: string; color: string; analyses: number }> = {
  free:    { name: 'Free',    color: '#888',    analyses: 3   },
  starter: { name: 'Starter', color: '#0a84ff', analyses: 10  },
  pro:     { name: 'Pro',     color: '#30d158', analyses: 30  },
  elite:   { name: 'Elite',   color: '#ffd60a', analyses: 100 },
}

interface SubInfo { tier: string; analyses_today: number; remaining: number; limit: number }

export default function SettingsPanel() {
  const { t, lang, setLang } = useLang()
  const { user } = useAuth()
  const [nickname, setNickname] = useState('')
  const [email, setEmail]       = useState('')
  const [pass, setPass]         = useState('')
  const [pass2, setPass2]       = useState('')
  const [sub, setSub]           = useState<SubInfo | null>(null)
  const [exporting, setExporting]     = useState(false)
  const [purchasing, setPurchasing]   = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [aiBalance, setAiBalance]       = useState(1000)
  const [aiTradeAmount, setAiTradeAmount] = useState(100)
  const [aiLeverage, setAiLeverage] = useState(20)
  const [tgChatId, setTgChatId]     = useState('')
  const [tgSaving, setTgSaving]     = useState(false)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.ok && d.settings) {
        if (d.settings.nickname)                   setNickname(d.settings.nickname)
        if (d.settings.email)                      setEmail(d.settings.email)
        if (d.settings.ai_balance != null)         setAiBalance(d.settings.ai_balance)
        if (d.settings.ai_trade_amount != null) setAiTradeAmount(d.settings.ai_trade_amount)
        if (d.settings.ai_max_leverage != null)    setAiLeverage(d.settings.ai_max_leverage)
        if (d.settings.telegram_chat_id)           setTgChatId(d.settings.telegram_chat_id)
      }
    }).catch(() => {})
    if (user?.email) setEmail(user.email)
    if (user?.displayName) setNickname(user.displayName)

    fetch('/api/subscription').then(r => r.json()).then(d => {
      if (d.ok) setSub({ tier: d.subscription.tier, analyses_today: d.analyses_today, remaining: d.remaining, limit: d.limit })
    }).catch(() => {})
  }, [user])

  async function save() {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast(t('invalid_email'), 'err'); return }
    if (pass && pass !== pass2) { showToast(t('passwords_no_match'), 'err'); return }
    try {
      const r = await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, email, lang, ai_trade_amount: aiTradeAmount, ai_max_leverage: aiLeverage, telegram_chat_id: tgChatId }),
      })
      const d = await r.json()
      if (!d.ok) { showToast(d.error || t('error'), 'err'); return }
      if (pass && user) {
        try {
          await updatePassword(user, pass)
          setPass(''); setPass2('')
        } catch (e: unknown) {
          showToast(e instanceof Error ? e.message.replace('Firebase: ', '').replace(/\(auth.*\)/, '') : t('error'), 'err')
          return
        }
      }
      showToast(t('settings_saved'))
    } catch { showToast(t('error'), 'err') }
  }

  async function subscribe(tier: string) {
    setPurchasing(tier)
    try {
      const r = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const d = await r.json()
      if (d.ok && d.url) window.location.href = d.url
      else showToast(d.error || t('payment_error'), 'err')
    } catch { showToast(t('conn_error'), 'err') }
    setPurchasing(null)
  }

  async function openPortal() {
    setPortalLoading(true)
    try {
      const r = await fetch('/api/billing/portal', { method: 'POST' })
      const d = await r.json()
      if (d.ok && d.url) window.location.href = d.url
      else showToast(d.error || t('no_active_sub'), 'err')
    } catch { showToast(t('conn_error'), 'err') }
    setPortalLoading(false)
  }

  async function exportCSV(type: 'trades' | 'signals') {
    setExporting(true)
    try {
      const url = type === 'trades' ? '/api/trades' : '/api/signals?limit=1000'
      const r = await fetch(url)
      const d = await r.json()
      const rows = type === 'trades' ? d.trades : d.signals
      if (!rows?.length) { showToast(t('no_export_data'), 'err'); return }

      let csv = ''
      if (type === 'trades') {
        csv = t('csv_trades_header') + '\n'
        csv += rows.map((row: Record<string, unknown>) =>
          [row.id, row.pair, row.direction, row.order_type, row.amount,
           row.entry_price ?? '', row.tp_price ?? '', row.sl_price ?? '',
           row.leverage, row.status, row.pnl ?? '', row.pnl_pct ?? '',
           new Date(row.created_at as string).toLocaleDateString(lang)].join(',')
        ).join('\n')
      } else {
        csv = t('csv_signals_header') + '\n'
        csv += rows.map((s: Record<string, unknown>) =>
          [s.id, s.pair, s.timeframe, s.final_verdict, s.final_confidence,
           s.final_entry ?? '', s.final_tp ?? '', s.final_sl ?? '',
           s.final_leverage ?? '', s.outcome ?? '', s.actual_pnl_pct ?? '',
           new Date(s.created_at as string).toLocaleDateString(lang)].join(',')
        ).join('\n')
      }

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `kotvukai_${type}_${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      showToast(`${rows.length} ${t('export_count_lbl')}`)
    } catch { showToast(t('export_error'), 'err') }
    setExporting(false)
  }

  const tierInfo = TIER_LABELS[sub?.tier || 'free']
  const usagePct = sub ? Math.min(100, (sub.analyses_today / sub.limit) * 100) : 0

  return (
    <div className="panel active" id="panel-settings">
      <div style={{ maxWidth: 500, margin: '0 auto' }}>

        <div className="sb2">
          <div className="st">{t('subscription_title')}</div>

          {sub && (
            <div className="sub-bar" style={{ marginBottom: 16 }}>
              <div className="sub-bar-info">
                <div className="sub-bar-tier" style={{ color: tierInfo.color }}>
                  {tierInfo.name} Plan
                </div>
                <div className="sub-bar-usage">
                  {sub.analyses_today} / {sub.limit} {t('analyses_today_lbl')}
                  &nbsp;·&nbsp; {t('remaining_lbl')} <span style={{ color: tierInfo.color }}>{sub.remaining}</span>
                </div>
                <div className="sub-bar-progress" style={{ marginTop: 8 }}>
                  <div className="sub-bar-fill" style={{ width: `${usagePct}%`, background: tierInfo.color }} />
                </div>
              </div>
              <span className={`tag tag-${sub.tier}`} style={{ fontSize: '.58rem', fontWeight: 700, padding: '3px 10px' }}>
                {tierInfo.name.toUpperCase()}
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            {([
              { tier: 'starter', price: '$9', analyses: 10,  color: '#0a84ff', features: [`10 ${t('analyses_today_lbl')}`, 'SMC signals', t('nav_history')] },
              { tier: 'pro',     price: '$29', analyses: 30, color: '#30d158', features: [`30 ${t('analyses_today_lbl')}`, t('priority'), 'CSV Export'] },
              { tier: 'elite',   price: '$79', analyses: 100, color: '#ffd60a', features: [`100 ${t('analyses_today_lbl')}`, t('unlimited'), 'VIP Support'] },
            ] as const).map(({ tier, price, color, features }) => {
              const isCurrent = sub?.tier === tier
              const isLoading = purchasing === tier
              return (
                <div key={tier} style={{
                  background: isCurrent ? color + '11' : 'var(--bg2)',
                  border: `1px solid ${isCurrent ? color : 'var(--border)'}`,
                  borderRadius: 8, padding: '12px 10px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '.65rem', fontWeight: 700, color, textTransform: 'uppercase', marginBottom: 4 }}>
                    {tier}
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>
                    {price}<span style={{ fontSize: '.55rem', color: 'var(--dim)', fontWeight: 400 }}>{t('per_month')}</span>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    {features.map(f => (
                      <div key={f} style={{ fontSize: '.55rem', color: 'var(--dim)', marginBottom: 2 }}>✓ {f}</div>
                    ))}
                  </div>
                  {isCurrent ? (
                    <div style={{ fontSize: '.58rem', color, fontWeight: 600, padding: '4px 0' }}>{t('plan_active_lbl')}</div>
                  ) : (
                    <button
                      onClick={() => subscribe(tier)}
                      disabled={!!purchasing}
                      style={{
                        width: '100%', background: color, color: '#000',
                        border: 'none', borderRadius: 5, padding: '5px 0',
                        fontSize: '.6rem', fontWeight: 700, cursor: 'pointer',
                        opacity: purchasing ? 0.6 : 1,
                      }}
                    >
                      {isLoading ? '...' : t('subscribe_btn')}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {sub && sub.tier !== 'free' && (
            <button
              onClick={openPortal}
              disabled={portalLoading}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--dim)', padding: '6px 14px', borderRadius: 6,
                fontSize: '.6rem', cursor: 'pointer', width: '100%',
              }}
            >
              {portalLoading ? t('sub_loading') : t('manage_sub_btn')}
            </button>
          )}
        </div>

        <div className="sb2">
          <div className="st">{t('ai_trading_title')}</div>
          <p style={{ fontSize: '.6rem', color: 'var(--dim)', marginBottom: 10 }}>
            {t('ai_trading_desc')}
          </p>
          <div className="fg">
            <div className="ff full">
              <div className="rw">
                <div className="rt">
                  <label className="fl">{t('deposit_balance_label')}</label>
                  <span className="rv">${aiBalance.toLocaleString()}</span>
                </div>
                <input type="range" min={10} max={100000} step={10}
                  value={Math.min(aiBalance, 100000)}
                  onChange={e => setAiBalance(parseInt(e.target.value))} />
                <div className="rm"><span>$10</span><span>$100k+</span></div>
                <input
                  type="number" min={10} max={10000000} step={10}
                  value={aiBalance}
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v >= 10 && v <= 10000000) setAiBalance(v)
                  }}
                  style={{ marginTop: 4, width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '4px 8px', fontSize: '.65rem' }}
                />
              </div>
            </div>
            <div className="ff full">
              <div className="rw">
                <div className="rt">
                  <label className="fl">Сумма сделки ($)</label>
                  <span className="rv">${aiTradeAmount.toLocaleString()}</span>
                </div>
                <input
                  type="number" min={1} max={1000000} step={1}
                  value={aiTradeAmount}
                  onChange={e => {
                    const v = parseInt(e.target.value)
                    if (!isNaN(v) && v >= 1) setAiTradeAmount(v)
                  }}
                  style={{ marginTop: 4, width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', padding: '4px 8px', fontSize: '.65rem' }}
                />
                <div style={{ fontSize: '.58rem', color: 'var(--dim)', marginTop: 4 }}>
                  AI откроет сделку на эту сумму · маржа ≈ ${Math.ceil(aiTradeAmount / Math.max(aiLeverage, 1)).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="ff full">
              <div className="rw">
                <div className="rt">
                  <label className="fl">{t('max_ai_leverage_label')}</label>
                  <span className="rv">{aiLeverage}×</span>
                </div>
                <input type="range" min={1} max={125} step={1} value={aiLeverage}
                  onChange={e => setAiLeverage(parseInt(e.target.value))} />
                <div className="rm"><span>1×</span><span>125×</span></div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: '.58rem', color: 'var(--dim)', marginTop: 6 }}>
            {t('paper_trading_note')}
          </p>
        </div>

        <div className="sb2">
          <div className="st">{t('profile')}</div>
          <div className="fg">
            <div className="ff full"><label className="fl">{t('nickname')}</label>
              <input type="text" className="fi" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="username" /></div>
            <div className="ff full"><label className="fl">{t('email')}</label>
              <input type="email" className="fi" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" /></div>
          </div>
        </div>

        <div className="sb2">
          <div className="st">{t('security')}</div>
          <div className="fg">
            <div className="ff full"><label className="fl">{t('new_password')}</label>
              <input type="password" className="fi" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" /></div>
            <div className="ff full"><label className="fl">{t('confirm_password')}</label>
              <input type="password" className="fi" value={pass2} onChange={e => setPass2(e.target.value)} placeholder="••••••••" /></div>
          </div>
        </div>

        <div className="sb2">
          <div className="st">{t('language')}</div>
          <div className="tg" style={{ maxWidth: 200 }}>
            {(['ru', 'en', 'kz'] as const).map(l => (
              <button key={l} className={`tb ${lang === l ? 'a-d' : ''}`} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <p style={{ fontSize: '.6rem', color: 'var(--dim)', marginTop: 8 }}>
            {lang === 'ru' ? 'Русский' : lang === 'en' ? 'English' : 'Қазақша'}
          </p>
        </div>

        <div className="sb2">
          <div className="st">{t('tg_section_title')}</div>
          <p style={{ fontSize: '.6rem', color: 'var(--dim)', marginBottom: 10 }}>
            {t('tg_how_to')}
          </p>
          {tgChatId && (
            <div style={{ fontSize: '.6rem', color: '#30d158', marginBottom: 8 }}>
              {t('tg_connected')}: <b>{tgChatId}</b>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="text"
              className="fi"
              value={tgChatId}
              onChange={e => {
                const raw = e.target.value
                if (raw === '' || raw === '-' || /^-?\d+$/.test(raw)) setTgChatId(raw)
              }}
              placeholder={t('tg_placeholder')}
              style={{ flex: 1 }}
            />
            <button
              className="run"
              disabled={tgSaving || !tgChatId}
              onClick={async () => {
                setTgSaving(true)
                try {
                  const r = await fetch('/api/settings', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ telegram_chat_id: tgChatId }),
                  })
                  const d = await r.json()
                  if (d.ok) showToast(t('tg_connected'))
                  else showToast(d.error || t('error'), 'err')
                } catch { showToast(t('error'), 'err') }
                setTgSaving(false)
              }}
              style={{ whiteSpace: 'nowrap', fontSize: '.62rem', padding: '6px 14px' }}
            >
              {tgSaving ? '...' : t('tg_save_btn')}
            </button>
          </div>
        </div>

        <div className="sb2">
          <div className="st">{t('export_data_title')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="run" disabled={exporting} onClick={() => exportCSV('trades')}
              style={{ flex: 1, fontSize: '.62rem' }}>
              {t('export_trades_btn')}
            </button>
            <button className="run" disabled={exporting} onClick={() => exportCSV('signals')}
              style={{ flex: 1, fontSize: '.62rem', background: 'var(--bg3)', color: 'var(--cyan)', border: '1px solid var(--line2)' }}>
              {t('export_signals_btn')}
            </button>
          </div>
        </div>

        <button className="ssave" onClick={save}>{t('save')}</button>
      </div>
    </div>
  )
}
