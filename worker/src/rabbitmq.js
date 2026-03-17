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
      
      // Set prefetch to process one message at a time
      await this.channel.prefetch(1);

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
      // Attempt to delete the ephemeral queue; ignore errors
      try {
        await this.channel.deleteQueue(q.queue);
      } catch (_) {}
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

  async assertDeadLetterExchange(dlqName) {
    try {
      const exchangeName = `${dlqName}_exchange`;
      await this.channel.assertExchange(exchangeName, 'direct', { durable: true });
      await this.assertQueue(dlqName, {
        durable: true,
        deadLetterExchange: '',
      });
      await this.channel.bindQueue(dlqName, exchangeName, dlqName);
      logger.info('Dead Letter Queue setup complete', { dlqName });
    } catch (error) {
      logger.error('Failed to setup DLQ', { dlqName, error: error.message });
      throw error;
    }
  }

  async consumeQueue(queueName, callback) {
    try {
      await this.assertQueue(queueName);
      
      this.channel.consume(queueName, async (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            logger.info('Message consumed', { messageId: content.messageId, queueName });
            
            const result = await callback(content, msg);
            
            if (result.success) {
              this.channel.ack(msg);
              logger.info('Message acknowledged', { messageId: content.messageId });
            } else {
              // Will be handled by nack with requeue
              if (result.requeue) {
                this.channel.nack(msg, false, true);
                logger.warn('Message requeued', { messageId: content.messageId });
              } else {
                this.channel.nack(msg, false, false);
                logger.error('Message rejected', { messageId: content.messageId });
              }
            }
          } catch (error) {
            logger.error('Error processing message', {
              error: error.message,
              messageId: msg.content.toString()
            });
            this.channel.nack(msg, false, false);
          }
        }
      }, { noAck: false });

      logger.info('Started consuming from queue', { queueName });
    } catch (error) {
      logger.error('Failed to consume queue', { queueName, error: error.message });
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
