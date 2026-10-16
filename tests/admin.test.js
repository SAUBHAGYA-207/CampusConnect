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

    it('should load Super Admin direct chat messenger', async () => {
        const res = await adminAgent.get('/admin/chat');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Super Admin • Live Support Messenger');
    });

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
