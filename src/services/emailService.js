const nodemailer = require('nodemailer');

let cachedTransporter = null;

function isUsingRealSMTP() {
    if (process.env.RESEND_API_KEY || process.env.BREVO_API_KEY) return true;
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
    if (process.env.SMTP_USER && process.env.SMTP_USER.trim()) {
        return `"CampusConnect" <${process.env.SMTP_USER.trim()}>`;
    }
    return '"CampusConnect" <noreply@campusconnect.com>';
}

/**
 * Dispatch email via Resend HTTP API (Port 443 - Never blocked by Render/AWS/Cloud)
 */
async function sendViaResend({ to, subject, html, text }) {
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    if (!apiKey) return null;

    let fromAddress = process.env.RESEND_FROM ? process.env.RESEND_FROM.trim() : null;
    if (!fromAddress) {
        const mailFrom = (process.env.MAIL_FROM || '').trim();
        if (mailFrom && !/@(gmail|googlemail|yahoo|hotmail|outlook|ethereal)\.com/i.test(mailFrom)) {
            fromAddress = mailFrom;
        } else {
            fromAddress = 'CampusConnect <onboarding@resend.dev>';
        }
    }
    const cleanFrom = fromAddress.includes('<') ? fromAddress : `CampusConnect <${fromAddress}>`;

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: cleanFrom,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
            text
        })
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || JSON.stringify(data));
    }
    return { messageId: data.id, provider: 'resend' };
}

/**
 * Dispatch email via Brevo HTTP API (Port 443 - Never blocked by Render/AWS/Cloud)
 * Sends to ANY recipient without requiring a custom domain.
 */
async function sendViaBrevo({ to, subject, html, text }) {
    const apiKey = (process.env.BREVO_API_KEY || '').trim();
    if (!apiKey) return null;

    let fromEmail = process.env.BREVO_FROM_EMAIL ? process.env.BREVO_FROM_EMAIL.trim() : null;
    let fromName = process.env.BREVO_FROM_NAME || 'CampusConnect';

    if (!fromEmail) {
        const mailFrom = (process.env.MAIL_FROM || '').trim();
        const match = mailFrom.match(/<([^>]+)>/);
        fromEmail = match ? match[1].trim() : (process.env.SMTP_USER ? process.env.SMTP_USER.trim() : 'campusconnect216@gmail.com');
        const nameMatch = mailFrom.match(/"([^"]+)"/);
        if (nameMatch) fromName = nameMatch[1].trim();
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'accept': 'application/json',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            sender: { name: fromName, email: fromEmail },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: text
        })
    });

    const data = await res.json();
    if (!res.ok) {
        if (data.message && data.message.includes('unrecognised IP address')) {
            console.error('\n⚠️  [Brevo Action Required] IP Blocking is active in your Brevo account:');
            console.error('   👉 Go to: https://app.brevo.com/security/authorised_ips');
            console.error('   👉 Turn OFF "Block unknown IP addresses" so Render can send emails freely without IP blocking.\n');
        }
        throw new Error(data.message || JSON.stringify(data));
    }
    return { messageId: data.messageId, provider: 'brevo' };
}

/**
 * Dispatch email via SendGrid HTTP API (Port 443 - Never blocked by Render/AWS/Cloud)
 * Zero IP restrictions out of the box. Sends to any recipient.
 */
async function sendViaSendGrid({ to, subject, html, text }) {
    const apiKey = (process.env.SENDGRID_API_KEY || '').trim();
    if (!apiKey) return null;

    let fromEmail = process.env.SENDGRID_FROM_EMAIL ? process.env.SENDGRID_FROM_EMAIL.trim() : null;
    let fromName = process.env.SENDGRID_FROM_NAME || 'CampusConnect';

    if (!fromEmail) {
        const mailFrom = (process.env.MAIL_FROM || '').trim();
        const match = mailFrom.match(/<([^>]+)>/);
        fromEmail = match ? match[1].trim() : (process.env.SMTP_USER ? process.env.SMTP_USER.trim() : 'campusconnect216@gmail.com');
        const nameMatch = mailFrom.match(/"([^"]+)"/);
        if (nameMatch) fromName = nameMatch[1].trim();
    }

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            personalizations: [{
                to: [{ email: to }]
            }],
            from: { email: fromEmail, name: fromName },
            subject,
            content: [
                { type: 'text/plain', value: text },
                { type: 'text/html', value: html }
            ]
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `SendGrid error status: ${res.status}`);
    }
    return { messageId: 'sendgrid-' + Date.now(), provider: 'sendgrid' };
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
            },
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 8000
        });
        return cachedTransporter;
    }

    // 2. Real custom SMTP configuration (Brevo, SendGrid, Mailgun, AWS SES, Hostinger, etc.)
    if (isUsingRealSMTP()) {
        if (process.env.SMTP_SERVICE) {
            console.log(`[EmailService] Initializing real SMTP using service: ${process.env.SMTP_SERVICE}`);
            cachedTransporter = nodemailer.createTransport({
                service: process.env.SMTP_SERVICE.trim(),
                auth: { user, pass },
                connectionTimeout: 5000,
                greetingTimeout: 5000,
                socketTimeout: 8000
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
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 8000,
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
            auth: { user, pass },
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 8000
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
            },
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 8000
        });
        return cachedTransporter;
    } catch (err) {
        console.error('[EmailService] Failed to create Ethereal test account:', err.message);
        return null;
    }
}

function isTestOrDummyEmail(email) {
    if (!email || typeof email !== 'string') return true;
    const lower = email.toLowerCase().trim();
    return lower.endsWith('.local') || 
           lower.endsWith('.test') || 
           lower.endsWith('.example') || 
           lower.endsWith('.invalid') ||
           lower.includes('campusconnect.local') ||
           lower.includes('@test.') ||
           lower.includes('testpartner_') ||
           lower.includes('customertick_') ||
           lower.includes('partnertick_');
}

/**
 * Universal email dispatcher (tries HTTP APIs first, then SMTP)
 */
async function sendMailUniversal({ to, subject, text, html }) {
    // Intercept automated test/dummy accounts so they never bounce on public mail servers
    if (isTestOrDummyEmail(to)) {
        console.log(`⏩ [EmailService] Test domain detected (${to}). Skipping outbound SMTP/API dispatch.`);
        return { success: true, isRealDelivery: false, previewUrl: null };
    }

    // 1. Try Brevo HTTP API (Port 443 HTTPS - sends to ANY student email without custom domain requirement)
    if (process.env.BREVO_API_KEY) {
        try {
            const brevoResult = await sendViaBrevo({ to, subject, html, text });
            if (brevoResult) {
                console.log(`✅ [EmailService] Email delivered via Brevo API to: ${to} (ID: ${brevoResult.messageId})`);
                return { success: true, isRealDelivery: true, previewUrl: null };
            }
        } catch (brevoErr) {
            console.error('❌ [EmailService] Brevo API Error:', brevoErr.message);
        }
    }

    // 2. Try SendGrid HTTP API (Port 443 HTTPS - zero IP restrictions, sends to any recipient)
    if (process.env.SENDGRID_API_KEY) {
        try {
            const sendgridResult = await sendViaSendGrid({ to, subject, html, text });
            if (sendgridResult) {
                console.log(`✅ [EmailService] Email delivered via SendGrid API to: ${to}`);
                return { success: true, isRealDelivery: true, previewUrl: null };
            }
        } catch (sgErr) {
            console.error('❌ [EmailService] SendGrid API Error:', sgErr.message);
        }
    }

    // 3. Try Resend HTTP API (Port 443 HTTPS - bypasses Render SMTP firewall)
    if (process.env.RESEND_API_KEY) {
        try {
            const resendResult = await sendViaResend({ to, subject, html, text });
            if (resendResult) {
                console.log(`✅ [EmailService] Email delivered via Resend API to: ${to} (ID: ${resendResult.messageId})`);
                return { success: true, isRealDelivery: true, previewUrl: null };
            }
        } catch (resendErr) {
            console.error('❌ [EmailService] Resend API Error:', resendErr.message);
        }
    }

    // 3. Fall back to standard SMTP (Gmail / Custom SMTP / Ethereal)
    const mailOptions = {
        from: getFromAddress(),
        to,
        subject,
        text,
        html
    };

    const transport = await getTransporter();
    if (!transport) {
        return { success: false, isRealDelivery: false, previewUrl: null };
    }

    try {
        const info = await transport.sendMail(mailOptions);
        if (isUsingRealSMTP()) {
            console.log(`✅ [EmailService] Email successfully delivered to real inbox: ${to} (MessageID: ${info.messageId})`);
            return { success: true, isRealDelivery: true, previewUrl: null };
        } else {
            const previewUrl = nodemailer.getTestMessageUrl(info);
            return { success: true, isRealDelivery: false, previewUrl };
        }
    } catch (smtpErr) {
        console.error('❌ [EmailService] Error dispatching email via SMTP:', smtpErr.message || smtpErr);
        if (smtpErr.message && (smtpErr.message.includes('timeout') || smtpErr.message.includes('ETIMEDOUT') || smtpErr.message.includes('ECONNREFUSED'))) {
            console.error('\n⚠️  RENDER / CLOUD SMTP PORT BLOCK DETECTED:');
            console.error('   Render Free Tier blocks outbound SMTP ports 25, 465, and 587.');
            console.error('   👉 Quick Fix 1: Check your Render service Logs tab to view the OTP code!');
            console.error('   👉 Quick Fix 2: Add RESEND_API_KEY to Render Environment to send via HTTPS (Port 443).\n');
        }
        return { success: false, isRealDelivery: false, previewUrl: null };
    }
}

exports.sendOTP = async (email, otp) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; margin: 0 auto;">
            <h2 style="color: #2563eb; margin-top: 0;">CampusConnect Verification</h2>
            <p style="color: #475569; font-size: 15px;">Your one-time verification code is:</p>
            <div style="background: #eff6ff; color: #1d4ed8; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 14px 20px; border-radius: 8px; text-align: center; margin: 16px 0;">
                ${otp}
            </div>
            <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">This OTP expires in 10 minutes. If you did not request this, you can safely ignore this message.</p>
        </div>
    `;
    const text = `Your OTP for CampusConnect verification is: ${otp}. It is valid for 10 minutes.`;

    const result = await sendMailUniversal({
        to: email,
        subject: 'Your Verification OTP - CampusConnect',
        text,
        html
    });

    // Always print high-visibility notification block to terminal (vital for Render logs!)
    console.log('\n============================================================');
    console.log('📬  [CAMPUSCONNECT] OTP DISPATCHED');
    console.log('------------------------------------------------------------');
    console.log(`👤  Recipient:   ${email}`);
    console.log(`🔑  OTP Code:    \x1b[32m\x1b[1m${otp}\x1b[0m  (Valid for 10 minutes)`);
    if (result.isRealDelivery) {
        console.log(`📨  Status:      \x1b[32mSent to real email inbox (${email})\x1b[0m`);
    } else if (result.previewUrl) {
        console.log('🔗  Ethereal Web Preview:');
        console.log(`    \x1b[36m\x1b[4m${result.previewUrl}\x1b[0m`);
    } else {
        console.log('ℹ️   Use the OTP code above to verify.');
    }
    console.log('============================================================\n');

    return { previewUrl: result.previewUrl, otp, isRealDelivery: result.isRealDelivery };
};

exports.sendStatusEmail = async (email, status) => {
    const subject = `Appointment Status Update: ${status} - CampusConnect`;
    const text = `Your appointment status has been updated to: ${status}. Log in to view details.`;
    await sendMailUniversal({ to: email, subject, text, html: `<p>${text}</p>` });
};

exports.sendServiceRemovalEmail = async (email, serviceTitle, feedback) => {
    const subject = `Service Listing Moderation Notice: "${serviceTitle}" - CampusConnect`;
    const text = `Your service "${serviceTitle}" has been removed from CampusConnect by the Super Admin.\n\nFeedback & Reason:\n${feedback}\n\nPlease review our community guidelines before creating a new listing.`;
    const html = `
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
    `;

    console.log('\n============================================================');
    console.log('🚨 [ADMIN] SERVICE REMOVAL FEEDBACK DISPATCHED');
    console.log(`To:        ${email}`);
    console.log(`Service:   ${serviceTitle}`);
    console.log(`Feedback:  ${feedback}`);
    console.log('============================================================\n');

    await sendMailUniversal({ to: email, subject, text, html });
};

exports.sendPayoutClearedEmail = async (email, amount, utr, proofUrl) => {
    const subject = `Partner Payout Cleared: ₹${amount} - CampusConnect`;
    const text = `Your payout request of ₹${amount} has been cleared by Super Admin.\nUTR/Reference: ${utr || 'Direct UPI Transfer'}`;
    const html = `
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
    `;

    await sendMailUniversal({ to: email, subject, text, html });
};
