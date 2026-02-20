import React, { useEffect, useState } from 'react';
import { useLang } from '../LangContext';

const card = { background: '#12121a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 };
const statVal = { fontSize: 28, fontWeight: 700, color: '#fff' };
const statLabel = { fontSize: 13, color: '#666', marginTop: 4 };
const badge = (c) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: c === 'green' ? 'rgba(34,197,94,0.15)' : c === 'red' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)', color: c === 'green' ? '#22c55e' : c === 'red' ? '#ef4444' : '#eab308' });

function fngColor(v) { return v <= 25 ? '#ef4444' : v <= 45 ? '#f97316' : v <= 55 ? '#eab308' : v <= 75 ? '#84cc16' : '#22c55e'; }
function fngLabelKey(v) { return v <= 25 ? 'extremeFear' : v <= 45 ? 'fear' : v <= 55 ? 'neutral' : v <= 75 ? 'greed' : 'extremeGreed'; }

const btnStyle = { background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' };

function confidenceBadge(conf) {
  if (conf === null || conf === undefined) return null;
  const c = conf > 70 ? 'green' : conf >= 50 ? 'yellow' : 'red';
  return <span style={badge(c)}>{conf}%</span>;
}

function coinScoreCircle(score) {
  if (!score) return null;
  const color = score >= 7 ? '#22c55e' : score >= 4 ? '#eab308' : '#ef4444';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: `${color}22`, color, fontSize: 13, fontWeight: 700, border: `2px solid ${color}` }}>
      {score}
    </span>
  );
}

export default function AIPanel() {
  const { t } = useLang();
  const [fng, setFng] = useState(null);
  const [tickers, setTickers] = useState([]);
  const [analyses, setAnalyses] = useState({});
  const [analysisData, setAnalysisData] = useState({});
  const [loading, setLoading] = useState({});
  const [modal, setModal] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch('/api/fng').then(r => r.json()).then(d => setFng(d.data?.[0])).catch(() => {});
    fetch('/api/ticker24h').then(r => r.json()).then(d => setTickers(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/signals/history').then(r => r.json()).then(d => setHistory(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const requestAnalysis = async (ticker) => {
    const sym = ticker.symbol;
    setLoading(p => ({ ...p, [sym]: true }));
    try {
      const r = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: sym,
          price: +ticker.lastPrice,
          change24h: +ticker.priceChangePercent,
          high: +ticker.highPrice,
          low: +ticker.lowPrice,
          volume: +ticker.volume,
          fng: fng?.value || null,
          marketData: { weightedAvgPrice: ticker.weightedAvgPrice, quoteVolume: ticker.quoteVolume }
        })
      });
      const data = await r.json();
      setAnalyses(p => ({ ...p, [sym]: data.analysis || data.error || 'Ошибка' }));
      setAnalysisData(p => ({ ...p, [sym]: { confidence: data.confidence, coinScore: data.coinScore, direction: data.direction } }));
    } catch (e) {
      setAnalyses(p => ({ ...p, [sym]: 'Ошибка подключения к AI: ' + e.message }));
    }
    setLoading(p => ({ ...p, [sym]: false }));
  };

  const parseSignalType = (text) => {
    if (!text) return null;
    const upper = text.toUpperCase();
    if (upper.includes('LONG') && !upper.includes('SHORT')) return 'LONG';
    if (upper.includes('SHORT') && !upper.includes('LONG')) return 'SHORT';
    if (upper.includes('НЕЙТРАЛЬНО')) return 'НЕЙТРАЛЬНО';
    return null;
  };

  const formatAnalysis = (text) => {
    if (!text) return null;
    const sections = text.split(/(?=## |# )/).filter(Boolean);
    return sections.map((section, i) => {
      const lines = section.trim().split('\n');
      const title = lines[0].replace(/^#+\s*/, '');
      const body = lines.slice(1).join('\n').trim();
      return (
        <div key={i} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#3b82f6', marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {body.split(/\*\*(.*?)\*\*/g).map((part, j) =>
              j % 2 === 1 ? <strong key={j} style={{ color: '#fff' }}>{part}</strong> : part
            )}
          </div>
        </div>
      );
    });
  };

  const totalMcap = tickers.reduce((s, tk) => s + (+tk.lastPrice) * (+tk.volume), 0);
  const analyzedCount = Object.keys(analyses).length;

  const resultBadge = (result) => {
    if (result === 'tp_hit') return <span style={badge('green')}>✅ TP</span>;
    if (result === 'sl_hit') return <span style={badge('red')}>❌ SL</span>;
    if (result === 'timeout') return <span style={badge('yellow')}>⏰</span>;
    return <span style={badge('yellow')}>⏳</span>;
  };

  return (
    <div>
      <div style={grid}>
        <div style={card}>
          <div style={statLabel}>{t('fearGreed')}</div>
          {fng ? (
            <>
              <div style={{ ...statVal, color: fngColor(+fng.value) }}>{fng.value}</div>
              <div style={{ fontSize: 14, color: fngColor(+fng.value), fontWeight: 600 }}>{t(fngLabelKey(+fng.value))}</div>
            </>
          ) : <div style={{ color: '#666' }}>{t('loading')}</div>}
        </div>
        <div style={card}>
          <div style={statLabel}>{t('volume24h')}</div>
          <div style={statVal}>${(totalMcap / 1e9).toFixed(1)}B</div>
          <div style={{ fontSize: 12, color: '#666' }}>{t('usdtPairs')}</div>
        </div>
        <div style={card}>
          <div style={statLabel}>{t('aiAnalysesCount')}</div>
          <div style={statVal}>{analyzedCount}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{t('doneThisSession')}</div>
        </div>
      </div>

      <h2 style={{ color: '#fff', fontSize: 18, marginBottom: 12 }}>📡 {t('marketOverview')}</h2>
      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{[t('pair'), '⭐', t('price'), t('change24h'), t('high24h'), t('low24h'), t('volumeLabel'), t('aiAnalyze')].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#666', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {tickers.map(tk => {
              const ad = analysisData[tk.symbol];
              return (
                <tr key={tk.symbol}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{tk.symbol.replace('USDT', '')}<span style={{ color: '#666' }}>/USDT</span></td>
                  <td style={{ padding: '10px 12px' }}>{ad ? coinScoreCircle(ad.coinScore) : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>${(+tk.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td style={{ padding: '10px 12px' }}><span style={badge(+tk.priceChangePercent > 0 ? 'green' : 'red')}>{(+tk.priceChangePercent).toFixed(2)}%</span></td>
                  <td style={{ padding: '10px 12px', color: '#888' }}>${(+tk.highPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td style={{ padding: '10px 12px', color: '#888' }}>${(+tk.lowPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td style={{ padding: '10px 12px', color: '#888' }}>{(+tk.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {loading[tk.symbol] ? (
                      <span style={{ color: '#3b82f6', fontSize: 13 }}>⏳ {t('analyzing')}</span>
                    ) : analyses[tk.symbol] ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={() => setModal({ symbol: tk.symbol, analysis: analyses[tk.symbol] })} style={btnStyle}>{t('result')}</button>
                        {ad && confidenceBadge(ad.confidence)}
                      </div>
                    ) : (
                      <button onClick={() => requestAnalysis(tk)} style={btnStyle}>{t('aiAnalyze')}</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 style={{ color: '#fff', fontSize: 18, margin: '20px 0 12px' }}>🎯 {t('tradingSignals')}</h2>
      {Object.keys(analyses).length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
          <div style={{ color: '#888', fontSize: 15, marginBottom: 8 }}>{t('clickAI')}</div>
          <div style={{ color: '#555', fontSize: 13 }}>{t('eachAnalysis')}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 12 }}>
          {Object.entries(analyses).map(([sym, text]) => {
            const signalType = parseSignalType(text);
            const ad = analysisData[sym];
            return (
              <div key={sym} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{sym.replace('USDT', '')}/USDT</span>
                    {ad && coinScoreCircle(ad.coinScore)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {signalType && <span style={badge(signalType === 'LONG' ? 'green' : signalType === 'SHORT' ? 'red' : 'yellow')}>{signalType}</span>}
                    {ad && confidenceBadge(ad.confidence)}
                  </div>
                </div>
                <div style={{ maxHeight: 200, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {text.slice(0, 300)}...
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(transparent, #12121a)' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setModal({ symbol: sym, analysis: text })} style={btnStyle}>{t('more')}</button>
                  <button onClick={() => setModal({ symbol: sym, analysis: text, section: 'why' })} style={{ ...btnStyle, background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>💡 {t('why')}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Signal History */}
      <h2 style={{ color: '#fff', fontSize: 18, margin: '20px 0 12px' }}>📜 {t('signalHistory')}</h2>
      <div style={{ ...card, overflowX: 'auto' }}>
        {history.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 20 }}>{t('noSignalHistory')}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{[t('pair'), t('direction'), t('entry'), t('result'), t('accuracy'), t('aiReflectionLabel')].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#666', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {history.slice(0, 20).map(sig => (
                <tr key={sig.id}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{(sig.pair || '').replace('USDT', '')}<span style={{ color: '#666' }}>/USDT</span></td>
                  <td style={{ padding: '10px 12px' }}>
                    {sig.direction && <span style={badge(sig.direction === 'LONG' ? 'green' : 'red')}>{sig.direction}</span>}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#fff' }}>${sig.entry_price}</td>
                  <td style={{ padding: '10px 12px' }}>{resultBadge(sig.result)}</td>
                  <td style={{ padding: '10px 12px', color: '#888' }}>{sig.accuracy_score != null ? sig.accuracy_score + '%' : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#888', fontSize: 12, maxWidth: 300 }}>
                    {sig.ai_reflection ? sig.ai_reflection.slice(0, 120) + (sig.ai_reflection.length > 120 ? '...' : '') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setModal(null)}>
          <div style={{ ...card, maxWidth: 700, width: '100%', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#fff', fontSize: 18 }}>{t('aiAnalysisOf')}: {modal.symbol}</h3>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {formatAnalysis(modal.analysis)}
            <button onClick={() => setModal(null)} style={{ marginTop: 16, background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>{t('close')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
