const db = require('./db');

async function checkUsers() {
    try {
        const result = await db.query('SELECT id, username, name, role, initials, is_active FROM users');
        console.log('Users in database:', result.rows);
    } catch (err) {
        console.error('Error fetching users:', err);
    } finally {
        process.exit();
    }
}

checkUsers();
