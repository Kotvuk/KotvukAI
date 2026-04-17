/**
 * Next.js instrumentation — запускается один раз при старте сервера.
 * Вызывает initDB() чтобы гарантировать применение всех ALTER TABLE миграций
 * даже при холодном старте (до первого логина пользователя).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initDB } = await import('./lib/db')
    try {
      await initDB()
      console.log('[instrumentation] DB initialized')
    } catch (e) {
      console.error('[instrumentation] initDB failed:', e)
    }
  }
}
