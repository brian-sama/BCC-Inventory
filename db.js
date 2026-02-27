const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    keepAlive: true
});

pool.on('error', (err, client) => {
    console.error('Unexpected error on idle client', err);
});

module.exports = {
    query: async (text, params) => {
        let retries = 3;
        while (retries > 0) {
            try {
                return await pool.query(text, params);
            } catch (err) {
                if (err.code === 'ECONNRESET' || err.message.includes('terminat')) {
                    retries--;
                    if (retries === 0) throw err;
                    console.log('Connection reset, retrying query...');
                    await new Date(resolve => setTimeout(resolve, 500));
                } else {
                    throw err;
                }
            }
        }
    },
    pool: pool
};
