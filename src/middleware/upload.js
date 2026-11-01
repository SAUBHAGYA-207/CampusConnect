const multer = require('multer');
const path = require('path');
const fs = require('fs');

const createStorage = (subfolder) => {
    return multer.diskStorage({
        destination: (req, file, cb) => {
            const dest = path.join(__dirname, `../../uploads/${subfolder}`);
            fs.mkdirSync(dest, { recursive: true });
            cb(null, dest);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, uniqueSuffix + path.extname(file.originalname));
        }
    });
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

// Exports
const upload = serviceUpload;
upload.serviceUpload = serviceUpload;
upload.serviceMultiUpload = serviceMultiUpload;
upload.paymentUpload = paymentUpload;
upload.payoutUpload = payoutUpload;
upload.partnerQrUpload = partnerQrUpload;
upload.chatUpload = chatUpload;

module.exports = upload;
