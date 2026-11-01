const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const chatService = require('../services/chatService');
const appointmentService = require('../services/appointmentService');
const storageService = require('../services/storageService');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Fetch messages for appointment
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

// Upload image for appointment chat
router.post('/:appointmentId/upload', requireAuth, upload.chatUpload.single('image'), async (req, res, next) => {
    try {
        const { appointmentId } = req.params;
        const app = await appointmentService.getAppointmentById(appointmentId);
        if (!app) return res.status(404).json({ error: 'Appointment not found' });
        if (app.customerId !== req.session.user.id && app.providerId !== req.session.user.id) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        if (app.status === 'cancelled' || app.status === 'rejected') {
            return res.status(400).json({ error: 'Chat is closed for this booking' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        const imageUrl = await storageService.uploadMulterFile(req.file, 'chat');
        res.json({
            success: true,
            imageUrl,
            filename: req.file.originalname
        });
    } catch (error) {
        next(error);
    }
});

// Secure image download proxy to guarantee cross-origin file downloads
router.get('/download/file', requireAuth, async (req, res, next) => {
    try {
        const fileUrl = req.query.url;
        const requestedName = (req.query.filename || 'chat-image.png').replace(/[^a-zA-Z0-9._-]/g, '_');
        
        if (!fileUrl) {
            return res.status(400).send('URL is required');
        }

        // Local file
        if (fileUrl.startsWith('/uploads/')) {
            const localPath = path.join(__dirname, '../../', fileUrl);
            if (fs.existsSync(localPath)) {
                return res.download(localPath, requestedName);
            }
        }

        // Remote Supabase CDN URL
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
            const response = await fetch(fileUrl);
            if (!response.ok) {
                return res.status(response.status).send('Failed to fetch file from storage');
            }
            const contentType = response.headers.get('content-type') || 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${requestedName}"`);
            const arrayBuffer = await response.arrayBuffer();
            return res.send(Buffer.from(arrayBuffer));
        }

        res.status(404).send('File not found');
    } catch (error) {
        next(error);
    }
});

module.exports = router;
