import { NextRequest, NextResponse } from 'next/server'

const analyzeLastCall = new Map<string, number>()
const ANALYZE_COOLDOWN_MS = 10_000 // 10 секунд между запросами

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('fb_token')?.value
  const { pathname } = req.nextUrl

  const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/admin')
  const isApiProtected = pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/sync') &&
    !pathname.startsWith('/api/klines') &&
    !pathname.startsWith('/api/ticker') &&
    !pathname.startsWith('/api/news') &&
    !pathname.startsWith('/api/analyze/test') &&
    !pathname.startsWith('/api/analyze/batch') &&
    !pathname.startsWith('/api/analyze/auto') &&
    !pathname.startsWith('/api/telegram/webhook') &&
    !pathname.startsWith('/api/billing/webhook')

  if ((isProtected || isApiProtected) && !token) {
    if (isApiProtected) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (pathname === '/api/analyze' && token && req.method === 'POST') {
    const now = Date.now()
    const last = analyzeLastCall.get(token.slice(-16)) // последние 16 символов как ключ
    if (last && now - last < ANALYZE_COOLDOWN_MS) {
      const retryAfter = Math.ceil((ANALYZE_COOLDOWN_MS - (now - last)) / 1000)
      return NextResponse.json(
        { ok: false, error: `Слишком частые запросы. Подождите ${retryAfter} сек.` },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }
    analyzeLastCall.set(token.slice(-16), now)
    if (analyzeLastCall.size % 100 === 0) {
      const cutoff = now - 60_000
      analyzeLastCall.forEach((v, k) => { if (v < cutoff) analyzeLastCall.delete(k) })
    }
  }

  if ((pathname === '/' || pathname === '/login' || pathname === '/register') && token) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/admin/:path*', '/api/:path*', '/login', '/register', '/api/telegram/:path*'],
}
