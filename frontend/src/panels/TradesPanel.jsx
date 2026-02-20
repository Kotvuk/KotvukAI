import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const getStyles = (theme) => ({
  card: { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 },
  inputStyle: { width: '100%', background: theme.inputBg, border: '1px solid ' + theme.border, borderRadius: 8, padding: '10px 14px', color: theme.text, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box' },
  btnPrimary: { background: theme.accent, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: "'Inter',sans-serif" },
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
      const [openR, closedR, statsR] = await Promise.all([fetch('/api/trades?status=open'), fetch('/api/trades?status=closed'), fetch('/api/trades/stats')]);
      setOpenTrades(await openR.json()); setClosedTrades(await closedR.json()); setStats(await statsR.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchPrices = useCallback(async () => {
    if (openTrades.length === 0) return;
    const symbols = [...new Set(openTrades.map(t => t.pair))].join(',');
    try { const r = await fetch(`/api/prices?symbols=${symbols}`); const data = await r.json(); const map = {}; data.forEach(p => { map[p.symbol] = +p.price; }); setPrices(map); } catch (e) { console.error(e); }
  }, [openTrades]);

  const fetchCurrentPrice = useCallback(async () => {
    try { const r = await fetch(`/api/price?symbol=${pair}`); const d = await r.json(); if (d.price) setEntryPrice(d.price); } catch (e) { console.error(e); }
  }, [pair]);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);
  useEffect(() => { fetchCurrentPrice(); }, [fetchCurrentPrice]);
  useEffect(() => { fetchPrices(); const iv = setInterval(fetchPrices, 10000); return () => clearInterval(iv); }, [fetchPrices]);

  const handleSubmit = async () => {
    if (!quantity || !entryPrice) return;
    await fetch('/api/trades', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pair, direction, quantity: +quantity, entry_price: +entryPrice, tp: tp ? +tp : null, sl: sl ? +sl : null }) });
    setQuantity(''); setTp(''); setSl(''); fetchTrades();
  };

  const handleClose = async (id) => {
    await fetch(`/api/trades/${id}/close`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); fetchTrades();
  };

  const calcPnl = (trade) => {
    const cp = prices[trade.pair];
    if (!cp) return null;
    return trade.direction === 'long' ? (cp - trade.entry_price) * trade.quantity : (trade.entry_price - cp) * trade.quantity;
  };

  return (
    <div>
      <h2 style={{ color: theme.text, fontSize: 20, marginBottom: 16 }}>📋 {t('trades')}</h2>

      {/* Stats */}
      <div style={styles.grid}>
        {[
          { label: t('totalPnl'), value: `$${stats.totalPnl?.toFixed(2) || '0.00'}`, color: stats.totalPnl >= 0 ? theme.green : theme.red },
          { label: t('winRate'), value: `${stats.winRate?.toFixed(1) || '0'}%`, color: theme.accent },
          { label: t('avgPnl'), value: `$${stats.avgPnl?.toFixed(2) || '0.00'}`, color: stats.avgPnl >= 0 ? theme.green : theme.red },
          { label: t('bestTrade'), value: `$${stats.best?.toFixed(2) || '0.00'}`, color: theme.green },
          { label: t('worstTrade'), value: `$${stats.worst?.toFixed(2) || '0.00'}`, color: theme.red },
        ].map((s, i) => (
          <motion.div key={i} style={styles.card} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Open Trade Form */}
      <motion.div style={styles.card} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h3 style={{ color: theme.text, fontSize: 16, marginBottom: 16 }}>➕ {t('openTrade')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4, display: 'block' }}>{t('pair')}</label>
            <select style={{ ...styles.selStyle, width: '100%' }} value={pair} onChange={e => setPair(e.target.value)}>
              {PAIRS.map(p => <option key={p} value={p}>{p.replace('USDT', '/USDT')}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4, display: 'block' }}>{t('direction')}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <motion.button style={styles.dirBtn(direction === 'long', theme.green)} onClick={() => setDirection('long')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>{t('long')}</motion.button>
              <motion.button style={styles.dirBtn(direction === 'short', theme.red)} onClick={() => setDirection('short')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>{t('short')}</motion.button>
            </div>
          </div>
          <div>
            <label style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4, display: 'block' }}>{t('quantity')}</label>
            <input style={styles.inputStyle} type="number" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0.01" />
          </div>
          <div>
            <label style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4, display: 'block' }}>{t('entryPrice')}</label>
            <input style={styles.inputStyle} type="number" value={entryPrice} onChange={e => setEntryPrice(e.target.value)} />
          </div>
          <div>
            <label style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4, display: 'block' }}>{t('takeProfit')}</label>
            <input style={styles.inputStyle} type="number" value={tp} onChange={e => setTp(e.target.value)} placeholder={t('takeProfit')} />
          </div>
          <div>
            <label style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4, display: 'block' }}>{t('stopLoss')}</label>
            <input style={styles.inputStyle} type="number" value={sl} onChange={e => setSl(e.target.value)} placeholder={t('stopLoss')} />
          </div>
        </div>
        <motion.button style={{ ...styles.btnPrimary, marginTop: 16 }} onClick={handleSubmit}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>{t('openTrade')}</motion.button>
      </motion.div>

      {/* Open Trades Table */}
      <motion.div style={styles.card} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <h3 style={{ color: theme.text, fontSize: 16, marginBottom: 12 }}>📈 {t('openTrades')} ({openTrades.length})</h3>
        {openTrades.length === 0 ? (
          <div style={{ color: theme.textMuted, textAlign: 'center', padding: 20 }}>{t('noOpenTrades')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{[t('pair'), t('direction'), t('quantity'), t('entryPrice'), t('takeProfit'), t('stopLoss'), t('currentPrice'), t('unrealizedPnl'), ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: theme.textMuted, fontSize: 11, borderBottom: '1px solid ' + theme.tableBorder, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {openTrades.map(trade => {
                  const pnl = calcPnl(trade);
                  const cp = prices[trade.pair];
                  return (
                    <tr key={trade.id}>
                      <td style={{ padding: '10px', fontWeight: 600, color: theme.text }}>{trade.pair.replace('USDT', '')}<span style={{ color: theme.textMuted }}>/USDT</span></td>
                      <td style={{ padding: '10px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: trade.direction === 'long' ? theme.greenBg : theme.redBg, color: trade.direction === 'long' ? theme.green : theme.red }}>
                          {trade.direction.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px', color: theme.textSecondary }}>{trade.quantity}</td>
                      <td style={{ padding: '10px', color: theme.textSecondary }}>${trade.entry_price}</td>
                      <td style={{ padding: '10px', color: theme.green }}>{trade.tp ? `$${trade.tp}` : '—'}</td>
                      <td style={{ padding: '10px', color: theme.red }}>{trade.sl ? `$${trade.sl}` : '—'}</td>
                      <td style={{ padding: '10px', color: theme.text }}>{cp ? `$${cp.toLocaleString(undefined, { maximumFractionDigits: 4 })}` : '...'}</td>
                      <td style={{ padding: '10px', fontWeight: 700, color: pnl !== null ? (pnl >= 0 ? theme.green : theme.red) : theme.textMuted }}>
                        {pnl !== null ? `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}` : '...'}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <motion.button style={styles.btnDanger} onClick={() => handleClose(trade.id)}
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>{t('closeTrade')}</motion.button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Closed Trades Table */}
      <motion.div style={styles.card} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h3 style={{ color: theme.text, fontSize: 16, marginBottom: 12 }}>📊 {t('closedTrades')} ({closedTrades.length})</h3>
        {closedTrades.length === 0 ? (
          <div style={{ color: theme.textMuted, textAlign: 'center', padding: 20 }}>{t('noClosedTrades')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{[t('pair'), t('direction'), t('quantity'), t('entryPrice'), t('closePrice'), t('pnl'), t('closedAt')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: theme.textMuted, fontSize: 11, borderBottom: '1px solid ' + theme.tableBorder, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {closedTrades.slice(0, 20).map(trade => (
                  <tr key={trade.id}>
                    <td style={{ padding: '10px', fontWeight: 600, color: theme.text }}>{trade.pair.replace('USDT', '')}<span style={{ color: theme.textMuted }}>/USDT</span></td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: trade.direction === 'long' ? theme.greenBg : theme.redBg, color: trade.direction === 'long' ? theme.green : theme.red }}>
                        {trade.direction.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: theme.textSecondary }}>{trade.quantity}</td>
                    <td style={{ padding: '10px', color: theme.textSecondary }}>${trade.entry_price}</td>
                    <td style={{ padding: '10px', color: theme.textSecondary }}>${trade.close_price}</td>
                    <td style={{ padding: '10px', fontWeight: 700, color: (trade.pnl || 0) >= 0 ? theme.green : theme.red }}>
                      {(trade.pnl || 0) >= 0 ? '+' : ''}${(trade.pnl || 0).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px', color: theme.textSecondary, fontSize: 12 }}>{trade.closed_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
