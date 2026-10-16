const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');
const appointmentService = require('../services/appointmentService');
const { requireAuth } = require('../middleware/auth');

router.get('/:appointmentId', requireAuth, async (req, res, next) => {
    try {
        const { appointmentId } = req.params;
        const app = await appointmentService.getAppointmentById(appointmentId);
        if (!app) return res.status(404).json({ error: 'Not found' });
        if (app.customerId !== req.session.user.id && app.providerId !== req.session.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        const messages = await chatService.getMessagesForAppointment(appointmentId);
        res.json(messages);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
