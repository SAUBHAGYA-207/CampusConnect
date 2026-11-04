const multer = require('multer');
const path = require('path');
const fs = require('fs');

const createStorage = () => {
    // Use in-memory buffer storage so uploads work seamlessly on serverless/read-only
    // environments (such as Vercel/AWS Lambda) without triggering EROFS file system errors.
    return multer.memoryStorage();
};

const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
        'image/pjpeg', 'image/x-png', 'image/gif', 'image/avif'
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

    if (allowedMimes.includes(file.mimetype.toLowerCase()) || allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid image format. Allowed formats: JPEG, PNG, WEBP, GIF, and AVIF.'), false);
    }
};

const serviceUpload = multer({
    storage: createStorage('services'),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: fileFilter
});

const paymentUpload = multer({
    storage: createStorage('payments'),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: fileFilter
});

const payoutUpload = multer({
    storage: createStorage('payouts'),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: fileFilter
});

const partnerQrUpload = multer({
    storage: createStorage('partner-qr'),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: fileFilter
});

const chatUpload = multer({
    storage: createStorage('chat'),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: fileFilter
});

// Middleware to accept multiple service images with names 'images' or 'image'
const serviceMultiUpload = (req, res, next) => {
    serviceUpload.fields([
        { name: 'images', maxCount: 10 },
        { name: 'image', maxCount: 1 }
    ])(req, res, (err) => {
        if (err) {
            console.warn('[Upload Middleware Warning]:', err.message);
            req.uploadError = err.message || 'Error uploading selected image(s).';
        }
        // Consolidate files into req.files array for convenient consumption
        const allFiles = [];
        if (req.files) {
            if (req.files.images) allFiles.push(...req.files.images);
            if (req.files.image) allFiles.push(...req.files.image);
        } else if (req.file) {
            allFiles.push(req.file);
        }
        req.uploadedFiles = allFiles;
        next();
    });
};

// Multi-field upload for booking (payment proof + optional customer reference photo/video)
const bookingUpload = multer({
    storage: createStorage('requirements'),
    limits: { fileSize: 30 * 1024 * 1024 }, // 30MB max for videos & photos
    fileFilter: (req, file, cb) => {
        const allowedExts = [
            '.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif',
            '.mp4', '.mov', '.webm', '.avi', '.mkv',
            '.pdf', '.zip'
        ];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExts.includes(ext) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Invalid file format. Allowed: Images, Videos, and PDF documents.'), false);
        }
    }
});

const bookingMultiUpload = (req, res, next) => {
    bookingUpload.fields([
        { name: 'paymentScreenshot', maxCount: 1 },
        { name: 'referenceMedia', maxCount: 1 }
    ])(req, res, (err) => {
        if (err) {
            console.warn('[Booking Upload Warning]:', err.message);
            req.uploadError = err.message;
        }
        next();
    });
};

// Exports
const upload = serviceUpload;
upload.serviceUpload = serviceUpload;
upload.serviceMultiUpload = serviceMultiUpload;
upload.paymentUpload = paymentUpload;
upload.bookingMultiUpload = bookingMultiUpload;
upload.payoutUpload = payoutUpload;
upload.partnerQrUpload = partnerQrUpload;
upload.chatUpload = chatUpload;

module.exports = upload;
