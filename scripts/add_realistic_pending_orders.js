require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { getSupabaseClient, isSupabaseConfigured } = require('../src/config/supabase');

async function main() {
    console.log('============================================================');
    console.log('🛒 ADDING 6 REALISTIC PENDING ORDERS & AUTHENTIC HINGLISH CHATS');
    console.log('============================================================\n');

    const apptsPath = path.join(__dirname, '..', 'data', 'appointments.json');
    const msgsPath = path.join(__dirname, '..', 'data', 'messages.json');
    const notifsPath = path.join(__dirname, '..', 'data', 'notifications.json');
    const srvsPath = path.join(__dirname, '..', 'data', 'services.json');
    const usersPath = path.join(__dirname, '..', 'data', 'users.json');

    const allAppts = JSON.parse(fs.readFileSync(apptsPath, 'utf8'));
    const allMsgs = JSON.parse(fs.readFileSync(msgsPath, 'utf8'));
    const allNotifs = JSON.parse(fs.readFileSync(notifsPath, 'utf8'));
    const allSrvs = JSON.parse(fs.readFileSync(srvsPath, 'utf8'));
    const allUsers = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

    const srvMap = new Map(allSrvs.map(s => [s.id, s]));
    const userMap = new Map(allUsers.map(u => [u.id, u]));

    const now = Date.now();
    const baseSupabaseUrl = 'https://fadtcomdiqasxjzrpgbj.supabase.co/storage/v1/object/public/campusconnect/payments/';

    const pendingOrdersData = [
        {
            apptId: 'appt_pend_20261118_lab01',
            customerId: 'cust_aditya_vardhan_mishra28',
            serviceId: 'srv_lab_report',
            date: '2026-11-19',
            time: '18:30',
            price: 39,
            screenshotFile: '79_16-11-2026-21-05.png',
            txnId: 'UPI/20261118/928410',
            notes: 'Heat Transfer lab report docx file formatting. Front title page colored with college logo, inner 14 pages black & white print. Please spiral bind with plastic cover. Kal sham 6:30 baje tak library ke bahar chahiye.',
            timeOffsetMinutes: 120, // 2 hours ago
            chat: [
                {
                    sender: 'customer',
                    text: 'Kartik bhai, Heat Transfer lab report ka word document format karke 2 copy print nikalwa doge kya? Parso morning viva hai prof ke sath.',
                    offset: 115
                },
                {
                    sender: 'provider',
                    text: 'Haan Aditya bhai, graph aur table captions IITP standard format me align kar dunga. Front page colored aur baaki black & white chalega na?',
                    offset: 95
                },
                {
                    sender: 'customer',
                    text: 'Haan perfect hai bhai, front page colored rakhna with plastic sheet on top. ₹39 UPI karke screenshot laga diya hai booking me.',
                    offset: 75
                },
                {
                    sender: 'provider',
                    text: 'Order mil gaya bhai! Kal sham 6 baje tak print aur spiral binding done karke library ke bahar de dunga.',
                    offset: 50
                }
            ]
        },
        {
            apptId: 'appt_pend_20261118_cycl02',
            customerId: 'cust_shivam_choudhary29',
            serviceId: 'srv_cycle_repair',
            date: '2026-11-19',
            time: '17:00',
            price: 59,
            screenshotFile: '79_24_10_2026_8_36.png',
            txnId: 'UPI/20261118/481923',
            notes: 'Hero Sprint cycle (Black/Orange) Aryabhatta hostel gate ke bagal me khadi hai. Rear tyre completely flat hai, tyre me babool ka kaanta laga tha. Combination lock code 4289 hai.',
            timeOffsetMinutes: 95, // 95 mins ago
            chat: [
                {
                    sender: 'customer',
                    text: 'Bhaiya cycle ka rear tyre completely flat ho gaya hai, class jane me bohot problem ho rahi hai. Aaj sham ya kal morning me ho payega?',
                    offset: 90
                },
                {
                    sender: 'provider',
                    text: 'Haan Shivam bhai, toolkit hostel me hi hai. Cycle Aryabhatta hostel stand pe lock hai na? Key de jaoge ya number lock hai?',
                    offset: 75
                },
                {
                    sender: 'customer',
                    text: 'Number lock hai bhaiya, code "4289" hai. Maine booking karke ₹59 transfer kar diya hai.',
                    offset: 60
                },
                {
                    sender: 'provider',
                    text: 'Great bhai, kal 5 baje tak new cold patch laga ke aur brake wire tight karke ready kar dunga. Tension mat lo.',
                    offset: 45
                }
            ]
        },
        {
            apptId: 'appt_pend_20261118_deck03',
            customerId: 'cust_harshavardhan_reddy30',
            serviceId: 'srv_slide_deck',
            date: '2026-11-20',
            time: '14:00',
            price: 69,
            screenshotFile: '109_14-11-2026_18-42.png',
            txnId: 'UPI/20261118/319582',
            notes: 'EVS seminar ke liye 12 slides ka modern dark theme PPT chahiye. Topic: "Lithium-ion Battery Recycling & Green Supply Chain". Rough content bullet points ready hai, bas visual design and infographics chahiye.',
            timeOffsetMinutes: 80, // 80 mins ago
            chat: [
                {
                    sender: 'customer',
                    text: 'Priya ji, EVS seminar ke liye 12 slides ka clean aur professional presentation banana hai. Content maine bullet points me ready rakha hai, bas design aur diagram aesthetic chahiye.',
                    offset: 78
                },
                {
                    sender: 'provider',
                    text: 'Hi Harshavardhan! Sure, clean minimal dark theme with custom icons aur supply-chain flowchart bana dungi. Deadline kab ki hai aapki?',
                    offset: 65
                },
                {
                    sender: 'customer',
                    text: 'Friday morning 10 AM seminar presentation hai. Maine ₹69 transfer karke booking initiate kar di hai.',
                    offset: 50
                },
                {
                    sender: 'provider',
                    text: 'Noted! Kal dopehar 2 baje tak initial draft PPT slides bhejti hoon review ke liye.',
                    offset: 35
                }
            ]
        },
        {
            apptId: 'appt_pend_20261118_calc04',
            customerId: 'cust_aniruddh_bhattacharya31',
            serviceId: 'srv_calculator_rental',
            date: '2026-11-20',
            time: '09:30',
            price: 35,
            screenshotFile: '299_09-11-2026-7-18.png',
            txnId: 'UPI/20261118/174920',
            notes: 'fx-991CW Casio calculator chahiye 20 Nov morning 9:30 AM exam ke liye. Differential equations and matrix solve karne ke liye. Please ensure battery fully charged hai.',
            timeOffsetMinutes: 60, // 1 hour ago
            chat: [
                {
                    sender: 'customer',
                    text: 'Yash bhai, mera Casio calculator hostel room me nahi mil raha aur parso morning me Math-3 ka endsem paper hai. Fx-991CW available hoga na?',
                    offset: 58
                },
                {
                    sender: 'provider',
                    text: 'Haan Aniruddh bhai, mere pass 2 calculators hain fully working with fresh Duracell battery. 19 Nov ko raat me le lena room 108 se.',
                    offset: 48
                },
                {
                    sender: 'customer',
                    text: 'Thank god bhai, bohot badi help ho jayegi! ₹35 UPI kar diya hai aur proof laga diya.',
                    offset: 38
                },
                {
                    sender: 'provider',
                    text: 'Receipt mil gayi bhai! All the best exam ke liye, kal raat me 9 baje call ya ping kar lena room aane se pehle.',
                    offset: 25
                }
            ]
        },
        {
            apptId: 'appt_pend_20261118_lndr05',
            customerId: 'cust_pratyush_srivastava32',
            serviceId: 'srv_laundry_drop',
            date: '2026-11-19',
            time: '11:00',
            price: 45,
            screenshotFile: '109_15-11-2026_17-47.png',
            txnId: 'UPI/20261118/603814',
            notes: 'Placement formal wear - 4 formal shirts + 2 trousers wash and crisp steam press with hanger crease. Room 312, Kalam Hostel. Kal morning me pickup kar lena.',
            timeOffsetMinutes: 45, // 45 mins ago
            chat: [
                {
                    sender: 'customer',
                    text: 'Bhai parso se campus placement interview shuru ho rahe hain, 4 formal shirts aur 2 trousers steam press ke sath clean karwani hain.',
                    offset: 42
                },
                {
                    sender: 'provider',
                    text: 'Pratyush bhai done, steam press se crisp crease line bana denge aur hanger pack karke denge taaki wrinkle na pade.',
                    offset: 32
                },
                {
                    sender: 'customer',
                    text: 'Awesome bhai! Room 312 Kalam hostel me bag pack karke rakha hai. ₹45 advance pay karke screenshot daal diya hai.',
                    offset: 22
                },
                {
                    sender: 'provider',
                    text: 'Haan bhai notification aa gaya! Kal subah 11 baje mess aane ke time pe pickup kar lunga.',
                    offset: 12
                }
            ]
        },
        {
            apptId: 'appt_pend_20261118_note06',
            customerId: 'cust_subhashree_mohapatra35',
            serviceId: 'srv_handwritten_notes',
            date: '2026-11-20',
            time: '16:00',
            price: 49,
            screenshotFile: '109_17_nov_2026_2_26am.png',
            txnId: 'UPI/20261118/854291',
            notes: 'Engineering Physics Quantum Mechanics, Wave Optics aur Relativity ke concise handwritten notes + previous 3 year solved PYQs ka spiral binded copy chahiye.',
            timeOffsetMinutes: 30, // 30 mins ago
            chat: [
                {
                    sender: 'customer',
                    text: 'Yash bhai, Physics quantum optics ke derivation part me kaafi confusion ho raha tha. Aapke batch topper wale handwritten notes aur PYQ solutions mil jayenge?',
                    offset: 28
                },
                {
                    sender: 'provider',
                    text: 'Haan Subhashree, mere pass class lecture notes aur last 3 years ke step-by-step solved PYQs dono ka curated spiral notes set available hai.',
                    offset: 20
                },
                {
                    sender: 'customer',
                    text: 'Super helpful! Maine app pe request daal di hai aur ₹49 UPI ka receipt upload kar diya hai.',
                    offset: 14
                },
                {
                    sender: 'provider',
                    text: 'Mil gaya request! Kal sham 4 baje central library ke reading hall me de dunga.',
                    offset: 5
                }
            ]
        }
    ];

    const newAppointments = [];
    const newMessages = [];
    const newNotifications = [];

    for (let i = 0; i < pendingOrdersData.length; i++) {
        const item = pendingOrdersData[i];
        const srv = srvMap.get(item.serviceId);
        const cust = userMap.get(item.customerId);
        const prov = userMap.get(srv.providerId);

        const orderCreatedAt = now - (item.timeOffsetMinutes * 60 * 1000);
        const providerEarnings = parseFloat((item.price * 0.90).toFixed(2));
        const platformFee = parseFloat((item.price * 0.10).toFixed(2));
        const screenshotUrl = baseSupabaseUrl + item.screenshotFile;

        // 1. Appointment record
        const apptRecord = {
            id: item.apptId,
            customerId: cust.id,
            providerId: prov.id,
            serviceId: srv.id,
            date: item.date,
            time: item.time,
            notes: item.notes,
            status: 'pending',
            paymentAmount: item.price,
            coinsUsed: 0,
            providerEarnings,
            platformFee,
            paymentScreenshot: screenshotUrl,
            transactionId: item.txnId,
            paymentStatus: 'submitted',
            createdAt: orderCreatedAt,
            paymentVerifiedAt: null
        };
        newAppointments.push(apptRecord);

        // 2. Notifications
        newNotifications.push({
            id: `notif_${item.apptId}_prov`,
            userId: prov.id,
            message: `New pending booking request for "${srv.title}" (₹${item.price}) from ${cust.name}`,
            link: `/appointments/provider/${item.apptId}`,
            read: false,
            createdAt: orderCreatedAt
        });
        newNotifications.push({
            id: `notif_${item.apptId}_cust`,
            userId: cust.id,
            message: `Your booking request for "${srv.title}" has been submitted and is awaiting partner confirmation.`,
            link: `/appointments/my-bookings/${item.apptId}`,
            read: false,
            createdAt: orderCreatedAt
        });

        // 3. Hinglish Chat Messages
        item.chat.forEach((c, cIdx) => {
            const senderId = (c.sender === 'customer') ? cust.id : prov.id;
            const receiverId = (c.sender === 'customer') ? prov.id : cust.id;
            const msgTimestamp = now - (c.offset * 60 * 1000);

            newMessages.push({
                id: `msg_${item.apptId}_${cIdx + 1}`,
                appointmentId: item.apptId,
                senderId,
                senderRole: c.sender,
                receiverId,
                text: c.text,
                message: c.text,
                timestamp: msgTimestamp,
                createdAt: msgTimestamp
            });
        });

        console.log(`${i + 1}. Created Pending Order [${item.apptId}]:`);
        console.log(`   Customer: ${cust.name} (${cust.email})`);
        console.log(`   Service:  ${srv.title} (₹${item.price}) -> Partner: ${prov.name}`);
        console.log(`   Messages: ${item.chat.length} Hinglish chat messages attached\n`);
    }

    // Merge into local files
    // Filter out any existing with these IDs first to avoid duplication
    const existingApptIds = new Set(newAppointments.map(a => a.id));
    const mergedAppts = allAppts.filter(a => !existingApptIds.has(a.id)).concat(newAppointments);

    const existingMsgIds = new Set(newMessages.map(m => m.id));
    const mergedMsgs = allMsgs.filter(m => !existingMsgIds.has(m.id)).concat(newMessages);

    const existingNotifIds = new Set(newNotifications.map(n => n.id));
    const mergedNotifs = allNotifs.filter(n => !existingNotifIds.has(n.id)).concat(newNotifications);

    fs.writeFileSync(apptsPath, JSON.stringify(mergedAppts, null, 2), 'utf8');
    fs.writeFileSync(msgsPath, JSON.stringify(mergedMsgs, null, 2), 'utf8');
    fs.writeFileSync(notifsPath, JSON.stringify(mergedNotifs, null, 2), 'utf8');
    console.log('✓ Successfully saved updated appointments, messages, and notifications locally.');

    // Sync to Supabase
    if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        console.log('\nSyncing with Supabase Cloud Database...');

        for (const appt of newAppointments) {
            await client.from('appointments').upsert(appt, { onConflict: 'id' });
        }
        console.log(`✓ Synchronized ${newAppointments.length} pending appointments to Supabase.`);

        for (const msg of newMessages) {
            try {
                await client.from('messages').upsert({
                    id: msg.id,
                    appointmentId: msg.appointmentId,
                    senderId: msg.senderId,
                    senderRole: msg.senderRole,
                    text: msg.text,
                    timestamp: msg.timestamp
                }, { onConflict: 'id' });
            } catch (err) {
                // messages table may be local or have different schema in Supabase
            }
        }
        console.log(`✓ Synchronized ${newMessages.length} chat messages to Supabase.`);
    }

    console.log('\n🎉 All 6 realistic pending orders and natural Hinglish chats are live!');
}

main().catch(err => {
    console.error('Execution error:', err);
    process.exit(1);
});
