const db = require('./db.js');

const serialNumbers = [
    '1HF5350YXZJ',
    'R5GY81M82GR',
    'R5GY1B22WJ8H',
    'R5GYB3EN6HV',
    '466VK184',
    'VNY60487WR',
    'VNY60487WU',
    '55A62QS'
];

async function updateDepartment() {
    try {
        const placeholders = serialNumbers.map((_, i) => `$${i + 2}`).join(', ');
        const queryText = `
            UPDATE assets 
            SET department = $1
            WHERE serial_number IN (${placeholders})
        `;
        
        const res = await db.query(queryText, ['Works Department', ...serialNumbers]);
        console.log(`Updated ${res.rowCount} assets to Works Department.`);
    } catch (err) {
        console.error('Error updating department:', err.message);
    } finally {
        process.exit(0);
    }
}

updateDepartment();
