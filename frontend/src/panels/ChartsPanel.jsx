import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const PAIRS = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'];
const TIMEFRAMES = ['1m','5m','15m','1h','4h','1d','1w'];
const CHART_TYPE_IDS = ['Candlestick', 'Line', 'Bars'];
const CHART_TYPE_KEYS = { Candlestick: 'candles', Line: 'line', Bars: 'bars' };

const getStyles = (theme) => ({
  card: { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 16, marginBottom: 12 },
  btn: (active) => ({
    padding: '6px 14px', borderRadius: 6, border: '1px solid ' + (active ? theme.accent : theme.border),
    background: active ? theme.accent + '33' : 'transparent', color: active ? theme.accent : theme.textSecondary,
    cursor: 'pointer', fontSize: 13, fontFamily: "'Inter',sans-serif", fontWeight: 500
  }),
  sel: { background: theme.inputBg, color: theme.text, border: '1px solid ' + theme.border, borderRadius: 6, padding: '6px 12px', fontSize: 13, fontFamily: "'Inter',sans-serif" },
});

export default function ChartsPanel() {
  const { t } = useLang();
  const { theme } = useTheme();
  
  // State with localStorage persistence
  const [pair, setPair] = useState(() => {
    try { return localStorage.getItem('charts_pair') || 'BTCUSDT'; } catch { return 'BTCUSDT'; }
  });
  const [tf, setTf] = useState(() => {
    try { return localStorage.getItem('charts_timeframe') || '1h'; } catch { return '1h'; }
  });
  const [chartType, setChartType] = useState(() => {
    try { return localStorage.getItem('charts_type') || 'Candlestick'; } catch { return 'Candlestick'; }
  });
  
  const [price, setPrice] = useState(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const seriesRef = useRef(null);
  const volRef = useRef(null);

  const styles = getStyles(theme);

  // Save state to localStorage
  useEffect(() => { localStorage.setItem('charts_pair', pair); }, [pair]);
  useEffect(() => { localStorage.setItem('charts_timeframe', tf); }, [tf]);
  useEffect(() => { localStorage.setItem('charts_type', chartType); }, [chartType]);

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch(`/api/klines?symbol=${pair}&interval=${tf}&limit=500`);
      const data = await r.json();
      if (!Array.isArray(data)) return;

      const candles = data.map(d => ({ time: d[0] / 1000, open: +d[1], high: +d[2], low: +d[3], close: +d[4] }));
      const volumes = data.map(d => ({ time: d[0] / 1000, value: +d[5], color: +d[4] >= +d[1] ? theme.chartUp + '66' : theme.chartDown + '66' }));

      if (candles.length) setPrice(candles[candles.length - 1].close);

      if (!chartInstance.current && chartRef.current) {
        const chart = createChart(chartRef.current, {
          width: chartRef.current.clientWidth, height: 500,
          layout: { background: { color: theme.cardBg }, textColor: theme.textSecondary, fontFamily: "'Inter',sans-serif" },
          grid: { vertLines: { color: theme.border }, horzLines: { color: theme.border } },
          crosshair: { mode: 0 },
          timeScale: { borderColor: theme.border, timeVisible: true },
          rightPriceScale: { borderColor: theme.border },
        });
        chartInstance.current = chart;
        const ro = new ResizeObserver(() => { if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth }); });
        ro.observe(chartRef.current);
      }

      const chart = chartInstance.current;
      if (!chart) return;

      if (seriesRef.current) { chart.removeSeries(seriesRef.current); seriesRef.current = null; }
      if (volRef.current) { chart.removeSeries(volRef.current); volRef.current = null; }

      if (chartType === 'Line') {
        seriesRef.current = chart.addLineSeries({ color: theme.accent, lineWidth: 2 });
        seriesRef.current.setData(candles.map(c => ({ time: c.time, value: c.close })));
      } else if (chartType === 'Bars') {
        seriesRef.current = chart.addBarSeries({ upColor: theme.chartUp, downColor: theme.chartDown });
        seriesRef.current.setData(candles);
      } else {
        seriesRef.current = chart.addCandlestickSeries({ upColor: theme.chartUp, downColor: theme.chartDown, borderUpColor: theme.chartUp, borderDownColor: theme.chartDown, wickUpColor: theme.chartUp, wickDownColor: theme.chartDown });
        seriesRef.current.setData(candles);
      }

      volRef.current = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
      chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      volRef.current.setData(volumes);

      chart.timeScale().fitContent();
    } catch (e) { console.error(e); }
  }, [pair, tf, chartType]);

  useEffect(() => {
    if (chartInstance.current) { chartInstance.current.remove(); chartInstance.current = null; seriesRef.current = null; volRef.current = null; }
    fetchData();
    const iv = setInterval(fetchData, 10000);
    return () => clearInterval(iv);
  }, [fetchData]);

  return (
    <div>
      <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select style={styles.sel} value={pair} onChange={e => setPair(e.target.value)}>
          {PAIRS.map(p => <option key={p} value={p}>{p.replace('USDT', '/USDT')}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {CHART_TYPE_IDS.map(id => <button key={id} style={styles.btn(chartType === id)} onClick={() => setChartType(id)}>{t(CHART_TYPE_KEYS[id])}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {TIMEFRAMES.map(t => <button key={t} style={styles.btn(tf === t)} onClick={() => setTf(t)}>{t.toUpperCase()}</button>)}
        </div>
        {price && <span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 700, color: theme.text }}>${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}
      </div>
      <div style={styles.card}>
        <div ref={chartRef} style={{ width: '100%' }} />
      </div>
    </div>
  );
}
