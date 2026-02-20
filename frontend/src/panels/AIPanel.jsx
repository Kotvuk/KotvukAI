import React, { useEffect, useState } from 'react';
import { useLang } from '../LangContext';

const card = { background: '#12121a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 };
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 };
const statVal = { fontSize: 28, fontWeight: 700, color: '#fff' };
const statLabel = { fontSize: 13, color: '#666', marginTop: 4 };
const badge = (c) => ({ display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: c === 'green' ? 'rgba(34,197,94,0.15)' : c === 'red' ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)', color: c === 'green' ? '#22c55e' : c === 'red' ? '#ef4444' : '#eab308' });

const modalSection = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: 16, marginBottom: 12 };
const bullishBg = { background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.15)' };
const bearishBg = { background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' };

function fngColor(v) { return v <= 25 ? '#ef4444' : v <= 45 ? '#f97316' : v <= 55 ? '#eab308' : v <= 75 ? '#84cc16' : '#22c55e'; }
function fngLabelKey(v) { return v <= 25 ? 'extremeFear' : v <= 45 ? 'fear' : v <= 55 ? 'neutral' : v <= 75 ? 'greed' : 'extremeGreed'; }

const btnStyle = { background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' };

function confidenceBadge(conf) {
  if (conf === null || conf === undefined) return '—';
  const c = conf > 70 ? 'green' : conf >= 50 ? 'yellow' : 'red';
  return <span style={badge(c)}>{conf}%</span>;
}

function coinScoreCircle(score) {
  if (!score) return '—';
  const color = score >= 7 ? '#22c55e' : score >= 4 ? '#eab308' : '#ef4444';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: `${color}22`, color, fontSize: 13, fontWeight: 700, border: `2px solid ${color}` }}>
      {score}
    </span>
  );
}

function StarRating({ score }) {
  if (!score) return <span style={{ color: '#666' }}>—</span>;
  const stars = [];
  for (let i = 1; i <= 10; i++) {
    stars.push(
      <span key={i} style={{ color: i <= score ? '#eab308' : '#333', fontSize: 16 }}>
        {i <= score ? '★' : '☆'}
      </span>
    );
  }
  return <span>{stars}</span>;
}

function ProgressBar({ value, max, color = '#3b82f6' }) {
  const percentage = (value / max) * 100;
  return (
    <div style={{ background: '#1a1a2e', borderRadius: 8, height: 8, overflow: 'hidden' }}>
      <div style={{ background: color, height: '100%', width: `${percentage}%`, borderRadius: 8, transition: 'width 0.3s' }} />
    </div>
  );
}

function RSIGauge({ value, size = 60 }) {
  const angle = (value / 100) * 180 - 90; // -90 to 90 degrees
  const color = value > 70 ? '#ef4444' : value < 30 ? '#22c55e' : '#eab308';
  return (
    <div style={{ position: 'relative', width: size, height: size / 2, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: size, height: size / 2, borderRadius: `${size}px ${size}px 0 0`, border: `3px solid #333`, borderBottom: 'none', position: 'relative' }}>
        <div 
          style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transformOrigin: '0 0', 
            transform: `translate(-50%, -100%) rotate(${angle}deg)`, 
            width: 2, 
            height: size / 2 - 6, 
            background: color, 
            borderRadius: 2 
          }} 
        />
      </div>
      <div style={{ position: 'absolute', bottom: 0, fontSize: 10, color, fontWeight: 600 }}>{value?.toFixed(1) || '—'}</div>
    </div>
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
  const [usage, setUsage] = useState({ used: 0, limit: 5, remaining: 5, plan: 'Free' });
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [watchlist, setWatchlist] = useState(new Set());

  useEffect(() => {
    fetch('/api/fng').then(r => r.json()).then(d => setFng(d.data?.[0])).catch(() => {});
    fetch('/api/ticker24h').then(r => r.json()).then(d => setTickers(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/signals/history').then(r => r.json()).then(d => setHistory(Array.isArray(d) ? d : [])).catch(() => {});
    fetchUsage();
    fetchWatchlist();
  }, []);

  const fetchWatchlist = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      
      const r = await fetch('/api/watchlist', { headers });
      const data = await r.json();
      const pairs = new Set(Array.isArray(data) ? data.map(item => item.pair) : []);
      setWatchlist(pairs);
    } catch (e) {
      console.error('Failed to fetch watchlist:', e);
    }
  };

  const fetchUsage = async () => {
    try {
      const r = await fetch('/api/ai/usage');
      const data = await r.json();
      setUsage(data);
    } catch (e) {
      console.error('Failed to fetch usage:', e);
    }
  };

  const requestAnalysis = async (ticker) => {
    // Check usage limit first
    if (usage.remaining <= 0 && usage.limit !== -1) {
      setShowLimitModal(true);
      return;
    }

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

      if (r.status === 429) {
        const errorData = await r.json();
        setShowLimitModal(true);
        setUsage(prev => ({ ...prev, used: errorData.used || prev.used, remaining: 0 }));
        setLoading(p => ({ ...p, [sym]: false }));
        return;
      }

      const data = await r.json();
      setAnalyses(p => ({ ...p, [sym]: data.analysis || data.error || 'Ошибка' }));
      setAnalysisData(p => ({ ...p, [sym]: { 
        confidence: data.confidence, 
        coinScore: data.coinScore, 
        direction: data.direction,
        entryPrice: data.entryPrice,
        tpPrice: data.tpPrice,
        slPrice: data.slPrice,
        timeframes: data.timeframes || {}
      } }));
      
      // Update usage after successful analysis
      fetchUsage();
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

  const parseOverallTrend = (text) => {
    if (!text) return 'Neutral';
    const upper = text.toUpperCase();
    if (upper.includes('BULLISH') || upper.includes('БЫЧИЙ')) return 'Bullish';
    if (upper.includes('BEARISH') || upper.includes('МЕДВЕЖИЙ')) return 'Bearish';
    return 'Neutral';
  };

  const parseTradingSignal = (text) => {
    if (!text) return {};
    const entryMatch = text.match(/(?:ENTRY|ВХОД)[:\s]*\$?([\d,.]+)/i);
    const tpMatch = text.match(/(?:TP|TAKE\s*PROFIT|ТЕЙК)[:\s]*\$?([\d,.]+)/i);
    const slMatch = text.match(/(?:SL|STOP\s*LOSS|СТОП)[:\s]*\$?([\d,.]+)/i);
    
    return {
      entry: entryMatch ? entryMatch[1].replace(',', '') : null,
      tp: tpMatch ? tpMatch[1].replace(',', '') : null,
      sl: slMatch ? slMatch[1].replace(',', '') : null
    };
  };

  const formatAnalysisMarkdown = (text) => {
    if (!text) return null;
    
    // Split into sections
    const sections = text.split(/(?=##\s)/g).filter(Boolean);
    
    return sections.map((section, i) => {
      const lines = section.trim().split('\n');
      const title = lines[0].replace(/^#+\s*/, '');
      const body = lines.slice(1).join('\n').trim();
      
      return (
        <div key={i} style={modalSection}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#3b82f6', marginBottom: 8 }}>{title}</h3>
          <div style={{ fontSize: 14, color: '#ccc', lineHeight: 1.6 }}>
            {formatTextWithMarkdown(body)}
          </div>
        </div>
      );
    });
  };

  const formatTextWithMarkdown = (text) => {
    // Handle bold text
    const parts = text.split(/\*\*(.*?)\*\*/g);
    const elements = [];
    
    parts.forEach((part, i) => {
      if (i % 2 === 1) {
        elements.push(<strong key={i} style={{ color: '#fff' }}>{part}</strong>);
      } else {
        // Handle line breaks and lists
        const lines = part.split('\n');
        lines.forEach((line, j) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
            elements.push(
              <div key={`${i}-${j}`} style={{ paddingLeft: 16, marginBottom: 4 }}>
                • {trimmed.slice(2)}
              </div>
            );
          } else if (/^\d+\.\s/.test(trimmed)) {
            elements.push(
              <div key={`${i}-${j}`} style={{ paddingLeft: 16, marginBottom: 4 }}>
                {trimmed}
              </div>
            );
          } else if (trimmed) {
            elements.push(<span key={`${i}-${j}`}>{trimmed}</span>);
          }
          
          if (j < lines.length - 1) {
            elements.push(<br key={`${i}-${j}-br`} />);
          }
        });
      }
    });
    
    return elements;
  };

  const totalMcap = tickers.reduce((s, tk) => s + (+tk.lastPrice) * (+tk.volume), 0);
  const analyzedCount = Object.keys(analyses).length;

  const resultBadge = (result) => {
    if (result === 'tp_hit') return <span style={badge('green')}>✅ TP</span>;
    if (result === 'sl_hit') return <span style={badge('red')}>❌ SL</span>;
    if (result === 'timeout') return <span style={badge('yellow')}>⏰</span>;
    return <span style={badge('yellow')}>⏳</span>;
  };

  const renderTimeframeAnalysis = (symbol, timeframes) => {
    if (!timeframes) return null;
    
    const tfOrder = ['5m', '15m', '1h', '4h', '1d', '1w'];
    
    return tfOrder.map(tf => {
      const data = timeframes[tf];
      if (!data) return null;
      
      const isBullish = data.trend === 'bullish';
      const bgStyle = isBullish ? { ...modalSection, ...bullishBg } : { ...modalSection, ...bearishBg };
      
      return (
        <div key={tf} style={bgStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{tf.toUpperCase()}</h4>
            <span style={{ fontSize: 20 }}>
              {data.trend === 'bullish' ? '↗' : data.trend === 'bearish' ? '↘' : '→'}
            </span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13 }}>
            <div>
              <span style={{ color: '#888' }}>RSI: </span>
              <span style={{ color: '#fff' }}>{data.rsi || '—'}</span>
            </div>
            <div>
              <span style={{ color: '#888' }}>MACD: </span>
              <span style={{ color: data.macd_signal === 'buy' ? '#22c55e' : data.macd_signal === 'sell' ? '#ef4444' : '#888' }}>
                {data.macd_signal || '—'}
              </span>
            </div>
            <div>
              <span style={{ color: '#888' }}>EMA: </span>
              <span style={{ color: data.ema_status === 'bullish' ? '#22c55e' : data.ema_status === 'bearish' ? '#ef4444' : '#888' }}>
                {data.ema_status || '—'}
              </span>
            </div>
            <div>
              <span style={{ color: '#888' }}>Signal: </span>
              <span style={{ color: isBullish ? '#22c55e' : '#ef4444' }}>{data.trend || '—'}</span>
            </div>
          </div>
        </div>
      );
    }).filter(Boolean);
  };

  const renderEnhancedModal = () => {
    if (!modal) return null;
    
    const { symbol, analysis } = modal;
    const ticker = tickers.find(t => t.symbol === symbol);
    const ad = analysisData[symbol] || {};
    
    const overallTrend = parseOverallTrend(analysis);
    const tradingSignal = parseTradingSignal(analysis);
    const signalType = parseSignalType(analysis);
    
    return (
      <div 
        style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0,0,0,0.8)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000, 
          padding: 20 
        }} 
        onClick={() => setModal(null)}
      >
        <div 
          style={{ 
            ...card, 
            maxWidth: 900, 
            width: '100%', 
            maxHeight: '90vh', 
            overflow: 'auto',
            margin: 0
          }} 
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <h2 style={{ color: '#fff', fontSize: 22, marginBottom: 4 }}>{symbol}</h2>
              {ticker && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ color: '#ccc', fontSize: 18 }}>${(+ticker.lastPrice).toLocaleString()}</span>
                  <span style={badge(+ticker.priceChangePercent > 0 ? 'green' : 'red')}>
                    {(+ticker.priceChangePercent).toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            <button 
              onClick={() => setModal(null)} 
              style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          {/* Overall Analysis */}
          <div style={{ ...modalSection, marginBottom: 20 }}>
            <h3 style={{ color: '#fff', fontSize: 18, marginBottom: 16 }}>📊 Overall Analysis</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Overall Trend</div>
                <span style={badge(overallTrend === 'Bullish' ? 'green' : overallTrend === 'Bearish' ? 'red' : 'yellow')}>
                  {overallTrend}
                </span>
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Confidence</div>
                <div style={{ marginBottom: 4 }}>{confidenceBadge(ad.confidence)}</div>
                {ad.confidence && (
                  <ProgressBar 
                    value={ad.confidence} 
                    max={100} 
                    color={ad.confidence > 70 ? '#22c55e' : ad.confidence >= 50 ? '#eab308' : '#ef4444'} 
                  />
                )}
              </div>
              
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Coin Score</div>
                <div>{coinScoreCircle(ad.coinScore)}</div>
                <StarRating score={ad.coinScore} />
              </div>
            </div>
          </div>

          {/* Timeframe Analysis */}
          {ad.timeframes && Object.keys(ad.timeframes).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 18, marginBottom: 16 }}>📈 Multi-Timeframe Analysis</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                {renderTimeframeAnalysis(symbol, ad.timeframes)}
              </div>
            </div>
          )}

          {/* Trading Signal */}
          {signalType && (
            <div style={{ ...modalSection, marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 18, marginBottom: 16 }}>🎯 Trading Signal</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <div style={{ textAlign: 'center', padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Direction</div>
                  <span style={badge(signalType === 'LONG' ? 'green' : signalType === 'SHORT' ? 'red' : 'yellow')}>
                    {signalType}
                  </span>
                </div>
                
                {tradingSignal.entry && (
                  <div style={{ textAlign: 'center', padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Entry</div>
                    <div style={{ color: '#fff', fontWeight: 600 }}>${tradingSignal.entry}</div>
                  </div>
                )}
                
                {tradingSignal.tp && (
                  <div style={{ textAlign: 'center', padding: 12, background: 'rgba(34,197,94,0.05)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.15)' }}>
                    <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 4 }}>Take Profit</div>
                    <div style={{ color: '#22c55e', fontWeight: 600 }}>${tradingSignal.tp}</div>
                  </div>
                )}
                
                {tradingSignal.sl && (
                  <div style={{ textAlign: 'center', padding: 12, background: 'rgba(239,68,68,0.05)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.15)' }}>
                    <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 4 }}>Stop Loss</div>
                    <div style={{ color: '#ef4444', fontWeight: 600 }}>${tradingSignal.sl}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Detailed Analysis */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ color: '#fff', fontSize: 18, marginBottom: 16 }}>📖 Detailed Analysis</h3>
            {formatAnalysisMarkdown(analysis)}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button 
              onClick={() => setModal(null)} 
              style={{ 
                background: '#3b82f6', 
                color: '#fff', 
                border: 'none', 
                padding: '10px 24px', 
                borderRadius: 8, 
                cursor: 'pointer', 
                fontWeight: 600, 
                fontSize: 14 
              }}
            >
              {t('close')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Usage Counter */}
      <div style={{ ...card, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: '#fff', fontSize: 18, marginBottom: 4 }}>🤖 AI Аналитика</h2>
          <div style={{ fontSize: 13, color: '#888' }}>
            {usage.limit === -1 
              ? 'Безлимитные анализы' 
              : `AI анализов осталось: ${usage.remaining}/${usage.limit}`
            }
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Текущий план</div>
          <span style={badge(usage.plan === 'Premium' ? 'green' : usage.plan === 'Pro' ? 'blue' : 'yellow')}>
            {usage.plan}
          </span>
        </div>
      </div>

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
                  <td style={{ padding: '10px 12px' }}>{analyses[tk.symbol] && ad ? coinScoreCircle(ad.coinScore) : <span style={{ color: '#666' }}>—</span>}</td>
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
                        {analyses[tk.symbol] && ad ? confidenceBadge(ad.confidence) : <span style={{ color: '#666' }}>—</span>}
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

      {/* Enhanced Analysis Modal */}
      {renderEnhancedModal()}

      {/* Limit Reached Modal */}
      {showLimitModal && (
        <div 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.8)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1001, 
            padding: 20 
          }} 
          onClick={() => setShowLimitModal(false)}
        >
          <div 
            style={{ 
              ...card, 
              maxWidth: 400, 
              width: '100%', 
              textAlign: 'center',
              margin: 0
            }} 
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
            <h3 style={{ color: '#fff', fontSize: 20, marginBottom: 12 }}>Лимит AI анализов исчерпан</h3>
            
            <div style={{ ...modalSection, textAlign: 'left', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#888' }}>Использовано:</span>
                <span style={{ color: '#fff' }}>{usage.used}/{usage.limit}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#888' }}>Текущий план:</span>
                <span style={badge(usage.plan === 'Premium' ? 'green' : usage.plan === 'Pro' ? 'blue' : 'yellow')}>
                  {usage.plan}
                </span>
              </div>
            </div>

            <p style={{ color: '#ccc', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              {usage.plan === 'Free' 
                ? 'Перейдите на Pro для 50 анализов в день или Premium для безлимитного доступа.'
                : `Перейдите на Premium для безлимитного доступа к AI анализам.`
              }
            </p>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button 
                onClick={() => setShowLimitModal(false)} 
                style={{ 
                  background: 'rgba(255,255,255,0.1)', 
                  color: '#ccc', 
                  border: 'none', 
                  padding: '10px 20px', 
                  borderRadius: 8, 
                  cursor: 'pointer', 
                  fontSize: 14 
                }}
              >
                Закрыть
              </button>
              <button 
                onClick={() => {
                  setShowLimitModal(false);
                  // TODO: Navigate to settings/pricing
                }} 
                style={{ 
                  background: '#3b82f6', 
                  color: '#fff', 
                  border: 'none', 
                  padding: '10px 20px', 
                  borderRadius: 8, 
                  cursor: 'pointer', 
                  fontWeight: 600, 
                  fontSize: 14 
                }}
              >
                Улучшить план
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
