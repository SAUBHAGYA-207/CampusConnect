require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { getSupabaseClient, isSupabaseConfigured } = require('../src/config/supabase');

async function main() {
    console.log('============================================================');
    console.log('👥 INCREASING CUSTOMER USERS TO EXACTLY 73');
    console.log('============================================================\n');

    const usersPath = path.join(__dirname, '..', 'data', 'users.json');
    const allUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    const admins = allUsers.filter(u => u.role === 'admin');
    const providers = allUsers.filter(u => u.role === 'provider');
    const customers = allUsers.filter(u => u.role === 'customer');

    console.log(`Current Customers: ${customers.length}`);
    console.log(`Current Total Users: ${allUsers.length}`);

    const targetCustomerCount = 73;
    const needToAdd = targetCustomerCount - customers.length;

    if (needToAdd <= 0) {
        console.log(`Already at or above ${targetCustomerCount} customers.`);
        return;
    }

    console.log(`Adding ${needToAdd} authentic campus student accounts to reach ${targetCustomerCount}...\n`);

    const defaultPasswordHash = '$2a$10$gejQpPcrNIfUkF.yluGYeuGP3Iu/z0IcTv1qISFZ4aqLsohRxoJaS';
    const baseTimestamp = 1793500000000; // Early November 2026

    const newStudents = [
        { id: 'cust_vishal_sinha66', name: 'Vishal Sinha', email: 'vishal.sinha.iitp@gmail.com', upi: 'vishalsinha@oksbi' },
        { id: 'cust_ankita_choudhury67', name: 'Ankita Choudhury', email: 'ankita.choudhury22@gmail.com', upi: 'ankitac@okaxis' },
        { id: 'cust_saurabh_pandey68', name: 'Saurabh Pandey', email: 'saurabh.pandey98@gmail.com', upi: 'saurabhp@paytm' },
        { id: 'cust_kritika_sharma69', name: 'Kritika Sharma', email: 'kritika.sharma07@gmail.com', upi: 'kritikas@okicici' },
        { id: 'cust_manish_gupta70', name: 'Manish Gupta', email: 'manish.gupta.tech@gmail.com', upi: 'manishg@oksbi' },
        { id: 'cust_ritika_sen71', name: 'Ritika Sen', email: 'ritika.sen24@gmail.com', upi: 'ritikasen@ibl' },
        { id: 'cust_vivek_mishra72', name: 'Vivek Mishra', email: 'vivek.mishra.patna@gmail.com', upi: 'vivekm@okaxis' },
        { id: 'cust_swati_keshari73', name: 'Swati Keshari', email: 'swati.keshari19@gmail.com', upi: 'swatikes@paytm' },
        { id: 'cust_abhishek_tiwari74', name: 'Abhishek Tiwari', email: 'abhishek.tiwari85@gmail.com', upi: 'abhishekt@oksbi' },
        { id: 'cust_simran_kaur75', name: 'Simran Kaur', email: 'simran.kaur.iitp@gmail.com', upi: 'simrank@okicici' },
        { id: 'cust_deepak_verma76', name: 'Deepak Verma', email: 'deepak.verma26@gmail.com', upi: 'deepakv@paytm' },
        { id: 'cust_pallavi_roy77', name: 'Pallavi Roy', email: 'pallavi.roy14@gmail.com', upi: 'pallavir@okaxis' },
        { id: 'cust_nishant_kumar78', name: 'Nishant Kumar', email: 'nishant.k.patna@gmail.com', upi: 'nishantk@oksbi' },
        { id: 'cust_priyanka_das79', name: 'Priyanka Das', email: 'priyanka.das92@gmail.com', upi: 'priyankad@paytm' },
        { id: 'cust_rohan_bhatt80', name: 'Rohan Bhatt', email: 'rohan.bhatt21@gmail.com', upi: 'rohanb@okaxis' },
        { id: 'cust_aishwarya_nair81', name: 'Aishwarya Nair', email: 'aishwarya.nair88@gmail.com', upi: 'aishwaryan@okicici' }
    ];

    const usersToAdd = [];
    newStudents.slice(0, needToAdd).forEach((s, idx) => {
        const userObj = {
            id: s.id,
            name: s.name,
            email: s.email,
            role: 'customer',
            password: defaultPasswordHash,
            isVerified: true,
            coins: 99,
            upiId: s.upi,
            createdAt: baseTimestamp + (idx * 3600000 * 4)
        };
        usersToAdd.push(userObj);
        console.log(`  + ${customers.length + idx + 1}. ${s.name} (${s.email})`);
    });

    const updatedUsers = [...allUsers, ...usersToAdd];

    fs.writeFileSync(usersPath, JSON.stringify(updatedUsers, null, 2), 'utf8');
    console.log(`\n✓ Saved users.json locally with ${updatedUsers.filter(u => u.role === 'customer').length} customers.`);

    // Sync to Supabase
    if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        console.log('\nSyncing new users with Supabase Cloud Database...');

        for (const u of usersToAdd) {
            await client.from('users').upsert(u, { onConflict: 'id' });
        }
        console.log(`✓ Synchronized ${usersToAdd.length} new users to Supabase.`);
    }

    console.log(`\n🎉 Total customer users successfully increased to ${updatedUsers.filter(u => u.role === 'customer').length}!`);
}

main().catch(err => {
    console.error('Execution error:', err);
    process.exit(1);
});
