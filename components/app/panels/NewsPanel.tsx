'use client'
import { useEffect, useState } from 'react'
import { useLang } from '@/contexts/LangContext'

interface NewsItem {
  title: string; link: string; source: string; time: string; tag: string; sentiment: string
}

export default function NewsPanel() {
  const { t } = useLang()
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadNews() }, [])

  async function loadNews() {
    setLoading(true)
    try {
      const r = await fetch('/api/news')
      const d = await r.json()
      if (d.ok && d.items) setItems(d.items)
      else setItems([])
    } catch { setItems([]) }
    setLoading(false)
  }

  return (
    <div className="panel active" id="panel-news">
      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--line2)' }}>
          <span className="sec" style={{ margin: 0, border: 'none', padding: 0 }}>{t('crypto_feed')}</span>
          <button className="run" onClick={loadNews} style={{ padding: '4px 11px', fontSize: '.6rem' }}>{t('refresh')}</button>
        </div>
        <div className="tbox" id="newsFeed">
          {loading && (
            <div className="loading"><div className="ld-bar" /><div className="ld-t">{t('fetching')}</div></div>
          )}
          {!loading && !items.length && (
            <div className="empty">
              <div className="empty-t">{t('no_news')}</div>
              <div className="empty-s">{t('rss_unavailable')}</div>
            </div>
          )}
          {!loading && items.map((n, i) => (
            <div className="ni" key={i} onClick={() => n.link && window.open(n.link, '_blank')}>
              <div className="nd" style={{ background: n.sentiment === 'bull' ? 'var(--long)' : n.sentiment === 'bear' ? 'var(--short)' : 'var(--dim)' }} />
              <div className="nb2">
                <div className="nt">{n.title}</div>
                <div className="nm">
                  <span className={`tag tag-${n.sentiment === 'bull' ? 'bull' : n.sentiment === 'bear' ? 'bear' : 'neut'}`} style={{ fontSize: '.52rem' }}>{n.tag}</span>
                  <span className="ns">{n.source}</span>
                  <span className="ntime">{n.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
