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
});
