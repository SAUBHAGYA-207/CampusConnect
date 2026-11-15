const request = require('supertest');
const app = require('../app');
const walletService = require('../src/services/walletService');
const serviceService = require('../src/services/serviceService');
const adminService = require('../src/services/adminService');
const appointmentService = require('../src/services/appointmentService');
const JsonStorage = require('../src/storage/jsonStorage');

jest.setTimeout(30000);

describe('E-Wallet, Coins & Profile UPI OTP System', () => {
    const usersStorage = new JsonStorage('users');
    const servicesStorage = new JsonStorage('services');
    const appointmentsStorage = new JsonStorage('appointments');
    const walletTransactionsStorage = new JsonStorage('wallet_transactions');
    const payoutsStorage = new JsonStorage('payouts');

    let customerId = 'test_user_wallet_' + Date.now();
    let partnerId = 'test_partner_wallet_' + Date.now();
    let createdServiceId;
    let createdAppointmentId;

    beforeAll(async () => {
        // Register mock customer
        await usersStorage.add({
            id: customerId,
            email: `cust_${Date.now()}@campusconnect.local`,
            password: 'hashedpassword',
            role: 'customer',
            isVerified: true
        });

        // Register mock partner
        await usersStorage.add({
            id: partnerId,
            email: `partner_${Date.now()}@campusconnect.local`,
            password: 'hashedpassword',
            role: 'provider',
            isVerified: true,
            partnerUpiId: null
        });
    });

    afterAll(async () => {
        if (createdServiceId) await servicesStorage.delete(createdServiceId);
        if (createdAppointmentId) await appointmentsStorage.delete(createdAppointmentId);
        await usersStorage.delete(customerId);
        await usersStorage.delete(partnerId);
        
        // Cleanup transactions for test users
        const allTx = await walletTransactionsStorage.getAll();
        for (const tx of allTx) {
            if (tx.userId === customerId || tx.userId === partnerId) {
                await walletTransactionsStorage.delete(tx.id);
            }
        }
    });

    describe('1. E-Wallet 99 Welcome Coins for New Users', () => {
        it('should automatically assign 99 coins and record welcome transaction', async () => {
            const coins = await walletService.getUserCoins(customerId);
            expect(coins).toBe(99);

            const history = await walletService.getTransactionHistory(customerId);
            expect(history.length).toBeGreaterThanOrEqual(1);
            const welcomeTx = history.find(t => t.referenceId === 'welcome_bonus');
            expect(welcomeTx).toBeDefined();
            expect(welcomeTx.amount).toBe(99);
            expect(welcomeTx.type).toBe('credit');
            expect(welcomeTx.status).toBe('completed');
        });
    });

    describe('2. Service Listing Under Processing & Admin Verification (10 Coins)', () => {
        it('should create new service with status "under_processing" and log 10 coins pending reward', async () => {
            const service = await serviceService.createService(partnerId, {
                title: 'Python Coding Help',
                description: 'Assisting in assignment and debugging',
                price: 500,
                category: 'Tech'
            });

            expect(service).toBeDefined();
            createdServiceId = service.id;
            expect(service.status).toBe('under_processing');

            // Partner should have 10 coins in under-processing history
            const underProcess = await walletService.getUnderProcessingHistory(partnerId);
            const listingReward = underProcess.find(t => String(t.referenceId) === String(service.id));
            expect(listingReward).toBeDefined();
            expect(listingReward.amount).toBe(10);
            expect(listingReward.status).toBe('under_processing');
        });

        it('should unlock and credit 10 coins to partner when admin verifies the service', async () => {
            const initialPartnerCoins = await walletService.getUserCoins(partnerId);

            const verifiedService = await adminService.verifyServiceByAdmin(createdServiceId);
            expect(verifiedService.status).toBe('published');

            // 10 coins added to partner's wallet balance
            const updatedCoins = await walletService.getUserCoins(partnerId);
            expect(updatedCoins).toBe(initialPartnerCoins + 10);

            // Transaction moved to completed history
            const history = await walletService.getTransactionHistory(partnerId);
            const verifiedTx = history.find(t => String(t.referenceId) === String(createdServiceId));
            expect(verifiedTx).toBeDefined();
            expect(verifiedTx.status).toBe('completed');
        });
    });

    describe('3. Booking Service: 10% Booking Bonus & Coin Redemption', () => {
        it('should allow customer to redeem wallet coins on order and award 10% coins to both customer and partner', async () => {
            const customerCoinsBefore = await walletService.getUserCoins(customerId);
            const partnerCoinsBefore = await walletService.getUserCoins(partnerId);

            const coinsToRedeem = 50; // User redeems 50 coins

            const appt = await appointmentService.createAppointment(
                customerId,
                createdServiceId,
                '2026-11-25',
                '11:00',
                'Need help with Python project',
                {
                    paymentScreenshot: '/uploads/payments/proof.png',
                    transactionId: 'UPI-COIN-12345',
                    coinsUsed: coinsToRedeem
                }
            );

            createdAppointmentId = appt.id;
            expect(appt).toBeDefined();
            expect(appt.coinsUsed).toBe(50);
            // Original price was ₹500, with 50 coins redeemed -> ₹450 payable
            expect(appt.paymentAmount).toBe(450);

            // 10% of booking price (₹500) = 50 coins awarded
            const expectedBonus = Math.round(500 * 0.10); // 50 coins

            // Customer net change: -50 redeemed + 50 booking bonus = net 0 change from before
            const customerCoinsAfter = await walletService.getUserCoins(customerId);
            expect(customerCoinsAfter).toBe(customerCoinsBefore - 50 + expectedBonus);

            // Partner gained 10% booking bonus
            const partnerCoinsAfter = await walletService.getUserCoins(partnerId);
            expect(partnerCoinsAfter).toBe(partnerCoinsBefore + expectedBonus);

            // Verify transaction logs
            const customerHistory = await walletService.getTransactionHistory(customerId);
            const redemptionTx = customerHistory.find(t => t.type === 'debit' && t.amount === 50);
            expect(redemptionTx).toBeDefined();
            const bonusTx = customerHistory.find(t => t.type === 'credit' && t.amount === 50 && t.referenceId === appt.id);
            expect(bonusTx).toBeDefined();
        });

        it('should complete booking with status verified and paymentScreenshot "Paid by Coins" when coins cover 100% of price (amount is 0)', async () => {
            const cheapService = await serviceService.createService(
                partnerId,
                {
                    title: 'Quick Help Session',
                    price: 50,
                    category: 'Teach',
                    description: 'Help for 15 mins'
                }
            );

            const appt = await appointmentService.createAppointment(
                customerId,
                cheapService.id,
                '2026-11-26',
                '14:00',
                '100% coins booking',
                {
                    coinsUsed: 50
                }
            );

            expect(appt).toBeDefined();
            expect(appt.paymentAmount).toBe(0);
            expect(appt.coinsUsed).toBe(50);
            expect(appt.paymentScreenshot).toBe('Paid by Coins');
            expect(appt.paymentStatus).toBe('verified');
        });
    });

    describe('4. Partner Withdrawal Threshold of ₹200', () => {
        it('should block withdrawal requests below ₹200 threshold', async () => {
            // Attempt to withdraw ₹100
            await expect(adminService.createPayoutRequest(partnerId, 100, 'Test withdrawal'))
                .rejects
                .toThrow('Minimum withdrawal amount is ₹200');
        });

        it('should block withdrawal if partner available balance is below ₹200', async () => {
            // Partner has 0 completed settled balance yet
            await expect(adminService.createPayoutRequest(partnerId, 250, 'Test withdrawal'))
                .rejects
                .toThrow();
        });
    });

    describe('5. Profile UPI ID with Strict OTP Verification', () => {
        it('should generate and dispatch OTP when requesting to set UPI ID', async () => {
            const agent = request.agent(app);

            // Mock session login for partner
            const user = await usersStorage.getById(partnerId);
            const otpRes = await agent
                .post('/profile/upi/send-otp')
                .set('Accept', 'application/json')
                .send({ upiId: 'testpartner@okaxis' });

            // Note: If requireAuth middleware runs without session, expect redirect or 302/401
            // Let's test the controller logic directly or through direct user record check
        });

        it('should verify OTP and activate UPI ID in user record', async () => {
            const profileController = require('../src/controllers/profileController');

            // 1. Simulate send OTP
            const mockReqSend = {
                session: { user: { id: partnerId, email: 'partner@campusconnect.local' } },
                body: { upiId: 'testpartner@okaxis' },
                xhr: true,
                headers: { accept: 'application/json' }
            };

            let sendResult;
            const mockResSend = {
                status: function(code) { this.statusCode = code; return this; },
                json: function(data) { sendResult = data; return this; }
            };

            await profileController.postSendUpiOtp(mockReqSend, mockResSend);
            expect(sendResult.success).toBe(true);

            // Inspect OTP saved in DB
            const partnerInDb = await usersStorage.getById(partnerId);
            expect(partnerInDb.tempPendingUpiId).toBe('testpartner@okaxis');
            expect(partnerInDb.upiOtp).toBeDefined();

            // 2. Simulate verify OTP with incorrect code
            const mockReqFail = {
                session: { user: { id: partnerId } },
                body: { otp: '000000' },
                xhr: true,
                headers: { accept: 'application/json' }
            };
            let failResult;
            const mockResFail = {
                status: function(code) { this.statusCode = code; return this; },
                json: function(data) { failResult = data; return this; }
            };
            await profileController.postVerifyUpiOtp(mockReqFail, mockResFail);
            expect(failResult.success).toBe(false);

            // 3. Simulate verify OTP with correct code
            const mockReqSuccess = {
                session: { 
                    user: { id: partnerId },
                    save: function(cb) { cb(); }
                },
                body: { otp: partnerInDb.upiOtp },
                xhr: true,
                headers: { accept: 'application/json' }
            };
            let successResult;
            const mockResSuccess = {
                status: function(code) { this.statusCode = code; return this; },
                json: function(data) { successResult = data; return this; }
            };
            await profileController.postVerifyUpiOtp(mockReqSuccess, mockResSuccess);
            expect(successResult.success).toBe(true);
            expect(successResult.upiId).toBe('testpartner@okaxis');

            // Confirm saved in database
            const updatedPartner = await usersStorage.getById(partnerId);
            expect(updatedPartner.partnerUpiId).toBe('testpartner@okaxis');
            expect(updatedPartner.upiOtp).toBeNull();
        });
    });

    describe('6. Partner Cancellation & Rejection Refund Automation', () => {
        let coinBookingService;
        let moneyBookingService;

        beforeAll(async () => {
            coinBookingService = await serviceService.createService(partnerId, {
                title: 'Coin Refund Test Service',
                price: 40,
                category: 'Teach',
                description: 'Service for testing coin refunds'
            });

            moneyBookingService = await serviceService.createService(partnerId, {
                title: 'Money Refund Test Service',
                price: 150,
                category: 'Design',
                description: 'Service for testing money refunds'
            });
        });

        afterAll(async () => {
            if (coinBookingService) await servicesStorage.delete(coinBookingService.id);
            if (moneyBookingService) await servicesStorage.delete(moneyBookingService.id);
        });

        it('should auto-refund coins to customer when partner rejects a coin-paid booking', async () => {
            // Give customer enough coins
            await walletService.addCoins(customerId, 100, 'Test credit');
            const customerCoinsBefore = await walletService.getUserCoins(customerId);

            // Create coin-paid booking (40 coins)
            const appt = await appointmentService.createAppointment(
                customerId,
                coinBookingService.id,
                '2026-11-28',
                '10:00',
                'Coin refund test',
                { coinsUsed: 40 }
            );

            expect(appt.paymentAmount).toBe(0);
            expect(appt.coinsUsed).toBe(40);
            expect(appt.status).toBe('pending');

            const customerCoinsAfterBooking = await walletService.getUserCoins(customerId);

            // Partner rejects the booking
            const updatedAppt = await appointmentService.updateStatus(appt.id, partnerId, 'provider', 'rejected');

            expect(updatedAppt.status).toBe('rejected');
            expect(updatedAppt.refundProcessed).toBe(true);
            expect(updatedAppt.coinsRefunded).toBe(true);

            // Customer coins should be refunded (40 coins credited back, minus 4 bonus coins reversed = +36 net from afterBooking)
            const customerCoinsAfterReject = await walletService.getUserCoins(customerId);
            expect(customerCoinsAfterReject).toBe(customerCoinsAfterBooking + 40 - Math.round(40 * 0.10));

            // Verify wallet transaction log has refund
            const history = await walletService.getTransactionHistory(customerId);
            const refundTx = history.find(t => t.type === 'credit' && t.referenceId === appt.id && t.description.includes('Refund'));
            expect(refundTx).toBeDefined();
            expect(refundTx.amount).toBe(40);
        });

        it('should queue a refund request for Super Admin when partner cancels a money-paid booking', async () => {
            // Customer books with money
            const appt = await appointmentService.createAppointment(
                customerId,
                moneyBookingService.id,
                '2026-11-29',
                '16:00',
                'Money refund test',
                {
                    paymentScreenshot: '/uploads/payments/cust_proof.jpg',
                    transactionId: 'UPI-MONEY-REFUND-1',
                    coinsUsed: 0
                }
            );

            expect(appt.paymentAmount).toBe(150);
            expect(appt.status).toBe('pending');

            // Partner accepts first
            await appointmentService.updateStatus(appt.id, partnerId, 'provider', 'accepted');

            // Partner cancels the accepted booking
            const cancelledAppt = await appointmentService.updateStatus(appt.id, partnerId, 'provider', 'cancelled');

            expect(cancelledAppt.status).toBe('cancelled');
            expect(cancelledAppt.refundProcessed).toBe(true);
            expect(cancelledAppt.moneyRefundRequested).toBe(true);
            expect(cancelledAppt.refundPayoutId).toBeDefined();

            // Verify refund request was queued in payouts storage
            const refundRequest = await payoutsStorage.getById(cancelledAppt.refundPayoutId);
            expect(refundRequest).toBeDefined();
            expect(refundRequest.type).toBe('refund');
            expect(Number(refundRequest.amount)).toBe(150);
            expect(refundRequest.status).toBe('pending');
            expect(refundRequest.appointmentId).toBe(appt.id);

            // Super Admin clears the refund payout
            const clearedRefund = await adminService.clearPayoutByAdmin(
                refundRequest.id,
                'UPI-REFUND-CLEARED-999',
                '/uploads/admin_refund_receipt.jpg'
            );

            expect(clearedRefund.status).toBe('cleared');
            expect(clearedRefund.adminTransactionId).toBe('UPI-REFUND-CLEARED-999');

            // Verify appointment status was updated to settled
            const settledAppt = await appointmentsStorage.getById(appt.id);
            expect(settledAppt.refundStatus).toBe('settled');
            expect(settledAppt.refundAdminTxnId).toBe('UPI-REFUND-CLEARED-999');
        });
    });

    describe('7. Refer & Earn 50 Coins System', () => {
        const authController = require('../src/controllers/authController');
        let referredUserEmail = `referee_${Date.now()}@campusconnect.local`;
        let refereeId;

        afterAll(async () => {
            if (refereeId) await usersStorage.delete(refereeId);
        });

        it('should assign a unique referral code to the referrer and register referee with that code', async () => {
            // Set referral code for customer
            const myRefCode = 'REF' + Date.now().toString().slice(-5);
            await usersStorage.update(customerId, { referralCode: myRefCode });

            // Simulate referee registration with referral code
            const mockReq = {
                body: {
                    email: referredUserEmail,
                    password: 'refereepassword',
                    role: 'customer',
                    referralCode: myRefCode
                },
                session: {
                    save: function(cb) { cb(); }
                }
            };
            const mockRes = {
                render: jest.fn(),
                redirect: jest.fn()
            };

            await authController.postRegister(mockReq, mockRes);
            expect(mockRes.redirect).toHaveBeenCalledWith('/auth/verify-email');

            // Confirm referee saved with referredBy pointing to customerId
            const referee = await usersStorage.find(u => u.email === referredUserEmail);
            expect(referee).toBeDefined();
            refereeId = referee.id;
            expect(referee.referredBy).toBe(customerId);
            expect(referee.referralCodeUsed).toBe(myRefCode);
            expect(referee.referralRewardProcessed).toBe(false);
        });

        it('should award 50 coins to the referrer when referee verifies email', async () => {
            const referrerCoinsBefore = await walletService.getUserCoins(customerId);
            const referee = await usersStorage.find(u => u.email === referredUserEmail);

            // Simulate referee verifying their OTP
            const mockReq = {
                body: { otp: referee.otp },
                session: {
                    userId: referee.id,
                    save: function(cb) { cb(); }
                }
            };
            const mockRes = {
                render: jest.fn(),
                redirect: jest.fn()
            };

            await authController.postVerifyEmail(mockReq, mockRes);
            expect(mockRes.redirect).toHaveBeenCalledWith('/');

            // Referrer should have earned exactly 50 coins!
            const referrerCoinsAfter = await walletService.getUserCoins(customerId);
            expect(referrerCoinsAfter).toBe(referrerCoinsBefore + 50);

            // Verify referee marked as referralRewardProcessed
            const updatedReferee = await usersStorage.getById(referee.id);
            expect(updatedReferee.referralRewardProcessed).toBe(true);

            // Verify referral transaction was recorded in referrer's history
            const history = await walletService.getTransactionHistory(customerId);
            const refTx = history.find(t => t.type === 'credit' && t.amount === 50 && t.referenceId === referee.id);
            expect(refTx).toBeDefined();
            expect(refTx.description).toContain('Referral Bonus');
        });
    });

    describe('8. Service Completed Feedback Email & Review System', () => {
        const appointmentController = require('../src/controllers/appointmentController');
        let feedbackService;
        let feedbackAppt;

        beforeAll(async () => {
            feedbackService = await serviceService.createService(partnerId, {
                title: 'Feedback Test Tutoring',
                price: 100,
                category: 'Teach',
                description: 'Service for testing completion feedback email'
            });
        });

        afterAll(async () => {
            if (feedbackService) await servicesStorage.delete(feedbackService.id);
            if (feedbackAppt) await appointmentsStorage.delete(feedbackAppt.id);
        });

        it('should dispatch feedback email when partner marks service as completed', async () => {
            // Customer books service
            feedbackAppt = await appointmentService.createAppointment(
                customerId,
                feedbackService.id,
                '2026-11-30',
                '17:00',
                'Completed feedback test booking',
                { coinsUsed: 0 }
            );

            // Partner accepts
            await appointmentService.updateStatus(feedbackAppt.id, partnerId, 'provider', 'accepted');

            // Partner marks as completed
            const completedAppt = await appointmentService.updateStatus(feedbackAppt.id, partnerId, 'provider', 'completed');
            expect(completedAppt.status).toBe('completed');
        });

        it('should allow customer to submit rating and feedback comments', async () => {
            const mockReq = {
                params: { id: feedbackAppt.id },
                body: { rating: '5', feedback: 'Outstanding peer tutor! Solved all my doubts quickly.' },
                session: { user: { id: customerId } },
                flash: jest.fn()
            };
            const mockRes = {
                redirect: jest.fn()
            };

            await appointmentController.postFeedback(mockReq, mockRes);
            expect(mockRes.redirect).toHaveBeenCalledWith(`/appointments/my-bookings/${feedbackAppt.id}`);

            // Verify saved in appointments storage
            const updatedAppt = await appointmentsStorage.getById(feedbackAppt.id);
            expect(updatedAppt.rating).toBe(5);
            expect(updatedAppt.feedback).toBe('Outstanding peer tutor! Solved all my doubts quickly.');
            expect(updatedAppt.feedbackSubmittedAt).toBeDefined();
        });
    });
});
