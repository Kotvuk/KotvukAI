import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('fb_token')?.value
  const { pathname } = req.nextUrl

  // Protect /dashboard and all API routes (except auth/sync and public)
  const isProtected = pathname.startsWith('/dashboard')
  const isApiProtected = pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/sync') &&
    !pathname.startsWith('/api/klines')

  if ((isProtected || isApiProtected) && !token) {
    if (isApiProtected) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Redirect authenticated users away from login/register
  if ((pathname === '/login' || pathname === '/register') && token) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*', '/login', '/register'],
}
