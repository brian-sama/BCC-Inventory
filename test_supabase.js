const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabase() {
    try {
        console.log('Fetching users from Supabase...');
        const { data, error } = await supabase.from('users').select('*');
        if (error) {
            console.error('Supabase error:', error.message);
        } else {
            console.log('Supabase users:', data);
        }
    } catch (err) {
        console.error('Fetch failed:', err.message);
    }
}

testSupabase();
