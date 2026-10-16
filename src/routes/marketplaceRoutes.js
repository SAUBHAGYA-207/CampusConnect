const express = require('express');
const router = express.Router();
const serviceService = require('../services/serviceService');
const JsonStorage = require('../storage/jsonStorage');
const usersStorage = new JsonStorage('users');

router.get('/', async (req, res, next) => {
    try {
        const { q, category, minPrice, maxPrice, sortBy } = req.query;
        const services = await serviceService.searchServices({ q }, category, minPrice, maxPrice, sortBy);
        res.render('marketplace/index', { services, query: req.query });
    } catch (error) {
        next(error);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const service = await serviceService.getServiceById(req.params.id);
        if (!service) return res.status(404).render('error', { message: 'Service not found' });
        
        let provider = null;
        if (service.providerId) {
            provider = await usersStorage.getById(service.providerId);
        }

        // Customer pays directly to Admin's Escrow QR / UPI ID
        // Super Admin later settles 85% to the partner's QR upon payout request
        const adminUpiId = process.env.UPI_ID || 'anand1024anand@okicici';
        const adminPayeeName = process.env.UPI_PAYEE_NAME || 'CampusConnect Admin Escrow';
        const adminQrImage = process.env.UPI_QR_IMAGE || '';

        res.render('marketplace/service-details', { 
            service,
            provider,
            upiId: adminUpiId,
            upiPayeeName: adminPayeeName,
            adminUpiId,
            adminPayeeName,
            adminQrImage
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
