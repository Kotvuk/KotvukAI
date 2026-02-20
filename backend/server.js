const app = require('./app');
const { checkAlerts } = require('./services/alertChecker');
const { checkTradeTPSL } = require('./services/tradeChecker');
const { checkPendingSignals } = require('./services/signalChecker');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`KotvukAI backend running on port ${PORT}`);
  // Start periodic checks after server is ready
  setInterval(() => { checkAlerts().catch(e => console.error('Alert check error:', e.message)); }, 30000);
  setInterval(() => { checkTradeTPSL().catch(e => console.error('Trade check error:', e.message)); }, 30000);
  setInterval(() => { checkPendingSignals().catch(e => console.error('Signal check error:', e.message)); }, 60000);
});
