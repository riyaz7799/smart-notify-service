const NotificationPublisher = require('../src/services/notificationPublisher');

describe('NotificationPublisher', () => {
  let mockRabbitmqClient;
  let notificationPublisher;

  beforeEach(() => {
    mockRabbitmqClient = {
      publishToQueue: jest.fn().mockResolvedValue(true),
    };

    notificationPublisher = new NotificationPublisher(mockRabbitmqClient);
  });

  describe('publish', () => {
    it('should publish a notification with required fields', async () => {
      const notificationData = {
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'email',
        payload: {
          subject: 'Test Email',
          message: 'This is a test',
        },
      };

      const result = await notificationPublisher.publish(notificationData);

      expect(result.messageId).toBeDefined();
      expect(result.status).toBe('queued');
      expect(mockRabbitmqClient.publishToQueue).toHaveBeenCalledWith(
        'notifications_queue',
        expect.objectContaining({
          messageId: result.messageId,
          targetUserId: notificationData.targetUserId,
          type: notificationData.type,
          payload: notificationData.payload,
          timestamp: expect.any(String),
        })
      );
    });

    it('should include timestamp in published message', async () => {
      const notificationData = {
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'in-app',
        payload: { title: 'Hello', message: 'World' },
      };

      await notificationPublisher.publish(notificationData);

      const callArgs = mockRabbitmqClient.publishToQueue.mock.calls[0][1];
      expect(callArgs.timestamp).toBeDefined();
      expect(new Date(callArgs.timestamp)).not.toBeNaN();
    });

    it('should generate unique messageId for each notification', async () => {
      const notificationData = {
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'email',
        payload: { subject: 'Test', message: 'Test' },
      };

      const result1 = await notificationPublisher.publish(notificationData);
      const result2 = await notificationPublisher.publish(notificationData);

      expect(result1.messageId).not.toBe(result2.messageId);
    });

    it('should handle publishing errors gracefully', async () => {
      mockRabbitmqClient.publishToQueue.mockRejectedValueOnce(
        new Error('RabbitMQ connection failed')
      );

      const notificationData = {
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'email',
        payload: { subject: 'Test', message: 'Test' },
      };

      await expect(notificationPublisher.publish(notificationData)).rejects.toThrow(
        'RabbitMQ connection failed'
      );
    });
  });
});
