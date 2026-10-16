require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
const sessionSetup = require('./src/config/session');
const errorHandler = require('./src/middleware/errorHandler');

const authRoutes = require('./src/routes/authRoutes');
const serviceRoutes = require('./src/routes/serviceRoutes');
const appointmentRoutes = require('./src/routes/appointmentRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const { requireAuth, requireRole, requireVerifiedEmail } = require('./src/middleware/auth');

const app = express();

app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));
app.set('layout', 'layouts/main');

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

sessionSetup(app);
app.use(flash());

app.use((req, res, next) => {
    // Prevent browser from caching dynamic HTML so login/logout status is immediately reflected
    if (req.method === 'GET') {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
    res.locals.user = req.session.user || null;
    res.locals.path = req.path;
    res.locals.success_messages = req.flash('success');
    res.locals.error_messages = req.flash('error');
    res.locals.upiId = process.env.UPI_ID || 'campusconnect.payments@upi';
    res.locals.upiPayeeName = process.env.UPI_PAYEE_NAME || 'CampusConnect';
    res.locals.upiQrImage = process.env.UPI_QR_IMAGE || '';
    next();
});

app.use('/auth', authRoutes);
app.use('/services', serviceRoutes);
app.use('/appointments', appointmentRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);

const adminRoutes = require('./src/routes/adminRoutes');
const supportRoutes = require('./src/routes/supportRoutes');
app.use('/admin', adminRoutes);
app.use('/support', supportRoutes);

const serviceService = require('./src/services/serviceService');
const appointmentService = require('./src/services/appointmentService');
const adminService = require('./src/services/adminService');
const marketplaceRoutes = require('./src/routes/marketplaceRoutes');

app.get('/dashboard', requireAuth, async (req, res, next) => {
    try {
        const userId = req.session.user.id;

        // If Super Admin accesses /dashboard, direct them to their executive command dashboard
        if (req.session.user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        }

        const isPartner = req.session.user.role === 'provider';

        // 1. User's own bookings as a customer
        const myBookings = await appointmentService.getAppointmentsByCustomer(userId);
        const customerStats = {
            totalBookings: myBookings.length,
            pendingBookings: myBookings.filter(a => a.status === 'pending').length,
            activeBookings: myBookings.filter(a => a.status === 'accepted').length,
            completedBookings: myBookings.filter(a => a.status === 'completed').length
        };

        // 2. Extra window data for PARTNER (orders, payment collected, services)
        let partnerStats = null;
        if (isPartner) {
            const services = await serviceService.getServicesByProvider(userId);
            const incomingOrders = await appointmentService.getAppointmentsByProvider(userId);

            const completedApps = incomingOrders.filter(a => a.status === 'completed');
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

            const inProgressApps = incomingOrders.filter(a => a.status === 'pending' || a.status === 'accepted');
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

            const pendingPaymentApprovals = incomingOrders.filter(a => a.paymentStatus === 'submitted').length;
            const verifiedPaymentsCount = incomingOrders.filter(a => a.paymentStatus === 'verified').length;

            const partnerFinancials = await adminService.getPartnerFinancialSummary(userId);
            const partnerPayouts = await adminService.getPayoutsByPartner(userId);

            partnerStats = {
                totalServices: services.length,
                totalOrders: incomingOrders.length,
                pendingOrders: incomingOrders.filter(a => a.status === 'pending').length,
                completedOrders: completedApps.length,
                totalEarnings: totalEarnings.toFixed(2),
                totalGross: totalGross.toFixed(2),
                totalPlatformFee: totalPlatformFee.toFixed(2),
                pendingEarnings: pendingEarnings.toFixed(2),
                pendingPaymentApprovals,
                verifiedPaymentsCount,
                financials: partnerFinancials,
                payouts: partnerPayouts
            };
        }

        res.render('dashboard', { customerStats, partnerStats, isPartner });
    } catch (error) {
        next(error);
    }
});

app.get('/', async (req, res, next) => {
    try {
        if (req.session && req.session.user && req.session.user.role === 'admin') {
            return res.redirect('/admin/dashboard');
        }
        const { q, category, minPrice, maxPrice, sortBy } = req.query;
        const services = await serviceService.searchServices({ q }, category, minPrice, maxPrice, sortBy);
        res.render('marketplace/index', { services, query: req.query });
    } catch (error) {
        next(error);
    }
});

app.use('/marketplace', marketplaceRoutes);

app.use(errorHandler);

module.exports = app;
