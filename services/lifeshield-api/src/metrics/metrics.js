const client = require('prom-client');

// Create a registry so we can add custom metrics
const register = new client.Registry();

// Collect default Node.js metrics (event loop lag, memory, etc.)
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status']
});

const httpRequestDurationSeconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request latency in seconds',
    labelNames: ['method', 'route']
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDurationSeconds);

function observeRequest(method, route, status, durationSeconds) {
    httpRequestsTotal.labels(method, route, String(status)).inc();
    httpRequestDurationSeconds.labels(method, route).observe(durationSeconds);
}

async function metricsHandler(req, res) {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
}

module.exports = {
    register,
    observeRequest,
    metricsHandler
};
