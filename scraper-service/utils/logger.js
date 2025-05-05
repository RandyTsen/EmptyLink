const pino = require('pino');

const logger = pino({
    level: process.env.LOG_LEVEL || 'info', // Set log level from environment variable or default to 'info'
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true, // Enable colorized output
            translateTime: 'SYS:standard', // Format the timestamp
            ignore: 'pid,hostname' // Ignore pid and hostname in logs
        }
    }
});

module.exports = logger;