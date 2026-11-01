const JsonStorage = require('../storage/jsonStorage');
const messagesStorage = new JsonStorage('messages');
const adminMessagesStorage = new JsonStorage('admin_messages');
const usersStorage = new JsonStorage('users');

exports.saveMessage = async (appointmentId, senderId, senderRole, text, imageUrl, status = 'sent') => {
    let payloadText = text || '';
    if (imageUrl) {
        payloadText = `[IMAGE]${imageUrl}[/IMAGE]${payloadText ? ' ' + payloadText : ''}`;
    }
    if (status && status !== 'sent') {
        payloadText = `[STATUS:${status}]${payloadText}`;
    }

    const saved = await messagesStorage.add({
        appointmentId,
        senderId,
        senderRole,
        text: payloadText,
        timestamp: Date.now()
    });

    return {
        ...saved,
        text: text || '',
        imageUrl: imageUrl || null,
        status: status || 'sent'
    };
};

exports.getMessagesForAppointment = async (appointmentId) => {
    const all = await messagesStorage.getAll();
    return all
        .filter(m => m.appointmentId === appointmentId)
        .map(m => {
            let text = m.text || '';
            let imageUrl = m.imageUrl || null;
            let status = 'sent';

            if (text && text.includes('[STATUS:')) {
                const matchStatus = text.match(/\[STATUS:(sent|delivered|read)\]/);
                if (matchStatus) {
                    status = matchStatus[1];
                    text = text.replace(matchStatus[0], '');
                }
            }

            if (text && text.includes('[IMAGE]')) {
                const match = text.match(/\[IMAGE\](.*?)\[\/IMAGE\]/);
                if (match) {
                    imageUrl = match[1];
                    text = text.replace(match[0], '').trim();
                }
            }

            return {
                ...m,
                text,
                imageUrl,
                status
            };
        })
        .sort((a, b) => a.timestamp - b.timestamp);
};

exports.markMessagesAsRead = async (appointmentId, readerId) => {
    try {
        const all = await messagesStorage.getAll();
        const unreadMessages = all.filter(m => m.appointmentId === appointmentId && m.senderId !== readerId);
        
        for (const m of unreadMessages) {
            let text = m.text || '';
            let currentStatus = 'sent';
            if (text.includes('[STATUS:')) {
                const matchStatus = text.match(/\[STATUS:(sent|delivered|read)\]/);
                if (matchStatus) currentStatus = matchStatus[1];
            }
            if (currentStatus !== 'read') {
                let newText = text;
                if (newText.includes('[STATUS:')) {
                    newText = newText.replace(/\[STATUS:(sent|delivered|read)\]/, '[STATUS:read]');
                } else {
                    newText = `[STATUS:read]${newText}`;
                }
                await messagesStorage.update(m.id, { text: newText });
            }
        }
        return true;
    } catch (err) {
        console.warn('Could not update messages read status:', err.message);
        return false;
    }
};

// Admin direct communication with each user/partner
exports.saveAdminMessage = async (targetUserId, senderId, senderRole, text, senderName, senderEmail, status = 'sent') => {
    // In Supabase admin_messages table: id, partnerId, senderId, senderRole, text, timestamp
    const effectiveSenderId = (senderRole === 'admin' && (senderEmail || senderName))
        ? (senderEmail || senderName)
        : senderId;

    let payloadText = text || '';
    if (status && status !== 'sent') {
        payloadText = `[STATUS:${status}]${payloadText}`;
    }

    const payload = {
        partnerId: targetUserId,
        senderId: effectiveSenderId,
        senderRole,
        text: payloadText,
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
        text: text || '',
        status: status || 'sent',
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
            let text = m.text || '';
            let status = 'sent';

            if (text && text.includes('[STATUS:')) {
                const matchStatus = text.match(/\[STATUS:(sent|delivered|read)\]/);
                if (matchStatus) {
                    status = matchStatus[1];
                    text = text.replace(matchStatus[0], '');
                }
            }

            return {
                ...m,
                targetUserId: m.targetUserId || m.partnerId,
                partnerId: m.partnerId || m.targetUserId,
                senderEmail: adminEmail,
                senderName: adminName,
                text,
                status
            };
        })
        .sort((a, b) => a.timestamp - b.timestamp);
};

exports.markAdminMessagesAsRead = async (targetUserId, readerRole) => {
    try {
        const all = await adminMessagesStorage.getAll();
        const unread = all.filter(m => 
            (m.targetUserId === targetUserId || m.partnerId === targetUserId) && 
            m.senderRole !== readerRole
        );
        for (const m of unread) {
            let text = m.text || '';
            let currentStatus = 'sent';
            if (text.includes('[STATUS:')) {
                const match = text.match(/\[STATUS:(sent|delivered|read)\]/);
                if (match) currentStatus = match[1];
            }
            if (currentStatus !== 'read') {
                let newText = text;
                if (newText.includes('[STATUS:')) {
                    newText = newText.replace(/\[STATUS:(sent|delivered|read)\]/, '[STATUS:read]');
                } else {
                    newText = `[STATUS:read]${newText}`;
                }
                await adminMessagesStorage.update(m.id, { text: newText });
            }
        }
        return true;
    } catch (err) {
        console.warn('Could not update admin messages read status:', err.message);
        return false;
    }
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
