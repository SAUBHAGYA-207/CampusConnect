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
exports.saveAdminMessage = async (targetUserId, senderId, senderRole, text, senderName, senderEmail) => {
    // In Supabase admin_messages table: id, partnerId, senderId, senderRole, text, timestamp
    // When senderRole is admin, persist the admin's email or name into senderId for zero-migration attribution
    const effectiveSenderId = (senderRole === 'admin' && (senderEmail || senderName))
        ? (senderEmail || senderName)
        : senderId;

    const payload = {
        partnerId: targetUserId,
        senderId: effectiveSenderId,
        senderRole,
        text,
        timestamp: Date.now()
    };

    const saved = await adminMessagesStorage.add(payload);

    return {
        ...saved,
        targetUserId,
        partnerId: targetUserId,
        senderId: saved.senderId,
        senderRole: saved.senderRole,
        senderName: senderName || (senderRole === 'admin' ? (saved.senderId || 'Super Admin') : 'User'),
        senderEmail: senderEmail || (senderRole === 'admin' && saved.senderId && saved.senderId.includes('@') ? saved.senderId : ''),
        text: saved.text,
        timestamp: saved.timestamp
    };
};

exports.getAdminMessagesForUser = async (targetUserId) => {
    const all = await adminMessagesStorage.getAll();
    return all
        .filter(m => (m.targetUserId === targetUserId || m.partnerId === targetUserId))
        .map(m => {
            const isEmail = m.senderId && m.senderId.includes('@');
            const adminEmail = m.senderEmail || (m.senderRole === 'admin' && isEmail ? m.senderId : '');
            const adminName = m.senderName || (m.senderRole === 'admin' ? (m.senderId || 'Super Admin') : 'User');
            return {
                ...m,
                targetUserId: m.targetUserId || m.partnerId,
                partnerId: m.partnerId || m.targetUserId,
                senderEmail: adminEmail,
                senderName: adminName
            };
        })
        .sort((a, b) => a.timestamp - b.timestamp);
};

exports.getAdminChatUsers = async () => {
    const all = await adminMessagesStorage.getAll();
    const users = await usersStorage.getAll();
    const userMap = new Map(users.map(u => [u.id, u]));

    const userLastMsgMap = new Map();
    all.forEach(m => {
        const uid = m.targetUserId || m.partnerId;
        if (!uid) return;
        const existing = userLastMsgMap.get(uid);
        if (!existing || m.timestamp > existing.timestamp) {
            userLastMsgMap.set(uid, {
                ...m,
                targetUserId: uid,
                partnerId: uid
            });
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
