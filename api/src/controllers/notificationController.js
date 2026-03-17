const logger = require('../logger');

class NotificationController {
  constructor(notificationPublisher) {
    this.notificationPublisher = notificationPublisher;
  }

  async createNotification(req, res) {
    try {
      const { targetUserId, type, payload } = req.body;

      // Validate input
      if (!targetUserId || !type || !payload) {
        logger.warn('Invalid notification request', { body: req.body });
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required fields: targetUserId, type, payload'
        });
      }

      if (typeof payload !== 'object' || payload === null) {
        logger.warn('Invalid payload format', { payload });
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Payload must be a JSON object'
        });
      }

      // Publish notification
      const result = await this.notificationPublisher.publish({
        targetUserId,
        type,
        payload,
      });

      logger.info('Notification created', {
        messageId: result.messageId,
        userId: targetUserId,
        type,
      });

      return res.status(202).json({
        messageId: result.messageId,
        status: result.status,
        message: 'Notification accepted for processing'
      });
    } catch (error) {
      logger.error('Failed to create notification', {
        error: error.message,
      });

      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to process notification'
      });
    }
  }
}

module.exports = NotificationController;
