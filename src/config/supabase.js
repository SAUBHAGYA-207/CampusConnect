const { createClient } = require('@supabase/supabase-js');

let supabase = null;

function getSupabaseClient() {
    if (supabase) return supabase;

    const supabaseUrl = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim() : null;
    const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)
        ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY).trim()
        : null;

    if (supabaseUrl && supabaseKey) {
        try {
            supabase = createClient(supabaseUrl, supabaseKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false
                }
            });
            console.log(`[Database] Connected to Supabase Cloud Database at: ${supabaseUrl}`);
            return supabase;
        } catch (err) {
            console.error('[Database] Failed to initialize Supabase client:', err.message);
            return null;
        }
    }

    return null;
}

function isSupabaseConfigured() {
    return Boolean(
        process.env.SUPABASE_URL && 
        (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)
    );
}

module.exports = {
    getSupabaseClient,
    isSupabaseConfigured
};
