const JsonStorage = require('../storage/jsonStorage');
const { sendServiceRemovalEmail, sendPayoutClearedEmail } = require('./emailService');
const { createNotification } = require('./notificationService');

const usersStorage = new JsonStorage('users');
const servicesStorage = new JsonStorage('services');
const appointmentsStorage = new JsonStorage('appointments');
const payoutsStorage = new JsonStorage('payouts');

exports.getPlatformStats = async () => {
    const allUsers = await usersStorage.getAll();
    const allServices = await servicesStorage.getAll();
    const allAppointments = await appointmentsStorage.getAll();
    const allPayouts = await payoutsStorage.getAll();

    const customers = allUsers.filter(u => u.role === 'customer');
    const partners = allUsers.filter(u => u.role === 'provider');

    // Revenue calculations
    // Only completed bookings are considered realized revenue
    const completedApps = allAppointments.filter(a => a.status === 'completed');
    let totalGrossRevenue = 0;
    let totalPlatformCommission = 0; // 10% platform
    let totalPartnerShare = 0; // 90% partner

    completedApps.forEach(app => {
        const amount = Number(app.paymentAmount || (app.service ? app.service.price : 0)) || 0;
        const partnerEarnings = app.providerEarnings !== undefined && app.providerEarnings !== null
            ? Number(app.providerEarnings)
            : parseFloat((amount * 0.90).toFixed(2));
        const platformFee = app.platformFee !== undefined && app.platformFee !== null
            ? Number(app.platformFee)
            : parseFloat((amount * 0.10).toFixed(2));

        totalGrossRevenue += amount;
        totalPlatformCommission += platformFee;
        totalPartnerShare += partnerEarnings;
    });

    // Payout stats
    const clearedPayouts = allPayouts.filter(p => p.status === 'cleared');
    const pendingPayouts = allPayouts.filter(p => p.status === 'pending');

    const totalClearedPayouts = clearedPayouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalPendingPayouts = pendingPayouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // Current unsettled partner liability = realized partner share - cleared payouts
    const unsettledPartnerLiability = Math.max(0, totalPartnerShare - totalClearedPayouts);

    return {
        totalUsers: customers.length,
        totalPartners: partners.length,
        totalServices: allServices.length,
        activeServices: allServices.filter(s => s.status === 'published').length,
        totalAppointments: allAppointments.length,
        completedAppointments: completedApps.length,
        pendingAppointments: allAppointments.filter(a => a.status === 'pending').length,
        totalGrossRevenue: totalGrossRevenue.toFixed(2),
        totalPlatformCommission: totalPlatformCommission.toFixed(2),
        totalPartnerShare: totalPartnerShare.toFixed(2),
        totalClearedPayouts: totalClearedPayouts.toFixed(2),
        totalPendingPayouts: totalPendingPayouts.toFixed(2),
        unsettledPartnerLiability: unsettledPartnerLiability.toFixed(2)
    };
};

exports.getAllServices = async () => {
    const services = await servicesStorage.getAll();
    const users = await usersStorage.getAll();
    const userMap = new Map(users.map(u => [u.id, u]));

    return services.map(s => ({
        ...s,
        provider: userMap.get(s.providerId) || { email: 'Unknown Partner' }
    })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

exports.removeServiceByAdmin = async (serviceId, feedbackReason, adminEmail) => {
    const service = await servicesStorage.getById(serviceId);
    if (!service) throw new Error('Service not found');

    const partner = await usersStorage.getById(service.providerId);
    const partnerEmail = partner ? partner.email : null;

    // Delete the service from storage
    await servicesStorage.delete(serviceId);

    // Send email with custom feedback to the partner
    if (partnerEmail) {
        await sendServiceRemovalEmail(partnerEmail, service.title, feedbackReason);
        await createNotification(
            service.providerId,
            `Admin Notice: Your service "${service.title}" was removed. Reason: ${feedbackReason}`,
            '/dashboard'
        );
    }

    return service;
};

exports.getAllAppointments = async () => {
    const appointments = await appointmentsStorage.getAll();
    const users = await usersStorage.getAll();
    const services = await servicesStorage.getAll();

    const userMap = new Map(users.map(u => [u.id, u]));
    const serviceMap = new Map(services.map(s => [s.id, s]));

    return appointments.map(app => ({
        ...app,
        customer: userMap.get(app.customerId) || { email: 'Unknown Customer' },
        partner: userMap.get(app.providerId) || { email: 'Unknown Partner' },
        service: app.service || serviceMap.get(app.serviceId) || { title: 'Unknown Service', price: 0 }
    })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

exports.getAllUsers = async () => {
    const users = await usersStorage.getAll();
    const appointments = await appointmentsStorage.getAll();
    const services = await servicesStorage.getAll();
    const payouts = await payoutsStorage.getAll();

    return users.map(u => {
        const isPartner = u.role === 'provider';
        if (isPartner) {
            const partnerServices = services.filter(s => s.providerId === u.id);
            const partnerOrders = appointments.filter(a => a.providerId === u.id);
            const completed = partnerOrders.filter(a => a.status === 'completed');
            
            let totalEarned = 0;
            completed.forEach(c => {
                const amt = Number(c.paymentAmount || (c.service ? c.service.price : 0)) || 0;
                const share = c.providerEarnings !== undefined && c.providerEarnings !== null
                    ? Number(c.providerEarnings)
                    : amt * 0.90;
                totalEarned += share;
            });

            const partnerPayouts = payouts.filter(p => p.partnerId === u.id && p.status === 'cleared');
            const totalWithdrawn = partnerPayouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
            const payableBalance = Math.max(0, totalEarned - totalWithdrawn);

            return {
                ...u,
                servicesCount: partnerServices.length,
                ordersCount: partnerOrders.length,
                completedOrdersCount: completed.length,
                totalEarned: totalEarned.toFixed(2),
                totalWithdrawn: totalWithdrawn.toFixed(2),
                payableBalance: payableBalance.toFixed(2)
            };
        } else {
            const userBookings = appointments.filter(a => a.customerId === u.id);
            return {
                ...u,
                bookingsCount: userBookings.length
            };
        }
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

// Payouts Logic
exports.getAllPayouts = async () => {
    const payouts = await payoutsStorage.getAll();
    const users = await usersStorage.getAll();
    const userMap = new Map(users.map(u => [u.id, u]));

    return payouts.map(p => {
        const partner = userMap.get(p.partnerId) || {};
        return {
            ...p,
            partnerEmail: partner.email || p.partnerEmail || 'Unknown Partner',
            partnerUpiId: p.partnerUpiId || partner.partnerUpiId || 'Not provided',
            partnerQrImage: p.partnerQrImage || partner.partnerQrImage || null
        };
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

exports.getPayoutsByPartner = async (partnerId) => {
    const all = await payoutsStorage.getAll();
    return all.filter(p => p.partnerId === partnerId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

exports.getPartnerFinancialSummary = async (partnerId) => {
    const appointments = await appointmentsStorage.getAll();
    const partnerOrders = appointments.filter(a => a.providerId === partnerId);
    const completed = partnerOrders.filter(a => a.status === 'completed');

    let totalEarned = 0;
    completed.forEach(c => {
        const amt = Number(c.paymentAmount || (c.service ? c.service.price : 0)) || 0;
        const share = c.providerEarnings !== undefined && c.providerEarnings !== null
            ? Number(c.providerEarnings)
            : amt * 0.90;
        totalEarned += share;
    });

    const payouts = await payoutsStorage.getAll();
    const partnerPayouts = payouts.filter(p => p.partnerId === partnerId);
    const cleared = partnerPayouts.filter(p => p.status === 'cleared');
    const pending = partnerPayouts.filter(p => p.status === 'pending');

    const totalCleared = cleared.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalPending = pending.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const availablePayableBalance = Math.max(0, totalEarned - totalCleared - totalPending);

    const user = await usersStorage.getById(partnerId);

    return {
        totalEarned: totalEarned.toFixed(2),
        totalCleared: totalCleared.toFixed(2),
        totalPending: totalPending.toFixed(2),
        availablePayableBalance: availablePayableBalance.toFixed(2),
        partnerUpiId: user ? user.partnerUpiId : null,
        partnerQrImage: user ? user.partnerQrImage : null
    };
};

exports.updatePartnerPayoutDetails = async (partnerId, { partnerUpiId, partnerQrImage }) => {
    const updateData = {};
    if (partnerUpiId) updateData.partnerUpiId = partnerUpiId;
    if (partnerQrImage) updateData.partnerQrImage = partnerQrImage;
    return await usersStorage.update(partnerId, updateData);
};

exports.createPayoutRequest = async (partnerId, amount, notes) => {
    const summary = await exports.getPartnerFinancialSummary(partnerId);
    const requestedAmount = parseFloat(amount);

    if (isNaN(requestedAmount) || requestedAmount <= 0) {
        throw new Error('Please enter a valid payout amount');
    }

    if (requestedAmount > parseFloat(summary.availablePayableBalance)) {
        throw new Error(`Requested amount ₹${requestedAmount} exceeds available balance of ₹${summary.availablePayableBalance}`);
    }

    if (!summary.partnerUpiId) {
        throw new Error('Please enter your UPI ID before requesting a payout');
    }

    const partner = await usersStorage.getById(partnerId);

    const newPayout = await payoutsStorage.add({
        partnerId,
        partnerEmail: partner ? partner.email : 'Unknown',
        amount: requestedAmount,
        status: 'pending',
        partnerUpiId: summary.partnerUpiId,
        partnerQrImage: summary.partnerQrImage,
        notes: notes || '',
        adminPaymentProof: null,
        adminTransactionId: null,
        clearedAt: null,
        createdAt: Date.now()
    });

    return newPayout;
};

exports.clearPayoutByAdmin = async (payoutId, adminTransactionId, adminPaymentProof) => {
    const payout = await payoutsStorage.getById(payoutId);
    if (!payout) throw new Error('Payout request not found');

    const updated = await payoutsStorage.update(payoutId, {
        status: 'cleared',
        adminTransactionId: adminTransactionId || 'UPI-' + Date.now(),
        adminPaymentProof: adminPaymentProof || null,
        clearedAt: Date.now()
    });

    const partner = await usersStorage.getById(payout.partnerId);
    if (partner) {
        await sendPayoutClearedEmail(partner.email, payout.amount, adminTransactionId, adminPaymentProof);
        await createNotification(
            partner.id,
            `✓ Your payout of ₹${payout.amount} has been cleared and transferred to your UPI!`,
            '/dashboard'
        );
    }

    return updated;
};
