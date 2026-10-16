const bcrypt = require('bcryptjs');
const JsonStorage = require('../storage/jsonStorage');
const { generateOTP } = require('../utils/otp');
const { sendOTP } = require('../services/emailService');
const { isSuperAdminEmail } = require('../utils/adminConfig');

const usersStorage = new JsonStorage('users');

exports.getRegister = (req, res) => {
    res.render('auth/register', { error: null });
};

exports.postRegister = async (req, res) => {
    try {
        const { email, password, role, isPartner } = req.body;
        const existingUser = await usersStorage.find(u => u.email === email);
        if (existingUser) {
            if (!existingUser.isVerified) {
                // If user registered earlier but never verified, issue fresh OTP and redirect to verification
                const otp = generateOTP();
                await usersStorage.update(existingUser.id, {
                    otp,
                    otpExpires: Date.now() + 10 * 60 * 1000
                });
                await sendOTP(email, otp);
                req.session.userId = existingUser.id;
                return req.session.save(() => {
                    res.redirect('/auth/verify-email?sent=1');
                });
            }
            return res.render('auth/register', { error: 'Email already registered and verified. Please log in.' });
        }

        const isPartnerTicked = isPartner === 'provider' || isPartner === 'on' || isPartner === 'true' || isPartner === true || role === 'provider';
        const assignedRole = isPartnerTicked ? 'provider' : 'customer';

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();

        const user = await usersStorage.add({
            email,
            password: hashedPassword,
            role: assignedRole,
            isVerified: false,
            otp,
            otpExpires: Date.now() + 10 * 60 * 1000 // 10 minutes
        });

        await sendOTP(email, otp);
        req.session.userId = user.id; // temporary session for verification
        req.session.save((err) => {
            if (err) {
                console.error('Session save error on register:', err);
                return res.render('auth/register', { error: 'Registration succeeded but session save failed' });
            }
            res.redirect('/auth/verify-email');
        });
    } catch (error) {
        console.error(error);
        res.render('auth/register', { error: 'Registration failed' });
    }
};

exports.getLogin = (req, res) => {
    res.render('auth/login', { error: null });
};

exports.postLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await usersStorage.find(u => u.email === email);
        
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.render('auth/login', { error: 'Invalid credentials' });
        }

        if (!user.isVerified) {
            const otp = generateOTP();
            await usersStorage.update(user.id, {
                otp,
                otpExpires: Date.now() + 10 * 60 * 1000
            });
            await sendOTP(user.email, otp);
            req.session.userId = user.id;
            return req.session.save((err) => {
                if (err) console.error('Session save error on unverified login:', err);
                res.redirect('/auth/verify-email?sent=1');
            });
        }

        req.session.user = { id: user.id, email: user.email, role: user.role, isVerified: user.isVerified };
        req.session.save((err) => {
            if (err) {
                console.error('Session save error on login:', err);
                return res.render('auth/login', { error: 'Failed to initialize session' });
            }
            if (user.role === 'admin' && isSuperAdminEmail(user.email)) {
                return res.redirect('/admin/dashboard');
            }
            res.redirect('/');
        });
    } catch (error) {
        console.error(error);
        res.render('auth/login', { error: 'Login failed' });
    }
};

exports.getVerifyEmail = async (req, res) => {
    if (!req.session.userId) return res.redirect('/auth/login');
    const user = await usersStorage.getById(req.session.userId);
    res.render('auth/verify-email', { 
        error: null, 
        userEmail: user ? user.email : '',
        resent: req.query.resent === '1',
        sent: req.query.sent === '1'
    });
};

exports.resendOTP = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.redirect('/auth/login');
        }

        const user = await usersStorage.getById(userId);
        if (!user) return res.redirect('/auth/login');

        const otp = generateOTP();
        await usersStorage.update(userId, {
            otp,
            otpExpires: Date.now() + 10 * 60 * 1000
        });

        await sendOTP(user.email, otp);
        res.redirect('/auth/verify-email?resent=1');
    } catch (error) {
        console.error('Error resending OTP:', error);
        res.render('auth/verify-email', { error: 'Failed to resend OTP. Please try again.', userEmail: '' });
    }
};

exports.postVerifyEmail = async (req, res) => {
    try {
        const { otp } = req.body;
        const userId = req.session.userId;
        if (!userId) return res.redirect('/auth/login');

        const user = await usersStorage.getById(userId);
        if (!user) return res.redirect('/auth/login');

        if (user.otp !== otp || Date.now() > user.otpExpires) {
            return res.render('auth/verify-email', { error: 'Invalid or expired OTP' });
        }

        await usersStorage.update(userId, { isVerified: true, otp: null, otpExpires: null });
        req.session.user = { id: user.id, email: user.email, role: user.role, isVerified: true };
        delete req.session.userId;

        req.session.save((err) => {
            if (err) {
                console.error('Session save error on email verification:', err);
                return res.render('auth/verify-email', { error: 'Failed to save session' });
            }
            res.redirect('/');
        });
    } catch (error) {
        console.error(error);
        res.render('auth/verify-email', { error: 'Verification failed' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Session destroy error on logout:', err);
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
};
