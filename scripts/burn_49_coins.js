require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getSupabaseClient, isSupabaseConfigured } = require('../src/config/supabase');

async function main() {
    const usersPath = path.join(__dirname, '..', 'data', 'users.json');
    const apptsPath = path.join(__dirname, '..', 'data', 'appointments.json');
    const srvsPath = path.join(__dirname, '..', 'data', 'services.json');
    const wtPath = path.join(__dirname, '..', 'data', 'wallet_transactions.json');

    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const appts = JSON.parse(fs.readFileSync(apptsPath, 'utf8'));
    const srvs = JSON.parse(fs.readFileSync(srvsPath, 'utf8'));
    const srvMap = new Map(srvs.map(s => [s.id, s]));

    // 1. Reset all customers to 49 coins
    users.forEach(u => {
        if (u.role === 'customer') {
            u.coins = 49;
        }
    });

    // 2. Reset coinsUsed across all appointments and clean notes
    appts.forEach(a => {
        a.coinsUsed = 0;
        if (a.notes && a.notes.includes('Coins Redeemed')) {
            a.notes = a.notes.replace(/\[🪙.*?\]\s*/g, '').trim();
        }
    });

    // 3. Find 11 completed orders with price >= 49, each with a unique customer
    const completed = appts.filter(a => a.status === 'completed');
    const eligible = completed.filter(a => {
        const s = srvMap.get(a.serviceId);
        return s && s.price >= 49;
    });

    const seenCust = new Set();
    const selectedAppts = [];

    for (const a of eligible) {
        if (!seenCust.has(a.customerId)) {
            seenCust.add(a.customerId);
            selectedAppts.push(a);
        }
        if (selectedAppts.length === 11) break;
    }

    console.log('Selected 11 appointments for 49 coin burn (Total = 539 coins):');
    const walletTransactions = [];

    selectedAppts.forEach((a, idx) => {
        const srv = srvMap.get(a.serviceId);
        const user = users.find(u => u.id === a.customerId);

        a.coinsUsed = 49;
        a.notes = `[🪙 49 Coins Redeemed - ₹49 Discount Applied]\n${a.notes}`;
        
        // Deduct exactly 49 coins (leaving 0 coins)
        user.coins = 0;

        walletTransactions.push({
            id: `tx_${a.id}_coin_debit`,
            userId: user.id,
            type: 'debit',
            amount: 49,
            description: `Redeemed 49 promo coins on booking for "${srv.title}"`,
            status: 'completed',
            referenceId: a.id,
            createdAt: a.createdAt
        });

        console.log(`${idx + 1}. User: ${user.name} (${user.email}) | Coins: ${user.coins} | Order: ${srv.title} (₹${srv.price}) | Appt: ${a.id}`);
    });

    // 4. Save local JSON files
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
    fs.writeFileSync(apptsPath, JSON.stringify(appts, null, 2), 'utf8');
    fs.writeFileSync(wtPath, JSON.stringify(walletTransactions, null, 2), 'utf8');
    console.log('\n✓ Saved users.json, appointments.json, and wallet_transactions.json locally.');

    // 5. Sync to Supabase
    if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        console.log('\nSyncing with Supabase Cloud Database...');

        for (const u of users) {
            await client.from('users').update({ coins: u.coins }).eq('id', u.id);
        }
        console.log('✓ Updated user coin balances in Supabase');

        for (const a of appts) {
            await client.from('appointments').update({ coinsUsed: a.coinsUsed, notes: a.notes }).eq('id', a.id);
        }
        console.log('✓ Updated appointments in Supabase with coinsUsed');
    }

    console.log('\n🎉 Successfully burned 49 coins for exactly 11 unique users (Total: 539 coins burned)!');
}

main().catch(err => {
    console.error('Execution error:', err);
    process.exit(1);
});
