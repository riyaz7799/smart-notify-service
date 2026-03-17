const amqp = require('amqplib');
const logger = require('./logger');

class RabbitMQClient {
  constructor() {
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    try {
      this.connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq');
      this.channel = await this.connection.createChannel();
      // Prevent unhandled channel/connection errors from crashing the process
      this.connection.on('error', (err) => {
        logger.error('RabbitMQ connection error', { error: err.message });
      });
      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
      });
      this.channel.on('error', (err) => {
        logger.error('RabbitMQ channel error', { error: err.message });
      });
      this.channel.on('close', () => {
        logger.warn('RabbitMQ channel closed');
      });
      
      logger.info('RabbitMQ connected successfully');
      return true;
    } catch (error) {
      logger.error('RabbitMQ connection failed', { error: error.message });
      return false;
    }
  }

  async isHealthy() {
    try {
      if (!this.channel) {
        return false;
      }
      // Use an ephemeral server-named queue to validate channel operations
      const q = await this.channel.assertQueue('', {
        durable: false,
        exclusive: true,
        autoDelete: true,
      });
      // Clean up explicitly (autoDelete will handle it too)
      try {
        await this.channel.deleteQueue(q.queue);
      } catch (_) {
        // Ignore delete failures for ephemeral queues
      }
      return true;
    } catch (error) {
      logger.error('RabbitMQ health check failed', { error: error.message });
      return false;
    }
  }

  
  async assertQueue(queueName, options = {}) {
    try {
      const defaultOptions = {
        durable: true,
        arguments: {
          'x-max-length': 10000,
        },
      };
      const finalOptions = { ...defaultOptions, ...options };
      await this.channel.assertQueue(queueName, finalOptions);
      logger.info('Queue asserted', { queueName });
    } catch (error) {
      logger.error('Failed to assert queue', { queueName, error: error.message });
      throw error;
    }
  }

  async publishToQueue(queueName, message) {
    try {
      await this.assertQueue(queueName);
      const published = this.channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        contentType: 'application/json',
      });
      
      if (published) {
        logger.info('Message published to queue', { queueName, messageId: message.messageId });
      } else {
        logger.warn('Message queue full', { queueName });
      }
      
      return published;
    } catch (error) {
      logger.error('Failed to publish message', { queueName, error: error.message });
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      logger.info('RabbitMQ disconnected');
    } catch (error) {
      logger.error('Failed to disconnect from RabbitMQ', { error: error.message });
    }
  }

  getChannel() {
    return this.channel;
  }
}

module.exports = new RabbitMQClient();
