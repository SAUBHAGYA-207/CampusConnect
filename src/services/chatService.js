const JsonStorage = require('../storage/jsonStorage');
const messagesStorage = new JsonStorage('messages');
const adminMessagesStorage = new JsonStorage('admin_messages');
const usersStorage = new JsonStorage('users');

exports.saveMessage = async (appointmentId, senderId, senderRole, text) => {
    return await messagesStorage.add({
        appointmentId,
        senderId,
        senderRole,
        text,
        timestamp: Date.now()
    });
};

exports.getMessagesForAppointment = async (appointmentId) => {
    const all = await messagesStorage.getAll();
    return all.filter(m => m.appointmentId === appointmentId).sort((a, b) => a.timestamp - b.timestamp);
};

// Admin direct communication with each user/partner
exports.saveAdminMessage = async (targetUserId, senderId, senderRole, text) => {
    return await adminMessagesStorage.add({
        targetUserId, // the customer or partner user ID
        senderId,
        senderRole,
        text,
        timestamp: Date.now()
    });
};

exports.getAdminMessagesForUser = async (targetUserId) => {
    const all = await adminMessagesStorage.getAll();
    return all.filter(m => m.targetUserId === targetUserId).sort((a, b) => a.timestamp - b.timestamp);
};

exports.getAdminChatUsers = async () => {
    const all = await adminMessagesStorage.getAll();
    const users = await usersStorage.getAll();
    const userMap = new Map(users.map(u => [u.id, u]));

    const userLastMsgMap = new Map();
    all.forEach(m => {
        const existing = userLastMsgMap.get(m.targetUserId);
        if (!existing || m.timestamp > existing.timestamp) {
            userLastMsgMap.set(m.targetUserId, m);
        }
    });

    const activeChatUsers = [];
    userLastMsgMap.forEach((lastMsg, uid) => {
        const u = userMap.get(uid);
        if (u) {
            activeChatUsers.push({
                user: u,
                lastMessage: lastMsg
            });
        }
    });

    return activeChatUsers.sort((a, b) => b.lastMessage.timestamp - a.lastMessage.timestamp);
};
