import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

function fngColor(v) { return v <= 25 ? '#ef4444' : v <= 45 ? '#f97316' : v <= 55 ? '#eab308' : v <= 75 ? '#84cc16' : '#22c55e'; }
function fngLabelKey(v) { return v <= 25 ? 'extremeFear' : v <= 45 ? 'fear' : v <= 55 ? 'neutral' : v <= 75 ? 'greed' : 'extremeGreed'; }

function confidenceBadge(conf, theme) {
  if (conf === null || conf === undefined) return '—';
  const c = conf > 70 ? theme.green : conf >= 50 ? theme.yellow : theme.red;
  const bg = conf > 70 ? theme.greenBg : conf >= 50 ? theme.yellowBg : theme.redBg;
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: bg, color: c }}>{conf}%</span>;
}

function coinScoreCircle(score, theme) {
  if (!score) return '—';
  const color = score >= 7 ? theme.green : score >= 4 ? theme.yellow : theme.red;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: `${color}22`, color, fontSize: 13, fontWeight: 700, border: `2px solid ${color}` }}>
      {score}
    </span>
  );
}

function ProgressBar({ value, max, color = '#3b82f6', theme }) {
  return (
    <div style={{ background: theme.inputBg, borderRadius: 8, height: 8, overflow: 'hidden' }}>
      <motion.div style={{ background: color, height: '100%', borderRadius: 8 }}
        initial={{ width: 0 }} animate={{ width: `${(value / max) * 100}%` }} transition={{ duration: 0.5 }} />
    </div>
  );
}

export default function AIPanel() {
  const { t } = useLang();
  const { theme } = useTheme();
  const [fng, setFng] = useState(null);
  const [tickers, setTickers] = useState([]);
  const [analyses, setAnalyses] = useState({});
  const [analysisData, setAnalysisData] = useState({});
  const [loading, setLoading] = useState({});
  const [modal, setModal] = useState(null);
  const [history, setHistory] = useState([]);
  const [usage, setUsage] = useState({ used: 0, limit: 5, remaining: 5, plan: 'Free' });
  const [showLimitModal, setShowLimitModal] = useState(false);

  const card = { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 };
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 };
  const btnStyle = { background: theme.blueBg, color: theme.accent, border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' };
  const modalSection = { background: theme.hoverBg, border: '1px solid ' + theme.border, borderRadius: 10, padding: 16, marginBottom: 12 };
  const badge = (type) => ({
    display: 'inline-block', padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
    background: type === 'green' ? theme.greenBg : type === 'red' ? theme.redBg : theme.yellowBg,
    color: type === 'green' ? theme.green : type === 'red' ? theme.red : theme.yellow,
  });

  useEffect(() => {
    fetch('/api/fng').then(r => r.json()).then(d => setFng(d.data?.[0])).catch(() => {});
    fetch('/api/ticker24h').then(r => r.json()).then(d => setTickers(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/signals/history').then(r => r.json()).then(d => setHistory(Array.isArray(d) ? d : [])).catch(() => {});
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try { const r = await fetch('/api/ai/usage'); setUsage(await r.json()); } catch {}
  };

  const requestAnalysis = async (ticker) => {
    if (usage.remaining <= 0 && usage.limit !== -1) { setShowLimitModal(true); return; }
    const sym = ticker.symbol;
    setLoading(p => ({ ...p, [sym]: true }));
    try {
      const r = await fetch('/api/ai/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, price: +ticker.lastPrice, change24h: +ticker.priceChangePercent, high: +ticker.highPrice, low: +ticker.lowPrice, volume: +ticker.volume, fng: fng?.value || null, marketData: { weightedAvgPrice: ticker.weightedAvgPrice, quoteVolume: ticker.quoteVolume } })
      });
      if (r.status === 429) { setShowLimitModal(true); setLoading(p => ({ ...p, [sym]: false })); return; }
      const data = await r.json();
      setAnalyses(p => ({ ...p, [sym]: data.analysis || data.error || 'Error' }));
      setAnalysisData(p => ({ ...p, [sym]: { confidence: data.confidence, coinScore: data.coinScore, direction: data.direction, entryPrice: data.entryPrice, tpPrice: data.tpPrice, slPrice: data.slPrice, timeframes: data.timeframes || {} } }));
      fetchUsage();
    } catch (e) { setAnalyses(p => ({ ...p, [sym]: 'Error: ' + e.message })); }
    setLoading(p => ({ ...p, [sym]: false }));
  };

  const parseSignalType = (text) => {
    if (!text) return null;
    const u = text.toUpperCase();
    if (u.includes('LONG') && !u.includes('SHORT')) return 'LONG';
    if (u.includes('SHORT') && !u.includes('LONG')) return 'SHORT';
    return null;
  };

  const parseOverallTrend = (text) => {
    if (!text) return 'Neutral';
    const u = text.toUpperCase();
    if (u.includes('BULLISH') || u.includes('БЫЧИЙ')) return 'Bullish';
    if (u.includes('BEARISH') || u.includes('МЕДВЕЖИЙ')) return 'Bearish';
    return 'Neutral';
  };

  const parseTradingSignal = (text) => {
    if (!text) return {};
    const e = text.match(/(?:ENTRY|ВХОД)[:\s]*\$?([\d,.]+)/i);
    const tp = text.match(/(?:TP|TAKE\s*PROFIT|ТЕЙК)[:\s]*\$?([\d,.]+)/i);
    const sl = text.match(/(?:SL|STOP\s*LOSS|СТОП)[:\s]*\$?([\d,.]+)/i);
    return { entry: e?.[1]?.replace(',', ''), tp: tp?.[1]?.replace(',', ''), sl: sl?.[1]?.replace(',', '') };
  };

  const formatTextWithMarkdown = (text) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    const elements = [];
    parts.forEach((part, i) => {
      if (i % 2 === 1) { elements.push(<strong key={i} style={{ color: theme.text }}>{part}</strong>); return; }
      part.split('\n').forEach((line, j) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) elements.push(<div key={`${i}-${j}`} style={{ paddingLeft: 16, marginBottom: 4 }}>• {trimmed.slice(2)}</div>);
        else if (/^\d+\.\s/.test(trimmed)) elements.push(<div key={`${i}-${j}`} style={{ paddingLeft: 16, marginBottom: 4 }}>{trimmed}</div>);
        else if (trimmed) elements.push(<span key={`${i}-${j}`}>{trimmed}</span>);
        if (j < part.split('\n').length - 1) elements.push(<br key={`${i}-${j}-br`} />);
      });
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

  const renderTimeframeAnalysis = (timeframes) => {
    if (!timeframes) return null;
    return ['5m', '15m', '1h', '4h', '1d', '1w'].map(tf => {
      const data = timeframes[tf];
      if (!data) return null;
      const isBullish = data.trend === 'bullish';
      return (
        <div key={tf} style={{ ...modalSection, borderColor: isBullish ? theme.green + '4D' : theme.red + '4D', background: isBullish ? theme.greenBg : theme.redBg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>{tf.toUpperCase()}</h4>
            <span style={{ fontSize: 20 }}>{data.trend === 'bullish' ? '↗' : data.trend === 'bearish' ? '↘' : '→'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13 }}>
            <div><span style={{ color: theme.textMuted }}>RSI: </span><span style={{ color: theme.text }}>{data.rsi || '—'}</span></div>
            <div><span style={{ color: theme.textMuted }}>MACD: </span><span style={{ color: data.macd_signal === 'buy' ? theme.green : data.macd_signal === 'sell' ? theme.red : theme.textMuted }}>{data.macd_signal || '—'}</span></div>
            <div><span style={{ color: theme.textMuted }}>EMA: </span><span style={{ color: data.ema_status === 'bullish' ? theme.green : data.ema_status === 'bearish' ? theme.red : theme.textMuted }}>{data.ema_status || '—'}</span></div>
            <div><span style={{ color: theme.textMuted }}>Signal: </span><span style={{ color: isBullish ? theme.green : theme.red }}>{data.trend || '—'}</span></div>
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
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'fixed', inset: 0, background: theme.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
        onClick={() => setModal(null)}>
        <motion.div
          initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
          style={{ ...card, maxWidth: 900, width: '100%', maxHeight: '90vh', overflow: 'auto', margin: 0 }}
          onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid ' + theme.border }}>
            <div>
              <h2 style={{ color: theme.text, fontSize: 22, marginBottom: 4 }}>{symbol}</h2>
              {ticker && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ color: theme.textSecondary, fontSize: 18 }}>${(+ticker.lastPrice).toLocaleString()}</span>
                  <span style={badge(+ticker.priceChangePercent > 0 ? 'green' : 'red')}>{(+ticker.priceChangePercent).toFixed(2)}%</span>
                </div>
              )}
            </div>
            <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: theme.textMuted, fontSize: 20, cursor: 'pointer' }}>✕</button>
          </div>

          {/* Overall */}
          <div style={{ ...modalSection, marginBottom: 20 }}>
            <h3 style={{ color: theme.text, fontSize: 18, marginBottom: 16 }}>📊 {t('overallAnalysis')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>{t('overallTrend')}</div>
                <span style={badge(overallTrend === 'Bullish' ? 'green' : overallTrend === 'Bearish' ? 'red' : 'yellow')}>{overallTrend}</span>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>{t('confidence')}</div>
                {confidenceBadge(ad.confidence, theme)}
                {ad.confidence && <div style={{ marginTop: 4 }}><ProgressBar value={ad.confidence} max={100} color={ad.confidence > 70 ? theme.green : ad.confidence >= 50 ? theme.yellow : theme.red} theme={theme} /></div>}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>{t('coinScore')}</div>
                {coinScoreCircle(ad.coinScore, theme)}
              </div>
            </div>
          </div>

          {/* Timeframes */}
          {ad.timeframes && Object.keys(ad.timeframes).length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ color: theme.text, fontSize: 18, marginBottom: 16 }}>📈 {t('multiTimeframeAnalysis')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
                {renderTimeframeAnalysis(ad.timeframes)}
              </div>
            </div>
          )}

          {/* Signal */}
          {signalType && (
            <div style={{ ...modalSection, marginBottom: 20 }}>
              <h3 style={{ color: theme.text, fontSize: 18, marginBottom: 16 }}>🎯 {t('tradingSignal')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                <div style={{ textAlign: 'center', padding: 12, background: theme.hoverBg, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>{t('direction')}</div>
                  <span style={badge(signalType === 'LONG' ? 'green' : 'red')}>{signalType}</span>
                </div>
                {tradingSignal.entry && <div style={{ textAlign: 'center', padding: 12, background: theme.hoverBg, borderRadius: 8 }}><div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>Entry</div><div style={{ color: theme.text, fontWeight: 600 }}>${tradingSignal.entry}</div></div>}
                {tradingSignal.tp && <div style={{ textAlign: 'center', padding: 12, background: theme.greenBg, borderRadius: 8, border: '1px solid ' + theme.green + '4D' }}><div style={{ fontSize: 12, color: theme.green, marginBottom: 4 }}>Take Profit</div><div style={{ color: theme.green, fontWeight: 600 }}>${tradingSignal.tp}</div></div>}
                {tradingSignal.sl && <div style={{ textAlign: 'center', padding: 12, background: theme.redBg, borderRadius: 8, border: '1px solid ' + theme.red + '4D' }}><div style={{ fontSize: 12, color: theme.red, marginBottom: 4 }}>Stop Loss</div><div style={{ color: theme.red, fontWeight: 600 }}>${tradingSignal.sl}</div></div>}
              </div>
            </div>
          )}

          {/* Detailed */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ color: theme.text, fontSize: 18, marginBottom: 16 }}>📖 {t('detailedAnalysis')}</h3>
            <div style={{ ...modalSection, fontSize: 14, color: theme.textSecondary, lineHeight: 1.6 }}>
              {formatTextWithMarkdown(analysis)}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <motion.button onClick={() => setModal(null)}
              style={{ background: theme.accent, color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>{t('close')}</motion.button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <div>
      {/* Usage Counter */}
      <motion.div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div>
          <h2 style={{ color: theme.text, fontSize: 18, marginBottom: 4 }}>🤖 {t('aiAnalytics')}</h2>
          <div style={{ fontSize: 13, color: theme.textMuted }}>
            {usage.limit === -1 ? t('aiUsageUnlimited') : `${t('aiUsageRemaining')}: ${usage.remaining}/${usage.limit}`}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 2 }}>{t('currentPlan')}</div>
          <span style={badge(usage.plan === 'Premium' ? 'green' : 'yellow')}>{usage.plan}</span>
        </div>
      </motion.div>

      <div style={grid}>
        {[
          { label: t('fearGreed'), render: () => fng ? (<><div style={{ fontSize: 28, fontWeight: 700, color: fngColor(+fng.value) }}>{fng.value}</div><div style={{ fontSize: 14, color: fngColor(+fng.value), fontWeight: 600 }}>{t(fngLabelKey(+fng.value))}</div></>) : <div style={{ color: theme.textMuted }}>{t('loading')}</div> },
          { label: t('volume24h'), render: () => (<><div style={{ fontSize: 28, fontWeight: 700, color: theme.text }}>${(totalMcap / 1e9).toFixed(1)}B</div><div style={{ fontSize: 12, color: theme.textMuted }}>{t('usdtPairs')}</div></>) },
          { label: t('aiAnalysesCount'), render: () => (<><div style={{ fontSize: 28, fontWeight: 700, color: theme.text }}>{analyzedCount}</div><div style={{ fontSize: 12, color: theme.textMuted }}>{t('doneThisSession')}</div></>) },
        ].map((item, i) => (
          <motion.div key={i} style={card} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>{item.label}</div>
            {item.render()}
          </motion.div>
        ))}
      </div>

      <h2 style={{ color: theme.text, fontSize: 18, marginBottom: 12 }}>📡 {t('marketOverview')}</h2>
      <motion.div style={{ ...card, overflowX: 'auto' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{[t('pair'), '⭐', t('price'), t('change24h'), t('high24h'), t('low24h'), t('volumeLabel'), t('aiAnalyze')].map(h =>
              <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: theme.textMuted, fontSize: 12, borderBottom: '1px solid ' + theme.tableBorder, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
            )}</tr>
          </thead>
          <tbody>
            {tickers.map((tk, i) => {
              const ad = analysisData[tk.symbol];
              return (
                <motion.tr key={tk.symbol} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: theme.text }}>{tk.symbol.replace('USDT', '')}<span style={{ color: theme.textMuted }}>/USDT</span></td>
                  <td style={{ padding: '10px 12px' }}>{analyses[tk.symbol] && ad ? coinScoreCircle(ad.coinScore, theme) : <span style={{ color: theme.textMuted }}>—</span>}</td>
                  <td style={{ padding: '10px 12px', color: theme.text }}>${(+tk.lastPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td style={{ padding: '10px 12px' }}><span style={badge(+tk.priceChangePercent > 0 ? 'green' : 'red')}>{(+tk.priceChangePercent).toFixed(2)}%</span></td>
                  <td style={{ padding: '10px 12px', color: theme.textSecondary }}>${(+tk.highPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td style={{ padding: '10px 12px', color: theme.textSecondary }}>${(+tk.lowPrice).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td style={{ padding: '10px 12px', color: theme.textSecondary }}>{(+tk.volume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ padding: '10px 12px' }}>
                    {loading[tk.symbol] ? (
                      <span style={{ color: theme.accent, fontSize: 13 }}>⏳ {t('analyzing')}</span>
                    ) : analyses[tk.symbol] ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <motion.button onClick={() => setModal({ symbol: tk.symbol, analysis: analyses[tk.symbol] })} style={btnStyle}
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>{t('result')}</motion.button>
                        {ad ? confidenceBadge(ad.confidence, theme) : null}
                      </div>
                    ) : (
                      <motion.button onClick={() => requestAnalysis(tk)} style={btnStyle}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>{t('aiAnalyze')}</motion.button>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </motion.div>

      <h2 style={{ color: theme.text, fontSize: 18, margin: '20px 0 12px' }}>🎯 {t('tradingSignals')}</h2>
      {Object.keys(analyses).length === 0 ? (
        <div style={{ ...card, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
          <div style={{ color: theme.textSecondary, fontSize: 15, marginBottom: 8 }}>{t('clickAI')}</div>
          <div style={{ color: theme.textMuted, fontSize: 13 }}>{t('eachAnalysis')}</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 12 }}>
          {Object.entries(analyses).map(([sym, text], i) => {
            const signalType = parseSignalType(text);
            const ad = analysisData[sym];
            return (
              <motion.div key={sym} style={card} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 16, color: theme.text }}>{sym.replace('USDT', '')}/USDT</span>
                    {ad && coinScoreCircle(ad.coinScore, theme)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {signalType && <span style={badge(signalType === 'LONG' ? 'green' : 'red')}>{signalType}</span>}
                    {ad && confidenceBadge(ad.confidence, theme)}
                  </div>
                </div>
                <div style={{ maxHeight: 200, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ fontSize: 13, color: theme.textSecondary, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{text.slice(0, 300)}...</div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: theme.gradient }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <motion.button onClick={() => setModal({ symbol: sym, analysis: text })} style={btnStyle}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>{t('more')}</motion.button>
                  <motion.button onClick={() => setModal({ symbol: sym, analysis: text })}
                    style={{ ...btnStyle, background: theme.yellowBg, color: theme.yellow }}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>💡 {t('why')}</motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Signal History */}
      <h2 style={{ color: theme.text, fontSize: 18, margin: '20px 0 12px' }}>📜 {t('signalHistory')}</h2>
      <motion.div style={{ ...card, overflowX: 'auto' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {history.length === 0 ? (
          <div style={{ color: theme.textMuted, textAlign: 'center', padding: 20 }}>{t('noSignalHistory')}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{[t('pair'), t('direction'), t('entry'), t('result'), t('accuracy'), t('aiReflectionLabel')].map(h =>
                <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: theme.textMuted, fontSize: 11, borderBottom: '1px solid ' + theme.tableBorder, textTransform: 'uppercase' }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {history.slice(0, 20).map(sig => (
                <tr key={sig.id}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: theme.text }}>{(sig.pair || '').replace('USDT', '')}<span style={{ color: theme.textMuted }}>/USDT</span></td>
                  <td style={{ padding: '10px 12px' }}>{sig.direction && <span style={badge(sig.direction === 'LONG' ? 'green' : 'red')}>{sig.direction}</span>}</td>
                  <td style={{ padding: '10px 12px', color: theme.text }}>${sig.entry_price}</td>
                  <td style={{ padding: '10px 12px' }}>{resultBadge(sig.result)}</td>
                  <td style={{ padding: '10px 12px', color: theme.textSecondary }}>{sig.accuracy_score != null ? sig.accuracy_score + '%' : '—'}</td>
                  <td style={{ padding: '10px 12px', color: theme.textSecondary, fontSize: 12, maxWidth: 300 }}>{sig.ai_reflection ? sig.ai_reflection.slice(0, 120) + (sig.ai_reflection.length > 120 ? '...' : '') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Modals */}
      <AnimatePresence>{modal && renderEnhancedModal()}</AnimatePresence>

      <AnimatePresence>
        {showLimitModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: theme.overlay, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 20 }}
            onClick={() => setShowLimitModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              style={{ ...card, maxWidth: 400, width: '100%', textAlign: 'center', margin: 0 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
              <h3 style={{ color: theme.text, fontSize: 20, marginBottom: 12 }}>{t('limitReached')}</h3>
              <div style={{ ...modalSection, textAlign: 'left', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: theme.textMuted }}>{t('usageStats')}:</span>
                  <span style={{ color: theme.text }}>{usage.used}/{usage.limit}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: theme.textMuted }}>{t('currentPlan')}:</span>
                  <span style={badge(usage.plan === 'Premium' ? 'green' : 'yellow')}>{usage.plan}</span>
                </div>
              </div>
              <p style={{ color: theme.textSecondary, fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>{t('upgradeMessage')}</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <motion.button onClick={() => setShowLimitModal(false)}
                  style={{ background: theme.hoverBg, color: theme.textSecondary, border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>{t('close')}</motion.button>
                <motion.button onClick={() => setShowLimitModal(false)}
                  style={{ background: theme.accent, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>{t('upgradePlan')}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
