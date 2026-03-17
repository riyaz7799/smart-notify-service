const NotificationController = require('../src/controllers/notificationController');

describe('NotificationController', () => {
  let mockPublisher;
  let controller;
  let mockRes;
  let mockReq;

  beforeEach(() => {
    mockPublisher = {
      publish: jest.fn(),
    };

    controller = new NotificationController(mockPublisher);

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockReq = {
      body: {},
      headers: {},
      path: '/api/notifications',
    };
  });

  describe('createNotification', () => {
    it('should return 202 Accepted on successful notification creation', async () => {
      mockReq.body = {
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'email',
        payload: {
          subject: 'Test',
          message: 'Test message',
        },
      };

      mockPublisher.publish.mockResolvedValueOnce({
        messageId: 'test-message-id',
        status: 'queued',
      });

      await controller.createNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(202);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'test-message-id',
          status: 'queued',
        })
      );
    });

    it('should return 400 Bad Request when required fields are missing', async () => {
      mockReq.body = {
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        // missing type and payload
      };

      await controller.createNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Bad Request',
        })
      );
    });

    it('should return 400 Bad Request when payload is not an object', async () => {
      mockReq.body = {
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'email',
        payload: 'not-an-object',
      };

      await controller.createNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 Internal Server Error when publishing fails', async () => {
      mockReq.body = {
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'email',
        payload: { subject: 'Test', message: 'Test' },
      };

      mockPublisher.publish.mockRejectedValueOnce(new Error('RabbitMQ error'));

      await controller.createNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('should accept complex payload structures', async () => {
      const complexPayload = {
        title: 'Order Shipped',
        message: 'Your order has been shipped',
        orderId: 'ORD-12345',
        link: 'https://example.com/track/ORD-12345',
        metadata: {
          shipping: 'FedEx',
          tracking: '1234567890',
        },
      };

      mockReq.body = {
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'in-app',
        payload: complexPayload,
      };

      mockPublisher.publish.mockResolvedValueOnce({
        messageId: 'test-message-id',
        status: 'queued',
      });

      await controller.createNotification(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(202);
      expect(mockPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: complexPayload,
        })
      );
    });
  });
});
