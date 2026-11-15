const session = require('express-session');
const path = require('path');
const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET || 'campusconnect_session_super_secret_key_2026';
const COOKIE_NAME = 'cc_sess';
const isProduction = Boolean(process.env.VERCEL || process.env.NODE_ENV === 'production');

const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

function signPayload(str) {
    const b64 = Buffer.from(str, 'utf8').toString('base64url');
    const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');
    return `${b64}.${hmac}`;
}

function verifyPayload(signedVal) {
    if (!signedVal || typeof signedVal !== 'string') return null;
    const dotIdx = signedVal.lastIndexOf('.');
    if (dotIdx === -1) return null;
    const b64 = signedVal.substring(0, dotIdx);
    const hmac = signedVal.substring(dotIdx + 1);
    const expectedHmac = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('base64url');

    if (hmac.length !== expectedHmac.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) return null;

    try {
        const jsonStr = Buffer.from(b64, 'base64url').toString('utf8');
        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
}

function parseCookies(header) {
    const list = {};
    if (!header) return list;
    const pairs = header.split(';');
    for (const pair of pairs) {
        const idx = pair.indexOf('=');
        if (idx < 0) continue;
        const key = pair.substring(0, idx).trim();
        const val = pair.substring(idx + 1).trim();
        try {
            list[key] = decodeURIComponent(val);
        } catch (e) {
            list[key] = val;
        }
    }
    return list;
}

function extractSessionState(sess) {
    if (!sess) return null;
    const state = {};
    if (sess.user) state.user = sess.user;
    if (sess.userId) state.userId = sess.userId;
    if (sess.resetUserId) state.resetUserId = sess.resetUserId;
    if (sess.resetEmail) state.resetEmail = sess.resetEmail;
    if (sess.adminPendingUserId) state.adminPendingUserId = sess.adminPendingUserId;
    if (sess.impersonatedFrom) state.impersonatedFrom = sess.impersonatedFrom;
    if (sess.upiVerification) state.upiVerification = sess.upiVerification;
    if (sess.flash && Object.keys(sess.flash).length > 0) state.flash = sess.flash;
    return Object.keys(state).length > 0 ? state : null;
}

module.exports = (app) => {
    let store;

    // Use FileStore in local development to preserve disk sessions
    if (!process.env.VERCEL) {
        try {
            const FileStore = require('session-file-store')(session);
            store = new FileStore({
                path: path.join(__dirname, '../../data/sessions'),
                retries: 5,
                factor: 1,
                minTimeout: 50,
                maxTimeout: 150,
                logFn: () => {}
            });
        } catch (err) {
            console.warn('[Session] Could not initialize FileStore, using default MemoryStore:', err.message);
        }
    }

    app.use(session({
        store,
        secret: SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        }
    }));

    // Serverless-resilient Session Hydration & Persistence Layer
    app.use((req, res, next) => {
        const cookies = parseCookies(req.headers.cookie);
        const signedCookie = cookies[COOKIE_NAME];
        let hasInboundCookie = Boolean(signedCookie);

        // 1. Inbound hydration from signed cookie if session state is missing in MemoryStore
        if (signedCookie && req.session) {
            const restored = verifyPayload(signedCookie);
            if (restored) {
                if (restored.user && (!req.session.user || !req.session.user.id)) {
                    req.session.user = restored.user;
                }
                if (restored.userId && !req.session.userId) {
                    req.session.userId = restored.userId;
                }
                if (restored.resetUserId && !req.session.resetUserId) {
                    req.session.resetUserId = restored.resetUserId;
                }
                if (restored.resetEmail && !req.session.resetEmail) {
                    req.session.resetEmail = restored.resetEmail;
                }
                if (restored.adminPendingUserId && !req.session.adminPendingUserId) {
                    req.session.adminPendingUserId = restored.adminPendingUserId;
                }
                if (restored.impersonatedFrom && !req.session.impersonatedFrom) {
                    req.session.impersonatedFrom = restored.impersonatedFrom;
                }
                if (restored.upiVerification && !req.session.upiVerification) {
                    req.session.upiVerification = restored.upiVerification;
                }
                if (restored.flash && !req.session.flash) {
                    req.session.flash = restored.flash;
                }
            }
        }

        let lastSerialized = null;

        const persistSessionToCookie = () => {
            if (res.headersSent) return;
            try {
                const state = extractSessionState(req.session);
                const serialized = state ? JSON.stringify(state) : '';
                if (serialized === lastSerialized) return;
                lastSerialized = serialized;

                if (state) {
                    const signed = signPayload(serialized);
                    res.cookie(COOKIE_NAME, signed, cookieOptions);
                } else if (hasInboundCookie) {
                    res.clearCookie(COOKIE_NAME, { path: '/', sameSite: 'lax' });
                    hasInboundCookie = false;
                }
            } catch (err) {
                console.error('[Session Sync Error]', err.message);
            }
        };

        // Hook req.session.save so any explicit save (like on login/register) updates the cookie immediately
        if (req.session) {
            const originalSave = req.session.save.bind(req.session);
            req.session.save = function (fn) {
                persistSessionToCookie();
                return originalSave(fn);
            };

            const originalDestroy = req.session.destroy.bind(req.session);
            req.session.destroy = function (fn) {
                try {
                    res.clearCookie(COOKIE_NAME, { path: '/', sameSite: 'lax' });
                    hasInboundCookie = false;
                } catch (e) {}
                return originalDestroy(fn);
            };
        }

        // Hook res.writeHead so outgoing responses always commit the latest session cookie
        const originalWriteHead = res.writeHead.bind(res);
        res.writeHead = function (...args) {
            persistSessionToCookie();
            return originalWriteHead(...args);
        };

        next();
    });
};
