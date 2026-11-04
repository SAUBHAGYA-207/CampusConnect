const appointmentService = require('../services/appointmentService');
const serviceService = require('../services/serviceService');

exports.getCustomerDashboard = async (req, res, next) => {
    try {
        const apps = await appointmentService.getAppointmentsByCustomer(req.session.user.id);
        const stats = {
            totalBookings: apps.length,
            pendingBookings: apps.filter(a => a.status === 'pending').length,
            verifiedPayments: apps.filter(a => a.paymentStatus === 'verified').length
        };
        res.render('customer/dashboard', { stats });
    } catch (error) {
        next(error);
    }
};

exports.getMyBookings = async (req, res, next) => {
    try {
        const apps = await appointmentService.getAppointmentsByCustomer(req.session.user.id);
        // Map service details
        for (let app of apps) {
            app.service = await serviceService.getServiceById(app.serviceId);
        }
        res.render('customer/my-bookings', { appointments: apps });
    } catch (error) {
        next(error);
    }
};

const storageService = require('../services/storageService');

exports.postBookAppointment = async (req, res, next) => {
    try {
        const { serviceId, date, time, notes, transactionId } = req.body;
        
        let paymentScreenshotFile = null;
        let referenceMediaFile = null;

        if (req.files) {
            if (req.files.paymentScreenshot && req.files.paymentScreenshot[0]) {
                paymentScreenshotFile = req.files.paymentScreenshot[0];
            }
            if (req.files.referenceMedia && req.files.referenceMedia[0]) {
                referenceMediaFile = req.files.referenceMedia[0];
            }
        } else if (req.file) {
            paymentScreenshotFile = req.file;
        }

        if (!paymentScreenshotFile) {
            req.flash('error', 'Please upload a screenshot of your QR payment to complete the booking.');
            return res.redirect('/marketplace/' + serviceId);
        }

        const screenshotUrl = await storageService.uploadMulterFile(paymentScreenshotFile, 'payments');
        
        let referenceMediaUrl = null;
        let referenceMediaType = null;
        let referenceMediaName = null;

        if (referenceMediaFile) {
            referenceMediaUrl = await storageService.uploadMulterFile(referenceMediaFile, 'requirements');
            referenceMediaType = referenceMediaFile.mimetype.startsWith('video/') ? 'video' : (referenceMediaFile.mimetype.startsWith('image/') ? 'image' : 'document');
            referenceMediaName = referenceMediaFile.originalname;
        }

        const paymentData = {
            paymentScreenshot: screenshotUrl,
            transactionId: transactionId ? transactionId.trim() : null
        };

        const referenceData = {
            referenceMediaUrl,
            referenceMediaType,
            referenceMediaName
        };

        await appointmentService.createAppointment(
            req.session.user.id,
            serviceId,
            date,
            time,
            notes,
            paymentData,
            referenceData
        );

        req.flash('success', 'Booking requested! Payment screenshot and deliverables submitted.');
        res.redirect('/appointments/my-bookings');
    } catch (error) {
        req.flash('error', error.message);
        res.redirect('/marketplace/' + (req.body.serviceId || ''));
    }
};

exports.getProviderAppointments = async (req, res, next) => {
    try {
        const apps = await appointmentService.getAppointmentsByProvider(req.session.user.id);
        for (let app of apps) {
            app.service = await serviceService.getServiceById(app.serviceId);
        }
        res.render('provider/appointment-details', { appointments: apps });
    } catch (error) {
        next(error);
    }
};

exports.updatePaymentStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { paymentStatus } = req.body;
        await appointmentService.updatePaymentStatus(id, req.session.user.id, paymentStatus);
        
        req.flash('success', `Payment status updated to ${paymentStatus}.`);
        res.redirect(`/appointments/provider/${id}`);
    } catch (error) {
        req.flash('error', error.message);
        res.redirect(`/appointments/provider/${req.params.id}`);
    }
};

exports.updateStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        await appointmentService.updateStatus(id, req.session.user.id, req.session.user.role, status);
        
        req.flash('success', `Appointment status updated to ${status}.`);
        if (req.session.user.role === 'provider') {
            res.redirect('/appointments/provider');
        } else {
            res.redirect('/appointments/my-bookings');
        }
    } catch (error) {
        req.flash('error', error.message);
        next(error);
    }
};

exports.getBookingDetails = async (req, res, next) => {
    try {
        const app = await appointmentService.getAppointmentById(req.params.id);
        if (!app || app.customerId !== req.session.user.id) {
            return res.status(403).render('error', { message: 'Forbidden' });
        }
        app.service = await serviceService.getServiceById(app.serviceId);
        res.render('customer/booking-details', { appointment: app });
    } catch (error) {
        next(error);
    }
};

exports.getProviderBookingDetails = async (req, res, next) => {
    try {
        const app = await appointmentService.getAppointmentById(req.params.id);
        if (!app || app.providerId !== req.session.user.id) {
            return res.status(403).render('error', { message: 'Forbidden' });
        }
        app.service = await serviceService.getServiceById(app.serviceId);
        res.render('provider/booking-details', { appointment: app });
    } catch (error) {
        next(error);
    }
};
