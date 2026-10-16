const express = require('express');
const router = express.Router();
const notificationService = require('../services/notificationService');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, async (req, res, next) => {
    try {
        const notifs = await notificationService.getNotificationsForUser(req.session.user.id);
        res.json(notifs);
    } catch (error) {
        next(error);
    }
});

router.post('/:id/read', requireAuth, async (req, res, next) => {
    try {
        await notificationService.markAsRead(req.params.id, req.session.user.id);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
