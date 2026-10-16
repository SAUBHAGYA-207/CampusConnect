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
