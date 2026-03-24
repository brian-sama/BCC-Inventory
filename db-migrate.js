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

        console.log('3. Creating sections table');
        try {
            await queryWithRetry(`
                CREATE TABLE IF NOT EXISTS sections (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR(100) NOT NULL,
                    department_id UUID REFERENCES departments(id),
                    vote_number VARCHAR(50)
                );
            `);
        } catch (e) { console.error('Error creating sections', e.message); }

        console.log('4. Adding department_id and section_id and status to assets');
        try {
            await queryWithRetry(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);`);
            await queryWithRetry(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES sections(id);`);
            await queryWithRetry(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';`);
        } catch (e) { console.error('Error updating assets columns', e.message); }

        console.log('5. Creating vouchers table');
        try {
            await queryWithRetry(`
                CREATE TABLE IF NOT EXISTS vouchers (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    voucher_number VARCHAR(100) UNIQUE,
                    requisition_number VARCHAR(100),
                    store_committee TEXT,
                    code_number VARCHAR(100),
                    date DATE
                );
            `);
        } catch (e) { console.error('Error creating vouchers', e.message); }

        console.log('6. Creating voucher_items table');
        try {
            await queryWithRetry(`
                CREATE TABLE IF NOT EXISTS voucher_items (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    voucher_id UUID REFERENCES vouchers(id),
                    item VARCHAR(255),
                    description TEXT,
                    unit VARCHAR(50),
                    quantity INTEGER,
                    unit_price DECIMAL(12,2)
                );
            `);
        } catch (e) { console.error('Error creating voucher_items', e.message); }

        console.log('7. Creating deliveries table');
        try {
            await queryWithRetry(`
                CREATE TABLE IF NOT EXISTS deliveries (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    voucher_id UUID REFERENCES vouchers(id),
                    delivery_date DATE
                );
            `);
        } catch (e) { console.error('Error creating deliveries', e.message); }

        console.log('8. Creating audit_logs table');
        try {
            await queryWithRetry(`
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_name VARCHAR(100),
                    user_id UUID,
                    action VARCHAR(100),
                    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    details TEXT
                );
            `);
        } catch (e) { console.error('Error creating audit_logs', e.message); }

        console.log('9. Adding brand and purchase_date');
        try {
            await queryWithRetry(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS brand VARCHAR(150);`);
            await queryWithRetry(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_date DATE;`);
        } catch (e) { console.error('Error adding brand/purchase_date', e.message); }

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
