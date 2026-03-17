const jwt = require('jsonwebtoken');
const logger = require('../logger');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid authorization header', { path: req.path });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization token'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key');
    
    req.user = decoded;
    logger.info('Authentication successful', { userId: decoded.userId, path: req.path });
    next();
  } catch (error) {
    logger.warn('Authentication failed', { error: error.message, path: req.path });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });
  }
};

module.exports = authMiddleware;
