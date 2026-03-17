const express = require('express');
const authMiddleware = require('../middleware/auth');

function createNotificationRoutes(notificationController) {
  const router = express.Router();

  router.post('/notifications', authMiddleware, (req, res) => {
    return notificationController.createNotification(req, res);
  });

  return router;
}

module.exports = createNotificationRoutes;
