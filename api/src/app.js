require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./logger');
const database = require('./database');
const rabbitmq = require('./rabbitmq');
const NotificationController = require('./controllers/notificationController');
const NotificationPublisher = require('./services/notificationPublisher');
const createNotificationRoutes = require('./routes/notificationRoutes');

const app = express();
// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
let notificationController;
let isReady = false;

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealthy = await database.isHealthy();
    const rmqHealthy = await rabbitmq.isHealthy();

    if (dbHealthy && rmqHealthy && isReady) {
      logger.info('Health check passed');
      return res.status(200).json({
        status: 'healthy',
        database: dbHealthy ? 'connected' : 'disconnected',
        rabbitmq: rmqHealthy ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      });
    } else {
      logger.warn('Health check failed', { dbHealthy, rmqHealthy, isReady });
      return res.status(503).json({
        status: 'unhealthy',
        database: dbHealthy ? 'connected' : 'disconnected',
        rabbitmq: rmqHealthy ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('Health check error', { error: error.message });
    return res.status(503).json({
      status: 'error',
      message: error.message
    });
  }
});

// Ready endpoint
app.get('/ready', (req, res) => {
  if (isReady) {
    return res.status(200).json({ status: 'ready' });
  } else {
    return res.status(503).json({ status: 'not ready' });
  }
});

// Initialize application
async function initializeApp() {
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

    // Assert queues
    await rabbitmq.assertQueue('notifications_queue', {
      durable: true,
      arguments: {
        'x-max-length': 10000,
      }
    });

    await rabbitmq.assertQueue('notifications_dlq', {
      durable: true,
    });

    // Initialize services
    const notificationPublisher = new NotificationPublisher(rabbitmq);
    notificationController = new NotificationController(notificationPublisher);

    // Setup routes
    app.use('/api', createNotificationRoutes(notificationController));

    isReady = true;
    logger.info('Application initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize application', { error: error.message });
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

// Start server
const PORT = process.env.API_PORT || 8080;

initializeApp().then(() => {
  app.listen(PORT, () => {
    logger.info(`API Server is running on port ${PORT}`);
  });
});

module.exports = app;
