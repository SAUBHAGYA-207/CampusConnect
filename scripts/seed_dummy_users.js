const bcrypt = require('bcryptjs');
const JsonStorage = require('../src/storage/jsonStorage');
const usersStorage = new JsonStorage('users');

async function seed() {
    const passwordHash = await bcrypt.hash('password123', 10);
    const now = Date.now();

    const partners = [
        { name: 'Yash Vardhan', email: 'yash.vardhan26@gmail.com', upi: 'yashvardhan@oksbi', coins: 149, ref: 'YASH26' },
        { name: 'Ananya Sen', email: 'ananya.sen@gmail.com', upi: 'ananya.sen@okaxis', coins: 180, ref: 'ANAN78' },
        { name: 'Rohan Verma', email: 'rohan.v25@gmail.com', upi: 'rohanverma@paytm', coins: 120, ref: 'ROHA25' },
        { name: 'Kavya Patel', email: 'kavya.patel01@gmail.com', upi: 'kavyap@oksbi', coins: 210, ref: 'KAVY01' },
        { name: 'Vikram Singh', email: 'vikram.singh24@gmail.com', upi: 'vikrams@okicici', coins: 99, ref: 'VIKR24' },
        { name: 'Tanvi Nair', email: 'tanvi.nair88@gmail.com', upi: 'tanvinair@ibl', coins: 165, ref: 'TANV88' },
        { name: 'Ishan Sharma', email: 'ishan.sharma.99@gmail.com', upi: 'ishansharma@oksbi', coins: 130, ref: 'ISHA99' },
        { name: 'Divya Gupta', email: 'divya.gupta23@gmail.com', upi: 'divyag@okaxis', coins: 195, ref: 'DIVY23' }
    ];

    const customers = [
        { name: 'Aarav Mehta', email: 'aarav.mehta24@gmail.com', coins: 99, ref: 'AARA24' },
        { name: 'Diya Nair', email: 'diya.nair09@gmail.com', coins: 140, ref: 'DIYA09' },
        { name: 'Kabir Malhotra', email: 'kabir.m25@gmail.com', coins: 99, ref: 'KABI25' },
        { name: 'Pooja Deshmukh', email: 'pooja.deshmukh12@gmail.com', coins: 110, ref: 'POOJ12' },
        { name: 'Aryan Joshi', email: 'aryan.joshi.77@gmail.com', coins: 99, ref: 'ARYA77' },
        { name: 'Riya Kapoor', email: 'riya.kapoor99@gmail.com', coins: 150, ref: 'RIYA99' },
        { name: 'Aditya Roy', email: 'aditya.roy26@gmail.com', coins: 99, ref: 'ADIT26' },
        { name: 'Meera Iyer', email: 'meera.iyer05@gmail.com', coins: 125, ref: 'MEER05' },
        { name: 'Siddharth Rao', email: 'siddharth.rao.33@gmail.com', coins: 99, ref: 'SIDD33' },
        { name: 'Neha Choudhury', email: 'neha.choudhury18@gmail.com', coins: 135, ref: 'NEHA18' },
        { name: 'Kunal Saxena', email: 'kunal.saxena25@gmail.com', coins: 99, ref: 'KUNA25' },
        { name: 'Shreya Reddy', email: 'shreya.reddy21@gmail.com', coins: 105, ref: 'SHRE21' }
    ];

    let addedPartners = 0;
    for (let i = 0; i < partners.length; i++) {
        const p = partners[i];
        const existing = await usersStorage.find(u => u.email === p.email);
        if (!existing) {
            await usersStorage.add({
                email: p.email,
                name: p.name,
                password: passwordHash,
                role: 'provider',
                isVerified: true,
                partnerUpiId: p.upi,
                upiId: p.upi,
                coins: p.coins,
                referralCode: p.ref,
                createdAt: now - (i * 3600000 * 5)
            });
            addedPartners++;
            console.log(`+ Added Partner: ${p.name} (${p.email})`);
        }
    }

    let addedCustomers = 0;
    for (let i = 0; i < customers.length; i++) {
        const c = customers[i];
        const existing = await usersStorage.find(u => u.email === c.email);
        if (!existing) {
            await usersStorage.add({
                email: c.email,
                name: c.name,
                password: passwordHash,
                role: 'customer',
                isVerified: true,
                coins: c.coins,
                referralCode: c.ref,
                createdAt: now - (i * 3600000 * 3)
            });
            addedCustomers++;
            console.log(`+ Added Customer: ${c.name} (${c.email})`);
        }
    }

    console.log(`Done! Added ${addedPartners} partners and ${addedCustomers} customers. (Password: password123)`);
}

seed().catch(console.error);
