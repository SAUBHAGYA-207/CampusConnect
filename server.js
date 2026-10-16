require('dotenv').config();
const http = require('http');
const app = require('./app');
const socketIo = require('socket.io');
const socketHandler = require('./src/sockets/socket');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = socketIo(server);

// Initialize sockets
socketHandler(io);

// Auto-healing port collision listener
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.warn(`[Server] Port ${PORT} is occupied by another process. Auto-recovering...`);
        try {
            if (process.platform === 'win32') {
                execSync(`powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue).OwningProcess -Force"`, { stdio: 'ignore' });
            } else {
                execSync(`fuser -k ${PORT}/tcp || true`, { stdio: 'ignore' });
            }
            console.log(`[Server] Zombie process on port ${PORT} cleared! Starting server now...`);
            setTimeout(() => {
                server.listen(PORT, () => {
                    console.log(`Server is running on port ${PORT}`);
                });
            }, 800);
        } catch (recoverErr) {
            console.error(`[Server] Could not automatically clear port ${PORT}. Error:`, recoverErr.message);
        }
    } else {
        console.error('[Server Error]', err);
    }
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Clean shutdown handlers for nodemon and process termination
const closeServer = (callback) => {
    try {
        io.close(() => {
            server.close(callback);
        });
    } catch (e) {
        if (callback) callback();
    }
};

process.once('SIGUSR2', () => {
    closeServer(() => {
        process.kill(process.pid, 'SIGUSR2');
    });
});

process.on('SIGINT', () => {
    closeServer(() => process.exit(0));
});

process.on('SIGTERM', () => {
    closeServer(() => process.exit(0));
});
