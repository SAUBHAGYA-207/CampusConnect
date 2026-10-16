const JsonStorage = require('../storage/jsonStorage');
const notificationsStorage = new JsonStorage('notifications');
let io;

exports.setIO = (socketIO) => {
    io = socketIO;
};

exports.createNotification = async (userId, message, link) => {
    const notif = await notificationsStorage.add({
        userId,
        message,
        link,
        read: false,
        createdAt: Date.now()
    });
    
    if (io) {
        io.to(`user_${userId}`).emit('new_notification', notif);
    }
    return notif;
};

exports.getNotificationsForUser = async (userId) => {
    const all = await notificationsStorage.getAll();
    return all.filter(n => n.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
};

exports.markAsRead = async (notificationId, userId) => {
    const notif = await notificationsStorage.getById(notificationId);
    if (notif && notif.userId === userId) {
        await notificationsStorage.update(notificationId, { read: true });
    }
};
