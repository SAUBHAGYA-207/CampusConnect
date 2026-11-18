require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { getSupabaseClient, isSupabaseConfigured } = require('../src/config/supabase');

async function main() {
    console.log('============================================================');
    console.log('🔄 UPDATING DATABASE TO 23 ORDERS & 5 COINS = ₹1 RATE');
    console.log('============================================================\n');

    const apptsPath = path.join(__dirname, '..', 'data', 'appointments.json');
    const usersPath = path.join(__dirname, '..', 'data', 'users.json');
    const wtPath = path.join(__dirname, '..', 'data', 'wallet_transactions.json');
    const srvsPath = path.join(__dirname, '..', 'data', 'services.json');
    const payoutsPath = path.join(__dirname, '..', 'data', 'payouts.json');

    const allAppts = JSON.parse(fs.readFileSync(apptsPath, 'utf8'));
    const allUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const allSrvs = JSON.parse(fs.readFileSync(srvsPath, 'utf8'));
    const srvMap = new Map(allSrvs.map(s => [s.id, s]));
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    // 1. Keep exactly the first 23 appointments
    const keptAppts = allAppts.slice(0, 23);
    const removedApptIds = new Set(allAppts.slice(23).map(a => a.id));

    console.log(`Original orders: ${allAppts.length}`);
    console.log(`Pruning to: ${keptAppts.length} orders`);
    console.log(`Removed: ${removedApptIds.size} orders\n`);

    // 2. Adjust coinsUsed on orders that had promotional coin redemption (50 coins = ₹10 discount)
    const coinRedeemingCustIds = new Set();
    const walletTransactions = [];

    keptAppts.forEach((appt, idx) => {
        const srv = srvMap.get(appt.serviceId);
        const srvTitle = srv ? srv.title : 'Campus Service';
        const srvPrice = srv ? Number(srv.price) : Number(appt.paymentAmount);

        // If this order used promo coins
        if (appt.coinsUsed > 0) {
            appt.coinsUsed = 50; // 50 coins = ₹10 discount at 5 coins = ₹1
            const cleanNotes = (appt.notes || '').replace(/\[🪙.*?\]\s*/g, '').trim();
            appt.notes = `[🪙 50 Coins Redeemed - ₹10 Discount Applied]\n${cleanNotes}`;
            appt.paymentAmount = Math.max(0, srvPrice - 10);
            coinRedeemingCustIds.add(appt.customerId);

            walletTransactions.push({
                id: `tx_${appt.id}_coin_debit`,
                userId: appt.customerId,
                type: 'debit',
                amount: 50,
                description: `Redeemed 50 coins (₹10 discount) on booking for "${srvTitle}"`,
                status: 'completed',
                referenceId: appt.id,
                createdAt: appt.createdAt
            });
        }
    });

    // 3. Milestone reward for services:
    // Check order counts per service in the 23 orders
    const serviceOrderCounts = {};
    keptAppts.forEach(a => {
        serviceOrderCounts[a.serviceId] = (serviceOrderCounts[a.serviceId] || 0) + 1;
    });

    console.log('Order counts per service in 23 orders:');
    console.log(serviceOrderCounts);

    // srv_quick_consult has 6 orders (>= 5 orders milestone!)
    // Partner is partner_kartikm94
    const quickConsultSrv = srvMap.get('srv_quick_consult');
    if (quickConsultSrv && serviceOrderCounts['srv_quick_consult'] >= 5) {
        walletTransactions.push({
            id: `tx_milestone_5_srv_quick_consult`,
            userId: quickConsultSrv.providerId,
            type: 'credit',
            amount: 50,
            description: `🎉 Milestone Reward: 5 orders reached on "${quickConsultSrv.title}"! (+50 Coins)`,
            status: 'completed',
            referenceId: `milestone_5_srv_quick_consult`,
            createdAt: keptAppts[21].createdAt + 1000 // around order #6
        });
        console.log(`\n✓ Awarded 50 coins milestone reward to partner ${quickConsultSrv.providerId} for 5 orders on srv_quick_consult`);
    }

    // 4. Update user coin balances
    allUsers.forEach(u => {
        if (u.role === 'customer') {
            if (coinRedeemingCustIds.has(u.id)) {
                u.coins = 49; // 99 welcome coins - 50 redeemed = 49 coins remaining
            } else {
                u.coins = 99; // Standard welcome coins
            }
        } else if (u.role === 'provider') {
            if (u.id === 'partner_kartikm94') {
                u.coins = 149; // 99 base + 50 milestone reward
            } else {
                u.coins = 99;
            }
        } else {
            u.coins = 99;
        }
    });

    // 5. Adjust payouts so all pending requests are covered by partner earnings
    const payouts = JSON.parse(fs.readFileSync(payoutsPath, 'utf8'));
    payouts.forEach(p => {
        if (p.partnerId === 'partner_kartikm94') {
            p.amount = 400; // Kartik earned ₹479.70
        } else if (p.partnerId === 'partner_yashvardhan26') {
            p.amount = 50;  // Yash earned ₹63.00
        }
    });

    // 6. Save local JSON files
    fs.writeFileSync(apptsPath, JSON.stringify(keptAppts, null, 2), 'utf8');
    fs.writeFileSync(usersPath, JSON.stringify(allUsers, null, 2), 'utf8');
    fs.writeFileSync(wtPath, JSON.stringify(walletTransactions, null, 2), 'utf8');
    fs.writeFileSync(payoutsPath, JSON.stringify(payouts, null, 2), 'utf8');
    console.log('\n✓ Saved all local JSON database files.');

    // 7. Sync with Supabase Cloud
    if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        console.log('\nSyncing with Supabase Cloud Database...');

        // Delete removed appointments from Supabase
        if (removedApptIds.size > 0) {
            const idsToDelete = Array.from(removedApptIds);
            const { error: delErr } = await client.from('appointments').delete().in('id', idsToDelete);
            if (delErr) {
                console.error('Error deleting extra appointments from Supabase:', delErr.message);
            } else {
                console.log(`✓ Deleted ${idsToDelete.length} removed appointments from Supabase.`);
            }
        }

        // Upsert / update the 23 kept appointments
        for (const a of keptAppts) {
            await client.from('appointments').upsert(a, { onConflict: 'id' });
        }
        console.log(`✓ Synchronized 23 appointments with Supabase.`);

        // Update user coin balances in Supabase
        for (const u of allUsers) {
            await client.from('users').update({ coins: u.coins }).eq('id', u.id);
        }
        console.log(`✓ Synchronized user coin balances with Supabase.`);
    }

    console.log('\n🎉 Successfully updated database to 23 orders with 5 coins = ₹1 rate!');
}

main().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
});
