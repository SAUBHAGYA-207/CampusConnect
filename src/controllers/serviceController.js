const serviceService = require('../services/serviceService');
const appointmentService = require('../services/appointmentService');

exports.getDashboard = async (req, res, next) => {
    try {
        const services = await serviceService.getServicesByProvider(req.session.user.id);
        const apps = await appointmentService.getAppointmentsByProvider(req.session.user.id);
        
        // PAYMENT only reflects once the service is marked COMPLETED from provider end!
        const completedApps = apps.filter(a => a.status === 'completed');
        
        let totalEarnings = 0;
        let totalGross = 0;
        let totalPlatformFee = 0;

        completedApps.forEach(a => {
            const amount = a.paymentAmount !== undefined && a.paymentAmount !== null 
                ? Number(a.paymentAmount) 
                : (a.service ? Number(a.service.price) : 0);
            const earnings = a.providerEarnings !== undefined && a.providerEarnings !== null
                ? Number(a.providerEarnings)
                : parseFloat((amount * 0.90).toFixed(2));
            const fee = a.platformFee !== undefined && a.platformFee !== null
                ? Number(a.platformFee)
                : parseFloat((amount * 0.10).toFixed(2));

            totalGross += amount;
            totalEarnings += earnings;
            totalPlatformFee += fee;
        });

        // Calculate pending/in-progress earnings (pending or accepted orders awaiting completion)
        const inProgressApps = apps.filter(a => a.status === 'pending' || a.status === 'accepted');
        let pendingEarnings = 0;
        inProgressApps.forEach(a => {
            const amount = a.paymentAmount !== undefined && a.paymentAmount !== null 
                ? Number(a.paymentAmount) 
                : (a.service ? Number(a.service.price) : 0);
            const earnings = a.providerEarnings !== undefined && a.providerEarnings !== null
                ? Number(a.providerEarnings)
                : parseFloat((amount * 0.90).toFixed(2));
            pendingEarnings += earnings;
        });

        const pendingPaymentApprovals = apps.filter(a => a.paymentStatus === 'submitted').length;
        const verifiedPaymentsCount = apps.filter(a => a.paymentStatus === 'verified').length;

        res.render('provider/dashboard', { 
            stats: { 
                totalServices: services.length, 
                totalAppointments: apps.length, 
                pendingAppointments: apps.filter(a => a.status === 'pending').length,
                completedAppointments: completedApps.length,
                totalEarnings: totalEarnings.toFixed(2),
                totalGross: totalGross.toFixed(2),
                totalPlatformFee: totalPlatformFee.toFixed(2),
                pendingEarnings: pendingEarnings.toFixed(2),
                pendingPaymentApprovals,
                verifiedPaymentsCount
            } 
        });
    } catch (error) {
        next(error);
    }
};

exports.getMyServices = async (req, res, next) => {
    try {
        const services = await serviceService.getServicesByProvider(req.session.user.id);
        res.render('provider/my-services', { services });
    } catch (error) {
        next(error);
    }
};

exports.getCreateService = (req, res) => {
    res.render('provider/create-service', { error: null });
};

exports.postCreateService = async (req, res, next) => {
    try {
        const { title, description, price, category } = req.body;
        const image = req.file ? `/uploads/services/${req.file.filename}` : null;
        
        await serviceService.createService(req.session.user.id, {
            title, description, price: parseFloat(price), category, image
        });
        res.redirect('/services/my-services');
    } catch (error) {
        next(error);
    }
};

exports.getEditService = async (req, res, next) => {
    try {
        const service = await serviceService.getServiceById(req.params.id);
        if (!service || service.providerId !== req.session.user.id) {
            return res.status(403).render('error', { message: 'Forbidden' });
        }
        res.render('provider/edit-service', { service, error: null });
    } catch (error) {
        next(error);
    }
};

exports.postEditService = async (req, res, next) => {
    try {
        const { title, description, price, category } = req.body;
        const updates = { title, description, price: parseFloat(price), category };
        if (req.file) {
            updates.image = `/uploads/services/${req.file.filename}`;
        }
        
        await serviceService.updateService(req.params.id, req.session.user.id, updates);
        res.redirect('/services/my-services');
    } catch (error) {
        next(error);
    }
};

exports.deleteService = async (req, res, next) => {
    try {
        await serviceService.deleteService(req.params.id, req.session.user.id);
        res.redirect('/services/my-services');
    } catch (error) {
        next(error);
    }
};

const adminService = require('../services/adminService');

exports.postPayoutQr = async (req, res, next) => {
    try {
        const { partnerUpiId } = req.body;
        const partnerQrImage = req.file ? `/uploads/partner-qr/${req.file.filename}` : undefined;
        
        await adminService.updatePartnerPayoutDetails(req.session.user.id, {
            partnerUpiId: partnerUpiId ? partnerUpiId.trim() : null,
            partnerQrImage
        });

        req.flash('success', 'Payout UPI ID updated successfully. System will generate QR automatically for admin.');
        res.redirect('/dashboard#payout-section');
    } catch (error) {
        next(error);
    }
};

exports.postRequestPayout = async (req, res, next) => {
    try {
        const { amount, notes } = req.body;
        await adminService.createPayoutRequest(req.session.user.id, amount, notes);
        req.flash('success', `Payout request for ₹${amount} submitted! Super Admin will scan your QR and transfer funds.`);
        res.redirect('/dashboard#payout-section');
    } catch (error) {
        req.flash('error', error.message || 'Payout request failed.');
        res.redirect('/dashboard#payout-section');
    }
};
