const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireSuperAdmin } = require('../middleware/auth');
const { payoutUpload } = require('../middleware/upload');

// Public Admin Auth Routes
router.get('/login', adminController.getLogin);
router.post('/login', adminController.postLogin);
router.get('/verify-otp', adminController.getVerifyOtp);
router.post('/verify-otp', adminController.postVerifyOtp);
router.get('/resend-otp', adminController.resendOtp);
router.get('/logout', adminController.logout);

// Protected Super Admin Portal Routes
router.get('/dashboard', requireSuperAdmin, adminController.getDashboard);
router.post('/services/:id/remove', requireSuperAdmin, adminController.postRemoveService);
router.post('/payouts/:id/clear', requireSuperAdmin, payoutUpload.single('paymentProof'), adminController.postClearPayout);

// Super Admin Direct Chat
router.get('/chat', requireSuperAdmin, adminController.getChat);
router.get('/api/chat/:userId', requireSuperAdmin, adminController.getMessagesApi);

module.exports = router;
