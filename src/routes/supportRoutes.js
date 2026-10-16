const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');
const { requireAuth } = require('../middleware/auth');

const notificationService = require('../services/notificationService');

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

router.post('/api/messages', async (req, res, next) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Message cannot be empty' });
        }

        const currentUser = req.session.user;
        const senderName = currentUser.email ? currentUser.email.split('@')[0] : 'User';
        const senderEmail = currentUser.email || '';

        const msg = await chatService.saveAdminMessage(
            currentUser.id, // targetUserId is this user's thread
            currentUser.id,
            currentUser.role,
            text.trim(),
            senderName,
            senderEmail
        );

        const io = notificationService.getIO();
        if (io) {
            io.to(`admin_chat_${currentUser.id}`).emit('new_admin_message', msg);
            io.to('admin_room').emit('new_admin_notification', {
                title: 'New Support Message',
                text: `${senderEmail}: ${text.trim().substring(0, 50)}`,
                targetUserId: currentUser.id
            });
        }

        res.json({ success: true, message: msg });
    } catch (error) {
        console.error('Error posting support message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

module.exports = router;
