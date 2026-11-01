const chatService = require('../services/chatService');
const appointmentService = require('../services/appointmentService');
const notificationService = require('../services/notificationService');

module.exports = (io) => {
    notificationService.setIO(io);

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

        // Join user's personal room for notifications
        socket.on('join_user_room', (userId) => {
            socket.join(`user_${userId}`);
            console.log(`Socket ${socket.id} joined user_${userId}`);
        });

        // Join appointment chat room
        socket.on('join_appointment_room', async (data) => {
            const { appointmentId, userId } = data;
            try {
                const app = await appointmentService.getAppointmentById(appointmentId);
                if (app && (app.customerId === userId || app.providerId === userId)) {
                    socket.join(`appt_${appointmentId}`);
                    console.log(`Socket ${socket.id} joined appt_${appointmentId}`);

                    // Mark past messages from the other participant as read
                    await chatService.markMessagesAsRead(appointmentId, userId);
                    io.to(`appt_${appointmentId}`).emit('messages_read', { appointmentId, readerId: userId });
                }
            } catch (err) {
                console.error(err);
            }
        });

        // Mark appointment messages as read (e.g. while actively viewing chat)
        socket.on('mark_read', async (data) => {
            const { appointmentId, userId } = data;
            if (appointmentId && userId) {
                try {
                    await chatService.markMessagesAsRead(appointmentId, userId);
                    io.to(`appt_${appointmentId}`).emit('messages_read', { appointmentId, readerId: userId });
                } catch (err) {
                    console.error('Error marking messages read:', err);
                }
            }
        });

        // Handle sending messages
        socket.on('send_message', async (data) => {
            const { appointmentId, userId, role, text, imageUrl } = data;
            try {
                const app = await appointmentService.getAppointmentById(appointmentId);
                if (app && (app.customerId === userId || app.providerId === userId)) {
                    // Block chat if order is cancelled or rejected
                    if (app.status === 'cancelled' || app.status === 'rejected') {
                        socket.emit('chat_error', { message: 'Chat is blocked because this booking has been cancelled.' });
                        return;
                    }

                    const receiverId = role === 'provider' ? app.customerId : app.providerId;

                    // Check if the other party is actively in the appointment chat room
                    const room = io.sockets.adapter.rooms.get(`appt_${appointmentId}`);
                    const isRecipientInRoom = room && room.size > 1;

                    // Check if recipient is connected anywhere on site
                    const userRoom = io.sockets.adapter.rooms.get(`user_${receiverId}`);
                    const isRecipientOnline = userRoom && userRoom.size > 0;

                    let initialStatus = 'sent';
                    if (isRecipientInRoom) {
                        initialStatus = 'read';
                    } else if (isRecipientOnline) {
                        initialStatus = 'delivered';
                    }

                    const msg = await chatService.saveMessage(appointmentId, userId, role, text, imageUrl, initialStatus);
                    io.to(`appt_${appointmentId}`).emit('new_message', msg);
                    
                    // Notification to the other party
                    await notificationService.createNotification(
                        receiverId, 
                        `New message regarding your appointment for ${app.date}`,
                        role === 'provider' ? `/appointments/my-bookings/${appointmentId}` : `/appointments/provider`
                    );
                }
            } catch (err) {
                console.error(err);
            }
        });

        // Admin Direct Chat Handlers
        socket.on('join_admin_chat', async (data) => {
            const { targetUserId, readerRole } = data;
            if (targetUserId) {
                socket.join(`admin_chat_${targetUserId}`);
                console.log(`Socket ${socket.id} joined admin_chat_${targetUserId}`);

                if (readerRole) {
                    await chatService.markAdminMessagesAsRead(targetUserId, readerRole);
                    io.to(`admin_chat_${targetUserId}`).emit('admin_messages_read', { targetUserId, readerRole });
                }
            }
        });

        socket.on('admin_mark_read', async (data) => {
            const { targetUserId, readerRole } = data;
            if (targetUserId && readerRole) {
                try {
                    await chatService.markAdminMessagesAsRead(targetUserId, readerRole);
                    io.to(`admin_chat_${targetUserId}`).emit('admin_messages_read', { targetUserId, readerRole });
                } catch (err) {
                    console.error('Error marking admin messages read:', err);
                }
            }
        });

        socket.on('admin_send_message', async (data) => {
            const { targetUserId, senderId, senderRole, senderName, senderEmail, text } = data;
            if (!targetUserId || !text) return;

            try {
                const room = io.sockets.adapter.rooms.get(`admin_chat_${targetUserId}`);
                const isRecipientInRoom = room && room.size > 1;
                const initialStatus = isRecipientInRoom ? 'read' : 'sent';

                const msg = await chatService.saveAdminMessage(targetUserId, senderId, senderRole, text, senderName, senderEmail, initialStatus);
                io.to(`admin_chat_${targetUserId}`).emit('new_admin_message', msg);

                // If sent by admin, notify user; if sent by user, notify admin
                if (senderRole === 'admin') {
                    await notificationService.createNotification(
                        targetUserId,
                        `New support message from Admin (${senderEmail || senderName || 'Super Admin'})`,
                        '/support/chat'
                    );
                } else {
                    io.to('admin_room').emit('new_admin_notification', {
                        title: 'New User Message',
                        text: `User message from ${senderEmail || senderName || senderId}`,
                        targetUserId
                    });
                }
            } catch (err) {
                console.error('Error handling admin message:', err);
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });
    });
};
