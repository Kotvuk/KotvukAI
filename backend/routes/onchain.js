const express = require('express');
const router = express.Router();
const onchain = require('../services/onchain');

router.get('/nupl', async (req, res) => {
  try {
    const { asset = 'BTC' } = req.query;
    res.json(await onchain.getNUPL(asset));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/sopr', async (req, res) => {
  try {
    const { asset = 'BTC' } = req.query;
    res.json(await onchain.getSOPR(asset));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/addresses', async (req, res) => {
  try {
    const { asset = 'BTC' } = req.query;
    res.json(await onchain.getActiveAddresses(asset));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/exchange-flows', async (req, res) => {
  try {
    const { asset = 'BTC' } = req.query;
    res.json(await onchain.getExchangeFlows(asset));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/metrics', async (req, res) => {
  try {
    const { asset = 'BTC' } = req.query;
    res.json(await onchain.getAggregatedMetrics(asset));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
