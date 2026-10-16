const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');

module.exports = (app) => {
    app.use(session({
        store: new FileStore({
            path: path.join(__dirname, '../../data/sessions'),
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
            secure: false,
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 // 1 day
        }
    }));
};
