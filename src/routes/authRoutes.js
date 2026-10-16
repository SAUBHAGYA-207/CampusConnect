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

router.post('/logout', authController.logout);
router.get('/logout', authController.logout);

module.exports = router;
