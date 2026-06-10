'use client'
import { useEffect, useState, useRef } from 'react'
import { useLang } from '@/contexts/LangContext'
import { showToast } from '@/components/ui/Toast'
import { usePairs } from '@/hooks/usePairs'
import { fmtAlmaty } from '@/lib/fmt'
import TradePathModal from './TradePathModal'


interface Trade {
  id: number; pair: string; direction: string; order_type: string
  amount: number; entry_price: number | null; tp_price: number | null
  sl_price: number | null; leverage: number; status: string
  account_type: string; limit_price: number | null; expires_at: string | null
  pnl: number | null; pnl_pct: number | null; exit_price: number | null
  closed_at: string | null; created_at: string
}

interface EditState {
  tp: string
  sl: string
  saving: boolean
}

interface TradesPanelProps {
  defaultAccount?: 'user' | 'ai'
  onTabMounted?: () => void
}

export default function TradesPanel({ defaultAccount = 'user', onTabMounted }: TradesPanelProps) {
  const { t } = useLang()
  const { pairs: allPairs } = usePairs()
  const [account, setAccount] = useState<'user' | 'ai'>(defaultAccount)
  const [trades, setTrades] = useState<Trade[]>([])
  const [pair, setPair] = useState('BTC/USDT')
  const [dir, setDir] = useState<'long' | 'short'>('long')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [amt, setAmt] = useState('')
  const [entryPrice, setEntryPrice] = useState('')
  const [tp, setTp] = useState('')
  const [sl, setSl] = useState('')
  const [lev, setLev] = useState(2)
  const [pairSearch, setPairSearch] = useState('')
  const [pairOpen, setPairOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [livePrices, setLivePrices] = useState<Record<string, number>>({})
  const [editStates, setEditStates] = useState<Record<number, EditState>>({})
  const [aiBalance, setAiBalance] = useState<number | null>(null)
  const [balanceModal, setBalanceModal] = useState(false)
  const [balanceType, setBalanceType] = useState<'add' | 'subtract'>('add')
  const [balanceInput, setBalanceInput] = useState('')
  const [balanceSaving, setBalanceSaving] = useState(false)
  const [pathTrade, setPathTrade] = useState<Trade | null>(null)
  const openRef = useRef<Trade[]>([])

  useEffect(() => { loadTrades() }, [account])

  useEffect(() => {
    onTabMounted?.()
    loadBalance()
  }, [])

  function loadBalance() {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d.ok) setAiBalance(Number(d.settings.ai_balance ?? 10000))
    }).catch(() => {})
  }

  useEffect(() => {
    const raw = localStorage.getItem('kotvuk:trade_prefill')
    if (!raw) return
    try {
      const d = JSON.parse(raw) as {
        pair?: string; direction?: string; entry_price?: number
        tp_price?: number; sl_price?: number; leverage?: number; order_type?: string
      }
      if (d.pair) setPair(d.pair)
      if (d.direction) setDir(d.direction as 'long' | 'short')
      if (d.entry_price) setEntryPrice(String(d.entry_price))
      if (d.tp_price)    setTp(String(d.tp_price))
      if (d.sl_price)    setSl(String(d.sl_price))
      if (d.leverage)    setLev(Math.min(d.leverage, 3))
      if (d.order_type)  setOrderType(d.order_type as 'market' | 'limit')
      localStorage.removeItem('kotvuk:trade_prefill')
      showToast(t('ai_data_loaded_msg'), 'ok')
    } catch {}
  }, [])

  useEffect(() => {
    async function fetchPrices() {
      const pairs = Array.from(new Set(openRef.current.map(tr => tr.pair)))
      if (!pairs.length) return
      const results: Record<string, number> = {}
      await Promise.all(pairs.map(async p => {
        try {
          const sym = p.replace('/', '')
          const r = await fetch(`/api/klines?symbol=${sym}&interval=1m&limit=1`)
          if (!r.ok) return
          const d: number[][] = await r.json()
          if (d?.[0]?.[4]) results[p] = parseFloat(String(d[0][4]))
        } catch {}
      }))
      if (Object.keys(results).length) setLivePrices(prev => ({ ...prev, ...results }))
    }
    fetchPrices()
    const id = setInterval(fetchPrices, 5000)
    return () => clearInterval(id)
  }, [])

  async function loadTrades() {
    const r = await fetch(`/api/trades?account=${account}`)
    const d = await r.json()
    if (d.ok) {
      setTrades(d.trades || [])
      openRef.current = (d.trades || []).filter((tr: Trade) => tr.status === 'open')
    }
    loadBalance()
  }

  async function handleBalanceAdjust() {
    const amount = parseFloat(balanceInput)
    if (!amount || amount <= 0) { showToast(t('enter_amount'), 'err'); return }
    setBalanceSaving(true)
    try {
      const r = await fetch('/api/balance/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: balanceType, amount }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      setAiBalance(d.balance)
      setBalanceModal(false)
      setBalanceInput('')
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('error'), 'err')
    }
    setBalanceSaving(false)
  }

  async function openTrade() {
    if (!amt || parseFloat(amt) <= 0) { showToast(t('enter_amount'), 'err'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/trades', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair, direction: dir, order_type: orderType, amount: parseFloat(amt),
          entry_price: entryPrice ? parseFloat(entryPrice) : null,
          tp_price: tp ? parseFloat(tp) : null,
          sl_price: sl ? parseFloat(sl) : null,
          leverage: lev,
          account_type: account,
        }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      showToast(t('position_opened'))
      setAmt(''); setEntryPrice(''); setTp(''); setSl('')
      loadTrades()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : t('error'), 'err') }
    setLoading(false)
  }

  async function cancelTrade(id: number) {
    try {
      const r = await fetch(`/api/trades/${id}/close`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel: true }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      showToast(t('order_cancelled_msg'))
      loadTrades()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : t('error'), 'err') }
  }

  async function closeTrade(id: number) {
    try {
      const r = await fetch(`/api/trades/${id}/close`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error || t('error'))
      showToast(t('position_closed'))
      loadTrades()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : t('error'), 'err') }
  }

  async function saveEdit(id: number) {
    const es = editStates[id]
    if (!es) return
    setEditStates(prev => ({ ...prev, [id]: { ...prev[id], saving: true } }))
    try {
      const r = await fetch(`/api/trades/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tp_price: es.tp ? parseFloat(es.tp) : null,
          sl_price: es.sl ? parseFloat(es.sl) : null,
        }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      showToast(t('tp_sl_updated_msg'), 'ok')
      setEditStates(prev => { const n = { ...prev }; delete n[id]; return n })
      loadTrades()
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : t('error'), 'err')
      setEditStates(prev => ({ ...prev, [id]: { ...prev[id], saving: false } }))
    }
  }

  const pending = trades.filter(tr => tr.status === 'pending')
  const open    = trades.filter(tr => tr.status === 'open')
  const closed  = trades.filter(tr => tr.status === 'closed' || tr.status === 'cancelled')
  const filtered = pairSearch ? allPairs.filter(p => p.toLowerCase().includes(pairSearch.toLowerCase())) : allPairs

  const todayStr = new Date().toDateString()
  const closedToday = closed.filter(tr => tr.status === 'closed' && new Date(tr.closed_at || tr.created_at).toDateString() === todayStr)
  const pnlToday = closedToday.reduce((s, tr) => s + (Number(tr.pnl) || 0), 0)
  const closedReal = closed.filter(tr => tr.status === 'closed' && tr.pnl !== null)
  const wins = closedReal.filter(tr => (Number(tr.pnl) || 0) > 0).length
  const winRate = closedReal.length > 0 ? Math.round(wins / closedReal.length * 100) : null
  const displayBalance = account === 'ai' ? (aiBalance ?? '…') : null

  const refPrice = parseFloat(entryPrice) || 1
  const amtN = parseFloat(amt) || 0
  const tpN  = parseFloat(tp) || 0
  const slN  = parseFloat(sl) || 0
  const dirMul = dir === 'long' ? 1 : -1
  const tpProfit = tpN ? ((tpN - refPrice) / refPrice * 100 * dirMul * lev * amtN / 100).toFixed(2) : null
  const slLoss   = slN ? ((slN - refPrice) / refPrice * 100 * dirMul * lev * amtN / 100).toFixed(2) : null

  return (
    <div className="panel active" id="panel-trades">
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <div className="tg" style={{ flex: 1 }}>
            <button className={`tb ${account === 'user' ? 'a-d' : ''}`} onClick={() => setAccount('user')}>
              {t('my_account')}
            </button>
            <button className={`tb ${account === 'ai' ? 'a-d' : ''}`} onClick={() => setAccount('ai')}>
              {t('ai_account')}
            </button>
          </div>
          <span style={{ fontSize: '.55rem', color: '#ffa500', background: 'rgba(255,165,0,0.12)', border: '1px solid rgba(255,165,0,0.3)', borderRadius: 4, padding: '2px 8px', whiteSpace: 'nowrap' }}>
            📄 PAPER TRADING
          </span>
        </div>
        <div style={{ fontSize: '.58rem', color: 'var(--dim)', marginBottom: 10 }}>
          {account === 'ai' ? t('account_desc_both') : t('virtual_account_desc')}
        </div>
        <div className="kpi-grid" style={{ marginBottom: 12 }}>
          <div className="kpi" style={{ position: 'relative' }} title={t('virtual_balance_hint')}>
            <div className="kpi-v" style={{ color: '#ffa500' }}>
              {displayBalance !== null ? `$${typeof displayBalance === 'number' ? displayBalance.toLocaleString() : displayBalance}` : '—'}
            </div>
            <div className="kpi-l" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {t('balance')} <span style={{ fontSize: '.5rem', opacity: .6 }}>(virtual)</span>
              {account === 'ai' && (
                <button
                  onClick={() => { setBalanceModal(true); setBalanceInput(''); setBalanceType('add') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0 2px', fontSize: '.7rem', lineHeight: 1 }}
                  title={t('balance_modal_title')}
                >✏️</button>
              )}
            </div>
          </div>
          <div className="kpi"><div className="kpi-v">{open.length}</div><div className="kpi-l">{t('positions')}</div></div>
          <div className="kpi">
            <div className={`kpi-v ${pnlToday > 0 ? 'pnl-p' : pnlToday < 0 ? 'pnl-n' : ''}`}>
              {pnlToday !== 0 ? `${pnlToday > 0 ? '+' : ''}$${Math.abs(pnlToday).toFixed(2)}` : '$0'}
            </div>
            <div className="kpi-l">{t('pnl_today')}</div>
          </div>
          <div className="kpi">
            <div className="kpi-v">{winRate !== null ? `${winRate}%` : '—'}</div>
            <div className="kpi-l">{t('win_rate')}</div>
          </div>
        </div>

        {account === 'ai' && (
          <div style={{ padding: '10px 14px', marginBottom: 12, background: 'var(--card2)', borderRadius: 8, fontSize: '.65rem', color: 'var(--muted)' }}>
            {t('ai_auto_trades_desc')}
          </div>
        )}
        {pending.length > 0 && (<>
          <div className="sec" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {t('pending_orders')}
            <span style={{ background: '#ffd60a22', color: '#ffd60a', border: '1px solid #ffd60a44', borderRadius: 20, padding: '1px 8px', fontSize: '.58rem', fontWeight: 700 }}>
              {pending.length}
            </span>
          </div>
          <div className="tbox" style={{ marginBottom: 12 }}>
            {pending.map(tr => {
              const expiresAt = tr.expires_at ? new Date(tr.expires_at) : null
              const hoursLeft = expiresAt ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 3600000)) : null
              return (
                <div key={tr.id} style={{ borderBottom: '1px solid var(--line2)', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '.75rem' }}>{tr.pair}</span>
                  <span className={`tag tag-${tr.direction}`}>{tr.direction.toUpperCase()}</span>
                  <span className="tag tag-pending">LIMIT</span>
                  <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>{tr.leverage}× · ${parseFloat(String(tr.amount)).toFixed(2)}</span>
                  <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>
                    {t('trigger_at')} <span style={{ color: '#ffd60a' }}>${parseFloat(String(tr.limit_price || 0)).toLocaleString()}</span>
                  </span>
                  {tr.tp_price && <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>TP: <span style={{ color: 'var(--long)' }}>${parseFloat(String(tr.tp_price)).toLocaleString()}</span></span>}
                  {tr.sl_price && <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>SL: <span style={{ color: 'var(--short)' }}>${parseFloat(String(tr.sl_price)).toLocaleString()}</span></span>}
                  <span style={{ marginLeft: 'auto', fontSize: '.6rem', color: hoursLeft !== null && hoursLeft < 24 ? '#ff9f0a' : 'var(--dim)' }}>
                    {hoursLeft !== null ? `${t('expires_in_h')} ${hoursLeft}h` : ''}
                  </span>
                  <button className="obtn" style={{ fontSize: '.6rem', color: '#ff453a', borderColor: '#ff453a44' }} onClick={() => cancelTrade(tr.id)}>
                    {t('cancel_order')}
                  </button>
                </div>
              )
            })}
          </div>
        </>)}

        <div className="sec">{t('new_position')}</div>
        <div className="tbox" style={{ marginBottom: 12, padding: 13 }}>
          <div className="fg">
            <div className="ff full">
              <label className="fl">{t('pair')}</label>
              <div className="dw" style={{ width: '100%' }}>
                <div className="db" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPairOpen(v => !v)}>
                  <span>{pair}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ width: 9, height: 9 }}><polyline points="6 9 12 15 18 9" /></svg>
                </div>
                {pairOpen && (
                  <div className="dm" style={{ width: '100%' }}>
                    <input className="ds" placeholder={t('search_pair_input')} value={pairSearch} onChange={e => setPairSearch(e.target.value)} autoFocus />
                    <div className="dl">
                      {filtered.map(pp => (
                        <div key={pp} className={`di ${pp === pair ? 'sel' : ''}`} onClick={() => { setPair(pp); setPairOpen(false); setPairSearch('') }}>{pp}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="ff"><label className="fl">{t('order')}</label>
              <div className="tg">
                <button className={`tb ${orderType === 'market' ? 'a-d' : ''}`} onClick={() => setOrderType('market')}>{t('market')}</button>
                <button className={`tb ${orderType === 'limit' ? 'a-d' : ''}`} onClick={() => setOrderType('limit')}>{t('limit')}</button>
              </div>
            </div>
            <div className="ff"><label className="fl">{t('direction')}</label>
              <div className="tg">
                <button className={`tb ${dir === 'long' ? 'a-l' : ''}`} onClick={() => setDir('long')}>{t('long')}</button>
                <button className={`tb ${dir === 'short' ? 'a-s' : ''}`} onClick={() => setDir('short')}>{t('short')}</button>
              </div>
            </div>
            {orderType === 'limit' && (
              <div className="ff full"><label className="fl">{t('entry_price')}</label>
                <input type="number" className="fi" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} placeholder="0.00" /></div>
            )}
            <div className="ff full"><label className="fl">{t('amount_usdt')}</label>
              <input type="number" className="fi" value={amt} onChange={e => setAmt(e.target.value)} placeholder="0.00" /></div>
            <div className="ff"><label className="fl">{t('take_profit')}</label>
              <input type="number" className="fi" value={tp} onChange={e => setTp(e.target.value)} placeholder="0.00" /></div>
            <div className="ff"><label className="fl">{t('stop_loss')}</label>
              <input type="number" className="fi" value={sl} onChange={e => setSl(e.target.value)} placeholder="0.00" /></div>
            {(tpProfit || slLoss) && amtN > 0 && (
              <div className="ff full">
                <div className="pnl-g">
                  <div className="pnl-c"><div className="pnl-l">{t('tp_profit')}</div><div className={`pnl-v ${tpProfit && parseFloat(tpProfit) > 0 ? 'pnl-p' : ''}`}>{tpProfit && parseFloat(tpProfit) > 0 ? '+$' + tpProfit : '—'}</div></div>
                  <div className="pnl-c"><div className="pnl-l">{t('sl_loss')}</div><div className={`pnl-v ${slLoss && parseFloat(slLoss) < 0 ? 'pnl-n' : ''}`}>{slLoss && parseFloat(slLoss) < 0 ? '-$' + Math.abs(parseFloat(slLoss)).toFixed(2) : '—'}</div></div>
                </div>
              </div>
            )}
            <div className="ff full">
              <div className="rw">
                <div className="rt"><label className="fl">{t('leverage_x')}</label><span className="rv">{lev}×</span></div>
                <input type="range" min={1} max={10} value={lev} onChange={e => setLev(parseInt(e.target.value))} />
                <div className="rm"><span>1×</span><span>10×</span></div>
              </div>
            </div>
            <div className="ff full">
              <button className={`sb ${dir === 'long' ? 'sl' : 'ss'}`} onClick={openTrade} disabled={loading}>
                {dir === 'long' ? t('open_long') : t('open_short')}
              </button>
            </div>
          </div>
        </div>

        <div className="sec">{t('open_positions')}</div>
        <div className="tbox" style={{ marginBottom: 12 }}>
          {open.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--dim)', padding: 14, fontSize: '.63rem' }}>{t('no_positions')}</div>
          ) : open.map(tr => {
            const cur = livePrices[tr.pair]
            const ep  = tr.entry_price ? parseFloat(String(tr.entry_price)) : null
            const pct = (cur && ep) ? (cur - ep) / ep * 100 * (tr.direction === 'long' ? 1 : -1) * (tr.leverage || 1) : null
            const usdPnl = pct != null ? parseFloat(String(tr.amount)) * pct / 100 : null
            const es = editStates[tr.id]
            return (
              <div key={tr.id} style={{ borderBottom: '1px solid var(--line2)', padding: '11px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: '.75rem' }}>{tr.pair}</span>
                  <span className={`tag tag-${tr.direction}`}>{tr.direction.toUpperCase()}</span>
                  <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>{tr.leverage}× · ${parseFloat(String(tr.amount)).toFixed(2)}</span>
                  <span style={{ marginLeft: 'auto', fontSize: '.62rem', color: 'var(--dim)' }}>
                    {fmtAlmaty(tr.created_at)}
                  </span>
                  <span style={{ fontSize: '.62rem', color: 'var(--muted)' }}>
                    {cur ? '$' + cur.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                  </span>
                  {pct != null && (
                    <span style={{ fontWeight: 700, fontSize: '.72rem', color: pct >= 0 ? 'var(--long)' : 'var(--short)' }}>
                      {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                      {usdPnl != null && <span style={{ fontWeight: 400, fontSize: '.6em' }}> ({usdPnl >= 0 ? '+' : ''}${usdPnl.toFixed(2)})</span>}
                    </span>
                  )}
                </div>

                {es ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <input
                      type="number" className="fi" style={{ flex: 1 }} placeholder="TP"
                      value={es.tp} onChange={e => setEditStates(prev => ({ ...prev, [tr.id]: { ...prev[tr.id], tp: e.target.value } }))}
                    />
                    <input
                      type="number" className="fi" style={{ flex: 1 }} placeholder="SL"
                      value={es.sl} onChange={e => setEditStates(prev => ({ ...prev, [tr.id]: { ...prev[tr.id], sl: e.target.value } }))}
                    />
                    <button className="obtn l" onClick={() => saveEdit(tr.id)} disabled={es.saving}>
                      {es.saving ? '...' : t('save_changes_btn')}
                    </button>
                    <button className="obtn" onClick={() => setEditStates(prev => { const n = { ...prev }; delete n[tr.id]; return n })}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: '.63rem', marginBottom: 6 }}>
                    <span style={{ color: 'var(--muted)' }}>{t('entry_at')} <span style={{ color: 'var(--text)' }}>{ep ? '$' + ep.toLocaleString() : '—'}</span></span>
                    <span style={{ color: 'var(--muted)' }}>TP: <span style={{ color: 'var(--long)' }}>{tr.tp_price ? '$' + parseFloat(String(tr.tp_price)).toLocaleString() : '—'}</span></span>
                    <span style={{ color: 'var(--muted)' }}>SL: <span style={{ color: 'var(--short)' }}>{tr.sl_price ? '$' + parseFloat(String(tr.sl_price)).toLocaleString() : '—'}</span></span>
                    <button
                      className="obtn" style={{ marginLeft: 'auto', fontSize: '.6rem' }}
                      onClick={() => setEditStates(prev => ({
                        ...prev,
                        [tr.id]: { tp: tr.tp_price ? String(tr.tp_price) : '', sl: tr.sl_price ? String(tr.sl_price) : '', saving: false }
                      }))}
                    >
                      {t('edit_tp_sl_btn')}
                    </button>
                    <button className="obtn l" onClick={() => closeTrade(tr.id)}>{t('close')}</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="sec">{t('recent_trades')}</div>
        <div className="tbox">
          <div className="twrap">
            <table className="tbl">
              <thead><tr><th>{t('pair')}</th><th>Dir</th><th>{t('result')}</th><th>{t('date')}</th><th></th></tr></thead>
              <tbody>
                {closed.length ? closed.slice(0, 20).map(tr => (
                  <tr key={tr.id}>
                    <td>{tr.pair}</td>
                    <td><span className={`tag tag-${tr.direction}`}>{tr.direction.toUpperCase()}</span></td>
                    <td>
                      {tr.status === 'cancelled'
                        ? <span className="tag tag-cancelled">{t('status_cancelled')}</span>
                        : (tr.pnl !== null || tr.pnl_pct !== null)
                          ? (() => {
                              const val = Number(tr.pnl) || 0
                              const pct = Number(tr.pnl_pct) || 0
                              const pos = tr.pnl !== null ? val > 0 : pct > 0
                              return (
                                <span className={pos ? 'pnl-p' : 'pnl-n'}>
                                  {pos ? '+' : ''}${Math.abs(val).toFixed(2)}
                                  {tr.pnl_pct !== null && (
                                    <span style={{ opacity: .7, fontSize: '.85em' }}> ({pct > 0 ? '+' : ''}{pct}%)</span>
                                  )}
                                </span>
                              )
                            })()
                          : '—'}
                    </td>
                    <td>{fmtAlmaty(tr.closed_at || tr.created_at)}</td>
                    <td>
                      {tr.status === 'closed' && (
                        <button className="obtn" style={{ fontSize: '.58rem' }} onClick={() => setPathTrade(tr)} title={t('trade_path_btn')}>
                          📈
                        </button>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--dim)', padding: 14, fontSize: '.63rem' }}>{t('no_trades')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {balanceModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setBalanceModal(false) }}>
          <div style={{ background: 'var(--card)', borderRadius: 12, padding: 24, width: 320, boxShadow: '0 8px 32px rgba(0,0,0,.4)' }}>
            <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: 4 }}>{t('balance_modal_title')}</div>
            <div style={{ fontSize: '.63rem', color: 'var(--muted)', marginBottom: 16 }}>
              {t('balance_modal_current')} <span style={{ color: '#ffa500', fontWeight: 700 }}>${aiBalance?.toLocaleString() ?? '…'}</span>
            </div>
            <div className="tg" style={{ marginBottom: 14 }}>
              <button className={`tb ${balanceType === 'add' ? 'a-l' : ''}`} onClick={() => setBalanceType('add')}>+ {t('balance_add_btn')}</button>
              <button className={`tb ${balanceType === 'subtract' ? 'a-s' : ''}`} onClick={() => setBalanceType('subtract')}>− {t('balance_subtract_btn')}</button>
            </div>
            <input
              type="number"
              className="fi"
              style={{ width: '100%', marginBottom: 14 }}
              placeholder={t('amount_placeholder')}
              value={balanceInput}
              onChange={e => setBalanceInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleBalanceAdjust() }}
              autoFocus
            />
            {balanceInput && parseFloat(balanceInput) > 0 && (
              <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginBottom: 12 }}>
                {t('after_label')} <span style={{ color: balanceType === 'add' ? 'var(--long)' : 'var(--short)', fontWeight: 700 }}>
                  ${((aiBalance ?? 0) + (balanceType === 'add' ? 1 : -1) * parseFloat(balanceInput)).toLocaleString()}
                </span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="obtn" style={{ flex: 1 }} onClick={() => setBalanceModal(false)}>{t('balance_cancel_btn')}</button>
              <button
                className={`sb ${balanceType === 'add' ? 'sl' : 'ss'}`}
                style={{ flex: 2, padding: '8px 0' }}
                onClick={handleBalanceAdjust}
                disabled={balanceSaving}
              >
                {balanceSaving ? '…' : balanceType === 'add' ? t('balance_add_btn') : t('balance_subtract_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pathTrade && <TradePathModal trade={pathTrade} onClose={() => setPathTrade(null)} />}
    </div>
  )
}
