const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { paymentUpload } = require('../middleware/upload');

router.use(requireAuth);

// Booking routes - Accessible to all authenticated users (including PARTNERS!)
router.get('/my-bookings', appointmentController.getMyBookings);
router.post('/book', paymentUpload.single('paymentScreenshot'), appointmentController.postBookAppointment);
router.get('/my-bookings/:id', appointmentController.getBookingDetails);

// Redirect legacy customer dashboard link to unified dashboard
router.get('/customer/dashboard', (req, res) => res.redirect('/dashboard'));

// Partner routes (Managing incoming client orders & payment verification)
router.get('/provider', requireRole('provider'), appointmentController.getProviderAppointments);
router.get('/provider/:id', requireRole('provider'), appointmentController.getProviderBookingDetails);
router.post('/:id/payment-status', requireRole('provider'), appointmentController.updatePaymentStatus);

// Shared status transition route
router.post('/:id/status', appointmentController.updateStatus);

module.exports = router;
