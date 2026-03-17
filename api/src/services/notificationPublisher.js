const { v4: uuidv4 } = require('uuid');
const logger = require('../logger');

class NotificationPublisher {
  constructor(rabbitmqClient) {
    this.rabbitmqClient = rabbitmqClient;
  }

  async publish(notificationData) {
    try {
      const messageId = uuidv4();
      const message = {
        messageId,
        targetUserId: notificationData.targetUserId,
        type: notificationData.type,
        payload: notificationData.payload,
        timestamp: new Date().toISOString(),
      };

      await this.rabbitmqClient.publishToQueue('notifications_queue', message);
      
      logger.info('Notification published successfully', {
        messageId,
        userId: notificationData.targetUserId,
        type: notificationData.type,
      });

      return {
        messageId,
        status: 'queued',
      };
    } catch (error) {
      logger.error('Failed to publish notification', {
        error: error.message,
        userId: notificationData.targetUserId,
      });
      throw error;
    }
  }
}

module.exports = NotificationPublisher;
