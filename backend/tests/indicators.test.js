const { calcEMA, calcRSI, calcMACD, calcIndicators } = require('./setup');

describe('calcEMA', () => {
  test('returns null when data length < period', () => {
    expect(calcEMA([1, 2, 3], 9)).toBeNull();
    expect(calcEMA([], 5)).toBeNull();
    expect(calcEMA([10], 2)).toBeNull();
  });

  test('EMA with exact period length equals SMA', () => {
    const closes = [10, 20, 30, 40, 50];
    expect(calcEMA(closes, 5)).toBe(30); // SMA = 150/5
  });

  test('EMA period 9 on rising data', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const result = calcEMA(closes, 9);
    expect(result).not.toBeNull();
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(100);
  });

  test('EMA period 21', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 50000 + i * 100);
    const result = calcEMA(closes, 21);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(50000);
  });

  test('EMA period 50', () => {
    const closes = Array.from({ length: 60 }, (_, i) => 1000 + Math.sin(i) * 50);
    expect(calcEMA(closes, 50)).not.toBeNull();
  });

  test('EMA period 200', () => {
    const closes = Array.from({ length: 250 }, (_, i) => 40000 + i * 10);
    const result = calcEMA(closes, 200);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(40000);
  });

  test('EMA weights recent prices more heavily', () => {
    // Rising series: EMA should be above SMA
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i * 10);
    const ema = calcEMA(closes, 9);
    const sma = closes.reduce((a, b) => a + b, 0) / closes.length;
    expect(ema).toBeGreaterThan(sma);
  });
});

describe('calcRSI', () => {
  test('returns null for insufficient data', () => {
    expect(calcRSI([1, 2, 3], 14)).toBeNull();
    expect(calcRSI([], 14)).toBeNull();
    // Need period+1 data points minimum
    expect(calcRSI(Array.from({ length: 14 }, (_, i) => i), 14)).toBeNull();
  });

  test('returns 100 for all gains (avgLoss === 0)', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(calcRSI(closes, 14)).toBe(100);
  });

  test('returns low value for all losses', () => {
    const closes = Array.from({ length: 20 }, (_, i) => 200 - i);
    const result = calcRSI(closes, 14);
    expect(result).toBeLessThan(5);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  test('mixed data returns value between 0 and 100', () => {
    const closes = [44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84,
      46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
    const result = calcRSI(closes, 14);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(100);
  });

  test('default period is 14', () => {
    const closes = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 10);
    const result = calcRSI(closes);
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  test('custom period', () => {
    const closes = Array.from({ length: 15 }, (_, i) => 100 + Math.sin(i) * 5);
    const result = calcRSI(closes, 7);
    expect(result).not.toBeNull();
  });
});

describe('calcMACD', () => {
  test('returns null for insufficient data (< 26 points)', () => {
    expect(calcMACD(Array.from({ length: 20 }, (_, i) => 100 + i))).toBeNull();
  });

  test('calculates MACD for sufficient data', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i + Math.sin(i) * 5);
    const result = calcMACD(closes);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('macd');
    expect(result).toHaveProperty('signal');
    expect(result).toHaveProperty('histogram');
    expect(typeof result.macd).toBe('number');
  });

  test('MACD positive for strong uptrend', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
    const result = calcMACD(closes);
    expect(result.macd).toBeGreaterThan(0);
  });

  test('MACD negative for strong downtrend', () => {
    const closes = Array.from({ length: 50 }, (_, i) => 200 - i * 2);
    const result = calcMACD(closes);
    expect(result.macd).toBeLessThan(0);
  });
});

describe('calcIndicators', () => {
  test('handles empty klines', () => {
    const result = calcIndicators([]);
    expect(result.rsi14).toBeNull();
    expect(result.ema9).toBeNull();
    expect(result.macd).toBeNull();
    expect(result.lastClose).toBeNaN(); // no data
  });

  test('calculates all indicators with 250+ klines', () => {
    const klines = Array.from({ length: 250 }, (_, i) => [
      Date.now() - (250 - i) * 3600000,
      String(40000 + i * 10),
      String(40100 + i * 10),
      String(39900 + i * 10),
      String(40050 + i * 10),
      String(1000 + i),
    ]);
    const result = calcIndicators(klines);
    expect(result.rsi14).not.toBeNull();
    expect(result.ema9).not.toBeNull();
    expect(result.ema21).not.toBeNull();
    expect(result.ema50).not.toBeNull();
    expect(result.ema200).not.toBeNull();
    expect(result.macd).not.toBeNull();
    expect(typeof result.lastClose).toBe('number');
  });

  test('returns null for indicators needing more data than available', () => {
    const klines = Array.from({ length: 10 }, (_, i) => [
      Date.now(), '100', '110', '90', String(100 + i), '1000'
    ]);
    const result = calcIndicators(klines);
    expect(result.ema9).not.toBeNull();  // 10 >= 9
    expect(result.ema21).toBeNull();     // 10 < 21
    expect(result.ema50).toBeNull();
    expect(result.ema200).toBeNull();
    expect(result.macd).toBeNull();      // needs 26
  });

  test('uses index [4] (close price) from klines', () => {
    const klines = [[0, '10', '15', '5', '42.5', '100']];
    const result = calcIndicators(klines);
    expect(result.lastClose).toBe(42.5);
  });
});
