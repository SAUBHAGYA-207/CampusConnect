const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/register', authController.getRegister);
router.post('/register', authController.postRegister);

router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);

router.get('/verify-email', authController.getVerifyEmail);
router.post('/verify-email', authController.postVerifyEmail);

router.get('/resend-otp', authController.resendOTP);
router.post('/resend-otp', authController.resendOTP);

// Forgot & Reset Password
router.get('/forgot-password', authController.getForgotPassword);
router.post('/forgot-password', authController.postForgotPassword);
router.get('/forgot-password/resend', authController.resendResetOTP);
router.post('/forgot-password/resend', authController.resendResetOTP);
router.get('/reset-password', authController.getResetPassword);
router.post('/reset-password', authController.postResetPassword);

router.post('/logout', authController.logout);
router.get('/logout', authController.logout);

module.exports = router;
