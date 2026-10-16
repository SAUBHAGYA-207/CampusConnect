/**
 * Supabase Data Migration Script
 * Migrates local data/*.json files into Supabase PostgreSQL tables.
 *
 * Usage:
 *   node scripts/migrate-to-supabase.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs').promises;
const path = require('path');
const { getSupabaseClient, isSupabaseConfigured } = require('../src/config/supabase');

const TABLES = [
    'users',
    'services',
    'appointments',
    'payouts',
    'messages',
    'admin_messages',
    'notifications'
];

async function migrate() {
    console.log('\n=============================================================');
    console.log('       CAMPUSCONNECT SUPABASE MIGRATION WIZARD               ');
    console.log('=============================================================\n');

    if (!isSupabaseConfigured()) {
        console.error('❌ Supabase environment variables are missing!');
        console.error('   Please ensure your .env file has:');
        console.error('     SUPABASE_URL=https://<your-project-ref>.supabase.co');
        console.error('     SUPABASE_KEY=eyJh... (anon or service_role key)\n');
        process.exit(1);
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        console.error('❌ Failed to initialize Supabase client.');
        process.exit(1);
    }

    console.log(`📡 Connected to Supabase at: ${process.env.SUPABASE_URL}\n`);

    let totalMigrated = 0;

    for (const tableName of TABLES) {
        const filePath = path.join(__dirname, '../data', `${tableName}.json`);
        try {
            const rawData = await fs.readFile(filePath, 'utf8');
            const records = JSON.parse(rawData);

            if (!Array.isArray(records) || records.length === 0) {
                console.log(`⏩ [${tableName}] No records to migrate (empty).`);
                continue;
            }

            console.log(`⏳ [${tableName}] Uploading ${records.length} records...`);
            const { data, error } = await supabase
                .from(tableName)
                .upsert(records, { onConflict: 'id' });

            if (error) {
                console.error(`❌ [${tableName}] Migration failed:`, error.message);
                if (error.message.includes('relation') && error.message.includes('does not exist')) {
                    console.error(`   👉 Hint: Did you run supabase-schema.sql in the Supabase SQL Editor?`);
                }
            } else {
                console.log(`✅ [${tableName}] Successfully migrated ${records.length} records.`);
                totalMigrated += records.length;
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                console.log(`⏩ [${tableName}] File data/${tableName}.json not found, skipping.`);
            } else {
                console.error(`❌ [${tableName}] Error reading file:`, err.message);
            }
        }
    }

    console.log('\n=============================================================');
    console.log(`🎉 Migration Completed! Total ${totalMigrated} records processed.`);
    console.log('=============================================================\n');
}

migrate();
