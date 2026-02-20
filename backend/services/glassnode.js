const GLASSNODE_API_KEY = process.env.GLASSNODE_API_KEY || '';
const BASE_URL = 'https://api.glassnode.com/v1/metrics';

async function glassnodeFetch(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set('a', params.asset || 'BTC');
  url.searchParams.set('api_key', GLASSNODE_API_KEY);
  if (params.s) url.searchParams.set('s', params.s);
  if (params.u) url.searchParams.set('u', params.u);
  if (params.i) url.searchParams.set('i', params.i);

  const r = await fetch(url.toString());
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Glassnode API error ${r.status}: ${text}`);
  }
  return r.json();
}

async function getNUPL(asset = 'BTC') {
  return glassnodeFetch('indicators/net_unrealized_profit_loss', { asset, i: '24h' });
}

async function getSOPR(asset = 'BTC') {
  return glassnodeFetch('indicators/sopr', { asset, i: '24h' });
}

async function getActiveAddresses(asset = 'BTC') {
  return glassnodeFetch('addresses/active_count', { asset, i: '24h' });
}

async function getExchangeFlows(asset = 'BTC') {
  const [inflow, outflow] = await Promise.all([
    glassnodeFetch('transactions/transfers_volume_to_exchanges_sum', { asset, i: '24h' }),
    glassnodeFetch('transactions/transfers_volume_from_exchanges_sum', { asset, i: '24h' })
  ]);
  return { inflow, outflow };
}

async function getAggregatedMetrics(asset = 'BTC') {
  const results = {};
  const fetches = [
    ['nupl', () => getNUPL(asset)],
    ['sopr', () => getSOPR(asset)],
    ['activeAddresses', () => getActiveAddresses(asset)],
    ['exchangeFlows', () => getExchangeFlows(asset)]
  ];

  await Promise.all(fetches.map(async ([key, fn]) => {
    try { results[key] = await fn(); } catch (e) { results[key] = { error: e.message }; }
  }));

  return results;
}

module.exports = { getNUPL, getSOPR, getActiveAddresses, getExchangeFlows, getAggregatedMetrics };
