require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getSupabaseClient, isSupabaseConfigured } = require('../src/config/supabase');
const { BUCKET_NAME } = require('../src/services/storageService');

async function clearAll() {
    console.log('============================================================');
    console.log('🧹 COMPLETE DATABASE & STORAGE PURGE');
    console.log('============================================================');

    // 1. Clear Supabase Cloud Tables
    if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        if (client) {
            console.log('\n[1/4] Clearing Supabase PostgreSQL cloud tables...');
            const tables = ['notifications', 'admin_messages', 'messages', 'payouts', 'appointments', 'services', 'users'];
            for (const table of tables) {
                try {
                    // Delete all rows where id is not an impossible value
                    const { error, count } = await client
                        .from(table)
                        .delete()
                        .neq('id', '__impossible_id__');

                    if (error) {
                        console.error(`  ❌ Failed to clear table "${table}":`, error.message);
                    } else {
                        console.log(`  ✅ Table "${table}" purged successfully.`);
                    }
                } catch (err) {
                    console.error(`  ❌ Error purging table "${table}":`, err.message);
                }
            }
        }
    } else {
        console.log('\n[1/4] Supabase not configured, skipping remote table purge.');
    }

    // 2. Clear Local JSON storage files
    console.log('\n[2/4] Resetting local data/*.json files...');
    const dataDir = path.join(__dirname, '../data');
    const jsonFiles = [
        'users.json',
        'services.json',
        'appointments.json',
        'payouts.json',
        'messages.json',
        'admin_messages.json',
        'notifications.json'
    ];

    for (const file of jsonFiles) {
        const filePath = path.join(dataDir, file);
        try {
            fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf8');
            console.log(`  ✅ ${file} reset to empty array.`);
        } catch (err) {
            console.error(`  ❌ Failed to reset ${file}:`, err.message);
        }
    }

    // 3. Clear Active User Sessions
    console.log('\n[3/4] Purging active session cookies and files...');
    const sessionsDir = path.join(dataDir, 'sessions');
    if (fs.existsSync(sessionsDir)) {
        const sessionFiles = fs.readdirSync(sessionsDir);
        let removedCount = 0;
        for (const sf of sessionFiles) {
            if (sf.endsWith('.json')) {
                fs.unlinkSync(path.join(sessionsDir, sf));
                removedCount++;
            }
        }
        console.log(`  ✅ Purged ${removedCount} active session file(s).`);
    } else {
        console.log('  ℹ️ No sessions folder found.');
    }

    // 4. Clean local upload directories and Supabase Storage bucket user uploads
    console.log('\n[4/4] Purging user-uploaded images (keeping platform banners)...');
    const uploadFolders = ['services', 'payments', 'payouts', 'partner-qr'];

    // Local uploads cleanup
    for (const folder of uploadFolders) {
        const dir = path.join(__dirname, '../uploads', folder);
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            let deletedFiles = 0;
            for (const file of files) {
                if (file !== '.gitkeep') {
                    try {
                        fs.unlinkSync(path.join(dir, file));
                        deletedFiles++;
                    } catch (e) {}
                }
            }
            console.log(`  ✅ Cleaned local uploads/${folder}: deleted ${deletedFiles} file(s).`);
        }
    }

    // Supabase bucket user uploads cleanup
    if (isSupabaseConfigured()) {
        const client = getSupabaseClient();
        if (client) {
            for (const folder of uploadFolders) {
                try {
                    const { data: files } = await client.storage.from(BUCKET_NAME).list(folder);
                    if (files && files.length > 0) {
                        const pathsToDelete = files.map(f => `${folder}/${f.name}`);
                        const { error } = await client.storage.from(BUCKET_NAME).remove(pathsToDelete);
                        if (!error) {
                            console.log(`  ✅ Purged ${files.length} file(s) from Supabase bucket "${BUCKET_NAME}/${folder}".`);
                        }
                    }
                } catch (e) {}
            }
        }
    }

    console.log('\n============================================================');
    console.log('✨ 100% CLEAN SLATE ACHIEVED!');
    console.log('👉 You can now register fresh at /admin/register using your whitelisted email.');
    console.log('============================================================\n');
}

clearAll().catch(err => {
    console.error('Fatal error clearing database:', err);
    process.exit(1);
});
