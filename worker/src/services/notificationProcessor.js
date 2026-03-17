const logger = require('../logger');

class NotificationProcessor {
  constructor(databaseClient) {
    this.databaseClient = databaseClient;
    this.maxRetries = parseInt(process.env.MAX_RETRIES || 3, 10);
  }

  
  async processNotification(messageData) {
    const client = await this.databaseClient.getPool().connect();
    
    try {
      await client.query('BEGIN');

      // Check idempotency - has this message been processed before?
      const existingQuery = `
        SELECT id, status FROM notifications WHERE message_id = $1
      `;
      const existingResult = await client.query(existingQuery, [messageData.messageId]);

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        logger.info('Message already processed (idempotency check)', {
          messageId: messageData.messageId,
          existingStatus: existing.status,
        });
        
        await client.query('ROLLBACK');
        return {
          success: true,
          reason: 'Duplicate message (idempotency)',
          messageId: messageData.messageId,
        };
      }

      // Insert notification into database
      const insertQuery = `
        INSERT INTO notifications (
          user_id, type, payload, message_id, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `;

      const result = await client.query(insertQuery, [
        messageData.targetUserId,
        messageData.type,
        JSON.stringify(messageData.payload),
        messageData.messageId,
        'processed',
      ]);

      // Update processed_at timestamp
      const updateQuery = `
        UPDATE notifications SET processed_at = NOW() WHERE id = $1
      `;
      await client.query(updateQuery, [result.rows[0].id]);

      await client.query('COMMIT');

      logger.info('Notification processed successfully', {
        messageId: messageData.messageId,
        userId: messageData.targetUserId,
        type: messageData.type,
        notificationId: result.rows[0].id,
      });

      return {
        success: true,
        messageId: messageData.messageId,
        notificationId: result.rows[0].id,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to process notification', {
        messageId: messageData.messageId,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    } finally {
      client.release();
    }
  }

  async handleFailure(messageData, error, retryCount) {
    const client = await this.databaseClient.getPool().connect();

    try {
      // Check if message exists
      const checkQuery = `
        SELECT id, retries_attempted FROM notifications WHERE message_id = $1
      `;
      const checkResult = await client.query(checkQuery, [messageData.messageId]);

      let shouldRetry = retryCount < this.maxRetries;

      if (checkResult.rows.length === 0) {
        // Create a failed notification record
        const insertQuery = `
          INSERT INTO notifications (
            user_id, type, payload, message_id, status, retries_attempted, error_message
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        const newRetryCount = retryCount + 1;
        const status = shouldRetry ? 'pending' : 'failed';

        await client.query(insertQuery, [
          messageData.targetUserId,
          messageData.type,
          JSON.stringify(messageData.payload),
          messageData.messageId,
          status,
          newRetryCount,
          error.message,
        ]);

        logger.warn('Notification failure recorded', {
          messageId: messageData.messageId,
          retryCount: newRetryCount,
          maxRetries: this.maxRetries,
          shouldRetry,
          error: error.message,
        });
      } else {
        // Update retry count
        const newRetryCount = checkResult.rows[0].retries_attempted + 1;
        const status = shouldRetry ? 'pending' : 'failed';

        const updateQuery = `
          UPDATE notifications 
          SET retries_attempted = $1, status = $2, error_message = $3
          WHERE message_id = $4
        `;

        await client.query(updateQuery, [
          newRetryCount,
          status,
          error.message,
          messageData.messageId,
        ]);

        logger.warn('Notification failure recorded', {
          messageId: messageData.messageId,
          retryCount: newRetryCount,
          maxRetries: this.maxRetries,
          shouldRetry,
          error: error.message,
        });
      }

      return {
        shouldRetry,
        newRetryCount: retryCount + 1,
      };
    } catch (dbError) {
      logger.error('Failed to handle failure in database', {
        messageId: messageData.messageId,
        error: dbError.message,
      });
      throw dbError;
    } finally {
      client.release();
    }
  }
}

module.exports = NotificationProcessor;
