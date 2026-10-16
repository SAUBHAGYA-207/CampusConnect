require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getSupabaseClient, isSupabaseConfigured } = require('../src/config/supabase');

async function testSupabaseConnection() {
    console.log('====================================================');
    console.log('       SUPABASE CONNECTIVITY & HEALTH CHECK         ');
    console.log('====================================================\n');

    console.log(`Checking Configuration:`);
    console.log(`- Configured: ${isSupabaseConfigured() ? 'YES' : 'NO'}`);
    console.log(`- Project URL: ${process.env.SUPABASE_URL || 'Not set'}`);
    console.log(`- Key (First 15 chars): ${process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.substring(0, 15) + '...' : 'Not set'}\n`);

    if (!isSupabaseConfigured()) {
        console.error('❌ Supabase URL or Key is missing from .env');
        process.exit(1);
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        console.error('❌ Failed to initialize Supabase client.');
        process.exit(1);
    }

    const tables = ['users', 'services', 'appointments', 'payouts', 'messages', 'admin_messages', 'notifications'];
    let allPassed = true;
    let tablesMissing = false;

    console.log('Testing Table Access:\n');

    for (const table of tables) {
        try {
            const { data, error, status } = await supabase.from(table).select('*').limit(1);
            if (error) {
                console.log(`❌ Table "${table}": ERROR (${error.code || status}) - ${error.message}`);
                if (error.message.includes('relation') && error.message.includes('does not exist')) {
                    tablesMissing = true;
                }
                allPassed = false;
            } else {
                console.log(`✅ Table "${table}": REACHABLE & OK (HTTP ${status})`);
            }
        } catch (err) {
            console.log(`❌ Table "${table}": NETWORK / UNEXPECTED ERROR: ${err.message}`);
            allPassed = false;
        }
    }

    console.log('\n----------------------------------------------------');
    if (allPassed) {
        console.log('🎉 SUCCESS: Supabase is 100% reachable and all tables are ready!');
    } else if (tablesMissing) {
        console.log('⚠️  CONNECTED TO SUPABASE, BUT TABLES ARE NOT CREATED YET.');
        console.log('   👉 Please go to Supabase Dashboard -> SQL Editor,');
        console.log('      paste the contents of "supabase-schema.sql", and click "Run".');
    } else {
        console.log('⚠️  Connected to Supabase, but some queries failed. Review the logs above.');
    }
    console.log('====================================================\n');
}

testSupabaseConnection();
