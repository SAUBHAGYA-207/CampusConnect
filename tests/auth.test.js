const request = require('supertest');
const app = require('../app');
const JsonStorage = require('../src/storage/jsonStorage');

describe('Auth Endpoints', () => {
    it('should load login page', async () => {
        const res = await request(app).get('/auth/login');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Login');
    });

    it('should load register page with Partner tick checkbox option', async () => {
        const res = await request(app).get('/auth/register');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Create Account');
        expect(res.text).toContain('id="isPartner"');
        expect(res.text).toContain('Sign up as Partner');
    });

    it('should assign role as provider when Partner checkbox is ticked', async () => {
        const usersStorage = new JsonStorage('users');
        const testEmail = 'partnertick_' + Date.now() + '@campusconnect.local';

        const res = await request(app)
            .post('/auth/register')
            .send({
                email: testEmail,
                password: 'Password123!',
                isPartner: 'provider'
            });

        expect(res.statusCode).toEqual(302);
        expect(res.headers.location).toContain('/auth/verify-email');

        const created = await usersStorage.find(u => u.email === testEmail);
        expect(created).toBeDefined();
        expect(created.role).toEqual('provider');

        // Cleanup
        await usersStorage.delete(created.id);
    }, 15000);

    it('should assign role as customer when Partner checkbox is not ticked', async () => {
        const usersStorage = new JsonStorage('users');
        const testEmail = 'customertick_' + Date.now() + '@campusconnect.local';

        const res = await request(app)
            .post('/auth/register')
            .send({
                email: testEmail,
                password: 'Password123!'
            });

        expect(res.statusCode).toEqual(302);
        expect(res.headers.location).toContain('/auth/verify-email');

        const created = await usersStorage.find(u => u.email === testEmail);
        expect(created).toBeDefined();
        expect(created.role).toEqual('customer');

        // Cleanup
        await usersStorage.delete(created.id);
    }, 15000);

    it('should load marketplace page', async () => {
        const res = await request(app).get('/marketplace');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Marketplace');
    });

    it('should immediately show logged-in status upon login redirect without double-login', async () => {
        const agent = request.agent(app);
        const usersStorage = new JsonStorage('users');
        const bcrypt = require('bcryptjs');

        const testEmail = 'authtest_' + Date.now() + '@campusconnect.local';
        const password = 'SecretPassword123!';
        const hashedPassword = await bcrypt.hash(password, 10);

        const createdUser = await usersStorage.add({
            email: testEmail,
            password: hashedPassword,
            role: 'customer',
            isVerified: true
        });

        // Log in
        const loginRes = await agent
            .post('/auth/login')
            .send({ email: testEmail, password });

        expect(loginRes.statusCode).toEqual(302);
        expect(loginRes.headers.location).toEqual('/');

        // Immediately follow redirect to '/'
        const homeRes = await agent.get('/');
        expect(homeRes.statusCode).toEqual(200);
        // Must show the logged in user's email, not Login/Sign Up buttons
        expect(homeRes.text).toContain(testEmail);
        expect(homeRes.text).not.toContain('/auth/register');

        // Cleanup
        await usersStorage.delete(createdUser.id);
    });

    it('should handle complete forgot-password and reset-password flow', async () => {
        const agent = request.agent(app);
        const usersStorage = new JsonStorage('users');
        const bcrypt = require('bcryptjs');

        const testEmail = 'resetflow_' + Date.now() + '@campusconnect.local';
        const initialPassword = 'InitialPassword123!';
        const newPassword = 'NewSecretPassword456!';
        const hashedPassword = await bcrypt.hash(initialPassword, 10);

        const createdUser = await usersStorage.add({
            email: testEmail,
            password: hashedPassword,
            role: 'customer',
            isVerified: true
        });

        // 1. GET /auth/forgot-password renders page
        const getForgotRes = await agent.get('/auth/forgot-password');
        expect(getForgotRes.statusCode).toEqual(200);
        expect(getForgotRes.text).toContain('Forgot Password?');

        // 2. POST /auth/forgot-password with invalid email returns error
        const invalidEmailRes = await agent
            .post('/auth/forgot-password')
            .send({ email: 'nonexistent_' + Date.now() + '@campusconnect.local' });
        expect(invalidEmailRes.statusCode).toEqual(200);
        expect(invalidEmailRes.text).toContain('No account found');

        // 3. POST /auth/forgot-password with valid email sets OTP and redirects
        const validForgotRes = await agent
            .post('/auth/forgot-password')
            .send({ email: testEmail });
        expect(validForgotRes.statusCode).toEqual(302);
        expect(validForgotRes.headers.location).toEqual('/auth/reset-password');

        // Verify user in storage has OTP generated
        const userWithOtp = await usersStorage.getById(createdUser.id);
        expect(userWithOtp.otp).toBeDefined();
        expect(userWithOtp.otp.length).toEqual(6);

        // 4. GET /auth/reset-password renders with email
        const getResetRes = await agent.get('/auth/reset-password');
        expect(getResetRes.statusCode).toEqual(200);
        expect(getResetRes.text).toContain('Set New Password');
        expect(getResetRes.text).toContain(testEmail);

        // 5. POST /auth/reset-password with mismatched passwords fails
        const mismatchRes = await agent
            .post('/auth/reset-password')
            .send({
                otp: userWithOtp.otp,
                newPassword: newPassword,
                confirmPassword: 'WrongPasswordMismatch!'
            });
        expect(mismatchRes.statusCode).toEqual(200);
        expect(mismatchRes.text).toContain('Passwords do not match');

        // 6. POST /auth/reset-password with invalid OTP fails
        const invalidOtpRes = await agent
            .post('/auth/reset-password')
            .send({
                otp: '000000',
                newPassword: newPassword,
                confirmPassword: newPassword
            });
        expect(invalidOtpRes.statusCode).toEqual(200);
        expect(invalidOtpRes.text).toContain('Invalid or expired OTP');

        // 7. POST /auth/reset-password with correct OTP resets password
        const successResetRes = await agent
            .post('/auth/reset-password')
            .send({
                otp: userWithOtp.otp,
                newPassword: newPassword,
                confirmPassword: newPassword
            });
        expect(successResetRes.statusCode).toEqual(302);
        expect(successResetRes.headers.location).toContain('/auth/login?reset=success');

        // Follow redirect to login page - should show reset success banner
        const loginPageRes = await agent.get('/auth/login?reset=success');
        expect(loginPageRes.statusCode).toEqual(200);
        expect(loginPageRes.text).toContain('Password reset successfully');

        // 8. Sign in with OLD password must FAIL
        const oldLoginRes = await request(app)
            .post('/auth/login')
            .send({ email: testEmail, password: initialPassword });
        expect(oldLoginRes.statusCode).toEqual(200);
        expect(oldLoginRes.text).toContain('Invalid credentials');

        // 9. Sign in with NEW password must SUCCEED
        const newLoginRes = await request(app)
            .post('/auth/login')
            .send({ email: testEmail, password: newPassword });
        expect(newLoginRes.statusCode).toEqual(302);
        expect(newLoginRes.headers.location).toEqual('/');

        // Cleanup
        await usersStorage.delete(createdUser.id);
    }, 20000);
});
