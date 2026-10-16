require('dotenv').config();
const http = require('http');
const app = require('./app');
const socketIo = require('socket.io');
const socketHandler = require('./src/sockets/socket');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = socketIo(server);

// Initialize sockets
socketHandler(io);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Clean shutdown handlers for nodemon and process termination
const closeServer = (callback) => {
    io.close(() => {
        server.close(callback);
    });
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
