import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const getStyles = (theme) => ({
  card: { background: theme.cardBg, border: '1px solid ' + theme.border, borderRadius: 12, padding: 20, marginBottom: 16 },
  inputStyle: { width: '100%', background: theme.inputBg, border: '1px solid ' + theme.border, borderRadius: 8, padding: '10px 14px', color: theme.text, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box' },
  selStyle: { width: '100%', background: theme.inputBg, border: '1px solid ' + theme.border, borderRadius: 8, padding: '10px 14px', color: theme.text, fontSize: 14, fontFamily: "'Inter',sans-serif", outline: 'none', boxSizing: 'border-box' },
  btnPrimary: { background: theme.accent, color: theme.name === 'light' ? '#fff' : theme.text, border: 'none', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, fontFamily: "'Inter',sans-serif" },
  btnDanger: { background: theme.redBg, color: theme.red, border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: "'Inter',sans-serif" }
});

const PAIRS = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','AVAXUSDT'];

const beep = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    o.connect(ctx.destination);
    o.frequency.value = 800;
    o.start();
    setTimeout(() => o.stop(), 200);
  } catch (e) {}
};

export default function AlertsPanel() {
  const { t } = useLang();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [pair, setPair] = useState('BTCUSDT');
  const [condition, setCondition] = useState('above');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [triggeredAlerts, setTriggeredAlerts] = useState([]);
  const knownTriggered = useRef(new Set());

  const fetchAlerts = useCallback(async () => {
    try {
      const [aR, tR] = await Promise.all([
        fetch('/api/alerts?status=active'),
        fetch('/api/alerts?status=triggered')
      ]);
      setActiveAlerts(await aR.json());
      const triggered = await tR.json();
      
      // Check for new triggers and beep
      for (const alert of triggered) {
        if (!knownTriggered.current.has(alert.id)) {
          knownTriggered.current.add(alert.id);
          if (triggeredAlerts.length > 0) { // Don't beep on first load
            beep();
          }
        }
      }
      setTriggeredAlerts(triggered);
    } catch (e) { console.error(e); }
  }, [triggeredAlerts.length]);

  useEffect(() => {
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 10000);
    return () => clearInterval(iv);
  }, []);

  // Re-check for new triggered alerts every 10s
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const r = await fetch('/api/alerts/triggered');
        const data = await r.json();
        for (const alert of data) {
          if (!knownTriggered.current.has(alert.id)) {
            knownTriggered.current.add(alert.id);
            beep();
          }
        }
      } catch (e) {}
    }, 10000);
    return () => clearInterval(iv);
  }, []);

  const handleCreate = async () => {
    if (!value) return;
    await fetch('/api/alerts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pair, condition, value: +value, message })
    });
    setValue(''); setMessage('');
    fetchAlerts();
  };

  const handleDelete = async (id) => {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    fetchAlerts();
  };

  const conditionLabels = { above: t('above'), below: t('below'), cross_above: t('crossAbove'), cross_below: t('crossBelow') };

  return (
    <div>
      <h2 style={{ color: '#fff', fontSize: 20, marginBottom: 16 }}>🔔 {t('alertsTitle')}</h2>

      <div style={card}>
        <h3 style={{ color: '#fff', fontSize: 16, marginBottom: 16 }}>➕ {t('createAlert')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>{t('pair')}</label>
            <select style={selStyle} value={pair} onChange={e => setPair(e.target.value)}>
              {PAIRS.map(p => <option key={p} value={p}>{p.replace('USDT', '/USDT')}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>{t('condition')}</label>
            <select style={selStyle} value={condition} onChange={e => setCondition(e.target.value)}>
              {Object.entries(conditionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>{t('price')} ($)</label>
            <input style={inputStyle} type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="100000" />
          </div>
          <div>
            <label style={{ color: '#888', fontSize: 12, marginBottom: 4, display: 'block' }}>{t('alertMessage')}</label>
            <input style={inputStyle} value={message} onChange={e => setMessage(e.target.value)} placeholder={t('alertMessage')} />
          </div>
        </div>
        <button style={{ ...btnPrimary, marginTop: 16 }} onClick={handleCreate}>{t('createAlert')}</button>
      </div>

      <div style={card}>
        <h3 style={{ color: '#fff', fontSize: 16, marginBottom: 12 }}>🟢 {t('activeAlerts')} ({activeAlerts.length})</h3>
        {activeAlerts.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 20 }}>{t('noActiveAlerts')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{[t('pair'), t('condition'), t('price'), t('alertMessage'), ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#666', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {activeAlerts.map(alert => (
                  <tr key={alert.id}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{alert.pair.replace('USDT', '')}<span style={{ color: '#666' }}>/USDT</span></td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                        {conditionLabels[alert.condition] || alert.condition}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: '#fff', fontWeight: 600 }}>${alert.value.toLocaleString()}</td>
                    <td style={{ padding: '10px', color: '#888', fontSize: 13 }}>{alert.message || '—'}</td>
                    <td style={{ padding: '10px' }}>
                      <button style={btnDanger} onClick={() => handleDelete(alert.id)}>{t('delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={card}>
        <h3 style={{ color: '#eab308', fontSize: 16, marginBottom: 12 }}>⚡ {t('triggeredAlerts')} ({triggeredAlerts.length})</h3>
        {triggeredAlerts.length === 0 ? (
          <div style={{ color: '#555', textAlign: 'center', padding: 20 }}>{t('noTriggeredAlerts')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{[t('pair'), t('condition'), t('price'), t('alertMessage'), t('triggeredAt')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#666', fontSize: 11, borderBottom: '1px solid rgba(255,255,255,0.06)', textTransform: 'uppercase' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {triggeredAlerts.slice(0, 20).map(alert => (
                  <tr key={alert.id}>
                    <td style={{ padding: '10px', fontWeight: 600 }}>{alert.pair.replace('USDT', '')}<span style={{ color: '#666' }}>/USDT</span></td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>
                        {conditionLabels[alert.condition] || alert.condition}
                      </span>
                    </td>
                    <td style={{ padding: '10px', color: '#fff', fontWeight: 600 }}>${alert.value.toLocaleString()}</td>
                    <td style={{ padding: '10px', color: '#888', fontSize: 13 }}>{alert.message || '—'}</td>
                    <td style={{ padding: '10px', color: '#888', fontSize: 12 }}>{alert.triggered_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
