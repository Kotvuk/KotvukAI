import React, { useState, useEffect, useCallback } from 'react';
import { useLang } from '../LangContext';

const card = { background: '#12121a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 };
const selStyle = { background: '#1a1a2e', color: '#e0e0e0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none' };

const PAIRS = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','SOLUSDT'];

export default function WhalePanel() {
  const { t } = useLang();
  const [pair, setPair] = useState('BTCUSDT');
  const [orderBook, setOrderBook] = useState(null);
  const [whaleTrades, setWhaleTrades] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [obR, trR] = await Promise.all([
        fetch(`/api/whale/orderbook?symbol=${pair}`),
        fetch(`/api/whale/trades?symbol=${pair}`)
      ]);
      const ob = await obR.json();
      const tr = await trR.json();
      setOrderBook(ob);
      setWhaleTrades(Array.isArray(tr) ? tr : []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [pair]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, [fetchData]);

  // Compute buy/sell stats from order book
  const buyTotal = orderBook?.bids?.reduce((s, b) => s + (+b[0]) * (+b[1]), 0) || 0;
  const sellTotal = orderBook?.asks?.reduce((s, a) => s + (+a[0]) * (+a[1]), 0) || 0;
  const totalOB = buyTotal + sellTotal || 1;
  const buyPct = (buyTotal / totalOB * 100).toFixed(1);
  const sellPct = (sellTotal / totalOB * 100).toFixed(1);

  // Whale trade stats
  const whaleBuys = whaleTrades.filter(t => !t.m); // m=true means seller is maker (sell)
  const whaleSells = whaleTrades.filter(t => t.m);
  const whaleBuyVol = whaleBuys.reduce((s, t) => s + (t.usdValue || 0), 0);
  const whaleSellVol = whaleSells.reduce((s, t) => s + (t.usdValue || 0), 0);

  // Top order walls
  const topBids = orderBook?.bids?.slice(0, 10).map(b => ({ price: +b[0], qty: +b[1], usd: (+b[0]) * (+b[1]) })) || [];
  const topAsks = orderBook?.asks?.slice(0, 10).map(a => ({ price: +a[0], qty: +a[1], usd: (+a[0]) * (+a[1]) })) || [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <h2 style={{ color: '#fff', fontSize: 20, margin: 0 }}>🐋 {t('whaleTitle')}</h2>
        <select style={selStyle} value={pair} onChange={e => setPair(e.target.value)}>
          {PAIRS.map(p => <option key={p} value={p}>{p.replace('USDT', '/USDT')}</option>)}
        </select>
        {loading && <span style={{ color: '#3b82f6', fontSize: 13 }}>⏳</span>}
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#888' }}>{t('buyVolume')}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>${(buyTotal / 1e6).toFixed(2)}M</div>
          <div style={{ fontSize: 13, color: '#22c55e' }}>{buyPct}%</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#888' }}>{t('sellVolume')}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>${(sellTotal / 1e6).toFixed(2)}M</div>
          <div style={{ fontSize: 13, color: '#ef4444' }}>{sellPct}%</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#888' }}>{t('ratio')}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: buyTotal > sellTotal ? '#22c55e' : '#ef4444' }}>
            {buyTotal > sellTotal ? '🟢' : '🔴'} {(buyTotal / (sellTotal || 1)).toFixed(2)}
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, color: '#888' }}>{t('largeTrades')}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#8b5cf6' }}>{whaleTrades.length}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{'>'} $100k</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Buy Walls */}
        <div style={card}>
          <h3 style={{ color: '#22c55e', fontSize: 15, marginBottom: 12 }}>🟢 {t('buyWalls')}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#666', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{t('price')}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#666', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{t('amount')}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#666', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{t('total')}</th>
              </tr>
            </thead>
            <tbody>
              {topBids.map((b, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 8px', color: '#22c55e', fontSize: 13 }}>${b.price.toLocaleString()}</td>
                  <td style={{ padding: '6px 8px', color: '#ccc', fontSize: 13, textAlign: 'right' }}>{b.qty.toFixed(4)}</td>
                  <td style={{ padding: '6px 8px', color: '#888', fontSize: 13, textAlign: 'right' }}>${(b.usd / 1000).toFixed(1)}k</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Sell Walls */}
        <div style={card}>
          <h3 style={{ color: '#ef4444', fontSize: 15, marginBottom: 12 }}>🔴 {t('sellWalls')}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#666', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{t('price')}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#666', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{t('amount')}</th>
                <th style={{ textAlign: 'right', padding: '6px 8px', color: '#666', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{t('total')}</th>
              </tr>
            </thead>
            <tbody>
              {topAsks.map((a, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 8px', color: '#ef4444', fontSize: 13 }}>${a.price.toLocaleString()}</td>
                  <td style={{ padding: '6px 8px', color: '#ccc', fontSize: 13, textAlign: 'right' }}>{a.qty.toFixed(4)}</td>
                  <td style={{ padding: '6px 8px', color: '#888', fontSize: 13, textAlign: 'right' }}>${(a.usd / 1000).toFixed(1)}k</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Whale Feed */}
      <div style={card}>
        <h3 style={{ color: '#fff', fontSize: 15, marginBottom: 12 }}>🐋 {t('whaleFeed')}</h3>
        {whaleTrades.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 20 }}>{t('noWhaleTrades')}</div>
        ) : (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[t('side'), t('amount'), t('price'), t('total')].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: '#666', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {whaleTrades.slice(0, 50).map((trade, i) => {
                  const isBuy = !trade.m;
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: isBuy ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: isBuy ? '#22c55e' : '#ef4444' }}>
                          {isBuy ? t('buy') : t('sell')}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#ccc', fontSize: 13 }}>{(+trade.q).toFixed(4)}</td>
                      <td style={{ padding: '8px 10px', color: '#ccc', fontSize: 13 }}>${(+trade.p).toLocaleString()}</td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: isBuy ? '#22c55e' : '#ef4444', fontSize: 13 }}>
                        ${(trade.usdValue / 1000).toFixed(1)}k
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
