const JsonStorage = require('../storage/jsonStorage');
const { sendServiceRemovalEmail, sendPayoutClearedEmail, sendRefundClearedEmail } = require('./emailService');
const { createNotification } = require('./notificationService');

const usersStorage = new JsonStorage('users');
const servicesStorage = new JsonStorage('services');
const appointmentsStorage = new JsonStorage('appointments');
const payoutsStorage = new JsonStorage('payouts');

function getAppointmentCoinsUsed(app, service) {
    if (app.coinsUsed !== undefined && app.coinsUsed !== null && !isNaN(Number(app.coinsUsed)) && Number(app.coinsUsed) > 0) {
        return Number(app.coinsUsed);
    }
    if (app.notes && typeof app.notes === 'string') {
        const match = app.notes.match(/🪙\s*(\d+)\s*Coins\s*Redeemed/i) || app.notes.match(/(\d+)\s*Coins\s*Redeemed/i);
        if (match && match[1]) return Number(match[1]);
    }
    if (app.paymentScreenshot === 'Paid by Coins' || (app.transactionId && String(app.transactionId).startsWith('COINS_'))) {
        if (service && Number(service.price) > 0) return Number(service.price);
        if (app.platformFee && Number(app.platformFee) > 0) return Math.round(Number(app.platformFee) / 0.10);
        if (app.providerEarnings && Number(app.providerEarnings) > 0) return Math.round(Number(app.providerEarnings) / 0.90);
    }
    return 0;
}
exports.getAppointmentCoinsUsed = getAppointmentCoinsUsed;

exports.getPlatformStats = async () => {
    const allUsers = await usersStorage.getAll();
    const allServices = await servicesStorage.getAll();
    const allAppointments = await appointmentsStorage.getAll();
    const allPayouts = await payoutsStorage.getAll();

    const customers = allUsers.filter(u => u.role === 'customer');
    const partners = allUsers.filter(u => u.role === 'provider');
    const serviceMap = new Map(allServices.map(s => [s.id, s]));

    // Revenue calculations
    // Only completed bookings are considered realized revenue
    const completedApps = allAppointments.filter(a => a.status === 'completed');
    let totalGrossRevenue = 0;
    let totalPlatformCommission = 0; // 10% platform
    let totalPartnerShare = 0; // 90% partner
    let totalCoinsBurned = 0; // Coins redeemed on completed bookings (worth ₹1 each)

    completedApps.forEach(app => {
        const service = app.service || serviceMap.get(app.serviceId);
        const servicePrice = service ? Number(service.price) : 0;
        const coinsUsed = getAppointmentCoinsUsed(app, service);
        const cashAmount = (app.paymentAmount !== undefined && app.paymentAmount !== null && !isNaN(Number(app.paymentAmount)))
            ? Number(app.paymentAmount)
            : Math.max(0, servicePrice - coinsUsed);

        const totalOrderValue = (servicePrice > 0) ? servicePrice : (cashAmount + coinsUsed);
        const partnerEarnings = (app.providerEarnings !== undefined && app.providerEarnings !== null)
            ? Number(app.providerEarnings)
            : parseFloat((totalOrderValue * 0.90).toFixed(2));
        const platformFee = (app.platformFee !== undefined && app.platformFee !== null)
            ? Number(app.platformFee)
            : parseFloat((totalOrderValue * 0.10).toFixed(2));

        totalGrossRevenue += totalOrderValue;
        totalPlatformCommission += platformFee;
        totalPartnerShare += partnerEarnings;
        totalCoinsBurned += coinsUsed;
    });

    // All-time active & completed coin burn across the platform (excluding cancelled/rejected)
    const activeAndCompletedApps = allAppointments.filter(a => a.status !== 'cancelled' && a.status !== 'rejected');
    let totalAllTimeCoinsUsed = 0;
    activeAndCompletedApps.forEach(a => {
        const service = a.service || serviceMap.get(a.serviceId);
        totalAllTimeCoinsUsed += getAppointmentCoinsUsed(a, service);
    });

    // Payout stats
    const clearedPayouts = allPayouts.filter(p => p.status === 'cleared');
    const pendingPayouts = allPayouts.filter(p => p.status === 'pending');

    const totalClearedPayouts = clearedPayouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalPendingPayouts = pendingPayouts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // Current unsettled partner liability = realized partner share - cleared payouts
    const unsettledPartnerLiability = Math.max(0, totalPartnerShare - totalClearedPayouts);

    // Actual Net Profit = Platform Commission minus Coins Burned (Discounts Subsidized)
    const actualNetProfit = totalPlatformCommission - totalCoinsBurned;

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
        totalCoinsBurned: totalCoinsBurned, // Coins redeemed on completed bookings
        totalCoinsBurnedValue: totalCoinsBurned.toFixed(2), // 1 coin = ₹1
        totalAllTimeCoinsUsed: totalAllTimeCoinsUsed,
        totalAllTimeCoinsBurnValue: totalAllTimeCoinsUsed.toFixed(2),
        inFlightCoinsBurned: Math.max(0, totalAllTimeCoinsUsed - totalCoinsBurned),
        actualNetProfit: actualNetProfit.toFixed(2),
        isProfitable: actualNetProfit >= 0,
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

exports.verifyServiceByAdmin = async (serviceId) => {
    const service = await servicesStorage.getById(serviceId);
    if (!service) throw new Error('Service not found');

    const updated = await servicesStorage.update(serviceId, {
        status: 'published'
    });

    // Release the 10 coins reward to the partner
    const walletService = require('./walletService');
    await walletService.approveUnderProcessingCoins(serviceId, `10 Coins for verified service listing: "${service.title}" (Verified ✓)`);

    const partner = await usersStorage.getById(service.providerId);
    if (partner) {
        await createNotification(
            partner.id,
            `🎉 Your service "${service.title}" has been verified by Super Admin! 10 coins added to your wallet.`,
            '/dashboard'
        );
    }

    return updated;
};

exports.removeServiceByAdmin = async (serviceId, feedbackReason, adminEmail) => {
    const service = await servicesStorage.getById(serviceId);
    if (!service) throw new Error('Service not found');

    const partner = await usersStorage.getById(service.providerId);
    const partnerEmail = partner ? partner.email : null;

    // Delete the service from storage
    await servicesStorage.delete(serviceId);

    // Cancel any pending under-processing coins reward
    try {
        const walletService = require('./walletService');
        await walletService.rejectUnderProcessingCoins(serviceId, feedbackReason);
    } catch (e) {}

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

    return appointments.map(app => {
        const service = app.service || serviceMap.get(app.serviceId) || { title: 'Unknown Service', price: 0 };
        const coinsUsed = getAppointmentCoinsUsed(app, service);
        return {
            ...app,
            coinsUsed,
            customer: userMap.get(app.customerId) || { email: 'Unknown Customer' },
            partner: userMap.get(app.providerId) || { email: 'Unknown Partner' },
            service
        };
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
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
    const partnerPayouts = payouts.filter(p => p.partnerId === partnerId && p.type !== 'refund');
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

    if (requestedAmount < 200) {
        throw new Error('Minimum withdrawal amount is ₹200. You cannot withdraw less than ₹200.');
    }

    if (parseFloat(summary.availablePayableBalance) < 200) {
        throw new Error('Your available balance is below the minimum withdrawal threshold of ₹200.');
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

    // If linked to an appointment refund, update appointment refund status
    if (payout.appointmentId) {
        try {
            await appointmentsStorage.update(payout.appointmentId, {
                refundStatus: 'settled',
                refundClearedAt: Date.now(),
                refundAdminTxnId: adminTransactionId || 'UPI-' + Date.now(),
                refundAdminProof: adminPaymentProof || null
            });
        } catch (e) {
            console.error('Error updating appointment refund status:', e);
        }
    }

    const recipient = await usersStorage.getById(payout.partnerId);
    if (recipient) {
        const isRefund = payout.type === 'refund';
        if (isRefund) {
            try {
                await sendRefundClearedEmail(recipient.email, payout.amount, adminTransactionId, adminPaymentProof);
            } catch (e) {
                console.error('Error sending refund cleared email:', e);
            }
            await createNotification(
                recipient.id,
                `✓ Your refund of ₹${payout.amount} has been cleared and transferred to your UPI!`,
                payout.appointmentId ? `/appointments/my-bookings/${payout.appointmentId}` : '/profile'
            );
        } else {
            await sendPayoutClearedEmail(recipient.email, payout.amount, adminTransactionId, adminPaymentProof);
            await createNotification(
                recipient.id,
                `✓ Your payout of ₹${payout.amount} has been cleared and transferred to your UPI!`,
                '/dashboard'
            );
        }
    }

    return updated;
};
