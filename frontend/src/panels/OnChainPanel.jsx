import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const cardAnim = (delay = 0) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.3 } });

// Simulated on-chain data (would come from API in production)
const MOCK_METRICS = {
  BTCUSDT: { activeAddresses: 1024567, hashRate: '620 EH/s', nvt: 42.3, mvrv: 1.85, sopr: 1.02, exchangeInflow: 12400, exchangeOutflow: 15800 },
  ETHUSDT: { activeAddresses: 587234, hashRate: 'N/A (PoS)', nvt: 38.1, mvrv: 1.52, sopr: 0.98, exchangeInflow: 45600, exchangeOutflow: 52300, gasPrice: '18 Gwei', tvl: '$48.2B' },
};

const PAIRS = ['BTCUSDT', 'ETHUSDT'];

export default function OnChainPanel() {
  const { t } = useLang();
  const { theme } = useTheme();
  const [pair, setPair] = useState('BTCUSDT');
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const card = { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 };
  const sel = { background: theme.inputBg, color: theme.text, border: '1px solid ' + theme.border, borderRadius: 8, padding: '8px 14px', fontSize: 14, fontFamily: "'Inter',sans-serif" };

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/onchain?symbol=${pair}`);
      if (r.ok) {
        const data = await r.json();
        setMetrics(data);
      } else {
        // Fallback to mock data
        setMetrics(MOCK_METRICS[pair] || MOCK_METRICS.BTCUSDT);
      }
    } catch {
      setMetrics(MOCK_METRICS[pair] || MOCK_METRICS.BTCUSDT);
    }
    setLoading(false);
  }, [pair]);

  useEffect(() => {
    fetchMetrics();
    const iv = setInterval(fetchMetrics, 60000);
    return () => clearInterval(iv);
  }, [fetchMetrics]);

  const MetricCard = ({ label, value, color, desc, delay = 0 }) => (
    <motion.div style={{ ...card, textAlign: 'center', marginBottom: 0, borderLeft: `3px solid ${color}` }} {...cardAnim(delay)}>
      <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {desc && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{desc}</div>}
    </motion.div>
  );

  const mvrvColor = (v) => v > 3 ? theme.red : v > 2 ? theme.yellow : v > 1 ? theme.green : theme.blue;
  const soprColor = (v) => v > 1 ? theme.green : v < 1 ? theme.red : theme.yellow;

  const flowDiff = metrics ? (metrics.exchangeOutflow || 0) - (metrics.exchangeInflow || 0) : 0;
  const flowColor = flowDiff > 0 ? theme.green : flowDiff < 0 ? theme.red : theme.textMuted;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <h2 style={{ color: theme.text, fontSize: 20, margin: 0 }}>⛓️ {t('onChainTitle')}</h2>
        <select style={sel} value={pair} onChange={e => setPair(e.target.value)}>
          {PAIRS.map(p => <option key={p} value={p}>{p.replace('USDT', '')}</option>)}
        </select>
        {loading && <span style={{ color: theme.accent, fontSize: 13 }}>⏳</span>}
      </div>

      {!metrics ? (
        <div style={{ color: theme.textMuted, textAlign: 'center', padding: 40 }}>{t('loading')}</div>
      ) : (
        <>
          {/* Key Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
            <MetricCard label={t('activeAddresses')} value={(metrics.activeAddresses || 0).toLocaleString()} color={theme.accent} delay={0} />
            <MetricCard label={t('hashRate')} value={metrics.hashRate || 'N/A'} color={theme.purple} delay={0.05} />
            <MetricCard label="NVT Ratio" value={(metrics.nvt || 0).toFixed(1)} color={theme.yellow} desc={t('nvtDesc')} delay={0.1} />
            <MetricCard label="MVRV" value={(metrics.mvrv || 0).toFixed(2)} color={mvrvColor(metrics.mvrv)} desc={t('mvrvDesc')} delay={0.15} />
            <MetricCard label="SOPR" value={(metrics.sopr || 0).toFixed(3)} color={soprColor(metrics.sopr)} desc={t('soprDesc')} delay={0.2} />
            {metrics.gasPrice && <MetricCard label={t('gasPrice')} value={metrics.gasPrice} color={theme.accent} delay={0.25} />}
            {metrics.tvl && <MetricCard label="TVL (DeFi)" value={metrics.tvl} color={theme.green} delay={0.3} />}
          </div>

          {/* Exchange Flow */}
          <motion.div style={card} {...cardAnim(0.2)}>
            <h3 style={{ color: theme.text, fontSize: 16, marginBottom: 16 }}>🏦 {t('exchangeFlow')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{t('exchangeInflow')}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: theme.red }}>{(metrics.exchangeInflow || 0).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>{pair.replace('USDT', '')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{t('netFlow')}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: flowColor }}>
                  {flowDiff > 0 ? '+' : ''}{flowDiff.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: flowColor }}>{flowDiff > 0 ? t('bullishSignal') : flowDiff < 0 ? t('bearishSignal') : t('neutral')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{t('exchangeOutflow')}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: theme.green }}>{(metrics.exchangeOutflow || 0).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>{pair.replace('USDT', '')}</div>
              </div>
            </div>

            {/* Flow bar */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: theme.inputBg }}>
                <motion.div style={{ background: theme.red, height: '100%' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${((metrics.exchangeInflow || 0) / ((metrics.exchangeInflow || 0) + (metrics.exchangeOutflow || 1))) * 100}%` }}
                  transition={{ duration: 0.5 }} />
                <motion.div style={{ background: theme.green, height: '100%', flex: 1 }}
                  initial={{ width: 0 }} animate={{ width: 'auto' }} transition={{ duration: 0.5 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: theme.textMuted }}>
                <span>{t('inflow')}</span>
                <span>{t('outflow')}</span>
              </div>
            </div>
          </motion.div>

          {/* Interpretation */}
          <motion.div style={{ ...card, background: `linear-gradient(135deg, ${theme.accent}15, ${theme.accent}08)`, borderColor: theme.accent + '4D' }}
            {...cardAnim(0.3)}>
            <div style={{ fontSize: 13, color: theme.accent, marginBottom: 6, fontWeight: 600 }}>💡 {t('onChainInterpretation')}</div>
            <div style={{ fontSize: 14, color: theme.text, lineHeight: 1.6 }}>
              {metrics.mvrv > 2.5 ? t('mvrvOverheated') :
               metrics.mvrv < 1 ? t('mvrvUndervalued') :
               t('mvrvHealthy')}
              {' '}
              {metrics.sopr > 1.05 ? t('soprProfit') :
               metrics.sopr < 0.95 ? t('soprLoss') :
               t('soprNeutral')}
              {' '}
              {flowDiff > 0 ? t('flowBullish') : flowDiff < 0 ? t('flowBearish') : t('flowNeutral')}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
