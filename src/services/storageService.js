const path = require('path');
const fs = require('fs');
const { getSupabaseClient, isSupabaseConfigured } = require('../config/supabase');

const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'campusconnect';

let bucketVerified = false;

/**
 * Check or create the storage bucket in Supabase
 */
async function ensureBucket() {
    if (bucketVerified) return true;
    const client = getSupabaseClient();
    if (!client) return false;

    try {
        const { data: buckets, error: listError } = await client.storage.listBuckets();
        if (!listError && Array.isArray(buckets)) {
            const exists = buckets.some(b => b.name === BUCKET_NAME || b.id === BUCKET_NAME);
            if (exists) {
                bucketVerified = true;
                return true;
            }
        }

        // Try creating the public bucket
        const { data, error } = await client.storage.createBucket(BUCKET_NAME, {
            public: true,
            fileSizeLimit: 10 * 1024 * 1024 // 10MB
        });

        if (!error || (error && error.message && error.message.includes('already exists'))) {
            bucketVerified = true;
            return true;
        }

        return false;
    } catch (err) {
        return false;
    }
}

/**
 * Determine MIME type from file extension
 */
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.webp':
            return 'image/webp';
        case '.gif':
            return 'image/gif';
        case '.svg':
            return 'image/svg+xml';
        default:
            return 'application/octet-stream';
    }
}

/**
 * Upload a local file buffer or disk file directly to Supabase Storage bucket
 * @param {string|Buffer} source - Local absolute file path OR Buffer
 * @param {string} destinationPath - Path inside the bucket, e.g. "services/img123.jpg"
 * @param {string} [mimeType] - Optional MIME type
 * @returns {Promise<string>} Public URL of the uploaded image
 */
async function uploadToSupabase(source, destinationPath, mimeType) {
    const client = getSupabaseClient();
    if (!client) {
        throw new Error('Supabase client is not configured');
    }

    await ensureBucket();

    let fileBuffer;
    let contentType = mimeType;

    if (Buffer.isBuffer(source)) {
        fileBuffer = source;
    } else if (typeof source === 'string') {
        fileBuffer = await fs.promises.readFile(source);
        if (!contentType) {
            contentType = getMimeType(source);
        }
    } else {
        throw new Error('Invalid source for upload: must be Buffer or file path string');
    }

    const cleanDest = destinationPath.replace(/\\/g, '/').replace(/^\/+/, '');

    const { data, error } = await client.storage
        .from(BUCKET_NAME)
        .upload(cleanDest, fileBuffer, {
            contentType: contentType || 'application/octet-stream',
            upsert: true
        });

    if (error) {
        console.error(`[Supabase Storage Error] Upload to '${BUCKET_NAME}/${cleanDest}' failed:`, error.message);
        throw error;
    }

    const { data: urlData } = client.storage.from(BUCKET_NAME).getPublicUrl(cleanDest);
    return urlData.publicUrl;
}

/**
 * Upload a Multer uploaded file (`req.file`) to Supabase Storage
 * Returns the Supabase public URL if successful, or falls back to local `/uploads/${subfolder}/${filename}`
 * @param {object} multerFile - req.file from multer
 * @param {string} subfolder - e.g. 'services', 'payments', 'payouts', 'partner-qr'
 * @returns {Promise<string>}
 */
async function uploadMulterFile(multerFile, subfolder) {
    if (!multerFile) return null;

    const ext = path.extname(multerFile.originalname || '').toLowerCase() || 
                (multerFile.mimetype ? '.' + multerFile.mimetype.split('/')[1] : '.jpg');
    const filename = multerFile.filename || `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const source = multerFile.buffer || multerFile.path;
    const destPath = `${subfolder}/${filename}`;

    if (isSupabaseConfigured()) {
        try {
            const publicUrl = await uploadToSupabase(source, destPath, multerFile.mimetype);
            console.log(`☁️ [Supabase Storage] File uploaded successfully to bucket '${BUCKET_NAME}': ${publicUrl}`);
            return publicUrl;
        } catch (err) {
            console.warn(`⚠️ [Supabase Storage] Upload error: ${err.message}`);
        }
    }

    // Local disk fallback (if Supabase not configured or failed)
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
    
    if (isServerless) {
        // On serverless, filesystem is read-only. Fall back to Base64 data URL so image works everywhere without crashing!
        if (Buffer.isBuffer(source)) {
            const mime = multerFile.mimetype || 'image/jpeg';
            return `data:${mime};base64,${source.toString('base64')}`;
        }
        return `/uploads/${subfolder}/${filename}`;
    }

    // Local development writable disk
    try {
        const destDir = path.join(process.cwd(), 'uploads', subfolder);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        const filePath = path.join(destDir, filename);
        if (Buffer.isBuffer(source)) {
            fs.writeFileSync(filePath, source);
        } else if (typeof source === 'string' && source !== filePath && fs.existsSync(source)) {
            fs.copyFileSync(source, filePath);
        }
        return `/uploads/${subfolder}/${filename}`;
    } catch (diskErr) {
        console.warn(`⚠️ [Local Storage] Could not write to disk: ${diskErr.message}`);
        if (Buffer.isBuffer(source)) {
            const mime = multerFile.mimetype || 'image/jpeg';
            return `data:${mime};base64,${source.toString('base64')}`;
        }
        return `/uploads/${subfolder}/${filename}`;
    }
}

/**
 * Upload an array of Multer files to Supabase Storage concurrently
 * @param {Array} multerFiles - Array of req.file objects
 * @param {string} subfolder - e.g. 'services'
 * @returns {Promise<Array<string>>}
 */
async function uploadMultipleMulterFiles(multerFiles, subfolder) {
    if (!multerFiles || !Array.isArray(multerFiles) || multerFiles.length === 0) return [];
    const uploadPromises = multerFiles.map(file => uploadMulterFile(file, subfolder));
    const results = await Promise.all(uploadPromises);
    return results.filter(Boolean);
}

/**
 * Retrieve public URL from path or return unchanged if already a full URL or local fallback
 */
function getPublicUrl(storagePath) {
    if (!storagePath) return '';
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
        return storagePath;
    }
    const client = getSupabaseClient();
    if (client && isSupabaseConfigured()) {
        const cleanPath = storagePath.replace(/^\/+/, '');
        const { data } = client.storage.from(BUCKET_NAME).getPublicUrl(cleanPath);
        if (data && data.publicUrl) return data.publicUrl;
    }
    return storagePath;
}

/**
 * Get banner URL with Supabase Storage public CDN URL or fallback to local path
 */
function getBannerUrl(bannerFilename) {
    const defaultLocal = `/images/banners/${bannerFilename}`;
    if (!isSupabaseConfigured()) {
        return defaultLocal;
    }
    const client = getSupabaseClient();
    if (client) {
        const { data } = client.storage.from(BUCKET_NAME).getPublicUrl(`banners/${bannerFilename}`);
        if (data && data.publicUrl) return data.publicUrl;
    }
    return defaultLocal;
}

module.exports = {
    BUCKET_NAME,
    ensureBucket,
    uploadToSupabase,
    uploadMulterFile,
    uploadMultipleMulterFiles,
    getPublicUrl,
    getBannerUrl,
    getMimeType
};
