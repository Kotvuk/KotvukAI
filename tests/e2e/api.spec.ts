import { test, expect } from '@playwright/test'

test.describe('Public API endpoints', () => {
  test('klines endpoint returns data for BTCUSDT', async ({ request }) => {
    const res = await request.get('/api/klines?symbol=BTCUSDT&interval=1h&limit=10')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.candles)).toBe(true)
    expect(body.candles.length).toBeGreaterThan(0)
  })

  test('klines candle has expected fields', async ({ request }) => {
    const res = await request.get('/api/klines?symbol=BTCUSDT&interval=1h&limit=5')
    expect(res.status()).toBe(200)
    const body = await res.json()
    const candle = body.candles[0]
    expect(typeof candle.open).toBe('number')
    expect(typeof candle.high).toBe('number')
    expect(typeof candle.low).toBe('number')
    expect(typeof candle.close).toBe('number')
    expect(typeof candle.volume).toBe('number')
  })

  test('pairs endpoint returns array', async ({ request }) => {
    const res = await request.get('/api/pairs')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.pairs)).toBe(true)
    expect(body.pairs.length).toBeGreaterThan(10)
  })

  test('analyze requires auth', async ({ request }) => {
    const res = await request.post('/api/analyze', {
      data: { pair: 'BTCUSDT', timeframe: '1h' },
    })
    expect(res.status()).toBe(401)
  })

  test('signals requires auth', async ({ request }) => {
    const res = await request.get('/api/signals')
    expect(res.status()).toBe(401)
  })

  test('trades requires auth', async ({ request }) => {
    const res = await request.get('/api/trades')
    expect(res.status()).toBe(401)
  })
})
