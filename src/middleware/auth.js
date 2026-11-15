const { isSuperAdminEmail, isMasterAdminEmail } = require('../utils/adminConfig');

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
    const currentEmail = req.session.user ? (req.session.user.email || '').toLowerCase().trim() : '';
    const impersonatedFrom = (req.session.impersonatedFrom || '').toLowerCase().trim();

    const isCurrentSuper = req.session.user && req.session.user.role === 'admin' && isSuperAdminEmail(currentEmail);
    const isImpersonatingFromSuper = isSuperAdminEmail(impersonatedFrom);

    if (!isCurrentSuper && !isImpersonatingFromSuper) {
        return res.redirect('/admin/login');
    }
    next();
};

exports.requireMasterAdmin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/admin/login?next=/admin/simulation');
    }
    const currentEmail = (req.session.user.email || '').toLowerCase().trim();
    const impersonatedFrom = (req.session.impersonatedFrom || '').toLowerCase().trim();

    // Allow access if currently logged in as master admin, OR if impersonating from master admin
    if (!isMasterAdminEmail(currentEmail) && !isMasterAdminEmail(impersonatedFrom)) {
        return res.status(403).render('error', { 
            message: 'Access Restricted: This master persona & simulation control desk is strictly restricted to sjijaiswal4@gmail.com.' 
        });
    }
    next();
};
