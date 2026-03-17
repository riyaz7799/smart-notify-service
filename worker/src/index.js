require('dotenv').config();
const logger = require('./logger');
const database = require('./database');
const rabbitmq = require('./rabbitmq');
const NotificationProcessor = require('./services/notificationProcessor');
const NotificationConsumer = require('./consumers/notificationConsumer');


// Initialize and start worker
async function startWorker() {
  try {
    // Connect to database
    const dbConnected = await database.connect();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Connect to RabbitMQ
    const rmqConnected = await rabbitmq.connect();
    if (!rmqConnected) {
      throw new Error('Failed to connect to RabbitMQ');
    }

    // Initialize services
    const notificationProcessor = new NotificationProcessor(database);
    const notificationConsumer = new NotificationConsumer(rabbitmq, notificationProcessor);

    // Start consuming
    const queueName = process.env.QUEUE_NAME || 'notifications_queue';
    await notificationConsumer.startConsuming(queueName);

    logger.info('Worker started successfully');
  } catch (error) {
    logger.error('Failed to start worker', { error: error.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await database.disconnect();
  await rabbitmq.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await database.disconnect();
  await rabbitmq.disconnect();
  process.exit(0);
});

// Start the worker
startWorker();
