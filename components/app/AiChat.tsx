'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useLang } from '@/contexts/LangContext'

type Panel = 'dash' | 'ai' | 'trades' | 'news' | 'notifs' | 'history'

interface Message {
  role: 'user' | 'assistant'
  text: string
  action?: unknown
}

interface ChatContext {
  pair?: string; tf?: string; price?: number
  tp?: number; sl?: number; entry?: number; verdict?: string
  smc?: unknown
}

interface Props {
  onNavigate?: (panel: Panel) => void
  getContext?: () => ChatContext
}

export default function AiChat({ onNavigate, getContext }: Props) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: t('chat_welcome') },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [open, messages])

  const send = useCallback(async () => {
    const msg = input.trim()
    if (!msg || thinking) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg }])
    setThinking(true)

    try {
      const ctx = getContext?.() || {}
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context: ctx }),
      })
      const data = await r.json()
      const text = data.text || 'Готово!'
      const action = data.action || null

      setMessages(prev => [...prev, { role: 'assistant', text, action }])

      if (action) {
        dispatchAction(action)
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Ошибка соединения. Проверьте GROQ_API_KEY.' }])
    }
    setThinking(false)
  }, [input, thinking, getContext])

  function dispatchAction(action: Record<string, unknown>) {
    const type = action.type as string

    if (type === 'navigate_panel' && action.panel) {
      onNavigate?.(action.panel as Panel)
      return
    }

    window.dispatchEvent(new CustomEvent(`kotvuk:${type}`, { detail: action }))
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <>
      {}
      <button
        className={`chat-fab ${open ? 'active' : ''}`}
        onClick={() => setOpen(v => !v)}
        title={t('chat_title')}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
        )}
        {!open && <span className="chat-fab-label">{t('nav_chat')}</span>}
      </button>

      {}
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <span className="chat-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ width: 14, height: 14 }}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
            </span>
            <span>{t('chat_title')}</span>
            <button className="chat-close" onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.role === 'assistant' && (
                  <div className="chat-msg-avatar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ width: 10, height: 10 }}><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg>
                  </div>
                )}
                <div className="chat-msg-bubble">
                  <div className="chat-msg-text">{m.text}</div>
                  {!!m.action && (
                    <div className="chat-msg-action">
                      ⚡ {((m.action as Record<string,unknown>).type) as string}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="chat-msg assistant">
                <div className="chat-msg-avatar">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" style={{ width: 10, height: 10 }}><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg>
                </div>
                <div className="chat-msg-bubble">
                  <div className="chat-typing"><span/><span/><span/></div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <input
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={t('chat_placeholder')}
              disabled={thinking}
            />
            <button
              className="chat-submit"
              onClick={send}
              disabled={thinking || !input.trim()}
            >
              {thinking ? '…' : t('chat_send')}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
