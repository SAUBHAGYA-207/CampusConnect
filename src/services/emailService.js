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

exports.sendUpiVerificationOTP = async (email, otp, upiId) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; margin: 0 auto;">
            <div style="background: #146B4F; color: white; padding: 12px 18px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                CampusConnect • Security Verification
            </div>
            <h3 style="color: #2c1810; margin-top: 20px;">Authorize UPI ID Registration / Update</h3>
            <p style="color: #475569; font-size: 15px;">You requested to set your payout UPI ID to <strong>${upiId}</strong>. To confirm this change, enter the one-time security code below:</p>
            <div style="background: #EBF7F1; color: #146B4F; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 14px 20px; border-radius: 8px; text-align: center; margin: 16px 0; border: 1px dashed #146B4F;">
                ${otp}
            </div>
            <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">This security code expires in 10 minutes. If you did not initiate this change, please ignore this email or contact support immediately.</p>
        </div>
    `;
    const text = `Your OTP code to authorize setting your UPI ID to ${upiId} on CampusConnect is: ${otp}. It is valid for 10 minutes.`;

    const result = await sendMailUniversal({
        to: email,
        subject: 'UPI ID Verification Code - CampusConnect',
        text,
        html
    });

    return { previewUrl: result.previewUrl, otp, isRealDelivery: result.isRealDelivery };
};

exports.sendPasswordResetOTP = async (email, otp) => {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; margin: 0 auto;">
            <div style="background: #963D24; color: white; padding: 12px 18px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                CampusConnect • Password Reset Request
            </div>
            <h3 style="color: #2c1810; margin-top: 20px;">Reset Your Password</h3>
            <p style="color: #475569; font-size: 15px;">We received a request to reset your password. Use the verification code below to authorize the change:</p>
            <div style="background: #FBF0EB; color: #963D24; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 14px 20px; border-radius: 8px; text-align: center; margin: 16px 0; border: 1px dashed #963D24;">
                ${otp}
            </div>
            <p style="color: #64748b; font-size: 13px;">This OTP expires in 10 minutes. If you did not make this request, please disregard this email — your existing password remains safe and unchanged.</p>
        </div>
    `;
    const text = `Your CampusConnect password reset verification code is: ${otp}. It is valid for 10 minutes. If you did not request this, ignore this email.`;

    const result = await sendMailUniversal({
        to: email,
        subject: 'Password Reset OTP Code - CampusConnect',
        text,
        html
    });

    console.log('\n============================================================');
    console.log('🔑  [CAMPUSCONNECT] PASSWORD RESET OTP DISPATCHED');
    console.log('------------------------------------------------------------');
    console.log(`👤  Recipient:   ${email}`);
    console.log(`🔐  Reset Code:  \x1b[33m\x1b[1m${otp}\x1b[0m  (Valid for 10 minutes)`);
    if (result.isRealDelivery) {
        console.log(`📨  Status:      \x1b[32mSent to real email inbox (${email})\x1b[0m`);
    } else if (result.previewUrl) {
        console.log('🔗  Ethereal Web Preview:');
        console.log(`    \x1b[36m\x1b[4m${result.previewUrl}\x1b[0m`);
    } else {
        console.log('ℹ️   Use the OTP code above to complete password reset.');
    }
    console.log('============================================================\n');

    return { previewUrl: result.previewUrl, otp, isRealDelivery: result.isRealDelivery };
};

exports.sendStatusEmail = async (email, status) => {
    const subject = `Appointment Status Update: ${status} - CampusConnect`;
    const text = `Your appointment status has been updated to: ${status}. Log in to view details.`;
    await sendMailUniversal({ to: email, subject, text, html: `<p>${text}</p>` });
};

exports.sendServiceCompletedFeedbackEmail = async (customerEmail, customerName, serviceTitle, partnerName, appointmentId) => {
    const subject = `⭐ How was your experience with "${serviceTitle}"? Share Your Feedback - CampusConnect`;
    const text = `Hi ${customerName},\n\nYour service "${serviceTitle}" with partner ${partnerName} has been completed! Please share your feedback to help fellow students.\n\nReview link: http://localhost:3000/appointments/my-bookings/${appointmentId}\n\nThank you for choosing CampusConnect!`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #fed7aa; border-radius: 12px; background: #fffaf5; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #146B4F 0%, #0d4a36 100%); color: white; padding: 14px 20px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                ✓ Service Completed • Share Your Feedback
            </div>
            <h3 style="color: #2c1810; margin-top: 20px;">Hi ${customerName}, how did it go?</h3>
            <p style="color: #475569; font-size: 15px; line-height: 1.5;">
                Your booking for <strong>"${serviceTitle}"</strong> with partner <strong>${partnerName}</strong> has been marked as <strong>Completed</strong>.
            </p>
            <div style="background: #ffffff; border: 1.5px solid #fed7aa; padding: 20px; margin: 20px 0; border-radius: 10px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: #7c2d12; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
                    Rate Your Experience
                </div>
                <div style="font-size: 28px; margin-bottom: 14px; letter-spacing: 6px;">
                    ⭐⭐⭐⭐⭐
                </div>
                <p style="color: #64748b; font-size: 13px; margin-bottom: 16px;">
                    Your ratings & comments help fellow students find reliable peers and help partner ${partnerName} build their reputation.
                </p>
                <a href="http://localhost:3000/appointments/my-bookings/${appointmentId}#feedback-card" 
                   style="display: inline-block; background: #146B4F; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none; font-size: 15px;">
                    ⭐ Leave Review & Feedback →
                </a>
            </div>
            <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">
                CampusConnect • Empowering student entrepreneurship and campus collaboration.
            </p>
        </div>
    `;

    console.log('\n============================================================');
    console.log('⭐  [CAMPUSCONNECT] SERVICE COMPLETED FEEDBACK EMAIL DISPATCHED');
    console.log('------------------------------------------------------------');
    console.log(`👤  Customer:    ${customerEmail}`);
    console.log(`🛠️   Service:     "${serviceTitle}"`);
    console.log(`🤝  Partner:     ${partnerName}`);
    console.log(`🔗  Feedback:    http://localhost:3000/appointments/my-bookings/${appointmentId}`);
    console.log('============================================================\n');

    return await sendMailUniversal({ to: customerEmail, subject, text, html });
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

exports.sendRefundClearedEmail = async (email, amount, utr, proofUrl) => {
    const subject = `Booking Refund Cleared: ₹${amount} - CampusConnect`;
    const text = `Your refund of ₹${amount} for your cancelled booking has been cleared by Super Admin.\nUTR/Reference: ${utr || 'Direct UPI Transfer'}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #bbf7d0; border-radius: 12px; background: #f0fdf4;">
            <div style="background: #16a34a; color: white; padding: 12px 18px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                ✓ Booking Refund Settled
            </div>
            <h3 style="color: #14532d; margin-top: 20px;">Refund Transferred to Your UPI</h3>
            <p style="color: #166534; font-size: 15px;">
                Super Admin has processed your refund of <strong>₹${amount}</strong> for your cancelled booking.
            </p>
            <div style="background: #ffffff; border: 1px solid #dcfce7; padding: 16px; margin: 16px 0; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #64748b;">Amount Refunded:</span>
                    <strong style="color: #15803d; font-size: 18px;">₹${amount}</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: #64748b;">Bank UTR / Ref:</span>
                    <span style="font-family: monospace; font-weight: bold;">${utr || 'Direct UPI Transfer'}</span>
                </div>
            </div>
            <p style="color: #15803d; font-size: 13px;">
                Thank you for using CampusConnect!
            </p>
        </div>
    `;

    await sendMailUniversal({ to: email, subject, text, html });
};

exports.sendPayoutRejectedEmail = async (email, amount, reason) => {
    const subject = `Payout Request Update: ₹${amount} - CampusConnect`;
    const text = `Your payout request of ₹${amount} was rejected by Super Admin.\nReason: ${reason || 'Details could not be verified'}\nFunds have been restored to your available balance.`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #fecaca; border-radius: 12px; background: #fef2f2;">
            <div style="background: #dc2626; color: white; padding: 12px 18px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                ✗ Payout Request Rejected
            </div>
            <h3 style="color: #991b1b; margin-top: 20px;">Payout Request Declined</h3>
            <p style="color: #7f1d1d; font-size: 15px;">
                Your payout request of <strong>₹${amount}</strong> was rejected by Super Admin.
            </p>
            <div style="background: #ffffff; border: 1px solid #fee2e2; padding: 16px; margin: 16px 0; border-radius: 8px;">
                <div style="margin-bottom: 8px;">
                    <span style="color: #64748b;">Amount:</span>
                    <strong style="color: #991b1b; font-size: 16px;"> ₹${amount}</strong>
                </div>
                <div>
                    <span style="color: #64748b;">Reason for Rejection:</span>
                    <p style="color: #dc2626; font-weight: bold; margin: 4px 0 0 0;">${reason || 'Details could not be verified'}</p>
                </div>
            </div>
            <p style="color: #7f1d1d; font-size: 13px;">
                The requested funds have been returned to your available balance. Please ensure your UPI ID is configured and verified before requesting again.
            </p>
        </div>
    `;

    await sendMailUniversal({ to: email, subject, text, html });
};
