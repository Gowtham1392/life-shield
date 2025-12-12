const { v4: uuidv4 } = require('uuid');

function requestIdMiddleware(req, res, next) {
    const existing = req.headers['x-request-id'];
    const requestId = existing || uuidv4();

    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    next();
}

module.exports = requestIdMiddleware;
