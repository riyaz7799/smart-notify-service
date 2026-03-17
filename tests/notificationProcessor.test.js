const NotificationProcessor = require('../src/services/notificationProcessor');

describe('NotificationProcessor', () => {
  let mockDatabase;
  let processor;
  let mockClient;

  
  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockDatabase = {
      getPool: jest.fn().mockReturnValue({
        connect: jest.fn().mockResolvedValue(mockClient),
      }),
    };

    processor = new NotificationProcessor(mockDatabase);
  });

  describe('processNotification', () => {
    it('should insert notification successfully', async () => {
      const messageData = {
        messageId: 'test-message-id',
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'email',
        payload: { subject: 'Test', message: 'Test' },
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Idempotency check
        .mockResolvedValueOnce({ rows: [{ id: 'notification-id' }] }) // Insert
        .mockResolvedValueOnce({ rows: [] }); // Update processed_at

      const result = await processor.processNotification(messageData);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockClient.query).toHaveBeenCalledTimes(4); // BEGIN + idempotency + insert + update + COMMIT
    });

    it('should handle duplicate messages (idempotency)', async () => {
      const messageData = {
        messageId: 'duplicate-message-id',
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'email',
        payload: { subject: 'Test', message: 'Test' },
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'existing-id', status: 'processed' }] }) // Idempotency check finds duplicate
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      const result = await processor.processNotification(messageData);

      expect(result.success).toBe(true);
      expect(result.reason).toBe('Duplicate message (idempotency)');
    });

    it('should rollback on error', async () => {
      const messageData = {
        messageId: 'test-message-id',
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'email',
        payload: { subject: 'Test', message: 'Test' },
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Idempotency check
        .mockRejectedValueOnce(new Error('Database error')); // Simulate error

      await expect(processor.processNotification(messageData)).rejects.toThrow(
        'Database error'
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should store payload as JSON', async () => {
      const messageData = {
        messageId: 'test-message-id',
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'in-app',
        payload: {
          title: 'Hello',
          message: 'World',
          customData: { nested: 'value' },
        },
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Idempotency check
        .mockResolvedValueOnce({ rows: [{ id: 'notification-id' }] }) // Insert
        .mockResolvedValueOnce({ rows: [] }); // Update

      await processor.processNotification(messageData);

      const insertCall = mockClient.query.mock.calls[2];
      expect(insertCall[1][2]).toBe(JSON.stringify(messageData.payload));
    });

    it('should release client connection after processing', async () => {
      const messageData = {
        messageId: 'test-message-id',
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'email',
        payload: { subject: 'Test' },
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'notification-id' }] })
        .mockResolvedValueOnce({ rows: [] });

      await processor.processNotification(messageData);

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('handleFailure', () => {
    it('should increment retry count on failure', async () => {
      const messageData = {
        messageId: 'test-message-id',
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'email',
        payload: { subject: 'Test' },
      };

      const error = new Error('Processing failed');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Check query - no existing record
        .mockResolvedValueOnce({ rows: [] }); // Insert

      const result = await processor.handleFailure(messageData, error, 0);

      expect(result.shouldRetry).toBe(true);
      expect(result.newRetryCount).toBe(1);
    });

    it('should not retry after max retries exceeded', async () => {
      const messageData = {
        messageId: 'test-message-id',
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'email',
        payload: { subject: 'Test' },
      };

      const error = new Error('Processing failed');

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Check query
        .mockResolvedValueOnce({ rows: [] }); // Insert

      const result = await processor.handleFailure(messageData, error, 3); // Max retries is 3

      expect(result.shouldRetry).toBe(false);
    });

    it('should release client after handling failure', async () => {
      const messageData = {
        messageId: 'test-message-id',
        targetUserId: '9fc81fdd-fc9c-49e3-9df1-a36df7e1ec5a',
        type: 'email',
        payload: { subject: 'Test' },
      };

      mockClient.query.mockResolvedValue({ rows: [] });

      await processor.handleFailure(messageData, new Error('Test'), 0);

      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
