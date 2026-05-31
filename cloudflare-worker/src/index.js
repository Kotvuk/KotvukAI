export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAnalysis(env, new Date(event.scheduledTime)))
  },

  async fetch(req, env) {
    const url = new URL(req.url)
    if (url.pathname !== '/trigger') return new Response('KotvukAI Worker', { status: 200 })

    const tf = url.searchParams.get('tf') || ''
    const tfs = tf === 'all' ? ['5m', '15m', '1h', '4h'] : tf ? [tf] : null
    if (!tfs) return new Response('?tf=5m|15m|1h|4h|all required', { status: 400 })

    const results = await runAnalysis(env, new Date(), tfs)
    return Response.json(results)
  },
}

async function runAnalysis(env, now, forceTfs) {
  const min  = now.getUTCMinutes()
  const hour = now.getUTCHours()

  const tfs = forceTfs ?? (() => {
    const list = []
    if (min === 0 && hour % 4 === 0) list.push('4h')
    if (min === 0)      list.push('1h')
    if (min % 30 === 0) list.push('30m')
    if (min % 15 === 0) list.push('15m')
    return list
  })()

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
