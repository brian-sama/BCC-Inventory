const db = require('./db.js');

async function migrate() {
    console.log('Starting migration...');
    const maxRetries = 3;

    async function queryWithRetry(sql, params = []) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await db.query(sql, params);
            } catch (error) {
                if (error.code === 'ECONNRESET' || error.message.includes('Connection terminated')) {
                    console.log(`Connection dropped, retrying in 2 seconds... (${i + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    throw error;
                }
            }
        }
        throw new Error('Max retries reached for query: ' + sql);
    }

    try {
        // Ping to wake up db
        await queryWithRetry("SELECT 1;");

        console.log('1. Adding disposal_date');
        try {
            await queryWithRetry(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS disposal_date DATE;`);
        } catch (e) { console.error('Error adding disposal_date', e.message); }

        console.log('2. Creating departments table');
        try {
            await queryWithRetry(`
                CREATE TABLE IF NOT EXISTS departments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(100) NOT NULL UNIQUE
                );
            `);
        } catch (e) { console.error('Error creating departments', e.message); }

        console.log('3. Adding department_id to assets');
        try {
            await queryWithRetry(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);`);
        } catch (e) { console.error('Error adding department_id', e.message); }

        console.log('4. Adding brand');
        try {
            await queryWithRetry(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS brand VARCHAR(150);`);
        } catch (e) { console.error('Error adding brand', e.message); }

        console.log('5. Adding purchase_date');
        try {
            await queryWithRetry(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_date DATE;`);
        } catch (e) { console.error('Error adding purchase_date', e.message); }

        // Let's get the schema to verify
        const res = await queryWithRetry(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'assets';`);
        console.log('Assets Columns:', res.rows.map(r => r.column_name).join(', '));

    } catch (e) {
        console.error('Migration failed', e);
    } finally {
        process.exit(0);
    }
}

migrate();
