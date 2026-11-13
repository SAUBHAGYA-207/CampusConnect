/**
 * Super Admin & Master Admin Email Whitelist Configuration
 * Enforces email-based access control for the Super Admin Command Center
 * and the Master Simulation Interface (restricted solely to sjijaiswal4@gmail.com).
 */

const MASTER_ADMIN_EMAIL = 'sjijaiswal4@gmail.com';

function getSuperAdminEmails() {
    const envList = process.env.SUPERADMIN_EMAILS || process.env.ADMIN_EMAILS || '';
    const emails = envList
        .split(',')
        .map(e => e.toLowerCase().trim())
        .filter(Boolean);

    // Default fallbacks to ensure authorized administrators have access
    if (!emails.includes('admin@campusconnect.com')) {
        emails.push('admin@campusconnect.com');
    }
    if (!emails.includes(MASTER_ADMIN_EMAIL)) {
        emails.push(MASTER_ADMIN_EMAIL);
    }

    return emails;
}

function isSuperAdminEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const normalized = email.toLowerCase().trim();
    const allowedList = getSuperAdminEmails();
    return allowedList.includes(normalized);
}

function isMasterAdminEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return email.toLowerCase().trim() === MASTER_ADMIN_EMAIL;
}

module.exports = {
    MASTER_ADMIN_EMAIL,
    getSuperAdminEmails,
    isSuperAdminEmail,
    isMasterAdminEmail
};
