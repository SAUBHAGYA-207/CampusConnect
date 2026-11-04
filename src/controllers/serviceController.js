const serviceService = require('../services/serviceService');
const appointmentService = require('../services/appointmentService');

exports.getDashboard = async (req, res, next) => {
    try {
        const services = await serviceService.getServicesByProvider(req.session.user.id);
        const apps = await appointmentService.getAppointmentsByProvider(req.session.user.id);
        
        // PAYMENT only reflects once the service is marked COMPLETED from provider end!
        const completedApps = apps.filter(a => a.status === 'completed');
        
        let totalEarnings = 0;
        let totalGross = 0;
        let totalPlatformFee = 0;

        completedApps.forEach(a => {
            const amount = a.paymentAmount !== undefined && a.paymentAmount !== null 
                ? Number(a.paymentAmount) 
                : (a.service ? Number(a.service.price) : 0);
            const earnings = a.providerEarnings !== undefined && a.providerEarnings !== null
                ? Number(a.providerEarnings)
                : parseFloat((amount * 0.90).toFixed(2));
            const fee = a.platformFee !== undefined && a.platformFee !== null
                ? Number(a.platformFee)
                : parseFloat((amount * 0.10).toFixed(2));

            totalGross += amount;
            totalEarnings += earnings;
            totalPlatformFee += fee;
        });

        // Calculate pending/in-progress earnings (pending or accepted orders awaiting completion)
        const inProgressApps = apps.filter(a => a.status === 'pending' || a.status === 'accepted');
        let pendingEarnings = 0;
        inProgressApps.forEach(a => {
            const amount = a.paymentAmount !== undefined && a.paymentAmount !== null 
                ? Number(a.paymentAmount) 
                : (a.service ? Number(a.service.price) : 0);
            const earnings = a.providerEarnings !== undefined && a.providerEarnings !== null
                ? Number(a.providerEarnings)
                : parseFloat((amount * 0.90).toFixed(2));
            pendingEarnings += earnings;
        });

        const pendingPaymentApprovals = apps.filter(a => a.paymentStatus === 'submitted').length;
        const verifiedPaymentsCount = apps.filter(a => a.paymentStatus === 'verified').length;

        res.render('provider/dashboard', { 
            stats: { 
                totalServices: services.length, 
                totalAppointments: apps.length, 
                pendingAppointments: apps.filter(a => a.status === 'pending').length,
                completedAppointments: completedApps.length,
                totalEarnings: totalEarnings.toFixed(2),
                totalGross: totalGross.toFixed(2),
                totalPlatformFee: totalPlatformFee.toFixed(2),
                pendingEarnings: pendingEarnings.toFixed(2),
                pendingPaymentApprovals,
                verifiedPaymentsCount
            } 
        });
    } catch (error) {
        next(error);
    }
};

exports.getMyServices = async (req, res, next) => {
    try {
        const services = await serviceService.getServicesByProvider(req.session.user.id);
        res.render('provider/my-services', { services });
    } catch (error) {
        next(error);
    }
};

exports.getCreateService = (req, res) => {
    res.render('provider/create-service', { error: null });
};

const storageService = require('../services/storageService');

exports.postCreateService = async (req, res, next) => {
    try {
        if (req.uploadError) {
            return res.render('provider/create-service', { error: req.uploadError });
        }

        const { title, description, price, category } = req.body;
        if (!title || !title.trim() || !description || !description.trim() || price === undefined || price === '' || !category) {
            return res.render('provider/create-service', { 
                error: 'Please fill in all required fields (title, description, price, category).' 
            });
        }

        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return res.render('provider/create-service', { 
                error: 'Please provide a valid price (₹ 0 or greater).' 
            });
        }

        const filesToUpload = req.uploadedFiles || (req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : (req.file ? [req.file] : []));
        let images = [];
        if (filesToUpload && filesToUpload.length > 0) {
            images = await storageService.uploadMultipleMulterFiles(filesToUpload, 'services');
        }

        const requiresUpload = req.body.requiresUpload === 'true' || req.body.requiresUpload === 'on' || req.body.requiresUpload === true;
        const deliveryMode = req.body.deliveryMode || (requiresUpload ? 'online' : 'flexible');
        const uploadPrompt = req.body.uploadPrompt ? req.body.uploadPrompt.trim() : '';
        
        await serviceService.createService(req.session.user.id, {
            title: title.trim(),
            description: description.trim(),
            price: parsedPrice,
            category,
            images,
            image: images[0] || null,
            requiresUpload,
            deliveryMode,
            uploadPrompt
        });
        res.redirect('/services/my-services');
    } catch (error) {
        console.error('❌ [postCreateService Error]:', error);
        res.render('provider/create-service', { 
            error: error.message || 'Something went wrong while creating the service. Please try again.' 
        });
    }
};

exports.getEditService = async (req, res, next) => {
    try {
        const service = await serviceService.getServiceById(req.params.id);
        if (!service || service.providerId !== req.session.user.id) {
            return res.status(403).render('error', { message: 'Forbidden' });
        }
        res.render('provider/edit-service', { service, error: null });
    } catch (error) {
        next(error);
    }
};

exports.postEditService = async (req, res, next) => {
    let currentService = null;
    try {
        currentService = await serviceService.getServiceById(req.params.id);
        if (!currentService || currentService.providerId !== req.session.user.id) {
            return res.status(403).render('error', { message: 'Forbidden' });
        }

        if (req.uploadError) {
            return res.render('provider/edit-service', { service: currentService, error: req.uploadError });
        }

        const { title, description, price, category } = req.body;
        if (!title || !title.trim() || !description || !description.trim() || price === undefined || price === '' || !category) {
            return res.render('provider/edit-service', { 
                service: currentService, 
                error: 'Please fill in all required fields (title, description, price, category).' 
            });
        }

        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
            return res.render('provider/edit-service', { 
                service: currentService, 
                error: 'Please provide a valid price (₹ 0 or greater).' 
            });
        }

        let keptImages = [];
        if (req.body.existingImages !== undefined) {
            if (Array.isArray(req.body.existingImages)) {
                keptImages = req.body.existingImages.filter(Boolean);
            } else if (typeof req.body.existingImages === 'string' && req.body.existingImages.trim()) {
                keptImages = [req.body.existingImages.trim()];
            }
        } else {
            keptImages = currentService.images || (currentService.image ? [currentService.image] : []);
        }

        const filesToUpload = req.uploadedFiles || (req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : (req.file ? [req.file] : []));
        let newUploadedUrls = [];
        if (filesToUpload && filesToUpload.length > 0) {
            newUploadedUrls = await storageService.uploadMultipleMulterFiles(filesToUpload, 'services');
        }

        const combinedImages = [...keptImages, ...newUploadedUrls];
        const requiresUpload = req.body.requiresUpload === 'true' || req.body.requiresUpload === 'on' || req.body.requiresUpload === true;
        const deliveryMode = req.body.deliveryMode || (requiresUpload ? 'online' : 'flexible');
        const uploadPrompt = req.body.uploadPrompt !== undefined ? req.body.uploadPrompt.trim() : '';

        const updates = {
            title: title.trim(),
            description: description.trim(),
            price: parsedPrice,
            category,
            images: combinedImages,
            image: combinedImages[0] || null,
            requiresUpload,
            deliveryMode,
            uploadPrompt
        };
        
        await serviceService.updateService(req.params.id, req.session.user.id, updates);
        res.redirect('/services/my-services');
    } catch (error) {
        console.error('❌ [postEditService Error]:', error);
        res.render('provider/edit-service', { 
            service: currentService || { id: req.params.id }, 
            error: error.message || 'Something went wrong while updating the service. Please try again.' 
        });
    }
};

exports.deleteService = async (req, res, next) => {
    try {
        await serviceService.deleteService(req.params.id, req.session.user.id);
        res.redirect('/services/my-services');
    } catch (error) {
        next(error);
    }
};

const adminService = require('../services/adminService');

exports.postPayoutQr = async (req, res, next) => {
    try {
        const { partnerUpiId } = req.body;
        const partnerQrImage = req.file ? await storageService.uploadMulterFile(req.file, 'partner-qr') : undefined;
        
        await adminService.updatePartnerPayoutDetails(req.session.user.id, {
            partnerUpiId: partnerUpiId ? partnerUpiId.trim() : null,
            partnerQrImage
        });

        req.flash('success', 'Payout UPI ID updated successfully. System will generate QR automatically for admin.');
        res.redirect('/dashboard#payout-section');
    } catch (error) {
        next(error);
    }
};

exports.postRequestPayout = async (req, res, next) => {
    try {
        const { amount, notes } = req.body;
        await adminService.createPayoutRequest(req.session.user.id, amount, notes);
        req.flash('success', `Payout request for ₹${amount} submitted! Super Admin will scan your QR and transfer funds.`);
        res.redirect('/dashboard#payout-section');
    } catch (error) {
        req.flash('error', error.message || 'Payout request failed.');
        res.redirect('/dashboard#payout-section');
    }
};
