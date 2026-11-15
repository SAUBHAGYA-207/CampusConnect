const JsonStorage = require('../storage/jsonStorage');
const appointmentsStorage = new JsonStorage('appointments');
const servicesStorage = new JsonStorage('services');
const usersStorage = new JsonStorage('users');
const payoutsStorage = new JsonStorage('payouts');
const walletService = require('./walletService');
const { createNotification } = require('./notificationService');
const { sendStatusEmail, sendServiceCompletedFeedbackEmail } = require('./emailService');

function normalizeAppointment(appt) {
    if (!appt) return null;
    let referenceMedia = null;
    let referenceMediaType = null;
    let referenceMediaName = null;
    let cleanNotes = appt.notes || '';

    if (cleanNotes && cleanNotes.includes('<!--CC_REF_MEDIA:')) {
        try {
            const match = cleanNotes.match(/<!--CC_REF_MEDIA:([\s\S]*?)-->/);
            if (match && match[1]) {
                const parsed = JSON.parse(match[1]);
                referenceMedia = parsed.url;
                referenceMediaType = parsed.type;
                referenceMediaName = parsed.name;
                cleanNotes = cleanNotes.replace(/<!--CC_REF_MEDIA:[\s\S]*?-->/g, '').trim();
            }
        } catch (e) {}
    }

    let coinsUsed = (appt.coinsUsed !== undefined && appt.coinsUsed !== null && !isNaN(Number(appt.coinsUsed)) && Number(appt.coinsUsed) > 0)
        ? Number(appt.coinsUsed)
        : 0;

    if (!coinsUsed && appt.notes && typeof appt.notes === 'string') {
        const matchCoins = appt.notes.match(/🪙\s*(\d+)\s*Coins\s*Redeemed/i) || appt.notes.match(/(\d+)\s*Coins\s*Redeemed/i);
        if (matchCoins && matchCoins[1]) {
            coinsUsed = Number(matchCoins[1]);
        }
    }

    if (!coinsUsed && (appt.paymentScreenshot === 'Paid by Coins' || (appt.transactionId && String(appt.transactionId).startsWith('COINS_')))) {
        if (appt.platformFee && Number(appt.platformFee) > 0) {
            coinsUsed = Math.round(Number(appt.platformFee) / 0.10);
        } else if (appt.providerEarnings && Number(appt.providerEarnings) > 0) {
            coinsUsed = Math.round(Number(appt.providerEarnings) / 0.90);
        }
    }

    return {
        ...appt,
        coinsUsed,
        referenceMedia,
        referenceMediaType: referenceMediaType || 'image',
        referenceMediaName: referenceMediaName || 'Reference Media',
        notes: cleanNotes,
        rawNotes: appt.notes || ''
    };
}

exports.normalizeAppointment = normalizeAppointment;

exports.createAppointment = async (customerId, serviceId, date, time, notes, paymentData = {}, referenceData = {}) => {
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
    
    // E-Wallet coin redemption handling
    const walletService = require('./walletService');
    const requestedCoins = Math.max(0, parseInt(paymentData.coinsUsed, 10) || 0);
    let coinsToDeduct = 0;

    if (requestedCoins > 0) {
        const availableUserCoins = await walletService.getUserCoins(customerId);
        coinsToDeduct = Math.min(requestedCoins, availableUserCoins, price);
        if (coinsToDeduct > 0) {
            await walletService.deductCoins(
                customerId,
                coinsToDeduct,
                `Redeemed ${coinsToDeduct} coins on booking for "${service.title}"`
            );
        }
    }

    const finalPayablePrice = Math.max(0, price - coinsToDeduct);

    // 90% provider earnings, 10% platform commission calculated from service price
    const providerEarnings = parseFloat((price * 0.90).toFixed(2));
    const platformFee = parseFloat((price * 0.10).toFixed(2));

    let finalNotes = (notes || '').trim();
    if (coinsToDeduct > 0) {
        finalNotes = `[🪙 ${coinsToDeduct} Coins Redeemed - ₹${coinsToDeduct} Discount Applied]\n` + finalNotes;
    }
    if (referenceData && referenceData.referenceMediaUrl) {
        const refTag = `\n\n<!--CC_REF_MEDIA:${JSON.stringify({
            url: referenceData.referenceMediaUrl,
            type: referenceData.referenceMediaType || 'image',
            name: referenceData.referenceMediaName || 'Reference Media'
        })}-->`;
        finalNotes += refTag;
    }

    const customCreatedAt = (paymentData.createdAt && !isNaN(Number(paymentData.createdAt)))
        ? Number(paymentData.createdAt)
        : Date.now();

    const isPaidByCoins = (finalPayablePrice === 0 && coinsToDeduct > 0);
    const finalScreenshot = isPaidByCoins ? 'Paid by Coins' : (paymentData.paymentScreenshot || null);
    const finalTxnId = isPaidByCoins ? (paymentData.transactionId || ('COINS_' + Date.now())) : (paymentData.transactionId || null);
    const finalPaymentStatus = isPaidByCoins ? 'verified' : (paymentData.paymentStatus || (paymentData.paymentScreenshot ? 'submitted' : 'pending'));

    const newAppointment = await appointmentsStorage.add({
        customerId,
        providerId: service.providerId,
        serviceId,
        date,
        time,
        notes: finalNotes,
        status: paymentData.status || 'pending',
        paymentAmount: finalPayablePrice,
        coinsUsed: coinsToDeduct,
        providerEarnings: providerEarnings,
        platformFee: platformFee,
        paymentScreenshot: finalScreenshot,
        transactionId: finalTxnId,
        paymentStatus: finalPaymentStatus,
        createdAt: customCreatedAt,
        paymentVerifiedAt: (finalPaymentStatus === 'verified') ? customCreatedAt : null
    });

    // Award 10% of booking price in coins to both user (customer) and partner!
    try {
        const coinBonus = Math.max(1, Math.round(price * 0.10));
        // Credit 10% coins to customer
        await walletService.addCoins(
            customerId,
            coinBonus,
            `Earned 10% coin bonus for booking "${service.title}"`,
            newAppointment.id
        );
        // Credit 10% coins to partner
        await walletService.addCoins(
            service.providerId,
            coinBonus,
            `Earned 10% partner reward for booking on "${service.title}"`,
            newAppointment.id
        );
    } catch (e) {
        console.warn('Could not award 10% booking coins:', e.message);
    }

    // Notify provider about the new booking and payment proof
    try {
        const hasMedia = referenceData && referenceData.referenceMediaUrl;
        const mediaNote = hasMedia ? ' with reference deliverables attached' : '';
        await createNotification(
            service.providerId,
            `New booking request${mediaNote} for "${service.title}" (₹${price})`,
            `/appointments/provider/${newAppointment.id}`
        );
    } catch (e) {
        console.error('Error creating notification:', e);
    }

    return normalizeAppointment(newAppointment);
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

    // REFUND AUTOMATION: Triggered when a booking is cancelled or rejected
    const isCancellation = (newStatus === 'cancelled' || newStatus === 'rejected');
    if (isCancellation && !appt.refundProcessed) {
        updates.refundProcessed = true;
        const service = await servicesStorage.getById(appt.serviceId);
        const serviceTitle = service ? service.title : `Booking #${appt.id.substring(0, 8)}`;
        const customer = await usersStorage.getById(appt.customerId);

        const coinsUsed = Number(appt.coinsUsed) || 0;
        const paymentAmount = Number(appt.paymentAmount) || 0;

        // 1. If paid by coins: auto refund the coins back to customer's wallet
        if (coinsUsed > 0) {
            try {
                await walletService.addCoins(
                    appt.customerId,
                    coinsUsed,
                    `Refund for ${newStatus} booking: "${serviceTitle}"`,
                    appt.id
                );
                updates.coinsRefunded = true;
                updates.coinsRefundedAmount = coinsUsed;
            } catch (e) {
                console.error('Error auto-refunding coins to customer:', e);
            }
        }

        // 2. If paid by money: add payout / settlement refund request for Super Admin to clear
        if (paymentAmount > 0) {
            try {
                const customerUpi = (customer && (customer.partnerUpiId || customer.upiId)) ? (customer.partnerUpiId || customer.upiId) : null;
                const newRefundRequest = await payoutsStorage.add({
                    partnerId: appt.customerId,
                    partnerEmail: customer ? customer.email : 'Unknown Customer',
                    amount: paymentAmount,
                    status: 'pending',
                    type: 'refund',
                    partnerUpiId: customerUpi,
                    notes: `Refund for ${newStatus} booking #${appt.id.substring(0, 8)} (${serviceTitle})`,
                    appointmentId: appt.id,
                    adminPaymentProof: null,
                    adminTransactionId: null,
                    clearedAt: null,
                    createdAt: Date.now()
                });
                updates.moneyRefundRequested = true;
                updates.moneyRefundAmount = paymentAmount;
                updates.refundPayoutId = newRefundRequest.id;
                updates.refundStatus = 'pending_admin_money';
            } catch (e) {
                console.error('Error creating admin refund request:', e);
            }
        } else if (coinsUsed > 0) {
            updates.refundStatus = 'coins_refunded';
        }

        // 3. Deduct/revoke the 10% booking bonus that was awarded at booking time
        try {
            const servicePrice = Number(service ? service.price : (paymentAmount + coinsUsed)) || 0;
            const coinBonus = Math.max(1, Math.round(servicePrice * 0.10));
            // Revoke bonus from customer
            await walletService.deductCoins(
                appt.customerId,
                coinBonus,
                `Booking bonus reversed for ${newStatus} booking #${appt.id.substring(0, 8)}`,
                appt.id
            );
            // Revoke reward from partner
            await walletService.deductCoins(
                appt.providerId,
                coinBonus,
                `Partner reward reversed for ${newStatus} booking #${appt.id.substring(0, 8)}`,
                appt.id
            );
        } catch (e) {
            console.warn('Could not revoke booking bonus coins:', e.message);
        }

        // Custom notification to customer informing them of refund details
        let refundMsg = `Your booking for "${serviceTitle}" was ${newStatus}.`;
        if (coinsUsed > 0 && paymentAmount > 0) {
            refundMsg += ` ${coinsUsed} Coins have been auto-refunded to your wallet, and a money refund for ₹${paymentAmount} has been sent to Super Admin for UPI transfer.`;
        } else if (coinsUsed > 0) {
            refundMsg += ` ${coinsUsed} Coins have been automatically refunded to your wallet!`;
        } else if (paymentAmount > 0) {
            refundMsg += ` A refund request of ₹${paymentAmount} has been queued for Super Admin to process via UPI.`;
        }

        createNotification(
            appt.customerId,
            refundMsg,
            `/appointments/my-bookings/${appt.id}`
        );
    }

    const updated = await appointmentsStorage.update(appointmentId, updates);
    
    // Notifications & Email
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

    // SERVICE COMPLETED: Automatically send feedback email to customer
    if (newStatus === 'completed') {
        try {
            const customer = await usersStorage.getById(appt.customerId);
            const provider = await usersStorage.getById(appt.providerId);
            const service = await servicesStorage.getById(appt.serviceId);
            const serviceTitle = service ? service.title : 'Campus Service';
            const customerName = customer ? (customer.name || customer.email.split('@')[0]) : 'Student';
            const partnerName = provider ? (provider.name || provider.email.split('@')[0]) : 'Partner';

            if (customer && customer.email) {
                await sendServiceCompletedFeedbackEmail(
                    customer.email,
                    customerName,
                    serviceTitle,
                    partnerName,
                    appt.id
                );
            }

            createNotification(
                appt.customerId,
                `⭐ How was your service with ${partnerName}? Click to leave your review and feedback!`,
                `/appointments/my-bookings/${appt.id}#feedback-card`
            );
        } catch (fbErr) {
            console.error('Error sending service completed feedback email:', fbErr);
        }
    }
    
    return updated;
};

exports.getAppointmentsByCustomer = async (customerId) => {
    const apps = await appointmentsStorage.getAll();
    return apps.filter(a => a.customerId === customerId).map(normalizeAppointment);
};

exports.getAppointmentsByProvider = async (providerId) => {
    const apps = await appointmentsStorage.getAll();
    return apps.filter(a => a.providerId === providerId).map(normalizeAppointment);
};

exports.getAppointmentById = async (id) => {
    const appt = await appointmentsStorage.getById(id);
    return normalizeAppointment(appt);
};
