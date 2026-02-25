const db = require('./db');
require('dotenv').config();

async function migrateData() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    const tables = ['users', 'categories', 'inventory', 'assets', 'activity_log'];

    for (const table of tables) {
        console.log(`Migrating table: ${table}...`);
        try {
            const url = `${supabaseUrl}/rest/v1/${table}?select=*`;
            const response = await fetch(url, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });

            if (!response.ok) {
                console.error(`Failed to fetch ${table}: ${response.statusText}`);
                continue;
            }

            const data = await response.json();
            console.log(`Fetched ${data.length} rows from ${table}`);

            if (data.length === 0) continue;

            // Clear Neon table (optional, but good for a fresh start)
            // await db.query(`TRUNCATE TABLE ${table} CASCADE`);

            // Insert into Neon
            for (const row of data) {
                const keys = Object.keys(row);
                const values = Object.values(row);
                const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
                const columns = keys.map(k => `"${k}"`).join(', ');

                const query = `INSERT INTO "public"."${table}" (${columns}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ')}`;

                // Handle JSONB fields for activity_log or others if any
                const processedValues = values.map(v => typeof v === 'object' && v !== null ? JSON.stringify(v) : v);

                await db.query(query, processedValues);
            }
            console.log(`Successfully migrated ${table}`);
        } catch (err) {
            console.error(`Error migrating ${table}:`, err.message);
        }
    }

    console.log('Data migration completed!');
    process.exit();
}

migrateData();
