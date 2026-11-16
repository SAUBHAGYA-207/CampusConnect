const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const simulationController = require('../controllers/simulationController');
const { requireSuperAdmin } = require('../middleware/auth');
const { payoutUpload } = require('../middleware/upload');

// Public Admin Auth Routes
router.get('/register', adminController.getRegister);
router.post('/register', adminController.postRegister);
router.get('/login', adminController.getLogin);
router.post('/login', adminController.postLogin);
router.get('/verify-otp', adminController.getVerifyOtp);
router.post('/verify-otp', adminController.postVerifyOtp);
router.get('/resend-otp', adminController.resendOtp);
router.get('/logout', adminController.logout);

// Revert persona route alias
router.get('/revert-admin', simulationController.getRevertToAdmin);

// Protected Super Admin Portal Routes
router.get('/dashboard', requireSuperAdmin, adminController.getDashboard);
router.post('/services/:id/verify', requireSuperAdmin, adminController.postVerifyService);
router.post('/services/:id/remove', requireSuperAdmin, adminController.postRemoveService);
router.post('/payouts/:id/clear', requireSuperAdmin, payoutUpload.single('paymentProof'), adminController.postClearPayout);
router.post('/payouts/:id/reject', requireSuperAdmin, adminController.postRejectPayout);

// Super Admin Direct Chat
router.get('/chat', requireSuperAdmin, adminController.getChat);
router.get('/api/chat/:userId', requireSuperAdmin, adminController.getMessagesApi);
router.post('/api/chat/:userId', requireSuperAdmin, adminController.postSendMessageApi);

module.exports = router;
