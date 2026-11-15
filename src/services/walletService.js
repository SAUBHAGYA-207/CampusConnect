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

module.exports = {
    getUserCoins,
    addCoins,
    deductCoins,
    addUnderProcessingCoins,
    approveUnderProcessingCoins,
    rejectUnderProcessingCoins,
    getTransactionHistory,
    getUnderProcessingHistory
};
