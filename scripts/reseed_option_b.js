require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { getSupabaseClient, isSupabaseConfigured } = require('../src/config/supabase');

async function main() {
    console.log('============================================================');
    console.log('🚀 SEEDING OPTION B: 85 CUSTOMERS, 15 SERVICES, 45 COMPLETED (₹2850 GMV), HINGLISH CHATS');
    console.log('============================================================\n');

    const client = isSupabaseConfigured() ? getSupabaseClient() : null;
    const defaultPasswordHash = await bcrypt.hash('password123', 10);
    const masterAdminPasswordHash = await bcrypt.hash('SAUBHAGYA', 10);

    // --- 1. SUPERADMINS (PRESERVED PASSWORDS) ---
    const admins = [
        {
            id: 'admin_sjijaiswal4',
            email: 'sjijaiswal4@gmail.com',
            name: 'Saubhagya Jaiswal (Master Admin)',
            role: 'admin',
            password: masterAdminPasswordHash,
            isVerified: true,
            coins: 49,
            partnerUpiId: 'campusconnect@oksbi',
            upiId: 'campusconnect@oksbi',
            createdAt: 1792146164000
        },
        {
            id: 'admin_anand1024',
            email: 'anand1024anand@gmail.com',
            name: 'Anand Kumar (Admin)',
            role: 'admin',
            password: '$2a$10$HqIaK2KWj4qEoJf0Cx94qeHTH01acaAx2pYc5qNwfPzKU0uMYH4YW',
            isVerified: true,
            coins: 49,
            partnerUpiId: 'campusconnect@oksbi',
            upiId: 'campusconnect@oksbi',
            createdAt: 1792146164000
        },
        {
            id: 'admin_aniket8314',
            email: 'aniketkumar8314@gmail.com',
            name: 'Aniket Kumar (Admin)',
            role: 'admin',
            password: '$2a$10$TwuP27TULM4/C2yQnUHcBeIviAES6w5CmsXrk9Ft1Tz4n.zI7pujS',
            isVerified: true,
            coins: 49,
            partnerUpiId: 'campusconnect@oksbi',
            upiId: 'campusconnect@oksbi',
            createdAt: 1792146164000
        },
        {
            id: 'admin_kramanwas',
            email: 'kramanwas20@gmail.com',
            name: 'K Ramanwas (Admin)',
            role: 'admin',
            password: '$2a$10$2bzg7XmNJ.9k/dxbFngazOo5gI0SRXzBIX0ZR3LZ9N4nrF7ngQ8Ue',
            isVerified: true,
            coins: 49,
            partnerUpiId: 'campusconnect@oksbi',
            upiId: 'campusconnect@oksbi',
            createdAt: 1792146164000
        },
        {
            id: 'admin_devyani',
            email: 'devyanimude796@gmail.com',
            name: 'Devyani Mude (Admin)',
            role: 'admin',
            password: '$2a$10$gC5ZMXgcMJQbnij.SzZbteX2v.jP/FMzmK/N3W0zuFwud0HG.zuba',
            isVerified: true,
            coins: 49,
            partnerUpiId: 'campusconnect@oksbi',
            upiId: 'campusconnect@oksbi',
            createdAt: 1792146164000
        },
        {
            id: 'admin_trasvi',
            email: 'trasvi07@gmail.com',
            name: 'Trasvi (Admin)',
            role: 'admin',
            password: '$2a$10$Leh.5x/akBzoO9U4il1kPuvfivkvNyn.Wii5bncoreyYKeF7FZcZu',
            isVerified: true,
            coins: 49,
            partnerUpiId: 'campusconnect@oksbi',
            upiId: 'campusconnect@oksbi',
            createdAt: 1792146164000
        },
        {
            id: '1793526977123ncsied',
            email: 'admin@campusconnect.com',
            name: 'CampusConnect Admin',
            role: 'admin',
            password: '$2a$10$/.8lL6VeqriGooOrUdRadudRhGHfrEuOs7x/305nZwbhmyHX.akMm',
            isVerified: true,
            coins: 49,
            partnerUpiId: 'campusconnect@oksbi',
            upiId: 'campusconnect@oksbi',
            createdAt: 1792146164000
        }
    ];

    // --- 2. 23 PARTNERS (ZERO COLLEGE / IIT REFERENCES) ---
    const sellersData = [
        { name: 'Rohan Verma', email: 'rohanv_22@gmail.com', upi: 'rohanverma@paytm' },
        { name: 'Priya Sharma', email: 'priya.s88@gmail.com', upi: 'priyasharma@okaxis' },
        { name: 'Kartik Mehta', email: 'kartik.m94@gmail.com', upi: 'kartikm@oksbi' },
        { name: 'Aman Deep', email: 'a97159552@gmail.com', upi: 'amandeep@okaxis' },
        { name: 'Aditya Anand', email: 'ad0102artist@gmail.com', upi: 'anand1024anand@okicici' },
        { name: 'Moxepam S', email: 'moxepam289@bankwen.com', upi: 'moxepam@oksbi' },
        { name: 'Saubhagya Jaiswal', email: 'saubhagya.j24@gmail.com', upi: 'saubhagya@okaxis' },
        { name: 'Ananya Sen', email: 'ananya.sen@gmail.com', upi: 'ananya.sen@okaxis' },
        { name: 'Yash Vardhan', email: 'yash.vardhan26@gmail.com', upi: 'yashvardhan@oksbi' },
        { name: 'Kavya Patel', email: 'kavya.patel01@gmail.com', upi: 'kavyap@oksbi' },
        { name: 'Vikram Singh', email: 'vikram.singh24@gmail.com', upi: 'vikrams@okicici' },
        { name: 'Tanvi Nair', email: 'tanvi.nair88@gmail.com', upi: 'tanvinair@ibl' },
        { name: 'Ishan Sharma', email: 'ishan.sharma.99@gmail.com', upi: 'ishansharma@oksbi' },
        { name: 'Divya Gupta', email: 'divya.gupta23@gmail.com', upi: 'divyag@okaxis' },
        { name: 'Abhisek Raj', email: 'abhisekraj9569@gmail.com', upi: 'abhisekraj@oksbi' },
        { name: 'Prashant Raj', email: 'prashant.raj88@gmail.com', upi: 'prashantraj@oksbi' },
        { name: 'Paarth Verma', email: 'paarth.verma21@gmail.com', upi: 'paarthv@okaxis' },
        { name: 'Rahul CS', email: 'rahul.cs24@gmail.com', upi: 'rahulcs@okicici' },
        { name: 'Deepak Jangir', email: 'djangir2511@gmail.com', upi: 'djangir@oksbi' },
        { name: 'Chetla Sai', email: 'chetla80263@gmail.com', upi: 'chetlasai@paytm' },
        { name: 'Shivam Patel', email: 'shivam.patel29@gmail.com', upi: 'shivampatel29@oksbi' },
        { name: 'Partner Hub', email: 'urpartner@gmail.com', upi: 'partnerhub@okaxis' },
        { name: 'Saubhagya Ji', email: 'saubhagyaji803@gmail.com', upi: 'sjijaiswal4@oksbi' }
    ];

    const partners = sellersData.map((s, idx) => ({
        id: 'partner_' + s.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ''),
        email: s.email,
        name: s.name,
        role: 'provider',
        password: defaultPasswordHash,
        isVerified: true,
        coins: 49,
        partnerUpiId: s.upi,
        upiId: s.upi,
        createdAt: 1792146164000 + (idx * 3600000)
    }));

    // --- 3. 85 UNIQUE CUSTOMERS (NO IITP / CLEAN PERSONAL EMAILS) ---
    const keyCustomers = [
        { name: 'Amit Kumar', email: 'amit.kumar@paytm', upi: 'amit.kumar@paytm' },
        { name: 'Rohit Verma', email: 'rohitverma@okaxis', upi: 'rohitverma@okaxis' },
        { name: 'Saubhagya Ji Jaiswal', email: 'saubhagyajaiswal@sbi', upi: 'saubhagyajaiswal@sbi' }
    ];

    const customerNames = [
        'Aman Gupta', 'Sneha Patel', 'Ritesh Kumar', 'Aniket Kumar', 'Diya Nair',
        'Pooja Deshmukh', 'Riya Kapoor', 'Meera Iyer', 'Neha Choudhury', 'Shreya Reddy',
        'Aarav Mehta', 'Kabir Malhotra', 'Aryan Joshi', 'Aditya Roy', 'Siddharth Rao',
        'Kunal Saxena', 'Aditya Vardhan Mishra', 'Shivam Choudhary', 'Harshavardhan Reddy', 'Aniruddh Bhattacharya',
        'Pratyush Srivastava', 'Meenakshi Sundaram', 'Abhinav Chakraborty', 'Subhashree Mohapatra', 'Venkata Sai Krishna',
        'Chandrasekhar Naidu', 'Tanmay Mukhopadhyay', 'Debarghya Mukherjee', 'Souradeep Banerjee', 'Himanshu Shekhar Jha',
        'Deepankar Kashyap', 'Swarnali Majumder', 'Prithviraj Chauhan', 'Kartikeya Sharma', 'Madhusudhan Rao',
        'Yashaswini Deshmukh', 'Varun Dinoking', 'Raghavendra S', 'Bhavya Sharma', 'Rahul Sahoo',
        'Prateeksha Singh', 'Harshit Kumar', 'Tushar Bharti', 'Prince Kohli', 'Sahasra Kruthi',
        'Aditya Prakash', 'Nittin Kumar', 'Tahir Ashadman', 'Naveen Jindal', 'Pankaj Tripathi',
        'Alok Nath', 'Gaurav Sen', 'Akash Murthy', 'Chirag Paswan', 'Mayank Agarwal',
        'Suresh Raina', 'Manish Pandey', 'Robin Uthappa', 'Sanju Samson', 'Ravindra Jadeja',
        'Axar Patel', 'Kuldeep Yadav', 'Yuzvendra Chahal', 'Mohammed Siraj', 'Jasprit Bumrah',
        'Arshdeep Singh', 'Umran Malik', 'Tilak Varma', 'Rinku Singh', 'Jitesh Sharma',
        'Washington Sundar', 'Shardul Thakur', 'Mukesh Kumar', 'Prasidh Krishna', 'Avesh Khan',
        'Ravi Bishnoi', 'Ruturaj Gaikwad', 'Devdutt Padikkal', 'Sai Sudharsan', 'Shahrukh Khan',
        'Rahul Tripathi', 'Kagiso Rabada'
    ]; // 3 key + 82 generated = 85 unique customers!

    const customers = [];
    keyCustomers.forEach(kc => {
        customers.push({
            id: 'cust_' + kc.name.toLowerCase().replace(/\s+/g, '_'),
            name: kc.name,
            email: kc.email.includes('@') ? kc.email : `${kc.email.replace(/[^a-zA-Z0-9]/g, '')}@gmail.com`,
            role: 'customer',
            password: defaultPasswordHash,
            isVerified: true,
            coins: 49,
            upiId: kc.upi,
            createdAt: 1792146164000
        });
    });

    customerNames.forEach((name, i) => {
        const cleanBase = name.toLowerCase().replace(/[^a-z0-9]/g, '.');
        const num = (i + 12);
        customers.push({
            id: 'cust_' + cleanBase.replace(/\./g, '_') + num,
            name,
            email: `${cleanBase}${num}@gmail.com`,
            role: 'customer',
            password: defaultPasswordHash,
            isVerified: true,
            coins: 49,
            upiId: `${cleanBase}${num}@oksbi`,
            createdAt: 1792146164000 + (i * 1800000)
        });
    });

    const allUsers = [...admins, ...partners, ...customers];
    console.log(`✓ Total Users Generated: ${allUsers.length} (${admins.length} Admins, ${partners.length} Partners, ${customers.length} Unique Customers)`);

    // --- 4. 15 ACTIVE SERVICES (PUBLISHED) ---
    const rohan = partners.find(p => p.email === 'rohanv_22@gmail.com');
    const priya = partners.find(p => p.email === 'priya.s88@gmail.com');
    const kartik = partners.find(p => p.email === 'kartik.m94@gmail.com');
    const aman = partners.find(p => p.email === 'a97159552@gmail.com');
    const adityaAnand = partners.find(p => p.email === 'ad0102artist@gmail.com');
    const ananya = partners.find(p => p.email === 'ananya.sen@gmail.com');
    const vikram = partners.find(p => p.email === 'vikram.singh24@gmail.com');
    const yash = partners.find(p => p.email === 'yash.vardhan26@gmail.com');

    const services = [
        {
            id: 'srv_keychains',
            title: 'Custom Keychains',
            description: 'Personalized handmade resin and letter charm keychains. Ideal for gifts, cycles, and hostel keys.',
            price: 79,
            category: 'Arts',
            image: 'https://fadtcomdiqasxjzrpgbj.supabase.co/storage/v1/object/public/campusconnect/services/1794728268550-409321734.png',
            providerId: rohan.id,
            status: 'published',
            createdAt: 1792146164000
        },
        {
            id: 'srv_canvas_portrait',
            title: 'Face On Canvas',
            description: 'Handmade portrait sketches and acrylic painting on mini canvas boards from photo reference.',
            price: 109,
            category: 'Arts',
            image: 'https://fadtcomdiqasxjzrpgbj.supabase.co/storage/v1/object/public/campusconnect/services/1793383885141-891238491.jpg',
            providerId: adityaAnand.id,
            status: 'published',
            createdAt: 1792146164000
        },
        {
            id: 'srv_posters_ui',
            title: 'Fest Posters & UI/UX Mockups',
            description: 'Custom aesthetic poster designs for campus clubs, societies, and department events.',
            price: 249,
            category: 'Design & Media',
            image: '/images/banners/banner-arts.jpg',
            providerId: priya.id,
            status: 'published',
            createdAt: 1792146164000
        },
        {
            id: 'srv_laptop_clean_pro',
            title: 'Laptop Deep Clean & Thermal Repasting',
            description: 'Thermal repasting and heatsink dust cleaning for gaming & coding laptops.',
            price: 299,
            category: 'Repairs & Tech',
            image: 'https://fadtcomdiqasxjzrpgbj.supabase.co/storage/v1/object/public/campusconnect/services/1794728399587-894721984.png',
            providerId: kartik.id,
            status: 'published',
            createdAt: 1792146164000
        },
        {
            id: 'srv_fullstack_mentor',
            title: 'Full-Stack Web Dev Mentorship & Code Review',
            description: '1-on-1 code review, bug debugging, and project structuring for web development.',
            price: 299,
            category: 'Tech & Coding',
            image: '/images/banners/banner-tech.jpg',
            providerId: rohan.id,
            status: 'published',
            createdAt: 1792146164000
        },
        {
            id: 'srv_gym_pro',
            title: 'Gym Training & Hypertrophy Routine',
            description: 'Personalized compound lifting form corrections and nutrition plans for campus gym.',
            price: 299,
            category: 'Fitness & Sports',
            image: '/images/banners/banner-gym.jpg',
            providerId: aman.id,
            status: 'published',
            createdAt: 1792146164000
        },
        {
            id: 'srv_bday_decor',
            title: 'Birthday Decoration Setup',
            description: 'Complete hostel room surprise birthday balloon and fairy light decoration.',
            price: 349,
            category: 'Campus Errands',
            image: '/images/banners/banner-decor.jpg',
            providerId: rohan.id,
            status: 'published',
            createdAt: 1792146164000
        },
        {
            id: 'srv_dsa_prep',
            title: 'C++ & DSA Guidance & Interview Prep',
            description: 'Intensive mock coding round, dynamic programming concepts, and LeetCode guidance.',
            price: 349,
            category: 'Tech & Coding',
            image: '/images/banners/banner-dsa.jpg',
            providerId: rohan.id,
            status: 'published',
            createdAt: 1792146164000
        },
        {
            id: 'srv_quick_consult',
            title: 'Campus Errand & Quick Academic Consultation',
            description: 'Hostel emergency delivery, document collection, and quick assignment proofreading.',
            price: 26,
            category: 'Campus Errands',
            image: '/images/banners/banner-partner.jpg',
            providerId: kartik.id,
            status: 'published',
            createdAt: 1792146164000
        },
        // 6 New Services
        {
            id: 'srv_lab_report',
            title: 'Lab Report Formatting & Print Delivery',
            description: 'LaTeX/Word formatting for engineering lab reports, clean graphs, and hostel room delivery.',
            price: 39,
            category: 'Academics',
            image: '/images/banners/banner-lab.jpg',
            providerId: kartik.id,
            status: 'published',
            createdAt: 1792146164000
        },
        {
            id: 'srv_handwritten_notes',
            title: 'Handwritten Engineering Physics & Math Notes',
            description: 'Crisp, colored, syllabus-mapped handwritten revision formulas and previous year question solutions.',
            price: 49,
            category: 'Academics',
            image: '/images/banners/banner-notes.jpg',
            providerId: ananya.id,
            status: 'published',
            createdAt: 1792146164000
        },
        {
            id: 'srv_cycle_repair',
            title: 'Campus Bicycle Flat Tire & Brake Tuning',
            description: 'Doorstep puncture fix, brake wire tightening, and chain lubrication at hostel bicycle stands.',
            price: 59,
            category: 'Repairs & Tech',
            image: '/images/banners/banner-cycle.jpg',
            providerId: vikram.id,
            status: 'published',
            createdAt: 1792146164000
        },
        {
            id: 'srv_slide_deck',
            title: 'PPT Seminar Presentation Design',
            description: 'Modern minimalist slides with clean typography, charts, and animations for course presentations.',
            price: 69,
            category: 'Design & Media',
            image: '/images/banners/banner-slides.jpg',
            providerId: priya.id,
            status: 'published',
            createdAt: 1792146164000
        },
        {
            id: 'srv_laundry_drop',
            title: 'Hostel Bulk Laundry Pickup & Press Drop',
            description: 'Door-to-door hostel laundry collection, detergent wash, iron pressing, and folded return.',
            price: 45,
            category: 'Campus Errands',
            image: '/images/banners/banner-laundry.jpg',
            providerId: aman.id,
            status: 'published',
            createdAt: 1792146164000
        },
        {
            id: 'srv_calculator_rental',
            title: 'Scientific Calculator (fx-991CW) Exam Rental',
            description: 'Fully functional, approved non-programmable scientific calculator rental for midsem and endsem exams.',
            price: 35,
            category: 'Academics',
            image: '/images/banners/banner-calc.jpg',
            providerId: yash.id,
            status: 'published',
            createdAt: 1792146164000
        }
    ];

    console.log(`✓ Total Services: ${services.length} (All verified & published for Marketplace)`);

    // --- 5. ORDERS (45 COMPLETED = ₹2,850 GMV | 4 PENDING = ₹1,296) ---
    const appointments = [];
    const baseSupabaseUrl = 'https://fadtcomdiqasxjzrpgbj.supabase.co/storage/v1/object/public/campusconnect/payments/';
    const serviceMap = new Map(services.map(s => [s.id, s]));

    // 8 Completed from Existing Screenshots (Sum = ₹1,333)
    const completedScreenshotOrders = [
        {
            file: '79_24_10_2026_8_36.png',
            price: 79,
            srvId: 'srv_keychains',
            custEmail: 'amit.kumar@paytm',
            date: '2026-10-24',
            time: '20:36',
            notes: 'Personalized resin keychain with initial A, deliver to Hostel block B.',
            rating: 5,
            feedback: 'Bohot badiya keychain banaya bhai ne. Finish ekdum mast hai!'
        },
        {
            file: '249_5_11-2026-11-42.png',
            price: 249,
            srvId: 'srv_posters_ui',
            custEmail: 'sneha.patel13@gmail.com',
            date: '2026-11-05',
            time: '11:42',
            notes: 'Robotics club orientation meet ke liye aesthetic dark-mode banner chahiye.',
            rating: 5,
            feedback: 'Super fast delivery and clean typography. Loved it.'
        },
        {
            file: '299_09-11-2026-7-18.png',
            price: 299,
            srvId: 'srv_laptop_clean_pro',
            custEmail: 'rohitverma@okaxis',
            date: '2026-11-09',
            time: '19:18',
            notes: 'Dell Inspiron fan making buzzing noise and thermal throttling on Matlab.',
            rating: 5,
            feedback: 'Fan noise completely band ho gaya, temps are under 65C now. Kartik is awesome.'
        },
        {
            file: '109_14-11-2026_18-42.png',
            price: 109,
            srvId: 'srv_canvas_portrait',
            custEmail: 'rohitverma@okaxis',
            date: '2026-11-14',
            time: '18:42',
            notes: 'Handmade portrait mini canvas for roommate gift.',
            rating: 5,
            feedback: 'Canvas quality is top notch. Painting looks super realistic!'
        },
        {
            file: '109_15-11-2026_17-47.png',
            price: 109,
            srvId: 'srv_canvas_portrait',
            custEmail: 'aman.gupta12@gmail.com',
            date: '2026-11-15',
            time: '17:47',
            notes: 'Sketch from reference photo on table canvas.',
            rating: 5,
            feedback: 'Gifted to my friend, she loved the handmade touch.'
        },
        {
            file: '299_16_nov_2026_9-16_am.png',
            price: 299,
            srvId: 'srv_fullstack_mentor',
            custEmail: 'ritesh.kumar14@gmail.com',
            date: '2026-11-16',
            time: '09:16',
            notes: 'Express backend and Postgres foreign key constraint debugging session.',
            rating: 5,
            feedback: 'Solved migration issue in 15 minutes. Great mentoring.'
        },
        {
            file: '79_16-11-2026-21-05.png',
            price: 79,
            srvId: 'srv_keychains',
            custEmail: 'diya.nair16@gmail.com',
            date: '2026-11-16',
            time: '21:05',
            notes: 'Two letter keychains for cycle key.',
            rating: 5,
            feedback: 'Cute keychains, delivered right on time!'
        },
        {
            file: '109_17_nov_2026_2_26am.png',
            price: 109,
            srvId: 'srv_canvas_portrait',
            custEmail: 'pooja.deshmukh17@gmail.com',
            date: '2026-11-17',
            time: '14:26',
            notes: 'Mini canvas portrait for desk decor.',
            rating: 5,
            feedback: 'Super neat brushwork!'
        }
    ];

    let orderIndex = 0;
    completedScreenshotOrders.forEach(co => {
        orderIndex++;
        const srv = serviceMap.get(co.srvId);
        const cust = customers.find(c => c.email.toLowerCase() === co.custEmail.toLowerCase()) || customers[0];
        const prov = partners.find(p => p.id === srv.providerId) || partners[0];
        const orderTime = new Date(`${co.date}T${co.time}:00+05:30`).getTime();
        const apptId = `appt_comp_${1794710000000 + orderIndex}_${Math.random().toString(36).substring(2, 6)}`;
        const providerEarnings = parseFloat((co.price * 0.90).toFixed(2));
        const platformFee = parseFloat((co.price * 0.10).toFixed(2));

        appointments.push({
            id: apptId,
            customerId: cust.id,
            providerId: prov.id,
            serviceId: srv.id,
            date: co.date,
            time: co.time,
            notes: co.notes,
            status: 'completed',
            paymentAmount: co.price,
            coinsUsed: 0,
            providerEarnings,
            platformFee,
            paymentScreenshot: baseSupabaseUrl + co.file,
            transactionId: `UPI/${co.date.replace(/-/g, '')}/${Math.floor(100000 + Math.random() * 900000)}`,
            paymentStatus: 'verified',
            createdAt: orderTime,
            paymentVerifiedAt: orderTime + 1800000,
            rating: co.rating,
            feedback: co.feedback,
            feedbackSubmittedAt: orderTime + 7200000
        });
    });

    // 37 Micro-Orders Across 20 Oct - 10 Nov (Exact Sum = ₹1,518)
    // 9x26 + 8x35 + 8x39 + 4x45 + 3x59 + 3x79 + 2x49 = ₹1,518.00!
    const microPrices = [
        // 20 Oct to 26 Oct (Early Traction - 9 orders)
        { price: 26, srvId: 'srv_quick_consult', date: '2026-10-21', time: '11:15', notes: 'Urgent assignment printout pickup from library xerox shop.' },
        { price: 35, srvId: 'srv_calculator_rental', date: '2026-10-22', time: '09:30', notes: 'Calculator fx-991CW rental for morning quiz.' },
        { price: 39, srvId: 'srv_lab_report', date: '2026-10-23', time: '16:45', notes: 'Chemistry lab report formatting and spiral bind delivery.' },
        { price: 26, srvId: 'srv_quick_consult', date: '2026-10-24', time: '14:20', notes: 'Parcel collection from main campus gate.' },
        { price: 49, srvId: 'srv_handwritten_notes', date: '2026-10-25', time: '19:10', notes: 'Engineering math formula sheets and solved tutorials.' },
        { price: 26, srvId: 'srv_quick_consult', date: '2026-10-26', time: '10:00', notes: 'Hardware kit delivery to electrical lab.' },
        { price: 45, srvId: 'srv_laundry_drop', date: '2026-10-26', time: '18:30', notes: 'Weekend bulk laundry wash & fold.' },
        { price: 59, srvId: 'srv_cycle_repair', date: '2026-10-27', time: '17:15', notes: 'Cycle rear tire puncture repair at hostel cycle stand.' },
        { price: 26, srvId: 'srv_quick_consult', date: '2026-10-28', time: '15:40', notes: 'Urgent document xerox submission.' },

        // 27 Oct to 03 Nov (Ramping Growth - 14 orders)
        { price: 79, srvId: 'srv_keychains', date: '2026-10-29', time: '12:00', notes: 'Custom resin keychain with cycle key charm.' },
        { price: 26, srvId: 'srv_quick_consult', date: '2026-10-30', time: '13:25', notes: 'Stationery purchase and room delivery.' },
        { price: 39, srvId: 'srv_lab_report', date: '2026-10-31', time: '17:00', notes: 'Physics lab manual LaTeX formatting.' },
        { price: 35, srvId: 'srv_calculator_rental', date: '2026-11-01', time: '08:45', notes: 'Calculator rental for thermodynamics mid-term.' },
        { price: 26, srvId: 'srv_quick_consult', date: '2026-11-01', time: '16:10', notes: 'Bread & milk delivery from campus grocery store.' },
        { price: 49, srvId: 'srv_handwritten_notes', date: '2026-11-02', time: '20:15', notes: 'Basic Electrical Sciences crisp handwritten notes.' },
        { price: 35, srvId: 'srv_calculator_rental', date: '2026-11-02', time: '22:00', notes: 'Engineering math calculator rental.' },
        { price: 26, srvId: 'srv_quick_consult', date: '2026-11-03', time: '11:30', notes: 'Medicine delivery from health center dispensary.' },
        { price: 39, srvId: 'srv_lab_report', date: '2026-11-03', time: '16:50', notes: 'CAD drawings printout and file submission.' },
        { price: 45, srvId: 'srv_laundry_drop', date: '2026-11-04', time: '18:00', notes: 'Formal blazer dry-clean pickup.' },
        { price: 26, srvId: 'srv_quick_consult', date: '2026-11-04', time: '21:10', notes: 'Late night printout from computer center.' },
        { price: 59, srvId: 'srv_cycle_repair', date: '2026-11-05', time: '16:30', notes: 'Bicycle brake shoe replacement.' },
        { price: 39, srvId: 'srv_lab_report', date: '2026-11-05', time: '19:45', notes: 'Python data science lab graphs printout.' },
        { price: 35, srvId: 'srv_calculator_rental', date: '2026-11-06', time: '14:15', notes: 'Calculator rental for afternoon class quiz.' },

        // 04 Nov to 10 Nov (Peak Activity - 14 orders)
        { price: 79, srvId: 'srv_keychains', date: '2026-11-06', time: '18:40', notes: 'Glow in dark resin keychain.' },
        { price: 39, srvId: 'srv_lab_report', date: '2026-11-07', time: '11:20', notes: 'Fluid mechanics observation table formatting.' },
        { price: 35, srvId: 'srv_calculator_rental', date: '2026-11-07', time: '15:10', notes: 'Casio scientific calculator rental.' },
        { price: 35, srvId: 'srv_calculator_rental', date: '2026-11-08', time: '09:00', notes: 'Casio fx-991CW rental for afternoon exam.' },
        { price: 45, srvId: 'srv_laundry_drop', date: '2026-11-08', time: '17:30', notes: 'Hostel weekly laundry bag wash & press.' },
        { price: 26, srvId: 'srv_quick_consult', date: '2026-11-08', time: '20:50', notes: 'Urgent graph paper delivery.' },
        { price: 79, srvId: 'srv_keychains', date: '2026-11-09', time: '14:00', notes: 'Custom letter charm keychain gift.' },
        { price: 39, srvId: 'srv_lab_report', date: '2026-11-09', time: '16:30', notes: 'Signals lab submission report formatting.' },
        { price: 45, srvId: 'srv_laundry_drop', date: '2026-11-09', time: '21:00', notes: 'Curtains & bedsheet laundry drop.' },
        { price: 35, srvId: 'srv_calculator_rental', date: '2026-11-10', time: '08:30', notes: 'Scientific calculator 1-day rental.' },
        { price: 59, srvId: 'srv_cycle_repair', date: '2026-11-10', time: '13:15', notes: 'Hostel stand bicycle chain lubrication and pedal tightening.' },
        { price: 39, srvId: 'srv_lab_report', date: '2026-11-10', time: '17:20', notes: 'Embedded systems code snippet formatting.' },
        { price: 39, srvId: 'srv_lab_report', date: '2026-11-10', time: '19:40', notes: 'Digital electronics logic circuit report formatting.' },
        { price: 35, srvId: 'srv_calculator_rental', date: '2026-11-10', time: '22:15', notes: 'Next-day end-sem exam calculator reservation.' }
    ];

    // Exactly 10 Users Use Promo Coins on 10 Completed Orders
    const coinRedemptions = [15, 20, 15, 10, 25, 10, 20, 25, 10, 30]; // Sum = 180 coins
    const walletTransactions = [];

    microPrices.forEach((mo, idx) => {
        orderIndex++;
        const srv = serviceMap.get(mo.srvId);
        const cust = customers[(idx + 4) % customers.length];
        const prov = partners.find(p => p.id === srv.providerId) || partners[0];
        const orderTime = new Date(`${mo.date}T${mo.time}:00+05:30`).getTime();
        const apptId = `appt_comp_${1794720000000 + orderIndex}_${Math.random().toString(36).substring(2, 6)}`;
        const providerEarnings = parseFloat((mo.price * 0.90).toFixed(2));
        const platformFee = parseFloat((mo.price * 0.10).toFixed(2));

        const coinsUsed = (idx < 10) ? coinRedemptions[idx] : 0;
        let finalNotes = mo.notes;
        if (coinsUsed > 0) {
            finalNotes = `[🪙 ${coinsUsed} Coins Redeemed - ₹${coinsUsed} Discount Applied]\n${mo.notes}`;
            cust.coins = Math.max(0, (cust.coins || 49) - coinsUsed);
            walletTransactions.push({
                id: `tx_${apptId}_coin_debit`,
                userId: cust.id,
                type: 'debit',
                amount: coinsUsed,
                description: `Redeemed ${coinsUsed} promo coins on booking for "${srv.title}"`,
                status: 'completed',
                referenceId: apptId,
                createdAt: orderTime
            });
        }

        appointments.push({
            id: apptId,
            customerId: cust.id,
            providerId: prov.id,
            serviceId: srv.id,
            date: mo.date,
            time: mo.time,
            notes: finalNotes,
            status: 'completed',
            paymentAmount: mo.price,
            coinsUsed,
            providerEarnings,
            platformFee,
            paymentScreenshot: baseSupabaseUrl + '109_14-11-2026_18-42.png',
            transactionId: `UPI/${mo.date.replace(/-/g, '')}/${Math.floor(100000 + Math.random() * 900000)}`,
            paymentStatus: 'verified',
            createdAt: orderTime,
            paymentVerifiedAt: orderTime + 1800000,
            rating: 5,
            feedback: 'Quick and hassle-free campus delivery. Very helpful during busy days!',
            feedbackSubmittedAt: orderTime + 7200000
        });
    });

    // 4 Pending / Incomplete Orders (Exam Crunch Delay - Sum = ₹1,296)
    const pendingOrders = [
        {
            file: '299_16-11-2026_20-14.png',
            price: 299,
            srvId: 'srv_gym_pro',
            custEmail: 'saubhagyajaiswal@sbi',
            date: '2026-11-16',
            time: '20:14',
            notes: 'Personal gym coaching and hypertrophy routine. Currently delayed due to end-sem prep.'
        },
        {
            file: '299_17-11-2026_14-37.png',
            price: 299,
            srvId: 'srv_laptop_clean_pro',
            custEmail: 'aniruddh.bhattacharya31@gmail.com',
            date: '2026-11-17',
            time: '14:37',
            notes: 'Asus gaming laptop thermal repasting. Partner unavailable due to morning exam.'
        },
        {
            file: '349_17-nov-2026-10-24.png',
            price: 349,
            srvId: 'srv_bday_decor',
            custEmail: 'kabir.malhotra23@gmail.com',
            date: '2026-11-17',
            time: '20:11',
            notes: 'Surprise hostel birthday room fairy light setup. Pending partner confirmation.'
        },
        {
            file: '349_17-11-2026-19-23.png',
            price: 349,
            srvId: 'srv_dsa_prep',
            custEmail: 'aryan.joshi24@gmail.com',
            date: '2026-11-17',
            time: '20:11',
            notes: 'Graph theory & DP placement interview round prep. Provider studying for end-sems.'
        }
    ];

    pendingOrders.forEach((po, idx) => {
        orderIndex++;
        const srv = serviceMap.get(po.srvId);
        const cust = customers.find(c => c.email.toLowerCase() === po.custEmail.toLowerCase()) || customers[0];
        const prov = partners.find(p => p.id === srv.providerId) || partners[0];
        const orderTime = new Date(`${po.date}T${po.time}:00+05:30`).getTime();
        const apptId = `appt_pend_${1794730000000 + orderIndex}_${Math.random().toString(36).substring(2, 6)}`;
        const providerEarnings = parseFloat((po.price * 0.90).toFixed(2));
        const platformFee = parseFloat((po.price * 0.10).toFixed(2));

        appointments.push({
            id: apptId,
            customerId: cust.id,
            providerId: prov.id,
            serviceId: srv.id,
            date: po.date,
            time: po.time,
            notes: po.notes,
            status: 'pending',
            paymentAmount: po.price,
            coinsUsed: 0,
            providerEarnings,
            platformFee,
            paymentScreenshot: baseSupabaseUrl + po.file,
            transactionId: `UPI/${po.date.replace(/-/g, '')}/${Math.floor(100000 + Math.random() * 900000)}`,
            paymentStatus: 'verified',
            createdAt: orderTime,
            paymentVerifiedAt: orderTime + 1800000
        });
    });

    const completedApps = appointments.filter(a => a.status === 'completed');
    const totalGrossRevenue = completedApps.reduce((acc, a) => acc + a.paymentAmount, 0);
    const totalPlatformCommission = completedApps.reduce((acc, a) => acc + a.platformFee, 0);
    const totalPartnerShare = completedApps.reduce((acc, a) => acc + a.providerEarnings, 0);

    console.log(`✓ Total Appointments: ${appointments.length} (${completedApps.length} Completed, ${appointments.length - completedApps.length} Pending)`);
    console.log(`✓ Total GMV (Completed): ₹${totalGrossRevenue.toFixed(2)} (Target: ₹2850.00)`);
    console.log(`✓ Total Platform Revenue (10%): ₹${totalPlatformCommission.toFixed(2)} (Target: ₹285.00)`);
    console.log(`✓ Total Partner Share (90%): ₹${totalPartnerShare.toFixed(2)}`);

    // --- 6. CASUAL HINGLISH CHATS (MESSAGES.JSON) ---
    const messages = [
        {
            id: 'msg_1',
            senderId: customers[0].id, // Amit Kumar
            receiverId: rohan.id,
            message: 'Bhai resin keychain ka order daala hai, initial "A" rakhna please.',
            createdAt: new Date('2026-10-24T18:10:00+05:30').getTime()
        },
        {
            id: 'msg_2',
            senderId: rohan.id,
            receiverId: customers[0].id,
            message: 'Haan bhai done! Letter A black background me ready kar dunga kal dopahar tak.',
            createdAt: new Date('2026-10-24T18:25:00+05:30').getTime()
        },
        {
            id: 'msg_3',
            senderId: customers[0].id,
            receiverId: rohan.id,
            message: 'Bohot badhiya! Payment ka screenshot submit kar diya hai check kar lo.',
            createdAt: new Date('2026-10-24T20:37:00+05:30').getTime()
        },
        {
            id: 'msg_4',
            senderId: rohan.id,
            receiverId: customers[0].id,
            message: 'Mil gaya bhai! Kal room pe drop karwa dunga.',
            createdAt: new Date('2026-10-24T20:45:00+05:30').getTime()
        },
        {
            id: 'msg_5',
            senderId: customers[1].id, // Rohit Verma
            receiverId: kartik.id,
            message: 'Kartik bhai, laptop bohot heat ho raha hai Matlab chalane pe. Repasting kab tak ho payegi?',
            createdAt: new Date('2026-11-09T17:15:00+05:30').getTime()
        },
        {
            id: 'msg_6',
            senderId: kartik.id,
            receiverId: customers[1].id,
            message: 'Bhai Arctic MX-4 thermal paste hai mere paas. Aaj sham 7 baje room pe le aao, 45 min me done.',
            createdAt: new Date('2026-11-09T17:30:00+05:30').getTime()
        },
        {
            id: 'msg_7',
            senderId: customers[1].id,
            receiverId: kartik.id,
            message: 'Perfect, booking karke ₹299 transfer kar diya hai Google Pay se.',
            createdAt: new Date('2026-11-09T19:20:00+05:30').getTime()
        },
        {
            id: 'msg_8',
            senderId: kartik.id,
            receiverId: customers[1].id,
            message: 'Haan bhai verified! Aa jao room 214.',
            createdAt: new Date('2026-11-09T19:25:00+05:30').getTime()
        },
        {
            id: 'msg_9',
            senderId: customers[2].id, // Saubhagya Ji Jaiswal
            receiverId: aman.id,
            message: 'Aman bhai gym workout split aur progressive overload ka plan chahiye tha end-sems ke baad ke liye.',
            createdAt: new Date('2026-11-16T19:50:00+05:30').getTime()
        },
        {
            id: 'msg_10',
            senderId: aman.id,
            receiverId: customers[2].id,
            message: 'Haan bhai, abhi endsem exams chal rahe hain na, parso exam khatam hote hi customized PDF aur diet chart share karta hu!',
            createdAt: new Date('2026-11-16T20:05:00+05:30').getTime()
        },
        {
            id: 'msg_11',
            senderId: customers[2].id,
            receiverId: aman.id,
            message: 'Cool bhai no rush, ₹299 send karke proof attach kar diya hai. All the best for exams!',
            createdAt: new Date('2026-11-16T20:15:00+05:30').getTime()
        }
    ];

    // --- 7. PARTNER PAYOUT REQUEST (ROHAN VERMA > ₹200 THRESHOLD, STATUS: PENDING) ---
    const payouts = [
        {
            id: `payout_rohan_${Date.now()}`,
            partnerId: rohan.id,
            partnerEmail: rohan.email,
            amount: 350.00,
            status: 'pending',
            partnerUpiId: rohan.partnerUpiId,
            partnerQrImage: null,
            notes: 'First payout request for keychains & mentorship earnings. Please settle to Paytm UPI.',
            proofImage: null,
            utrNumber: null,
            clearedByAdminEmail: null,
            clearedAt: null,
            createdAt: new Date('2026-11-16T15:00:00+05:30').getTime()
        }
    ];

    // --- 8. SAVE TO LOCAL JSON ---
    const dataDir = path.join(__dirname, '..', 'data');
    fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(allUsers, null, 2), 'utf8');
    fs.writeFileSync(path.join(dataDir, 'services.json'), JSON.stringify(services, null, 2), 'utf8');
    fs.writeFileSync(path.join(dataDir, 'appointments.json'), JSON.stringify(appointments, null, 2), 'utf8');
    fs.writeFileSync(path.join(dataDir, 'messages.json'), JSON.stringify(messages, null, 2), 'utf8');
    fs.writeFileSync(path.join(dataDir, 'payouts.json'), JSON.stringify(payouts, null, 2), 'utf8');
    fs.writeFileSync(path.join(dataDir, 'notifications.json'), JSON.stringify([], null, 2), 'utf8');
    fs.writeFileSync(path.join(dataDir, 'wallet_transactions.json'), JSON.stringify(walletTransactions, null, 2), 'utf8');
    console.log('\n✅ Local data/*.json updated successfully!');

    // --- 9. SYNC WITH SUPABASE CLOUD DATABASE ---
    if (client) {
        console.log('\nSyncing with Supabase Cloud Database...');
        const tables = ['payouts', 'messages', 'appointments', 'services', 'users', 'notifications', 'wallet_transactions'];
        for (const tbl of tables) {
            try {
                await client.from(tbl).delete().neq('id', '__impossible__');
                console.log(`  Purged Supabase table: ${tbl}`);
            } catch (e) {
                console.warn(`  Warning purging ${tbl}:`, e.message);
            }
        }

        // Users
        const supaUsers = allUsers.map(u => ({
            id: u.id,
            email: u.email,
            password: u.password,
            role: u.role,
            isVerified: Boolean(u.isVerified),
            partnerUpiId: u.partnerUpiId || null,
            createdAt: u.createdAt
        }));
        for (let i = 0; i < supaUsers.length; i += 25) {
            const chunk = supaUsers.slice(i, i + 25);
            const { error } = await client.from('users').insert(chunk);
            if (error) console.error('  ❌ Supabase users error:', error.message);
        }
        console.log(`  ✓ Inserted ${supaUsers.length} users into Supabase.`);

        // Services
        const supaServices = services.map(s => ({
            id: s.id,
            title: s.title,
            description: s.description,
            price: s.price,
            category: s.category,
            image: s.image,
            providerId: s.providerId,
            createdAt: s.createdAt
        }));
        const { error: srvErr } = await client.from('services').insert(supaServices);
        if (srvErr) console.error('  ❌ Supabase services error:', srvErr.message);
        else console.log(`  ✓ Inserted ${supaServices.length} services into Supabase.`);

        // Appointments
        const supaAppts = appointments.map(a => ({
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
        for (let i = 0; i < supaAppts.length; i += 25) {
            const chunk = supaAppts.slice(i, i + 25);
            const { error } = await client.from('appointments').insert(chunk);
            if (error) console.error('  ❌ Supabase appointments error:', error.message);
        }
        console.log(`  ✓ Inserted ${supaAppts.length} appointments into Supabase.`);

        // Messages
        const supaMessages = messages.map((m, idx) => ({
            id: m.id,
            appointmentId: appointments[idx % appointments.length].id,
            senderId: m.senderId,
            senderRole: m.senderId.startsWith('cust_') ? 'customer' : 'provider',
            text: m.message,
            timestamp: m.createdAt
        }));
        const { error: msgErr } = await client.from('messages').insert(supaMessages);
        if (msgErr) console.error('  ❌ Supabase messages error:', msgErr.message);
        else console.log(`  ✓ Inserted ${supaMessages.length} messages into Supabase.`);

        // Payouts
        const supaPayouts = payouts.map(p => ({
            id: p.id,
            partnerId: p.partnerId,
            partnerEmail: p.partnerEmail,
            amount: p.amount,
            status: p.status,
            partnerUpiId: p.partnerUpiId,
            notes: p.notes,
            createdAt: p.createdAt
        }));
        const { error: payErr } = await client.from('payouts').insert(supaPayouts);
        if (payErr) console.error('  ❌ Supabase payouts error:', payErr.message);
        else console.log(`  ✓ Inserted ${supaPayouts.length} payouts into Supabase.`);

        // Wallet Transactions (Promo coin redemption logs)
        if (walletTransactions.length > 0) {
            const { error: wtErr } = await client.from('wallet_transactions').insert(walletTransactions);
            if (wtErr) console.error('  ❌ Supabase wallet_transactions error:', wtErr.message);
            else console.log(`  ✓ Inserted ${walletTransactions.length} wallet transactions into Supabase.`);
        }
    }

    console.log('\n============================================================');
    console.log('🎉 RESEED COMPLETED SUCCESSFULLY FOR OPTION B!');
    console.log('============================================================\n');
}

main().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
});
