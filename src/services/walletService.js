const JsonStorage = require('../storage/jsonStorage');
const usersStorage = new JsonStorage('users');
const walletTransactionsStorage = new JsonStorage('wallet_transactions');
const { createNotification } = require('./notificationService');

/**
 * Get user coin balance (ensures minimum 99 coins for new users if not set)
 */
async function getUserCoins(userId) {
    const user = await usersStorage.getById(userId);
    if (!user) return 0;

    // Check if user has already received welcome bonus
    const allTx = await walletTransactionsStorage.getAll();
    const hasWelcomeBonus = allTx.some(t => t.userId === userId && t.referenceId === 'welcome_bonus');

    if (user.coins === undefined || user.coins === null) {
        // Automatically initialize with 99 welcome coins
        await usersStorage.update(userId, { coins: 99 });
        if (!hasWelcomeBonus) {
            await walletTransactionsStorage.add({
                userId,
                type: 'credit',
                amount: 99,
                description: '🎉 Welcome Bonus: 99 Coins credited to your E-Wallet!',
                status: 'completed',
                referenceId: 'welcome_bonus',
                createdAt: Date.now()
            });
        }
        return 99;
    }
    return Number(user.coins) || 0;
}

/**
 * Add completed coins to user's wallet
 */
async function addCoins(userId, amount, description, referenceId = null) {
    const parsedAmount = Math.max(0, Math.round(Number(amount) || 0));
    if (parsedAmount === 0) return 0;

    const user = await usersStorage.getById(userId);
    if (!user) return 0;

    const currentCoins = (user.coins !== undefined && user.coins !== null) ? Number(user.coins) : 99;
    const newCoins = currentCoins + parsedAmount;

    await usersStorage.update(userId, { coins: newCoins });

    const tx = await walletTransactionsStorage.add({
        userId,
        type: 'credit',
        amount: parsedAmount,
        description,
        status: 'completed',
        referenceId: referenceId ? String(referenceId) : null,
        createdAt: Date.now()
    });

    try {
        await createNotification(
            userId,
            `🪙 +${parsedAmount} Coins added to your wallet! ${description}`,
            '/profile'
        );
    } catch (e) {
        console.warn('Could not send wallet notification:', e.message);
    }

    return newCoins;
}

/**
 * Deduct coins from user's wallet (e.g. order checkout discount)
 */
async function deductCoins(userId, amount, description, referenceId = null) {
    const parsedAmount = Math.max(0, Math.round(Number(amount) || 0));
    if (parsedAmount === 0) return 0;

    const user = await usersStorage.getById(userId);
    if (!user) throw new Error('User not found');

    const currentCoins = (user.coins !== undefined && user.coins !== null) ? Number(user.coins) : 99;
    if (currentCoins < parsedAmount) {
        throw new Error(`Insufficient coins. You have ${currentCoins} coins, but tried to use ${parsedAmount}.`);
    }

    const newCoins = currentCoins - parsedAmount;
    await usersStorage.update(userId, { coins: newCoins });

    await walletTransactionsStorage.add({
        userId,
        type: 'debit',
        amount: parsedAmount,
        description,
        status: 'completed',
        referenceId: referenceId ? String(referenceId) : null,
        createdAt: Date.now()
    });

    try {
        await createNotification(
            userId,
            `🪙 -${parsedAmount} Coins redeemed. ${description}`,
            '/profile'
        );
    } catch (e) {
        console.warn('Could not send wallet notification:', e.message);
    }

    return newCoins;
}

/**
 * Record an under-processing coin reward (e.g. +10 coins for a new service listing pending admin verification)
 */
async function addUnderProcessingCoins(userId, amount, description, referenceId) {
    const parsedAmount = Math.max(0, Math.round(Number(amount) || 0));
    const tx = await walletTransactionsStorage.add({
        userId,
        type: 'credit',
        amount: parsedAmount,
        description,
        status: 'under_processing',
        referenceId: referenceId ? String(referenceId) : null,
        createdAt: Date.now()
    });
    return tx;
}

/**
 * Admin approves under-processing reward (e.g. service listing verified)
 */
async function approveUnderProcessingCoins(referenceId, customDescription = null) {
    const all = await walletTransactionsStorage.getAll();
    const pendingTx = all.find(t => String(t.referenceId) === String(referenceId) && t.status === 'under_processing');
    
    if (!pendingTx) {
        return null;
    }

    const user = await usersStorage.getById(pendingTx.userId);
    if (!user) return null;

    const currentCoins = (user.coins !== undefined && user.coins !== null) ? Number(user.coins) : 99;
    const newCoins = currentCoins + Number(pendingTx.amount);

    await usersStorage.update(pendingTx.userId, { coins: newCoins });

    const updatedTx = await walletTransactionsStorage.update(pendingTx.id, {
        status: 'completed',
        description: customDescription || pendingTx.description.replace('(Under Processing)', '(Verified ✓)'),
        approvedAt: Date.now()
    });

    try {
        await createNotification(
            pendingTx.userId,
            `🎉 Service Verified! +${pendingTx.amount} coins have been unlocked and credited to your wallet!`,
            '/profile'
        );
    } catch (e) {
        console.warn('Could not send wallet notification:', e.message);
    }

    return updatedTx;
}

/**
 * Reject or cancel an under-processing reward
 */
async function rejectUnderProcessingCoins(referenceId, reason = null) {
    const all = await walletTransactionsStorage.getAll();
    const pendingTx = all.find(t => String(t.referenceId) === String(referenceId) && t.status === 'under_processing');
    if (!pendingTx) return null;

    return await walletTransactionsStorage.update(pendingTx.id, {
        status: 'rejected',
        rejectedReason: reason,
        rejectedAt: Date.now()
    });
}

/**
 * Get completed coin transactions history for user
 */
async function getTransactionHistory(userId) {
    const all = await walletTransactionsStorage.getAll();
    const userCompleted = all
        .filter(t => t.userId === userId && t.status === 'completed')
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Safety deduplication: ensure at most one welcome bonus is returned in the list
    let seenWelcome = false;
    return userCompleted.filter(t => {
        if (t.referenceId === 'welcome_bonus') {
            if (seenWelcome) return false;
            seenWelcome = true;
        }
        return true;
    });
}

/**
 * Get under-processing transactions / rewards for user
 */
async function getUnderProcessingHistory(userId) {
    const all = await walletTransactionsStorage.getAll();
    return all
        .filter(t => t.userId === userId && t.status === 'under_processing')
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Check and award milestones for a listed service:
 * - 5 orders: 50 coins
 * - 10 orders: 100 coins
 * - After 15 orders: 5 coins per order
 */
async function checkAndAwardServiceMilestones(serviceId) {
    if (!serviceId) return;
    try {
        const servicesStorage = new JsonStorage('services');
        const appointmentsStorage = new JsonStorage('appointments');
        const service = await servicesStorage.getById(serviceId);
        if (!service || !service.providerId) return;

        const allAppointments = await appointmentsStorage.getAll();
        const validAppointments = allAppointments.filter(
            a => a.serviceId === serviceId && a.status !== 'cancelled' && a.status !== 'rejected'
        );
        const orderCount = validAppointments.length;
        const allTx = await walletTransactionsStorage.getAll();

        // 1. Milestone: 5 orders -> 50 coins
        if (orderCount >= 5) {
            const refId5 = `milestone_5_${serviceId}`;
            const alreadyAwarded5 = allTx.some(t => t.referenceId === refId5);
            if (!alreadyAwarded5) {
                await addCoins(
                    service.providerId,
                    50,
                    `🎉 Milestone Reward: 5 orders reached on "${service.title}"! (+50 Coins)`,
                    refId5
                );
            }
        }

        // 2. Milestone: 10 orders -> 100 coins
        if (orderCount >= 10) {
            const refId10 = `milestone_10_${serviceId}`;
            const alreadyAwarded10 = allTx.some(t => t.referenceId === refId10);
            if (!alreadyAwarded10) {
                await addCoins(
                    service.providerId,
                    100,
                    `🎉 Milestone Reward: 10 orders reached on "${service.title}"! (+100 Coins)`,
                    refId10
                );
            }
        }

        // 3. Milestone: after 15 orders -> 5 coins per order
        if (orderCount > 15) {
            const sorted = [...validAppointments].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
            for (let i = 15; i < sorted.length; i++) {
                const appt = sorted[i];
                const refIdOrder = `order_reward_after15_${appt.id}`;
                const alreadyAwarded = allTx.some(t => t.referenceId === refIdOrder);
                if (!alreadyAwarded) {
                    await addCoins(
                        service.providerId,
                        5,
                        `🪙 Order Reward: Order #${i + 1} reached on "${service.title}"! (+5 Coins)`,
                        refIdOrder
                    );
                }
            }
        }
    } catch (err) {
        console.warn('Could not process service milestone rewards:', err.message);
    }
}

module.exports = {
    getUserCoins,
    addCoins,
    deductCoins,
    addUnderProcessingCoins,
    approveUnderProcessingCoins,
    rejectUnderProcessingCoins,
    getTransactionHistory,
    getUnderProcessingHistory,
    checkAndAwardServiceMilestones
};
