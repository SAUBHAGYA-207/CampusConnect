const JsonStorage = require('../storage/jsonStorage');
const usersStorage = new JsonStorage('users');
const walletService = require('../services/walletService');
const serviceService = require('../services/serviceService');
const storageService = require('../services/storageService');
const emailService = require('../services/emailService');
const { generateOTP } = require('../utils/otp');

/**
 * Display User/Partner Profile Page
 */
exports.getProfile = async (req, res, next) => {
    try {
        const userId = req.session.user.id;
        const user = await usersStorage.getById(userId);
        if (!user) {
            return res.redirect('/auth/login');
        }

        // Fetch wallet balance (ensures 99 coins for new users)
        const coins = await walletService.getUserCoins(userId);
        user.coins = coins;

        // Fetch transactions history & under-processing history
        const [completedTransactions, underProcessingTransactions] = await Promise.all([
            walletService.getTransactionHistory(userId),
            walletService.getUnderProcessingHistory(userId)
        ]);

        // If partner, also check services under review
        let underProcessingServices = [];
        if (user.role === 'provider') {
            const allPartnerServices = await serviceService.getServicesByProvider(userId);
            underProcessingServices = allPartnerServices.filter(s => s.status === 'under_processing');
        }

        const pendingCoinsTotal = underProcessingTransactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        // Ensure user has a unique referral code
        if (!user.referralCode) {
            const clean = (user.name || user.email || 'CC').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase();
            const random = Math.random().toString(36).substring(2, 6).toUpperCase();
            user.referralCode = `${clean}${random}`;
            await usersStorage.update(userId, { referralCode: user.referralCode });
        }

        // Fetch referred users & referral earnings (50 coins per verified invite)
        const allUsers = await usersStorage.getAll();
        const referredUsers = allUsers.filter(u => u.referredBy === userId);
        const referralEarnings = referredUsers.filter(u => u.referralRewardProcessed).length * 50;

        const host = req.get('host') || 'localhost:3000';
        const protocol = req.protocol || 'http';
        const referralLink = `${protocol}://${host}/auth/register?ref=${user.referralCode}`;

        const referralStats = {
            referralCode: user.referralCode,
            referredCount: referredUsers.length,
            referralEarnings,
            referredUsers: referredUsers.map(u => ({
                email: u.email,
                name: u.name,
                isVerified: u.isVerified,
                rewardProcessed: u.referralRewardProcessed,
                createdAt: u.createdAt
            }))
        };

        res.render('profile/index', {
            profileUser: user,
            coins,
            pendingCoinsTotal,
            completedTransactions,
            underProcessingTransactions,
            underProcessingServices,
            referralStats,
            referralLink,
            otpSent: req.query.otpSent === '1'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update Profile Details (Name & Profile Photo)
 */
exports.postUpdateProfile = async (req, res, next) => {
    try {
        const userId = req.session.user.id;
        const user = await usersStorage.getById(userId);
        if (!user) return res.redirect('/auth/login');

        const { name } = req.body;
        const updates = {};

        if (name !== undefined) {
            updates.name = name.trim();
        }

        if (req.file) {
            const photoUrl = await storageService.uploadMulterFile(req.file, 'avatars');
            if (photoUrl) {
                updates.profilePhoto = photoUrl;
                updates.avatar = photoUrl;
            }
        }

        if (Object.keys(updates).length > 0) {
            await usersStorage.update(userId, updates);
            // Update session
            if (updates.name !== undefined) req.session.user.name = updates.name;
            if (updates.profilePhoto) req.session.user.profilePhoto = updates.profilePhoto;
            if (typeof req.session.save === 'function') await new Promise((resolve) => req.session.save(resolve));
            req.flash('success', 'Profile information updated successfully!');
        }

        res.redirect('/profile');
    } catch (error) {
        console.error('Error updating profile:', error);
        req.flash('error', error.message || 'Failed to update profile.');
        res.redirect('/profile');
    }
};

/**
 * Step 1: Send OTP for setting or updating UPI ID
 */
exports.postSendUpiOtp = async (req, res, next) => {
    try {
        const userId = req.session.user.id;
        const user = await usersStorage.getById(userId);
        if (!user) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }
            return res.redirect('/auth/login');
        }

        const { upiId } = req.body;
        const cleanUpi = (upiId || '').trim();

        if (!cleanUpi || !cleanUpi.includes('@') || cleanUpi.length < 5) {
            const errorMsg = 'Please enter a valid UPI ID (e.g. yourname@okhdfcbank or 9876543210@paytm).';
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(400).json({ success: false, error: errorMsg });
            }
            req.flash('error', errorMsg);
            return res.redirect('/profile#upi-card');
        }

        const otp = generateOTP();
        const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        // Store OTP in session as bulletproof memory backup
        if (req.session) {
            req.session.upiVerification = {
                upiId: cleanUpi,
                otp: String(otp).trim(),
                expires: otpExpires
            };
            if (typeof req.session.save === 'function') {
                await new Promise((resolve) => req.session.save(resolve));
            }
        }

        try {
            await usersStorage.update(userId, {
                tempPendingUpiId: cleanUpi,
                upiOtp: otp,
                upiOtpExpires: otpExpires
            });
        } catch (dbErr) {
            console.warn('Could not save upiOtp to users storage, using session fallback:', dbErr.message);
        }

        await emailService.sendUpiVerificationOTP(user.email, otp, cleanUpi);

        const successMsg = `Verification code sent to your registered email address (${user.email}). Valid for 10 minutes.`;

        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({ success: true, message: successMsg, email: user.email });
        }

        req.flash('success', successMsg);
        res.redirect('/profile?otpSent=1#upi-card');
    } catch (error) {
        console.error('Error sending UPI OTP:', error);
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({ success: false, error: 'Failed to send OTP. Please try again.' });
        }
        req.flash('error', 'Failed to dispatch verification code. Please try again.');
        res.redirect('/profile#upi-card');
    }
};

/**
 * Step 2: Verify OTP and save the new UPI ID
 */
exports.postVerifyUpiOtp = async (req, res, next) => {
    try {
        const userId = req.session.user.id;
        const user = await usersStorage.getById(userId);
        if (!user) {
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }
            return res.redirect('/auth/login');
        }

        const { otp } = req.body;
        const cleanOtp = (otp || '').trim();

        if (!cleanOtp) {
            const errorMsg = 'Please enter the 6-digit OTP code sent to your email.';
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(400).json({ success: false, error: errorMsg });
            }
            req.flash('error', errorMsg);
            return res.redirect('/profile?otpSent=1#upi-card');
        }

        const sessionVerification = req.session.upiVerification || {};
        const sessionOtp = sessionVerification.otp ? String(sessionVerification.otp).trim() : null;
        const sessionExpires = sessionVerification.expires ? Number(sessionVerification.expires) : 0;
        const sessionUpiId = sessionVerification.upiId || null;

        const dbOtp = user.upiOtp ? String(user.upiOtp).trim() : null;
        const dbExpires = user.upiOtpExpires ? Number(user.upiOtpExpires) : 0;
        const dbUpiId = user.tempPendingUpiId || null;

        const isSessionValid = Boolean(sessionOtp && cleanOtp === sessionOtp && Date.now() <= sessionExpires);
        const isDbValid = Boolean(dbOtp && cleanOtp === dbOtp && Date.now() <= dbExpires);

        if (!isSessionValid && !isDbValid) {
            const errorMsg = 'Invalid or expired OTP code. Please request a new verification code.';
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(400).json({ success: false, error: errorMsg });
            }
            req.flash('error', errorMsg);
            return res.redirect('/profile?otpSent=1#upi-card');
        }

        const validatedUpi = sessionUpiId || dbUpiId || user.partnerUpiId;
        if (!validatedUpi) {
            const errorMsg = 'No pending UPI ID found. Please re-enter your UPI ID.';
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(400).json({ success: false, error: errorMsg });
            }
            req.flash('error', errorMsg);
            return res.redirect('/profile#upi-card');
        }

        // Successfully verified! Save UPI ID to user profile
        await usersStorage.update(userId, {
            partnerUpiId: validatedUpi,
            upiId: validatedUpi,
            tempPendingUpiId: null,
            upiOtp: null,
            upiOtpExpires: null
        });

        // Clear session verification and update user session
        delete req.session.upiVerification;
        req.session.user.partnerUpiId = validatedUpi;
        req.session.user.upiId = validatedUpi;
        if (typeof req.session.save === 'function') await new Promise((resolve) => req.session.save(resolve));

        const successMsg = `🎉 UPI ID "${validatedUpi}" successfully verified and activated!`;

        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.json({ success: true, message: successMsg, upiId: validatedUpi });
        }

        req.flash('success', successMsg);
        res.redirect('/profile#upi-card');
    } catch (error) {
        console.error('Error verifying UPI OTP:', error);
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(500).json({ success: false, error: 'Verification failed. Please try again.' });
        }
        req.flash('error', 'Verification failed. Please try again.');
        res.redirect('/profile#upi-card');
    }
};
