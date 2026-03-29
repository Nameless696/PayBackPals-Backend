const express = require('express');
const router  = express.Router();
const protect = require('../middleware/auth');
const {
    getNotifications,
    markRead,
    markAllRead,
    deleteNotification,
} = require('../controllers/notification.controller');

router.use(protect);

router.get   ('/',           getNotifications);
router.patch ('/read-all',   markAllRead);
router.patch ('/:id',        markRead);
router.delete('/:id',        deleteNotification);

module.exports = router;
