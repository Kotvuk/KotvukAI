const app = require('./app');
const { checkAlerts } = require('./services/alertChecker');
const { checkTradeTPSL } = require('./services/tradeChecker');
const { checkPendingSignals } = require('./services/signalChecker');

// Run periodic checks
setInterval(checkAlerts, 10000);
setInterval(checkTradeTPSL, 10000);
setInterval(checkPendingSignals, 60000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`KotvukAI backend running on port ${PORT}`));
