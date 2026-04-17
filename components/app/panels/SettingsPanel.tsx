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
  const [exporting, setExporting] = useState(false)
  const [aiBalance, setAiBalance]   = useState(1000)
  const [aiRisk, setAiRisk]         = useState(1.0)
  const [aiLeverage, setAiLeverage] = useState(20)

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.ok && d.settings) {
        if (d.settings.nickname)         setNickname(d.settings.nickname)
        if (d.settings.email)            setEmail(d.settings.email)
        if (d.settings.ai_balance)        setAiBalance(d.settings.ai_balance)
        if (d.settings.ai_risk_per_trade) setAiRisk(d.settings.ai_risk_per_trade)
        if (d.settings.ai_max_leverage)   setAiLeverage(d.settings.ai_max_leverage)
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
        body: JSON.stringify({ nickname, email, lang, ai_balance: aiBalance, ai_risk_per_trade: aiRisk, ai_max_leverage: aiLeverage }),
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

  async function exportCSV(type: 'trades' | 'signals') {
    setExporting(true)
    try {
      const url = type === 'trades' ? '/api/trades' : '/api/signals?limit=1000'
      const r = await fetch(url)
      const d = await r.json()
      const rows = type === 'trades' ? d.trades : d.signals
      if (!rows?.length) { showToast('Нет данных для экспорта', 'err'); return }

      let csv = ''
      if (type === 'trades') {
        csv = 'ID,Пара,Направление,Тип,Сумма,Вход,TP,SL,Плечо,Статус,PnL,PnL%,Дата\n'
        csv += rows.map((t: Record<string, unknown>) =>
          [t.id, t.pair, t.direction, t.order_type, t.amount,
           t.entry_price ?? '', t.tp_price ?? '', t.sl_price ?? '',
           t.leverage, t.status, t.pnl ?? '', t.pnl_pct ?? '',
           new Date(t.created_at as string).toLocaleDateString('ru-RU')].join(',')
        ).join('\n')
      } else {
        csv = 'ID,Пара,ТФ,Вердикт,Уверенность,Вход,TP,SL,Плечо,Исход,PnL%,Дата\n'
        csv += rows.map((s: Record<string, unknown>) =>
          [s.id, s.pair, s.timeframe, s.final_verdict, s.final_confidence,
           s.final_entry ?? '', s.final_tp ?? '', s.final_sl ?? '',
           s.final_leverage ?? '', s.outcome ?? '', s.actual_pnl_pct ?? '',
           new Date(s.created_at as string).toLocaleDateString('ru-RU')].join(',')
        ).join('\n')
      }

      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `kotvukai_${type}_${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      showToast(`Экспорт ${rows.length} записей`)
    } catch { showToast('Ошибка экспорта', 'err') }
    setExporting(false)
  }

  const tierInfo = TIER_LABELS[sub?.tier || 'free']
  const usagePct = sub ? Math.min(100, (sub.analyses_today / sub.limit) * 100) : 0

  return (
    <div className="panel active" id="panel-settings">
      <div style={{ maxWidth: 500, margin: '0 auto' }}>

        {/* ── Подписка ── */}
        {sub && (
          <div className="sb2">
            <div className="st">Подписка</div>
            <div className="sub-bar">
              <div className="sub-bar-info">
                <div className="sub-bar-tier" style={{ color: tierInfo.color }}>
                  {tierInfo.name} Plan
                </div>
                <div className="sub-bar-usage">
                  {sub.analyses_today} / {sub.limit} анализов сегодня
                  &nbsp;·&nbsp; осталось: <span style={{ color: tierInfo.color }}>{sub.remaining}</span>
                </div>
                <div className="sub-bar-progress" style={{ marginTop: 8 }}>
                  <div className="sub-bar-fill" style={{ width: `${usagePct}%`, background: tierInfo.color }} />
                </div>
              </div>
              <span className={`tag tag-${sub.tier}`} style={{ fontSize: '.58rem', fontWeight: 700, padding: '3px 10px' }}>
                {tierInfo.name.toUpperCase()}
              </span>
            </div>
            <p style={{ fontSize: '.6rem', color: 'var(--dim)', marginTop: 4 }}>
              Для изменения тарифа обратитесь к администратору.
            </p>
          </div>
        )}

        {/* ── AI Трейдинг ── */}
        <div className="sb2">
          <div className="st">Настройки AI-трейдинга</div>
          <p style={{ fontSize: '.6rem', color: 'var(--dim)', marginBottom: 10 }}>
            Параметры для автоматических сделок, которые открывает AI после анализа.
          </p>
          <div className="fg">
            <div className="ff full">
              <div className="rw">
                <div className="rt">
                  <label className="fl">Баланс депозита ($)</label>
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
                  <label className="fl">Риск на сделку (%)</label>
                  <span className="rv">{aiRisk.toFixed(1)}%</span>
                </div>
                <input type="range" min={0.1} max={10} step={0.1} value={aiRisk}
                  onChange={e => setAiRisk(parseFloat(e.target.value))} />
                <div className="rm"><span>0.1%</span><span>10%</span></div>
                <div style={{ fontSize: '.58rem', color: 'var(--dim)', marginTop: 2 }}>
                  Риск ${Math.round(aiBalance * aiRisk / 100)} на сделку · ≈ {Math.round(100 / aiRisk)} сделок до полного слива
                </div>
              </div>
            </div>
            <div className="ff full">
              <div className="rw">
                <div className="rt">
                  <label className="fl">Макс. плечо AI</label>
                  <span className="rv">{aiLeverage}×</span>
                </div>
                <input type="range" min={1} max={125} step={1} value={aiLeverage}
                  onChange={e => setAiLeverage(parseInt(e.target.value))} />
                <div className="rm"><span>1×</span><span>125×</span></div>
              </div>
            </div>
          </div>
          <p style={{ fontSize: '.58rem', color: 'var(--dim)', marginTop: 6 }}>
            ⚠️ Это виртуальный счёт (Paper Trading). Реальные средства не используются.
          </p>
        </div>

        {/* ── Профиль ── */}
        <div className="sb2">
          <div className="st">{t('profile')}</div>
          <div className="fg">
            <div className="ff full"><label className="fl">{t('nickname')}</label>
              <input type="text" className="fi" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="username" /></div>
            <div className="ff full"><label className="fl">{t('email')}</label>
              <input type="email" className="fi" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" /></div>
          </div>
        </div>

        {/* ── Безопасность ── */}
        <div className="sb2">
          <div className="st">{t('security')}</div>
          <div className="fg">
            <div className="ff full"><label className="fl">{t('new_password')}</label>
              <input type="password" className="fi" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" /></div>
            <div className="ff full"><label className="fl">{t('confirm_password')}</label>
              <input type="password" className="fi" value={pass2} onChange={e => setPass2(e.target.value)} placeholder="••••••••" /></div>
          </div>
        </div>

        {/* ── Язык ── */}
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

        {/* ── Export ── */}
        <div className="sb2">
          <div className="st">Экспорт данных</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="run" disabled={exporting} onClick={() => exportCSV('trades')}
              style={{ flex: 1, fontSize: '.62rem' }}>
              📥 Сделки CSV
            </button>
            <button className="run" disabled={exporting} onClick={() => exportCSV('signals')}
              style={{ flex: 1, fontSize: '.62rem', background: 'var(--bg3)', color: 'var(--cyan)', border: '1px solid var(--line2)' }}>
              📥 Сигналы CSV
            </button>
          </div>
        </div>

        <button className="ssave" onClick={save}>{t('save')}</button>
      </div>
    </div>
  )
}
