function isWeekend() {
  const day = new Date().getUTCDay()
  return day === 0 || day === 6
}

function detectTfs() {
  const now  = new Date()
  const min  = now.getUTCMinutes()
  const hour = now.getUTCHours()
  const tfs  = ['15m']
  if (min % 30 === 0) tfs.push('30m')
  if (min === 0)      tfs.push('1h')
  if (min === 0 && hour % 4 === 0) tfs.push('4h')
  return tfs
}

export default {
  async scheduled(event, env, ctx) {
    if (isWeekend()) return
    ctx.waitUntil(runAnalysis(env, detectTfs()))
  },

  async fetch(req, env) {
    const url = new URL(req.url)
    if (url.pathname !== '/trigger') return new Response('KotvukAI Worker', { status: 200 })

    const tf = url.searchParams.get('tf') || ''
    const tfs = tf === 'all' ? ['15m', '30m', '1h', '4h'] : tf ? [tf] : null
    if (!tfs) return new Response('?tf=15m|30m|1h|4h|all required', { status: 400 })

    const results = await runAnalysis(env, tfs)
    return Response.json(results)
  },
}

async function runAnalysis(env, tfs) {
  const base   = env.APP_URL.replace(/^﻿/, '').trim().replace(/\/$/, '')
  const secret = env.AUTO_ANALYZE_SECRET.replace(/^﻿/, '').trim()

  const urls = []
  for (const tf of tfs) {
    for (let batch = 0; batch < 3; batch++) {
      urls.push(`${base}/api/analyze/auto?secret=${secret}&batch=${batch}&tf=${tf}`)
    }
  }
  urls.push(`${base}/api/signals/auto-check?secret=${secret}`)

  const settled = await Promise.allSettled(
    urls.map(url => fetch(url, { signal: AbortSignal.timeout(65_000) }).then(r => r.json()))
  )

  return settled.map((r, i) => ({
    url:    urls[i].replace(secret, '***'),
    ok:     r.status === 'fulfilled',
    result: r.status === 'fulfilled' ? r.value : String(r.reason),
  }))
}
