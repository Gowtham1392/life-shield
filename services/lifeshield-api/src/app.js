const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const expressWinston = require('express-winston');

const logger = require('./logging/logger');
const requestIdMiddleware = require('./middleware/requestId');
const healthRouter = require('./routes/health');
const { metricsHandler, observeRequest } = require('./metrics/metrics');

function createApp() {
    const app = express();

    // Basic security headers
    app.use(helmet());

    // CORS – keep permissive for dev, tighten later if needed
    app.use(cors());

    // Parse JSON bodies
    app.use(express.json());

    // Attach requestId for correlation
    app.use(requestIdMiddleware);

    // HTTP request logging
    app.use(
        expressWinston.logger({
            winstonInstance: logger,
            meta: true,
            msg: 'HTTP {{req.method}} {{req.url}}',
            expressFormat: false,
            colorize: false,
            dynamicMeta: (req, res) => ({
                requestId: req.requestId,
                ip: req.ip
            })
        })
    );

    // Timing middleware for metrics
    app.use((req, res, next) => {
        const start = process.hrtime.bigint();

        res.on('finish', () => {
            const end = process.hrtime.bigint();
            const durationNs = Number(end - start);
            const durationSeconds = durationNs / 1e9;

            const route = req.route && req.route.path ? req.route.path : req.path;
            observeRequest(req.method, route, res.statusCode, durationSeconds);
        });

        next();
    });

    // Routes
    app.use('/', healthRouter);

    // Metrics endpoint
    app.get('/metrics', metricsHandler);

    // Error handler (simple for now, we’ll upgrade later)
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
        logger.error('Unhandled error', {
            error: err.message,
            stack: err.stack,
            requestId: req.requestId
        });

        res.status(500).json({
            errorCode: 'INTERNAL_ERROR',
            message: 'Unexpected server error'
        });
    });

    return app;
}

module.exports = createApp;
