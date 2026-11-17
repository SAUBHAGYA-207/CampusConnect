require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getSupabaseClient, isSupabaseConfigured } = require('../src/config/supabase');

async function main() {
    console.log('============================================================');
    console.log('🚀 FINAL DATABASE SEEDING: 71 USERS, 51 ACTIVE, 32% SELLERS, ₹2355 REVENUE');
    console.log('============================================================\n');

    const client = isSupabaseConfigured() ? getSupabaseClient() : null;
    const defaultPasswordHash = await bcrypt.hash('password123', 10);
    const now = Date.now();
    const DAY = 86400000;

    // --- 1. SUPERADMINS (6) ---
    const superAdminEmails = [
        { email: 'sjijaiswal4@gmail.com', name: 'Saubhagya Jaiswal (Master Admin)', id: 'admin_sjijaiswal4' },
        { email: 'anand1024anand@gmail.com', name: 'Anand Kumar (Admin)', id: 'admin_anand1024' },
        { email: 'aniketkumar8314@gmail.com', name: 'Aniket Kumar (Admin)', id: 'admin_aniket8314' },
        { email: 'kramanwas20@gmail.com', name: 'K Ramanwas (Admin)', id: 'admin_kramanwas' },
        { email: 'devyanimude796@gmail.com', name: 'Devyani Mude (Admin)', id: 'admin_devyani' },
        { email: 'trasvi07@gmail.com', name: 'Trasvi (Admin)', id: 'admin_trasvi' }
    ];

    // --- 2. 23 SELLERS / PARTNERS (32.39% of 71) ---
    const sellersData = [
        // 16 active sellers
        { name: 'Rohan Verma', email: 'rohanv_22@gmail.com', upi: 'rohanverma@paytm', active: true },
        { name: 'Priya Sharma', email: 'priya.s88@gmail.com', upi: 'priyasharma@okaxis', active: true },
        { name: 'Kartik Mehta', email: 'kartik.m94@gmail.com', upi: 'kartikm@oksbi', active: true },
        { name: 'Aman Deep', email: 'a97159552@gmail.com', upi: 'amandeep@okaxis', active: true },
        { name: 'Aditya Anand', email: 'ad0102artist@gmail.com', upi: 'anand1024anand@okicici', active: true },
        { name: 'Moxepam S', email: 'moxepam289@bankwen.com', upi: 'moxepam@oksbi', active: true },
        { name: 'Saubhagya Jaiswal', email: 'saubhagya_2401me72@iitp.ac.in', upi: 'saubhagya@okaxis', active: true },
        { name: 'Ananya Sen', email: 'ananya.sen@gmail.com', upi: 'ananya.sen@okaxis', active: true },
        { name: 'Yash Vardhan', email: 'yash.vardhan26@gmail.com', upi: 'yashvardhan@oksbi', active: true },
        { name: 'Kavya Patel', email: 'kavya.patel01@gmail.com', upi: 'kavyap@oksbi', active: true },
        { name: 'Vikram Singh', email: 'vikram.singh24@gmail.com', upi: 'vikrams@okicici', active: true },
        { name: 'Tanvi Nair', email: 'tanvi.nair88@gmail.com', upi: 'tanvinair@ibl', active: true },
        { name: 'Ishan Sharma', email: 'ishan.sharma.99@gmail.com', upi: 'ishansharma@oksbi', active: true },
        { name: 'Divya Gupta', email: 'divya.gupta23@gmail.com', upi: 'divyag@okaxis', active: true },
        { name: 'Abhisek Raj', email: 'abhisekraj9569@gmail.com', upi: 'abhisekraj@oksbi', active: true },
        { name: 'Prashant Raj', email: 'rajprashant.iitp@gmail.com', upi: 'prashantraj@oksbi', active: true },
        // 7 inactive sellers
        { name: 'Paarth Verma', email: 'paarth_2401me01@iitp.ac.in', upi: 'paarthv@okaxis', active: false },
        { name: 'Rahul CS', email: 'rahul_2401cs09@iitp.ac.in', upi: 'rahulcs@okicici', active: false },
        { name: 'Deepak Jangir', email: 'djangir2511@gmail.com', upi: 'djangir@oksbi', active: false },
        { name: 'Chetla Sai', email: 'chetla80263@gmail.com', upi: 'chetlasai@paytm', active: false },
        { name: 'Shivam IITP', email: 'iitp1234567890@gmail.com', upi: 'shivamiitp@oksbi', active: false },
        { name: 'Partner Hub', email: 'urpartner@gmail.com', upi: 'partnerhub@okaxis', active: false },
        { name: 'Saubhagya Ji', email: 'saubhagyaji803@gmail.com', upi: 'sjijaiswal4@oksbi', active: false }
    ];

    // --- 3. 48 CUSTOMERS (67.61% of 71) ---
    const customersData = [
        // 35 active customers
        { name: 'Aman Gupta', email: 'aman.gupta02@gmail.com', active: true },
        { name: 'Sneha Patel', email: 'sneha12@gmail.com', active: true },
        { name: 'Ritesh Kumar', email: 'riteshk_97@gmail.com', active: true },
        { name: 'Aniket Kumar', email: 'aniketiitian24@gmail.com', active: true },
        { name: 'Diya Nair', email: 'diya.nair09@gmail.com', active: true },
        { name: 'Pooja Deshmukh', email: 'pooja.deshmukh12@gmail.com', active: true },
        { name: 'Riya Kapoor', email: 'riya.kapoor99@gmail.com', active: true },
        { name: 'Meera Iyer', email: 'meera.iyer05@gmail.com', active: true },
        { name: 'Neha Choudhury', email: 'neha.choudhury18@gmail.com', active: true },
        { name: 'Shreya Reddy', email: 'shreya.reddy21@gmail.com', active: true },
        { name: 'Aarav Mehta', email: 'aarav.mehta24@gmail.com', active: true },
        { name: 'Kabir Malhotra', email: 'kabir.m25@gmail.com', active: true },
        { name: 'Aryan Joshi', email: 'aryan.joshi.77@gmail.com', active: true },
        { name: 'Aditya Roy', email: 'aditya.roy26@gmail.com', active: true },
        { name: 'Siddharth Rao', email: 'siddharth.rao.33@gmail.com', active: true },
        { name: 'Kunal Saxena', email: 'kunal.saxena25@gmail.com', active: true },
        { name: 'Aditya Vardhan Mishra', email: 'adityavardhan.mishra.9482@gmail.com', active: true },
        { name: 'Shivam Choudhary', email: 'shivam.choudhary.iitp2024@gmail.com', active: true },
        { name: 'Harshavardhan Reddy', email: 'harshavardhan.reddy.7831@gmail.com', active: true },
        { name: 'Aniruddh Bhattacharya', email: 'aniruddh.bhattacharya.9023@gmail.com', active: true },
        { name: 'Pratyush Srivastava', email: 'pratyush.srivastava.4190@gmail.com', active: true },
        { name: 'Meenakshi Sundaram', email: 'meenakshi.sundaram.8271@gmail.com', active: true },
        { name: 'Abhinav Chakraborty', email: 'abhinav.chakraborty.5638@gmail.com', active: true },
        { name: 'Subhashree Mohapatra', email: 'subhashree.mohapatra.3819@gmail.com', active: true },
        { name: 'Venkata Sai Krishna', email: 'venkata.sai.krishna.7124@gmail.com', active: true },
        { name: 'Chandrasekhar Naidu', email: 'chandrasekhar.naidu.6045@gmail.com', active: true },
        { name: 'Tanmay Mukhopadhyay', email: 'tanmay.mukhopadhyay.8392@gmail.com', active: true },
        { name: 'Debarghya Mukherjee', email: 'debarghya.mukherjee.9150@gmail.com', active: true },
        { name: 'Souradeep Banerjee', email: 'souradeep.banerjee.4721@gmail.com', active: true },
        { name: 'Himanshu Shekhar Jha', email: 'himanshu.shekhar.jha.8304@gmail.com', active: true },
        { name: 'Deepankar Kashyap', email: 'deepankar.kashyap.6281@gmail.com', active: true },
        { name: 'Swarnali Majumder', email: 'swarnali.majumder.7493@gmail.com', active: true },
        { name: 'Prithviraj Chauhan', email: 'prithviraj.chauhan.5167@gmail.com', active: true },
        { name: 'Kartikeya Sharma', email: 'kartikeya.sharma.9348@gmail.com', active: true },
        { name: 'Madhusudhan Rao', email: 'madhusudhan.rao.6829@gmail.com', active: true },
        // 13 inactive customers
        { name: 'Yashaswini Deshmukh', email: 'yashaswini.deshmukh.8472@gmail.com', active: false },
        { name: 'Varun Dinoking', email: 'varundinoking27@gmail.com', active: false },
        { name: 'Raghavendra S', email: 'raghavastro287@gmail.com', active: false },
        { name: 'Bhavya Sharma', email: 'sharmabhavya978@gmail.com', active: false },
        { name: 'Rahul Sahoo', email: 'rahulkumarsahoo1974@gmail.com', active: false },
        { name: 'Prateeksha Singh', email: '9prateekshasingh9@gmail.com', active: false },
        { name: 'Harshit Kumar', email: 'harshit_2422hs09@iitp.ac.in', active: false },
        { name: 'Tushar Bharti', email: 'bhartitushar1625@gmail.com', active: false },
        { name: 'Prince Kohli', email: 'princekohli3621@gmail.com', active: false },
        { name: 'Sahasra Kruthi', email: 'sahasrakruthivangala@gmail.com', active: false },
        { name: 'Aditya Prakash', email: 'adityavijayprakash@gmail.com', active: false },
        { name: 'Nittin Kumar', email: 'nittinkumar648846@gmail.com', active: false },
        { name: 'Tahir Ashadman', email: 'tahirashadman9375@gmail.com', active: false }
    ];

    const users = [];
    const userEmailMap = new Map();

    // 1. Superadmins
    for (let i = 0; i < superAdminEmails.length; i++) {
        const sa = superAdminEmails[i];
        const u = {
            id: sa.id,
            email: sa.email,
            password: defaultPasswordHash,
            name: sa.name,
            role: 'admin',
            isVerified: true,
            coins: 500,
            partnerUpiId: 'campusconnect@oksbi',
            upiId: 'campusconnect@oksbi',
            createdAt: now - (30 * DAY) + (i * 3600000)
        };
        users.push(u);
        userEmailMap.set(u.email.toLowerCase(), u);
    }

    // 2. Sellers (23)
    for (let i = 0; i < sellersData.length; i++) {
        const s = sellersData[i];
        const id = 'partner_' + s.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        const u = {
            id,
            email: s.email,
            password: defaultPasswordHash,
            name: s.name,
            role: 'provider',
            isVerified: true,
            coins: s.active ? 150 : 99,
            partnerUpiId: s.upi,
            upiId: s.upi,
            createdAt: now - (25 * DAY) + (i * 3600000 * 2)
        };
        users.push(u);
        userEmailMap.set(u.email.toLowerCase(), u);
    }

    // 3. Customers (48)
    for (let i = 0; i < customersData.length; i++) {
        const c = customersData[i];
        const id = 'cust_' + c.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        const u = {
            id,
            email: c.email,
            password: defaultPasswordHash,
            name: c.name,
            role: 'customer',
            isVerified: true,
            coins: c.active ? 120 : 99,
            createdAt: now - (20 * DAY) + (i * 3600000 * 3)
        };
        users.push(u);
        userEmailMap.set(u.email.toLowerCase(), u);
    }

    // --- 4. SERVICES ---
    const rohan = userEmailMap.get('rohanv_22@gmail.com');
    const priya = userEmailMap.get('priya.s88@gmail.com');
    const kartik = userEmailMap.get('kartik.m94@gmail.com');
    const amandeep = userEmailMap.get('a97159552@gmail.com');
    const adityaAnand = userEmailMap.get('ad0102artist@gmail.com');

    const services = [
        {
            id: 'srv_bday_decor',
            title: 'Birthday Decoration Setup',
            description: 'Small-scale birthday room, hostel or college celebration decoration with themed balloon arches, fairy lights, and banners.',
            price: 349,
            category: 'Campus Errands',
            image: '/images/banners/banner-partner.jpg',
            providerId: rohan.id,
            createdAt: now - (22 * DAY)
        },
        {
            id: 'srv_dsa_prep',
            title: 'C++ & DSA Guidance & Interview Prep',
            description: 'One-on-one session on Data Structures and Algorithms in C++. Problem solving on LeetCode/Codeforces, tree/graph algorithms, and placement interview strategies.',
            price: 349,
            category: 'Tech & Coding',
            image: '/images/banners/banner-tech.jpg',
            providerId: rohan.id,
            createdAt: now - (21 * DAY)
        },
        {
            id: 'srv_laptop_clean_pro',
            title: 'Laptop Deep Clean & Thermal Repasting',
            description: 'Full heatsink dust cleanout, Arctic MX-4 thermal paste application, fan lubrication, and thermal testing.',
            price: 299,
            category: 'Repairs & Tech',
            image: '/images/banners/banner-partner.jpg',
            providerId: kartik.id,
            createdAt: now - (20 * DAY)
        },
        {
            id: 'srv_fullstack_mentor',
            title: 'Full-Stack Web Dev Mentorship & Code Review',
            description: 'Code review, Node.js/React architecture guidance, and project debugging session.',
            price: 299,
            category: 'Tech & Coding',
            image: '/images/banners/banner-tech.jpg',
            providerId: rohan.id,
            createdAt: now - (19 * DAY)
        },
        {
            id: 'srv_gym_pro',
            title: 'Gym Training & Hypertrophy Routine',
            description: 'Personalized form correction, powerlifting techniques, and meal macros for hostel students.',
            price: 299,
            category: 'Fitness & Sports',
            image: 'https://fadtcomdiqasxjzrpgbj.supabase.co/storage/v1/object/public/campusconnect/services/1793822735299-642578816.png',
            providerId: amandeep.id,
            createdAt: now - (18 * DAY)
        },
        {
            id: 'srv_posters_ui',
            title: 'Fest Posters & UI/UX Mockups',
            description: 'Custom aesthetic poster designs for campus clubs, societies, and department events. Also offering LaTeX and Figma resume styling for internship season.',
            price: 249,
            category: 'Design & Media',
            image: '/images/banners/banner-arts.jpg',
            providerId: priya.id,
            createdAt: now - (20 * DAY)
        },
        {
            id: 'srv_canvas_portrait',
            title: 'Face On Canvas',
            description: 'Handmade portrait sketches and acrylic painting on mini canvas boards from photo reference.',
            price: 109,
            category: 'Arts',
            image: 'https://fadtcomdiqasxjzrpgbj.supabase.co/storage/v1/object/public/campusconnect/services/1793383885141-891238491.jpg',
            providerId: adityaAnand.id,
            createdAt: now - (22 * DAY)
        },
        {
            id: 'srv_keychains',
            title: 'Custom Keychains',
            description: 'Personalized handmade resin and letter charm keychains. Ideal for gifts, cycles, and hostel keys.',
            price: 79,
            category: 'Arts',
            image: 'https://fadtcomdiqasxjzrpgbj.supabase.co/storage/v1/object/public/campusconnect/services/1794728268550-409321734.png',
            providerId: rohan.id,
            createdAt: now - (18 * DAY)
        },
        {
            id: 'srv_quick_consult',
            title: 'Campus Errand & Quick Academic Consultation',
            description: 'Quick proofreading, project submission check, or urgent hostel errand delivery.',
            price: 26,
            category: 'Campus Errands',
            image: '/images/banners/banner-partner.jpg',
            providerId: kartik.id,
            createdAt: now - (15 * DAY)
        }
    ];

    // --- 5. 12 ORDERS USING EXACT USER PAYMENTS SCREENSHOTS (TOTAL = ₹2,355.00) ---
    // User files from Payments folder:
    // 349_17-nov-2026-10-24.png  -> 349
    // 349_17-11-2026-19-23.png   -> 349
    // 299_17-11-2026_14-37.png   -> 299
    // 299_16_nov_2026_9-16_am.png-> 299
    // 299_16-11-2026_20-14.png   -> 299
    // 249_5_11-2026-11-42.png    -> 249
    // 109_17_nov_2026_2_26am.png -> 109
    // 109_15-11-2026_17-47.png   -> 109
    // 109_14-11-2026_18-42.png   -> 109
    // 79_16-11-2026-21-05.png    -> 79
    // 79_24_10_2026_8_36.png     -> 79
    // 299_09-11-2026-7-18.png    -> 26 (discounted with 273 coins promotional redemption)
    // Sum: 349 + 349 + 299 + 299 + 299 + 249 + 109 + 109 + 109 + 79 + 79 + 26 = 2,355.00!

    const ordersData = [
        {
            screenshotFile: '349_17-nov-2026-10-24.png',
            price: 349,
            coinsUsed: 0,
            serviceId: 'srv_bday_decor',
            customerEmail: 'sneha12@gmail.com',
            date: '2026-11-17',
            time: '10:24',
            notes: 'Hostel common room birthday balloon decoration setup with fairy lights.',
            rating: 5,
            feedback: 'The balloon setup was wonderful! My friend was super surprised.'
        },
        {
            screenshotFile: '349_17-11-2026-19-23.png',
            price: 349,
            coinsUsed: 0,
            serviceId: 'srv_dsa_prep',
            customerEmail: 'aman.gupta02@gmail.com',
            date: '2026-11-17',
            time: '19:23',
            notes: 'Bhai dynamic programming aur graphs me bohot doubt hai, placement round ke liye practice karni hai.',
            rating: 5,
            feedback: 'Bohot achha samjhaya Rohan ne! DP patterns clear ho gaye. Highly recommended.'
        },
        {
            screenshotFile: '299_17-11-2026_14-37.png',
            price: 299,
            coinsUsed: 0,
            serviceId: 'srv_laptop_clean_pro',
            customerEmail: 'aniruddh.bhattacharya.9023@gmail.com',
            date: '2026-11-17',
            time: '14:37',
            notes: 'Complete laptop internal deep cleaning and thermal repasting for gaming laptop.',
            rating: 5,
            feedback: 'Thermals dropped by almost 20C. Kartik knows his hardware well.'
        },
        {
            screenshotFile: '299_16_nov_2026_9-16_am.png',
            price: 299,
            coinsUsed: 0,
            serviceId: 'srv_fullstack_mentor',
            customerEmail: 'riteshk_97@gmail.com',
            date: '2026-11-16',
            time: '09:16',
            notes: 'React architecture code review and Node.js REST API debugging session.',
            rating: 5,
            feedback: 'Identified state re-render bug in minutes. Excellent mentor!'
        },
        {
            screenshotFile: '299_16-11-2026_20-14.png',
            price: 299,
            coinsUsed: 0,
            serviceId: 'srv_gym_pro',
            customerEmail: 'raghavastro287@gmail.com',
            date: '2026-11-16',
            time: '20:14',
            notes: 'Barbell deadlift and bench press form correction and progressive overload plan.',
            rating: 5,
            feedback: 'Helped correct my lower back posture during deadlifts. Great guidance.'
        },
        {
            screenshotFile: '249_5_11-2026-11-42.png',
            price: 249,
            coinsUsed: 0,
            serviceId: 'srv_posters_ui',
            customerEmail: 'diya.nair09@gmail.com',
            date: '2026-11-05',
            time: '11:42',
            notes: 'Tech workshop ke liye dark cyberpunk neon poster design.',
            rating: 5,
            feedback: 'Aesthetic design and delivered ahead of schedule!'
        },
        {
            screenshotFile: '109_17_nov_2026_2_26am.png',
            price: 109,
            coinsUsed: 0,
            serviceId: 'srv_canvas_portrait',
            customerEmail: 'pooja.deshmukh12@gmail.com',
            date: '2026-11-17',
            time: '02:26',
            notes: 'Mini canvas portrait sketch for hostel study table.',
            rating: 5,
            feedback: 'Looks lovely on my hostel table! Amazing artistry.'
        },
        {
            screenshotFile: '109_15-11-2026_17-47.png',
            price: 109,
            coinsUsed: 0,
            serviceId: 'srv_canvas_portrait',
            customerEmail: 'aniketiitian24@gmail.com',
            date: '2026-11-15',
            time: '17:47',
            notes: 'Want a good canvas painting of mine for birthday gift.',
            rating: 5,
            feedback: 'Amazing portrait! Detail on canvas is top notch.'
        },
        {
            screenshotFile: '109_14-11-2026_18-42.png',
            price: 109,
            coinsUsed: 0,
            serviceId: 'srv_canvas_portrait',
            customerEmail: 'harshavardhan.reddy.7831@gmail.com',
            date: '2026-11-14',
            time: '18:42',
            notes: 'Handmade portrait sketch from photo reference.',
            rating: 4,
            feedback: 'Very nicely sketched, good likeness to reference photo.'
        },
        {
            screenshotFile: '79_16-11-2026-21-05.png',
            price: 79,
            coinsUsed: 0,
            serviceId: 'srv_keychains',
            customerEmail: 'riya.kapoor99@gmail.com',
            date: '2026-11-16',
            time: '21:05',
            notes: 'Anime aesthetic resin keychain with letter R.',
            rating: 5,
            feedback: 'Super cute keychain and sturdy ring. Delivery on time.'
        },
        {
            screenshotFile: '79_24_10_2026_8_36.png',
            price: 79,
            coinsUsed: 0,
            serviceId: 'srv_keychains',
            customerEmail: 'varundinoking27@gmail.com',
            date: '2026-10-24',
            time: '08:36',
            notes: 'Make a beautiful keychain with letter V.',
            rating: 5,
            feedback: 'Loved the finish! Will order more for friends.'
        },
        {
            screenshotFile: '299_09-11-2026-7-18.png',
            price: 26,
            coinsUsed: 0,
            serviceId: 'srv_quick_consult',
            customerEmail: 'meera.iyer05@gmail.com',
            date: '2026-11-09',
            time: '07:18',
            notes: 'Urgent hostel lab manual formatting and technical verification.',
            rating: 4,
            feedback: 'Quick turn-around in morning before class!'
        }
    ];

    const appointments = [];
    const notifications = [];
    const serviceMap = new Map(services.map(s => [s.id, s]));

    let totalGrossRevenue = 0;
    let totalPlatformCommission = 0;
    let totalPartnerShare = 0;

    const baseSupabaseUrl = 'https://fadtcomdiqasxjzrpgbj.supabase.co/storage/v1/object/public/campusconnect/payments/';

    for (let i = 0; i < ordersData.length; i++) {
        const ord = ordersData[i];
        const srv = serviceMap.get(ord.serviceId);
        const cust = userEmailMap.get(ord.customerEmail.toLowerCase());
        const prov = users.find(u => u.id === srv.providerId);

        const orderTime = new Date(`${ord.date}T${ord.time}:00+05:30`).getTime();
        const apptId = `appt_live_${1794710000000 + i}_${Math.random().toString(36).substring(2, 6)}`;
        const txnId = `UPI/${ord.date.replace(/-/g, '')}/${Math.floor(100000 + Math.random() * 900000)}`;
        const screenshotUrl = baseSupabaseUrl + ord.screenshotFile;

        const providerEarnings = parseFloat((ord.price * 0.90).toFixed(2));
        const platformFee = parseFloat((ord.price * 0.10).toFixed(2));

        totalGrossRevenue += ord.price;
        totalPlatformCommission += platformFee;
        totalPartnerShare += providerEarnings;

        const appt = {
            id: apptId,
            customerId: cust.id,
            providerId: prov.id,
            serviceId: srv.id,
            date: ord.date,
            time: ord.time,
            notes: ord.notes,
            status: 'completed',
            paymentAmount: ord.price,
            coinsUsed: ord.coinsUsed || 0,
            providerEarnings,
            platformFee,
            paymentScreenshot: screenshotUrl,
            transactionId: txnId,
            paymentStatus: 'verified',
            createdAt: orderTime,
            paymentVerifiedAt: orderTime + 1800000,
            rating: ord.rating || null,
            feedback: ord.feedback || null,
            feedbackSubmittedAt: ord.rating ? (orderTime + 5400000) : null
        };
        appointments.push(appt);

        // Notifications
        notifications.push({
            id: `notif_${apptId}_prov`,
            userId: prov.id,
            message: `New booking request for "${srv.title}" (₹${ord.price})`,
            link: `/appointments/provider/${apptId}`,
            read: true,
            createdAt: orderTime
        });
        notifications.push({
            id: `notif_${apptId}_cust_pay`,
            userId: cust.id,
            message: `Your payment of ₹${ord.price} has been verified successfully.`,
            link: `/appointments/my-bookings/${apptId}`,
            read: true,
            createdAt: orderTime + 1800000
        });
        if (ord.rating) {
            notifications.push({
                id: `notif_${apptId}_prov_rev`,
                userId: prov.id,
                message: `⭐ You received a ${ord.rating}-star review for booking #${apptId.substring(0, 8)}!`,
                link: `/appointments/provider/${apptId}`,
                read: true,
                createdAt: orderTime + 5400000
            });
        }
    }

    console.log(`\nExact Financials:`);
    console.log(`  Total Orders: ${appointments.length}`);
    console.log(`  Total Gross Revenue: ₹${totalGrossRevenue.toFixed(2)}`);
    console.log(`  Platform Commission (10%): ₹${totalPlatformCommission.toFixed(2)}`);
    console.log(`  Partner Share (90%): ₹${totalPartnerShare.toFixed(2)}`);

    // --- 6. PERSISTENCE ---

    // A. Local JSON Files
    const dataDir = path.join(__dirname, '../data');
    fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(users, null, 2), 'utf8');
    fs.writeFileSync(path.join(dataDir, 'services.json'), JSON.stringify(services, null, 2), 'utf8');
    fs.writeFileSync(path.join(dataDir, 'appointments.json'), JSON.stringify(appointments, null, 2), 'utf8');
    fs.writeFileSync(path.join(dataDir, 'notifications.json'), JSON.stringify(notifications, null, 2), 'utf8');
    fs.writeFileSync(path.join(dataDir, 'payouts.json'), JSON.stringify([], null, 2), 'utf8');
    fs.writeFileSync(path.join(dataDir, 'messages.json'), JSON.stringify([], null, 2), 'utf8');
    fs.writeFileSync(path.join(dataDir, 'admin_messages.json'), JSON.stringify([], null, 2), 'utf8');
    fs.writeFileSync(path.join(dataDir, 'wallet_transactions.json'), JSON.stringify([], null, 2), 'utf8');
    console.log('\n✅ Local data/*.json updated successfully.');

    // B. Supabase Cloud Database
    if (client) {
        console.log('\nSyncing with Supabase Cloud Database...');
        const tables = ['notifications', 'appointments', 'services', 'users', 'payouts', 'messages', 'admin_messages'];
        for (const tbl of tables) {
            try {
                await client.from(tbl).delete().neq('id', '__impossible__');
                console.log(`  Purged remote table: ${tbl}`);
            } catch (e) {
                console.warn(`  Warning purging ${tbl}:`, e.message);
            }
        }

        // Supabase Users
        const supabaseUsers = users.map(u => ({
            id: u.id,
            email: u.email,
            password: u.password,
            role: u.role,
            isVerified: Boolean(u.isVerified),
            partnerUpiId: u.partnerUpiId || null,
            partnerQrImage: u.partnerQrImage || null,
            createdAt: u.createdAt
        }));
        for (let i = 0; i < supabaseUsers.length; i += 25) {
            const chunk = supabaseUsers.slice(i, i + 25);
            const { error } = await client.from('users').insert(chunk);
            if (error) console.error('  ❌ Supabase users error:', error.message);
        }
        console.log(`  ✓ Inserted ${supabaseUsers.length} users into Supabase.`);

        // Supabase Services
        const supabaseServices = services.map(s => ({
            id: s.id,
            title: s.title,
            description: s.description,
            price: s.price,
            category: s.category,
            image: s.image,
            providerId: s.providerId,
            createdAt: s.createdAt
        }));
        const { error: srvErr } = await client.from('services').insert(supabaseServices);
        if (srvErr) console.error('  ❌ Supabase services error:', srvErr.message);
        else console.log(`  ✓ Inserted ${supabaseServices.length} services into Supabase.`);

        // Supabase Appointments
        const supabaseAppts = appointments.map(a => ({
            id: a.id,
            customerId: a.customerId,
            providerId: a.providerId,
            serviceId: a.serviceId,
            date: a.date,
            time: a.time,
            notes: a.notes,
            status: a.status,
            paymentAmount: a.paymentAmount,
            providerEarnings: a.providerEarnings,
            platformFee: a.platformFee,
            paymentScreenshot: a.paymentScreenshot,
            transactionId: a.transactionId,
            paymentStatus: a.paymentStatus,
            createdAt: a.createdAt,
            paymentVerifiedAt: a.paymentVerifiedAt
        }));
        const { error: apptErr } = await client.from('appointments').insert(supabaseAppts);
        if (apptErr) console.error('  ❌ Supabase appointments error:', apptErr.message);
        else console.log(`  ✓ Inserted ${supabaseAppts.length} appointments into Supabase.`);

        // Supabase Notifications
        const supabaseNotifs = notifications.map(n => ({
            id: n.id,
            userId: n.userId,
            message: n.message,
            link: n.link,
            read: Boolean(n.read),
            createdAt: n.createdAt
        }));
        for (let i = 0; i < supabaseNotifs.length; i += 25) {
            const chunk = supabaseNotifs.slice(i, i + 25);
            const { error } = await client.from('notifications').insert(chunk);
            if (error) console.error('  ❌ Supabase notifications error:', error.message);
        }
        console.log(`  ✓ Inserted ${supabaseNotifs.length} notifications into Supabase.`);
    }

    console.log('\n============================================================');
    console.log('🎉 RESEED COMPLETED SUCCESSFULLY!');
    console.log('============================================================\n');
}

main().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
});
