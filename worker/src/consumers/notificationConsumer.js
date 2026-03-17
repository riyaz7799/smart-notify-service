const logger = require('../logger');

class NotificationConsumer {
  constructor(rabbitmqClient, notificationProcessor) {
    this.rabbitmqClient = rabbitmqClient;
    this.notificationProcessor = notificationProcessor;
    this.messageRetryMap = new Map(); // Track retry attempts per messageId
  }

  async startConsuming(queueName) {
    try {
      await this.rabbitmqClient.assertQueue(queueName);
      
      await this.rabbitmqClient.consumeQueue(queueName, async (messageData, msg) => {
        return await this.processMessage(messageData, msg);
      });

      logger.info('NotificationConsumer started consuming', { queueName });
    } catch (error) {
      logger.error('Failed to start consuming', { queueName, error: error.message });
      throw error;
    }
  }

  async processMessage(messageData, msg) {
    try {
      logger.info('Processing message', {
        messageId: messageData.messageId,
        userId: messageData.targetUserId,
      });

      const result = await this.notificationProcessor.processNotification(messageData);

      // Clear retry count on success
      this.messageRetryMap.delete(messageData.messageId);

      return {
        success: true,
        message: 'Notification processed successfully',
      };
    } catch (error) {
      return await this.handleFailure(messageData, error, msg);
    }
  }

  async handleFailure(messageData, error, msg) {
    try {
      const currentRetry = this.messageRetryMap.get(messageData.messageId) || 0;
      const maxRetries = parseInt(process.env.MAX_RETRIES || 3, 10);

      logger.error('Message processing failed', {
        messageId: messageData.messageId,
        error: error.message,
        retryCount: currentRetry,
        maxRetries,
      });

      const failureResult = await this.notificationProcessor.handleFailure(
        messageData,
        error,
        currentRetry
      );

      if (failureResult.shouldRetry) {
        // Increment retry count and requeue
        this.messageRetryMap.set(messageData.messageId, currentRetry + 1);
        
        logger.info('Message will be requeued', {
          messageId: messageData.messageId,
          newRetryCount: failureResult.newRetryCount,
        });

        return {
          success: false,
          requeue: true,
          message: 'Message requeued for retry',
        };
      } else {
        // Max retries exceeded - reject and send to DLQ manually
        logger.error('Max retries exceeded, moving to DLQ', {
          messageId: messageData.messageId,
        });

        // Send to DLQ
        await this.sendToDLQ(messageData, error);

        // Clear retry map
        this.messageRetryMap.delete(messageData.messageId);

        return {
          success: false,
          requeue: false,
          message: 'Message moved to DLQ after max retries',
        };
      }
    } catch (handlingError) {
      logger.error('Critical error in failure handling', {
        messageId: messageData.messageId,
        error: handlingError.message,
      });

      return {
        success: false,
        requeue: false,
        message: 'Critical error, message rejected',
      };
    }
  }

  async sendToDLQ(messageData, originalError) {
    try {
      const dlqName = process.env.DLQ_NAME || 'notifications_dlq';
      await this.rabbitmqClient.assertQueue(dlqName);

      const dlqMessage = {
        ...messageData,
        failedAt: new Date().toISOString(),
        error: originalError.message,
        reason: 'Max retries exceeded',
      };

      const channel = this.rabbitmqClient.getChannel();
      channel.sendToQueue(dlqName, Buffer.from(JSON.stringify(dlqMessage)), {
        persistent: true,
        contentType: 'application/json',
      });

      logger.info('Message sent to DLQ', {
        messageId: messageData.messageId,
        dlqName,
      });
    } catch (error) {
      logger.error('Failed to send message to DLQ', {
        messageId: messageData.messageId,
        error: error.message,
      });
    }
  }
}

module.exports = NotificationConsumer;
