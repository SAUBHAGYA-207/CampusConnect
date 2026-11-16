require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getSupabaseClient, isSupabaseConfigured } = require('../src/config/supabase');
const JsonStorage = require('../src/storage/jsonStorage');
const usersStorage = new JsonStorage('users');

const replacements = {
    'yash.vardhan26@iitp.ac.in': 'yash.vardhan26@gmail.com',
    'rohan.v25@iitp.ac.in': 'rohan.v25@gmail.com',
    'vikram.singh24@iitp.ac.in': 'vikram.singh24@gmail.com',
    'ishan.sharma@iitp.ac.in': 'ishan.sharma.99@gmail.com',
    'aarav.mehta24@iitp.ac.in': 'aarav.mehta24@gmail.com',
    'kabir.m25@iitp.ac.in': 'kabir.m25@gmail.com',
    'aryan.joshi@iitp.ac.in': 'aryan.joshi.77@gmail.com',
    'aditya.roy26@iitp.ac.in': 'aditya.roy26@gmail.com',
    'siddharth.rao@iitp.ac.in': 'siddharth.rao.33@gmail.com',
    'kunal.saxena25@iitp.ac.in': 'kunal.saxena25@gmail.com'
};

async function replaceDummyEmails() {
    console.log('--- REPLACING DUMMY USERS @iitp.ac.in WITH @gmail.com ---');
    const allUsers = await usersStorage.getAll();

    let updatedCount = 0;
    const client = isSupabaseConfigured() ? getSupabaseClient() : null;

    for (const user of allUsers) {
        if (!user.email) continue;
        const targetEmail = replacements[user.email.toLowerCase()];
        if (targetEmail) {
            console.log(`Replacing: ${user.name} (${user.email}) -> ${targetEmail}`);
            // Update in Supabase
            if (client) {
                const { error } = await client.from('users').update({ email: targetEmail }).eq('id', user.id);
                if (error) {
                    console.error(`  ❌ Supabase update error for ${user.id}:`, error.message);
                } else {
                    console.log(`  ✓ Supabase updated for ${user.id}`);
                }
            }
            user.email = targetEmail;
            updatedCount++;
        }
    }

    // Update local data/users.json
    const usersJsonPath = path.join(__dirname, '../data/users.json');
    fs.writeFileSync(usersJsonPath, JSON.stringify(allUsers, null, 2), 'utf8');
    console.log(`✓ Saved ${allUsers.length} users to data/users.json`);

    console.log(`\nSuccessfully updated ${updatedCount} dummy users from @iitp.ac.in to @gmail.com!`);
}

replaceDummyEmails().catch(err => {
    console.error('Replacement failed:', err);
    process.exit(1);
});
