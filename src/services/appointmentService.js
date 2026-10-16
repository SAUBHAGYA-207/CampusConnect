const JsonStorage = require('../storage/jsonStorage');
const appointmentsStorage = new JsonStorage('appointments');
const servicesStorage = new JsonStorage('services');
const { createNotification } = require('./notificationService');
const { sendStatusEmail } = require('./emailService');

exports.createAppointment = async (customerId, serviceId, date, time, notes, paymentData = {}) => {
    const service = await servicesStorage.getById(serviceId);
    if (!service) throw new Error('Service not found');

    if (service.providerId === customerId) {
        throw new Error('You cannot book your own service listing.');
    }

    const allApps = await appointmentsStorage.getAll();
    const isBooked = allApps.some(a => a.serviceId === serviceId && a.date === date && a.time === time && a.status !== 'cancelled' && a.status !== 'rejected');
    if (isBooked) {
        throw new Error('This time slot is already booked. Please choose another date or time.');
    }

    const price = Number(service.price) || 0;
    // 90% provider earnings, 10% platform commission
    const providerEarnings = parseFloat((price * 0.90).toFixed(2));
    const platformFee = parseFloat((price * 0.10).toFixed(2));

    const newAppointment = await appointmentsStorage.add({
        customerId,
        providerId: service.providerId,
        serviceId,
        date,
        time,
        notes: notes || '',
        status: 'pending',
        paymentAmount: price,
        providerEarnings: providerEarnings,
        platformFee: platformFee,
        paymentScreenshot: paymentData.paymentScreenshot || null,
        transactionId: paymentData.transactionId || null,
        paymentStatus: paymentData.paymentScreenshot ? 'submitted' : 'pending',
        createdAt: Date.now()
    });

    // Notify provider about the new booking and payment proof
    try {
        await createNotification(
            service.providerId,
            `New booking request with payment proof received for "${service.title}" (₹${price})`,
            `/appointments/provider/${newAppointment.id}`
        );
    } catch (e) {
        console.error('Error creating notification:', e);
    }

    return newAppointment;
};

exports.updatePaymentStatus = async (appointmentId, providerId, newPaymentStatus) => {
    const appt = await appointmentsStorage.getById(appointmentId);
    if (!appt) throw new Error('Appointment not found');

    if (appt.providerId !== providerId) {
        throw new Error('Unauthorized: only the service partner can update payment status');
    }

    const allowedPaymentStatuses = ['submitted', 'verified', 'rejected'];
    if (!allowedPaymentStatuses.includes(newPaymentStatus)) {
        throw new Error('Invalid payment status');
    }

    const updated = await appointmentsStorage.update(appointmentId, {
        paymentStatus: newPaymentStatus,
        paymentVerifiedAt: newPaymentStatus === 'verified' ? Date.now() : null
    });

    try {
        await createNotification(
            appt.customerId,
            `Your payment of ₹${appt.paymentAmount || 0} has been ${newPaymentStatus === 'verified' ? 'verified successfully' : 'flagged as ' + newPaymentStatus}.`,
            `/appointments/my-bookings/${appointmentId}`
        );
    } catch (e) {
        console.error('Error sending payment status notification:', e);
    }

    return updated;
};

exports.updateStatus = async (appointmentId, userId, role, newStatus) => {
    const appt = await appointmentsStorage.getById(appointmentId);
    if (!appt) throw new Error('Appointment not found');

    if (role === 'provider' && appt.providerId !== userId) throw new Error('Unauthorized');
    if (role === 'customer' && appt.customerId !== userId) throw new Error('Unauthorized');

    const validTransitions = {
        'provider': {
            'pending': ['accepted', 'rejected'],
            'accepted': ['completed', 'cancelled']
        },
        'customer': {
            'pending': ['cancelled'],
            'accepted': ['cancelled']
        }
    };

    const allowedStatuses = validTransitions[role][appt.status] || [];
    if (!allowedStatuses.includes(newStatus)) {
        throw new Error('Invalid status transition');
    }

    const updates = { status: newStatus };
    // If provider accepts and payment was submitted, automatically mark payment as verified if not already
    if (role === 'provider' && newStatus === 'accepted' && appt.paymentStatus === 'submitted') {
        updates.paymentStatus = 'verified';
        updates.paymentVerifiedAt = Date.now();
    }

    const updated = await appointmentsStorage.update(appointmentId, updates);
    
    // Notifications & Email
    const usersStorage = new JsonStorage('users');
    const otherUserId = role === 'provider' ? appt.customerId : appt.providerId;
    const otherUser = await usersStorage.getById(otherUserId);
    
    if (otherUser) {
        sendStatusEmail(otherUser.email, newStatus);
        createNotification(
            otherUserId, 
            `Appointment status updated to ${newStatus}`,
            role === 'provider' ? `/appointments/my-bookings/${appointmentId}` : `/appointments/provider/${appointmentId}`
        );
    }
    
    return updated;
};

exports.getAppointmentsByCustomer = async (customerId) => {
    const apps = await appointmentsStorage.getAll();
    return apps.filter(a => a.customerId === customerId);
};

exports.getAppointmentsByProvider = async (providerId) => {
    const apps = await appointmentsStorage.getAll();
    return apps.filter(a => a.providerId === providerId);
};

exports.getAppointmentById = async (id) => {
    return await appointmentsStorage.getById(id);
};
