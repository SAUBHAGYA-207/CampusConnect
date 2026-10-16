const nodemailer = require('nodemailer');

let cachedTransporter = null;

function isUsingRealSMTP() {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return false;
    const user = (process.env.SMTP_USER || '').toLowerCase().trim();
    if (user.endsWith('@ethereal.email')) return false;
    if (process.env.SMTP_SERVICE) return true;
    if (user.endsWith('@gmail.com')) return true;
    const host = (process.env.SMTP_HOST || '').toLowerCase().trim();
    return host !== '' && !host.includes('ethereal.email');
}

function getFromAddress() {
    if (process.env.MAIL_FROM && process.env.MAIL_FROM.trim()) {
        return process.env.MAIL_FROM.trim();
    }
    if (isUsingRealSMTP() && process.env.SMTP_USER) {
        return `"CampusConnect" <${process.env.SMTP_USER.trim()}>`;
    }
    return '"CampusConnect" <noreply@campusconnect.com>';
}

async function getTransporter() {
    if (cachedTransporter) return cachedTransporter;

    const user = (process.env.SMTP_USER || '').trim();
    const pass = (process.env.SMTP_PASS || '').trim();

    // 1. Direct Gmail detection (via SMTP_SERVICE, @gmail.com user, or smtp.gmail.com host)
    const isGmail = process.env.SMTP_SERVICE === 'gmail' || 
                    user.toLowerCase().endsWith('@gmail.com') || 
                    (process.env.SMTP_HOST || '').toLowerCase().includes('gmail');

    if (user && pass && !user.toLowerCase().endsWith('@ethereal.email') && isGmail) {
        console.log(`[EmailService] Initializing real Gmail SMTP delivery for: ${user}`);
        cachedTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user,
                pass
            }
        });
        return cachedTransporter;
    }

    // 2. Real custom SMTP configuration (Brevo, SendGrid, Mailgun, AWS SES, Hostinger, etc.)
    if (isUsingRealSMTP()) {
        if (process.env.SMTP_SERVICE) {
            console.log(`[EmailService] Initializing real SMTP using service: ${process.env.SMTP_SERVICE}`);
            cachedTransporter = nodemailer.createTransport({
                service: process.env.SMTP_SERVICE.trim(),
                auth: { user, pass }
            });
            return cachedTransporter;
        }

        const port = Number(process.env.SMTP_PORT) || 587;
        const secure = process.env.SMTP_SECURE === 'true' || port === 465;
        console.log(`[EmailService] Initializing real SMTP at ${process.env.SMTP_HOST}:${port} (secure=${secure})`);
        
        cachedTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST.trim(),
            port,
            secure,
            auth: { user, pass },
            tls: {
                rejectUnauthorized: process.env.NODE_ENV === 'production'
            }
        });
        return cachedTransporter;
    }

    // 3. Static Ethereal test credentials (only if user explicitly has @ethereal.email)
    if (user && pass && user.toLowerCase().endsWith('@ethereal.email')) {
        console.log('[EmailService] Using static Ethereal test account from .env');
        cachedTransporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: { user, pass }
        });
        return cachedTransporter;
    }

    // 4. Dynamic Ethereal test account (local dev fallback when no real SMTP credentials provided)
    try {
        console.log('[EmailService] No real SMTP configured. Creating dynamic Ethereal test account for local development...');
        const testAccount = await nodemailer.createTestAccount();
        cachedTransporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
        return cachedTransporter;
    } catch (err) {
        console.error('[EmailService] Failed to create Ethereal test account:', err.message);
        return null;
    }
}

exports.sendOTP = async (email, otp) => {
    const fromAddress = getFromAddress();
    const mailOptions = {
        from: fromAddress,
        to: email,
        subject: 'Your Verification OTP - CampusConnect',
        text: `Your OTP for CampusConnect verification is: ${otp}. It is valid for 10 minutes.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; margin: 0 auto;">
                <h2 style="color: #2563eb; margin-top: 0;">CampusConnect Verification</h2>
                <p style="color: #475569; font-size: 15px;">Your one-time verification code is:</p>
                <div style="background: #eff6ff; color: #1d4ed8; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 14px 20px; border-radius: 8px; text-align: center; margin: 16px 0;">
                    ${otp}
                </div>
                <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">This OTP expires in 10 minutes. If you did not request this, you can safely ignore this message.</p>
            </div>
        `
    };

    let previewUrl = null;
    let isRealDelivery = false;

    try {
        const transport = await getTransporter();
        if (transport) {
            const info = await transport.sendMail(mailOptions);
            if (isUsingRealSMTP()) {
                isRealDelivery = true;
                console.log(`✅ [EmailService] OTP email successfully delivered to real inbox: ${email} (MessageID: ${info.messageId})`);
            } else {
                previewUrl = nodemailer.getTestMessageUrl(info);
            }
        }
    } catch (error) {
        console.error('❌ [EmailService] Error dispatching OTP email:', error.message || error);
        if (isUsingRealSMTP()) {
            console.error('⚠️  Real SMTP delivery failed! Please verify your SMTP_USER, SMTP_PASS (App Password for Gmail), and firewall/port permissions in .env');
        }
    }

    // Always print high-visibility notification block to terminal
    console.log('\n============================================================');
    console.log('📬  [CAMPUSCONNECT] OTP DISPATCHED');
    console.log('------------------------------------------------------------');
    console.log(`👤  Recipient:   ${email}`);
    console.log(`🔑  OTP Code:    \x1b[32m\x1b[1m${otp}\x1b[0m  (Valid for 10 minutes)`);
    if (isRealDelivery) {
        console.log(`📨  Status:      \x1b[32mSent to real email inbox (${email})\x1b[0m`);
    } else if (previewUrl) {
        console.log('🔗  Ethereal Web Preview:');
        console.log(`    \x1b[36m\x1b[4m${previewUrl}\x1b[0m`);
    } else {
        console.log('ℹ️   Use the OTP code above to verify.');
    }
    console.log('============================================================\n');

    return { previewUrl, otp, isRealDelivery };
};

exports.sendStatusEmail = async (email, status) => {
    const mailOptions = {
        from: getFromAddress(),
        to: email,
        subject: `Appointment Status Update: ${status} - CampusConnect`,
        text: `Your appointment status has been updated to: ${status}. Log in to view details.`
    };
    try {
        const transport = await getTransporter();
        if (transport) {
            const info = await transport.sendMail(mailOptions);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            if (previewUrl) {
                console.log(`[EmailService] Status email dispatched to ${email}. Preview: ${previewUrl}`);
            } else {
                console.log(`[EmailService] Status email delivered to real inbox: ${email}`);
            }
        }
    } catch (error) {
        console.error('Error sending status email:', error);
    }
};

exports.sendServiceRemovalEmail = async (email, serviceTitle, feedback) => {
    const mailOptions = {
        from: getFromAddress(),
        to: email,
        subject: `Service Listing Moderation Notice: "${serviceTitle}" - CampusConnect`,
        text: `Your service "${serviceTitle}" has been removed from CampusConnect by the Super Admin.\n\nFeedback & Reason:\n${feedback}\n\nPlease review our community guidelines before creating a new listing.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #fed7aa; border-radius: 12px; background: #fffaf5;">
                <div style="background: #ea580c; color: white; padding: 12px 18px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                    CampusConnect • Service Moderation Notice
                </div>
                <h3 style="color: #9a3412; margin-top: 20px;">Your service listing has been removed</h3>
                <p style="color: #431407; font-size: 15px;">
                    Super Admin has reviewed and removed your service listing: <strong>"${serviceTitle}"</strong>.
                </p>
                <div style="background: #ffffff; border-left: 4px solid #ea580c; padding: 16px; margin: 16px 0; border-radius: 4px;">
                    <div style="font-weight: bold; color: #7c2d12; font-size: 13px; text-transform: uppercase; margin-bottom: 6px;">Admin Feedback & Reason:</div>
                    <div style="color: #334155; font-size: 14px; white-space: pre-wrap;">${feedback}</div>
                </div>
                <p style="color: #78716c; font-size: 13px;">
                    You are welcome to create a new revised service listing addressing the feedback above from your Partner Portal.
                </p>
            </div>
        `
    };

    try {
        const transport = await getTransporter();
        if (transport) {
            const info = await transport.sendMail(mailOptions);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log('\n============================================================');
            console.log('🚨 [ADMIN] SERVICE REMOVAL FEEDBACK DISPATCHED');
            console.log(`To:        ${email}`);
            console.log(`Service:   ${serviceTitle}`);
            console.log(`Feedback:  ${feedback}`);
            if (previewUrl) console.log(`🔗 Preview: ${previewUrl}`);
            console.log('============================================================\n');
        }
    } catch (error) {
        console.error('Error sending service removal email:', error);
    }
};

exports.sendPayoutClearedEmail = async (email, amount, utr, proofUrl) => {
    const mailOptions = {
        from: getFromAddress(),
        to: email,
        subject: `Partner Payout Cleared: ₹${amount} - CampusConnect`,
        text: `Your payout request of ₹${amount} has been cleared by Super Admin.\nUTR/Reference: ${utr || 'Direct UPI Transfer'}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #bbf7d0; border-radius: 12px; background: #f0fdf4;">
                <div style="background: #16a34a; color: white; padding: 12px 18px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                    ✓ Partner Payout Settled
                </div>
                <h3 style="color: #14532d; margin-top: 20px;">Funds Sent Directly to Your UPI</h3>
                <p style="color: #166534; font-size: 15px;">
                    Super Admin has processed your payout of <strong>₹${amount}</strong>.
                </p>
                <div style="background: #ffffff; border: 1px solid #dcfce7; padding: 16px; margin: 16px 0; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #64748b;">Amount Paid:</span>
                        <strong style="color: #15803d; font-size: 18px;">₹${amount}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #64748b;">Bank UTR / Ref:</span>
                        <span style="font-family: monospace; font-weight: bold;">${utr || 'N/A'}</span>
                    </div>
                </div>
                <p style="color: #15803d; font-size: 13px;">
                    Thank you for partnering with CampusConnect! You can review your payout history in your Partner Portal.
                </p>
            </div>
        `
    };

    try {
        const transport = await getTransporter();
        if (transport) {
            const info = await transport.sendMail(mailOptions);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log(`[EmailService] Payout cleared email sent to ${email}. Preview: ${previewUrl}`);
        }
    } catch (error) {
        console.error('Error sending payout email:', error);
    }
};
