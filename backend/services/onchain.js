const glassnode = require('./glassnode');

// On-chain metrics service - wraps glassnode with caching
const cache = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCached(key, fetcher) {
  const now = Date.now();
  if (cache[key] && now - cache[key].ts < CACHE_TTL) {
    return cache[key].data;
  }
  const data = await fetcher();
  cache[key] = { data, ts: now };
  return data;
}

async function getNUPL(asset) {
  return getCached(`nupl_${asset}`, () => glassnode.getNUPL(asset));
}

async function getSOPR(asset) {
  return getCached(`sopr_${asset}`, () => glassnode.getSOPR(asset));
}

async function getActiveAddresses(asset) {
  return getCached(`addresses_${asset}`, () => glassnode.getActiveAddresses(asset));
}

async function getExchangeFlows(asset) {
  return getCached(`flows_${asset}`, () => glassnode.getExchangeFlows(asset));
}

async function getAggregatedMetrics(asset) {
  return getCached(`metrics_${asset}`, () => glassnode.getAggregatedMetrics(asset));
}

module.exports = { getNUPL, getSOPR, getActiveAddresses, getExchangeFlows, getAggregatedMetrics };
