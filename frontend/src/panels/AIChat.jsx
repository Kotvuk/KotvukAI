import React, { useState, useRef, useEffect } from 'react';
import { useLang } from '../LangContext';

const styles = {
  bubble: {
    position: 'fixed', bottom: 24, right: 24, width: 60, height: 60, borderRadius: '50%',
    background: '#3b82f6', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    boxShadow: '0 4px 20px rgba(59,130,246,0.4)', transition: 'transform 0.2s'
  },
  window: {
    position: 'fixed', bottom: 96, right: 24, width: 350, height: 500,
    background: '#0d0d14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16,
    display: 'flex', flexDirection: 'column', zIndex: 9999, overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)'
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: '#12121a'
  },
  messages: { flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  inputArea: {
    display: 'flex', gap: 8, padding: 12, borderTop: '1px solid rgba(255,255,255,0.06)',
    background: '#12121a'
  },
  input: {
    flex: 1, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '8px 12px', color: '#e0e0e0', fontSize: 13,
    fontFamily: "'Inter',sans-serif", outline: 'none'
  },
  sendBtn: {
    background: '#3b82f6', border: 'none', borderRadius: 8, padding: '8px 16px',
    color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 600
  },
  userMsg: {
    alignSelf: 'flex-end', background: '#3b82f6', color: '#fff', padding: '8px 12px',
    borderRadius: '12px 12px 4px 12px', maxWidth: '80%', fontSize: 13, lineHeight: 1.5
  },
  aiMsg: {
    alignSelf: 'flex-start', background: '#1a1a2e', color: '#e0e0e0', padding: '8px 12px',
    borderRadius: '12px 12px 12px 4px', maxWidth: '80%', fontSize: 13, lineHeight: 1.5
  },
  typing: {
    alignSelf: 'flex-start', color: '#666', fontSize: 13, padding: '8px 12px'
  }
};

function formatAIText(text) {
  // Basic markdown: bold and lists
  const parts = text.split(/\*\*(.*?)\*\*/g);
  const elements = parts.map((part, i) => {
    if (i % 2 === 1) return <strong key={i} style={{ color: '#fff' }}>{part}</strong>;
    // Handle list items
    const lines = part.split('\n');
    return lines.map((line, j) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        return <div key={`${i}-${j}`} style={{ paddingLeft: 12 }}>• {trimmed.slice(2)}</div>;
      }
      if (/^\d+\.\s/.test(trimmed)) {
        return <div key={`${i}-${j}`} style={{ paddingLeft: 12 }}>{trimmed}</div>;
      }
      return line ? <span key={`${i}-${j}`}>{line}{j < lines.length - 1 ? <br /> : null}</span> : (j < lines.length - 1 ? <br key={`${i}-${j}`} /> : null);
    });
  });
  return elements;
}

export default function AIChat() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const newMsgs = [...messages, { role: 'user', content: text }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: newMsgs.slice(-10) })
      });
      const data = await r.json();
      setMessages([...newMsgs, { role: 'assistant', content: data.reply || data.error || 'Ошибка' }]);
    } catch (e) {
      setMessages([...newMsgs, { role: 'assistant', content: 'Ошибка: ' + e.message }]);
    }
    setLoading(false);
  };

  return (
    <>
      {open && (
        <div style={styles.window}>
          <div style={styles.header}>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>💬 {t('chatTitle')}</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#666', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={styles.messages}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#555', fontSize: 13, marginTop: 40 }}>
                👋 {t('chatPlaceholder')}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={m.role === 'user' ? styles.userMsg : styles.aiMsg}>
                {m.role === 'user' ? m.content : formatAIText(m.content)}
              </div>
            ))}
            {loading && <div style={styles.typing}>⏳ {t('analyzing')}</div>}
            <div ref={messagesEnd} />
          </div>
          <div style={styles.inputArea}>
            <input
              style={styles.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder={t('chatPlaceholder')}
            />
            <button style={styles.sendBtn} onClick={send} disabled={loading}>{t('chatSend')}</button>
          </div>
        </div>
      )}
      <button style={styles.bubble} onClick={() => setOpen(!open)}>💬</button>
    </>
  );
}
