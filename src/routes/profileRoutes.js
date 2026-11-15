const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All profile operations require authentication
router.use(requireAuth);

router.get('/', profileController.getProfile);
router.post('/update', upload.profileUpload.single('profilePhoto'), profileController.postUpdateProfile);
router.post('/upi/send-otp', profileController.postSendUpiOtp);
router.post('/upi/verify-otp', profileController.postVerifyUpiOtp);

module.exports = router;
