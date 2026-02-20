import React, { useState, useEffect, useCallback } from 'react';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const card = { background: '#12121a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 };
const inputStyle = { background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', color: '#e0e0e0', fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box' };
const btnPrimary = { background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: "'Inter',sans-serif" };
const btnDanger = { background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: "'Inter',sans-serif" };

const POPULAR = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','AVAXUSDT','MATICUSDT','LINKUSDT','UNIUSDT','LTCUSDT','ATOMUSDT','NEARUSDT'];

export default function WatchlistPanel() {
  const { t } = useLang();
  const [watchlist, setWatchlist] = useState([]);
  const [tickerData, setTickerData] = useState({});
  const [search, setSearch] = useState('');
  const [allPairs, setAllPairs] = useState(POPULAR);

  const fetchWatchlist = useCallback(async () => {
    try {
      const r = await fetch('/api/watchlist');
      setWatchlist(await r.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchTickers = useCallback(async () => {
    if (watchlist.length === 0) { setTickerData({}); return; }
    try {
      const symbols = watchlist.map(w => w.pair);
      const promises = symbols.map(s => fetch(`/api/ticker24h/single?symbol=${s}`).then(r => r.json()));
      const results = await Promise.all(promises);
      const map = {};
      results.forEach(r => { if (r.symbol) map[r.symbol] = r; });
      setTickerData(map);
    } catch (e) { console.error(e); }
  }, [watchlist]);

  useEffect(() => {
    fetchWatchlist();
    fetch('/api/exchangeInfo').then(r => r.json()).then(d => { if (Array.isArray(d)) setAllPairs(d); }).catch(() => {});
  }, [fetchWatchlist]);

  useEffect(() => {
    fetchTickers();
    const iv = setInterval(fetchTickers, 10000);
    return () => clearInterval(iv);
  }, [fetchTickers]);

  const handleAdd = async (pair) => {
    await fetch('/api/watchlist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pair })
    });
    setSearch('');
    fetchWatchlist();
  };

  const handleRemove = async (id) => {
    await fetch(`/api/watchlist/${id}`, { method: 'DELETE' });
    fetchWatchlist();
  };

  const filtered = search.length >= 2
    ? allPairs.filter(p => p.toLowerCase().includes(search.toLowerCase()) && !watchlist.some(w => w.pair === p)).slice(0, 10)
    : [];

  const trendIndicator = (pct) => {
    const n = +pct;
    if (n > 5) return '🟢🟢🟢';
    if (n > 2) return '🟢🟢';
    if (n > 0) return '🟢';
    if (n > -2) return '🔴';
    if (n > -5) return '🔴🔴';
    return '🔴🔴🔴';
  };

  return (
    <div>
      <h2 style={{ color: '#fff', fontSize: 20, marginBottom: 16 }}>🏆 {t('watchlistTitle')}</h2>

      {/* Add Pair */}
      <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <input style={{ ...inputStyle, width: '100%' }} value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} />
          {filtered.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0 0 8px 8px', maxHeight: 200, overflowY: 'auto', zIndex: 10 }}>
              {filtered.map(p => (
                <div key={p} onClick={() => handleAdd(p)} style={{ padding: '8px 14px', cursor: 'pointer', color: '#e0e0e0', fontSize: 13, borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => e.target.style.background = 'rgba(59,130,246,0.1)'}
                  onMouseLeave={e => e.target.style.background = 'transparent'}>
                  {p.replace('USDT', '/USDT')}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {POPULAR.slice(0, 6).filter(p => !watchlist.some(w => w.pair === p)).map(p => (
            <button key={p} onClick={() => handleAdd(p)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 12px', color: '#a0a0b0', fontSize: 12, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>
              + {p.replace('USDT', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Watchlist Table */}
      <div style={card}>
        {watchlist.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 30 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            {t('noWatchlistItems')}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{[t('pair'), t('price'), t('change'), t('high24h'), t('low24h'), t('volume'), 'Trend', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#666', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {watchlist.map(w => {
                  const tk = tickerData[w.pair];
                  const changePct = tk ? +tk.priceChangePercent : 0;
                  return (
                    <tr key={w.id}>
                      <td style={{ padding: '10px', fontWeight: 600 }}>{w.pair.replace('USDT', '')}<span style={{ color: '#666' }}>/USDT</span></td>
                      <td style={{ padding: '10px', color: '#fff', fontWeight: 600 }}>{tk ? `$${(+tk.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}` : '...'}</td>
                      <td style={{ padding: '10px' }}>
                        {tk && <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: changePct >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: changePct >= 0 ? '#22c55e' : '#ef4444' }}>
                          {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                        </span>}
                      </td>
                      <td style={{ padding: '10px', color: '#888', fontSize: 13 }}>{tk ? `$${(+tk.highPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}` : '...'}</td>
                      <td style={{ padding: '10px', color: '#888', fontSize: 13 }}>{tk ? `$${(+tk.lowPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}` : '...'}</td>
                      <td style={{ padding: '10px', color: '#888', fontSize: 13 }}>{tk ? (+tk.volume).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '...'}</td>
                      <td style={{ padding: '10px', fontSize: 14 }}>{tk ? trendIndicator(tk.priceChangePercent) : ''}</td>
                      <td style={{ padding: '10px' }}>
                        <button style={btnDanger} onClick={() => handleRemove(w.id)}>{t('remove')}</button>
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
