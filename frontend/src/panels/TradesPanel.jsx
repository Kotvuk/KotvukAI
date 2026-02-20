import React, { useState, useEffect, useCallback } from 'react';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const getStyles = (theme) => ({
  card: { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 },
  inputStyle: { width: '100%', background: theme.inputBg, border: '1px solid ' + theme.border, borderRadius: 8, padding: '10px 14px', color: theme.text, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box' },
  btnPrimary: { background: theme.accent, color: theme.name === 'light' ? '#fff' : theme.text, border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: "'Inter',sans-serif" },
  btnDanger: { background: theme.redBg, color: theme.red, border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: "'Inter',sans-serif" },
  selStyle: { background: theme.inputBg, color: theme.text, border: '1px solid ' + theme.border, borderRadius: 8, padding: '10px 14px', fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none' },
  dirBtn: (active, color) => ({ padding: '10px 20px', borderRadius: 8, border: '1px solid ' + (active ? color : theme.border), background: active ? (color === theme.green ? theme.greenBg : theme.redBg) : 'transparent', color: active ? color : theme.textSecondary, cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: "'Inter',sans-serif" })
});

const PAIRS = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','AVAXUSDT'];

export default function TradesPanel() {
  const { t } = useLang();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [pair, setPair] = useState('BTCUSDT');
  const [direction, setDirection] = useState('long');
  const [quantity, setQuantity] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [tp, setTp] = useState('');
  const [sl, setSl] = useState('');
  const [openTrades, setOpenTrades] = useState([]);
  const [closedTrades, setClosedTrades] = useState([]);
  const [stats, setStats] = useState({ totalPnl: 0, winRate: 0, avgPnl: 0, best: 0, worst: 0, total: 0 });
  const [prices, setPrices] = useState({});

  const fetchTrades = useCallback(async () => {
    try {
      const [openR, closedR, statsR] = await Promise.all([
        fetch('/api/trades?status=open'), fetch('/api/trades?status=closed'), fetch('/api/trades/stats')
      ]);
      setOpenTrades(await openR.json());
      setClosedTrades(await closedR.json());
      setStats(await statsR.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchPrices = useCallback(async () => {
    if (openTrades.length === 0) return;
    const symbols = [...new Set(openTrades.map(t => t.pair))].join(',');
    try {
      const r = await fetch(`/api/prices?symbols=${symbols}`);
      const data = await r.json();
      const map = {};
      data.forEach(p => { map[p.symbol] = +p.price; });
      setPrices(map);
    } catch (e) { console.error(e); }
  }, [openTrades]);

  const fetchCurrentPrice = useCallback(async () => {
    try {
      const r = await fetch(`/api/price?symbol=${pair}`);
      const d = await r.json();
      if (d.price) setEntryPrice(d.price);
    } catch (e) { console.error(e); }
  }, [pair]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);
  useEffect(() => { fetchCurrentPrice(); }, [fetchCurrentPrice]);
  useEffect(() => {
    fetchPrices();
    const iv = setInterval(fetchPrices, 10000);
    return () => clearInterval(iv);
  }, [fetchPrices]);

  const handleSubmit = async () => {
    if (!quantity || !entryPrice) return;
    await fetch('/api/trades', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pair, direction, quantity: +quantity, entry_price: +entryPrice, tp: tp ? +tp : null, sl: sl ? +sl : null })
    });
    setQuantity(''); setTp(''); setSl('');
    fetchTrades();
  };

  const handleClose = async (id) => {
    await fetch(`/api/trades/${id}/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    fetchTrades();
  };

  const calcPnl = (trade) => {
    const cp = prices[trade.pair];
    if (!cp) return null;
    return trade.direction === 'long' ? (cp - trade.entry_price) * trade.quantity : (trade.entry_price - cp) * trade.quantity;
  };

  return (
    <div>
      <h2 style={{ color: '#fff', fontSize: 20, marginBottom: 16 }}>📋 {t('trades')}</h2>

      {/* Stats */}
      <div style={grid}>
        {[
          { label: t('totalPnl'), value: `$${stats.totalPnl?.toFixed(2) || '0.00'}`, color: stats.totalPnl >= 0 ? '#22c55e' : '#ef4444' },
          { label: t('winRate'), value: `${stats.winRate?.toFixed(1) || '0'}%`, color: '#3b82f6' },
          { label: t('avgPnl'), value: `$${stats.avgPnl?.toFixed(2) || '0.00'}`, color: stats.avgPnl >= 0 ? '#22c55e' : '#ef4444' },
          { label: t('bestTrade'), value: `$${stats.best?.toFixed(2) || '0.00'}`, color: '#22c55e' },
          { label: t('worstTrade'), value: `$${stats.worst?.toFixed(2) || '0.00'}`, color: '#ef4444' },
        ].map((s, i) => (
          <div key={i} style={card}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Open Trade Form */}
      <div style={card}>
        <h3 style={{ color: '#fff', fontSize: 16, marginBottom: 16 }}>➕ {t('openTrade')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>{t('pair')}</label>
            <select style={{ ...selStyle, width: '100%' }} value={pair} onChange={e => setPair(e.target.value)}>
              {PAIRS.map(p => <option key={p} value={p}>{p.replace('USDT', '/USDT')}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>{t('direction')}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={dirBtn(direction === 'long', '#22c55e')} onClick={() => setDirection('long')}>{t('long')}</button>
              <button style={dirBtn(direction === 'short', '#ef4444')} onClick={() => setDirection('short')}>{t('short')}</button>
            </div>
          </div>
          <div>
            <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>{t('quantity')}</label>
            <input style={inputStyle} type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0.01" />
          </div>
          <div>
            <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>{t('entryPrice')}</label>
            <input style={inputStyle} type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} />
          </div>
          <div>
            <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>{t('takeProfit')}</label>
            <input style={inputStyle} type="number" value={tp} onChange={e => setTp(e.target.value)} placeholder={t('takeProfit')} />
          </div>
          <div>
            <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>{t('stopLoss')}</label>
            <input style={inputStyle} type="number" value={sl} onChange={e => setSl(e.target.value)} placeholder={t('stopLoss')} />
          </div>
        </div>
        <button style={{ ...btnPrimary, marginTop: 16 }} onClick={handleSubmit}>{t('openTrade')}</button>
      </div>

      {/* Open Trades */}
      <div style={card}>
        <h3 style={{ color: '#fff', fontSize: 16, marginBottom: 12 }}>📈 {t('openTrades')} ({openTrades.length})</h3>
        {openTrades.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 20 }}>{t('noOpenTrades')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{[t('pair'), t('direction'), t('quantity'), t('entryPrice'), t('takeProfit'), t('stopLoss'), t('currentPrice'), t('unrealizedPnl'), ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#666', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {openTrades.map(trade => {
                  const pnl = calcPnl(trade);
                  const cp = prices[trade.pair];
                  return (
                    <tr key={trade.id}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{trade.pair.replace('USDT', '')}<span style={{ color: '#666' }}>/USDT</span></td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: trade.direction === 'long' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: trade.direction === 'long' ? '#22c55e' : '#ef4444' }}>
                          {trade.direction.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px', color: '#ccc' }}>{trade.quantity}</td>
                      <td style={{ padding: '10px', color: '#ccc' }}>${trade.entry_price}</td>
                      <td style={{ padding: '10px', color: '#22c55e' }}>{trade.tp ? `$${trade.tp}` : '—'}</td>
                      <td style={{ padding: '10px', color: '#ef4444' }}>{trade.sl ? `$${trade.sl}` : '—'}</td>
                      <td style={{ padding: '10px', color: '#fff' }}>{cp ? `$${cp.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : '...'}</td>
                      <td style={{ padding: '10px', fontWeight: 700, color: pnl !== null ? (pnl >= 0 ? '#22c55e' : '#ef4444') : '#666' }}>
                        {pnl !== null ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : '...'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <button style={btnDanger} onClick={() => handleClose(trade.id)}>{t('closeTrade')}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Closed Trades */}
      <div style={card}>
        <h3 style={{ color: '#fff', fontSize: 16, marginBottom: 12 }}>📊 {t('closedTrades')} ({closedTrades.length})</h3>
        {closedTrades.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 20 }}>{t('noClosedTrades')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{[t('pair'), t('direction'), t('quantity'), t('entryPrice'), t('closePrice'), t('pnl'), t('closedAt')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#666', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {closedTrades.slice(0, 20).map(trade => (
                  <tr key={trade.id}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{trade.pair.replace('USDT', '')}<span style={{ color: '#666' }}>/USDT</span></td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: trade.direction === 'long' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: trade.direction === 'long' ? '#22c55e' : '#ef4444' }}>
                        {trade.direction.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: '#ccc' }}>{trade.quantity}</td>
                    <td style={{ padding: '10px', color: '#ccc' }}>${trade.entry_price}</td>
                    <td style={{ padding: '10px', color: '#ccc' }}>${trade.close_price}</td>
                    <td style={{ padding: '10px', fontWeight: 700, color: (trade.pnl || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                      {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px', color: '#888', fontSize: 12 }}>{trade.closed_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
