export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const RSS_FEEDS = [
  'https://cointelegraph.com/rss',
  'https://coindesk.com/arc/outboundfeeds/rss/',
]

interface RSSItem {
  title: string; link: string; pubDate: string; source: string
}

async function fetchRSS(url: string): Promise<RSSItem[]> {
  try {
    const Parser = (await import('rss-parser')).default
    const parser = new Parser({ timeout: 8000 })
    const feed = await parser.parseURL(url)
    const source = feed.title?.split(' ')[0] || 'News'
    return (feed.items || []).slice(0, 10).map(item => ({
      title: item.title || '',
      link: item.link || '',
      pubDate: item.pubDate || '',
      source,
    }))
  } catch {
    return []
  }
}

function getSentiment(title: string): { sentiment: string; tag: string } {
  const bullWords = /bull|rally|surge|soar|pump|breakout|ath|rise|gain|moon|buy|long|bullish|growth|up/i
  const bearWords = /bear|crash|dump|drop|fall|plunge|sell|short|bearish|decline|down|loss|fear|panic/i
  if (bullWords.test(title)) return { sentiment: 'bull', tag: 'BULLISH' }
  if (bearWords.test(title)) return { sentiment: 'bear', tag: 'BEARISH' }
  return { sentiment: 'neut', tag: 'NEUTRAL' }
}

function timeAgo(dateStr: string): string {
  try {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 60000
    if (diff < 60) return Math.round(diff) + 'm ago'
    if (diff < 1440) return Math.round(diff / 60) + 'h ago'
    return Math.round(diff / 1440) + 'd ago'
  } catch { return '' }
}

export async function GET() {
  try {
    const results = await Promise.allSettled(RSS_FEEDS.map(fetchRSS))
    const all: RSSItem[] = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])

    // Sort by date
    all.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

    const items = all.slice(0, 30).map(item => ({
      title: item.title,
      link: item.link,
      source: item.source,
      time: timeAgo(item.pubDate),
      ...getSentiment(item.title),
    }))

    return NextResponse.json({ ok: true, items })
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'RSS error' }, { status: 500 })
  }
}
