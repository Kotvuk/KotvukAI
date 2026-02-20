const { app } = require('./setup');
const request = require('supertest');

describe('API Integration Tests', () => {
  // Mock fetch for Binance endpoints
  beforeEach(() => {
    global.fetch.mockReset();
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve([]),
      ok: true,
    });
  });

  describe('Binance proxy routes', () => {
    test('GET /api/klines', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve([[1, '100', '110', '90', '105', '1000']]),
      });
      const res = await request(app).get('/api/klines?symbol=BTCUSDT&interval=1h&limit=10');
      expect(res.status).toBe(200);
    });

    test('GET /api/price - with symbol', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ symbol: 'BTCUSDT', price: '50000.00' }),
      });
      const res = await request(app).get('/api/price?symbol=BTCUSDT');
      expect(res.status).toBe(200);
    });

    test('GET /api/price - without symbol', async () => {
      const res = await request(app).get('/api/price');
      expect(res.status).toBe(400);
    });

    test('GET /api/prices', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve([
          { symbol: 'BTCUSDT', price: '50000' },
          { symbol: 'ETHUSDT', price: '3000' }
        ]),
      });
      const res = await request(app).get('/api/prices?symbols=BTCUSDT,ETHUSDT');
      expect(res.status).toBe(200);
    });

    test('GET /api/prices - no symbols', async () => {
      const res = await request(app).get('/api/prices');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('GET /api/ticker24h', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve([
          { symbol: 'BTCUSDT', priceChangePercent: '2.5', quoteVolume: '1000000' }
        ]),
      });
      const res = await request(app).get('/api/ticker24h');
      expect(res.status).toBe(200);
    });

    test('GET /api/ticker24h/single - with symbol', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ symbol: 'BTCUSDT', priceChangePercent: '2.5' }),
      });
      const res = await request(app).get('/api/ticker24h/single?symbol=BTCUSDT');
      expect(res.status).toBe(200);
    });

    test('GET /api/ticker24h/single - without symbol', async () => {
      const res = await request(app).get('/api/ticker24h/single');
      expect(res.status).toBe(400);
    });

    test('GET /api/fng', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ data: [{ value: '75', value_classification: 'Greed' }] }),
      });
      const res = await request(app).get('/api/fng');
      expect(res.status).toBe(200);
    });

    test('GET /api/exchangeInfo', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          symbols: [
            { symbol: 'BTCUSDT', quoteAsset: 'USDT', status: 'TRADING' },
            { symbol: 'ETHBTC', quoteAsset: 'BTC', status: 'TRADING' }
          ]
        }),
      });
      const res = await request(app).get('/api/exchangeInfo');
      expect(res.status).toBe(200);
      expect(res.body).toEqual(['BTCUSDT']);
    });

    test('GET /api/heatmap', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve([
          { symbol: 'BTCUSDT', quoteVolume: '5000000', priceChangePercent: '1.5' }
        ]),
      });
      const res = await request(app).get('/api/heatmap');
      expect(res.status).toBe(200);
    });

    test('GET /api/screener', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve([
          { symbol: 'BTCUSDT', quoteVolume: '5000000' }
        ]),
      });
      const res = await request(app).get('/api/screener');
      expect(res.status).toBe(200);
    });
  });

  describe('Whale routes', () => {
    test('GET /api/whale/orderbook', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ bids: [], asks: [] }),
      });
      const res = await request(app).get('/api/whale/orderbook?symbol=BTCUSDT');
      expect(res.status).toBe(200);
    });

    test('GET /api/whale/trades', async () => {
      global.fetch
        .mockResolvedValueOnce({ json: () => Promise.resolve([{ q: '1', p: '50000' }]) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ price: '50000' }) });
      const res = await request(app).get('/api/whale/trades?symbol=BTCUSDT');
      expect(res.status).toBe(200);
    });
  });

  describe('News', () => {
    test('GET /api/news', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ Data: [{ title: 'BTC hits ATH' }] }),
      });
      const res = await request(app).get('/api/news');
      expect(res.status).toBe(200);
    });
  });

  describe('Settings', () => {
    test('GET /api/settings', async () => {
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Dashboard', () => {
    test('GET /api/dashboard', async () => {
      // Mock the two fetch calls (ticker + fng)
      global.fetch
        .mockResolvedValueOnce({ json: () => Promise.resolve([{ symbol: 'BTCUSDT', priceChangePercent: '2.5', quoteVolume: '1000000' }]) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ data: [{ value: '50' }] }) });
      const res = await request(app).get('/api/dashboard');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalPnl');
      expect(res.body).toHaveProperty('signalAccuracy');
    });
  });

  describe('AI usage', () => {
    test('GET /api/ai/usage', async () => {
      const res = await request(app).get('/api/ai/usage');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('used');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('plan');
    });
  });

  describe('Error handling', () => {
    test('fetch failure returns 500', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      const res = await request(app).get('/api/klines');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });
});
