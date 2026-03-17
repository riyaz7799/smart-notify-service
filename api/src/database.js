const { Pool } = require('pg');
const logger = require('./logger');

class DatabaseClient {
  constructor() {
    this.pool = null;
  }

  async connect() {
    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      logger.info('Database connected successfully');
      return true;
    } catch (error) {
      logger.error('Database connection failed', { error: error.message });
      return false;
    }
  }

  async isHealthy() {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      return true;
    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return false;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database disconnected');
    }
  }

  getPool() {
    return this.pool;
  }
}

module.exports = new DatabaseClient();
