const request = require('supertest');
const app = require('../app');
const JsonStorage = require('../src/storage/jsonStorage');
const bcrypt = require('bcryptjs');

describe('Super Admin Portal, Revenue, Moderation & Payout Settlements', () => {
    jest.setTimeout(30000);
    let adminAgent;
    let partnerAgent;
    let partnerId;
    let testServiceId;
    const usersStorage = new JsonStorage('users');
    const servicesStorage = new JsonStorage('services');
    const payoutsStorage = new JsonStorage('payouts');
    const appointmentsStorage = new JsonStorage('appointments');

    const adminEmail = 'admin@campusconnect.com';
    const partnerEmail = 'testpartner_' + Date.now() + '@campusconnect.local';

    beforeAll(async () => {
        adminAgent = request.agent(app);
        partnerAgent = request.agent(app);

        // Ensure admin user has known password
        let adminUser = await usersStorage.find(u => u.email === adminEmail);
        const hashedPassword = await bcrypt.hash('admin123', 10);
        if (!adminUser) {
            adminUser = await usersStorage.add({
                email: adminEmail,
                password: hashedPassword,
                role: 'admin',
                isVerified: true
            });
        } else {
            await usersStorage.update(adminUser.id, { password: hashedPassword, role: 'admin' });
        }

        // Create partner user
        const partnerUser = await usersStorage.add({
            email: partnerEmail,
            password: hashedPassword,
            role: 'provider',
            isVerified: true,
            partnerUpiId: 'partner@okicici',
            partnerQrImage: '/uploads/partner-qr/test-partner-qr.png'
        });
        partnerId = partnerUser.id;

        // Create a test service for this partner
        const service = await servicesStorage.add({
            providerId: partnerId,
            title: 'Guitar Lessons Pro',
            description: 'Acoustic and electric guitar masterclass',
            price: 2000,
            category: 'Arts',
            status: 'published'
        });
        testServiceId = service.id;

        // Create a completed appointment so the partner has realized earnings
        await appointmentsStorage.add({
            providerId: partnerId,
            customerId: 'cust_test_123',
            serviceId: testServiceId,
            paymentAmount: 2000,
            providerEarnings: 1800, // 90%
            platformFee: 200, // 10%
            paymentStatus: 'verified',
            status: 'completed',
            date: '2026-11-25',
            time: '16:00'
        });
    });

    afterAll(async () => {
        if (testServiceId) {
            await servicesStorage.delete(testServiceId).catch(() => {});
        }
        if (partnerId) {
            await usersStorage.delete(partnerId).catch(() => {});
        }
    });

    it('should load dedicated super admin login page at /admin/login', async () => {
        const res = await request(app).get('/admin/login');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Super Admin Portal');
        expect(res.text).toContain('Super Admin Email');
        expect(res.text).toContain('Authenticate Super Admin');
        expect(res.text).toContain('/admin/register');
    });

    it('should load dedicated super admin register page at /admin/register', async () => {
        const res = await request(app).get('/admin/register');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Super Admin Registration');
        expect(res.text).toContain('Authorized Super Admin Email');
        expect(res.text).toContain('Register & Send 2FA Code');
    });

    it('should reject admin registration if email is NOT in SUPERADMIN_EMAILS whitelist', async () => {
        const res = await request(app)
            .post('/admin/register')
            .send({
                email: 'unauthorized_admin_' + Date.now() + '@example.com',
                password: 'MasterPassword123!',
                confirmPassword: 'MasterPassword123!'
            });
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Access Denied');
    });

    it('should allow registration for whitelisted admin email and redirect to /admin/verify-otp', async () => {
        const testNewAdminEmail = 'whitelisted_admin_' + Date.now() + '@campusconnect.local';
        const origEnv = process.env.SUPERADMIN_EMAILS || '';
        process.env.SUPERADMIN_EMAILS = origEnv ? `${origEnv},${testNewAdminEmail}` : testNewAdminEmail;

        const regRes = await request(app)
            .post('/admin/register')
            .send({
                email: testNewAdminEmail,
                password: 'SecureAdminPass123!',
                confirmPassword: 'SecureAdminPass123!'
            });

        expect(regRes.statusCode).toEqual(302);
        expect(regRes.headers.location).toContain('/admin/verify-otp');

        // Verify record created in storage
        const createdAdmin = await usersStorage.find(u => u.email === testNewAdminEmail);
        expect(createdAdmin).toBeDefined();
        expect(createdAdmin.role).toEqual('admin');
        expect(createdAdmin.otp).toBeDefined();

        // Cleanup
        await usersStorage.delete(createdAdmin.id);
        process.env.SUPERADMIN_EMAILS = origEnv;
    });

    it('should reject Super Admin login if email is NOT in SUPERADMIN_EMAILS whitelist', async () => {
        const unauthAgent = request.agent(app);
        const res = await unauthAgent
            .post('/admin/login')
            .send({ email: 'unauthorized_stranger@example.com', password: 'Password123!' });

        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Access Denied');
    });

    it('should authenticate super admin, send OTP, verify OTP, and redirect to /admin/dashboard', async () => {
        const loginRes = await adminAgent
            .post('/admin/login')
            .send({ email: adminEmail, password: 'admin123' });

        expect(loginRes.statusCode).toEqual(302);
        expect(loginRes.headers.location).toContain('/admin/verify-otp');

        // Check that OTP page loads
        const verifyPageRes = await adminAgent.get('/admin/verify-otp');
        expect(verifyPageRes.statusCode).toEqual(200);
        expect(verifyPageRes.text).toContain('Verify Admin Identity');

        // Retrieve generated OTP from users storage
        const adminUserRecord = await usersStorage.find(u => u.email === adminEmail);
        expect(adminUserRecord.otp).toBeDefined();

        // Post OTP
        const otpRes = await adminAgent
            .post('/admin/verify-otp')
            .send({ otp: adminUserRecord.otp });

        expect(otpRes.statusCode).toEqual(302);
        expect(otpRes.headers.location).toEqual('/admin/dashboard');

        // Follow redirect to dashboard
        const dashRes = await adminAgent.get('/admin/dashboard');
        expect(dashRes.statusCode).toEqual(200);
        expect(dashRes.text).toContain('Executive Dashboard & Revenue Center');
        expect(dashRes.text).toContain('Platform Revenue');
        expect(dashRes.text).toContain('Partner Net Earnings');
        expect(dashRes.text).not.toContain('<nav class="navbar navbar-expand-lg">');
        expect(dashRes.text).toContain('Guitar Lessons Pro');
    });

    it('should allow Super Admin to remove a service with custom feedback email dispatch', async () => {
        const removeRes = await adminAgent
            .post(`/admin/services/${testServiceId}/remove`)
            .send({ feedback: 'Listing violates campus event guidelines. Please revise description.' });

        expect(removeRes.statusCode).toEqual(302);

        // Verify service is deleted from storage
        const deleted = await servicesStorage.getById(testServiceId);
        expect(deleted).toBeFalsy();
    });

    it('should allow partner to request payout, and Super Admin to clear it with proof and UTR', async () => {
        // Partner logs in
        await partnerAgent
            .post('/auth/login')
            .send({ email: partnerEmail, password: 'admin123' });

        // Partner requests payout of ₹1000
        const payoutReqRes = await partnerAgent
            .post('/services/request-payout')
            .send({ amount: '1000', notes: 'First partial withdrawal' });

        expect(payoutReqRes.statusCode).toEqual(302);

        // Check payouts storage
        const allPayouts = await payoutsStorage.getAll();
        const pendingPayout = allPayouts.find(p => p.partnerId === partnerId && p.status === 'pending');
        expect(pendingPayout).toBeDefined();
        expect(pendingPayout.amount).toEqual(1000);
        expect(pendingPayout.partnerUpiId).toEqual('partner@okicici');

        // Super Admin clears the payout with UTR and payment proof
        const clearRes = await adminAgent
            .post(`/admin/payouts/${pendingPayout.id}/clear`)
            .field('transactionId', 'UPI-ADMIN-SETTLE-987654');

        expect(clearRes.statusCode).toEqual(302);

        // Verify status is cleared
        const cleared = await payoutsStorage.getById(pendingPayout.id);
        expect(cleared.status).toEqual('cleared');
        expect(cleared.adminTransactionId).toEqual('UPI-ADMIN-SETTLE-987654');
        expect(cleared.clearedAt).toBeDefined();

        // Cleanup test payout
        await payoutsStorage.delete(pendingPayout.id).catch(() => {});
    });

    it('should handle direct admin-to-user messaging with shared history across all admins and admin name attribution', async () => {
        const adminMessagesStorage = new JsonStorage('admin_messages');
        const testUserEmail = 'chatclient_' + Date.now() + '@campusconnect.local';
        const bcrypt = require('bcryptjs');

        // 1. Create a customer
        const clientUser = await usersStorage.add({
            email: testUserEmail,
            password: await bcrypt.hash('ClientPass123!', 10),
            role: 'customer',
            isVerified: true
        });

        // 2. Admin loads chat page with this user
        const chatPageRes = await adminAgent.get(`/admin/chat?userId=${clientUser.id}`);
        expect(chatPageRes.statusCode).toEqual(200);
        expect(chatPageRes.text).toContain('Super Admin • Live Support Messenger');
        expect(chatPageRes.text).toContain(testUserEmail);

        // 3. Admin sends direct message to customer
        const adminSendRes = await adminAgent
            .post(`/admin/api/chat/${clientUser.id}`)
            .send({ text: 'Hello from Super Admin! How can we help you today?' });

        expect(adminSendRes.statusCode).toEqual(200);
        expect(adminSendRes.body.success).toBe(true);
        expect(adminSendRes.body.message.text).toEqual('Hello from Super Admin! How can we help you today?');
        expect(adminSendRes.body.message.senderRole).toEqual('admin');
        expect(adminSendRes.body.message.senderEmail).toEqual(adminEmail);

        // 4. Customer logs in and views support chat
        const clientAgent = request.agent(app);
        await clientAgent.post('/auth/login').send({ email: testUserEmail, password: 'ClientPass123!' });

        const supportPageRes = await clientAgent.get('/support/chat');
        expect(supportPageRes.statusCode).toEqual(200);
        expect(supportPageRes.text).toContain('Help & Support • Direct Admin Chat');

        // Customer fetches support messages API
        const clientMsgRes = await clientAgent.get('/support/api/messages');
        expect(clientMsgRes.statusCode).toEqual(200);
        expect(clientMsgRes.body.length).toBeGreaterThanOrEqual(1);
        const receivedAdminMsg = clientMsgRes.body.find(m => m.text === 'Hello from Super Admin! How can we help you today?');
        expect(receivedAdminMsg).toBeDefined();
        expect(receivedAdminMsg.senderEmail).toEqual(adminEmail);

        // 5. Customer sends a reply to Super Admin
        const clientReplyRes = await clientAgent
            .post('/support/api/messages')
            .send({ text: 'Thanks Admin, I have a question about my booking.' });

        expect(clientReplyRes.statusCode).toEqual(200);
        expect(clientReplyRes.body.success).toBe(true);
        expect(clientReplyRes.body.message.text).toEqual('Thanks Admin, I have a question about my booking.');

        // 6. A SECOND / DIFFERENT Super Admin logs in
        const secondAdminEmail = 'second_admin_' + Date.now() + '@campusconnect.local';
        const origEnv = process.env.SUPERADMIN_EMAILS || '';
        process.env.SUPERADMIN_EMAILS = origEnv ? `${origEnv},${secondAdminEmail}` : secondAdminEmail;

        const secondAdminUser = await usersStorage.add({
            email: secondAdminEmail,
            password: await bcrypt.hash('Admin2Secret123!', 10),
            role: 'admin',
            isVerified: true
        });

        const secondAdminAgent = request.agent(app);
        // Direct session simulation for second admin
        const login2Res = await secondAdminAgent
            .post('/admin/login')
            .send({ email: secondAdminEmail, password: 'Admin2Secret123!' });
        expect(login2Res.statusCode).toEqual(302);

        // Get second admin user to get OTP
        const u2 = await usersStorage.getById(secondAdminUser.id);
        await secondAdminAgent.post('/admin/verify-otp').send({ otp: u2.otp });

        // Second admin retrieves the messages for the customer -> MUST SEE THE EXACT SAME THREAD!
        const admin2HistoryRes = await secondAdminAgent.get(`/admin/api/chat/${clientUser.id}`);
        expect(admin2HistoryRes.statusCode).toEqual(200);
        expect(admin2HistoryRes.body.length).toBeGreaterThanOrEqual(2);

        // Verify the first admin's message with their email attribution is present in the shared history
        const sharedFirstAdminMsg = admin2HistoryRes.body.find(m => m.text === 'Hello from Super Admin! How can we help you today?');
        expect(sharedFirstAdminMsg).toBeDefined();
        expect(sharedFirstAdminMsg.senderEmail).toEqual(adminEmail);

        // Verify customer's reply is also present in the shared history
        const sharedClientReply = admin2HistoryRes.body.find(m => m.text === 'Thanks Admin, I have a question about my booking.');
        expect(sharedClientReply).toBeDefined();

        // 7. Second admin sends a response
        const secondAdminReply = await secondAdminAgent
            .post(`/admin/api/chat/${clientUser.id}`)
            .send({ text: 'This is Admin Two assisting as well!' });
        expect(secondAdminReply.statusCode).toEqual(200);
        expect(secondAdminReply.body.message.senderEmail).toEqual(secondAdminEmail);

        // Cleanup
        const allMsgs = await adminMessagesStorage.getAll();
        for (const m of allMsgs) {
            if (m.targetUserId === clientUser.id || m.partnerId === clientUser.id) {
                await adminMessagesStorage.delete(m.id).catch(() => {});
            }
        }
        await usersStorage.delete(clientUser.id).catch(() => {});
        await usersStorage.delete(secondAdminUser.id).catch(() => {});
        process.env.SUPERADMIN_EMAILS = origEnv;
    }, 25000);

    afterAll(async () => {
        if (testServiceId) await servicesStorage.delete(testServiceId).catch(() => {});
        if (partnerId) {
            await usersStorage.delete(partnerId).catch(() => {});
            const allApps = await appointmentsStorage.getAll();
            for (const a of allApps) {
                if (a.providerId === partnerId) {
                    await appointmentsStorage.delete(a.id).catch(() => {});
                }
            }
        }
    });
});
