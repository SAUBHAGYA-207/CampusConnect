require('dotenv').config();
const bcrypt = require('bcryptjs');
const JsonStorage = require('../src/storage/jsonStorage');
const usersStorage = new JsonStorage('users');

const newCustomers = [
    { name: 'Aditya Vardhan Mishra', email: 'adityavardhan.mishra.9482@gmail.com', coins: 99, ref: 'ADIT82' },
    { name: 'Shivam Choudhary', email: 'shivam.choudhary.iitp2024@gmail.com', coins: 125, ref: 'SHIV24' },
    { name: 'Harshavardhan Reddy', email: 'harshavardhan.reddy.7831@gmail.com', coins: 99, ref: 'HARS31' },
    { name: 'Aniruddh Bhattacharya', email: 'aniruddh.bhattacharya.9023@gmail.com', coins: 140, ref: 'ANIR23' },
    { name: 'Pratyush Srivastava', email: 'pratyush.srivastava.4190@gmail.com', coins: 99, ref: 'PRAT90' },
    { name: 'Meenakshi Sundaram', email: 'meenakshi.sundaram.8271@gmail.com', coins: 110, ref: 'MEEN71' },
    { name: 'Abhinav Chakraborty', email: 'abhinav.chakraborty.5638@gmail.com', coins: 99, ref: 'ABHI38' },
    { name: 'Subhashree Mohapatra', email: 'subhashree.mohapatra.3819@gmail.com', coins: 150, ref: 'SUBH19' },
    { name: 'Venkata Sai Krishna', email: 'venkata.sai.krishna.7124@gmail.com', coins: 99, ref: 'VENK24' },
    { name: 'Chandrasekhar Naidu', email: 'chandrasekhar.naidu.6045@gmail.com', coins: 135, ref: 'CHAN45' },
    { name: 'Tanmay Mukhopadhyay', email: 'tanmay.mukhopadhyay.8392@gmail.com', coins: 99, ref: 'TANM92' },
    { name: 'Debarghya Mukherjee', email: 'debarghya.mukherjee.9150@gmail.com', coins: 120, ref: 'DEBA50' },
    { name: 'Souradeep Banerjee', email: 'souradeep.banerjee.4721@gmail.com', coins: 99, ref: 'SOUR21' },
    { name: 'Himanshu Shekhar Jha', email: 'himanshu.shekhar.jha.8304@gmail.com', coins: 105, ref: 'HIMA04' },
    { name: 'Deepankar Kashyap', email: 'deepankar.kashyap.6281@gmail.com', coins: 99, ref: 'DEEP81' },
    { name: 'Swarnali Majumder', email: 'swarnali.majumder.7493@gmail.com', coins: 130, ref: 'SWAR93' },
    { name: 'Prithviraj Chauhan', email: 'prithviraj.chauhan.5167@gmail.com', coins: 99, ref: 'PRIT67' },
    { name: 'Kartikeya Sharma', email: 'kartikeya.sharma.9348@gmail.com', coins: 115, ref: 'KART48' },
    { name: 'Madhusudhan Rao', email: 'madhusudhan.rao.6829@gmail.com', coins: 99, ref: 'MADH29' },
    { name: 'Yashaswini Deshmukh', email: 'yashaswini.deshmukh.8472@gmail.com', coins: 145, ref: 'YASH72' }
];

async function seedMoreCustomers() {
    console.log('Seeding 20 realistic dummy customer accounts...');
    const passwordHash = await bcrypt.hash('password123', 10);
    const now = Date.now();

    let addedCount = 0;
    for (let i = 0; i < newCustomers.length; i++) {
        const c = newCustomers[i];
        const existing = await usersStorage.find(u => u.email === c.email);
        if (!existing) {
            const newUser = await usersStorage.add({
                email: c.email,
                name: c.name,
                password: passwordHash,
                role: 'customer',
                isVerified: true,
                otp: 'SIMULATED',
                otpExpires: null,
                coins: c.coins,
                referralCode: c.ref,
                createdAt: now - (i * 3600000 * 2.5) // staggered across recent hours
            });
            addedCount++;
            console.log(`[${addedCount}/20] Added Customer: ${c.name} (${c.email})`);
        } else {
            console.log(`- Customer already exists: ${c.email}`);
        }
    }

    console.log(`\nSuccessfully added ${addedCount} new dummy customer users! (Default password: password123)`);
}

seedMoreCustomers().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
