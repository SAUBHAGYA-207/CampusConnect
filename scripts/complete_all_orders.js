require('dotenv').config();
const JsonStorage = require('../src/storage/jsonStorage');
const appointmentsStorage = new JsonStorage('appointments');
const usersStorage = new JsonStorage('users');
const servicesStorage = new JsonStorage('services');
const { createNotification } = require('../src/services/notificationService');
const { sendStatusEmail, sendServiceCompletedFeedbackEmail } = require('../src/services/emailService');

async function completeAllOrders() {
    console.log('Fetching all appointments...');
    const allAppointments = await appointmentsStorage.getAll();
    const users = await usersStorage.getAll();
    const services = await servicesStorage.getAll();

    const userMap = new Map(users.map(u => [u.id, u]));
    const serviceMap = new Map(services.map(s => [s.id, s]));

    console.log(`Total appointments found: ${allAppointments.length}`);

    let completedCount = 0;
    let alreadyCompletedCount = 0;

    for (const app of allAppointments) {
        if (app.status === 'completed' && app.paymentStatus === 'verified') {
            alreadyCompletedCount++;
            continue;
        }

        const customer = userMap.get(app.customerId);
        const provider = userMap.get(app.providerId);
        const service = serviceMap.get(app.serviceId);

        const serviceTitle = service ? service.title : 'Campus Service';
        const customerName = customer ? (customer.name || customer.email.split('@')[0]) : 'Student';
        const partnerName = provider ? (provider.name || provider.email.split('@')[0]) : 'Partner';

        const now = Date.now();
        const updates = {
            status: 'completed',
            paymentStatus: 'verified',
            paymentVerifiedAt: app.paymentVerifiedAt || now
        };

        // If coins were used but not saved in coinsUsed field, extract from notes
        if (app.coinsUsed === undefined || app.coinsUsed === null) {
            if (app.notes && typeof app.notes === 'string') {
                const matchCoins = app.notes.match(/🪙\s*(\d+)\s*Coins\s*Redeemed/i) || app.notes.match(/(\d+)\s*Coins\s*Redeemed/i);
                if (matchCoins && matchCoins[1]) {
                    updates.coinsUsed = Number(matchCoins[1]);
                }
            }
        }

        console.log(`\nCompleting order [${app.id}] - ${serviceTitle}:`);
        console.log(`  Customer: ${customer ? customer.email : app.customerId}`);
        console.log(`  Provider: ${provider ? provider.email : app.providerId}`);
        console.log(`  Previous status: ${app.status} | paymentStatus: ${app.paymentStatus}`);

        // Update storage (both Supabase and local JSON)
        await appointmentsStorage.update(app.id, updates);

        // Notifications
        try {
            if (app.customerId) {
                await createNotification(
                    app.customerId,
                    `Appointment status updated to completed`,
                    `/appointments/my-bookings/${app.id}`
                );
                await createNotification(
                    app.customerId,
                    `⭐ How was your service with ${partnerName}? Click to leave your review and feedback!`,
                    `/appointments/my-bookings/${app.id}#feedback-card`
                );
            }
            if (app.providerId) {
                await createNotification(
                    app.providerId,
                    `Appointment status updated to completed`,
                    `/appointments/provider/${app.id}`
                );
            }
        } catch (notifErr) {
            console.warn(`  Notification warning for [${app.id}]:`, notifErr.message);
        }

        // Email notifications (non-blocking)
        try {
            if (customer && customer.email) {
                await sendServiceCompletedFeedbackEmail(
                    customer.email,
                    customerName,
                    serviceTitle,
                    partnerName,
                    app.id
                );
            }
        } catch (emailErr) {
            console.warn(`  Email notice warning for [${app.id}]:`, emailErr.message);
        }

        completedCount++;
        console.log(`  ✓ Order [${app.id}] marked as completed.`);
    }

    console.log('\n============================================================');
    console.log(`Summary:`);
    console.log(`  Total appointments:     ${allAppointments.length}`);
    console.log(`  Newly completed orders: ${completedCount}`);
    console.log(`  Already completed:      ${alreadyCompletedCount}`);
    console.log('============================================================\n');
}

completeAllOrders()
    .then(() => {
        console.log('Script execution completed successfully.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Fatal error during execution:', err);
        process.exit(1);
    });
