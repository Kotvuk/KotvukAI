import { NextResponse } from 'next/server'
import { getPublicProfile } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: { uid: string } }) {
  const id = parseInt(params.uid, 10)
  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: 'Invalid id' }, { status: 400 })
  }

  try {
    const profile = await getPublicProfile(id)
    if (!profile) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, profile }, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
