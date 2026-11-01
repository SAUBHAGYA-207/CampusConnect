const session = require('express-session');
const path = require('path');

module.exports = (app) => {
    let store;

    // Only use FileStore in local development to prevent EROFS read-only filesystem crash on Vercel
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
        secret: process.env.SESSION_SECRET || 'campusconnect_session_secret_key',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 // 1 day
        }
    }));
};

