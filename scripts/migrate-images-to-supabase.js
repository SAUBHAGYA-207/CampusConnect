require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getSupabaseClient, isSupabaseConfigured } = require('../src/config/supabase');
const { BUCKET_NAME, ensureBucket, uploadToSupabase, getMimeType } = require('../src/services/storageService');
const JsonStorage = require('../src/storage/jsonStorage');

async function runMigration() {
    console.log('============================================================');
    console.log('🚀 CAMPUSCONNECT IMAGE MIGRATION TO SUPABASE STORAGE');
    console.log('============================================================');

    if (!isSupabaseConfigured()) {
        console.error('❌ Supabase is not configured. Please set SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY) in your .env file.');
        process.exit(1);
    }

    const client = getSupabaseClient();
    if (!client) {
        console.error('❌ Failed to initialize Supabase client.');
        process.exit(1);
    }

    console.log(`📡 Connecting to Supabase project...`);
    console.log(`📦 Target Storage Bucket: "${BUCKET_NAME}"`);

    // 1. Verify / Create Storage Bucket
    console.log('\n[Step 1/3] Verifying Storage Bucket...');
    let bucketReady = await ensureBucket();
    if (!bucketReady) {
        console.log('\n------------------------------------------------------------');
        console.log('⚠️  ACTION REQUIRED: SUPABASE BUCKET SETUP');
        console.log('------------------------------------------------------------');
        console.log(`To allow public access and automated uploads, please either:`);
        console.log(`Option A: Add your SUPABASE_SERVICE_ROLE_KEY to .env (from Supabase Dashboard -> Project Settings -> API -> service_role secret).`);
        console.log(`Option B: In your Supabase Dashboard:`);
        console.log(`   1. Go to "Storage" in the left sidebar.`);
        console.log(`   2. Click "New Bucket" and name it: ${BUCKET_NAME}`);
        console.log(`   3. Toggle "Public bucket" to ON.`);
        console.log(`   4. Click "Save bucket".`);
        console.log('------------------------------------------------------------\n');
        process.exit(1);
    }
    console.log(`✅ Bucket "${BUCKET_NAME}" is verified and ready.`);

    // 2. Upload Files to Supabase Storage
    console.log('\n[Step 2/3] Uploading local image assets to Supabase Storage...');
    const urlMap = new Map(); // local path -> supabase public URL

    const foldersToScan = [
        { dir: path.join(__dirname, '../uploads/services'), bucketPrefix: 'services', localPrefix: '/uploads/services/' },
        { dir: path.join(__dirname, '../uploads/payments'), bucketPrefix: 'payments', localPrefix: '/uploads/payments/' },
        { dir: path.join(__dirname, '../uploads/payouts'), bucketPrefix: 'payouts', localPrefix: '/uploads/payouts/' },
        { dir: path.join(__dirname, '../uploads/partner-qr'), bucketPrefix: 'partner-qr', localPrefix: '/uploads/partner-qr/' },
        { dir: path.join(__dirname, '../public/images/banners'), bucketPrefix: 'banners', localPrefix: '/images/banners/' }
    ];

    let totalUploaded = 0;
    let totalSkipped = 0;

    for (const folder of foldersToScan) {
        if (!fs.existsSync(folder.dir)) {
            continue;
        }

        const files = fs.readdirSync(folder.dir);
        for (const file of files) {
            const fullPath = path.join(folder.dir, file);
            const stat = fs.statSync(fullPath);
            if (!stat.isFile()) continue;

            const destPath = `${folder.bucketPrefix}/${file}`;
            const localWebPath = `${folder.localPrefix}${file}`;

            try {
                process.stdout.write(`  ⬆️  Uploading ${destPath}... `);
                const publicUrl = await uploadToSupabase(fullPath, destPath, getMimeType(fullPath));
                urlMap.set(localWebPath, publicUrl);
                totalUploaded++;
                console.log(`DONE`);
            } catch (err) {
                console.log(`FAILED (${err.message})`);
                totalSkipped++;
            }
        }
    }

    console.log(`\n🎉 Upload Complete! ${totalUploaded} file(s) uploaded to Supabase, ${totalSkipped} skipped/failed.`);

    // 3. Migrate and Update Database References
    console.log('\n[Step 3/3] Updating database records with new Supabase CDN URLs...');

    const servicesStorage = new JsonStorage('services');
    const appointmentsStorage = new JsonStorage('appointments');
    const usersStorage = new JsonStorage('users');
    const payoutsStorage = new JsonStorage('payouts');

    let updatedServices = 0;
    let updatedAppointments = 0;
    let updatedUsers = 0;
    let updatedPayouts = 0;

    // A. Services
    const services = await servicesStorage.getAll();
    for (const s of services) {
        if (s.image && urlMap.has(s.image)) {
            const newUrl = urlMap.get(s.image);
            await servicesStorage.update(s.id, { image: newUrl });
            console.log(`  🔄 Service [${s.title}]: image updated to ${newUrl}`);
            updatedServices++;
        }
    }

    // B. Appointments
    const appointments = await appointmentsStorage.getAll();
    for (const a of appointments) {
        if (a.paymentScreenshot && urlMap.has(a.paymentScreenshot)) {
            const newUrl = urlMap.get(a.paymentScreenshot);
            await appointmentsStorage.update(a.id, { paymentScreenshot: newUrl });
            console.log(`  🔄 Appointment [${a.id}]: paymentScreenshot updated to ${newUrl}`);
            updatedAppointments++;
        }
    }

    // C. Users (Partner QR)
    const users = await usersStorage.getAll();
    for (const u of users) {
        if (u.partnerQrImage && urlMap.has(u.partnerQrImage)) {
            const newUrl = urlMap.get(u.partnerQrImage);
            await usersStorage.update(u.id, { partnerQrImage: newUrl });
            console.log(`  🔄 User [${u.email}]: partnerQrImage updated to ${newUrl}`);
            updatedUsers++;
        }
    }

    // D. Payouts
    const payouts = await payoutsStorage.getAll();
    for (const p of payouts) {
        if (p.paymentProof && urlMap.has(p.paymentProof)) {
            const newUrl = urlMap.get(p.paymentProof);
            await payoutsStorage.update(p.id, { paymentProof: newUrl });
            console.log(`  🔄 Payout [${p.id}]: paymentProof updated to ${newUrl}`);
            updatedPayouts++;
        }
    }

    console.log('\n============================================================');
    console.log('🏁 MIGRATION SUMMARY:');
    console.log(`   - Storage Files Uploaded:  ${totalUploaded}`);
    console.log(`   - Services Updated:        ${updatedServices}`);
    console.log(`   - Appointments Updated:    ${updatedAppointments}`);
    console.log(`   - Users/QR Updated:        ${updatedUsers}`);
    console.log(`   - Payout Receipts Updated: ${updatedPayouts}`);
    console.log('============================================================\n');
}

runMigration().catch(err => {
    console.error('Migration failed with fatal error:', err);
    process.exit(1);
});
