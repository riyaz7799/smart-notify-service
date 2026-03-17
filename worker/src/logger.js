const logger = require('winston');


logger.configure({
  level: process.env.LOG_LEVEL || 'info',
  format: logger.format.combine(
    logger.format.timestamp(),
    logger.format.errors({ stack: true }),
    logger.format.json()
  ),
  defaultMeta: { service: 'worker' },
  transports: [
    new logger.transports.Console({
      format: logger.format.combine(
        logger.format.timestamp(),
        logger.format.printf(info => {
          return JSON.stringify({
            timestamp: info.timestamp,
            level: info.level,
            message: info.message,
            service: info.service,
            ...info
          });
        })
      )
    })
  ]
});

module.exports = logger;
