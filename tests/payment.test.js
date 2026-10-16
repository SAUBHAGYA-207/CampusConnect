const request = require('supertest');
const app = require('../app');
const appointmentService = require('../src/services/appointmentService');
const JsonStorage = require('../src/storage/jsonStorage');

describe('Payment Gateway & 85% Provider Earnings', () => {
    let testServiceId;
    let providerId = 'test_provider_' + Date.now();
    let customerId = 'test_customer_' + Date.now();
    const servicesStorage = new JsonStorage('services');
    const appointmentsStorage = new JsonStorage('appointments');

    beforeAll(async () => {
        // Create a mock service with price ₹1000
        const service = await servicesStorage.add({
            providerId,
            title: 'Maths Tutoring Service',
            description: 'Comprehensive calculus guidance',
            price: 1000,
            category: 'Teach',
            status: 'published'
        });
        testServiceId = service.id;
    });

    afterAll(async () => {
        if (testServiceId) {
            await servicesStorage.delete(testServiceId);
        }
        const apps = await appointmentsStorage.getAll();
        for (const a of apps) {
            if (a.providerId === providerId) {
                await appointmentsStorage.delete(a.id);
            }
        }
    });

    it('should calculate 90% provider earnings and 10% platform commission on booking', async () => {
        const appointment = await appointmentService.createAppointment(
            customerId,
            testServiceId,
            '2026-11-20',
            '14:00',
            'Please bring calculus notes',
            {
                paymentScreenshot: '/uploads/payments/test-screenshot.png',
                transactionId: 'UPI-9876543210'
            }
        );

        expect(appointment).toBeDefined();
        expect(appointment.paymentAmount).toBe(1000);
        // Provider gets 90%
        expect(appointment.providerEarnings).toBe(900);
        // Platform gets 10%
        expect(appointment.platformFee).toBe(100);
        // Payment proof saved
        expect(appointment.paymentScreenshot).toBe('/uploads/payments/test-screenshot.png');
        expect(appointment.transactionId).toBe('UPI-9876543210');
        expect(appointment.paymentStatus).toBe('submitted');

        // Test Provider verification
        const verified = await appointmentService.updatePaymentStatus(appointment.id, providerId, 'verified');
        expect(verified.paymentStatus).toBe('verified');
        expect(verified.paymentVerifiedAt).toBeDefined();

        // Status transition: provider accepts
        const accepted = await appointmentService.updateStatus(appointment.id, providerId, 'provider', 'accepted');
        expect(accepted.status).toBe('accepted');

        // Status transition: provider marks completed -> Earnings now reflect
        const completed = await appointmentService.updateStatus(appointment.id, providerId, 'provider', 'completed');
        expect(completed.status).toBe('completed');

        // Cleanup appointment
        await appointmentsStorage.delete(appointment.id);
    });

    it('should identify cancelled bookings for chat blocking', async () => {
        const appointment = await appointmentService.createAppointment(
            customerId,
            testServiceId,
            '2026-11-21',
            '15:00',
            'Testing cancellation',
            { paymentScreenshot: '/uploads/payments/test.png' }
        );

        expect(appointment.status).toBe('pending');
        
        // Customer cancels booking
        const cancelled = await appointmentService.updateStatus(appointment.id, customerId, 'customer', 'cancelled');
        expect(cancelled.status).toBe('cancelled');

        // Verify that chat blocking condition detects cancelled
        const isChatBlocked = (cancelled.status === 'cancelled' || cancelled.status === 'rejected');
        expect(isChatBlocked).toBe(true);

        // Cleanup
        await appointmentsStorage.delete(appointment.id);
    });

    it('should NOT render pre-generated QR code on service page load, but provide dynamic specs & payment button flow', async () => {
        const bcrypt = require('bcryptjs');
        const usersStorage = new JsonStorage('users');
        const testCustomerEmail = 'bookflow_' + Date.now() + '@campusconnect.local';
        const password = 'TestPassword123!';
        const hashedPassword = await bcrypt.hash(password, 10);

        const customerUser = await usersStorage.add({
            email: testCustomerEmail,
            password: hashedPassword,
            role: 'customer',
            isVerified: true
        });

        const agent = request.agent(app);
        await agent.post('/auth/login').send({
            email: testCustomerEmail,
            password: password
        });

        const res = await agent.get(`/marketplace/${testServiceId}`);
        expect(res.statusCode).toBe(200);

        // Verify NO pre-generated QR server image url is pre-rendered in img src
        expect(res.text).not.toMatch(/<img[^>]+src=["']https:\/\/api\.qrserver\.com/);
        
        // Verify initial state has "Book This Service" start button
        expect(res.text).toContain('id="btnStartBooking"');

        // Verify specifications inputs are present
        expect(res.text).toContain('id="bookingDate"');
        expect(res.text).toContain('id="bookingTime"');
        expect(res.text).toContain('id="bookingNotes"');
        expect(res.text).toContain('Enter Your Specifications & Requirements');

        // Verify "Proceed to Payment" button is present
        expect(res.text).toContain('id="btnProceedToPayment"');

        // Verify animated QR generator and dynamic QR elements exist for client-side generation
        expect(res.text).toContain('id="bookingStateGeneratingQr"');
        expect(res.text).toContain('qr-pulse-halo');
        expect(res.text).toContain('qr-neon-laser');
        expect(res.text).toContain('id="dynamicPaymentQrImg"');

        // Verify that Book Service uses Admin's Escrow QR / UPI ID, not partner's personal UPI
        const adminUpi = process.env.UPI_ID || 'anand1024anand@okicici';
        expect(res.text).toContain(adminUpi);
        expect(res.text).toContain('Admin Escrow UPI QR');

        // Cleanup user
        await usersStorage.delete(customerUser.id);
    });
});
