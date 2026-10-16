/**
 * Super Admin Email Whitelist Configuration
 * Enforces email-based access control for the Super Admin Command Center.
 */

function getSuperAdminEmails() {
    const envList = process.env.SUPERADMIN_EMAILS || process.env.ADMIN_EMAILS || '';
    const emails = envList
        .split(',')
        .map(e => e.toLowerCase().trim())
        .filter(Boolean);

    // Default fallback to ensure system admin works out of the box
    if (!emails.includes('admin@campusconnect.com')) {
        emails.push('admin@campusconnect.com');
    }

    return emails;
}

function isSuperAdminEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const normalized = email.toLowerCase().trim();
    const allowedList = getSuperAdminEmails();
    return allowedList.includes(normalized);
}

module.exports = {
    getSuperAdminEmails,
    isSuperAdminEmail
};
