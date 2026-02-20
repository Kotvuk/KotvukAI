import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import { useLang } from '../LangContext';

const PAIRS = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'];
const TIMEFRAMES = ['1m','5m','15m','1h','4h','1d','1w'];
const CHART_TYPE_IDS = ['Candlestick', 'Line', 'Bars'];
const CHART_TYPE_KEYS = { Candlestick: 'candles', Line: 'line', Bars: 'bars' };

const card = { background: '#12121a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, marginBottom: 12 };
const btn = (active) => ({
  padding: '6px 14px', borderRadius: 6, border: '1px solid ' + (active ? '#3b82f6' : 'rgba(255,255,255,0.1)'),
  background: active ? 'rgba(59,130,246,0.2)' : 'transparent', color: active ? '#3b82f6' : '#a0a0b0',
  cursor: 'pointer', fontSize: 13, fontFamily: "'Inter',sans-serif", fontWeight: 500
});
const sel = { background: '#1a1a2e', color: '#e0e0e0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontFamily: "'Inter',sans-serif" };

export default function ChartsPanel() {
  const { t } = useLang();
  const [pair, setPair] = useState('BTCUSDT');
  const [tf, setTf] = useState('1h');
  const [chartType, setChartType] = useState('Candlestick');
  const [price, setPrice] = useState(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const seriesRef = useRef(null);
  const volRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const r = await fetch(`/api/klines?symbol=${pair}&interval=${tf}&limit=500`);
      const data = await r.json();
      if (!Array.isArray(data)) return;

      const candles = data.map(d => ({ time: d[0] / 1000, open: +d[1], high: +d[2], low: +d[3], close: +d[4] }));
      const volumes = data.map(d => ({ time: d[0] / 1000, value: +d[5], color: +d[4] >= +d[1] ? 'rgba(38,166,154,0.4)' : 'rgba(239,83,80,0.4)' }));

      if (candles.length) setPrice(candles[candles.length - 1].close);

      if (!chartInstance.current && chartRef.current) {
        const chart = createChart(chartRef.current, {
          width: chartRef.current.clientWidth, height: 500,
          layout: { background: { color: '#12121a' }, textColor: '#a0a0b0', fontFamily: "'Inter',sans-serif" },
          grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
          crosshair: { mode: 0 },
          timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true },
          rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)' },
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
        seriesRef.current = chart.addLineSeries({ color: '#3b82f6', lineWidth: 2 });
        seriesRef.current.setData(candles.map(c => ({ time: c.time, value: c.close })));
      } else if (chartType === 'Bars') {
        seriesRef.current = chart.addBarSeries({ upColor: '#26a69a', downColor: '#ef5350' });
        seriesRef.current.setData(candles);
      } else {
        seriesRef.current = chart.addCandlestickSeries({ upColor: '#26a69a', downColor: '#ef5350', borderUpColor: '#26a69a', borderDownColor: '#ef5350', wickUpColor: '#26a69a', wickDownColor: '#ef5350' });
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
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select style={sel} value={pair} onChange={e => setPair(e.target.value)}>
          {PAIRS.map(p => <option key={p} value={p}>{p.replace('USDT', '/USDT')}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {CHART_TYPE_IDS.map(id => <button key={id} style={btn(chartType === id)} onClick={() => setChartType(id)}>{t(CHART_TYPE_KEYS[id])}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {TIMEFRAMES.map(t => <button key={t} style={btn(tf === t)} onClick={() => setTf(t)}>{t.toUpperCase()}</button>)}
        </div>
        {price && <span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 700, color: '#fff' }}>${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>}
      </div>
      <div style={card}>
        <div ref={chartRef} style={{ width: '100%' }} />
      </div>
    </div>
  );
}
