const bcrypt = require('bcryptjs');
const adminService = require('../services/adminService');
const chatService = require('../services/chatService');
const JsonStorage = require('../storage/jsonStorage');
const { isSuperAdminEmail } = require('../utils/adminConfig');

const usersStorage = new JsonStorage('users');

exports.getLogin = (req, res) => {
    if (req.session.user && req.session.user.role === 'admin' && isSuperAdminEmail(req.session.user.email)) {
        return res.redirect('/admin/dashboard');
    }
    res.render('admin/login', { error: null });
};

exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = (email || '').toLowerCase().trim();

        // 1. Enforce Super Admin Email Whitelist from environment
        if (!isSuperAdminEmail(normalizedEmail)) {
            return res.render('admin/login', { 
                error: 'Access Denied: This email address is not authorized for Super Admin access.' 
            });
        }

        // 2. Locate user in storage
        const user = await usersStorage.find(u => u.email.toLowerCase() === normalizedEmail);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('admin/login', { error: 'Invalid Super Admin credentials' });
        }

        // 3. Ensure user role is updated to admin if whitelisted
        if (user.role !== 'admin') {
            await usersStorage.update(user.id, { role: 'admin' });
        }

        req.session.user = { id: user.id, email: user.email, role: 'admin', isVerified: true };
        req.session.save((err) => {
            if (err) {
                console.error('Admin session save error:', err);
                return res.render('admin/login', { error: 'Failed to initialize session' });
            }
            res.redirect('/admin/dashboard');
        });
    } catch (error) {
        console.error('Super Admin login error:', error);
        res.render('admin/login', { error: 'Authentication failed' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Admin logout error:', err);
        res.clearCookie('connect.sid');
        res.redirect('/admin/login');
    });
};

exports.getDashboard = async (req, res, next) => {
    try {
        const [stats, services, appointments, users, payouts] = await Promise.all([
            adminService.getPlatformStats(),
            adminService.getAllServices(),
            adminService.getAllAppointments(),
            adminService.getAllUsers(),
            adminService.getAllPayouts()
        ]);

        const customers = users.filter(u => u.role === 'customer');
        const partners = users.filter(u => u.role === 'provider');

        res.render('admin/dashboard', {
            stats,
            services,
            appointments,
            customers,
            partners,
            payouts,
            adminUser: req.session.user
        });
    } catch (error) {
        next(error);
    }
};

exports.postRemoveService = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { feedback } = req.body;

        if (!feedback || feedback.trim().length === 0) {
            req.flash('error', 'Feedback is required when removing a service listing.');
            return res.redirect('/admin/dashboard#services-tab');
        }

        const removed = await adminService.removeServiceByAdmin(id, feedback.trim(), req.session.user.email);
        req.flash('success', `Service "${removed.title}" removed. Feedback email sent to partner.`);
        res.redirect('/admin/dashboard#services-tab');
    } catch (error) {
        next(error);
    }
};

exports.postClearPayout = async (req, res, next) => {
    try {
        const { id } = req.params;
        const transactionId = (req.body.transactionId && req.body.transactionId.trim()) 
            ? req.body.transactionId.trim() 
            : `UPI-SETTLED-${Date.now()}`;
        const paymentProof = req.file ? `/uploads/payouts/${req.file.filename}` : null;

        await adminService.clearPayoutByAdmin(id, transactionId, paymentProof);
        req.flash('success', 'Payout cleared successfully! Settlement receipt sent to partner.');
        res.redirect('/admin/dashboard#payouts-tab');
    } catch (error) {
        next(error);
    }
};

exports.getChat = async (req, res, next) => {
    try {
        const targetUserId = req.query.userId || null;
        const [chatUsers, allUsers] = await Promise.all([
            chatService.getAdminChatUsers(),
            adminService.getAllUsers()
        ]);

        let targetUser = null;
        let messages = [];

        if (targetUserId) {
            targetUser = allUsers.find(u => u.id === targetUserId);
            if (targetUser) {
                messages = await chatService.getAdminMessagesForUser(targetUserId);
            }
        }

        res.render('admin/chat', {
            chatUsers,
            allUsers,
            targetUser,
            targetUserId,
            messages
        });
    } catch (error) {
        next(error);
    }
};

exports.getMessagesApi = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const messages = await chatService.getAdminMessagesForUser(userId);
        res.json(messages);
    } catch (error) {
        next(error);
    }
};
