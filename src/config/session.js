const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const os = require('os');
const fs = require('fs');

module.exports = (app) => {
    // On Vercel / serverless, write to /tmp to prevent EROFS errors
    const isVercel = Boolean(process.env.VERCEL);
    const sessionDir = isVercel
        ? path.join(os.tmpdir(), 'campusconnect-sessions')
        : path.join(__dirname, '../../data/sessions');

    try {
        fs.mkdirSync(sessionDir, { recursive: true });
    } catch (e) {}

    app.use(session({
        store: new FileStore({
            path: sessionDir,
            retries: 5,
            factor: 1,
            minTimeout: 50,
            maxTimeout: 150,
            logFn: () => {}
        }),
        secret: process.env.SESSION_SECRET || 'campusconnect_session_secret_key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 // 1 day
        }
    }));
};
