require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { getSupabaseClient, isSupabaseConfigured } = require('../src/config/supabase');

async function main() {
    console.log('============================================================');
    console.log('🧹 REMOVING EXTRA DUMMY USERS -> EXACTLY 57 CUSTOMER LOGINS');
    console.log('============================================================\n');

    const usersPath = path.join(__dirname, '..', 'data', 'users.json');
    const allUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    const admins = allUsers.filter(u => u.role === 'admin');
    const providers = allUsers.filter(u => u.role === 'provider');
    const customers = allUsers.filter(u => u.role === 'customer');

    console.log(`Current Total Users: ${allUsers.length}`);
    console.log(`- Admins: ${admins.length}`);
    console.log(`- Providers / Partners: ${providers.length}`);
    console.log(`- Customers: ${customers.length}`);

    // Keep the first 57 legitimate customer accounts
    const targetCustomerCount = 57;
    const keptCustomers = customers.slice(0, targetCustomerCount);
    const removedDummyCustomers = customers.slice(targetCustomerCount);

    console.log(`\nTarget Customer Logins: ${keptCustomers.length}`);
    console.log(`Extra Dummy Users to Remove: ${removedDummyCustomers.length}`);

    const removedIds = removedDummyCustomers.map(u => u.id);
    console.log('\nSample removed dummy accounts:');
    removedDummyCustomers.slice(0, 5).forEach((u, i) => console.log(`  ${i + 1}. ${u.id} | ${u.name} | ${u.email}`));
    console.log(`  ... and ${removedDummyCustomers.length - 5} more.`);

    // Reconstruct cleaned users array
    const cleanedUsers = [...admins, ...providers, ...keptCustomers];

    fs.writeFileSync(usersPath, JSON.stringify(cleanedUsers, null, 2), 'utf8');
    console.log(`\n✓ Saved cleaned users.json locally with ${cleanedUsers.length} total users (${keptCustomers.length} customers).`);

    // Sync deletion to Supabase
    if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        console.log('\nSyncing user removal with Supabase Cloud Database...');

        const { error: delErr } = await client.from('users').delete().in('id', removedIds);
        if (delErr) {
            console.error('Error deleting dummy users from Supabase:', delErr.message);
        } else {
            console.log(`✓ Successfully deleted ${removedIds.length} dummy users from Supabase!`);
        }
    }

    console.log('\n🎉 Successfully set total customer logins to 57 users!');
}

main().catch(err => {
    console.error('Execution error:', err);
    process.exit(1);
});
