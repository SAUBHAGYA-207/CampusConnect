const simulationService = require('../services/simulationService');
const serviceService = require('../services/serviceService');
const chatService = require('../services/chatService');
const storageService = require('../services/storageService');
const JsonStorage = require('../storage/jsonStorage');
const usersStorage = new JsonStorage('users');
const appointmentsStorage = new JsonStorage('appointments');

exports.getDashboard = async (req, res, next) => {
    try {
        const [stats, users, services, appointments, chatRooms, allServices] = await Promise.all([
            simulationService.getSimulationStats(),
            simulationService.getSimulatedUsers(),
            simulationService.getSimulatedServices(),
            simulationService.getSimulatedAppointments(),
            simulationService.getAllSimulatedChatRooms(),
            serviceService.getAllServices ? serviceService.getAllServices() : new JsonStorage('services').getAll()
        ]);

        const activeTab = req.query.tab || 'overview';
        const selectedRoomId = req.query.room || (chatRooms.length > 0 ? chatRooms[0].appointmentId : null);

        let activeRoom = null;
        let activeRoomMessages = [];
        if (selectedRoomId) {
            activeRoom = chatRooms.find(r => r.appointmentId === selectedRoomId);
            if (activeRoom) {
                activeRoomMessages = await chatService.getMessagesForAppointment(selectedRoomId);
            }
        }

        res.render('admin/simulation', {
            adminUser: req.session.user,
            stats,
            users,
            services,
            appointments,
            allServices,
            chatRooms,
            activeTab,
            activeRoom,
            activeRoomMessages,
            baselineDateString: simulationService.BASELINE_DATE_STRING,
            title: 'Master Simulation & Persona Hub (Restricted: sjijaiswal4@gmail.com)'
        });
    } catch (error) {
        next(error);
    }
};

exports.postCreateUser = async (req, res, next) => {
    try {
        await simulationService.createSimulatedUser(req.body);
        req.flash('success', `Dummy account '${req.body.email}' created successfully starting from ${req.body.customDate || '20 Oct 2026'}!`);
        res.redirect('/admin/simulation?tab=personas');
    } catch (error) {
        req.flash('error', error.message);
        res.redirect('/admin/simulation?tab=personas');
    }
};

exports.postDeleteUser = async (req, res, next) => {
    try {
        await simulationService.deleteSimulatedUser(req.params.id);
        req.flash('success', 'Dummy account and its linked services/appointments removed.');
        res.redirect('/admin/simulation?tab=personas');
    } catch (error) {
        req.flash('error', error.message);
        res.redirect('/admin/simulation?tab=personas');
    }
};

exports.getLoginAsUser = async (req, res, next) => {
    try {
        const user = await usersStorage.getById(req.params.id);
        if (!user) {
            req.flash('error', 'User not found.');
            return res.redirect('/admin/simulation?tab=personas');
        }

        // Store original admin email for easy switchback
        req.session.impersonatedFrom = req.session.user.email;
        req.session.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            isVerified: user.isVerified
        };

        req.flash('success', `Switched persona to: ${user.email} (${user.role.toUpperCase()}). You are now experiencing CampusConnect as this user!`);
        res.redirect(user.role === 'provider' ? '/dashboard' : '/marketplace');
    } catch (error) {
        next(error);
    }
};

exports.getRevertToAdmin = async (req, res, next) => {
    try {
        const masterAdmin = await usersStorage.find(u => u.email === 'sjijaiswal4@gmail.com');
        if (masterAdmin) {
            delete req.session.impersonatedFrom;
            req.session.user = {
                id: masterAdmin.id,
                email: masterAdmin.email,
                role: masterAdmin.role,
                isVerified: masterAdmin.isVerified
            };
            req.flash('success', 'Restored master administrative session.');
            return res.redirect('/admin/simulation');
        }
        res.redirect('/admin/login');
    } catch (error) {
        next(error);
    }
};

exports.postCreateService = async (req, res, next) => {
    try {
        let imageUrl = null;
        if (req.file) {
            imageUrl = await storageService.uploadMulterFile(req.file, 'services');
        } else if (req.body.imagePreset) {
            imageUrl = req.body.imagePreset;
        }

        await simulationService.createSimulatedService({
            ...req.body,
            image: imageUrl
        });

        req.flash('success', `Service '${req.body.title}' published on marketplace under selected partner! (Zero dummy trace)`);
        res.redirect('/admin/simulation?tab=services');
    } catch (error) {
        req.flash('error', error.message);
        res.redirect('/admin/simulation?tab=services');
    }
};

exports.postCreateAppointment = async (req, res, next) => {
    try {
        let paymentScreenshotUrl = null;
        if (req.file) {
            paymentScreenshotUrl = await storageService.uploadMulterFile(req.file, 'payments');
        } else if (req.body.paymentScreenshotUrl) {
            paymentScreenshotUrl = req.body.paymentScreenshotUrl;
        }

        await simulationService.createSimulatedAppointment({
            ...req.body,
            paymentScreenshot: paymentScreenshotUrl
        });

        req.flash('success', 'Simulated booking created! Visible in customer bookings, partner orders, and the unified chat hub.');
        res.redirect('/admin/simulation?tab=services');
    } catch (error) {
        req.flash('error', error.message);
        res.redirect('/admin/simulation?tab=services');
    }
};

exports.getChatRoomApi = async (req, res, next) => {
    try {
        const { appointmentId } = req.params;
        const app = await appointmentsStorage.getById(appointmentId);
        if (!app) return res.status(404).json({ error: 'Appointment not found' });

        const [customer, provider, service, messages] = await Promise.all([
            usersStorage.getById(app.customerId),
            usersStorage.getById(app.providerId),
            new JsonStorage('services').getById(app.serviceId),
            chatService.getMessagesForAppointment(appointmentId)
        ]);

        res.json({
            appointment: {
                id: app.id,
                date: app.date,
                time: app.time,
                status: app.status,
                paymentStatus: app.paymentStatus,
                customer: customer ? { id: customer.id, email: customer.email, name: customer.email.split('@')[0] } : null,
                provider: provider ? { id: provider.id, email: provider.email, name: provider.email.split('@')[0] } : null,
                service: service ? { id: service.id, title: service.title, price: service.price } : null
            },
            messages
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.postSendMessageApi = async (req, res, next) => {
    try {
        const { appointmentId } = req.params;
        const { senderId, senderRole, text, status, customTimestamp } = req.body;

        let imageUrl = null;
        if (req.file) {
            imageUrl = await storageService.uploadMulterFile(req.file, 'chat');
        }

        const msg = await simulationService.sendSimulatedMessage({
            appointmentId,
            senderId,
            senderRole,
            text,
            imageUrl,
            status: status || 'read',
            customTimestamp: customTimestamp ? new Date(customTimestamp).getTime() : Date.now()
        });

        res.json({ success: true, message: msg });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.postShiftMetadata = async (req, res, next) => {
    try {
        const baseDate = req.body.baselineDate || '2026-10-20';
        const result = await simulationService.shiftAllMetadataToBaseline(baseDate);
        req.flash('success', `Metadata timestamps synchronized to baseline starting from ${baseDate}! Shifted ${result.shiftedUsers} personas, ${result.shiftedServices} services, and ${result.shiftedAppointments} bookings.`);
        res.redirect('/admin/simulation?tab=overview');
    } catch (error) {
        req.flash('error', error.message);
        res.redirect('/admin/simulation?tab=overview');
    }
};

exports.postSeedPresets = async (req, res, next) => {
    try {
        const result = await simulationService.seedCampusPresets();
        req.flash('success', result.message);
        res.redirect('/admin/simulation?tab=overview');
    } catch (error) {
        req.flash('error', error.message);
        res.redirect('/admin/simulation?tab=overview');
    }
};
