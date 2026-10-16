const bcrypt = require('bcryptjs');
const adminService = require('../services/adminService');
const chatService = require('../services/chatService');
const notificationService = require('../services/notificationService');
const JsonStorage = require('../storage/jsonStorage');
const { isSuperAdminEmail } = require('../utils/adminConfig');
const { generateOTP } = require('../utils/otp');
const { sendOTP } = require('../services/emailService');

const usersStorage = new JsonStorage('users');

exports.getRegister = (req, res) => {
    if (req.session.user && req.session.user.role === 'admin' && isSuperAdminEmail(req.session.user.email)) {
        return res.redirect('/admin/dashboard');
    }
    res.render('admin/register', { error: null });
};

exports.postRegister = async (req, res) => {
    try {
        const { email, password, confirmPassword } = req.body;
        const normalizedEmail = (email || '').toLowerCase().trim();

        if (!normalizedEmail || !password) {
            return res.render('admin/register', { error: 'Please enter all required fields.' });
        }

        if (confirmPassword && password !== confirmPassword) {
            return res.render('admin/register', { error: 'Passwords do not match. Please verify both passwords.' });
        }

        if (password.length < 6) {
            return res.render('admin/register', { error: 'Password must be at least 6 characters long.' });
        }

        // 1. Strict whitelist validation against SUPERADMIN_EMAILS
        if (!isSuperAdminEmail(normalizedEmail)) {
            return res.render('admin/register', {
                error: 'Access Denied: This email address is not authorized for Super Admin registration.'
            });
        }

        // 2. Check existing record
        const existingUser = await usersStorage.find(u => (u.email || '').toLowerCase() === normalizedEmail);
        if (existingUser) {
            if (existingUser.isVerified && existingUser.role === 'admin') {
                return res.render('admin/register', {
                    error: 'Super Admin account is already registered. Please sign in.'
                });
            } else {
                // Issue fresh OTP for existing unverified record
                const hashedPassword = await bcrypt.hash(password, 10);
                const otp = generateOTP();
                await usersStorage.update(existingUser.id, {
                    password: hashedPassword,
                    role: 'admin',
                    otp,
                    otpExpires: Date.now() + 10 * 60 * 1000
                });
                await sendOTP(existingUser.email, otp);
                req.session.adminPendingUserId = existingUser.id;
                return req.session.save(() => {
                    res.redirect('/admin/verify-otp?sent=1');
                });
            }
        }

        // 3. Register brand new Super Admin
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();

        const newAdmin = await usersStorage.add({
            email: normalizedEmail,
            password: hashedPassword,
            role: 'admin',
            isVerified: false,
            otp,
            otpExpires: Date.now() + 10 * 60 * 1000
        });

        await sendOTP(newAdmin.email, otp);

        req.session.adminPendingUserId = newAdmin.id;
        req.session.save((err) => {
            if (err) {
                console.error('Session save error on admin registration:', err);
                return res.render('admin/register', { error: 'Failed to initialize session' });
            }
            res.redirect('/admin/verify-otp?sent=1');
        });
    } catch (error) {
        console.error('Super Admin registration error:', error);
        res.render('admin/register', { error: 'Registration failed. Please try again.' });
    }
};

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

        // 3. Generate 6-digit OTP and dispatch to authorized Super Admin email
        const otp = generateOTP();
        await usersStorage.update(user.id, {
            otp,
            otpExpires: Date.now() + 10 * 60 * 1000 // 10 minutes
        });

        await sendOTP(user.email, otp);

        // Store pending admin login in session
        req.session.adminPendingUserId = user.id;
        req.session.save((err) => {
            if (err) {
                console.error('Admin session save error:', err);
                return res.render('admin/login', { error: 'Failed to initialize session' });
            }
            res.redirect('/admin/verify-otp?sent=1');
        });
    } catch (error) {
        console.error('Super Admin login error:', error);
        res.render('admin/login', { error: 'Authentication failed' });
    }
};

exports.getVerifyOtp = async (req, res) => {
    const userId = req.session.adminPendingUserId;
    if (!userId) return res.redirect('/admin/login');

    const user = await usersStorage.getById(userId);
    if (!user || !isSuperAdminEmail(user.email)) {
        delete req.session.adminPendingUserId;
        return res.redirect('/admin/login');
    }

    res.render('admin/verify-otp', {
        error: null,
        userEmail: user.email,
        resent: req.query.resent === '1',
        sent: req.query.sent === '1'
    });
};

exports.postVerifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const userId = req.session.adminPendingUserId;
        if (!userId) return res.redirect('/admin/login');

        const user = await usersStorage.getById(userId);
        if (!user || !isSuperAdminEmail(user.email)) {
            delete req.session.adminPendingUserId;
            return res.redirect('/admin/login');
        }

        const trimmedOtp = (otp || '').trim();
        if (!user.otp || user.otp !== trimmedOtp || Date.now() > user.otpExpires) {
            return res.render('admin/verify-otp', {
                error: 'Invalid or expired OTP code. Please try again.',
                userEmail: user.email,
                resent: false
            });
        }

        // Elevate to verified Super Admin and clear OTP
        await usersStorage.update(user.id, {
            role: 'admin',
            isVerified: true,
            otp: null,
            otpExpires: null
        });

        delete req.session.adminPendingUserId;
        req.session.user = { id: user.id, email: user.email, role: 'admin', isVerified: true };

        req.session.save((err) => {
            if (err) {
                console.error('Admin session save error:', err);
                return res.render('admin/verify-otp', { error: 'Failed to initialize session', userEmail: user.email, resent: false });
            }
            res.redirect('/admin/dashboard');
        });
    } catch (error) {
        console.error('Super Admin OTP verification error:', error);
        res.render('admin/verify-otp', { error: 'Verification failed. Please try again.', userEmail: '', resent: false });
    }
};

exports.resendOtp = async (req, res) => {
    try {
        const userId = req.session.adminPendingUserId;
        if (!userId) return res.redirect('/admin/login');

        const user = await usersStorage.getById(userId);
        if (!user || !isSuperAdminEmail(user.email)) {
            delete req.session.adminPendingUserId;
            return res.redirect('/admin/login');
        }

        const otp = generateOTP();
        await usersStorage.update(user.id, {
            otp,
            otpExpires: Date.now() + 10 * 60 * 1000
        });

        await sendOTP(user.email, otp);
        res.redirect('/admin/verify-otp?resent=1');
    } catch (error) {
        console.error('Error resending Super Admin OTP:', error);
        res.redirect('/admin/verify-otp');
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
            messages,
            adminUser: req.session.user
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

exports.postSendMessageApi = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Message text cannot be empty' });
        }

        const adminUser = req.session.user;
        const senderName = adminUser && adminUser.email ? adminUser.email.split('@')[0] : 'Super Admin';
        const senderEmail = adminUser && adminUser.email ? adminUser.email : 'admin@campusconnect.com';
        const senderId = adminUser ? adminUser.id : 'super_admin_001';

        const msg = await chatService.saveAdminMessage(
            userId,
            senderId,
            'admin',
            text.trim(),
            senderName,
            senderEmail
        );

        const io = notificationService.getIO();
        if (io) {
            io.to(`admin_chat_${userId}`).emit('new_admin_message', msg);
        }

        // Send instant notification to customer or partner
        await notificationService.createNotification(
            userId,
            `New support message from Admin (${senderEmail})`,
            '/support/chat'
        );

        res.json({ success: true, message: msg });
    } catch (error) {
        console.error('Error in postSendMessageApi:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};
