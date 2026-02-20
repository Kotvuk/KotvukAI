const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

const httpRequestsInProgress = new client.Gauge({
  name: 'http_requests_in_progress',
  help: 'HTTP requests currently in progress',
  registers: [register],
});

function metricsMiddleware(req, res, next) {
  if (req.path === '/metrics') return next();

  const end = httpRequestDuration.startTimer();
  httpRequestsInProgress.inc();

  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    const labels = { method: req.method, route, status: res.statusCode };
    httpRequestsTotal.inc(labels);
    end(labels);
    httpRequestsInProgress.dec();
  });

  next();
}

function metricsEndpoint(req, res) {
  res.set('Content-Type', register.contentType);
  register.metrics().then((data) => res.end(data));
}

module.exports = { metricsMiddleware, metricsEndpoint, register };
