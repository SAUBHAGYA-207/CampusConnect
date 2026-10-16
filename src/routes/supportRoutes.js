const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/chat', async (req, res, next) => {
    try {
        const userId = req.session.user.id;
        const messages = await chatService.getAdminMessagesForUser(userId);
        res.render('support/chat', { messages, user: req.session.user });
    } catch (error) {
        next(error);
    }
});

router.get('/api/messages', async (req, res, next) => {
    try {
        const userId = req.session.user.id;
        const messages = await chatService.getAdminMessagesForUser(userId);
        res.json(messages);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
