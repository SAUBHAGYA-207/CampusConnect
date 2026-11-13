const express = require('express');
const router = express.Router();
const simulationController = require('../controllers/simulationController');
const { requireMasterAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Strict Protection: Only accessible by sjijaiswal4@gmail.com
router.use(requireMasterAdmin);

// Dashboard
router.get('/', simulationController.getDashboard);

// Persona Management
router.post('/users/create', simulationController.postCreateUser);
router.post('/users/:id/delete', simulationController.postDeleteUser);
router.get('/users/:id/login-as', simulationController.getLoginAsUser);
router.get('/revert-admin', simulationController.getRevertToAdmin);

// Service & Booking Management
router.post('/services/create', upload.serviceUpload.single('image'), simulationController.postCreateService);
router.post('/appointments/create', upload.paymentUpload.single('paymentScreenshot'), simulationController.postCreateAppointment);

// Unified Chat Console
router.get('/api/chat/:appointmentId', simulationController.getChatRoomApi);
router.post('/api/chat/:appointmentId/send', upload.chatUpload.single('image'), simulationController.postSendMessageApi);

// Metadata & Seeder Operations
router.post('/shift-metadata', simulationController.postShiftMetadata);
router.post('/seed-presets', simulationController.postSeedPresets);

module.exports = router;
