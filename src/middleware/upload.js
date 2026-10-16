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
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WEBP images are allowed.'), false);
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

// Exports
const upload = serviceUpload;
upload.serviceUpload = serviceUpload;
upload.paymentUpload = paymentUpload;
upload.payoutUpload = payoutUpload;
upload.partnerQrUpload = partnerQrUpload;

module.exports = upload;
