const bcrypt = require('bcryptjs');
const path = require('path');
const JsonStorage = require('../storage/jsonStorage');
const chatService = require('./chatService');
const serviceService = require('./serviceService');
const appointmentService = require('./appointmentService');
const notificationService = require('./notificationService');

const usersStorage = new JsonStorage('users');
const servicesStorage = new JsonStorage('services');
const appointmentsStorage = new JsonStorage('appointments');
const messagesStorage = new JsonStorage('messages');

const BASELINE_DATE_STRING = '2026-10-20';
const BASELINE_TIMESTAMP = new Date('2026-10-20T10:00:00.000Z').getTime(); // 1792490400000

/**
 * Checks if a user is a simulated/dummy account
 */
function isSimulatedUser(user) {
    if (!user) return false;
    if (user.otp === 'SIMULATED' || user.otp === 'SIMULATED_PERSONA') return true;
    if (user.isSimulated === true) return true;
    return false;
}

/**
 * Get summary stats for the simulation dashboard
 */
async function getSimulationStats() {
    const [allUsers, allServices, allAppointments] = await Promise.all([
        usersStorage.getAll(),
        servicesStorage.getAll(),
        appointmentsStorage.getAll()
    ]);

    const simUsers = allUsers.filter(isSimulatedUser);
    const simUserIds = new Set(simUsers.map(u => u.id));

    const simPartners = simUsers.filter(u => u.role === 'provider');
    const simCustomers = simUsers.filter(u => u.role === 'customer');

    const simServices = allServices.filter(s => simUserIds.has(s.providerId));
    const simAppointments = allAppointments.filter(a => simUserIds.has(a.customerId) || simUserIds.has(a.providerId));

    const totalSimVolume = simAppointments.reduce((sum, a) => sum + (Number(a.paymentAmount) || 0), 0);

    return {
        totalSimulatedUsers: simUsers.length,
        simulatedPartnersCount: simPartners.length,
        simulatedCustomersCount: simCustomers.length,
        simulatedServicesCount: simServices.length,
        simulatedBookingsCount: simAppointments.length,
        totalSimulatedVolume: totalSimVolume.toFixed(2),
        baselineDate: BASELINE_DATE_STRING
    };
}

/**
 * Get all simulated personas with enriched statistics
 */
async function getSimulatedUsers() {
    const [allUsers, allServices, allAppointments] = await Promise.all([
        usersStorage.getAll(),
        servicesStorage.getAll(),
        appointmentsStorage.getAll()
    ]);

    const simUsers = allUsers.filter(isSimulatedUser);

    return simUsers.map(user => {
        const servicesCount = allServices.filter(s => s.providerId === user.id).length;
        const bookingsCount = allAppointments.filter(a => a.customerId === user.id || a.providerId === user.id).length;
        
        let displayName = user.name || (user.email ? user.email.split('@')[0] : 'User');
        displayName = displayName.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        return {
            ...user,
            displayName,
            servicesCount,
            bookingsCount
        };
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Create a new simulated/dummy persona
 */
async function createSimulatedUser(data) {
    const { name, email, role, password, partnerUpiId, partnerQrImage, customDate } = data;

    if (!email || !email.trim()) {
        throw new Error('Email is required for the dummy account.');
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await usersStorage.find(u => u.email === cleanEmail);
    if (existing) {
        throw new Error(`An account with email '${cleanEmail}' already exists.`);
    }

    const saltRounds = 10;
    const plainPassword = password || 'campus123';
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

    let createdAt;
    if (customDate) {
        createdAt = new Date(customDate).getTime();
    } else {
        // Offset randomly by 0 to 48 hours from baseline
        createdAt = BASELINE_TIMESTAMP + Math.floor(Math.random() * 48 * 3600 * 1000);
    }

    const newUser = await usersStorage.add({
        email: cleanEmail,
        password: hashedPassword,
        role: role === 'provider' ? 'provider' : 'customer',
        isVerified: true,
        otp: 'SIMULATED', // Mark as simulated
        otpExpires: null,
        partnerUpiId: partnerUpiId || (role === 'provider' ? `${cleanEmail.split('@')[0]}@upi` : null),
        partnerQrImage: partnerQrImage || null,
        createdAt
    });

    return newUser;
}

/**
 * Delete a simulated persona and clean up associated items
 */
async function deleteSimulatedUser(userId) {
    const user = await usersStorage.getById(userId);
    if (!user) throw new Error('User not found.');

    // Delete user's services
    const allServices = await servicesStorage.getAll();
    const userServices = allServices.filter(s => s.providerId === userId);
    for (const s of userServices) {
        await servicesStorage.delete(s.id);
    }

    // Delete user's appointments and their messages
    const allAppointments = await appointmentsStorage.getAll();
    const userAppointments = allAppointments.filter(a => a.customerId === userId || a.providerId === userId);
    for (const a of userAppointments) {
        const msgs = await chatService.getMessagesForAppointment(a.id);
        for (const m of msgs) {
            await messagesStorage.delete(m.id);
        }
        await appointmentsStorage.delete(a.id);
    }

    await usersStorage.delete(userId);
    return true;
}

/**
 * List all simulated services
 */
async function getSimulatedServices() {
    const [allServices, allUsers] = await Promise.all([
        servicesStorage.getAll(),
        usersStorage.getAll()
    ]);

    const simUserMap = new Map();
    allUsers.filter(isSimulatedUser).forEach(u => simUserMap.set(u.id, u));

    return allServices
        .filter(s => simUserMap.has(s.providerId))
        .map(s => {
            const provider = simUserMap.get(s.providerId);
            return {
                ...serviceService.normalizeService ? serviceService.normalizeService(s) : s,
                providerEmail: provider ? provider.email : 'Unknown'
            };
        })
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Create a new service under a dummy partner
 */
async function createSimulatedService(data) {
    const { providerId, title, description, price, category, image, images, customDate } = data;

    if (!providerId) throw new Error('Provider ID is required');
    if (!title || !title.trim()) throw new Error('Service title is required');

    let createdAt;
    if (customDate) {
        createdAt = new Date(customDate).getTime();
    } else {
        // Default to Oct 20, 2026 + random offset
        createdAt = BASELINE_TIMESTAMP + Math.floor(Math.random() * 24 * 3600 * 1000);
    }

    const serviceData = {
        title: title.trim(),
        description: description ? description.trim() : '',
        price: parseFloat(price) || 0,
        category: category || 'Academics',
        image: image || null,
        images: images || (image ? [image] : []),
        createdAt
    };

    return await serviceService.createService(providerId, serviceData);
}

/**
 * List all simulated appointments
 */
async function getSimulatedAppointments() {
    const [allAppointments, allUsers, allServices] = await Promise.all([
        appointmentsStorage.getAll(),
        usersStorage.getAll(),
        servicesStorage.getAll()
    ]);

    const userMap = new Map(allUsers.map(u => [u.id, u]));
    const serviceMap = new Map(allServices.map(s => [s.id, s]));

    const simUserIds = new Set(allUsers.filter(isSimulatedUser).map(u => u.id));

    return allAppointments
        .filter(a => simUserIds.has(a.customerId) || simUserIds.has(a.providerId))
        .map(a => {
            const customer = userMap.get(a.customerId);
            const provider = userMap.get(a.providerId);
            const service = serviceMap.get(a.serviceId);

            return {
                ...a,
                customerEmail: customer ? customer.email : 'Unknown',
                providerEmail: provider ? provider.email : 'Unknown',
                serviceTitle: service ? service.title : 'Service Listing'
            };
        })
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/**
 * Create a simulated booking between accounts
 */
async function createSimulatedAppointment(data) {
    const { customerId, providerId, serviceId, date, time, notes, status, paymentStatus, transactionId, paymentScreenshot, customDate } = data;

    if (!customerId) throw new Error('Customer ID is required');
    if (!serviceId) throw new Error('Service ID is required');

    const service = await servicesStorage.getById(serviceId);
    if (!service) throw new Error('Service not found');

    const effectiveProviderId = providerId || service.providerId;

    let createdAt;
    if (customDate) {
        createdAt = new Date(customDate).getTime();
    } else if (date) {
        createdAt = new Date(date + (time ? 'T' + time : 'T12:00:00')).getTime();
    } else {
        createdAt = BASELINE_TIMESTAMP + (2 * 24 * 3600 * 1000); // Oct 22, 2026
    }

    const price = Number(service.price) || 0;
    const providerEarnings = parseFloat((price * 0.90).toFixed(2));
    const platformFee = parseFloat((price * 0.10).toFixed(2));

    const appt = await appointmentsStorage.add({
        customerId,
        providerId: effectiveProviderId,
        serviceId,
        date: date || '2026-10-22',
        time: time || '14:00',
        notes: notes || 'Simulated booking from master console',
        status: status || 'accepted',
        paymentAmount: price,
        providerEarnings,
        platformFee,
        paymentScreenshot: paymentScreenshot || null,
        transactionId: transactionId || `UPI/CC/${Date.now().toString().slice(-6)}`,
        paymentStatus: paymentStatus || 'verified',
        createdAt,
        paymentVerifiedAt: (paymentStatus === 'verified') ? createdAt : null
    });

    return appt;
}

/**
 * Get all chat rooms for simulated accounts with live conversation details
 */
async function getAllSimulatedChatRooms() {
    const [allAppointments, allUsers, allServices, allMessages] = await Promise.all([
        appointmentsStorage.getAll(),
        usersStorage.getAll(),
        servicesStorage.getAll(),
        messagesStorage.getAll()
    ]);

    const userMap = new Map(allUsers.map(u => [u.id, u]));
    const serviceMap = new Map(allServices.map(s => [s.id, s]));
    const simUserIds = new Set(allUsers.filter(isSimulatedUser).map(u => u.id));

    // Filter appointments involving simulated users (or include all appointments for master supervision)
    const relevantAppointments = allAppointments.filter(a => 
        simUserIds.has(a.customerId) || simUserIds.has(a.providerId)
    );

    const rooms = relevantAppointments.map(app => {
        const customer = userMap.get(app.customerId) || { id: app.customerId, email: 'Customer' };
        const provider = userMap.get(app.providerId) || { id: app.providerId, email: 'Partner' };
        const service = serviceMap.get(app.serviceId) || { title: 'Booked Service' };

        const appMsgs = allMessages
            .filter(m => m.appointmentId === app.id)
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        const lastMsg = appMsgs.length > 0 ? appMsgs[appMsgs.length - 1] : null;

        return {
            appointmentId: app.id,
            status: app.status,
            paymentStatus: app.paymentStatus,
            date: app.date,
            time: app.time,
            serviceTitle: service.title,
            customer: {
                id: customer.id,
                email: customer.email,
                name: customer.email.split('@')[0]
            },
            provider: {
                id: provider.id,
                email: provider.email,
                name: provider.email.split('@')[0]
            },
            messagesCount: appMsgs.length,
            lastMessage: lastMsg ? lastMsg.text.replace(/\[IMAGE\].*?\[\/IMAGE\]/g, '📷 Photo').replace(/\[STATUS:\w+\]/g, '').trim() : 'No messages yet',
            lastMessageTimestamp: lastMsg ? lastMsg.timestamp : app.createdAt
        };
    });

    return rooms.sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0));
}

/**
 * Send a chat message on behalf of either the dummy Customer or dummy Partner
 */
async function sendSimulatedMessage({ appointmentId, senderId, senderRole, text, imageUrl, status = 'read', customTimestamp = null }) {
    if (!appointmentId) throw new Error('Appointment ID is required');
    if (!senderId) throw new Error('Sender ID is required');

    const app = await appointmentsStorage.getById(appointmentId);
    if (!app) throw new Error('Appointment not found');

    const effectiveRole = senderRole || (senderId === app.customerId ? 'customer' : 'provider');
    const effectiveStatus = status || 'read';

    const timestamp = customTimestamp ? Number(customTimestamp) : Date.now();

    const savedMsg = await chatService.saveMessage(
        appointmentId,
        senderId,
        effectiveRole,
        text || '',
        imageUrl || null,
        effectiveStatus,
        timestamp
    );

    // Broadcast in real-time via Socket.IO if available
    try {
        const io = notificationService.getIO();
        if (io) {
            io.to(`appt_${appointmentId}`).emit('new_message', savedMsg);
            if (effectiveStatus === 'read') {
                io.to(`appt_${appointmentId}`).emit('messages_read', { appointmentId, readerId: senderId });
            }
        }
    } catch (err) {
        console.warn('Socket broadcast warning:', err.message);
    }

    return savedMsg;
}

/**
 * Shift/Align all dummy metadata to start from October 20, 2026 onwards
 */
async function shiftAllMetadataToBaseline(newBaselineDateStr = '2026-10-20') {
    const baseTime = new Date(`${newBaselineDateStr}T09:00:00.000Z`).getTime();
    let currentOffset = 0;

    const [allUsers, allServices, allAppointments, allMessages] = await Promise.all([
        usersStorage.getAll(),
        servicesStorage.getAll(),
        appointmentsStorage.getAll(),
        messagesStorage.getAll()
    ]);

    const simUsers = allUsers.filter(isSimulatedUser);
    const simUserIds = new Set(simUsers.map(u => u.id));

    // 1. Shift Users
    for (const user of simUsers) {
        currentOffset += 30 * 60 * 1000; // +30 mins
        await usersStorage.update(user.id, {
            createdAt: baseTime + currentOffset
        });
    }

    // 2. Shift Services
    const simServices = allServices.filter(s => simUserIds.has(s.providerId));
    for (const service of simServices) {
        currentOffset += 45 * 60 * 1000; // +45 mins
        await servicesStorage.update(service.id, {
            createdAt: baseTime + currentOffset
        });
    }

    // 3. Shift Appointments & Dates
    const simAppointments = allAppointments.filter(a => simUserIds.has(a.customerId) || simUserIds.has(a.providerId));
    let dayOffset = 1;
    for (const app of simAppointments) {
        const appDate = new Date(baseTime + (dayOffset * 24 * 3600 * 1000));
        const dateStr = appDate.toISOString().split('T')[0];
        const appCreatedAt = baseTime + (dayOffset * 24 * 3600 * 1000) - (2 * 3600 * 1000); // 2 hours before

        await appointmentsStorage.update(app.id, {
            date: dateStr,
            createdAt: appCreatedAt,
            paymentVerifiedAt: appCreatedAt + (15 * 60 * 1000)
        });

        // 4. Shift Chat Messages for this appointment
        const appMsgs = allMessages.filter(m => m.appointmentId === app.id).sort((a, b) => a.timestamp - b.timestamp);
        let msgTime = appCreatedAt + (30 * 60 * 1000); // start 30m after booking
        for (const msg of appMsgs) {
            msgTime += Math.floor(Math.random() * 5 + 2) * 60 * 1000; // +2 to 7 mins
            await messagesStorage.update(msg.id, {
                timestamp: msgTime
            });
        }

        dayOffset++;
    }

    return {
        success: true,
        shiftedUsers: simUsers.length,
        shiftedServices: simServices.length,
        shiftedAppointments: simAppointments.length,
        newBaselineDate: newBaselineDateStr
    };
}

/**
 * 1-Click Preset Seeder: Seeds realistic IIT campus personas, services, bookings, and chats
 */
async function seedCampusPresets() {
    const saltRounds = 10;
    const defaultPassword = await bcrypt.hash('campus123', saltRounds);

    const presetPersonas = [
        {
            email: 'rohan.sharma.iitp@gmail.com',
            name: 'Rohan Sharma',
            role: 'provider',
            partnerUpiId: 'rohansharma.iitp@okhdfcbank',
            partnerQrImage: '/images/banners/banner-tech.jpg',
            timeOffsetHours: 2,
            services: [
                {
                    title: 'C++ & DSA Guidance & Interview Prep',
                    description: 'One-on-one session on Data Structures and Algorithms in C++. Problem solving on LeetCode/Codeforces, tree/graph algorithms, and placement interview strategies.',
                    price: 350,
                    category: 'Tech & Coding',
                    image: '/images/banners/banner-tech.jpg'
                }
            ]
        },
        {
            email: 'priya.verma.design@gmail.com',
            name: 'Priya Verma',
            role: 'provider',
            partnerUpiId: 'priyaverma@okaxis',
            partnerQrImage: '/images/banners/banner-arts.jpg',
            timeOffsetHours: 4,
            services: [
                {
                    title: 'Fest Posters, UI/UX Mockups & Resume Polish',
                    description: 'Custom aesthetic poster designs for campus clubs, societies, and department events. Also offering LaTeX and Figma resume styling for internship season.',
                    price: 250,
                    category: 'Design & Media',
                    image: '/images/banners/banner-arts.jpg'
                }
            ]
        },
        {
            email: 'aman.gupta.mech@gmail.com',
            name: 'Aman Gupta',
            role: 'customer',
            timeOffsetHours: 6
        },
        {
            email: 'sneha.patel.cse@gmail.com',
            name: 'Sneha Patel',
            role: 'customer',
            timeOffsetHours: 8
        }
    ];

    const createdUsers = [];
    const createdServices = [];

    for (const p of presetPersonas) {
        let user = await usersStorage.find(u => u.email === p.email);
        if (!user) {
            const createdAt = BASELINE_TIMESTAMP + (p.timeOffsetHours * 3600 * 1000);
            user = await usersStorage.add({
                email: p.email,
                password: defaultPassword,
                role: p.role,
                isVerified: true,
                otp: 'SIMULATED',
                otpExpires: null,
                partnerUpiId: p.partnerUpiId || null,
                partnerQrImage: p.partnerQrImage || null,
                createdAt
            });
        }
        createdUsers.push(user);

        if (p.services && p.services.length > 0) {
            for (const s of p.services) {
                const existingSvc = await servicesStorage.find(item => item.providerId === user.id && item.title === s.title);
                if (!existingSvc) {
                    const svc = await serviceService.createService(user.id, {
                        ...s,
                        createdAt: user.createdAt + (2 * 3600 * 1000)
                    });
                    createdServices.push(svc);
                } else {
                    createdServices.push(existingSvc);
                }
            }
        }
    }

    // Create realistic preset appointments and chats
    const rohan = createdUsers.find(u => u.email === 'rohan.sharma.iitp@gmail.com');
    const priya = createdUsers.find(u => u.email === 'priya.verma.design@gmail.com');
    const aman = createdUsers.find(u => u.email === 'aman.gupta.mech@gmail.com');
    const sneha = createdUsers.find(u => u.email === 'sneha.patel.cse@gmail.com');

    const codingSvc = createdServices.find(s => s.providerId === rohan?.id);
    const designSvc = createdServices.find(s => s.providerId === priya?.id);

    // Appointment 1: Aman bookings Rohan's coding class
    if (rohan && aman && codingSvc) {
        const existingApp = await appointmentsStorage.find(a => a.customerId === aman.id && a.serviceId === codingSvc.id);
        if (!existingApp) {
            const appTime = BASELINE_TIMESTAMP + (24 * 3600 * 1000); // Oct 21, 2026
            const app = await createSimulatedAppointment({
                customerId: aman.id,
                providerId: rohan.id,
                serviceId: codingSvc.id,
                date: '2026-10-21',
                time: '16:00',
                notes: 'Need urgent help with dynamic programming (knapsack and grid DP) for upcoming company coding round.',
                status: 'accepted',
                paymentStatus: 'verified',
                transactionId: 'UPI/20261020/987123',
                customDate: appTime
            });

            // Seed realistic chat history starting from Oct 20, 2026
            await chatService.saveMessage(app.id, aman.id, 'customer', 'Hi Rohan, I booked your DSA guidance slot for tomorrow 4 PM. Are you free to cover DP?', null, 'read', appTime + (10 * 60 * 1000));
            await chatService.saveMessage(app.id, rohan.id, 'provider', 'Hey Aman! Yes, absolutely. We will start with 0/1 knapsack and then transition into tree DP. Have you solved LeetCode 322?', null, 'read', appTime + (25 * 60 * 1000));
            await chatService.saveMessage(app.id, aman.id, 'customer', 'Yes, solved Coin Change but got stuck on state transition optimizations.', null, 'read', appTime + (32 * 60 * 1000));
            await chatService.saveMessage(app.id, rohan.id, 'provider', 'Perfect, I will prepare 4 focused problems and we will walk through the recursion trees together. See you on Google Meet!', null, 'read', appTime + (45 * 60 * 1000));
        }
    }

    // Appointment 2: Sneha bookings Priya's design service
    if (priya && sneha && designSvc) {
        const existingApp = await appointmentsStorage.find(a => a.customerId === sneha.id && a.serviceId === designSvc.id);
        if (!existingApp) {
            const appTime = BASELINE_TIMESTAMP + (48 * 3600 * 1000); // Oct 22, 2026
            const app = await createSimulatedAppointment({
                customerId: sneha.id,
                providerId: priya.id,
                serviceId: designSvc.id,
                date: '2026-10-22',
                time: '18:30',
                notes: 'Need a tech fest poster for Robotics Club workshop.',
                status: 'completed',
                paymentStatus: 'verified',
                transactionId: 'UPI/20261021/874512',
                customDate: appTime
            });

            // Seed realistic chat history
            await chatService.saveMessage(app.id, sneha.id, 'customer', 'Hello Priya! Sent over the booking for Robotics Club poster. We need a dark cyberpunk theme.', null, 'read', appTime + (15 * 60 * 1000));
            await chatService.saveMessage(app.id, priya.id, 'provider', 'Hey Sneha! Got the booking and payment. Do you have the club logo and sponsor logos in PNG format?', null, 'read', appTime + (35 * 60 * 1000));
            await chatService.saveMessage(app.id, sneha.id, 'customer', 'Yes! Sending the drive link right now.', null, 'read', appTime + (42 * 60 * 1000));
            await chatService.saveMessage(app.id, priya.id, 'provider', 'Received! I will share the first draft by tomorrow noon.', null, 'read', appTime + (50 * 60 * 1000));
        }
    }

    return {
        success: true,
        message: 'Campus simulation presets successfully seeded starting from 20 October 2026!'
    };
}

module.exports = {
    BASELINE_DATE_STRING,
    BASELINE_TIMESTAMP,
    isSimulatedUser,
    getSimulationStats,
    getSimulatedUsers,
    createSimulatedUser,
    deleteSimulatedUser,
    getSimulatedServices,
    createSimulatedService,
    getSimulatedAppointments,
    createSimulatedAppointment,
    getAllSimulatedChatRooms,
    sendSimulatedMessage,
    shiftAllMetadataToBaseline,
    seedCampusPresets
};
