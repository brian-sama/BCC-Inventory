const db = require('./db.js');

async function fixDisposalDates() {
    try {
        const queryText = `
            UPDATE assets
            SET disposal_date = purchase_date + interval '3 years'
            WHERE purchase_date IS NOT NULL AND disposal_date IS NULL
        `;
        
        const res = await db.query(queryText);
        console.log(`Updated ${res.rowCount} assets with auto-calculated disposal dates.`);
    } catch (err) {
        console.error('Error updating disposal dates:', err.message);
    } finally {
        process.exit(0);
    }
}

fixDisposalDates();
