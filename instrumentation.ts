export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initDB } = await import('./lib/db')
    try {
      await initDB()
    } catch {
      // silent — non-fatal, DB may already be up-to-date
    }
  }
}
