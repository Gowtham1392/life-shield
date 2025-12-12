const createApp = require('./app');
const logger = require('./logging/logger');

const PORT = process.env.PORT || 3000;

const app = createApp();

app.listen(PORT, () => {
    logger.info(`LifeShield API listening on port ${PORT}`, {
        port: PORT
    });
});
