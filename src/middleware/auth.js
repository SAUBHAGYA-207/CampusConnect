const { isSuperAdminEmail } = require('../utils/adminConfig');

exports.requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

exports.requireRole = (role) => {
    return (req, res, next) => {
        if (!req.session.user || req.session.user.role !== role) {
            return res.status(403).render('error', { message: 'Forbidden' });
        }
        next();
    };
};

exports.requireVerifiedEmail = (req, res, next) => {
    if (req.session.user && !req.session.user.isVerified) {
        return res.redirect('/auth/verify-email');
    }
    next();
};

exports.requireSuperAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin' || !isSuperAdminEmail(req.session.user.email)) {
        return res.redirect('/admin/login');
    }
    next();
};
