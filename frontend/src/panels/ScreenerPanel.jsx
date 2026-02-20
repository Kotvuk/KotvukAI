import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLang } from '../LangContext';

const card = { background: '#12121a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 };
const inputStyle = { background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13, fontFamily: "'Inter',sans-serif", width: 120 };
const btnStyle = (active) => ({ background: active ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)', border: active ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 16px', color: active ? '#3b82f6' : '#a0a0b0', cursor: 'pointer', fontSize: 13, fontFamily: "'Inter',sans-serif" });

export default function ScreenerPanel() {
  const { t } = useLang();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ minPrice: '', maxPrice: '', minChange: '', maxChange: '', sortBy: 'volume' });
  const [preset, setPreset] = useState('all');

  const fetchData = useCallback(() => {
    fetch('/api/screener').then(r => r.json()).then(d => {
      setData(Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const applyPreset = (p) => {
    setPreset(p);
    if (p === 'gainers') setFilters({ minPrice: '', maxPrice: '', minChange: '2', maxChange: '', sortBy: 'change' });
    else if (p === 'losers') setFilters({ minPrice: '', maxPrice: '', minChange: '', maxChange: '-2', sortBy: 'change' });
    else if (p === 'volume') setFilters({ minPrice: '', maxPrice: '', minChange: '', maxChange: '', sortBy: 'volume' });
    else setFilters({ minPrice: '', maxPrice: '', minChange: '', maxChange: '', sortBy: 'volume' });
  };

  const filtered = useMemo(() => {
    let result = [...data];
    const { minPrice, maxPrice, minChange, maxChange, sortBy } = filters;
    if (minPrice) result = result.filter(t => +t.lastPrice >= +minPrice);
    if (maxPrice) result = result.filter(t => +t.lastPrice <= +maxPrice);
    if (minChange) result = result.filter(t => +t.priceChangePercent >= +minChange);
    if (maxChange) result = result.filter(t => +t.priceChangePercent <= +maxChange);
    if (sortBy === 'price') result.sort((a, b) => +b.lastPrice - +a.lastPrice);
    else if (sortBy === 'change') result.sort((a, b) => +b.priceChangePercent - +a.priceChangePercent);
    else result.sort((a, b) => +b.quoteVolume - +a.quoteVolume);
    return result;
  }, [data, filters]);

  if (loading) return <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>{t('loading')}</div>;

  return (
    <div>
      <h2 style={{ color: '#fff', fontSize: 20, marginBottom: 16 }}>🔍 {t('screenerTitle')}</h2>

      {/* Presets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button style={btnStyle(preset === 'all')} onClick={() => applyPreset('all')}>{t('allPairs')}</button>
        <button style={btnStyle(preset === 'gainers')} onClick={() => applyPreset('gainers')}>🚀 {t('topGainers')}</button>
        <button style={btnStyle(preset === 'losers')} onClick={() => applyPreset('losers')}>📉 {t('topLosers')}</button>
        <button style={btnStyle(preset === 'volume')} onClick={() => applyPreset('volume')}>📊 {t('highVolume')}</button>
      </div>

      {/* Filters */}
      <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 20px' }}>
        <span style={{ color: '#888', fontSize: 13 }}>{t('filters')}:</span>
        <input style={inputStyle} type="number" placeholder={t('minPrice')} value={filters.minPrice} onChange={e => { setFilters(f => ({ ...f, minPrice: e.target.value })); setPreset(''); }} />
        <input style={inputStyle} type="number" placeholder={t('maxPrice')} value={filters.maxPrice} onChange={e => { setFilters(f => ({ ...f, maxPrice: e.target.value })); setPreset(''); }} />
        <input style={inputStyle} type="number" placeholder={t('minChange')} value={filters.minChange} onChange={e => { setFilters(f => ({ ...f, minChange: e.target.value })); setPreset(''); }} />
        <input style={inputStyle} type="number" placeholder={t('maxChange')} value={filters.maxChange} onChange={e => { setFilters(f => ({ ...f, maxChange: e.target.value })); setPreset(''); }} />
        <select style={{ ...inputStyle, width: 140 }} value={filters.sortBy} onChange={e => { setFilters(f => ({ ...f, sortBy: e.target.value })); setPreset(''); }}>
          <option value="volume">{t('sortBy')}: {t('volumeLabel')}</option>
          <option value="price">{t('sortBy')}: {t('price')}</option>
          <option value="change">{t('sortBy')}: {t('change24h')}</option>
        </select>
        <button style={{ ...btnStyle(false), fontSize: 12 }} onClick={() => applyPreset('all')}>{t('resetFilters')}</button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>{t('noResults')}</div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {[t('pair'), t('price'), t('change24h'), t('high24h'), t('low24h'), t('volumeLabel')].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map(tk => {
                const pct = +tk.priceChangePercent;
                return (
                  <tr key={tk.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 16px', color: '#fff', fontWeight: 600, fontSize: 14 }}>{tk.symbol.replace('USDT', '')}/USDT</td>
                    <td style={{ padding: '10px 16px', color: '#e0e0e0', fontSize: 14 }}>${(+tk.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td style={{ padding: '10px 16px', color: pct >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600, fontSize: 14 }}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</td>
                    <td style={{ padding: '10px 16px', color: '#aaa', fontSize: 13 }}>${(+tk.highPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td style={{ padding: '10px 16px', color: '#aaa', fontSize: 13 }}>${(+tk.lowPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td style={{ padding: '10px 16px', color: '#aaa', fontSize: 13 }}>${(+tk.quoteVolume / 1e6).toFixed(1)}M</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
