import React, { useEffect, useState } from 'react';
import { useLang } from '../LangContext';

const card = { background: '#12121a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 };
const statVal = { fontSize: 28, fontWeight: 700, color: '#fff' };
const statLabel = { fontSize: 13, color: '#666', marginTop: 4 };

function fngColor(v) { return v <= 25 ? '#ef4444' : v <= 45 ? '#f97316' : v <= 55 ? '#eab308' : v <= 75 ? '#84cc16' : '#22c55e'; }
function fngLabelKey(v) { return v <= 25 ? 'extremeFear' : v <= 45 ? 'fear' : v <= 55 ? 'neutral' : v <= 75 ? 'greed' : 'extremeGreed'; }

export default function DashboardPanel() {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [rec, setRec] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/dashboard/recommendation').then(r => r.json())
    ]).then(([d, r]) => {
      setData(d);
      setRec(r.recommendation || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>{t('loading')}</div>;
  if (!data) return <div style={{ color: '#666', textAlign: 'center', padding: 40 }}>Error loading dashboard</div>;

  return (
    <div>
      <h2 style={{ color: '#fff', fontSize: 20, marginBottom: 16 }}>🏠 {t('dashboard')}</h2>

      {/* AI Recommendation */}
      {rec && (
        <div style={{ ...card, background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.1))', borderColor: 'rgba(59,130,246,0.3)' }}>
          <div style={{ fontSize: 13, color: '#3b82f6', marginBottom: 6, fontWeight: 600 }}>💡 {t('aiRecommendation')}</div>
          <div style={{ fontSize: 16, color: '#fff', fontWeight: 500 }}>{rec}</div>
        </div>
      )}

      {/* Stats Grid */}
      <div style={grid}>
        <div style={card}>
          <div style={statLabel}>{t('totalPnl')}</div>
          <div style={{ ...statVal, color: data.totalPnl >= 0 ? '#22c55e' : '#ef4444' }}>
            ${data.totalPnl?.toFixed(2) || '0.00'}
          </div>
        </div>
        <div style={card}>
          <div style={statLabel}>{t('signalAccuracy')}</div>
          <div style={statVal}>{data.signalAccuracy?.toFixed(1) || '0'}%</div>
          <div style={{ fontSize: 12, color: '#666' }}>{data.totalSignals || 0} {t('totalSignalsLabel')}</div>
        </div>
        <div style={card}>
          <div style={statLabel}>{t('fearGreed')}</div>
          {data.fngValue ? (
            <>
              <div style={{ ...statVal, color: fngColor(+data.fngValue) }}>{data.fngValue}</div>
              <div style={{ fontSize: 14, color: fngColor(+data.fngValue), fontWeight: 600 }}>{t(fngLabelKey(+data.fngValue))}</div>
            </>
          ) : <div style={{ color: '#666' }}>N/A</div>}
        </div>
        <div style={card}>
          <div style={statLabel}>{t('topMover')}</div>
          {data.topMover ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{data.topMover.symbol.replace('USDT', '')}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: data.topMover.change >= 0 ? '#22c55e' : '#ef4444' }}>
                {data.topMover.change >= 0 ? '+' : ''}{data.topMover.change.toFixed(2)}%
              </div>
            </>
          ) : <div style={{ color: '#666' }}>N/A</div>}
        </div>
      </div>

      {/* Best Signal Today */}
      <div style={card}>
        <h3 style={{ color: '#fff', fontSize: 16, marginBottom: 12 }}>🏆 {t('bestSignalToday')}</h3>
        {data.bestSignal ? (
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 18 }}>{data.bestSignal.pair?.replace('USDT', '')}/USDT</span>
            <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: data.bestSignal.direction === 'LONG' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: data.bestSignal.direction === 'LONG' ? '#22c55e' : '#ef4444' }}>
              {data.bestSignal.direction}
            </span>
            <span style={{ color: '#888' }}>@ ${data.bestSignal.entry_price}</span>
            <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>✅ TP Hit</span>
          </div>
        ) : (
          <div style={{ color: '#555', textAlign: 'center', padding: 10 }}>{t('noBestSignal')}</div>
        )}
      </div>
    </div>
  );
}
