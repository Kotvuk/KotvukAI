'use client'
import { useEffect, useState, useRef } from 'react'
import { useLang } from '@/contexts/LangContext'
import { showToast } from '@/components/ui/Toast'

const PAIRS = ['BTC/USDT','ETH/USDT','BNB/USDT','SOL/USDT','XRP/USDT','ADA/USDT','DOGE/USDT','AVAX/USDT']

interface Trade {
  id: number; pair: string; direction: string; order_type: string
  amount: number; entry_price: number | null; tp_price: number | null
  sl_price: number | null; leverage: number; status: string
  pnl: number | null; pnl_pct: number | null; closed_at: string | null; created_at: string
}

export default function TradesPanel() {
  const { t } = useLang()
  const [trades, setTrades] = useState<Trade[]>([])
  const [pair, setPair] = useState('BTC/USDT')
  const [dir, setDir] = useState<'long' | 'short'>('long')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [amt, setAmt] = useState('')
  const [entryPrice, setEntryPrice] = useState('')
  const [tp, setTp] = useState('')
  const [sl, setSl] = useState('')
  const [lev, setLev] = useState(10)
  const [pairSearch, setPairSearch] = useState('')
  const [pairOpen, setPairOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [livePrices, setLivePrices] = useState<Record<string, number>>({})
  const openRef = useRef<Trade[]>([])

  useEffect(() => { loadTrades() }, [])

  // Poll live prices for open positions every 5 s
  useEffect(() => {
    async function fetchPrices() {
      const pairs = [...new Set(openRef.current.map(t => t.pair))]
      if (!pairs.length) return
      const results: Record<string, number> = {}
      await Promise.all(pairs.map(async p => {
        try {
          const sym = p.replace('/', '')
          const r = await fetch(`/api/klines?symbol=${sym}&interval=1m&limit=1`)
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
    const r = await fetch('/api/trades')
    const d = await r.json()
    if (d.ok) setTrades(d.trades || [])
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
        }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      showToast(t('position_opened'))
      loadTrades()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : t('error'), 'err') }
    setLoading(false)
  }

  async function closeTrade(id: number) {
    try {
      const r = await fetch(`/api/trades/${id}/close`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      showToast(t('position_closed'))
      loadTrades()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : t('error'), 'err') }
  }

  const open = trades.filter(t => t.status === 'open')
  openRef.current = open
  const closed = trades.filter(t => t.status === 'closed')
  const filtered = pairSearch ? PAIRS.filter(p => p.toLowerCase().includes(pairSearch.toLowerCase())) : PAIRS

  // PnL preview calc
  const refPrice = parseFloat(entryPrice) || 1
  const amtN = parseFloat(amt) || 0
  const tpN = parseFloat(tp) || 0
  const slN = parseFloat(sl) || 0
  const dirMul = dir === 'long' ? 1 : -1
  const tpProfit = tpN ? ((tpN - refPrice) / refPrice * 100 * dirMul * lev * amtN / 100).toFixed(2) : null
  const slLoss = slN ? ((slN - refPrice) / refPrice * 100 * dirMul * lev * amtN / 100).toFixed(2) : null

  return (
    <div className="panel active" id="panel-trades">
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <div className="kpi-grid" style={{ marginBottom: 12 }}>
          <div className="kpi"><div className="kpi-v">$10,000</div><div className="kpi-l">{t('balance')}</div></div>
          <div className="kpi"><div className="kpi-v">{open.length}</div><div className="kpi-l">{t('positions')}</div></div>
          <div className="kpi"><div className="kpi-v pnl-p">$0</div><div className="kpi-l">{t('pnl_today')}</div></div>
          <div className="kpi"><div className="kpi-v">—</div><div className="kpi-l">{t('win_rate')}</div></div>
        </div>

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
                    <input className="ds" placeholder="Поиск..." value={pairSearch} onChange={e => setPairSearch(e.target.value)} />
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
                <input type="range" min={1} max={100} value={lev} onChange={e => setLev(parseInt(e.target.value))} />
                <div className="rm"><span>1×</span><span>100×</span></div>
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
          <div className="twrap">
            <table className="tbl">
              <thead><tr><th>{t('pair')}</th><th>Dir</th><th>Amount</th><th>{t('entry_price')}</th><th>P&L</th><th>TP/SL</th><th></th></tr></thead>
              <tbody>
                {open.length ? open.map(tr => (
                  <tr key={tr.id}>
                    <td>{tr.pair}</td>
                    <td><span className={`tag tag-${tr.direction}`}>{tr.direction.toUpperCase()}</span></td>
                    <td>${parseFloat(String(tr.amount)).toFixed(2)}</td>
                    <td>{tr.entry_price ? '$' + parseFloat(String(tr.entry_price)).toLocaleString() : '—'}</td>
                    <td>{(() => {
                      const cur = livePrices[tr.pair]
                      const ep = tr.entry_price ? parseFloat(String(tr.entry_price)) : null
                      if (!cur || !ep) return <span style={{ color: 'var(--dim)' }}>—</span>
                      const pct = (cur - ep) / ep * 100 * (tr.direction === 'long' ? 1 : -1) * (tr.leverage || 1)
                      const usdPnl = parseFloat(String(tr.amount)) * pct / 100
                      const color = pct >= 0 ? 'var(--long)' : 'var(--short)'
                      return <span style={{ color, fontWeight: 600 }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}% <span style={{ fontSize: '.58em', fontWeight: 400 }}>({pct >= 0 ? '+' : ''}${usdPnl.toFixed(2)})</span></span>
                    })()}</td>
                    <td>{tr.tp_price ? '$' + parseFloat(String(tr.tp_price)).toLocaleString() : '—'} / {tr.sl_price ? '$' + parseFloat(String(tr.sl_price)).toLocaleString() : '—'}</td>
                    <td><button className="obtn l" onClick={() => closeTrade(tr.id)}>{t('close')}</button></td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--dim)', padding: 14, fontSize: '.63rem' }}>{t('no_positions')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sec">{t('recent_trades')}</div>
        <div className="tbox">
          <div className="twrap">
            <table className="tbl">
              <thead><tr><th>{t('pair')}</th><th>Dir</th><th>{t('result')}</th><th>{t('date')}</th></tr></thead>
              <tbody>
                {closed.length ? closed.slice(0, 20).map(tr => (
                  <tr key={tr.id}>
                    <td>{tr.pair}</td>
                    <td><span className={`tag tag-${tr.direction}`}>{tr.direction.toUpperCase()}</span></td>
                    <td>{tr.pnl_pct !== null ? (Number(tr.pnl_pct) > 0 ? <span className="pnl-p">+{tr.pnl_pct}%</span> : <span className="pnl-n">{tr.pnl_pct}%</span>) : '—'}</td>
                    <td>{new Date(tr.closed_at || tr.created_at).toLocaleDateString('ru')}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--dim)', padding: 14, fontSize: '.63rem' }}>{t('no_trades')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
