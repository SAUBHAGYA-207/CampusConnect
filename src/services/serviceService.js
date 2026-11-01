const JsonStorage = require('../storage/jsonStorage');
const servicesStorage = new JsonStorage('services');
const usersStorage = new JsonStorage('users');

function normalizeService(service) {
    if (!service) return null;
    let images = [];
    if (Array.isArray(service.images)) {
        images = service.images.filter(Boolean);
    } else if (typeof service.images === 'string' && service.images.trim()) {
        try {
            const parsed = JSON.parse(service.images);
            if (Array.isArray(parsed)) images = parsed.filter(Boolean);
            else images = [service.images];
        } catch (e) {
            images = [service.images];
        }
    }

    if (images.length === 0 && service.image) {
        if (typeof service.image === 'string' && service.image.trim()) {
            if (service.image.trim().startsWith('[')) {
                try {
                    const parsed = JSON.parse(service.image);
                    if (Array.isArray(parsed)) images = parsed.filter(Boolean);
                    else images = [service.image];
                } catch (e) {
                    images = [service.image];
                }
            } else if (service.image.includes('|||')) {
                images = service.image.split('|||').map(s => s.trim()).filter(Boolean);
            } else {
                images = [service.image];
            }
        }
    }

    const primaryImage = images.length > 0 ? images[0] : (service.image || null);

    return {
        ...service,
        images,
        image: primaryImage
    };
}

exports.normalizeService = normalizeService;

exports.createService = async (providerId, serviceData) => {
    let images = [];
    if (Array.isArray(serviceData.images)) {
        images = serviceData.images.filter(Boolean);
    } else if (serviceData.image) {
        images = [serviceData.image];
    }

    const primaryImage = images.length > 0 ? images[0] : (serviceData.image || null);
    const imagePayload = images.length > 1 ? JSON.stringify(images) : primaryImage;

    // Send only valid columns recognized by Supabase services table
    const payload = {
        title: serviceData.title,
        description: serviceData.description,
        price: serviceData.price,
        category: serviceData.category,
        image: imagePayload,
        providerId,
        createdAt: Date.now()
    };

    const added = await servicesStorage.add(payload);
    return normalizeService(added);
};

exports.updateService = async (serviceId, providerId, updates) => {
    const service = await servicesStorage.getById(serviceId);
    if (!service || service.providerId !== providerId) {
        throw new Error('Service not found or unauthorized');
    }

    const updatesPayload = { ...updates };
    if (Array.isArray(updates.images)) {
        const images = updates.images.filter(Boolean);
        const primaryImage = images.length > 0 ? images[0] : null;
        updatesPayload.image = images.length > 1 ? JSON.stringify(images) : primaryImage;
        delete updatesPayload.images;
    }

    const updated = await servicesStorage.update(serviceId, updatesPayload);
    return normalizeService(updated);
};

exports.getServiceById = async (serviceId) => {
    const service = await servicesStorage.getById(serviceId);
    if (!service) return null;
    const normalized = normalizeService(service);
    if (normalized && normalized.providerId) {
        try {
            const user = await usersStorage.getById(normalized.providerId);
            if (user) {
                const displayName = user.name || user.username || (user.email ? user.email.split('@')[0] : 'Partner');
                normalized.provider = {
                    ...user,
                    name: displayName,
                    username: displayName
                };
                normalized.providerName = displayName;
            }
        } catch (e) {
            console.warn('Could not populate provider for getServiceById:', e.message);
        }
    }
    return normalized;
};

exports.getServicesByProvider = async (providerId) => {
    const services = await servicesStorage.getAll();
    return services.filter(s => s.providerId === providerId).map(normalizeService);
};

exports.searchServices = async (query = {}, category, minPrice, maxPrice, sortBy) => {
    let services = await servicesStorage.getAll();
    services = services.map(normalizeService);

    // Populate partner/provider username & profile details
    try {
        const users = await usersStorage.getAll();
        const userMap = new Map();
        users.forEach(u => {
            if (u && u.id) {
                const displayName = u.name || u.username || (u.email ? u.email.split('@')[0] : 'Partner');
                userMap.set(u.id, {
                    id: u.id,
                    email: u.email,
                    name: displayName,
                    username: displayName
                });
            }
        });
        services = services.map(s => {
            const providerInfo = userMap.get(s.providerId);
            const providerName = providerInfo ? providerInfo.name : 'Campus Partner';
            return {
                ...s,
                provider: providerInfo || { name: providerName, username: providerName },
                providerName
            };
        });
    } catch (e) {
        console.warn('Could not populate provider usernames for searchServices:', e.message);
    }

    if (query.q) {
        const q = query.q.toLowerCase();
        services = services.filter(s => 
            s.title.toLowerCase().includes(q) || 
            s.description.toLowerCase().includes(q) ||
            (s.providerName && s.providerName.toLowerCase().includes(q))
        );
    }
    if (category) {
        services = services.filter(s => s.category === category);
    }
    if (minPrice) {
        services = services.filter(s => parseFloat(s.price) >= parseFloat(minPrice));
    }
    if (maxPrice) {
        services = services.filter(s => parseFloat(s.price) <= parseFloat(maxPrice));
    }

    if (sortBy === 'price_asc') {
        services.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
    } else if (sortBy === 'price_desc') {
        services.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
    } else {
        services.sort((a, b) => b.createdAt - a.createdAt); // newest first
    }

    return services;
};

exports.deleteService = async (serviceId, providerId) => {
    const service = await servicesStorage.getById(serviceId);
    if (!service || service.providerId !== providerId) {
        throw new Error('Service not found or unauthorized');
    }
    await servicesStorage.delete(serviceId);
    return true;
};
