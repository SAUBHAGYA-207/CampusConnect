require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getSupabaseClient, isSupabaseConfigured } = require('../src/config/supabase');
const JsonStorage = require('../src/storage/jsonStorage');

async function runCleanup() {
    console.log('--- STARTING FAST BATCH CLEANUP OF TEST SERVICES AND HISTORY ---');

    const servicesStorage = new JsonStorage('services');
    const appointmentsStorage = new JsonStorage('appointments');
    const usersStorage = new JsonStorage('users');
    const notificationsStorage = new JsonStorage('notifications');
    const walletStorage = new JsonStorage('wallet_transactions');

    const [allServices, allUsers, allAppointments, allNotifications, allWalletTxns] = await Promise.all([
        servicesStorage.getAll(),
        usersStorage.getAll(),
        appointmentsStorage.getAll(),
        notificationsStorage.getAll(),
        walletStorage.getAll()
    ]);

    const userMap = new Map(allUsers.map(u => [u.id, u]));

    // 1. Identify Test Services
    const testServices = allServices.filter(s => {
        if (!s.title || s.title.trim() === '') return true;
        if (s.providerId && s.providerId.startsWith('test_')) return true;
        if (s.title === 'Quick Help Session') return true;
        if (s.title === 'Guitar Lessons Pro') return true;
        const provider = userMap.get(s.providerId);
        if (!provider) return true;
        if (provider.email && (provider.email.startsWith('testpartner_') || provider.email.startsWith('test_'))) return true;
        return false;
    });

    console.log(`Found ${testServices.length} test service(s) to remove.`);
    const testServiceIds = new Set(testServices.map(s => s.id));

    // 2. Identify Test Appointments
    const testAppointments = allAppointments.filter(a => {
        if (a.customerId && a.customerId.startsWith('test_')) return true;
        if (a.providerId && a.providerId.startsWith('test_')) return true;
        if (testServiceIds.has(a.serviceId)) return true;
        return false;
    });

    console.log(`Found ${testAppointments.length} test appointment(s) to remove.`);
    const testApptIds = new Set(testAppointments.map(a => a.id));

    // 3. Identify Test Notifications
    const testNotifications = allNotifications.filter(n => {
        if (n.userId && n.userId.startsWith('test_')) return true;
        if (n.link) {
            for (const sId of testServiceIds) {
                if (n.link.includes(sId)) return true;
            }
            for (const aId of testApptIds) {
                if (n.link.includes(aId)) return true;
            }
        }
        return false;
    });
    console.log(`Found ${testNotifications.length} test notification(s) to remove.`);

    // 4. Test Wallet Transactions
    const testWalletTxns = allWalletTxns.filter(t => {
        if (t.userId && t.userId.startsWith('test_')) return true;
        if (t.referenceId && (testServiceIds.has(t.referenceId) || testApptIds.has(t.referenceId))) return true;
        return false;
    });
    console.log(`Found ${testWalletTxns.length} test wallet transaction(s) to remove.`);

    // 5. Test Users
    const testUsers = allUsers.filter(u => {
        if (!u.id) return false;
        if (u.id.startsWith('test_')) return true;
        if (u.email && (
            u.email.startsWith('testpartner_') || 
            u.email.startsWith('test_') || 
            u.email.startsWith('whitelisted_admin_') || 
            u.email.startsWith('second_admin_')
        )) return true;
        return false;
    });
    console.log(`Found ${testUsers.length} test user(s) to remove.`);

    // BATCH PURGE FROM SUPABASE
    if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        if (client) {
            // Delete test services
            if (testServiceIds.size > 0) {
                const { error } = await client.from('services').delete().in('id', Array.from(testServiceIds));
                if (error) console.error('Supabase services delete error:', error.message);
                else console.log(`✓ Deleted ${testServiceIds.size} services from Supabase`);
            }

            // Delete test appointments
            if (testApptIds.size > 0) {
                const { error } = await client.from('appointments').delete().in('id', Array.from(testApptIds));
                if (error) console.error('Supabase appointments delete error:', error.message);
                else console.log(`✓ Deleted ${testApptIds.size} appointments from Supabase`);
            }

            // Delete test notifications in chunks of 100
            const notifIds = testNotifications.map(n => n.id);
            if (notifIds.length > 0) {
                for (let i = 0; i < notifIds.length; i += 100) {
                    const chunk = notifIds.slice(i, i + 100);
                    const { error } = await client.from('notifications').delete().in('id', chunk);
                    if (error) console.error('Supabase notifications chunk delete error:', error.message);
                }
                console.log(`✓ Deleted ${notifIds.length} notifications from Supabase`);
            }

            // Delete test wallet txns
            const txnIds = testWalletTxns.map(t => t.id);
            if (txnIds.length > 0) {
                const { error } = await client.from('wallet_transactions').delete().in('id', txnIds);
                if (error) console.error('Supabase wallet_transactions delete error:', error.message);
                else console.log(`✓ Deleted ${txnIds.length} wallet transactions from Supabase`);
            }

            // Delete test users
            const userIds = testUsers.map(u => u.id);
            if (userIds.length > 0) {
                const { error } = await client.from('users').delete().in('id', userIds);
                if (error) console.error('Supabase users delete error:', error.message);
                else console.log(`✓ Deleted ${userIds.length} users from Supabase`);
            }
        }
    }

    // UPDATE LOCAL JSON FILES DIRECTLY
    const dataDir = path.join(__dirname, '../data');

    // 1. services.json
    const cleanServices = allServices.filter(s => !testServiceIds.has(s.id));
    fs.writeFileSync(path.join(dataDir, 'services.json'), JSON.stringify(cleanServices, null, 2), 'utf8');
    console.log(`✓ Saved ${cleanServices.length} clean services to data/services.json`);

    // 2. appointments.json
    const cleanAppts = allAppointments.filter(a => !testApptIds.has(a.id));
    fs.writeFileSync(path.join(dataDir, 'appointments.json'), JSON.stringify(cleanAppts, null, 2), 'utf8');
    console.log(`✓ Saved ${cleanAppts.length} clean appointments to data/appointments.json`);

    // 3. notifications.json
    const testNotifIdSet = new Set(testNotifications.map(n => n.id));
    const cleanNotifs = allNotifications.filter(n => !testNotifIdSet.has(n.id));
    fs.writeFileSync(path.join(dataDir, 'notifications.json'), JSON.stringify(cleanNotifs, null, 2), 'utf8');
    console.log(`✓ Saved ${cleanNotifs.length} clean notifications to data/notifications.json`);

    // 4. wallet_transactions.json
    const testTxnIdSet = new Set(testWalletTxns.map(t => t.id));
    const cleanTxns = allWalletTxns.filter(t => !testTxnIdSet.has(t.id));
    fs.writeFileSync(path.join(dataDir, 'wallet_transactions.json'), JSON.stringify(cleanTxns, null, 2), 'utf8');
    console.log(`✓ Saved ${cleanTxns.length} clean wallet transactions to data/wallet_transactions.json`);

    // 5. users.json
    const testUserIdSet = new Set(testUsers.map(u => u.id));
    const cleanUsers = allUsers.filter(u => !testUserIdSet.has(u.id));
    fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(cleanUsers, null, 2), 'utf8');
    console.log(`✓ Saved ${cleanUsers.length} clean users to data/users.json`);

    console.log('\n--- CLEANUP COMPLETE! ---');
    console.log(`Remaining services: ${cleanServices.length}`);
    cleanServices.forEach(s => console.log(`  - [${s.status || 'active'}] ${s.title} (₹${s.price})`));
}

runCleanup().catch(err => {
    console.error('Fast cleanup failed:', err);
    process.exit(1);
});
