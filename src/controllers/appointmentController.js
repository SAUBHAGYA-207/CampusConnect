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
        
        if (!req.file) {
            req.flash('error', 'Please upload a screenshot of your QR payment to complete the booking.');
            return res.redirect('/marketplace/' + serviceId);
        }

        const screenshotUrl = await storageService.uploadMulterFile(req.file, 'payments');
        const paymentData = {
            paymentScreenshot: screenshotUrl,
            transactionId: transactionId ? transactionId.trim() : null
        };

        await appointmentService.createAppointment(
            req.session.user.id,
            serviceId,
            date,
            time,
            notes,
            paymentData
        );

        req.flash('success', 'Booking requested! Payment screenshot submitted for verification.');
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
