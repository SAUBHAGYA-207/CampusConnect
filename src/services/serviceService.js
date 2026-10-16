const JsonStorage = require('../storage/jsonStorage');
const servicesStorage = new JsonStorage('services');

exports.createService = async (providerId, serviceData) => {
    return await servicesStorage.add({
        ...serviceData,
        providerId,
        createdAt: Date.now()
    });
};

exports.updateService = async (serviceId, providerId, updates) => {
    const service = await servicesStorage.getById(serviceId);
    if (!service || service.providerId !== providerId) {
        throw new Error('Service not found or unauthorized');
    }
    return await servicesStorage.update(serviceId, updates);
};

exports.getServiceById = async (serviceId) => {
    return await servicesStorage.getById(serviceId);
};

exports.getServicesByProvider = async (providerId) => {
    const services = await servicesStorage.getAll();
    return services.filter(s => s.providerId === providerId);
};

exports.searchServices = async (query = {}, category, minPrice, maxPrice, sortBy) => {
    let services = await servicesStorage.getAll();

    if (query.q) {
        const q = query.q.toLowerCase();
        services = services.filter(s => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
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
