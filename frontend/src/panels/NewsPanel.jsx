import React, { useState, useEffect } from 'react';
import { useLang } from '../LangContext';
import { useTheme } from '../ThemeContext';

const card = { background: '#12121a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 16 };
const btnStyle = { background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: "'Inter',sans-serif" };

export default function NewsPanel() {
  const { t, lang } = useLang();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState({});
  const [summarizing, setSummarizing] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/news');
        const data = await r.json();
        setNews(Array.isArray(data) ? data.slice(0, 30) : []);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const handleSummary = async (item, index) => {
    setSummarizing(p => ({ ...p, [index]: true }));
    try {
      const r = await fetch('/api/news/summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: item.title, body: item.body || '', lang })
      });

      if (r.status === 429) {
        const errorData = await r.json();
        setSummaries(p => ({ ...p, [index]: `⚡ ${errorData.message}` }));
        setSummarizing(p => ({ ...p, [index]: false }));
        return;
      }

      const data = await r.json();
      setSummaries(p => ({ ...p, [index]: data.summary || 'Error' }));
    } catch (e) {
      setSummaries(p => ({ ...p, [index]: 'Error: ' + e.message }));
    }
    setSummarizing(p => ({ ...p, [index]: false }));
  };

  const timeAgo = (ts) => {
    const diff = Math.floor(Date.now() / 1000 - ts);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  if (loading) return <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>{t('loading')}</div>;

  return (
    <div>
      <h2 style={{ color: '#fff', fontSize: 20, marginBottom: 16 }}>📰 {t('newsTitle')}</h2>

      <div style={{ display: 'grid', gap: 12 }}>
        {news.map((item, i) => (
          <div key={i} style={card}>
            <div style={{ display: 'flex', gap: 16 }}>
              {item.imageurl && (
                <img src={item.imageurl} alt="" style={{ width: 100, height: 70, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: 0, lineHeight: 1.4 }}>{item.title}</h3>
                  <span style={{ color: '#555', fontSize: 12, flexShrink: 0, marginLeft: 12 }}>{timeAgo(item.published_on)}</span>
                </div>
                <div style={{ color: '#888', fontSize: 13, marginBottom: 8, lineHeight: 1.5 }}>
                  {(item.body || '').slice(0, 200)}{(item.body || '').length > 200 ? '...' : ''}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: '#888', fontSize: 11 }}>
                    {item.source}
                  </span>
                  {summarizing[i] ? (
                    <span style={{ color: '#3b82f6', fontSize: 12 }}>⏳ {t('summarizing')}</span>
                  ) : summaries[i] ? null : (
                    <button style={btnStyle} onClick={() => handleSummary(item, i)}>🤖 {t('aiSummary')}</button>
                  )}
                  <a href={item.url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', fontSize: 12, textDecoration: 'none' }}>
                    {t('readMore')} →
                  </a>
                </div>
                {summaries[i] && (
                  <div style={{ marginTop: 10, padding: 12, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8, color: '#ccc', fontSize: 13, lineHeight: 1.6 }}>
                    🤖 {summaries[i]}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
